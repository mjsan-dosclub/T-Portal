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
    [...root.querySelectorAll<HTMLElement>("input.input:not([type=checkbox]):not([type=file]), select.select, button.select")]
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
  expect(all.some((b) => b.tag === "BUTTON[button]"), "searchable dropdowns measured too").toBe(true);
});

test("UX-09 long or growing lists are searchable dropdowns; short fixed lists stay plain (Chrome and Safari)", async ({ page }) => {
  await page.goto("/students/new");
  // Growing master lists → searchable; short fixed list (gender) → native select
  for (const label of ["Institution", "Degree", "Department", "DOS Club batch", "Status", "Colour team", "Target role (Skills Ontology)"])
    await expect(page.getByLabel(label, { exact: true }), label).toHaveAttribute("aria-haspopup", "listbox");
  await expect(page.locator("select#gender")).toHaveCount(1);

  // Not hidden behind the next card: the bottom of the open list is really on top (screenshot bug 2026-10-13).
  for (const label of ["Degree", "Institution", "DOS Club batch"]) {
    const t = page.getByLabel(label, { exact: true });
    await t.click();
    const list = t.locator("xpath=..").locator(".ss-panel");
    await expect(list).toBeVisible();
    const onTop = await list.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.bottom - 6);
      return !!hit && el.contains(hit);
    });
    expect(onTop, `${label} list is covered by another element`).toBe(true);
    expect(await list.getByRole("option").first().textContent(), "required field lists real options first").not.toBe("Choose…");
    await page.keyboard.press("Escape");
  }

  const trigger = page.getByLabel("Target role (Skills Ontology)", { exact: true });
  await trigger.click();
  const panel = trigger.locator("xpath=..").locator(".ss-panel");
  const search = panel.getByRole("combobox", { name: "Search options" });
  await expect(search).toBeFocused();
  const before = await panel.getByRole("option").count();
  expect(before).toBeGreaterThan(15);
  await search.fill("cloud eng");
  await expect(panel.getByRole("option")).toHaveText(["Cloud Engineer"]); // every word must match
  await search.fill("zzzz");
  await expect(panel.getByText("No matches")).toBeVisible();
  await search.fill("data");
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused(); // focus returns to the field
  await expect(trigger).toContainText("Data");
  // Escape closes without changing the value; clicking outside closes too
  const chosen = await trigger.getAttribute("data-value");
  await trigger.press("Enter");
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(trigger).toHaveAttribute("data-value", chosen!);
  await trigger.click();
  await page.locator("h1").first().click(); // click outside
  await expect(panel).toBeHidden();
});
