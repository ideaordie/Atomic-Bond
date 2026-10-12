import { test, expect } from "@playwright/test";
import { selectHomeRegion } from "../auth-browser/home-region";
test("production owner-session route publishes, reports and removes without fixture authority", async ({
  page,
  request,
}, info) => {
  await page.goto("/doodle");
  await expect(
    page.getByRole("heading", { name: "ACTIVE ATOM ACCESS REQUIRED" }),
  ).toBeVisible();
  await page.goto("/global-doodle");
  await expect(
    page.getByRole("heading", { name: "ACTIVE ATOM ACCESS REQUIRED" }),
  ).toBeVisible();
  const email = `doodle-${info.project.name}@example.invalid`;
  await page.goto("/auth?mode=register");
  await page.getByLabel("Email").fill(email);
  await selectHomeRegion(page);
  await page
    .getByRole("button", { name: "Create my Atom", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("secure link");
  const { link } = await (
    await request.get(`http://127.0.0.1:54330/__test/mail?email=${email}`)
  ).json();
  await page.goto(link);
  await page.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }).click();
  await expect(
    page.getByRole("heading", { name: /YOUR ATOM IS READY/ }),
  ).toBeVisible();
  await page.goto("/admin/doodle");
  await expect(
    page.getByRole("heading", { name: "ACCESS DENIED" }),
  ).toBeVisible();
  await page.goto("/explore");
  await page
    .getByRole("navigation", { name: "Application navigation" })
    .getByRole("link", { name: "SETTINGS", exact: true })
    .focus();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `artifacts/task123-owner-main-${info.project.name}.png`,
    fullPage: true,
  });
  await expect(
    page.getByRole("complementary", { name: "Global Doodle" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "GLOBAL DOODLE", exact: true }).click();
  await page.getByRole("link", { name: "CREATE DOODLE" }).click();
  await expect(page.getByText("LOCAL TEST CONTROLS")).toHaveCount(0);
  await expect(page.getByText("LOCAL SYNTHETIC", { exact: false })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("heading", { name: "MAKE YOUR MARK", exact: true }),
  ).toBeVisible();
  await page.getByTestId("doodle-editor").focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "SEND", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "DOODLE PUBLISHED" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "DRAW ANOTHER" }),
  ).toBeDisabled();
  await page.screenshot({
    path: `artifacts/doodle-owner-${info.project.name}.png`,
    fullPage: true,
  });
  const fake = await page.request.post("/api/doodle", {
    headers: { Origin: "http://127.0.0.1:3104" },
    data: { actor: 0, action: "pause", args: [true] },
  });
  expect(fake.status()).toBe(403);
  await page.context().clearCookies();
  await page.goto("/auth?mode=access");
  await page.getByLabel("Email").fill("inviter@example.invalid");
  await page.getByRole("button", { name: "Email me an access link" }).click();
  await expect(page.getByRole("status")).toContainText("secure link");
  const auth = await (
    await request.get(
      "http://127.0.0.1:54330/__test/mail?email=inviter@example.invalid",
    )
  ).json();
  await page.goto(auth.link);
  await page.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }).click();
  await expect(
    page.getByRole("heading", { name: "WELCOME BACK" }),
  ).toBeVisible();
  await page.goto("/explore");
  await expect(
    page.getByRole("complementary", { name: "Global Doodle" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "GLOBAL DOODLE", exact: true }).click();
  const feed = page.getByRole("complementary", { name: "Global Doodle" });
  await feed.scrollIntoViewIfNeeded();
  await feed.getByRole("button", { name: /APPRECIATE/ }).click();
  await expect(feed.getByRole("button", { name: /APPRECIATE/ })).toBeDisabled();
  await feed.getByText("REPORT", { exact: true }).click();
  await feed.getByRole("combobox").selectOption("ABUSE");
  await feed.getByRole("button", { name: "SEND REPORT" }).click();
  await page.goto("/admin");
  await page.getByRole("link", { name: "MODERATE DOODLES →" }).click();
  await expect(
    page.getByRole("heading", { name: "PRIVATE MODERATION QUEUE" }),
  ).toBeVisible();
  await page.getByLabel("MODERATION VIEW").selectOption("REPORTED");
  await page
    .getByRole("button", { name: "REVIEW PUBLISHED", exact: true })
    .click();
  await page
    .getByRole("button", { name: "REMOVE DRAWING", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Moderation history" }),
  ).toContainText("REMOVED");
  await page.getByRole("button", { name: "PAUSE NEW SUBMISSIONS" }).click();
  await expect(
    page.getByRole("button", { name: "RESUME SUBMISSIONS" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "RESUME SUBMISSIONS" }).click();
  await page.goto("/explore");
  await expect(
    page.getByRole("complementary", { name: "Global Doodle" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "GLOBAL DOODLE", exact: true }).click();
  await page
    .getByRole("complementary", { name: "Global Doodle" })
    .scrollIntoViewIfNeeded();
  await expect(page.locator(".doodle-feed-scroll article")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
