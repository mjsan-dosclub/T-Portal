// DEV ONLY: refreshes the screenshots used on /help from the local dev server (fake @example.test data).
// Usage: npm run dev (port 3000) in one terminal, then: npx tsx scripts/capture-help-screens.ts
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { parse } from "dotenv";
import { generate } from "otplib";

const BASE = process.env.HELP_BASE_URL ?? "http://localhost:3000";
const env = parse(readFileSync(".dev-admin.local"));
const out = (n: string) => `public/help/${n}.jpg`;

async function main() {
  if (!/^http:\/\/localhost:\d+$/.test(BASE)) throw new Error("Screenshots are only taken from a local dev server");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(env.DEV_ADMIN_EMAIL!);
  await page.getByLabel("Password").fill(env.DEV_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/login\/totp$/);
  // A code can be used only once per 30 s step (replay protection), so retry on the next step if needed.
  for (let attempt = 0; attempt < 3 && page.url().endsWith("/login/totp"); attempt++) {
    const left = 30 - ((Date.now() / 1000) % 30);
    if (attempt > 0 || left < 4) await page.waitForTimeout((left + 1) * 1000);
    await page.getByLabel(/6-digit code/).fill(await generate({ secret: env.DEV_ADMIN_TOTP_SECRET! }));
    await page.getByRole("button", { name: "Verify" }).click();
    await page.waitForURL((u) => !u.pathname.endsWith("/login/totp"), { timeout: 5000 }).catch(() => undefined);
  }
  await page.waitForURL(`${BASE}/`);

  await page.goto(`${BASE}/students`);
  await page.getByTestId("students-table").waitFor();
  // Only fake seed data may appear in screenshots (never real-looking records someone typed in dev).
  await page.getByLabel("Search students").fill("@example.test");
  await page.waitForTimeout(800);
  await page.getByTestId("select-page").check();
  await page.getByTestId("bulk-bar").waitFor();
  const emails = await page.getByTestId("student-row").locator("td:nth-child(4)").allTextContents();
  if (emails.some((e) => !e.endsWith("@example.test"))) throw new Error("Non-test data visible; refusing to screenshot");
  await page.screenshot({ path: out("students"), type: "jpeg", quality: 78 });
  await page.getByLabel("Search students").fill("");

  await page.goto(`${BASE}/students/upload`);
  const y = new Date().getFullYear() + 1;
  const csv = [
    "full_name,email,phone,institution,degree,department,graduation_year,batch",
    `Nila Devi,guide.nila@example.test,9000077701,Example Institute of Technology,B.E.,CSE,${y},2026-B1`,
    `Bala Murugan,guide.bala@example.test,9000077702,Example Institute of Technology,B.Tech,Comp Engg,${y},2026-B1`,
    `Priya S,not-an-email,9.18E+11,Demo University,BCA,IT,${y},2026-B1`,
  ].join("\r\n");
  await page.getByTestId("upload-input").setInputFiles({ name: "new-members.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByTestId("mapping-step").waitFor();
  await page.screenshot({ path: out("upload"), type: "jpeg", quality: 78 });

  await page.goto(`${BASE}/ontology/manage`);
  await page.getByTestId("manage-skills").waitFor();
  await page.screenshot({ path: out("ontology-manage"), type: "jpeg", quality: 78 });

  await browser.close();
  console.log("Saved public/help/{students,upload,ontology-manage}.jpg");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
