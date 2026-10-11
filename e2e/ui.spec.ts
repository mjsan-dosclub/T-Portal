import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { creds, freshCode, secrets, statePath } from "./util";

async function tabTo(page: Page, name: RegExp, max = 60) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const label = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return "";
      return (el.getAttribute("aria-label") ?? (el as HTMLInputElement).labels?.[0]?.textContent ?? el.textContent ?? "").trim();
    });
    if (name.test(label)) return;
  }
  throw new Error(`Could not reach ${name} with Tab`);
}

test.describe("UI / accessibility", () => {
  test("UI-01 keyboard only: sign in → select a page of students → bulk status update", async ({ page }) => {
    const c = creds().SUPER_ADMIN;
    await page.goto("/login");
    await page.keyboard.type(c.email); // email is autofocused
    await page.keyboard.press("Tab");
    await page.keyboard.type(c.password);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/login\/totp$/);
    await page.keyboard.type(await freshCode(secrets().SUPER_ADMIN!));
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/$/);
    await tabTo(page, /^Students$/);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/students$/);
    await expect(page.getByTestId("students-table")).toBeVisible();
    await tabTo(page, /Select all on this page/);
    await page.keyboard.press("Space");
    await expect(page.getByTestId("bulk-bar")).toContainText("25 selected");
    await tabTo(page, /^Update status$/, 200);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Update status" })).toBeVisible();
    await expect(page.getByLabel("New status")).toBeFocused();
    await page.keyboard.type("Alumni"); // type-to-select works on every platform's native <select>
    await expect(page.getByLabel("New status")).toHaveValue(/[0-9a-f-]{36}/);
    await tabTo(page, /Reason/);
    await page.keyboard.type("Keyboard-only check");
    await tabTo(page, /^Update 25$/);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("toast")).toContainText("Updated status for 25 student(s)");
    const focusVisible = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
    expect(focusVisible).toBeDefined();
  });

  test.describe("signed in", () => {
    test.use({ storageState: statePath("SUPER_ADMIN") });

    test("UI-02 axe: no serious or critical violations on every main page", async ({ page }) => {
      const pages = ["/", "/students", "/students/new", "/students/upload", "/masters/institutions", "/masters/departments", "/ontology", "/ontology/categories", "/ontology/roles", "/ontology/levels", "/ontology/program", "/recycle-bin", "/audit", "/admin/users", "/account", "/help", "/ontology/manage"];
      const problems: string[] = [];
      for (const p of pages) {
        await page.goto(p);
        await page.waitForLoadState("networkidle");
        const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        for (const v of r.violations.filter((v) => v.impact === "serious" || v.impact === "critical")) problems.push(`${p}: ${v.id} (${v.impact}) ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
      }
      expect(problems).toEqual([]);
    });

    test("UI-03 prefers-reduced-motion keeps the background blobs static", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      const names = await page.locator(".liquid-bg span").evaluateAll((els) => els.map((e) => getComputedStyle(e).animationName));
      expect(names).toEqual(["none", "none", "none"]);
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.reload();
      const moving = await page.locator(".liquid-bg span").first().evaluate((e) => getComputedStyle(e).animationName);
      expect(moving).not.toBe("none");
    });

    test("UI-04 without backdrop-filter, glass surfaces fall back to solid white and stay readable", async ({ page }) => {
      await page.goto("/");
      const css = await page.evaluate(async () => {
        const out: string[] = [];
        for (const s of Array.from(document.styleSheets)) {
          try {
            for (const r of Array.from(s.cssRules)) out.push(r.cssText);
          } catch {
            /* cross-origin */
          }
        }
        return out.join("\n");
      });
      expect(css).toMatch(/@supports not[^{]*backdrop-filter/);
      await page.evaluate(() => document.documentElement.classList.add("no-glass"));
      const bg = await page.locator(".glass").first().evaluate((e) => getComputedStyle(e).backgroundColor);
      expect(bg).toBe("rgb(255, 255, 255)");
    });

    test("UI-07 text on glass keeps ≥ 4.5:1 contrast even over the brightest blob", async ({ page }) => {
      await page.goto("/");
      const result = await page.evaluate(() => {
        const css = getComputedStyle(document.documentElement);
        // Resolve any CSS colour syntax (hex, #rrggbbaa, rgb()) via the browser itself.
        const probe = document.createElement("i");
        document.body.appendChild(probe);
        const rgba = (v: string) => {
          probe.style.color = "";
          probe.style.color = v.trim();
          const n = getComputedStyle(probe).color.match(/[\d.]+/g)!.map(Number);
          return n.length === 3 ? [...n, 1] : n;
        };
        const hex = (v: string) => rgba(v).slice(0, 3);
        const mix = (top: number[], a: number, under: number[]) => top.map((c, i) => c * a + under[i]! * (1 - a));
        const lum = (c: number[]) => {
          const [r, g, b] = c.map((x) => x / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
          return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
        };
        const ratio = (a: number[], b: number[]) => {
          const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
          return (x! + 0.05) / (y! + 0.05);
        };
        const bg = hex(css.getPropertyValue("--bg"));
        const worst: number[][] = [];
        for (const blob of ["--blob-accent", "--blob-primary", "--blob-green"]) {
          const b = rgba(css.getPropertyValue(blob));
          const under = mix(b.slice(0, 3), b[3]!, bg); // unblurred blob at full strength = worst case
          const g = rgba(css.getPropertyValue("--glass"));
          worst.push(mix(g.slice(0, 3), g[3]!, under));
        }
        const text = hex(css.getPropertyValue("--text"));
        const muted = hex(css.getPropertyValue("--text-muted"));
        const link = hex(css.getPropertyValue("--dos-accent-dark"));
        probe.remove();
        return { text: Math.min(...worst.map((w) => ratio(text, w))), muted: Math.min(...worst.map((w) => ratio(muted, w))), link: Math.min(...worst.map((w) => ratio(link, w))) };
      });
      expect(result.text).toBeGreaterThanOrEqual(4.5);
      expect(result.muted).toBeGreaterThanOrEqual(4.5);
      expect(result.link).toBeGreaterThanOrEqual(4.5);
      // Primary button: white on --dos-accent-dark
      const btn = await page.getByRole("link", { name: "Add student" }).evaluate((e) => [getComputedStyle(e).color, getComputedStyle(e).backgroundColor]);
      expect(btn).toEqual(["rgb(255, 255, 255)", "rgb(13, 107, 144)"]);
    });
  });
});
