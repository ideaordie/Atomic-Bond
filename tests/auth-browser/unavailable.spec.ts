import { expect, test } from "@playwright/test";

test("unassigned public number has a generic unavailable page", async ({
  page,
}) => {
  await page.goto("/a/999999");
  await expect(
    page.getByRole("heading", { name: "ATOM UNAVAILABLE" }),
  ).toBeVisible();
  await expect(
    page.getByText("This Atom is not currently available."),
  ).toBeVisible();
  await expect(
    page.getByText(/MY ATOM #|migrated|formerly|moved/i),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "RETURN TO ATOMIC BOND" }),
  ).toHaveAttribute("href", "/");
});
