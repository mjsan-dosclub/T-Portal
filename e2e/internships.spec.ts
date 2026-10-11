import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { freshCode, statePath } from "./util";

// Fake dev-seed student: index 8 → student9@example.test, +919000010008.
const STUDENT = { email: "student9@example.test", phone: "90000 10008" };
const PW = "internship-student-password";
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
async function axe(p: Page) {
  const r = await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
}
const pdf = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(1500, 32)]);

test("INT-09 / CP-01 admin creates a program and assigns a student; student plans a career and uploads a weekly report; admin accepts it", async ({ page, browser }) => {
  // Admin: create the program and assign the student
  const admin = await browser.newContext({ storageState: statePath("ADMIN") });
  const ap = await admin.newPage();
  await ap.goto("/internships");
  await ap.getByRole("button", { name: "+ New program" }).click();
  const dlg = ap.getByRole("dialog", { name: "New internship program" });
  await dlg.getByLabel("Company (client) name").fill("Nordlicht Analytics GmbH");
  await dlg.getByLabel("Program title").fill("Data Analyst Intern (E2E)");
  await dlg.getByLabel("Description").fill("Build weekly dashboards and clean sales data with the Berlin analytics team.");
  await dlg.getByLabel("Country").fill("Germany");
  await dlg.getByLabel("City").fill("Berlin");
  await dlg.getByLabel("Work mode").selectOption("REMOTE");
  await dlg.getByLabel("Number of resources").fill("3");
  await dlg.getByLabel("Duration", { exact: true }).fill("4");
  await dlg.getByLabel("Start date").fill(daysAgo(10));
  await dlg.getByLabel("Status").selectOption("ONGOING");
  await dlg.getByRole("button", { name: "Create program" }).click();
  await expect(ap).toHaveURL(/\/internships\/[0-9a-f-]{36}$/);
  await expect(ap.getByTestId("program-facts")).toContainText("3 (0 assigned, 3 seat(s) left)");
  await ap.getByRole("button", { name: /^Assign students/ }).click();
  const as = ap.getByRole("dialog", { name: "Assign students" });
  await as.getByLabel("Search by name, email or student code").fill(STUDENT.email);
  await expect(as.getByTestId("candidate-table").locator("tbody tr")).toHaveCount(1);
  await as.getByRole("checkbox").check();
  await as.getByRole("button", { name: "Assign 1" }).click();
  await expect(ap.getByTestId("assignment-table").locator("tbody tr")).toHaveCount(1);
  const code = (await ap.getByTestId("assignment-table").locator("tbody tr .mono").first().textContent())!.trim();

  // Student: first access + authenticator
  await page.goto("/student/activate");
  await page.getByLabel("Email you registered with DOS Club").fill(STUDENT.email);
  await page.getByLabel("Mobile number you registered with DOS Club").fill(STUDENT.phone);
  await page.getByLabel("Create a password").fill(PW);
  await page.getByLabel("Type the password again").fill(PW);
  await page.getByRole("button", { name: "Create password & continue" }).click();
  const key = (await page.getByTestId("manual-key").textContent())!.replace(/\s/g, "");
  await page.getByLabel("6-digit code").fill(await freshCode(key));
  await page.getByRole("button", { name: "Verify and turn on" }).click();
  await page.getByLabel("I have saved my recovery codes").check();
  await page.getByRole("button", { name: "Continue to the portal" }).click();
  await expect(page).toHaveURL(/\/student$/);

  // CP-01: the career plan is its own page; the profile no longer has the target-role picker
  const nav = page.getByRole("navigation", { name: "Student" });
  await nav.getByRole("link", { name: "Career plan" }).click();
  await page.getByLabel("Target role (the job you're aiming for)").selectOption({ label: "Enterprise Architect" });
  await page.getByRole("button", { name: "Save role" }).click();
  await expect(page.getByTestId("gap-row")).toHaveCount(5);
  await expect(page.getByTestId("cp-summary")).toContainText("of 5 required skills met");
  await nav.getByRole("link", { name: "My profile" }).click();
  await expect(page.getByRole("heading", { name: /Key skills & tools/ })).toBeVisible();
  await expect(page.getByLabel("Target role (the job you're aiming for)")).toHaveCount(0);

  // INT-09: student sees the program and uploads week 1
  await nav.getByRole("link", { name: "Internships" }).click();
  const prog = page.getByTestId("my-program");
  await expect(prog).toContainText("Data Analyst Intern (E2E)");
  await expect(prog).toContainText("Nordlicht Analytics GmbH");
  const w1 = page.getByTestId("my-week-1");
  await w1.getByRole("button", { name: "Upload report" }).click();
  await w1.getByLabel("Week 1 report file").setInputFiles({ name: "notes.zip", mimeType: "application/zip", buffer: Buffer.from("PK\x03\x04 archive") });
  await w1.getByRole("button", { name: "Submit report" }).click();
  await expect(w1.getByRole("alert")).toContainText("Compressed files");
  await w1.getByLabel("Week 1 report file").setInputFiles({ name: "week1-report.pdf", mimeType: "application/pdf", buffer: pdf });
  await w1.getByLabel("Note for your coordinator (optional)").fill("Cleaned the March sales data.");
  await w1.getByRole("button", { name: "Submit report" }).click();
  await expect(page.getByTestId("toast").filter({ hasText: "Week 1 report submitted" })).toBeVisible();
  await expect(page.getByTestId("my-week-1").locator("[data-state]")).toHaveAttribute("data-state", "submitted");
  await expect(page.getByTestId("int-attendance")).toHaveText("100%");
  // 4-week program started 10 days ago: week 2 is open, week 3 hasn't started
  await expect(page.getByTestId("my-week-2").getByRole("button", { name: "Upload report" })).toBeVisible();
  await expect(page.getByTestId("my-week-3").getByRole("button", { name: "Upload report" })).toHaveCount(0);

  // Admin reviews and accepts week 1
  await ap.reload();
  await ap.getByTestId(`week-${code}-1`).click();
  const rv = ap.getByRole("dialog", { name: /^Week 1 report/ });
  await expect(rv).toContainText("week1-report.pdf");
  await expect(rv).toContainText("Cleaned the March sales data.");
  await rv.getByLabel("Feedback for the student").fill("Good start. Add hours per task next week.");
  await rv.getByRole("button", { name: "Accept" }).click();
  await expect(ap.getByTestId(`week-${code}-1`)).toHaveAttribute("data-state", "accepted");
  await expect(ap.getByTestId(`assignment-${code}`).getByTestId("row-attendance")).toHaveText("100%");

  // Student sees the feedback; accepted week can't be replaced
  await axe(ap);
  await page.reload();
  await expect(page.getByTestId("my-week-1").getByTestId("review-feedback")).toContainText("Add hours per task");
  await expect(page.getByTestId("my-week-1").getByRole("button", { name: /report$/ })).toHaveCount(0);
  await axe(page);
  await page.getByRole("navigation", { name: "Student" }).getByRole("link", { name: "Career plan" }).click();
  await axe(page);
  await admin.close();
});
