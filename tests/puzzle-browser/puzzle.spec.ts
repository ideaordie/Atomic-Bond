import { test, expect } from "@playwright/test";
test("reveal, correct placement, cooldown and participant isolation", async ({
  page,
}) => {
  await page.goto("/review/puzzle");
  await page
    .getByRole("button", { name: "REVEAL MY PIECE", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "Your reserved image piece" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "SHOW CORRECT DESTINATION" }).click();
  await page
    .getByRole("button", { name: "PLACE MY PIECE", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Correct!");
  await expect(
    page.getByRole("button", { name: "REVEAL MY PIECE", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "MOVE A PIECE", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Simulated participant").selectOption("demo-2");
  await expect(
    page.getByRole("button", { name: "REVEAL MY PIECE", exact: true }),
  ).toBeEnabled();
});
test("keyboard swap completes; expiration and rollover", async ({ page }) => {
  await page.goto("/review/puzzle");
  await page.getByRole("button", { name: "DEMO FINAL SWAP" }).click();
  await page.getByRole("button", { name: "MOVE A PIECE", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Row 1, column 1: unlocked piece",
      exact: true,
    })
    .focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "CONFIRM SWAP" }).click();
  await expect(
    page.getByRole("heading", { name: "PUZZLE COMPLETE!" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "END WEEK", exact: true }).click();
  await page.getByRole("button", { name: "NEXT WEEK", exact: true }).click();
  await expect(page.getByText("WEEK 2", { exact: false })).toBeVisible();
});
for (const theme of ["light", "dark"]) {
  test(`${theme} layout, targets and reduced motion`, async ({
    page,
  }, info) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/review/puzzle");
    await page
      .getByRole("button", { name: theme.toUpperCase(), exact: true })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const cells = page
      .getByRole("group", { name: "Puzzle board, five rows and five columns" })
      .getByRole("button");
    expect(await cells.count()).toBe(25);
    const box = await cells.first().boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(
      await page
        .locator(".puzzle-preview")
        .evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("none");
    await page.screenshot({
      path: `artifacts/puzzle-${info.project.name}-${theme}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "DEMO FINAL SWAP" }).click();
    await page.screenshot({
      path: `artifacts/puzzle-board-${info.project.name}-${theme}.png`,
      fullPage: true,
    });
  });
}
