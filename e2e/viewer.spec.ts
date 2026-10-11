import { expect, test } from "@playwright/test";
import { statePath } from "./util";

test.use({ storageState: statePath("VIEWER") });

test("DSH-02 a Viewer sees dashboard counts but no student rows, and the student list is read-only", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("stat-total-value")).toHaveText(/\d/);
  await expect(page.getByTestId("by-batch")).toBeVisible();
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/@example\.test|\+91\d{10}/);
  await expect(page.getByRole("link", { name: "Add student" })).toHaveCount(0);
  await page.goto("/students");
  await expect(page.getByTestId("students-table")).toBeVisible();
  await expect(page.getByTestId("select-page")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^Edit / })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Upload" })).toHaveCount(0);
  const r = await page.request.post("/api/students/bulk/delete", { data: { selection: { mode: "ids", ids: ["00000000-0000-4000-8000-000000000000"] } }, headers: { origin: new URL(page.url()).origin } });
  expect(r.status()).toBe(403);
});
