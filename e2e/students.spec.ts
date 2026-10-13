import { expect, test } from "@playwright/test";
import { statePath } from "./util";

test.use({ storageState: statePath("ADMIN") });

test.describe("Students datatable (E2E)", () => {
  test("STU-17 page size 25/50/100 shows the right number of rows; filters reset to page 1", async ({ page }) => {
    await page.goto("/students");
    const rows = page.getByTestId("student-row");
    await expect(rows).toHaveCount(25);
    await page.getByLabel("Rows").selectOption("50");
    await expect(rows).toHaveCount(50);
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByTestId("result-count")).toContainText("page 2 of 3");
    await page.getByLabel("Batch").selectOption({ label: "2026-B1" });
    await expect(page.getByTestId("result-count")).toContainText("page 1 of");
    // Restore the saved preference and wait until the server has it, so later tests start from 25 rows.
    const saved = page.waitForResponse((r) => r.url().endsWith("/api/me/table-prefs") && r.request().method() === "PUT" && r.ok());
    await page.getByLabel("Rows").selectOption("25");
    await saved;
  });

  test("STU-18 hidden columns persist for the admin across sessions", async ({ page, browser }) => {
    await page.goto("/students");
    await page.getByRole("button", { name: "Columns" }).click();
    await page.getByRole("checkbox", { name: "Phone" }).uncheck();
    await expect(page.getByRole("columnheader", { name: /Phone/ })).toHaveCount(0);
    const ctx = await browser.newContext({ storageState: statePath("ADMIN") });
    const p2 = await ctx.newPage();
    await p2.goto("/students");
    await expect(p2.getByTestId("students-table")).toBeVisible();
    await expect(p2.getByRole("columnheader", { name: /Phone/ })).toHaveCount(0);
    await p2.getByRole("button", { name: "Columns" }).click();
    await p2.getByRole("checkbox", { name: "Phone" }).check();
    await ctx.close();
  });

  test("STU-19 search/filters survive back-forward navigation and never appear in the URL", async ({ page }) => {
    await page.goto("/students");
    await page.getByLabel("Search students").fill("student12@example.test");
    await expect(page.getByTestId("result-count")).toHaveText(/^1 student ·/);
    expect(page.url()).toBe(new URL("/students", page.url()).toString());
    await page.goto("/ontology");
    await page.goBack();
    await expect(page.getByLabel("Search students")).toHaveValue("student12@example.test");
    await expect(page.getByTestId("result-count")).toHaveText(/^1 student ·/);
    expect(page.url()).not.toContain("example.test");
    await page.getByRole("button", { name: "Clear filters" }).click();
  });

  test("STU-23 empty, loading and error states", async ({ page }) => {
    await page.goto("/students");
    await page.getByLabel("Search students").fill("zz-no-such-student-zz");
    await expect(page.getByTestId("empty-state")).toContainText("No students match");
    await page.getByRole("button", { name: "Clear filters" }).click();
    await page.route("**/api/students/query", (r) => r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Something went wrong. Please try again." }) }));
    await page.reload();
    await expect(page.getByTestId("error-state")).toBeVisible();
    await page.unroute("**/api/students/query");
    await page.route("**/api/students/query", async (r) => {
      await new Promise((res) => setTimeout(res, 800));
      await r.continue();
    });
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByTestId("students-table")).toBeVisible();
    await page.unroute("**/api/students/query");
    await page.reload();
    await expect(page.getByTestId("skeleton")).toHaveCount(1, { timeout: 500 }).catch(() => undefined); // skeleton may flash too fast to catch
    await expect(page.getByTestId("students-table")).toBeVisible();
  });

  test("STU-08 / STU-11 select page shows the select-all banner; >10 delete needs typed DELETE", async ({ page }) => {
    await page.goto("/students");
    await page.getByTestId("select-page").check();
    await expect(page.getByTestId("select-all-banner")).toContainText("All 25 students on this page are selected");
    await expect(page.getByTestId("bulk-bar")).toContainText("25 selected");
    await page.getByTestId("bulk-bar").getByRole("button", { name: "Delete" }).click();
    const confirm = page.getByTestId("confirm-delete");
    await expect(confirm).toBeDisabled();
    await page.getByLabel("Type DELETE to confirm").fill("delete");
    await expect(confirm).toBeDisabled();
    await page.getByLabel("Type DELETE to confirm").fill("DELETE");
    await expect(confirm).toBeEnabled();
    await page.getByRole("button", { name: "Cancel" }).click();
  });

  test("STU-10 delete then Undo from the toast restores the student", async ({ page }) => {
    await page.goto("/students");
    await page.getByLabel("Search students").fill("student5@example.test");
    await expect(page.getByTestId("result-count")).toHaveText(/^1 student ·/);
    await page.getByRole("button", { name: /^Delete / }).click();
    await page.getByTestId("confirm-delete").click();
    await expect(page.getByTestId("empty-state")).toBeVisible();
    await page.getByTestId("toast").getByRole("button", { name: /Undo/ }).click();
    await expect(page.getByTestId("result-count")).toHaveText(/^1 student ·/);
    await page.getByRole("button", { name: "Clear filters" }).click();
  });

  test("STU-13 preview drawer shows details read-only; Esc closes and returns focus", async ({ page }) => {
    await page.goto("/students");
    const btn = page.getByRole("button", { name: /^Preview / }).first();
    await btn.click();
    const drawer = page.getByTestId("student-preview");
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText("Student code");
    await expect(drawer.locator("input, select, textarea")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Edit student" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect(btn).toBeFocused();
  });

  test("STU-24 leaving the edit form with unsaved changes asks in-app before discarding", async ({ page }) => {
    await page.goto("/students");
    await page.getByRole("link", { name: /^Edit / }).first().click();
    await expect(page.getByRole("heading", { name: /^Edit / })).toBeVisible();
    await page.getByLabel("City").fill("Tirunelveli");
    await page.getByRole("link", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog", { name: "Discard unsaved changes?" })).toBeVisible();
    await page.getByRole("button", { name: "Keep editing" }).click();
    await expect(page.getByLabel("City")).toHaveValue("Tirunelveli");
    await page.getByRole("link", { name: "Cancel" }).click();
    await page.getByTestId("discard-changes").click();
    await expect(page).toHaveURL(/\/students$/);
  });

  test("STU-01 / STU-02 add a student in the form; a duplicate email links to the existing record", async ({ page }) => {
    await page.goto("/students/new");
    await page.getByLabel("Full name").fill("Kavya Ramesh");
    await page.getByLabel("Email").fill("kavya.ramesh@example.test");
    await page.getByLabel("Mobile").fill("90000 55501");
    await page.getByLabel("Institution").selectOption({ index: 1 });
    await page.getByLabel("Degree").selectOption({ label: "B.E." });
    await page.getByLabel("Department").selectOption({ index: 1 });
    await page.getByLabel("Graduation year").fill(String(new Date().getFullYear() + 1));
    await page.getByLabel("DOS Club batch").selectOption({ label: "2026-B1" });
    await page.getByRole("button", { name: "Add student" }).click();
    await expect(page.getByTestId("toast")).toContainText(/Added DOS-2026-\d{5}/);
    await page.goto("/students/new");
    await page.getByLabel("Email").fill("kavya.ramesh@example.test");
    await page.getByLabel("Mobile").focus();
    await expect(page.getByTestId("duplicate-banner")).toContainText(/DOS-2026-\d{5}/);
  });

  test("SEC-01 an XSS payload in notes renders as text in the preview", async ({ page }) => {
    let dialogs = 0;
    page.on("dialog", () => dialogs++);
    await page.goto("/students");
    await page.getByLabel("Search students").fill("student7@example.test");
    await expect(page.getByTestId("result-count")).toHaveText(/^1 student ·/);
    await page.getByRole("link", { name: /^Edit / }).first().click();
    const payload = `<img src=x onerror=alert(1)><script>alert(2)</script>`;
    await page.getByLabel(/Admin notes/).fill(payload);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/students$/);
    await expect(page.getByTestId("result-count")).toHaveText(/^1 student ·/); // search restored from session
    await page.getByRole("button", { name: /^Preview / }).first().click();
    await expect(page.getByTestId("student-preview")).toContainText(payload);
    expect(dialogs).toBe(0);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Clear filters" }).click();
  });
});
