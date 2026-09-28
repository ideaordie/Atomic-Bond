import { expect, test } from "@playwright/test";
test("Supabase mode retrieves only real public projection and has no simulated owner actions", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "CREATE MY ATOM", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "ACCESS MY ATOM", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("living-atom")).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("anonymous-entry.png"),
    fullPage: true,
  });
  await page.goto("/explore");
  await expect(page).toHaveURL("http://127.0.0.1:3102/");
  await page.goto("/a/1");
  await expect(
    page.getByText("PUBLIC ATOM VIEW · ATOM #1", { exact: true }),
  ).toBeVisible();
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
    page.getByRole("button", { name: /YOUR NETWORK OVERVIEW/ }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Coarse, synthetic geography", { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Select an Atom", { exact: true }).focus();
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
