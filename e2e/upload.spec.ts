import { expect, test } from "@playwright/test";
import { statePath } from "./util";

test.use({ storageState: statePath("ADMIN") });

const Y = new Date().getFullYear() + 1;
const HEADER = "full_name,email,phone,institution,degree,department,graduation_year,batch";
function file(rows: string[], name = "members.csv") {
  return { name, mimeType: "text/csv", buffer: Buffer.from("﻿" + [HEADER, ...rows].join("\r\n")) };
}

test.describe("Upload wizard (E2E)", () => {
  test("UPL-01 / UPL-07 upload → map an unknown department → import; error report offered", async ({ page }) => {
    await page.goto("/students/upload");
    await page.getByTestId("upload-input").setInputFiles(
      file([
        `Nila Devi,nila.devi@example.test,9000066601,Example Institute of Technology,B.E.,CSE,${Y},2026-B1`,
        `Bala Murugan,bala.m@example.test,9000066602,Example Institute of Technology,B.E.,Computer Sci & Engg,${Y},2026-B1`,
        `Bad Row,not-an-email,9000066603,Example Institute of Technology,B.E.,CSE,${Y},2026-B1`,
      ]),
    );
    await expect(page.getByTestId("count-valid")).toHaveText("1");
    await expect(page.getByTestId("count-errors")).toHaveText("2");
    await expect(page.getByTestId("mapping-step")).toContainText("Computer Sci & Engg");
    await page.getByLabel('Map department "Computer Sci & Engg"').selectOption({ label: "Computer Science and Engineering" });
    await page.getByRole("button", { name: "Apply mapping & re-check" }).click();
    await expect(page.getByTestId("count-valid")).toHaveText("2");
    await expect(page.getByTestId("download-errors")).toBeVisible();
    await page.getByTestId("confirm-import").click();
    await expect(page.getByTestId("import-result")).toContainText("Imported 2");
  });

  test("UPL-02 a wrong header is rejected before preview and lists expected headers", async ({ page }) => {
    await page.goto("/students/upload");
    await page.getByTestId("upload-input").setInputFiles({ name: "x.csv", mimeType: "text/csv", buffer: Buffer.from("name,mail\nA,b") });
    await expect(page.getByTestId("upload-error")).toContainText("doesn't match the template");
    await expect(page.getByTestId("upload-error")).toContainText("full_name");
  });

  test("UPL-17 leaving at the preview step and coming back resumes the same upload", async ({ page }) => {
    await page.goto("/students/upload");
    await page.getByTestId("upload-input").setInputFiles(file([`Resume Test,resume.test@example.test,9000066611,Example Institute of Technology,B.E.,Underwater Basketry,${Y},2026-B1`], "resume-me.csv"));
    await expect(page.getByTestId("mapping-step")).toBeVisible();
    const jobUrl = page.url();
    expect(jobUrl).toMatch(/\/students\/upload\?job=[0-9a-f-]{36}$/);
    expect(jobUrl).not.toContain("example.test");
    await page.goto("/students");
    await page.goto("/students/upload");
    await page.getByRole("button", { name: "resume-me.csv" }).click();
    await expect(page.getByTestId("mapping-step")).toContainText("Underwater Basketry");
    await page.goto(jobUrl);
    await expect(page.getByTestId("count-errors")).toHaveText("1");
  });
});
