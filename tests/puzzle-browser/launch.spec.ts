import { test, expect } from "@playwright/test";
test("server-timed launch countdown never exposes early controls or artwork", async ({
  page,
}) => {
  await page.route("**/api/puzzle**", async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON().operation).toBe("read");
    await route.fulfill({
      json: {
        status: "WAITING",
        serverTime: "2026-10-13T04:00:00Z",
        nextStart: "2026-10-27T04:00:00Z",
        firstCommunity: true,
      },
    });
  });
  await page.goto("/review/puzzle/player/api");
  await expect(
    page.getByRole("heading", {
      name: "OUR FIRST COMMUNITY PUZZLE BEGINS OCTOBER 27",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Time until scheduled puzzle")).toContainText(
    "14d 0h",
  );
  await expect(
    page.getByRole("button", { name: "REVEAL MY PIECE" }),
  ).toHaveCount(0);
  await expect(page.locator(".puzzle-player img")).toHaveCount(0);
  for (const mode of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: mode as "light" | "dark" });
    expect(
      await page
        .locator("body")
        .evaluate((el) => el.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/task136-${test.info().project.name}-${mode}.png`,
      fullPage: true,
    });
  }
});
