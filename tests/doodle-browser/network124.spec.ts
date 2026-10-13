import { test, expect } from "@playwright/test";

for (const theme of ["light", "dark"])
  test(`seven-day feed tagline and unchanged controls in ${theme}`, async ({
    page,
  }, info) => {
    await page.goto("/review/doodle/network?feed=1");
    if (theme === "dark")
      await page.getByRole("button", { name: "SWITCH THEME" }).click();
    const feed = page.getByRole("complementary", { name: "Global Doodle" });
    const tagline = feed.getByText("Draw something. Make someone's day.", {
      exact: true,
    });
    await expect(tagline).toBeVisible();
    await expect(feed.locator("article")).toHaveCount(20);
    const heading = await feed
      .getByRole("heading", { name: "GLOBAL DOODLE", exact: true })
      .boundingBox();
    const line = await tagline.boundingBox();
    const create = await feed
      .getByRole("link", { name: "CREATE DOODLE" })
      .boundingBox();
    expect(line!.y).toBeGreaterThanOrEqual(heading!.y + heading!.height);
    expect(line!.y + line!.height).toBeLessThanOrEqual(create!.y);
    const boxes = await feed
      .locator(".doodle-feed-controls button")
      .evaluateAll((nodes) =>
        nodes.map((n) => ({
          y: n.getBoundingClientRect().y,
          height: n.getBoundingClientRect().height,
        })),
      );
    expect(boxes).toHaveLength(4);
    expect(new Set(boxes.map((b) => b.y)).size).toBe(1);
    expect(boxes.every((b) => b.height >= 44)).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const contrast = await tagline.evaluate((node) => {
      const rgb = (s: string) =>
        s
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number)
          .map((v) => {
            v /= 255;
            return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          });
      const lum = (v: number[]) =>
        v[0]! * 0.2126 + v[1]! * 0.7152 + v[2]! * 0.0722;
      const fg = lum(rgb(getComputedStyle(node).color));
      const bg = lum(
        rgb(getComputedStyle(node.closest("aside")!).backgroundColor),
      );
      return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
    for (const scope of ["MY NETWORK", "WORLD"]) {
      await feed.getByRole("button", { name: scope, exact: true }).click();
      await expect(feed.locator("article")).toHaveCount(20);
      await expect(tagline).toBeVisible();
    }
    await page.screenshot({
      path: `artifacts/task124-${info.project.name}-${theme}.png`,
      fullPage: true,
    });
    await feed.getByRole("button", { name: "HALL OF FAME" }).click();
    await expect(feed.locator("article")).toHaveCount(10);
    await expect(tagline).toBeVisible();
    await feed.getByRole("link", { name: "CREATE DOODLE" }).click();
    await expect(
      page.getByText(
        "Monochrome drawings remain live for 7 days. Do not include private information.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page.getByTestId("doodle-editor")).toBeVisible();
  });
