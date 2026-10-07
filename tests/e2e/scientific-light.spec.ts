import { expect, test } from "@playwright/test";

test("scientific light surfaces, readable controls and dimensional neutral canvas", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/explore");
  await expect(page.getByTestId("atom-canvas")).toBeVisible();
  const contrast = await page.evaluate(() => {
    const luminance = (color: string) => {
      const rgb = color
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number)
        .map((v) => {
          const c = v / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
      return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
    };
    return [
      ...document.querySelectorAll<HTMLElement>(
        ".primary-actions button, .secondary-actions button",
      ),
    ].map((node) => {
      const style = getComputedStyle(node);
      const a = luminance(style.color),
        b = luminance(style.backgroundColor);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
  });
  expect(Math.min(...contrast)).toBeGreaterThanOrEqual(4.5);
  await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
  const pixels = await page.getByTestId("atom-canvas").evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    const ctx = canvas.getContext("2d")!;
    const at = (x: number, y: number) =>
      [...ctx.getImageData(x, y, 1, 1).data].slice(0, 3);
    return {
      background: at(2, 2),
      highlight: at(canvas.width / 2 - 6, canvas.height / 2 - 8),
      shade: at(canvas.width / 2 + 10, canvas.height / 2 + 12),
    };
  });
  expect(Math.min(...pixels.background)).toBeGreaterThan(220);
  expect(pixels.highlight).not.toEqual(pixels.shade);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("scientific-neutral.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Pulse", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "How are you right now?" });
  await dialog.getByRole("radio", { name: "Joyful", exact: true }).check();
  await expect(
    dialog.getByRole("radio", { name: "Joyful", exact: true }),
  ).toBeFocused();
  await expect(
    dialog.getByRole("radio", { name: "Joyful", exact: true }).locator(".."),
  ).toHaveCSS("outline-style", "solid");
  await page.screenshot({
    path: info.outputPath("scientific-selector-focus.png"),
    fullPage: true,
  });
});
