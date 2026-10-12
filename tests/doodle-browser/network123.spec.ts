import { test, expect } from "@playwright/test";
test("scope changes discard stale results and reset request cursors", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let worldStarted = false,
    worldFinished = false;
  const calls: unknown[][] = [];
  await page.route("**/api/review/doodle-network", async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "read") {
      worldStarted = true;
      await held;
    } else calls.push(body.args);
    const stale = {
      id: "stale-world",
      atomNumber: "999",
      bitmap: Buffer.alloc(512).toString("base64"),
      publishedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      score: 0,
      own: false,
      appreciated: false,
    };
    await route
      .fulfill({
        json: {
          data: {
            serverTime: new Date().toISOString(),
            items: body.action === "read" ? [stale] : [],
            hall: [],
            refreshed: [],
            nextCursor: null,
            nextEligibleAt: null,
            submissionsPaused: false,
          },
        },
      })
      .catch(() => {});
    if (body.action === "read") worldFinished = true;
  });
  await page.goto("/review/doodle/network?feed=1");
  await expect.poll(() => worldStarted).toBe(true);
  await page.getByRole("button", { name: "MY NETWORK", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "MY NETWORK", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByText("NO DOODLES FROM YOUR NETWORK YET", { exact: true }),
  ).toBeVisible();
  release();
  await expect.poll(() => worldFinished).toBe(true);
  expect(calls[0]).toEqual([null, null, []]);
  await expect(
    page.getByRole("button", { name: "MY NETWORK", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".doodle-feed-scroll article")).toHaveCount(0);
});
test("standalone navigation and owner network scope", async ({
  page,
}, info) => {
  await page.goto("/review/doodle/network");
  await expect(
    page.getByRole("complementary", { name: "Global Doodle" }),
  ).toHaveCount(0);
  const nav = page.getByRole("navigation", { name: "Application navigation" });
  await expect(
    nav.getByRole("link", { name: "MY ATOM", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  const tops = await nav
    .locator("a")
    .evaluateAll((ns) => ns.map((n) => n.getBoundingClientRect().top));
  expect(new Set(tops).size).toBe(1);
  await nav.getByRole("link", { name: "SETTINGS", exact: true }).focus();
  expect(
    await nav.evaluate(
      (n) => n.scrollWidth <= n.clientWidth || n.scrollLeft > 0,
    ),
  ).toBe(true);
  await nav.getByRole("link", { name: "GLOBAL DOODLE", exact: true }).click();
  await expect(
    nav.getByRole("link", { name: "GLOBAL DOODLE", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  const feed = page.getByRole("complementary", { name: "Global Doodle" });
  await expect(feed.locator("article")).toHaveCount(20);
  const controls = feed.locator(".doodle-feed-controls");
  const controlBoxes = await controls.locator("button").evaluateAll((nodes) =>
    nodes.map((node) => ({
      top: node.getBoundingClientRect().top,
      height: node.getBoundingClientRect().height,
    })),
  );
  expect(controlBoxes).toHaveLength(4);
  expect(new Set(controlBoxes.map((box) => box.top)).size).toBe(1);
  expect(controlBoxes.every((box) => box.height >= 44)).toBe(true);
  expect(
    await controls.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  await page.screenshot({
    path: `artifacts/task123-controls-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "MY NETWORK", exact: true }).click();
  await expect(feed.locator("article")).toHaveCount(20);
  const nums = await feed.locator("article").allTextContents();
  expect(nums.join(" ")).not.toContain("ATOM #26");
  await feed.getByRole("button", { name: "LOAD OLDER" }).click();
  await expect(feed.locator("article")).toHaveCount(40);
  await page.screenshot({
    path: `artifacts/task123-${info.project.name}-network.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "WORLD", exact: true }).click();
  await expect(feed.locator("article")).toHaveCount(20);
  await feed.getByRole("button", { name: "HALL OF FAME" }).click();
  await expect(feed.locator("article")).toHaveCount(10);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `artifacts/task123-${info.project.name}-light.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "SWITCH THEME" }).click();
  await page.screenshot({
    path: `artifacts/task123-${info.project.name}-dark.png`,
    fullPage: true,
  });
});
