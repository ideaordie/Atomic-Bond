import { expect, test } from "@playwright/test";
import { mockAtomId } from "../../src/data/mock/graph";

test("primary actions align, remain reachable and preserve keyboard behavior", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/explore");
  const group = page.getByRole("group", { name: "Primary network actions" });
  const buttons = group.getByRole("button");
  await expect(buttons).toHaveText(["CREATE BOND", /Pulse/]);
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
  const disclosure = page.getByRole("button", {
    name: /YOUR NETWORK OVERVIEW/,
  });
  const overviewBox = (await disclosure.boundingBox())!;
  const dockBox = (await page.locator(".spatial-dock").boundingBox())!;
  expect(overviewBox.x + overviewBox.width / 2).toBeCloseTo(
    page.viewportSize()!.width / 2,
    0,
  );
  const overviewGap = dockBox.y - overviewBox.y - overviewBox.height;
  expect(overviewGap).toBeGreaterThanOrEqual(10);
  expect(overviewGap).toBeLessThanOrEqual(14);
  expect(
    await disclosure.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return el.contains(
        document.elementFromPoint(
          box.x + box.width / 2,
          box.y + box.height / 2,
        ),
      );
    }),
  ).toBe(true);
  await disclosure.focus();
  await page.keyboard.press("Enter");
  await expect(disclosure).toHaveAttribute("aria-expanded", "true");
  await page
    .getByRole("button", { name: "Close Your Network Overview" })
    .click();
  await expect(disclosure).toBeFocused();
  await expect(page.getByTestId("atom-canvas")).toHaveAttribute(
    "data-emotional-view",
    "active",
  );
  await expect(
    page.getByRole("button", { name: "My Atom", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Select an Atom", { exact: true })
    .selectOption(mockAtomId(1));
  await expect(
    page.getByRole("button", { name: "My Atom", exact: true }),
  ).toHaveCount(0);
  await expect(
    group.getByRole("button", { name: "CREATE BOND" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View their network" }).click();
  const home = group.getByRole("button", { name: "My Atom", exact: true });
  await expect(home).toBeVisible();
  await expect(group.getByRole("button", { name: "CREATE BOND" })).toHaveCount(
    0,
  );
  const homeBox = (await home.boundingBox())!;
  for (const key of ["x", "y", "width", "height"] as const) {
    expect(homeBox[key]).toBeCloseTo(boxes[0]![key], 0);
  }
  await page.screenshot({
    path: info.outputPath("my-atom-controls.png"),
    fullPage: true,
  });
  await home.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("selected-atom")).toHaveText("#00000001");
  await expect(home).toHaveCount(0);
  await expect(
    group.getByRole("button", { name: "CREATE BOND" }),
  ).toBeVisible();
});
