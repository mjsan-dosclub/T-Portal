import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { freshCode, manualKey, statePath } from "./util";

// Fake dev-seed student: index 4 → student5@example.test, +919000010004.
const STUDENT = { email: "student5@example.test", phone: "90000 10004" };
const PW = "profile-student-password";

test("PRF-08 / ATT-04 / UX-02 student builds a profile; admin verifies a level and marks attendance; student sees both", async ({ page, browser }) => {
  // Student: first access + authenticator
  await page.goto("/student/activate");
  await page.getByLabel("Email you registered with DOS Club").fill(STUDENT.email);
  await page.getByLabel("Mobile number you registered with DOS Club").fill(STUDENT.phone);
  await page.getByLabel("Create a password").fill(PW);
  await page.getByLabel("Type the password again").fill(PW);
  await page.getByRole("button", { name: "Create password & continue" }).click();
  await expect(page).toHaveURL(/\/student\/enrol$/);
  const key = await manualKey(page);
  await page.getByLabel("6-digit code").fill(await freshCode(key));
  await page.getByRole("button", { name: "Verify and turn on" }).click();
  await page.getByLabel("I have saved my recovery codes").check();
  await page.getByRole("button", { name: "Continue to the portal" }).click();
  await expect(page).toHaveURL(/\/student$/);
  const batch = (await page.getByTestId("my-record").locator("dt:text-is('DOS Club batch') + dd").textContent())!.trim();
  const attendedBefore = Number((await page.getByTestId("my-attendance").textContent())!.trim().split(/\s/)[0]);

  // Profile: role, self-ratings, project
  await page.getByRole("navigation", { name: "Student" }).getByRole("link", { name: "Career plan" }).click();
  await page.getByRole("combobox", { name: "Target role (the job you're aiming for)" }).fill("enterprise arch");
  await page.getByRole("option", { name: /Enterprise Architect/ }).click();
  await page.getByRole("button", { name: "Save role" }).click();
  await expect(page.getByTestId("gap-row")).toHaveCount(5);
  await page.getByLabel("Your level for Solution architecture").selectOption("4");
  await page.getByLabel("Your level for Governance").selectOption("3");
  await page.getByTestId("save-levels").click();
  await expect(page.getByTestId("toast").filter({ hasText: "Your levels are saved" })).toBeVisible();
  await page.getByRole("navigation", { name: "Student" }).getByRole("link", { name: "My profile" }).click();
  await page.getByRole("button", { name: "Add project" }).click();
  const dlg = page.getByRole("dialog", { name: "Add: projects" });
  await dlg.getByLabel("Title").fill("College event portal");
  await dlg.getByLabel("What did you build and what was your part?").fill("Designed the architecture and APIs for our symposium registrations.");
  await dlg.getByLabel("Link (GitHub, demo…)").fill("https://github.com/example/event-portal");
  // UX-02: type-to-search skill picker with everyday words; names, not codes
  await dlg.getByRole("combobox", { name: "Skills used (up to 10)" }).fill("microservices");
  const opt = dlg.getByRole("option", { name: /Solution architecture/ });
  await expect(opt).toContainText("matches “microservices”");
  await opt.click();
  await expect(dlg.getByRole("button", { name: "Remove Solution architecture" })).toBeVisible();
  await dlg.getByRole("combobox", { name: "Skills used (up to 10)" }).fill("python");
  await dlg.getByRole("combobox", { name: "Skills used (up to 10)" }).press("Enter"); // keyboard pick of the top match
  await expect(dlg.getByRole("button", { name: "Remove Programming/software development" })).toBeVisible();
  await expect(dlg.getByText(/\bARCH\b|\bPROG\b/)).toHaveCount(0);
  // UX-01: month fields are Month + Year dropdowns
  await dlg.getByLabel("Started: month").selectOption({ label: "Jun" });
  await dlg.getByLabel("Started: year").selectOption("2025");
  await dlg.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("list-projects")).toContainText("College event portal");
  await expect(page.getByTestId("list-projects")).toContainText("Jun 2025");
  await expect(page.getByTestId("list-projects")).toContainText("Solution architecture");
  await expect(page.getByTestId("completeness")).not.toHaveText("0%");

  // Admin: verify ARCH at L3 and mark attendance for the student's batch, day 20
  const admin = await browser.newContext({ storageState: statePath("ADMIN") });
  const ap = await admin.newPage();
  await ap.goto("/students");
  await ap.getByLabel("Search students").fill(STUDENT.email);
  await expect(ap.getByTestId("result-count")).toHaveText(/^1 student ·/);
  await ap.getByRole("button", { name: /^Preview / }).click();
  await ap.getByRole("link", { name: "Skills, projects & attendance" }).click();
  await expect(ap.getByText("College event portal")).toBeVisible();
  await ap.getByLabel("Verified level for Solution architecture").selectOption("3");
  await ap.getByTestId("save-levels").click();
  await expect(ap.getByTestId("toast").filter({ hasText: "Verified levels saved" })).toBeVisible();

  await ap.goto("/attendance");
  const batchValue = await ap.getByLabel("DOS Club batch").locator("option", { hasText: `${batch} (` }).first().getAttribute("value");
  await ap.getByLabel("DOS Club batch").selectOption(batchValue!);
  await ap.getByLabel("Workshop day").selectOption("20");
  await expect(ap.getByTestId("attendance-sheet")).toBeVisible();
  await ap.getByRole("button", { name: "Mark all present" }).click();
  await ap.getByTestId("save-attendance").click();
  await expect(ap.getByTestId("toast").filter({ hasText: "Saved" })).toBeVisible();
  await ap.getByRole("button", { name: "Back to overview" }).click();
  await expect(ap.getByTestId("attendance-overview")).toContainText(/present/);
  await admin.close();

  // Student sees the verified level and the extra attended day
  await page.getByRole("navigation", { name: "Student" }).getByRole("link", { name: "Career plan" }).click();
  await expect(page.getByTestId("gap-table")).toContainText("✓ L3");
  await page.getByRole("navigation", { name: "Student" }).getByRole("link", { name: "My record" }).click();
  await expect(page.getByTestId("my-attendance")).toContainText(String(attendedBefore + 1));
});

test.describe("insights", () => {
  test.use({ storageState: statePath("SUPER_ADMIN") });
  test("INS-06 insights page with a batch filter renders every section; axe clean", async ({ page }) => {
    await page.goto("/insights");
    await expect(page.getByTestId("adoption")).toBeVisible();
    await expect(page.getByTestId("readiness-breakdown")).toBeVisible();
    await expect(page.getByTestId("skill-gaps").locator("li").first()).toBeVisible();
    await expect(page.getByTestId("heatmap")).toBeVisible();
    await expect(page.getByTestId("top-roles")).toBeVisible();
    await expect(page.getByTestId("attendance-by-batch")).toBeVisible();
    await page.getByLabel("Batch", { exact: true }).selectOption({ index: 1 });
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/batch=[0-9a-f-]{36}/);
    expect(page.url()).not.toMatch(/@|%40/); // only ids in the URL
    await expect(page.getByTestId("adoption")).toBeVisible();
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  });
});
