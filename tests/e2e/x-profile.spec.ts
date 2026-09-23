import { expect, test } from "@playwright/test";

test("optional X onboarding rejects URLs and exposes only a safe public profile link", async ({
  page,
  context,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/explore");
  await page.getByRole("button", { name: "Explore Atoms" }).click();
  await page
    .getByLabel("Select an Atom", { exact: true })
    .selectOption("mock-atom-00000002");
  await expect(page.locator(".public-x-profile")).toHaveCount(0);
  await page.getByRole("button", { name: "Close selected Atom" }).click();
  await page.getByRole("button", { name: "CREATE BOND", exact: true }).click();
  await page
    .getByRole("button", { name: "Simulate recipient", exact: true })
    .click();
  await page
    .getByRole("button", { name: "New to Atomic Bond", exact: true })
    .click();
  const xField = page.getByLabel("X handle", { exact: false });
  await expect(xField).not.toHaveAttribute("required", "");
  await page.getByLabel("Email", { exact: false }).fill("private@example.com");
  await page.getByRole("combobox", { name: "Home region" }).fill("Boynton");
  await page.getByRole("option", { name: /Boynton Beach/ }).click();
  await xField.fill("https://x.com/example_user");
  await page
    .getByRole("button", { name: "Create my Atom", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "URLs are not accepted",
  );
  await xField.fill("@example_user");
  await page.screenshot({
    path: info.outputPath("x-onboarding.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Create my Atom", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Simulate email verification", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm Bond", exact: true }).click();
  await page.getByRole("button", { name: "See your network" }).click();
  await page.getByRole("button", { name: "Explore Atoms" }).click();
  await page
    .getByLabel("Select an Atom", { exact: true })
    .selectOption("session-atom-1001");
  await expect(
    page.getByText("𝕏 @example_user", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Ownership not verified", { exact: true }),
  ).toBeVisible();
  const link = page.getByRole("link", {
    name: "View @example_user on X (opens in a new tab)",
  });
  await expect(link).toHaveAttribute("href", "https://x.com/example_user");
  await expect(link).toHaveAttribute("target", "_blank");
  expect(await page.getByTestId("atom-context").innerText()).not.toContain(
    "private@example.com",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({
    path: info.outputPath("x-profile.png"),
    fullPage: true,
  });
  // Intercept the external destination: verify real new-tab behavior without contacting X.
  await context.route("https://x.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<title>External profile test</title>",
    }),
  );
  const popupPromise = context.waitForEvent("page");
  await link.focus();
  await link.press("Enter");
  const popup = await popupPromise;
  await expect(popup).toHaveURL("https://x.com/example_user");
  expect(await popup.evaluate(() => window.opener === null)).toBe(true);
  await popup.close();
  await expect(page.getByTestId("selected-atom")).toHaveText("#00000001");
});
