import { generate } from "otplib";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { POST as activatePOST } from "@/app/api/student/auth/activate/route";
import { POST as loginPOST } from "@/app/api/student/auth/login/route";
import { POST as totpPOST } from "@/app/api/student/auth/totp/route";
import { POST as enrolPOST } from "@/app/api/student/auth/enrol/route";
import { POST as mePasswordPOST } from "@/app/api/student/me/password/route";
import { POST as newPasswordPOST } from "@/app/api/student/me/new-password/route";
import { POST as recoveryCodesPOST } from "@/app/api/student/me/recovery-codes/route";
import { POST as resetPasswordPOST } from "@/app/api/students/[id]/portal/password/route";
import { DELETE as portalDELETE } from "@/app/api/students/[id]/portal/route";
import { POST as adminQueryPOST } from "@/app/api/students/query/route";
import { POST as adminBulkDelete } from "@/app/api/students/bulk/delete/route";
import { GET as adminsGET } from "@/app/api/admins/route";
import { decrypt } from "@/server/auth/crypto";
import { ACTIVATE_NO_MATCH } from "@/server/student/auth";
import { invitationMessage } from "@/server/student/invite";
import { bulkStudents, call, resetData, seedMasters, signedIn, type Masters } from "../helpers";

let m: Masters;
const PW = "my-strong-student-password";
const S1 = { email: "s1@example.test", phone: "90000 10001" }; // from bulkStudents: s{i}@…, +9190000{10000+i}
const cookieOf = (res: Response) => /dos_student_session=([^;]*)/.exec(res.headers.get("set-cookie") ?? "")?.[1] ?? "";
const jar = (t: string) => `dos_student_session=${t}`;
async function totpFor(email: string, offset = 0) {
  const u = await db.studentUser.findFirstOrThrow({ where: { student: { email } } });
  return generate({ secret: decrypt(u.totpSecretEnc!), epoch: Math.floor(Date.now() / 1000) + offset });
}
/** First access + authenticator; returns a fully signed-in cookie. */
async function activate(who = S1, password = PW, ip = "10.0.0.1") {
  const a = await call(activatePOST, { body: { ...who, password }, ip });
  expect(a.status, JSON.stringify(a.json)).toBe(200);
  const pre = jar(cookieOf(a.res));
  await call(enrolPOST, { body: { action: "start" }, cookie: pre });
  const e = await call(enrolPOST, { body: { action: "confirm", code: await totpFor(who.email) }, cookie: pre });
  return { cookie: jar(cookieOf(e.res)), enrol: e };
}

