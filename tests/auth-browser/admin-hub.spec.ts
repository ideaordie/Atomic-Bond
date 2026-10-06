import { test, expect } from "@playwright/test";
import { selectHomeRegion } from "./home-region";
test("admin hub independent route gates, navigation and responsive tools", async ({
  page,
  request,
}, info) => {
  const routes = ["/admin", "/admin/network", "/admin/signals"];
  const denied = async () => {
    for (const route of routes) {
      await page.goto(route);
      await expect(
        page.getByRole("heading", { name: "ACCESS DENIED" }),
      ).toBeVisible();
    }
  };
  await denied();
  const verify = async (email: string) => {
    const { link } = await (
      await request.get(`http://127.0.0.1:54330/__test/mail?email=${email}`)
    ).json();
    await page.goto(link);
    await page.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }).click();
    await expect(
      page.getByRole("heading", { name: /WELCOME BACK|YOUR ATOM IS READY/ }),
    ).toBeVisible();
  };
  const email = `ordinary-admin-${info.project.name}@example.invalid`;
  await page.goto("/auth?mode=register");
  await page.getByLabel("Email").fill(email);
  await selectHomeRegion(page);
  await page
    .getByRole("button", { name: "Create my Atom", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("secure link");
  await verify(email);
  await denied();
  await page.context().clearCookies();
  await page.goto("/auth?mode=access");
  await page.getByLabel("Email").fill("inviter@example.invalid");
  await page.getByRole("button", { name: "Email me an access link" }).click();
  await expect(page.getByRole("status")).toContainText("secure link");
  await verify("inviter@example.invalid");
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "ADMIN", exact: true }),
  ).toBeVisible();
  const analytics = page.getByRole("link", { name: "OPEN ANALYTICS →" });
  await analytics.focus();
  await expect(analytics).toBeFocused();
  expect(
    await analytics.evaluate((el) => getComputedStyle(el).outlineStyle),
  ).not.toBe("none");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const cards = await page.locator(".admin-card").evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, bottom: r.bottom };
    }),
  );
  if (info.project.name === "mobile")
    expect(cards[1]!.y).toBeGreaterThan(cards[0]!.bottom);
  else expect(cards[1]!.y).toBe(cards[0]!.y);
  await page.screenshot({
    path: info.outputPath("admin-hub.png"),
    fullPage: true,
  });
  await analytics.press("Enter");
  await expect(page).toHaveURL(/\/admin\/network$/);
  await expect(
    page.getByRole("heading", { name: "CURRENT STRUCTURE" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Formation and merge history is unavailable/),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("admin-network.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "← ADMIN HOME" }).click();
  await page.getByRole("link", { name: "MANAGE SIGNALS →" }).click();
  await expect(
    page.getByRole("heading", { name: "NETWORK SIGNAL ADMINISTRATION" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "← ADMIN HOME" }).click();
  await page.getByRole("link", { name: "RETURN TO MY ATOM" }).click();
  await expect(page.getByText("MY ATOM #1", { exact: true })).toBeVisible();
  await page.goto("/owner");
  await page
    .getByRole("button", { name: "DEACTIVATE ACCOUNT", exact: true })
    .click();
  await page.getByRole("button", { name: "CONFIRM DEACTIVATION" }).click();
  await expect(
    page.getByRole("heading", { name: "ATOM DEACTIVATED" }),
  ).toBeVisible();
  await page.goto("/auth?mode=access");
  await page.getByLabel("Email").fill("inviter@example.invalid");
  await page.getByRole("button", { name: "Email me an access link" }).click();
  await expect(page.getByRole("status")).toContainText("secure link");
  await verify("inviter@example.invalid");
  await denied();
  await page.goto("/account/reactivate");
  await page
    .getByRole("button", { name: "REACTIVATE MY ATOM", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "ATOM REACTIVATED" }),
  ).toBeVisible();
});
