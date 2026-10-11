import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { freshCode, statePath } from "./util";

// Fake student from the dev seed (seed.dev.ts): student4@example.test has phone +919000010003.
const STUDENT = { email: "student4@example.test", phone: "90000 10003" };
const PW1 = "first-student-password";
const PW2 = "second-student-password";
const PW3 = "third-student-password";

async function noSeriousA11y(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
}

test("STA-12 first access → authenticator → my record → change password → admin one-time password → forced new password", async ({ page, browser }) => {
  // 1. First access (no email service: email + registered mobile + new password)
  await page.goto("/student/activate");
  await noSeriousA11y(page);
  await page.getByLabel("Email you registered with DOS Club").fill(STUDENT.email);
  await page.getByLabel("Mobile number you registered with DOS Club").fill("90000 99999"); // wrong mobile first
  await page.getByLabel("Create a password").fill(PW1);
  await page.getByLabel("Type the password again").fill(PW1);
  await page.getByRole("button", { name: "Create password & continue" }).click();
  await expect(page.getByText("We couldn't activate an account with those details")).toBeVisible();
  await page.getByLabel("Mobile number you registered with DOS Club").fill(STUDENT.phone);
  await page.getByRole("button", { name: "Create password & continue" }).click();

  // 2. Google Authenticator
  await expect(page).toHaveURL(/\/student\/enrol$/);
  const key = (await page.getByTestId("manual-key").textContent())!.replace(/\s/g, "");
  await page.getByLabel("6-digit code").fill(await freshCode(key));
  await page.getByRole("button", { name: "Verify and turn on" }).click();
  await expect(page.getByTestId("recovery-codes").locator("li")).toHaveCount(10);
  await page.getByLabel("I have saved my recovery codes").check();
  await page.getByRole("button", { name: "Continue to the portal" }).click();

  // 3. My record
  await expect(page).toHaveURL(/\/student$/);
  await expect(page.getByTestId("my-record")).toContainText(STUDENT.email);
  await noSeriousA11y(page);

  // 4. Change password on Account
  await page.getByRole("link", { name: "Account" }).click();
  await page.getByLabel("Current password").fill(PW1);
  await page.getByLabel("New password", { exact: true }).fill(PW2);
  await page.getByLabel("Confirm new password").fill(PW2);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByTestId("toast")).toContainText("Password changed");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/student\/login$/);

  // 5. Forgot password → only an admin can reset → one-time password
  await page.goto("/student/forgot");
  await expect(page.getByText("only a DOS Club admin can reset it")).toBeVisible();
  const admin = await browser.newContext({ storageState: statePath("ADMIN") });
  const ap = await admin.newPage();
  await ap.goto("/students");
  await ap.getByLabel("Search students").fill(STUDENT.email);
  await expect(ap.getByTestId("result-count")).toHaveText(/^1 student ·/);
  await ap.getByRole("button", { name: /^Preview / }).click();
  await expect(ap.getByTestId("portal-status")).toContainText("activated");
  await expect(ap.getByRole("button", { name: "Reset portal access" })).toHaveCount(0); // Super Admin only
  await ap.getByRole("button", { name: "Reset password" }).click();
  await ap.getByRole("button", { name: "Confirm: issue one-time password" }).click();
  const otp = (await ap.getByTestId("student-otp").locator("code").textContent())!.trim();
  expect(otp).toHaveLength(12);
  await admin.close();

  // 6. Sign in with the one-time password + authenticator → forced to create a new password
  await page.goto("/student/login");
  await page.getByLabel("Email").fill(STUDENT.email);
  await page.getByLabel("Password").fill(PW2);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Email or password is incorrect")).toBeVisible(); // old password replaced
  await page.getByLabel("Password").fill(otp);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/student\/totp$/);
  await page.getByLabel(/6-digit code/).fill(await freshCode(key));
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).toHaveURL(/\/student\/change-password$/);
  await page.goto("/student");
  await expect(page).toHaveURL(/\/student\/change-password$/); // can't skip it
  await page.getByRole("textbox", { name: /^New password/ }).fill(PW3);
  await page.getByLabel("Type it again").fill(PW3);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page).toHaveURL(/\/student$/);
  await expect(page.getByTestId("my-record")).toContainText(STUDENT.email);
});

test.describe("invitation message", () => {
  test.use({ storageState: statePath("ADMIN") });
  test("STA-12 admins can copy the WhatsApp invitation (no email service)", async ({ page }) => {
    await page.goto("/students");
    await page.getByRole("button", { name: "Invitation message" }).click();
    await expect(page.getByTestId("invitation-text")).toHaveValue(/\/student\/activate/);
    await expect(page.getByRole("button", { name: "Send portal invite" })).toHaveCount(0);
  });
});
