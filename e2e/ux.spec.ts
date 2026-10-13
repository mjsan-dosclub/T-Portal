import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { statePath } from "./util";

// UX-01: runs in Chromium AND WebKit (Safari's engine). Every field box must share the same height and
// left padding, so Safari no longer shows small native dropdowns next to large text boxes.
// The session cookie is `Secure`; Chromium sends it to http://localhost but WebKit doesn't, so this test-only
// copy drops the flag (production is HTTPS, where the real cookie works in Safari as is).
test.use({
  storageState: async ({}, provide) => {
    const state = JSON.parse(readFileSync(statePath("ADMIN"), "utf8")) as { cookies: { secure: boolean }[]; origins: unknown[] };
    await provide({ ...state, cookies: state.cookies.map((c) => ({ ...c, secure: false })) } as never);
  },
});

async function boxes(page: Page, scope: string) {
  return page.locator(scope).evaluate((root) =>
    [...root.querySelectorAll<HTMLElement>("input.input:not([type=checkbox]):not([type=file]), select.select")]
      .filter((el) => el.offsetParent !== null && !el.closest(".dtable"))
      .map((el) => {
        const cs = getComputedStyle(el);
        return { tag: el.tagName + (el.getAttribute("type") ? `[${el.getAttribute("type")}]` : ""), h: Math.round(el.getBoundingClientRect().height), pl: cs.paddingLeft, appearance: cs.getPropertyValue("appearance") || cs.getPropertyValue("-webkit-appearance") };
      }),
  );
}

test("UX-01 form fields line up: dropdowns, text, number and date boxes share height and padding (Chrome and Safari)", async ({ page }) => {
  await page.goto("/students/new");
  await expect(page).toHaveURL(/\/students\/new$/); // signed in, not bounced to /login
  const student = await boxes(page, "form");
  await page.goto("/internships");
  await page.getByRole("button", { name: "+ New program" }).click();
  const program = await boxes(page, "[role=dialog] form");
  const all = [...student, ...program];
  expect(all.length).toBeGreaterThan(15);
  expect(all.some((b) => b.tag === "SELECT")).toBe(true);
  expect(all.some((b) => b.tag === "INPUT[date]")).toBe(true);
  const heights = [...new Set(all.map((b) => b.h))];
  expect(Math.max(...heights) - Math.min(...heights), JSON.stringify(heights)).toBeLessThanOrEqual(2);
  expect([...new Set(all.map((b) => b.pl))]).toHaveLength(1);
  expect(all.filter((b) => b.tag === "SELECT").every((b) => b.appearance === "none")).toBe(true);
});
