import "server-only";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { HttpError } from "@/server/http";

export const MAX_BYTES = 4 * 1024 * 1024; // P6; Vercel caps a request body at 4.5 MB (DEP-1)
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const CSV_MIMES = new Set(["text/csv", "application/csv", "text/plain", "application/vnd.ms-excel", "text/x-csv", ""]);

export type ParsedSheet = {
  headers: string[];
  /** rowNo is the 1-based spreadsheet row number (header = row 1) so error reports match what the admin sees. */
  rows: { rowNo: number; cells: Record<string, string>; problem?: string }[];
  notes: string[];
};

/** Extension + declared MIME + magic bytes must all agree (UPL-10). */
export function sniff(fileName: string, mime: string, buf: Buffer): "xlsx" | "csv" {
  if (buf.length === 0) throw new HttpError(400, "The file is empty");
  if (buf.length > MAX_BYTES) throw new HttpError(413, "File is larger than 4 MB");
  const ext = fileName.toLowerCase().split(".").pop();
  const isZip = buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
  if (ext === "xlsx") {
    if (!isZip) throw new HttpError(400, "This file is not a real .xlsx workbook (content does not match its extension)");
    if (mime && mime !== XLSX_MIME && mime !== "application/octet-stream" && mime !== "application/zip") throw new HttpError(400, "Unexpected file type for .xlsx");
    return "xlsx";
  }
  if (ext === "csv") {
    if (!CSV_MIMES.has(mime)) throw new HttpError(400, "Unexpected file type for .csv");
    const head = buf.subarray(0, 8192);
    if (isZip || head.includes(0) || (head[0] === 0x4d && head[1] === 0x5a)) throw new HttpError(400, "This file is not a text CSV (content does not match its extension)");
    return "csv";
  }
  throw new HttpError(400, "Upload a .xlsx or .csv file");
}

export function normHeader(h: unknown): string {
  return String(h ?? "")
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function isBlank(cells: Record<string, string>) {
  return Object.values(cells).every((v) => v.trim() === "");
}

export function parseFile(fileName: string, mime: string, buf: Buffer, maxRows: number): ParsedSheet {
  const kind = sniff(fileName, mime, buf);
  return kind === "xlsx" ? parseXlsx(buf, maxRows) : parseCsv(buf, maxRows);
}

function parseCsv(buf: Buffer, maxRows: number): ParsedSheet {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    throw new HttpError(400, "The CSV is not UTF-8. In Excel use: Save As → CSV UTF-8 (Comma delimited)");
  }
  text = text.replace(/^﻿/, ""); // BOM handling (P9)
  const res = Papa.parse<string[]>(text, { header: false, skipEmptyLines: false });
  const data = res.data as unknown[][];
  if (!data.length) throw new HttpError(400, "The file has no header row");
  const headers = (data[0] ?? []).map(normHeader);
  const rows: ParsedSheet["rows"] = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i] ?? [];
    const cells: Record<string, string> = {};
    headers.forEach((h, j) => (cells[h] = String(r[j] ?? "")));
    if (isBlank(cells)) continue; // UPL-15
    rows.push({ rowNo: i + 1, cells });
    if (rows.length > maxRows) break;
  }
  return { headers, rows, notes: [] };
}

function parseXlsx(buf: Buffer, maxRows: number): ParsedSheet {
  let wb: XLSX.WorkBook;
  try {
    // cellFormula: keep the formula text so we can store it as plain text, never its evaluated result (UPL-11).
    wb = XLSX.read(buf, { type: "buffer", cellFormula: true, cellDates: false, cellHTML: false, cellNF: false, sheetRows: maxRows + 50 });
  } catch {
    throw new HttpError(400, "Could not read the workbook. Re-save it as .xlsx and try again");
  }
  const notes: string[] = [];
  if (wb.SheetNames.length > 1) notes.push(`Only the first sheet ("${wb.SheetNames[0]}") was read; ${wb.SheetNames.length - 1} other sheet(s) ignored.`);
  const ws = wb.Sheets[wb.SheetNames[0]!];
  if (!ws || !ws["!ref"]) throw new HttpError(400, "The first sheet is empty");
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const merged = new Set<number>();
  for (const m of ws["!merges"] ?? []) for (let r = m.s.r; r <= m.e.r; r++) if (r > range.s.r) merged.add(r);

  const cellText = (r: number, c: number): string => {
    const cell = ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
    if (!cell) return "";
    if (cell.f) return "=" + cell.f;
    if (cell.v === undefined || cell.v === null) return "";
    if (typeof cell.v === "number") return Number.isInteger(cell.v) ? String(cell.v) : String(cell.v);
    return String(cell.v);
  };

  const headers: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) headers.push(normHeader(cellText(range.s.r, c)));
  const rows: ParsedSheet["rows"] = [];
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const cells: Record<string, string> = {};
    headers.forEach((h, j) => (cells[h] = cellText(r, range.s.c + j)));
    if (isBlank(cells)) continue;
    rows.push({ rowNo: r + 1, cells, problem: merged.has(r) ? "Row contains merged cells. Unmerge them and fill every cell." : undefined });
    if (rows.length > maxRows) break;
  }
  return { headers: trimTrailingEmpty(headers), rows, notes };
}

function trimTrailingEmpty(h: string[]) {
  const out = [...h];
  while (out.length && out[out.length - 1] === "") out.pop();
  return out;
}

/** Header check before preview (UPL-02). */
export function checkHeaders(headers: string[], required: readonly string[], optional: readonly string[]) {
  const present = headers.filter(Boolean);
  const missing = required.filter((h) => !present.includes(h));
  const allowed = new Set([...required, ...optional]);
  const unknown = present.filter((h) => !allowed.has(h));
  const dupes = present.filter((h, i) => present.indexOf(h) !== i);
  if (missing.length || unknown.length || dupes.length) {
    const parts = [];
    if (missing.length) parts.push(`missing: ${missing.join(", ")}`);
    if (unknown.length) parts.push(`not recognised: ${unknown.join(", ")}`);
    if (dupes.length) parts.push(`repeated: ${[...new Set(dupes)].join(", ")}`);
    throw new HttpError(400, `The header row doesn't match the template (${parts.join("; ")}).`, {
      expectedHeaders: [...required, ...optional],
      requiredHeaders: required,
      missing,
      unknown,
    });
  }
}
