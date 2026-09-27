import { expect, test } from "@playwright/test";
test("Supabase mode retrieves only real public projection and has no simulated owner actions", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/explore?atom=1");
  await expect(page.getByTestId("selected-atom")).toHaveText("#1");
  await expect(page.getByTestId("reachable-count")).toHaveText("1");
  await expect(
    page.getByText("Public network", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "CREATE BOND", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Pulse", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "FEEL YOUR NETWORK", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Coarse, synthetic geography", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Explore Atoms" }).click();
  await page.getByLabel("Select an Atom", { exact: true }).selectOption("1");
  const context = page.getByTestId("atom-context");
  await expect(context).toContainText("Public Test Atom");
  await expect(context).not.toContainText("Your Atom");
  expect(await page.content()).not.toMatch(/browser@example.com|mock-atom-/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("public-network.png"),
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByTestId("selected-atom")).toHaveText("#1");
  await page.goto("/explore?atom=9999");
  await expect(page.getByRole("status")).toContainText("No active Atoms");
  await expect(page.getByTestId("living-atom")).toHaveCount(0);
});
