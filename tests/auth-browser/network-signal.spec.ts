import { test, expect } from "@playwright/test";
test("admin drafts, persistent global panel, close, reload and ending", async ({
  page,
  request,
}, info) => {
  await page.goto("/admin/signals");
  await expect(
    page.getByRole("heading", { name: "ACCESS DENIED" }),
  ).toBeVisible();
  await page.goto("/auth?mode=access");
  await page.getByLabel("Email").fill("inviter@example.invalid");
  await page.getByRole("button", { name: "Email me an access link" }).click();
  await expect(page.getByRole("status")).toContainText("secure link");
  const { link } = await (
    await request.get(
      "http://127.0.0.1:54330/__test/mail?email=inviter@example.invalid",
    )
  ).json();
  await page.goto(link);
  await page.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }).click();
  await expect(
    page.getByRole("heading", { name: "WELCOME BACK" }),
  ).toBeVisible();
  await page.goto("/admin/signals");
  await expect(
    page.getByRole("heading", { name: "NETWORK SIGNAL ADMINISTRATION" }),
  ).toBeVisible();
  await page
    .getByLabel("TITLE", { exact: true })
    .fill(
      (
        "Global update " +
        info.project.name +
        " — A carefully bounded announcement for our worldwide community"
      ).slice(0, 80),
    );
  await page
    .getByLabel("MESSAGE", { exact: true })
    .fill("A short global community update. ".repeat(20).slice(0, 500));
  if (info.project.name !== "mobile") {
    await page
      .getByLabel("LINK LABEL (optional)", { exact: true })
      .fill("READ UPDATE");
    await page
      .getByLabel("HTTPS LINK (optional)", { exact: true })
      .fill("https://example.com/update");
  }
  await page.getByRole("button", { name: "SAVE DRAFT", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("DRAFT SAVED");
  await page.getByRole("button", { name: "PREVIEW", exact: true }).click();
  await expect(page.getByLabel("Signal preview")).toBeVisible();
  await page.getByRole("button", { name: "PUBLISH SAVED DRAFT" }).click();
  await expect(page.getByRole("status")).toHaveText("Signal updated.");
  await page.evaluate(() => {
    localStorage.setItem("atomic-bond:signal:legacy", "dismissed");
    sessionStorage.setItem("atomic-bond:signal:legacy", "dismissed");
    localStorage.setItem("unrelated-test-preference", "preserved");
  });
  await page.goto("/explore");
  const panel = page.getByRole("region", {
    name: "Network Signal",
    exact: true,
  });
  await expect(panel).toContainText("Global update");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const layout = await page.evaluate(() => {
    const overview = document
      .querySelector(".network-now-toggle")!
      .getBoundingClientRect();
    const signal = document
      .querySelector(".signal-panel > button")!
      .getBoundingClientRect();
    const primary = document
      .querySelector(".primary-actions")!
      .getBoundingClientRect();
    return {
      aligned: Math.abs(signal.top - overview.top) < 2,
      separate: overview.right < signal.left,
      above: signal.bottom <= primary.top,
    };
  });
  expect(layout).toEqual({ aligned: true, separate: true, above: true });
  await page.screenshot({
    path: info.outputPath("network-signal-compact.png"),
    fullPage: true,
  });
  // Fail the Signal request without triggering the app's separate offline page.
  await page.route("**/explore", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(panel).toContainText("SIGNAL UNAVAILABLE");
  await page.unroute("**/explore");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(panel).toContainText("Global update");
  await panel.getByRole("button").click();
  const signalWidth = await page
    .locator(".signal-details")
    .evaluate((el) => el.getBoundingClientRect().width);
  await expect(
    page.getByRole("region", { name: "Network Signal details" }),
  ).toBeVisible();
  const signalStyle = await page.locator(".signal-details").evaluate((el) => {
    const heading = getComputedStyle(el.querySelector("h2")!);
    const close = getComputedStyle(el.querySelector("header button")!);
    return [
      heading.fontSize,
      heading.letterSpacing,
      close.width,
      close.height,
      close.fontSize,
      close.borderRadius,
      getComputedStyle(el).fontSize,
    ];
  });
  await page.screenshot({
    path: info.outputPath("network-signal.png"),
    fullPage: true,
  });
  await expect(page.getByRole("button", { name: /DISMISS/i })).toHaveCount(0);
  await page.getByRole("button", { name: "Close Network Signal" }).click();
  await expect(
    page.getByRole("region", { name: "Network Signal details" }),
  ).toHaveCount(0);
  await expect(panel).toContainText("Global update");
  await page.getByRole("button", { name: /^YOUR NETWORK OVERVIEW/ }).click();
  const overview = page.getByRole("region", {
    name: "Your Network Overview details",
  });
  await expect(overview).toBeVisible();
  expect(
    await overview.evaluate((el) => el.getBoundingClientRect().width),
  ).toBe(signalWidth);
  await expect(page.locator(".network-now-toggle strong").first()).toHaveText(
    "YOUR NETWORK OVERVIEW",
  );
  expect(
    await overview.evaluate((el) => {
      const heading = getComputedStyle(el.querySelector("h2")!);
      const close = getComputedStyle(el.querySelector("header button")!);
      return [
        heading.fontSize,
        heading.letterSpacing,
        close.width,
        close.height,
        close.fontSize,
        close.borderRadius,
        getComputedStyle(el).fontSize,
      ];
    }),
  ).toEqual(signalStyle);
  await page.screenshot({
    path: info.outputPath("network-overview.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Close Your Network Overview" })
    .click();
  expect(
    await page.evaluate(() =>
      [...Object.keys(localStorage), ...Object.keys(sessionStorage)].filter(
        (key) => key.startsWith("atomic-bond:signal:"),
      ),
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("unrelated-test-preference"),
    ),
  ).toBe("preserved");
  await page.reload();
  await expect(panel).toContainText("Global update");
  await page.goto("/about");
  await page.goto("/explore");
  await expect(panel).toContainText("Global update");
  await expect(page.getByText("SIGNAL DISMISSED", { exact: true })).toHaveCount(
    0,
  );
  await page.goto("/admin/signals");
  await page.getByLabel("TITLE", { exact: true }).fill("Replacement Signal");
  await page
    .getByLabel("MESSAGE", { exact: true })
    .fill("An administrator changed the global message.");
  await page.getByRole("button", { name: "SAVE DRAFT", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("DRAFT SAVED");
  await page.getByRole("button", { name: "PREVIEW", exact: true }).click();
  await page.getByRole("button", { name: "PUBLISH SAVED DRAFT" }).click();
  await expect(page.getByRole("status")).toContainText("Operation rejected");
  await page
    .getByRole("checkbox", { name: /Explicitly end and replace/ })
    .check();
  await page.getByRole("button", { name: "PUBLISH SAVED DRAFT" }).click();
  await expect(page.getByRole("status")).toHaveText("Signal updated.");
  await page.goto("/explore");
  await expect(panel).toContainText("Replacement Signal");
  await expect(panel).not.toContainText("Global update");
  await page.goto("/admin/signals");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "END / UNPUBLISH" }).click();
  await expect(page.getByRole("status")).toHaveText("Signal updated.");
  await page.goto("/explore");
  await expect(panel).toContainText("NO CURRENT SIGNAL");
});
