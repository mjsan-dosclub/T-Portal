import { expect, test as setup } from "@playwright/test";
import { enrolViaUi, statePath, type Role } from "./util";

// AUTH-01/AUTH-03 through the real UI: first sign-in forces Google Authenticator enrolment.
for (const role of ["SUPER_ADMIN", "ADMIN", "VIEWER"] as Role[]) {
  setup(`sign in and enrol ${role}`, async ({ page }) => {
    await enrolViaUi(page, role);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome");
    await page.context().storageState({ path: statePath(role) });
  });
}
