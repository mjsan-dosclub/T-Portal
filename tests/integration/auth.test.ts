import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { POST as loginPOST } from "@/app/api/auth/login/route";
import { POST as totpPOST } from "@/app/api/auth/totp/route";
import { POST as recoveryPOST } from "@/app/api/auth/recovery/route";
import { POST as enrolPOST } from "@/app/api/auth/enrol/route";
import { POST as queryPOST } from "@/app/api/students/query/route";
import { POST as bulkDeletePOST } from "@/app/api/students/bulk/delete/route";
import { POST as bulkStatusPOST } from "@/app/api/students/bulk/status/route";
import { POST as studentsPOST } from "@/app/api/students/route";
import { GET as mastersGET, POST as mastersPOST } from "@/app/api/masters/[type]/route";
import { GET as adminsGET, POST as adminsPOST } from "@/app/api/admins/route";
import { POST as reset2faPOST } from "@/app/api/admins/[id]/reset-2fa/route";
import { POST as restorePOST } from "@/app/api/students/restore/route";
import { POST as exportPOST } from "@/app/api/students/export/route";
import { POST as uploadsPOST } from "@/app/api/uploads/route";
import { decrypt } from "@/server/auth/crypto";
import { IDLE_MS, resolveSession } from "@/server/auth/session";
import { checkTotp } from "@/server/auth/totp";
import { call, cookieFrom, makeAdmin, PASSWORD, recoveryCodesFor, resetData, signedIn, totpNow } from "../helpers";

async function login(email: string, password = PASSWORD, ip = "10.0.0.1") {
  return call(loginPOST, { body: { email, password }, ip });
}

