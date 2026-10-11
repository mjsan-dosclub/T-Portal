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

/** Waits for a fresh 30-second step if the current code might already be used (replay protection). */
export async function freshCode(secret: string) {
  const left = 30 - (Math.floor(Date.now() / 1000) % 30);
  if (left < 4) await new Promise((r) => setTimeout(r, (left + 1) * 1000));
  return generate({ secret });
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
  const key = (await page.getByTestId("manual-key").textContent())!.replace(/\s/g, "");
  expect(key).toMatch(/^[A-Z2-7]{16,}$/);
  saveSecret(role, key);
  await page.getByLabel("6-digit code").fill(await freshCode(key));
  await page.getByRole("button", { name: "Verify and turn on" }).click();
  await expect(page.getByTestId("recovery-codes").locator("li")).toHaveCount(10);
  await page.getByLabel("I have saved my recovery codes").check();
  await page.getByRole("button", { name: "Continue to the portal" }).click();
  await expect(page).toHaveURL(/\/$/);
}
