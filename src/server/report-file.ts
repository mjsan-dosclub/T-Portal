import "server-only";
import { HttpError } from "./http";

// Weekly report file check (INT-3): extension AND content must agree. No compressed archives or programs.
export const REPORT_MAX_BYTES = 10 * 1024 * 1024;
export const ALLOWED_EXT = ["pdf", "doc", "docx", "xls", "xlsx", "csv", "txt", "ppt", "pptx", "rtf", "odt", "ods", "odp"] as const;
export type ReportExt = (typeof ALLOWED_EXT)[number];
export const ACCEPT_ATTR = ALLOWED_EXT.map((e) => "." + e).join(",");

const MIME: Record<ReportExt, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  rtf: "application/rtf",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
};
export const mimeFor = (ext: string) => MIME[ext as ReportExt] ?? "application/octet-stream";

const starts = (b: Buffer, sig: number[]) => sig.every((x, i) => b[i] === x);
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const OLE2 = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const BLOCKED_EXT = new Set(["zip", "rar", "7z", "gz", "tgz", "tar", "bz2", "xz", "exe", "msi", "bat", "cmd", "sh", "js", "jar", "apk", "dmg", "iso"]);

function isText(b: Buffer) {
  if (b.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(b);
    return true;
  } catch {
    return false;
  }
}

/** Returns the verified extension or throws a friendly 400. */
export function checkReportFile(name: string, buf: Buffer): ReportExt {
  if (!buf.length) throw new HttpError(400, "The file is empty");
  if (buf.length > REPORT_MAX_BYTES) throw new HttpError(413, "Report must be 10 MB or smaller");
  const ext = (name.toLowerCase().split(".").pop() ?? "") as ReportExt;
  if (BLOCKED_EXT.has(ext)) throw new HttpError(400, "Compressed files and programs aren't allowed. Upload the document itself (PDF, Word, Excel, PowerPoint, CSV or text).");
  if (!(ALLOWED_EXT as readonly string[]).includes(ext)) throw new HttpError(400, `Allowed file types: ${ALLOWED_EXT.join(", ")}`);
  const head = buf.subarray(0, 4096).toString("latin1");
  const zipText = buf.toString("latin1");
  let ok = false;
  switch (ext) {
    case "pdf":
      ok = head.startsWith("%PDF-");
      break;
    case "doc": case "xls": case "ppt":
      ok = starts(buf, OLE2);
      break;
    case "docx": case "xlsx": case "pptx":
      // OOXML is a zip with [Content_Types].xml and a matching part folder, which a plain archive lacks.
      ok = starts(buf, ZIP) && zipText.includes("[Content_Types].xml") && zipText.includes(ext === "docx" ? "word/" : ext === "xlsx" ? "xl/" : "ppt/");
      break;
    case "odt": case "ods": case "odp":
      ok = starts(buf, ZIP) && head.includes("mimetypeapplication/vnd.oasis.opendocument." + (ext === "odt" ? "text" : ext === "ods" ? "spreadsheet" : "presentation"));
      break;
    case "rtf":
      ok = head.startsWith("{\\rtf");
      break;
    case "csv": case "txt":
      ok = !starts(buf, ZIP) && !starts(buf, OLE2) && !head.startsWith("MZ") && isText(buf);
      break;
  }
  if (!ok) throw new HttpError(400, `This file isn't a real .${ext} (its content doesn't match the extension). Compressed or renamed files aren't allowed.`);
  return ext;
}

export function fileResponse(r: { fileName: string; fileType: string; data: Uint8Array }) {
  return new Response(new Uint8Array(r.data), {
    headers: {
      "Content-Type": mimeFor(r.fileType),
      "Content-Disposition": `attachment; filename="${r.fileName.replace(/"/g, "")}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "sandbox; default-src 'none'",
    },
  });
}
