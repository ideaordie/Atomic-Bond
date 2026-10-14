import { test, expect } from "@playwright/test";
for (const theme of ["light", "dark"])
  test(`Player ${theme}: artwork, hidden board, reservation, locks, move selection and completion`, async ({
    page,
  }, info) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/review/puzzle/player");
    await page
      .getByRole("button", { name: theme.toUpperCase(), exact: true })
      .click();
    await expect(page.getByText("Many people. One big picture.")).toBeVisible();
    await expect(
      page
        .getByRole("group", { name: "Shared puzzle board" })
        .getByRole("button"),
    ).toHaveCount(25);
    await expect(
      page.getByRole("group", { name: "Shared puzzle board" }).getByRole("img"),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Revealed piece", exact: true })
      .click();
    await expect(
      page.getByRole("img", { name: "Your reserved piece" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Position 13, empty", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("button", { name: "PLACE HERE" }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Placements", exact: true }).click();
    await expect(
      page.getByRole("button", {
        name: "Position 1, correct and locked",
        exact: true,
      }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Position 8, movable piece", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Position 3, empty", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "MOVE HERE", exact: true }),
    ).toBeEnabled();
    await page.screenshot({
      path: `artifacts/task137-player-${theme}-${info.project.name}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Completed", exact: true }).click();
    await expect(
      page.getByRole("img", { name: "Completed puzzle artwork" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "REVEAL MY PIECE" }),
    ).toHaveCount(0);
    await page
      .getByText("CONNECTED LANDSCAPE — full artwork and 25 tiles")
      .click();
    await expect(page.getByRole("img", { name: /^Artwork tile / })).toHaveCount(
      25,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.getByRole("navigation").getByRole("link")).toHaveText([
      "MY ATOM",
      "GLOBAL DOODLE",
      "PARTICIPUZZLE",
      "ABOUT",
      "SETTINGS",
    ]);
  });
