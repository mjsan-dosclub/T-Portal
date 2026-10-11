import "server-only";
import * as XLSX from "xlsx";
import { toCsv } from "@/lib/normalize";
import { EXAMPLE_ROW, TEMPLATE_HEADERS } from "./students-upload";

export function studentTemplate(format: "csv" | "xlsx", year = new Date().getUTCFullYear()): { body: Buffer | string; type: string; name: string } {
  const example = { ...EXAMPLE_ROW, graduation_year: String(year + 2) };
  const row = TEMPLATE_HEADERS.map((h) => example[h]);
  if (format === "csv") {
    return { body: toCsv([...TEMPLATE_HEADERS], [row]), type: "text/csv; charset=utf-8", name: "dos-students-template.csv" };
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([[...TEMPLATE_HEADERS], row]);
  // Phone and date columns as text so Excel doesn't turn them into 9.18E+11 or serial numbers (P3).
  ws["!cols"] = TEMPLATE_HEADERS.map((h) => ({ wch: Math.max(14, h.length + 2) }));
  XLSX.utils.book_append_sheet(wb, ws, "Students");
  const help = XLSX.utils.aoa_to_sheet([
    ["How to fill this template"],
    ["1. Keep the header row exactly as it is. Required: full_name, email, phone, institution, degree, department, graduation_year, batch."],
    ["2. Row 2 is an example and is ignored on upload. You can delete it."],
    ["3. institution / degree / department / batch / colour_team / status must match a value in Masters (department aliases like CSE also work)."],
    ["4. Phone: Indian mobile, e.g. 98765 43210 or +91 98765 43210. Format the column as Text in Excel."],
    ["5. Dates: YYYY-MM-DD or DD-MM-YYYY. Gender: Male, Female, Other, Prefer not to say."],
    ["6. Maximum 10,000 rows and 5 MB per file. Only the first sheet is read."],
  ]);
  XLSX.utils.book_append_sheet(wb, help, "Help");
  const body = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { body, type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: "dos-students-template.xlsx" };
}
