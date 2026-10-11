import { expect, test } from "@playwright/test";
import { creds, freshCode, passwordStep, secrets, statePath } from "./util";

test.describe("Auth (E2E)", () => {
  test("AUTH-09 opening /students without a session redirects to sign-in", async ({ page }) => {
    await page.goto("/students");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("AUTH-14 /signup and /register don't exist", async ({ page }) => {
    for (const p of ["/signup", "/register", "/sign-up"]) {
      const res = await page.request.get(p, { maxRedirects: 0 });
      expect([307, 404]).toContain(res.status()); // redirect to /login (no session) or not found
      const withSession = await page.request.get(p);
      expect(await withSession.text()).not.toMatch(/sign up|create account/i);
    }
  });

  test("AUTH-04 password + Google Authenticator code signs in; wrong code shows a helpful error", async ({ page }) => {
    await passwordStep(page, "ADMIN");
    await expect(page).toHaveURL(/\/login\/totp$/);
    await page.getByLabel(/6-digit code/).fill("000000");
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.locator("#totp-code-error")).toContainText("didn't work");
    await page.getByLabel(/6-digit code/).fill(await freshCode(secrets().ADMIN!));
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page).toHaveURL(/\/$/);
    const cookie = (await page.context().cookies()).find((c) => c.name === "dos_session")!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.secure).toBe(true);
    expect(cookie.sameSite).toBe("Strict");
  });

  test.describe("as Admin", () => {
    test.use({ storageState: statePath("ADMIN") });
    test("AUD-04 an Admin can't open the audit log or admin users", async ({ page }) => {
      await page.goto("/audit");
      await expect(page).toHaveURL(/\/\?denied=1$/);
      await expect(page.getByText("You don't have access to that page.")).toBeVisible();
      await expect(page.getByRole("link", { name: "Audit log" })).toHaveCount(0);
      const api = await page.request.get("/api/admins");
      expect(api.status()).toBe(403);
    });
  });

  test.describe("as Super Admin", () => {
    test.use({ storageState: statePath("SUPER_ADMIN") });
    test("AUD-04 Super Admin sees the audit log with filters", async ({ page }) => {
      await page.goto("/audit");
      await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
      await expect(page.getByTestId("audit-table")).toBeVisible();
      await page.getByLabel("Action starts with").fill("auth.");
      await page.getByRole("button", { name: "Filter" }).click();
      await expect(page).toHaveURL(/action=auth\./);
      const actions = await page.getByTestId("audit-table").locator("tbody td:nth-child(3)").allTextContents();
      expect(actions.length).toBeGreaterThan(0);
      for (const a of actions) expect(a.startsWith("auth.")).toBe(true);
      expect(creds().SUPER_ADMIN.email).toBeTruthy();
    });
  });
});
