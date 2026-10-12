import { test, expect } from "@playwright/test";
for (const theme of ["light", "dark"])
  test(`Task12.2 bounded feed ${theme}`, async ({ page }, info) => {
    await page.goto("/review/doodle/network?feed=1");
    if (theme === "dark")
      await page.getByRole("button", { name: "SWITCH THEME" }).click();
    const feed = page.getByRole("complementary", { name: "Global Doodle" });
    await feed.scrollIntoViewIfNeeded();
    await expect(feed.locator("article").first()).toBeVisible();
    await expect(feed.locator("article")).toHaveCount(20);
    await expect(
      page.getByRole("button", { name: "CREATE BOND", exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const ids = await feed
      .locator("article")
      .evaluateAll((nodes) =>
        nodes.map((n) => n.getAttribute("data-doodle-id")),
      );
    expect(new Set(ids).size).toBe(ids.length);
    await feed.getByRole("button", { name: "LOAD OLDER" }).click();
    await expect(feed.locator("article")).toHaveCount(40);
    await page.screenshot({
      path: `artifacts/task122-${info.project.name}-${theme}.png`,
      fullPage: true,
    });
    await feed.getByRole("button", { name: "HALL OF FAME" }).click();
    await expect(feed.locator("article")).toHaveCount(10);
    expect(await feed.getByRole("button", { name: /REPLAY/ }).count()).toBe(0);
  });
test("Task12.2 editor publishes once and exposes return/cooldown", async ({
  page,
}) => {
  await page.request.post("/api/review/doodle-network", {
    headers: { Origin: "http://127.0.0.1:3140" },
    data: { actor: 1, action: "advance", args: [60] },
  });
  await page.goto("/review/doodle/network?draw=1");
  await expect(
    page.getByRole("button", { name: "PREVIEW", exact: true }),
  ).toHaveCount(0);
  const canvas = page.getByTestId("doodle-editor");
  await canvas.focus();
  await canvas.press("Space");
  const send = page.getByRole("button", { name: "SEND", exact: true });
  await expect(send).toBeEnabled();
  await send.click();
  await expect(
    page.getByRole("heading", { name: "DOODLE PUBLISHED" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "DRAW ANOTHER" }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "RETURN TO MY ATOM" }).last().click();
  await expect(
    page.getByRole("complementary", { name: "Global Doodle" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "GLOBAL DOODLE", exact: true }).click();
  await expect(
    page.getByRole("complementary", { name: "Global Doodle" }),
  ).toBeVisible();
});
test("Task12.2 failure preserves draft, retries same payload, then cooldown releases new editor", async ({
  page,
}) => {
  await page.clock.install();
  const now = new Date().toISOString();
  const attempts: unknown[] = [];
  await page.route("**/api/review/doodle-network", async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "read")
      return route.fulfill({
        json: {
          data: {
            serverTime: now,
            nextEligibleAt: null,
            submissionsPaused: false,
            items: [],
            hall: [],
            refreshed: [],
            nextCursor: null,
          },
        },
      });
    if (body.action === "publish") {
      attempts.push(body.args);
      if (attempts.length === 1)
        return route.fulfill({
          status: 503,
          json: { error: "Test transport failure" },
        });
      return route.fulfill({
        json: {
          data: {
            id: "test-drawing",
            serverTime: now,
            publishedAt: now,
            expiresAt: new Date(Date.parse(now) + 86400000).toISOString(),
            nextEligibleAt: new Date(Date.parse(now) + 3600000).toISOString(),
          },
        },
      });
    }
    await route.abort();
  });
  await page.goto("/review/doodle/network?draw=1");
  await page.getByTestId("doodle-editor").focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "SEND", exact: true }).click();
  await expect(page.locator(".doodle-publishing [role=alert]")).toContainText(
    "draft is preserved",
  );
  await expect(page.getByText("1 dots", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "SEND", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "DOODLE PUBLISHED" }),
  ).toBeVisible();
  expect(attempts[0]).toEqual(attempts[1]);
  await expect(
    page.getByRole("button", { name: "DRAW ANOTHER" }),
  ).toBeDisabled();
  await page.clock.fastForward(3600001);
  await expect(
    page.getByRole("button", { name: "DRAW ANOTHER" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "DRAW ANOTHER" }).click();
  await expect(page.getByText("0 dots", { exact: true })).toBeVisible();
});

