import { test, expect } from "@playwright/test";

test("official Analytics is inert UI, filters sensitive routes and survives blocked collection", async ({
  page,
}, info) => {
  // Keep verification local: exercise the SDK queue without sending to Vercel.
  await page.route("**/_vercel/insights/script.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.__analyticsReady = true;`,
    }),
  );
  await page.goto("/about");
  await expect(
    page.locator('script[data-sdkn="@vercel/analytics/next"]'),
  ).toHaveCount(1);
  const check = await page.evaluate(() => {
    const queue = (window as unknown as { vaq: [string, unknown][] }).vaq;
    const hook = queue
      .filter(([name]) => name === "beforeSend")
      .at(-1)![1] as (event: { type: string; url: string }) => unknown;
    return {
      general: hook({ type: "pageview", url: location.origin + "/about" }),
      invitation: hook({
        type: "pageview",
        url: location.origin + "/bond/synthetic-capability",
      }),
      owner: hook({ type: "pageview", url: location.origin + "/owner" }),
      custom: hook({ type: "event", url: location.origin + "/about" }),
    };
  });
  expect(check.general).toEqual({
    type: "pageview",
    url: "http://127.0.0.1:3104/about",
  });
  expect(check.invitation).toBeNull();
  expect(check.owner).toBeNull();
  expect(check.custom).toBeNull();
  await expect(
    page.getByRole("heading", { name: "YOUR PRIVACY", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("about-privacy.png"),
    fullPage: true,
  });
  await page.goto("/about?token=synthetic-only");
  await expect(
    page.locator('script[data-sdkn="@vercel/analytics/next"]'),
  ).toHaveCount(1);
  expect(
    await page.evaluate(() => {
      const queue = (window as unknown as { vaq: [string, unknown][] }).vaq;
      const hook = queue
        .filter(([name]) => name === "beforeSend")
        .at(-1)![1] as (event: unknown) => unknown;
      return hook({ type: "pageview", url: location.origin + "/about" });
    }),
  ).toBeNull();
  await page.unroute("**/_vercel/insights/script.js");
  await page.route("**/_vercel/insights/script.js", (route) => route.abort());
  await page.goto("/auth?mode=access");
  await expect(
    page.getByRole("button", { name: "Email me an access link" }),
  ).toBeVisible();
  await page.goto("/explore");
  // Anonymous visitors retain the existing secure entry redirect.
  await expect(
    page.getByRole("link", { name: "ACCESS MY ATOM", exact: true }),
  ).toBeVisible();
});
