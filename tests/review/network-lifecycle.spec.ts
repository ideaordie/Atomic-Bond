import { expect, test } from "@playwright/test";
test("map location and inactive bridge snapshots converge without renderer failure", async ({
  page,
}, info) => {
  await page.goto("/review/network-lifecycle");
  await expect(page.getByText(/5 ACTIVE Atoms/)).toBeVisible();
  await page.getByRole("button", { name: "SHOW MAP", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "HIDE MAP", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "EDIT HOME REGION", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Country (required)", exact: true })
    .fill("Canada");
  await page.getByRole("option", { name: "Canada CA", exact: true }).click();
  await page
    .getByRole("combobox", {
      name: "State / Province / Region (required)",
      exact: true,
    })
    .fill("Ontario");
  await page
    .getByRole("option", { name: "Ontario CA-ON", exact: true })
    .click();
  await page
    .getByRole("button", { name: "SAVE HOME REGION", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Geographic clusters", exact: true }),
  ).toContainText("Ontario, Canada");
  for (const state of ["DEACTIVATED", "DORMANT", "DELETED"]) {
    await page.getByLabel("Synthetic bridge Atom #2").selectOption(state);
    await expect(page.getByText(/1 ACTIVE Atoms/)).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Select an Atom", exact: true }),
    ).not.toContainText("ATOM #2");
  }
  await page.getByLabel("Synthetic bridge Atom #2").selectOption("ACTIVE");
  await expect(page.getByText(/5 ACTIVE Atoms/)).toBeVisible();
  await page.getByRole("button", { name: "HIDE MAP", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Select an Atom", exact: true })
    .selectOption("2");
  await page
    .getByRole("button", { name: "View their network", exact: true })
    .click();
  await page.getByLabel("Synthetic bridge Atom #2").selectOption("DEACTIVATED");
  await expect(page.getByTestId("atom-canvas")).toBeVisible();
  for (const theme of ["LIGHT", "DARK"]) {
    await page.getByRole("button", { name: theme, exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`network-${theme}.png`),
      fullPage: true,
    });
  }
});
