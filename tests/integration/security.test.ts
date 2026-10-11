import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { POST as studentsPOST } from "@/app/api/students/route";
import { POST as queryPOST } from "@/app/api/students/query/route";
import { POST as loginPOST } from "@/app/api/auth/login/route";
import { POST as uploadsPOST } from "@/app/api/uploads/route";
import { proxy } from "@/proxy";
import { NextRequest } from "next/server";
import { call, resetData, seedMasters, signedIn, studentInput } from "../helpers";

describe("Security", () => {
  beforeEach(resetData);

  it("SEC-01 an XSS payload is stored as inert text (rendering is escaped by React; E2E checks the page)", async () => {
    const m = await seedMasters();
    const { cookie } = await signedIn("ADMIN");
    const r = await call(studentsPOST, { body: studentInput(m, 1, { notes: `<script>alert(1)</script><img src=x onerror=alert(1)>` }), cookie });
    expect(r.status).toBe(201);
    // Names are restricted to letters/space/.' so tags in names are refused outright
    const bad = await call(studentsPOST, { body: studentInput(m, 2, { fullName: `<script>alert(1)</script>` }), cookie });
    expect(bad.status).toBe(400);
  });

  it("SEC-02 SQL-like input in search returns normally and injects nothing", async () => {
    const m = await seedMasters();
    const { cookie } = await signedIn("VIEWER");
    await db.student.create({ data: { ...studentInput(m, 1), studentCode: "DOS-2026-00001", graduationYear: 2027 } as never });
    for (const q of [`' OR 1=1 --`, `"; DROP TABLE students; --`, `%`, `\\`, `_`, `s_@`]) {
      const r = await call(queryPOST, { body: { q }, cookie });
      expect(r.status).toBe(200);
      expect(r.json.total).toBe(0);
    }
    expect(await db.student.count()).toBe(1);
  });

  it("SEC-06 CSRF: state-changing requests without our Origin are refused", async () => {
    const m = await seedMasters();
    const { cookie } = await signedIn("ADMIN");
    expect((await call(studentsPOST, { body: studentInput(m, 1), cookie, origin: "https://evil.example" })).status).toBe(403);
    expect((await call(studentsPOST, { body: studentInput(m, 1), cookie, origin: null })).status).toBe(403);
    expect((await call(loginPOST, { body: { email: "a@example.test", password: "x" }, origin: "https://evil.example" })).status).toBe(403);
    expect((await call(studentsPOST, { body: studentInput(m, 1), cookie })).status).toBe(201);
  });

  it("SEC-07 security headers are set on pages and API responses", async () => {
    const res = proxy(new NextRequest("http://localhost:3000/login"));
    const csp = res.headers.get("content-security-policy")!;
    expect(csp).toMatch(/default-src 'self'/);
    expect(csp).toMatch(/script-src 'self' 'nonce-/);
    expect(csp).toMatch(/frame-ancestors 'none'/);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    const prev = process.env.APP_ORIGIN;
    process.env.APP_ORIGIN = "https://portal.example.test";
    expect(proxy(new NextRequest("https://portal.example.test/login")).headers.get("strict-transport-security")).toMatch(/max-age=/);
    process.env.APP_ORIGIN = prev;
    const anon = proxy(new NextRequest("http://localhost:3000/students"));
    expect(anon.status).toBe(307);
    expect(anon.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("SEC-08 production error bodies carry no stack traces, SQL or PII", async () => {
    const m = await seedMasters();
    const { cookie } = await signedIn("ADMIN");
    await call(studentsPOST, { body: studentInput(m, 1, { email: "leak.check@example.test" }), cookie });
    const dup = await call(studentsPOST, { body: studentInput(m, 2, { email: "leak.check@example.test" }), cookie });
    expect(dup.status).toBe(409);
    expect(dup.text).not.toMatch(/leak\.check|prisma|SELECT|INSERT|at .*\.ts:\d+/i);
    const badJson = await call(queryPOST, { body: undefined, cookie, url: "http://localhost:3000/api/students/query" });
    expect(badJson.status).toBe(200);
    const garbage = await queryPOST(new Request("http://localhost:3000/api/students/query", { method: "POST", headers: { cookie, origin: "http://localhost:3000", "content-type": "application/json" }, body: "{not json" }));
    expect(garbage.status).toBe(400);
    expect(await garbage.text()).not.toMatch(/at .*\.ts|SyntaxError: Unexpected/);
  });

  it("SEC-09 rate limits: login endpoint per IP, upload endpoint per admin → 429", async () => {
    let last = 0;
    for (let i = 0; i < 61; i++) last = (await call(loginPOST, { body: { email: `n${i}@example.test`, password: "x" }, ip: "10.7.7.7" })).status;
    expect(last).toBe(429);
    const { cookie } = await signedIn("ADMIN");
    let up = 0;
    for (let i = 0; i < 21; i++) {
      const form = new FormData();
      form.set("file", new File(["a,b\n1,2"], "x.csv", { type: "text/csv" }));
      up = (await call(uploadsPOST, { form, cookie })).status;
    }
    expect(up).toBe(429);
  });
});
