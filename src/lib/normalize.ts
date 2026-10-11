import { parsePhoneNumberFromString } from "libphonenumber-js/max";

/** Trim and collapse internal whitespace. */
export function cleanText(v: unknown): string {
  return String(v ?? "")
    .replace(/[ \s]+/g, " ")
    .trim();
}

/** Case-insensitive uniqueness key for master names (MST-01, MST-05). */
export function nameKey(v: unknown): string {
  return cleanText(v).normalize("NFC").toLocaleLowerCase("en-IN");
}

export function normalizeEmail(v: unknown): string {
  return cleanText(v).toLowerCase();
}

export type PhoneResult = { ok: true; e164: string } | { ok: false; reason: string };

/**
 * Indian mobile → E.164 (+91XXXXXXXXXX). Handles "09876543210", "+91 98765-43210",
 * "919876543210". Rejects scientific notation (e.g. "9.18E+11") because Excel has
 * already dropped digits, so the real number can't be recovered (UPL-05).
 */
export function normalizePhone(v: unknown): PhoneResult {
  const raw = cleanText(v);
  if (!raw) return { ok: false, reason: "Phone is required" };
  if (/e[+-]?\d+/i.test(raw)) {
    return { ok: false, reason: "Phone looks like Excel scientific notation (e.g. 9.18E+11); digits were lost. Format the column as Text and re-enter." };
  }
  const digits = raw.replace(/[^\d+]/g, "");
  let candidate = digits;
  if (/^0\d{10}$/.test(digits)) candidate = "+91" + digits.slice(1);
  else if (/^\d{10}$/.test(digits)) candidate = "+91" + digits;
  else if (/^91\d{10}$/.test(digits)) candidate = "+" + digits;
  const parsed = parsePhoneNumberFromString(candidate, "IN");
  if (!parsed || parsed.country !== "IN" || !parsed.isValid()) {
    return { ok: false, reason: "Not a valid Indian mobile number" };
  }
  const type = parsed.getType();
  if (type && type !== "MOBILE" && type !== "FIXED_LINE_OR_MOBILE") {
    return { ok: false, reason: "Not an Indian mobile number" };
  }
  return { ok: true, e164: parsed.number };
}

/** Excel serial date (1900 system) → ISO yyyy-mm-dd. */
export function excelSerialToISO(serial: number): string {
  const ms = Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Accepts ISO date, dd-mm-yyyy, dd/mm/yyyy, Excel serial (number or numeric string), or Date. */
export function parseDateInput(v: unknown): { ok: true; iso: string } | { ok: false; reason: string } | null {
  if (v === null || v === undefined || cleanText(v) === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return { ok: true, iso: v.toISOString().slice(0, 10) };
  }
  const s = cleanText(v);
  if (/^\d{4,5}(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (n > 0 && n < 80000) return { ok: true, iso: excelSerialToISO(n) };
  }
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return checkYMD(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return checkYMD(+m[3], +m[2], +m[1]);
  return { ok: false, reason: "Unrecognised date. Use YYYY-MM-DD or DD-MM-YYYY" };
}

function checkYMD(y: number, mo: number, d: number) {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return { ok: false as const, reason: "Date does not exist" };
  }
  return { ok: true as const, iso: dt.toISOString().slice(0, 10) };
}

/** CSV-injection safe cell (P10, STU-14). */
export function csvSafe(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [header.map(csvSafe).join(","), ...rows.map((r) => r.map(csvSafe).join(","))];
  return "﻿" + lines.join("\r\n") + "\r\n";
}
