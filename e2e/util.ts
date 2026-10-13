import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { generate } from "otplib";
import { expect, type Locator, type Page } from "@playwright/test";

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

/**
 * Pick from the searchable dropdown (UX-4), the way a person does: open it, type, click the option.
 * `pick.label` searches then clicks the exact option text; `pick.text` clicks the first option containing it;
 * `pick.index` counts like <select> (0 = the empty choice); `pick.value` matches the option's value.
 */
export async function choose(scope: Page | Locator, label: string, pick: { label?: string; text?: string; index?: number; value?: string }, exact = false) {
  const trigger = scope.getByLabel(label, { exact });
  await trigger.click();
  const panel = trigger.locator("xpath=..").locator(".ss-panel");
  await expect(panel).toBeVisible();
  if (pick.label !== undefined) {
    await panel.getByRole("combobox", { name: "Search options" }).fill(pick.label);
    await panel.getByRole("option", { name: pick.label, exact: true }).click();
  } else if (pick.text !== undefined) {
    await panel.getByRole("combobox", { name: "Search options" }).fill(pick.text);
    await panel.getByRole("option").filter({ hasText: pick.text }).first().click();
  } else if (pick.value !== undefined) await panel.locator(`[role=option][data-value="${pick.value}"]`).click();
  else await panel.getByRole("option").nth(pick.index ?? 0).click();
  await expect(panel).toBeHidden();
}
