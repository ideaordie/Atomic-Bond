import { test, expect } from "@playwright/test";
test("admin drafts, preview, global panel, dismissal and ending", async ({
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
      aligned:
        innerWidth < 600
          ? signal.top >= overview.bottom
          : Math.abs(signal.top - overview.top) < 2,
      above: signal.bottom <= primary.top,
    };
  });
  expect(layout).toEqual({ aligned: true, above: true });
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
  await expect(
    page.getByRole("region", { name: "Network Signal details" }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("network-signal.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "DISMISS THIS SIGNAL" }).click();
  await page.reload();
  await expect(panel).toContainText("SIGNAL DISMISSED");
  await page.goto("/admin/signals");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "END / UNPUBLISH" }).click();
  await expect(page.getByRole("status")).toHaveText("Signal updated.");
  await page.goto("/explore");
  await expect(panel).toContainText("NO CURRENT SIGNAL");
});
