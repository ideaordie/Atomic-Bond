import { test, expect } from "@playwright/test";
for (const theme of ["LIGHT", "DARK"])
  test(`Queue Studio ${theme}: ordering, confirmation, pause and celebration`, async ({
    page,
  }) => {
    await page.goto("/review/puzzle/queue");
    await page.getByRole("button", { name: theme, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "PUZZLE STUDIO", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("23 / 25 locked", { exact: false }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "PREVIEW UPLOAD 1", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "ADD TO QUEUE", exact: true }),
    ).toBeDisabled();
    await page.getByLabel("I have reviewed and approve this artwork.").check();
    await page
      .getByRole("button", { name: "ADD TO QUEUE", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "PREVIEW QUEUED 3", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Move queued puzzle 3 up", exact: true })
      .click();
    await page
      .getByRole("button", { name: "REMOVE QUEUED 3", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "CONFIRM", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "CANCEL", exact: true }).click();
    await page
      .getByRole("button", { name: "PAUSE AUTOMATIC ADVANCEMENT", exact: true })
      .click();
    await page
      .getByRole("button", { name: "COMPLETE SYNTHETIC PUZZLE", exact: true })
      .click();
    await expect(page.getByText(/Celebration ends in 60 min/)).toBeVisible();
    await page
      .getByRole("button", { name: "PREVIEW CURRENT ARTWORK", exact: true })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/queue-${theme.toLowerCase()}-${test.info().project.name}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "ADVANCE ONE HOUR", exact: true })
      .click();
    await expect(
      page.getByText("WAITING FOR THE NEXT PUZZLE", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: "RESUME AUTOMATIC ADVANCEMENT",
        exact: true,
      })
      .focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("ACTIVE · 0 / 25 locked", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "SHOW PLAYER", exact: true })
      .click();
    await expect(
      page.getByText("UNTIL COMPLETE", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "COMPLETE SYNTHETIC PUZZLE", exact: true })
      .click();
    await expect(
      page.getByText("ENDS IN 60 min", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", { name: "Completed puzzle artwork", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "ADVANCE ONE HOUR", exact: true })
      .click();
    await expect(
      page.getByText("UNTIL COMPLETE", { exact: true }),
    ).toBeVisible();
  });
