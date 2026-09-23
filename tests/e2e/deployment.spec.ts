import { expect, test } from "@playwright/test";

test("direct routes, production assets and private artifact exclusion", async ({
  page,
  request,
}) => {
  const failedAssets: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/_next/static/") && !response.ok())
      failedAssets.push(response.url());
  });
  page.on("requestfailed", (request) => {
    if (request.url().includes("/_next/static/"))
      failedAssets.push(request.url());
  });
  for (const route of ["/", "/explore"]) {
    expect((await page.goto(route))?.status()).toBe(200);
    expect((await page.reload())?.status()).toBe(200);
    const assets = await page
      .locator('script[src], link[rel="stylesheet"]')
      .evaluateAll((elements) =>
        elements.map(
          (element) =>
            element.getAttribute("src") ?? element.getAttribute("href")!,
        ),
      );
    expect(assets.length).toBeGreaterThan(0);
    for (const asset of assets)
      expect((await request.get(asset)).status()).toBe(200);
  }
  await expect(
    page.getByRole("button", { name: "CREATE BOND", exact: true }),
  ).toBeVisible();
  expect(failedAssets).toEqual([]);
  for (const path of [
    "/.env",
    "/.env.local",
    "/.env.example",
    "/artifacts/references/x-profile-v0.1/mobile-x-profile.png",
    "/references/x-profile-v0.1/mobile-x-profile.png",
  ]) {
    expect((await request.get(path)).status()).toBe(404);
  }
});
