import { expect, test } from "@playwright/test";
import { freshCode, manualKey, statePath } from "./util";

// Fake dev-seed student: index 6 → student7@example.test, +919000010006.
const STUDENT = { email: "student7@example.test", phone: "90000 10006" };
const PW = "detailed-profile-password";

test("PRF-16 / UX-08 student fills personal, education, certification and preferences; % chips and overall % rise; admin sees the full profile", async ({ page, browser }) => {
  await page.goto("/student/activate");
  await page.getByLabel("Email you registered with DOS Club").fill(STUDENT.email);
  await page.getByLabel("Mobile number you registered with DOS Club").fill(STUDENT.phone);
  await page.getByLabel("Create a password").fill(PW);
  await page.getByLabel("Type the password again").fill(PW);
  await page.getByRole("button", { name: "Create password & continue" }).click();
  const key = await manualKey(page);
  await page.getByLabel("6-digit code").fill(await freshCode(key));
  await page.getByRole("button", { name: "Verify and turn on" }).click();
  await page.getByLabel("I have saved my recovery codes").check();
  await page.getByRole("button", { name: "Continue to the portal" }).click();
  await page.getByRole("navigation", { name: "Student" }).getByRole("link", { name: "My profile" }).click();

  const overall = async () => Number((await page.getByTestId("completeness").textContent())!.replace("%", ""));
  // Layout: at desktop width the "Profile strength" panel sits beside the sections, not above them.
  const aside = await page.getByRole("complementary", { name: "Profile strength" }).boundingBox();
  const first = await page.locator("#personal").boundingBox();
  expect(aside!.x + aside!.width).toBeLessThanOrEqual(first!.x);
  expect(Math.abs(aside!.y - first!.y)).toBeLessThan(40);
  const start = await overall();
  await expect(page.getByTestId("section-scores").locator("li")).toHaveCount(12);

  // Personal details
  await page.getByLabel("Gender").selectOption("FEMALE");
  await page.getByLabel("Date of birth").fill("2005-03-15");
  await page.getByLabel("Current city").fill("Chennai");
  await page.getByLabel("State").fill("Tamil Nadu");
  await page.getByRole("button", { name: "Save personal details" }).click();
  await expect(page.getByTestId("score-personal")).toHaveText(/100%/);

  // Education: Class 10
  await page.getByRole("button", { name: "Add education" }).click();
  const ed = page.getByRole("dialog", { name: "Add: education" });
  await ed.getByLabel("Level").selectOption("CLASS_10");
  await ed.getByLabel("School / college").fill("Govt Higher Secondary School");
  await ed.getByLabel("Grading system").selectOption("PERCENTAGE");
  await ed.getByLabel("Score").fill("92");
  await ed.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("list-education")).toContainText("Class 10");
  await expect(page.getByTestId("score-education")).toHaveText(/33%/);

  // Certification
  await page.getByRole("button", { name: "Add certification" }).click();
  const ce = page.getByRole("dialog", { name: "Add: certifications" });
  await ce.getByLabel("Certification name").fill("NPTEL Cloud Computing");
  await ce.getByLabel("Issued by").fill("NPTEL");
  await ce.getByLabel("This credential does not expire").check();
  await ce.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("score-certifications")).toHaveText(/100%/);

  // Preferences
  // UX-08: role search with everyday job words; entry-level roles marked
  const roles = page.getByRole("combobox", { name: "Preferred roles (up to 3)" });
  await roles.fill("tester");
  const qa = page.getByRole("option", { name: /QA \/ SDET Engineer/ });
  await expect(qa).toContainText("matches “tester”");
  await expect(qa).toContainText("Entry-level friendly");
  await qa.click();
  await roles.fill("developer");
  await roles.press("Enter");
  await expect(page.getByRole("button", { name: "Remove QA / SDET Engineer" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Remove .*(Engineer|Developer)$/ })).toHaveCount(2);
  await page.getByLabel("Preferred locations (up to 5)").fill("Chennai");
  await page.locator("#preferences").getByRole("button", { name: "Add" }).click();
  await page.getByLabel("Full-time job").check();
  await page.getByLabel("Hybrid").check();
  await page.getByLabel("Available to join from").fill("2027-06-01");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByTestId("score-preferences")).toHaveText(/100%/);

  // Seed data already gives this student gender + city (personal starts at 75 %), so the rise is ≥ 1.25 + 5 + 10 + 10.
  expect(await overall()).toBeGreaterThanOrEqual(start + 26);

  // Admin sees the full profile
  const admin = await browser.newContext({ storageState: statePath("ADMIN") });
  const ap = await admin.newPage();
  await ap.goto("/students");
  await ap.getByLabel("Search students").fill(STUDENT.email);
  await expect(ap.getByTestId("result-count")).toHaveText(/^1 student ·/);
  await ap.getByRole("button", { name: /^Preview / }).click();
  await ap.getByRole("link", { name: "Skills, projects & attendance" }).click();
  const view = ap.getByTestId("profile-view");
  await expect(view).toContainText("NPTEL Cloud Computing");
  await expect(view).toContainText("Govt Higher Secondary School");
  await expect(view).toContainText("Chennai");
  await admin.close();
});
