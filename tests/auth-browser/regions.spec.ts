import { test, expect } from "@playwright/test";
import { selectHomeRegion } from "./home-region";
test("canonical dropdown keyboard, country-only and mobile layout", async ({
  page,
}, info) => {
  await page.goto("/auth?mode=register");
  await selectHomeRegion(page);
  await expect(page.locator("[name=locationId]")).toHaveValue(
    "ab830000-0000-4000-8000-55532d464c00",
  );
  const country = page.getByRole("combobox", { name: "Country" });
  await country.fill("VA");
  await expect(page.locator("[name=locationId]")).toHaveValue("");
  await country.fill("Vatican");
  await country.press("Enter");
  await expect(
    page.getByRole("combobox", { name: "State / Province / Region" }),
  ).toHaveCount(0);
  await expect(page.locator("[name=locationId]")).toHaveValue(
    "ab830000-0000-4000-8000-564100000000",
  );
  await country.fill("Brazil");
  await country.press("Enter");
  const region = page.getByRole("combobox", {
    name: "State / Province / Region",
  });
  await region.fill("sao paulo");
  await region.press("Enter");
  await expect(page.locator("#selected-region")).toContainText("São Paulo");
  await region.fill("not a canonical place");
  await expect(page.locator("[name=locationId]")).toHaveValue("");
  await expect(
    page.getByText("No matching results. Try another name or code."),
  ).toBeVisible();
  await region.press("Escape");
  await country.fill("United Kingdom");
  await country.press("Enter");
  await region.fill("");
  await region.press("ArrowDown");
  await region.press("Enter");
  expect(await page.locator("[name=locationId]").inputValue()).not.toBe("");
  await country.fill("");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("global-country-dropdown.png"),
    fullPage: true,
  });
  await country.fill("Moldova");
  await country.press("Enter");
  await region.fill("MD-GA");
  await expect(page.getByRole("option")).toContainText("Găgăuzia");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("long-subdivision-dropdown.png"),
    fullPage: true,
  });
  await region.press("Enter");
  await expect(page.locator("#selected-region")).toContainText("Moldova");
});

test("touch selection clears stale regions and needs no external geography request", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: info.project.use.viewport ?? { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  const external: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).hostname !== "127.0.0.1")
      external.push(new URL(r.url()).hostname);
  });
  await page.goto("http://127.0.0.1:3104/auth?mode=register");
  const country = page.getByRole("combobox", { name: "Country" });
  await country.tap();
  await country.fill("Australia");
  await page.getByRole("option", { name: "Australia AU", exact: true }).tap();
  const region = page.getByRole("combobox", {
    name: "State / Province / Region",
  });
  await region.tap();
  await region.fill("Victoria");
  await page
    .getByRole("option", { name: "Victoria AU-VIC", exact: true })
    .tap();
  await expect(page.locator("#selected-region")).toContainText(
    "Victoria, Australia",
  );
  await country.fill("Canada");
  await page.getByRole("option", { name: "Canada CA", exact: true }).tap();
  await expect(region).toHaveValue("");
  await expect(page.locator("[name=locationId]")).toHaveValue("");
  expect(external).toEqual([]);
  await context.close();
});
