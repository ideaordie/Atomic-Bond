import { expect, test } from "@playwright/test";

test("manifest, registration and clean offline navigation without private caching", async ({
  page,
  context,
  request,
}, info) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  await page.goto("/explore");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    "/icons/apple-touch-icon.png",
  );
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(
    true,
  );
  await context.setOffline(true);
  await expect(
    page.getByRole("heading", { name: "You're offline." }),
  ).toBeVisible();
  await expect(page.getByTestId("atom-canvas")).not.toBeVisible();
  await page.goto("/owner");
  await expect(
    page.getByRole("heading", { name: "You're offline." }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("offline.png"),
    fullPage: true,
  });
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    return (
      await Promise.all(
        keys.map(async (k) =>
          (await (await caches.open(k)).keys()).map(
            (r) => new URL(r.url).pathname,
          ),
        ),
      )
    ).flat();
  });
  expect(cached.sort()).toEqual(
    [
      "/offline.html",
      "/design-tokens.css",
      "/appearance-init.js",
      "/icons/atom-192.png",
      "/icons/atom-512.png",
      "/icons/atom-maskable-512.png",
      "/icons/apple-touch-icon.png",
    ].sort(),
  );
  await context.setOffline(false);
  await page.goto("/explore");
  await expect(page.getByTestId("atom-canvas")).toBeVisible();
});