test("Task12.2 refresh preserves reading position, replaces removed content and paginates a fresh head", async ({
  page,
}) => {
  await page.clock.install();
  const now = Date.now(),
    bitmap = "0".repeat(1024);
  let generation = 0;
  const item = (n: number) => ({
    id: String(n).padStart(8, "0") + "-0000-4000-8000-000000000000",
    atomNumber: n,
    bitmap,
    publishedAt: new Date(now - n * 1000).toISOString(),
    expiresAt: new Date(now + 86400000).toISOString(),
    score: 0,
    own: false,
    appreciated: false,
  });
  // Use the application's compact bitmap encoding, not a replay payload.
  const encoded = Buffer.alloc(512).toString("base64");
  const all = Array.from({ length: 140 }, (_, n) => ({
    ...item(n + 1),
    bitmap: encoded,
  }));
  await page.route("**/api/review/doodle-network", async (route) => {
    const body = route.request().postDataJSON(),
      visible = body.args?.[2] ?? [];
    const records = generation
      ? [
          {
            ...all[0],
            id: "new-drawing",
            publishedAt: new Date(now + 1000).toISOString(),
          },
          ...all.filter((x) => x.id !== all[2]!.id),
        ]
      : all;
    const before = body.args?.[1],
      start = before ? records.findIndex((x) => x.id === before) + 1 : 0;
    const items = records.slice(start, start + 20),
      last = items.at(-1);
    await route.fulfill({
      json: {
        data: {
          items,
          hall: [],
          refreshed: records.filter((x) => visible.includes(x.id)),
          nextCursor:
            start + 20 < records.length ? [last!.publishedAt, last!.id] : null,
          serverTime: new Date(now).toISOString(),
          nextEligibleAt: null,
          submissionsPaused: false,
        },
      },
    });
  });
  await page.goto("/review/doodle/network?feed=1");
  const feed = page.getByRole("complementary", { name: "Global Doodle" });
  await feed.scrollIntoViewIfNeeded();
  await expect(feed.locator("article")).toHaveCount(20);
  const viewport = feed.locator(".doodle-feed-scroll");
  await viewport.evaluate((n) => {
    n.scrollTop = 120;
  });
  const before = await feed
    .locator("article")
    .first()
    .evaluate((n) => n.getBoundingClientRect().top);
  generation = 1;
  await page.clock.fastForward(31000);
  await expect(
    feed.getByRole("button", { name: "SHOW NEW DRAWINGS" }),
  ).toBeVisible();
  expect(
    await feed
      .locator("article")
      .first()
      .evaluate((n) => n.getBoundingClientRect().top),
  ).toBeCloseTo(before, 0);
  await expect(feed.locator(`[data-doodle-id="${all[2]!.id}"]`)).toHaveCount(0);
  await feed.getByRole("button", { name: "SHOW NEW DRAWINGS" }).click();
  await expect(feed.locator("article").first()).toHaveAttribute(
    "data-doodle-id",
    "new-drawing",
  );
  await expect(feed.locator("article")).toHaveCount(20);
  for (let i = 0; i < 5; i++) {
    await feed.getByRole("button", { name: "LOAD OLDER" }).click();
    await expect(
      feed.getByRole("button", { name: "LOAD OLDER" }),
    ).toBeEnabled();
  }
  expect(await feed.locator("article").count()).toBeLessThanOrEqual(100);
  const ids = await feed
    .locator("article")
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-doodle-id")));
  expect(new Set(ids).size).toBe(ids.length);
});
