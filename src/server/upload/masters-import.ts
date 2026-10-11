import "server-only";
import { db } from "@/lib/db";
import { nameKey, toCsv } from "@/lib/normalize";
import { masterSchemas, type MasterType } from "@/lib/validation/masters";
import type { SessionAdmin } from "@/server/auth/session";
import { HttpError } from "@/server/http";
import { createMaster, listMaster } from "@/server/masters";
import { checkHeaders, parseFile } from "./parse";

export const MASTER_MAX_ROWS = 1000; // FR-MASTER-IMP

export const MASTER_HEADERS: Record<MasterType, { required: string[]; optional: string[]; toField: Record<string, string>; example: string[] }> = {
  institutions: { required: ["name"], optional: ["short_code", "city", "state", "is_partner"], toField: { name: "name", short_code: "shortCode", city: "city", state: "state", is_partner: "isPartner" }, example: ["Example Institute of Technology", "EIT", "Chennai", "Tamil Nadu", "yes"] },
  degrees: { required: ["name", "level"], optional: [], toField: { name: "name", level: "level" }, example: ["B.E.", "UG"] },
  departments: { required: ["name"], optional: ["short_code", "aliases"], toField: { name: "name", short_code: "shortCode", aliases: "aliases" }, example: ["Computer Science and Engineering", "CSE", "Computer Science;Comp Sci;CS"] },
  batches: { required: ["batch_code", "year"], optional: ["start_date", "end_date"], toField: { batch_code: "batchCode", year: "year", start_date: "startDate", end_date: "endDate" }, example: ["2026-B1", "2026", "2026-01-05", "2026-06-30"] },
  "colour-teams": { required: ["name"], optional: ["hex_color"], toField: { name: "name", hex_color: "hexColor" }, example: ["Example Team", ""] },
  statuses: { required: ["name"], optional: ["color", "is_active_state"], toField: { name: "name", color: "color", is_active_state: "isActiveState" }, example: ["On Hold", "muted", "no"] },
};

export function masterTemplateCsv(type: MasterType) {
  const h = MASTER_HEADERS[type];
  return toCsv([...h.required, ...h.optional], [h.example]);
}

export type MasterPreviewRow = { rowNo: number; values: Record<string, string>; status: "VALID" | "DUPLICATE" | "ERROR"; message?: string };

/** Validate → preview (dryRun) → confirm (same file, dryRun=false). Duplicates are flagged, never merged (MST-07). */
export async function importMasters(type: MasterType, file: { name: string; type: string; buffer: Buffer }, dryRun: boolean, actor: SessionAdmin, meta: { ip?: string; userAgent?: string | null }) {
  const h = MASTER_HEADERS[type];
  const sheet = parseFile(file.name, file.type, file.buffer, MASTER_MAX_ROWS);
  checkHeaders(sheet.headers, h.required, h.optional);
  if (sheet.rows.length > MASTER_MAX_ROWS) throw new HttpError(400, `The file has more than ${MASTER_MAX_ROWS.toLocaleString("en-IN")} rows (MST-08 limit).`);
  if (!sheet.rows.length) throw new HttpError(400, "The file has no data rows");

  const existing = new Set((await listMaster(type)).map((r) => nameKey(r.label)));
  const aliasTaken = type === "departments" ? new Set((await db.departmentAlias.findMany({ select: { aliasKey: true } })).map((a) => a.aliasKey)) : new Set<string>();
  const seen = new Map<string, number>();
  const preview: MasterPreviewRow[] = [];
  const valid: { rowNo: number; data: Record<string, unknown> }[] = [];

  for (const r of sheet.rows) {
    const input: Record<string, unknown> = {};
    for (const [hdr, field] of Object.entries(h.toField)) if (hdr in r.cells) input[field] = r.cells[hdr];
    const parsed = masterSchemas[type].safeParse(input);
    if (!parsed.success) {
      preview.push({ rowNo: r.rowNo, values: r.cells, status: "ERROR", message: parsed.error.issues.map((i) => `${i.path.join(".") || "row"}: ${i.message}`).join("; ") });
      continue;
    }
    const data = parsed.data as Record<string, unknown>;
    const key = nameKey(type === "batches" ? data.batchCode : data.name);
    if (existing.has(key)) {
      preview.push({ rowNo: r.rowNo, values: r.cells, status: "DUPLICATE", message: "Already exists in Masters" });
      continue;
    }
    if (seen.has(key)) {
      preview.push({ rowNo: r.rowNo, values: r.cells, status: "DUPLICATE", message: `Same name as row ${seen.get(key)}` });
      continue;
    }
    if (type === "departments") {
      const clash = (data.aliases as string[]).map(nameKey).find((a) => aliasTaken.has(a) || existing.has(a));
      if (clash) {
        preview.push({ rowNo: r.rowNo, values: r.cells, status: "ERROR", message: `Alias "${clash}" is already used` });
        continue;
      }
      for (const a of data.aliases as string[]) aliasTaken.add(nameKey(a));
    }
    seen.set(key, r.rowNo);
    preview.push({ rowNo: r.rowNo, values: r.cells, status: "VALID" });
    valid.push({ rowNo: r.rowNo, data });
  }

  const summary = {
    total: preview.length,
    valid: valid.length,
    duplicates: preview.filter((p) => p.status === "DUPLICATE").length,
    errors: preview.filter((p) => p.status === "ERROR").length,
  };
  if (dryRun) return { dryRun: true, summary, rows: preview };

  let imported = 0;
  for (const v of valid) {
    await createMaster(type, v.data, actor, meta);
    imported++;
  }
  return { dryRun: false, summary: { ...summary, imported }, rows: preview };
}
