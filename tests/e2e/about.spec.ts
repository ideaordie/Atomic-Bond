import { expect, test } from "@playwright/test";

test("public beta About page has readable sections and keyboard return navigation", async ({
  page,
}, info) => {
  await page.goto("/explore");
  await page.getByRole("link", { name: "ABOUT", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "See how connected we already are.",
  );
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "BONDS",
    "EMOTIONAL PULSE",
    "YOUR PRIVACY",
    "EMAIL",
    "YOUR CHOICES",
    "BETA",
  ]);
  await expect(
    page.getByText("Your name or alias and X handle are optional."),
  ).toBeVisible();
  await expect(
    page.getByText(/Unsubscribing from growth updates does not prevent/),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Settings/i })).toHaveCount(0);
  await expect(page.getByRole("button")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const textWidth = await page
    .locator(".about-page section")
    .first()
    .evaluate((el) => el.getBoundingClientRect().width);
  expect(textWidth).toBeLessThanOrEqual(700);
  await page.screenshot({ path: info.outputPath("about.png"), fullPage: true });
  const back = page.getByRole("link", {
    name: "RETURN TO ATOMIC BOND",
    exact: false,
  });
  await back.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(back).toBeFocused();
  expect(
    await back.evaluate((el) => getComputedStyle(el).outlineStyle),
  ).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("http://127.0.0.1:3100/");
  await page.goto("/about");
  await expect(
    page.getByRole("heading", { name: "YOUR PRIVACY" }),
  ).toBeVisible();
});