describe("Authentication & RBAC", () => {
  beforeEach(resetData);

  it("AUTH-01 first login with valid password redirects to TOTP enrolment; dashboard APIs not reachable", async () => {
    const { admin } = await makeAdmin("ADMIN", { enrolled: false });
    const r = await login(admin.email);
    expect(r.status).toBe(200);
    expect(r.json.next).toBe("/enrol-2fa");
    const cookie = cookieFrom(r.res);
    expect(cookie).toMatch(/^dos_session=/);
    const q = await call(queryPOST, { body: {}, cookie });
    expect(q.status).toBe(401);
  });

  it("AUTH-02 enrolment with a wrong 6-digit code is rejected and not saved", async () => {
    const { admin } = await makeAdmin("ADMIN", { enrolled: false });
    const cookie = cookieFrom((await login(admin.email)).res);
    const start = await call(enrolPOST, { body: { action: "start" }, cookie });
    expect(start.status).toBe(200);
    const bad = await call(enrolPOST, { body: { action: "confirm", code: "000000" }, cookie });
    expect(bad.status).toBe(400);
    const after = await db.adminUser.findUniqueOrThrow({ where: { id: admin.id } });
    expect(after.totpEnabled).toBe(false);
    expect(await db.recoveryCode.count({ where: { adminId: admin.id } })).toBe(0);
  });

  it("AUTH-03 enrolment with the correct code shows 10 recovery codes once, stores them hashed, enables 2FA", async () => {
    const { admin } = await makeAdmin("ADMIN", { enrolled: false });
    const cookie = cookieFrom((await login(admin.email)).res);
    await call(enrolPOST, { body: { action: "start" }, cookie });
    const secret = decrypt((await db.adminUser.findUniqueOrThrow({ where: { id: admin.id } })).totpSecretEnc!);
    const ok = await call(enrolPOST, { body: { action: "confirm", code: await totpNow(secret) }, cookie });
    expect(ok.status).toBe(200);
    const codes = ok.json.recoveryCodes as string[];
    expect(codes).toHaveLength(10);
    const stored = await db.recoveryCode.findMany({ where: { adminId: admin.id } });
    expect(stored).toHaveLength(10);
    for (const s of stored) expect(codes).not.toContain(s.codeHash); // hashed, not plaintext
    expect((await db.adminUser.findUniqueOrThrow({ where: { id: admin.id } })).totpEnabled).toBe(true);
    // Session is now fully signed in
    const q = await call(queryPOST, { body: {}, cookie: cookieFrom(ok.res) });
    expect(q.status).toBe(200);
    // Codes are never retrievable again: starting enrolment again is refused
    const again = await call(enrolPOST, { body: { action: "start" }, cookie: cookieFrom(ok.res) });
    expect(again.status).toBe(401);
  });

  it("AUTH-04 login with valid TOTP grants access; cookie is HttpOnly + Secure + SameSite", async () => {
    const { admin, secret } = await makeAdmin("ADMIN");
    const pre = await login(admin.email);
    expect(pre.json.next).toBe("/login/totp");
    const r = await call(totpPOST, { body: { code: await totpNow(secret) }, cookie: cookieFrom(pre.res) });
    expect(r.status).toBe(200);
    const set = r.res.headers.get("set-cookie")!;
    expect(set).toMatch(/HttpOnly/);
    expect(set).toMatch(/Secure/);
    expect(set).toMatch(/SameSite=Strict/);
    expect((await call(queryPOST, { body: {}, cookie: cookieFrom(r.res) })).status).toBe(200);
  });

  it("AUTH-05 a TOTP code more than 1 step old is rejected", async () => {
    const { admin, secret } = await makeAdmin("ADMIN");
    const pre = await login(admin.email);
    const old = await totpNow(secret, -95); // ~3 steps back
    const r = await call(totpPOST, { body: { code: old }, cookie: cookieFrom(pre.res) });
    expect(r.status).toBe(401);
    // and a 1-step-old code is still accepted (±1 tolerance)
    const now = Math.floor(Date.now() / 1000);
    expect((await checkTotp(secret, await totpNow(secret, -30), null, now)).ok).toBe(true);
  });

  it("AUTH-06 the same TOTP code can't be used twice (replay protection)", async () => {
    const { admin, secret } = await makeAdmin("ADMIN");
    const code = await totpNow(secret);
    const first = await call(totpPOST, { body: { code }, cookie: cookieFrom((await login(admin.email)).res) });
    expect(first.status).toBe(200);
    const second = await call(totpPOST, { body: { code }, cookie: cookieFrom((await login(admin.email)).res) });
    expect(second.status).toBe(401);
  });

  it("AUTH-07 5 wrong attempts lock the account for this IP for 15 minutes, with an audit entry", async () => {
    const { admin } = await makeAdmin("ADMIN");
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await login(admin.email, "wrong-password-123")).status);
    expect(statuses.slice(0, 4)).toEqual([401, 401, 401, 401]);
    expect(statuses[4]).toBe(429);
    const locked = await login(admin.email); // even the right password
    expect(locked.status).toBe(429);
    expect(locked.json.error).toMatch(/15 minutes/);
    expect(await db.auditLog.count({ where: { action: "auth.locked", entityId: admin.id } })).toBe(1);
    const rl = await db.rateLimit.findFirstOrThrow({ where: { lockedUntil: { not: null } } });
    const mins = (rl.lockedUntil!.getTime() - Date.now()) / 60000;
    expect(mins).toBeGreaterThan(14);
    expect(mins).toBeLessThanOrEqual(15);
    // the lock message doesn't reveal whether an account exists
    for (let i = 0; i < 5; i++) await login("nobody@example.test", "wrong-password-123");
    expect((await login("nobody@example.test", "x")).json.error).toBe(locked.json.error);
  });

  it("AUTH-08 a recovery code works once; the same code then fails", async () => {
    const { admin } = await makeAdmin("ADMIN");
    await recoveryCodesFor(admin.id, ["ABCDE-FGHJK", "KLMNP-QRSTU"]);
    const ok = await call(recoveryPOST, { body: { code: "abcde-fghjk" }, cookie: cookieFrom((await login(admin.email)).res) });
    expect(ok.status).toBe(200);
    const again = await call(recoveryPOST, { body: { code: "ABCDE-FGHJK" }, cookie: cookieFrom((await login(admin.email)).res) });
    expect(again.status).toBe(401);
  });

  it("AUTH-10 password OK but TOTP skipped: every protected API returns 401", async () => {
    const { admin } = await makeAdmin("SUPER_ADMIN");
    const cookie = cookieFrom((await login(admin.email)).res);
    expect((await call(queryPOST, { body: {}, cookie })).status).toBe(401);
    expect((await call(studentsPOST, { body: {}, cookie })).status).toBe(401);
    expect((await call(mastersGET, { cookie, params: { type: "degrees" } })).status).toBe(401);
    expect((await call(adminsGET, { cookie })).status).toBe(401);
  });

  it("AUTH-11 Viewer calling bulk-delete directly gets 403", async () => {
    const { cookie } = await signedIn("VIEWER");
    const r = await call(bulkDeletePOST, { body: { selection: { mode: "ids", ids: ["00000000-0000-4000-8000-000000000000"] } }, cookie });
    expect(r.status).toBe(403);
  });

  it("AUTH-12 a session idle for 30 minutes expires", async () => {
    const { cookie } = await signedIn("ADMIN");
    const token = cookie.split("=")[1]!;
    const later = new Date(Date.now() + IDLE_MS + 1000);
    expect(await resolveSession(token, later)).toBeNull();
    expect((await call(queryPOST, { body: {}, cookie })).status).toBe(401); // deleted on expiry
  });

  it("AUTH-12 absolute 8-hour limit applies even when active", async () => {
    const { cookie } = await signedIn("ADMIN");
    const token = cookie.split("=")[1]!;
    const s = await db.session.findFirstOrThrow();
    await db.session.update({ where: { id: s.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await resolveSession(token)).toBeNull();
  });

  it("AUTH-13 Super Admin resets another admin's 2FA: target must re-enrol, sessions end, audit entry", async () => {
    const sa = await signedIn("SUPER_ADMIN");
    const target = await signedIn("ADMIN");
    const r = await call(reset2faPOST, { body: { reason: "Lost phone" }, cookie: sa.cookie, params: { id: target.admin.id } });
    expect(r.status).toBe(200);
    const t = await db.adminUser.findUniqueOrThrow({ where: { id: target.admin.id } });
    expect(t.totpEnabled).toBe(false);
    expect(t.totpSecretEnc).toBeNull();
    expect((await call(queryPOST, { body: {}, cookie: target.cookie })).status).toBe(401);
    expect((await login(t.email)).json.next).toBe("/enrol-2fa");
    const a = await db.auditLog.findFirstOrThrow({ where: { action: "admin.reset_2fa" } });
    expect(a.actorId).toBe(sa.admin.id);
    expect(a.reason).toBe("Lost phone");
    // Admin (non-super) can't do it
    const other = await signedIn("ADMIN");
    expect((await call(reset2faPOST, { body: {}, cookie: other.cookie, params: { id: sa.admin.id } })).status).toBe(403);
  });

  it("AUTH-14 no public sign-up/register route exists", () => {
    const app = path.join(process.cwd(), "src/app");
    const all: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = path.join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else all.push(path.relative(app, p));
      }
    };
    walk(app);
    expect(all.filter((f) => /sign-?up|register/i.test(f))).toEqual([]);
    expect(existsSync(path.join(app, "api/auth/signup"))).toBe(false);
  });

  it("AUTH-15 unknown email and wrong password give the same message and similar timing", async () => {
    const { admin } = await makeAdmin("ADMIN");
    const t0 = performance.now();
    const a = await login(admin.email, "wrong-password-xyz", "10.1.1.1");
    const t1 = performance.now();
    const b = await login("ghost@example.test", "wrong-password-xyz", "10.1.1.2");
    const t2 = performance.now();
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.json.error).toBe(b.json.error);
    const ta = t1 - t0;
    const tb = t2 - t1;
    expect(Math.abs(ta - tb)).toBeLessThan(Math.max(ta, tb) * 0.8 + 50);
  });

  it("AUTH-16 role matrix for mutating APIs: Super Admin / Admin / Viewer / no session", async () => {
    const sa = await signedIn("SUPER_ADMIN");
    const ad = await signedIn("ADMIN");
    const vw = await signedIn("VIEWER");
    const sel = { mode: "ids", ids: ["00000000-0000-4000-8000-000000000000"] };
    type Case = { name: string; run: (cookie?: string) => ReturnType<typeof call>; allowed: string[] };
    const cases: Case[] = [
      { name: "create student", run: (cookie) => call(studentsPOST, { body: {}, cookie }), allowed: ["SUPER_ADMIN", "ADMIN"] },
      { name: "bulk status", run: (cookie) => call(bulkStatusPOST, { body: { selection: sel, statusId: "00000000-0000-4000-8000-000000000000" }, cookie }), allowed: ["SUPER_ADMIN", "ADMIN"] },
      { name: "bulk delete", run: (cookie) => call(bulkDeletePOST, { body: { selection: sel }, cookie }), allowed: ["SUPER_ADMIN", "ADMIN"] },
      { name: "restore", run: (cookie) => call(restorePOST, { body: { selection: sel }, cookie }), allowed: ["SUPER_ADMIN"] },
      { name: "create master", run: (cookie) => call(mastersPOST, { body: {}, cookie, params: { type: "degrees" } }), allowed: ["SUPER_ADMIN", "ADMIN"] },
      { name: "invite admin", run: (cookie) => call(adminsPOST, { body: {}, cookie }), allowed: ["SUPER_ADMIN"] },
      { name: "export", run: (cookie) => call(exportPOST, { body: { selection: sel }, cookie }), allowed: ["SUPER_ADMIN", "ADMIN"] },
      { name: "upload", run: (cookie) => call(uploadsPOST, { body: {}, cookie }), allowed: ["SUPER_ADMIN", "ADMIN"] },
    ];
    for (const c of cases) {
      for (const [role, cookie] of [["SUPER_ADMIN", sa.cookie], ["ADMIN", ad.cookie], ["VIEWER", vw.cookie], ["NONE", undefined]] as const) {
        const r = await c.run(cookie);
        const expected = role === "NONE" ? 401 : c.allowed.includes(role) ? "allowed" : 403;
        if (expected === "allowed") expect([200, 201, 400, 404, 409], `${c.name} as ${role}`).toContain(r.status);
        else expect(r.status, `${c.name} as ${role}`).toBe(expected);
      }
    }
  });
});