describe("Phase 2 student access (no email service)", () => {
  beforeEach(async () => {
    await resetData();
    m = await seedMasters();
    await bulkStudents(m, 3);
  });

  it("STA-01 first access with registered email + mobile creates the account; authenticator required before anything else", async () => {
    const a = await call(activatePOST, { body: { email: " S1@Example.TEST", phone: "+91 90000-10001", password: PW } });
    expect(a.status).toBe(200);
    expect(a.json.next).toBe("/student/enrol");
    const pre = jar(cookieOf(a.res));
    expect((await call(mePasswordPOST, { body: { current: PW, next: "another-long-password" }, cookie: pre })).status).toBe(401);
    await call(enrolPOST, { body: { action: "start" }, cookie: pre });
    const e = await call(enrolPOST, { body: { action: "confirm", code: await totpFor(S1.email) }, cookie: pre });
    expect((e.json.recoveryCodes as string[]).length).toBe(10);
    expect(e.json.next).toBe("/student");
    expect((await call(mePasswordPOST, { body: { current: PW, next: "another-long-password" }, cookie: jar(cookieOf(e.res)) })).status).toBe(200);
    expect(await db.auditLog.count({ where: { action: "student_portal.activated" } })).toBe(1);
  });

  it("STA-02 unknown email, wrong mobile, deleted student and already-activated all get the identical error", async () => {
    await activate({ email: "s2@example.test", phone: "9000010002" });
    await db.student.update({ where: { email: "s0@example.test" }, data: { deletedAt: new Date() } });
    const tries = [
      { email: "nobody@example.test", phone: "9000010001" },
      { email: S1.email, phone: "9000019999" },
      { email: "s0@example.test", phone: "9000010000" },
      { email: "s2@example.test", phone: "9000010002" },
    ];
    for (const [i, t] of tries.entries()) {
      const r = await call(activatePOST, { body: { ...t, password: PW }, ip: `10.9.0.${i}` });
      expect(r.status).toBe(400);
      expect(r.json.error).toBe(ACTIVATE_NO_MATCH);
    }
    expect(await db.studentUser.count()).toBe(1);
  });

  it("STA-03 repeated first-access attempts are rate-limited", async () => {
    let last = 0;
    for (let i = 0; i < 6; i++) last = (await call(activatePOST, { body: { email: S1.email, phone: "9000019999", password: PW }, ip: `10.8.0.${i}` })).status;
    expect(last).toBe(429); // per-email cap (5/hour) even across IPs
    let ipLast = 0;
    for (let i = 0; i < 11; i++) ipLast = (await call(activatePOST, { body: { email: `x${i}@example.test`, phone: "9000019999", password: PW }, ip: "10.7.7.7" })).status;
    expect(ipLast).toBe(429);
  });

  it("STA-04 a short password is rejected at first access and no account is created", async () => {
    const r = await call(activatePOST, { body: { ...S1, password: "short" } });
    expect(r.status).toBe(400);
    expect(await db.studentUser.count()).toBe(0);
  });

  it("STA-05 sign-in needs password + TOTP; replayed TOTP fails; 5 wrong passwords lock", async () => {
    await activate();
    const l = await call(loginPOST, { body: { email: S1.email, password: PW } });
    expect(l.json.next).toBe("/student/totp");
    const code = await totpFor(S1.email, 30); // next step (enrolment used the current one)
    const t = await call(totpPOST, { body: { code }, cookie: jar(cookieOf(l.res)) });
    expect(t.status).toBe(200);
    expect(t.json.next).toBe("/student");
    const l2 = await call(loginPOST, { body: { email: S1.email, password: PW } });
    expect((await call(totpPOST, { body: { code }, cookie: jar(cookieOf(l2.res)) })).status).toBe(401);
    let last = 0;
    for (let i = 0; i < 5; i++) last = (await call(loginPOST, { body: { email: S1.email, password: "wrong-password-123" }, ip: "10.3.3.3" })).status;
    expect(last).toBe(429);
  });

  it("STA-06 admin one-time password: sessions end, sign-in + TOTP → must set a new password before anything else", async () => {
    const { cookie } = await activate();
    const id = (await db.student.findUniqueOrThrow({ where: { email: S1.email } })).id;
    const ad = await signedIn("ADMIN");
    const r = await call(resetPasswordPOST, { body: {}, cookie: ad.cookie, params: { id } });
    expect(r.status).toBe(200);
    const otp = r.json.oneTimePassword as string;
    expect(otp).toHaveLength(12);
    expect((await call(mePasswordPOST, { body: { current: PW, next: "x".repeat(12) }, cookie })).status).toBe(401); // old session ended
    expect((await call(loginPOST, { body: { email: S1.email, password: PW } })).status).toBe(401); // old password gone
    const l = await call(loginPOST, { body: { email: S1.email, password: otp } });
    const t = await call(totpPOST, { body: { code: await totpFor(S1.email, 30) }, cookie: jar(cookieOf(l.res)) });
    expect(t.json.next).toBe("/student/change-password");
    const s = jar(cookieOf(t.res));
    expect((await call(mePasswordPOST, { body: { current: otp, next: "another-long-password" }, cookie: s })).status).toBe(403);
    expect((await call(recoveryCodesPOST, { body: { code: "000000" }, cookie: s })).status).toBe(403);
    expect((await call(newPasswordPOST, { body: { next: otp }, cookie: s })).status).toBe(400); // must differ
    const ok = await call(newPasswordPOST, { body: { next: "my-own-new-password" }, cookie: s });
    expect(ok.status).toBe(200);
    expect((await call(newPasswordPOST, { body: { next: "yet-another-password" }, cookie: s })).status).toBe(400); // only once
    expect((await call(mePasswordPOST, { body: { current: "my-own-new-password", next: "final-long-password" }, cookie: s })).status).toBe(200);
    expect(await db.auditLog.count({ where: { action: "student_portal.password_reset_by_admin", actorId: ad.admin.id } })).toBe(1);
  });

  it("STA-07 a one-time password expires after 72 hours", async () => {
    await activate();
    const id = (await db.student.findUniqueOrThrow({ where: { email: S1.email } })).id;
    const ad = await signedIn("ADMIN");
    const otp = (await call(resetPasswordPOST, { body: {}, cookie: ad.cookie, params: { id } })).json.oneTimePassword as string;
    await db.studentUser.updateMany({ data: { tempPasswordExpiresAt: new Date(Date.now() - 1000) } });
    const l = await call(loginPOST, { body: { email: S1.email, password: otp } });
    expect(l.status).toBe(401);
    expect(l.json.error).toMatch(/expired/);
  });

  it("STA-08 change password requires the current one and ≥ 12 characters; audited", async () => {
    const { cookie } = await activate();
    expect((await call(mePasswordPOST, { body: { current: "wrong", next: "another-long-password" }, cookie })).status).toBe(400);
    expect((await call(mePasswordPOST, { body: { current: PW, next: "short" }, cookie })).status).toBe(400);
    expect((await call(mePasswordPOST, { body: { current: PW, next: "another-long-password" }, cookie })).status).toBe(200);
    expect(await db.auditLog.count({ where: { action: "student_portal.password_changed" } })).toBe(1);
    expect((await call(loginPOST, { body: { email: S1.email, password: "another-long-password" } })).status).toBe(200);
  });

  it("STA-09 student sessions can't reach admin APIs, and admin sessions can't reach student APIs", async () => {
    const { cookie } = await activate();
    const asAdminCookie = cookie.replace("dos_student_session=", "dos_session=");
    for (const r of [
      await call(adminQueryPOST, { body: {}, cookie }),
      await call(adminQueryPOST, { body: {}, cookie: asAdminCookie }),
      await call(adminBulkDelete, { body: { selection: { mode: "ids", ids: ["00000000-0000-4000-8000-000000000000"] } }, cookie }),
      await call(adminsGET, { cookie }),
    ])
      expect(r.status).toBe(401);
    const admin = await signedIn("SUPER_ADMIN");
    expect((await call(mePasswordPOST, { body: { current: "a", next: "b" }, cookie: admin.cookie })).status).toBe(401);
  });

  it("STA-10 Admin + Super Admin can issue one-time passwords (Viewer can't); only Super Admin removes the portal account", async () => {
    await activate();
    const id = (await db.student.findUniqueOrThrow({ where: { email: S1.email } })).id;
    const vw = await signedIn("VIEWER");
    expect((await call(resetPasswordPOST, { body: {}, cookie: vw.cookie, params: { id } })).status).toBe(403);
    const ad = await signedIn("ADMIN");
    expect((await call(portalDELETE, { method: "DELETE", body: {}, cookie: ad.cookie, params: { id } })).status).toBe(403);
    const sa = await signedIn("SUPER_ADMIN");
    expect((await call(resetPasswordPOST, { body: {}, cookie: sa.cookie, params: { id } })).status).toBe(200);
    expect((await call(portalDELETE, { method: "DELETE", body: { reason: "Lost phone" }, cookie: sa.cookie, params: { id } })).status).toBe(200);
    expect(await db.studentUser.count()).toBe(0);
    await db.rateLimit.deleteMany();
    await activate(); // first access works again
    expect(await db.studentUser.count()).toBe(1);
    // a student who never activated: reset password tells the admin so
    const s2 = (await db.student.findUniqueOrThrow({ where: { email: "s2@example.test" } })).id;
    expect((await call(resetPasswordPOST, { body: {}, cookie: ad.cookie, params: { id: s2 } })).status).toBe(404);
  });

  it("STA-11 the WhatsApp invitation has the first-access and guide links and no personal data", () => {
    const text = invitationMessage();
    expect(text).toContain("/student/activate");
    expect(text).toContain("/how-it-works");
    expect(text).not.toMatch(/@|\+91\d|DOS-20\d\d/);
  });
});
