import { expect, test } from "@playwright/test";

test("primary actions align, remain reachable and preserve keyboard behavior", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/explore");
  const group = page.getByRole("group", { name: "Primary network actions" });
  const buttons = group.getByRole("button");
  await expect(buttons).toHaveText([
    "CREATE BOND",
    /Pulse/,
    "FEEL YOUR NETWORK",
  ]);
  const boxes = await buttons.evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect();
      const hit = document.elementFromPoint(
        box.x + box.width / 2,
        box.y + box.height / 2,
      );
      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        right: box.right,
        bottom: box.bottom,
        reachable: node.contains(hit),
      };
    }),
  );
  for (const box of boxes) {
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.reachable).toBe(true);
    expect(box.y).toBeCloseTo(boxes[0]!.y, 0);
    expect(box.height).toBeCloseTo(boxes[0]!.height, 0);
    expect(box.width).toBeCloseTo(boxes[0]!.width, 0);
    expect(box.right).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(box.bottom).toBeLessThanOrEqual(page.viewportSize()!.height);
  }
  expect(boxes[1]!.x).toBeGreaterThan(boxes[0]!.right);
  expect(boxes[2]!.x).toBeGreaterThan(boxes[1]!.right);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const canvas = (await page.getByTestId("atom-canvas").boundingBox())!;
  expect(boxes[0]!.y).toBeGreaterThan(canvas.y + canvas.height / 2 + 100);
  await page.screenshot({
    path: info.outputPath("primary-controls.png"),
    fullPage: true,
  });
  await buttons.nth(0).focus();
  await page.keyboard.press("Tab");
  await expect(buttons.nth(1)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "How are you feeling?" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(buttons.nth(1)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(buttons.nth(2)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(buttons.nth(2)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("atom-canvas")).toHaveAttribute(
    "data-emotional-view",
    "active",
  );
  await page.screenshot({
    path: info.outputPath("feel-controls.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Close network emotion results" })
    .click();
  await expect(buttons.nth(2)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(buttons.nth(2)).toHaveAttribute("aria-pressed", "false");
  await expect(
    page
      .getByRole("group", { name: "Network exploration" })
      .getByRole("button"),
  ).toHaveCount(2);
});
