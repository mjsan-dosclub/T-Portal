import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { generate } from "otplib";
import { expect, type Page } from "@playwright/test";

export type Role = "SUPER_ADMIN" | "ADMIN" | "VIEWER";
export const creds = () => JSON.parse(readFileSync("e2e/.auth/creds.json", "utf8")) as Record<Role, { email: string; password: string }>;
const SECRETS = "e2e/.auth/totp.json";
export const secrets = (): Partial<Record<Role, string>> => (existsSync(SECRETS) ? JSON.parse(readFileSync(SECRETS, "utf8")) : {});
export function saveSecret(role: Role, secret: string) {
  writeFileSync(SECRETS, JSON.stringify({ ...secrets(), [role]: secret }));
}
export const statePath = (role: Role) => `e2e/.auth/${role}.json`;

/**
 * Returns a code from a 30-second step that hasn't been used yet. The server rejects a code
 * reused within its step (AUTH-06 replay protection), so tests wait for the next step when needed.
 * Used steps are shared across Playwright workers via a file.
 */
const USED = "e2e/.auth/used-steps.json";
export async function freshCode(secret: string) {
  for (;;) {
    const used: Record<string, number> = existsSync(USED) ? JSON.parse(readFileSync(USED, "utf8")) : {};
    const now = Date.now() / 1000;
    const step = Math.floor(now / 30);
    const left = 30 - (now % 30);
    if (step > (used[secret] ?? -1) && left > 4) {
      writeFileSync(USED, JSON.stringify({ ...used, [secret]: step }));
      return generate({ secret, epoch: Math.floor(now) });
    }
    await new Promise((r) => setTimeout(r, (left + 0.5) * 1000));
  }
}

export async function passwordStep(page: Page, role: Role) {
  const c = creds()[role];
  await page.goto("/login");
  await page.getByLabel("Email").fill(c.email);
  await page.getByLabel("Password").fill(c.password);
  await page.getByRole("button", { name: "Continue" }).click();
}

export async function enrolViaUi(page: Page, role: Role) {
  await passwordStep(page, role);
  await expect(page).toHaveURL(/\/enrol-2fa$/);
  const key = await manualKey(page);
  expect(key).toMatch(/^[A-Z2-7]{16,}$/);
  saveSecret(role, key);
  await page.getByLabel("6-digit code").fill(await freshCode(key));
  await page.getByRole("button", { name: "Verify and turn on" }).click();
  await expect(page.getByTestId("recovery-codes").locator("li")).toHaveCount(10);
  await page.getByLabel("I have saved my recovery codes").check();
  await page.getByRole("button", { name: "Continue to the portal" }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** The authenticator key loads after the page renders (shows "…" first); wait for the real Base32 key. */
export async function manualKey(page: Page) {
  const el = page.getByTestId("manual-key");
  await expect(el).toHaveText(/^[A-Z2-7 ]{16,}$/, { timeout: 15_000 });
  return (await el.textContent())!.replace(/\s/g, "");
}
