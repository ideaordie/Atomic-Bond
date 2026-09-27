import type { Page } from "@playwright/test";
export async function selectHomeRegion(page: Page) {
  await page.getByRole("combobox", { name: "Country" }).fill("United States");
  await page
    .getByRole("option", { name: "United States US", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "State / Province / Region" })
    .fill("Florida");
  await page
    .getByRole("option", { name: "Florida US-FL", exact: true })
    .click();
}
