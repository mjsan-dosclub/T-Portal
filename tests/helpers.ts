import { generate } from "otplib";
import { db } from "@/lib/db";
import { nameKey } from "@/lib/normalize";
import { encrypt, hashRecoveryCode } from "@/server/auth/crypto";
import { hashPassword } from "@/server/auth/password";
import { createSession, sessionCookie } from "@/server/auth/session";
import { newTotpSecret } from "@/server/auth/totp";
import type { Role } from "@/generated/prisma/enums";

export const ORIGIN = "http://localhost:3000";
export const PASSWORD = "correct-horse-battery-staple";

/** Wipe everything except the seeded ontology/base masters. Audit triggers are disabled only for this test cleanup. */
export async function resetData() {
  await db.$executeRawUnsafe(`ALTER TABLE audit_logs DISABLE TRIGGER USER`);
  await db.$executeRawUnsafe(
    `TRUNCATE students, code_counters, upload_rows, upload_jobs, sessions, recovery_codes, rate_limits, admin_users, audit_logs, department_aliases, departments, institutions, batches, colour_teams RESTART IDENTITY CASCADE`,
  );
  await db.$executeRawUnsafe(`ALTER TABLE audit_logs ENABLE TRIGGER USER`);
  await db.studentStatus.updateMany({ data: { isActive: true } });
  await db.degree.updateMany({ data: { isActive: true } });
}

let n = 0;
export async function makeAdmin(role: Role = "SUPER_ADMIN", opts: { enrolled?: boolean; canExport?: boolean; email?: string } = {}) {
  const secret = newTotpSecret();
  n++;
  const admin = await db.adminUser.create({
    data: {
      email: opts.email ?? `admin${n}-${role.toLowerCase()}@example.test`,
      name: `Test ${role} ${n}`,
      role,
      canExport: opts.canExport ?? false,
      passwordHash: await hashPassword(PASSWORD),
      totpEnabled: opts.enrolled ?? true,
      totpSecretEnc: opts.enrolled === false ? null : encrypt(secret),
    },
  });
  return { admin, secret };
}

/** A fully signed-in (MFA passed) session cookie for an admin. */
export async function signedIn(role: Role = "SUPER_ADMIN", opts: { canExport?: boolean } = {}) {
  const { admin, secret } = await makeAdmin(role, opts);
  const token = await createSession(admin.id, { mfaPassed: true, ip: "127.0.0.1" });
  return { admin, secret, cookie: `dos_session=${token}` };
}

export function cookieFrom(res: Response): string {
  const set = res.headers.get("set-cookie") ?? "";
  const m = /dos_session=([^;]*)/.exec(set);
  return m ? `dos_session=${m[1]}` : "";
}

export function sessionCookieHeader(token: string) {
  return sessionCookie(token);
}

type Handler = (req: Request, ctx?: { params?: Promise<Record<string, string>> }) => Promise<Response>;

export async function call(
  handler: Handler,
  opts: { method?: string; body?: unknown; cookie?: string; origin?: string | null; params?: Record<string, string>; url?: string; ip?: string; form?: FormData } = {},
) {
  const headers = new Headers();
  if (opts.cookie) headers.set("cookie", opts.cookie);
  if (opts.origin !== null) headers.set("origin", opts.origin ?? ORIGIN);
  headers.set("host", "localhost:3000");
  headers.set("x-forwarded-for", opts.ip ?? "10.0.0.1");
  headers.set("user-agent", "vitest");
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(opts.body);
  }
  const req = new Request(opts.url ?? `${ORIGIN}/api/test`, { method: opts.method ?? (opts.body !== undefined || opts.form ? "POST" : "GET"), headers, body });
  const res = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
  const text = await res.clone().text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* non-JSON (CSV) */
  }
  return { res, status: res.status, json, text };
}

export async function totpNow(secret: string, offsetSeconds = 0) {
  return generate({ secret, epoch: Math.floor(Date.now() / 1000) + offsetSeconds });
}

export async function recoveryCodesFor(adminId: string, codes: string[]) {
  await db.recoveryCode.createMany({ data: codes.map((c) => ({ adminId, codeHash: hashRecoveryCode(c) })) });
}

/** Minimal masters for student tests. */
export async function seedMasters() {
  const inst = await db.institution.create({ data: { name: "Example Institute of Technology", nameKey: nameKey("Example Institute of Technology"), shortCode: "EIT" } });
  const inst2 = await db.institution.create({ data: { name: "Sample College", nameKey: nameKey("Sample College") } });
  const cse = await db.department.create({ data: { name: "Computer Science and Engineering", nameKey: nameKey("Computer Science and Engineering"), shortCode: "CSE", aliases: { create: [{ alias: "Computer Science", aliasKey: nameKey("Computer Science") }, { alias: "CSE", aliasKey: "cse" }] } } });
  const ece = await db.department.create({ data: { name: "Electronics and Communication Engineering", nameKey: nameKey("Electronics and Communication Engineering"), shortCode: "ECE" } });
  const b1 = await db.batch.create({ data: { batchCode: "2026-B1", codeKey: "2026-b1", year: 2026 } });
  const b2 = await db.batch.create({ data: { batchCode: "2025-B2", codeKey: "2025-b2", year: 2025 } });
  const team = await db.colourTeam.create({ data: { name: "Green", nameKey: "green" } });
  const degree = await db.degree.findFirstOrThrow({ where: { nameKey: "b.e." } });
  const active = await db.studentStatus.findFirstOrThrow({ where: { isDefault: true } });
  const alumni = await db.studentStatus.findFirstOrThrow({ where: { nameKey: "alumni" } });
  return { inst, inst2, cse, ece, b1, b2, team, degree, active, alumni };
}
export type Masters = Awaited<ReturnType<typeof seedMasters>>;

export function studentInput(m: Masters, i: number, over: Record<string, unknown> = {}) {
  return {
    fullName: `Student ${String.fromCharCode(65 + (i % 26))}${i}`.replace(/\d/g, (d) => "abcdefghij"[Number(d)]!),
    email: `s${i}@example.test`,
    phone: `+9190000${String(10000 + i).slice(-5)}`,
    institutionId: m.inst.id,
    degreeId: m.degree.id,
    departmentId: m.cse.id,
    graduationYear: new Date().getUTCFullYear() + 1,
    batchId: m.b1.id,
    statusId: m.active.id,
    ...over,
  };
}

/** Insert N students quickly (bypasses the API; for list/bulk tests). */
export async function bulkStudents(m: Masters, count: number, over: (i: number) => Record<string, unknown> = () => ({})) {
  const data = Array.from({ length: count }, (_, i) => {
    const base = studentInput(m, i);
    return {
      ...base,
      studentCode: `DOS-2026-${String(i + 1).padStart(5, "0")}`,
      graduationYear: Number(base.graduationYear),
      ...over(i),
    } as never;
  });
  for (let i = 0; i < data.length; i += 1000) await db.student.createMany({ data: data.slice(i, i + 1000) });
  await db.codeCounter.upsert({ where: { year: 2026 }, create: { year: 2026, last: count }, update: { last: count } });
}
