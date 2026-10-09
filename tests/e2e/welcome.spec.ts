import { test, expect } from "@playwright/test";

test("welcome plays once, pauses/replays, stays responsive and uses existing registration", async ({
  page,
}, info) => {
  await page.route("**/_vercel/insights/script.js", (route) =>
    route.fulfill({ contentType: "application/javascript", body: "" }),
  );
  await page.clock.install();
  await page.goto("/welcome");
  const canvas = page.getByTestId("welcome-canvas");
  await expect(canvas).toBeVisible();
  await expect(
    page.getByRole("button", { name: "PAUSE", exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(2000);
  await page.getByRole("button", { name: "PAUSE", exact: true }).click();
  const paused = await canvas.getAttribute("data-time");
  await page.clock.fastForward(2000);
  expect(await canvas.getAttribute("data-time")).toBe(paused);
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await page.clock.fastForward(26000);
  await expect(canvas).toHaveAttribute("data-time", "25.000");
  await expect(
    page.getByRole("button", { name: "REPLAY", exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(5000);
  await expect(canvas).toHaveAttribute("data-time", "25.000");
  const box = (await canvas.boundingBox())!;
  expect(box.width / box.height).toBeCloseTo(16 / 9, 2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const cta = page.getByRole("link", { name: "CREATE YOUR ATOM", exact: true });
  await expect(cta).toHaveAttribute("href", "/auth?mode=register");
  await page.getByRole("button", { name: "REPLAY", exact: true }).focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(cta).toBeFocused();
  await expect(cta).toHaveCSS("outline-style", "solid");
  await page.screenshot({
    path: info.outputPath("welcome.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "REPLAY", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "PAUSE", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-time")))
    .toBeLessThan(25);
});

test("welcome reduced-motion and no-JavaScript fallbacks keep CTA accessible", async ({
  page,
  browser,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/welcome");
  const canvas = page.getByTestId("welcome-canvas");
  await expect(canvas).toHaveAttribute("data-time", "25.000");
  await expect(page.getByText("Reduced motion · still scenes")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "CREATE YOUR ATOM", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("welcome-reduced.png"),
    fullPage: true,
  });
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: info.project.use.viewport ?? { width: 1440, height: 900 },
  });
  const staticPage = await context.newPage();
  await staticPage.goto("http://127.0.0.1:3100/welcome");
  await expect(
    staticPage.getByRole("img", { name: /A solitary Atom/ }),
  ).toBeVisible();
  await expect(
    staticPage.getByRole("link", { name: "CREATE YOUR ATOM", exact: true }),
  ).toHaveAttribute("href", "/auth?mode=register");
  await context.close();
});
