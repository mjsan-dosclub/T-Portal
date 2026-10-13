import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { choose, statePath } from "./util";

test.describe("Ontology maintenance (E2E)", () => {
  test.use({ storageState: statePath("ADMIN") });

  test("ONT-17 admin adds a skill, sees it in Categories, retires it, and the change log shows both", async ({ page }) => {
    await page.goto("/ontology/manage");
    await page.getByRole("button", { name: "Add skill" }).click();
    const dlg = page.getByRole("dialog", { name: "Add a new skill" });
    await dlg.getByLabel("Skill code").fill("BHSC");
    await dlg.getByLabel("Skill name").fill("Bharat stack integration");
    await dlg.getByLabel("Description").fill("Integrating UPI, DigiLocker and Aadhaar-based e-KYC APIs into products.");
    await dlg.getByLabel("Category", { exact: true }).selectOption({ index: 2 });
    await choose(dlg, "Subcategory", { index: 1 });
    await dlg.getByRole("button", { name: "Add skill" }).click();
    await expect(page.getByTestId("toast")).toContainText("BHSC added");

    await page.goto("/ontology/categories");
    await expect(page.getByText("Bharat stack integration")).toBeAttached();

    await page.goto("/ontology/manage");
    await page.getByLabel("Search skills").fill("BHSC");
    await page.getByRole("button", { name: "Retire BHSC" }).click();
    await page.getByLabel("Why is it being retired?").fill("Covered by an existing skill");
    await page.getByRole("dialog").getByRole("button", { name: "Retire" }).click();
    await expect(page.getByTestId("toast")).toContainText("BHSC retired");

    await page.goto("/ontology/categories");
    await expect(page.getByText("Bharat stack integration")).toHaveCount(0);

    await page.goto("/ontology/manage");
    await page.getByRole("tab", { name: "Change log" }).click();
    const log = page.getByTestId("ontology-changes");
    await expect(log).toContainText("skill create");
    await expect(log).toContainText("skill retire");
    await expect(log).toContainText("Covered by an existing skill");
  });
});

test.describe("Guides (E2E)", () => {
  test("HELP-01 the student guide is public, has no personal data, and links admins to sign in", async ({ page }) => {
    await page.goto("/how-it-works");
    await expect(page).toHaveURL(/\/how-it-works$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("How the DOS Club Talent Portal works for you");
    await expect(page.getByTestId("guide-levels").locator("li")).toHaveCount(6);
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/@example\.test|\+91\d{10}/); // only the illustrative code DOS-2026-00042 appears
    await expect(page.getByRole("link", { name: "Admin sign in" })).toHaveAttribute("href", "/login");
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  });

  test.describe("as Admin", () => {
    test.use({ storageState: statePath("ADMIN") });
    test("HELP-02 Admin guide shows admin tasks incl. ontology updates, not Super Admin tasks; screenshots load", async ({ page }) => {
      await page.goto("/help");
      await expect(page.getByRole("heading", { name: "Upload many students from Excel or CSV" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Keep the Skills Ontology up to date" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Super Admin tasks" })).toHaveCount(0);
      const imgs = await page.locator("main figure img").all();
      expect(imgs.length).toBe(3);
      for (const img of imgs) {
        await img.scrollIntoViewIfNeeded(); // next/image lazy-loads below the fold
        await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
      }
      await expect(page.getByRole("link", { name: "How it works" })).toHaveAttribute("aria-current", "page");
    });
  });

  test.describe("as Viewer", () => {
    test.use({ storageState: statePath("VIEWER") });
    test("HELP-02 Viewer guide is read-only: no add/upload/ontology-editing sections", async ({ page }) => {
      await page.goto("/help");
      await expect(page.getByRole("heading", { name: "Find and view students" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Add or edit one student" })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Keep the Skills Ontology up to date" })).toHaveCount(0);
      await page.goto("/ontology/manage");
      await expect(page).toHaveURL(/\/\?denied=1$/);
    });
  });
});
