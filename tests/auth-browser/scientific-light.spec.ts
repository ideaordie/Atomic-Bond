import { expect, test } from "@playwright/test";
test("light entry and registration remain readable without overflow", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "CREATE MY ATOM", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
  await page.screenshot({
    path: info.outputPath("scientific-entry.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "CREATE MY ATOM", exact: true }).click();
  await expect(page.getByLabel("Country", { exact: false })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Email").focus();
  await expect(page.getByLabel("Email")).toHaveCSS("outline-style", "solid");
  await page.screenshot({
    path: info.outputPath("scientific-auth.png"),
    fullPage: true,
  });
});
