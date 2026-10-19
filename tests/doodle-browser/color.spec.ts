import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import ts from "typescript";
const original = execFileSync(
  "git",
  ["show", "3cb465a:src/prototypes/doodle/paint.ts"],
  { encoding: "utf8" },
);
const baseline = ts.transpileModule(
  original
    .replace(/^import .*;\r?\n/, "")
    .replace("export function", "function"),
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;
for (const theme of ["LIGHT", "DARK"]) {
  test(`${theme}: mixed feeds, palette, touch/keyboard, replay and identical legacy pixels`, async ({
    page,
  }, info) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/review/doodle/color");
    await page.getByRole("button", { name: theme, exact: true }).click();
    const canvas = page.getByTestId("doodle-editor");
    await expect(canvas).toBeVisible();
    await expect(
      page.getByRole("group", { name: "Drawing colors" }).getByRole("button"),
    ).toHaveCount(8);
    await page.getByRole("button", { name: "Red", exact: true }).click();
    await canvas.focus();
    await page.keyboard.press("Space");
    await expect(page.getByText("1 dots", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Blue", exact: true }).click();
    await canvas.focus();
    await page.keyboard.press("Space");
    await expect(page.getByText("1 dots", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "ERASE", exact: true }).click();
    await canvas.focus();
    await page.keyboard.press("Space");
    await expect(page.getByText("0 dots", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "UNDO", exact: true }).click();
    await expect(page.getByText("1 dots", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "White", exact: true }).click();
    if (info.project.use.hasTouch)
      await canvas.tap({ position: { x: 60, y: 60 } });
    else await canvas.click({ position: { x: 60, y: 60 } });
    await expect(page.getByText("2 dots", { exact: true })).toBeVisible();
    // Actual shared feed: both scopes and Hall carry both encoding versions.
    const feed = page.locator(".doodle-feed-scroll");
    await feed.scrollIntoViewIfNeeded();
    await expect(feed.getByRole("img")).toHaveCount(2);
    for (const name of ["MY NETWORK", "WORLD", "HALL OF FAME"]) {
      await page.getByRole("button", { name, exact: true }).click();
      await expect(feed.getByRole("img")).toHaveCount(2);
    }
    const legacy = page.getByRole("img", {
      name: "Legacy monochrome drawing",
      exact: true,
    });
    await legacy.screenshot({
      path: `artifacts/doodle-color/${info.project.name}-${theme}-legacy-after.png`,
    });
    const equal = await legacy.evaluate((node, source) => {
      const current = node as HTMLCanvasElement;
      const before = current.cloneNode() as HTMLCanvasElement;
      current.after(before);
      const bits = new Uint8Array(512);
      for (let color = 1; color <= 8; color++)
        for (let y = 16; y < 48; y++)
          for (let x = color * 6 - 3; x <= color * 6 + 1; x++) {
            const p = y * 64 + x;
            bits[p >> 3]! |= 1 << (p & 7);
          }
      const run = new Function(
        "canvas",
        "bits",
        `const SIDE=64;const hasDot=(b,p)=>Boolean(b[p>>3]&(1<<(p&7)));${source};paintDoodle(canvas,bits);`,
      );
      run(before, bits);
      const a = current
          .getContext("2d")!
          .getImageData(0, 0, current.width, current.height).data,
        b = before
          .getContext("2d")!
          .getImageData(0, 0, before.width, before.height).data;
      before.setAttribute("aria-label", "Baseline monochrome drawing");
      return a.length === b.length && a.every((v, i) => v === b[i]);
    }, baseline);
    expect(equal).toBe(true);
    await page
      .getByRole("img", { name: "Baseline monochrome drawing", exact: true })
      .screenshot({
        path: `artifacts/doodle-color/${info.project.name}-${theme}-legacy-before.png`,
      });
    await page
      .getByRole("img", { name: "Baseline monochrome drawing", exact: true })
      .evaluate((n) => n.remove());
    await page.getByRole("slider", { name: "Replay point" }).fill("1280");
    await page.screenshot({
      path: `artifacts/doodle-color/${info.project.name}-${theme}-all-views.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "SEND", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Local drawing submitted" }),
    ).toBeVisible();
    const slider = page.getByRole("slider", { name: "Replay point" });
    await slider.fill("2");
    await expect(
      page.getByRole("img", { name: "Replay point 2 of 3", exact: true }),
    ).toBeVisible();
  });
}
