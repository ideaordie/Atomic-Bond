import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { selectHomeRegion } from "./home-region";
const fixture = "http://127.0.0.1:54330";
const endpoint = "/auth/register/invitation/confirm";
const origin = "http://127.0.0.1:3104";
const receiptName = "ab-registration-invitation";
const bannerText = "YOUR NETWORK HAS BEGUN";
async function counts(request: APIRequestContext) {
  return (await request.get(`${fixture}/__test/counts`)).json();
}
async function ready(page: Page, request: APIRequestContext) {
  const invite = await (await request.get(`${fixture}/__test/invite`)).json();
  const email = `success-${crypto.randomUUID()}@example.invalid`;
  await page.goto(
    `/auth?mode=register&next=${encodeURIComponent(`/bond/${invite.token}`)}`,
  );
  await page.getByLabel("Email").fill(email);
  await selectHomeRegion(page);
  await page
    .getByRole("button", { name: "Create my Atom", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("secure link");
  const { link } = await (
    await request.get(`${fixture}/__test/mail?email=${email}`)
  ).json();
  await page.goto(link);
  await page.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }).click();
  await expect(page.getByRole("button", { name: "ACCEPT BOND" })).toBeVisible();
  return invite;
}

test("receipt is cleared before the full success window; slow confirmation and duplicate clicks create one Bond", async ({
  page,
  request,
}, info) => {
  await ready(page, request);
  const before = await counts(request);
  const oldCookies = (await page.context().cookies())
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let accepted = false,
    calls = 0;
  await page.route(`**${endpoint}`, async (route) => {
    calls++;
    const response = await route.fetch();
    expect(response.headers()["cache-control"]).toBe("private, no-store");
    accepted = true;
    await gate;
    await route.fulfill({ response });
  });
  try {
    await page
      .getByRole("button", { name: "ACCEPT BOND" })
      .evaluate((button) => {
        (button as HTMLButtonElement).click();
        (button as HTMLButtonElement).click();
      });
    await expect.poll(() => accepted).toBe(true);
    await expect(
      page.getByRole("button", { name: "Confirming Bond…" }),
    ).toBeDisabled();
    await expect(page.getByText(bannerText, { exact: true })).toHaveCount(0);
    expect((await counts(request)).bonds).toBe(before.bonds + 1);
    release();
    await expect(page.getByText(bannerText, { exact: true })).toBeVisible();
    await expect(page.getByText(bannerText, { exact: true })).toBeInViewport();
    expect(calls).toBe(1);
    expect(
      (await page.context().cookies()).some((c) => c.name === receiptName),
    ).toBe(false);
    // Even a captured pre-acceptance cookie cannot redeem the consumed invitation.
    const replay = await request.post(origin + endpoint, {
      headers: { origin, cookie: oldCookies },
    });
    expect((await replay.json()).next).toBeUndefined();
    expect((await counts(request)).bonds).toBe(before.bonds + 1);
    const atom = await page.getByTestId("selected-atom").innerText();
    await page.clock.runFor(2799);
    await expect(page.getByText(bannerText, { exact: true })).toBeVisible();
    await expect(page.getByText(bannerText, { exact: true })).toBeInViewport();
    await page.screenshot({ path: info.outputPath("success-at-2799ms.png") });
    const navigation = page.waitForRequest(
      (request) =>
        request.isNavigationRequest() &&
        new URL(request.url()).pathname === "/explore",
    );
    await page.clock.runFor(1);
    await navigation;
    await page.clock.resume();
    await expect(
      page.getByRole("navigation", { name: "Application navigation" }),
    ).toBeVisible();
    await expect(page.getByText(bannerText, { exact: true })).toHaveCount(0);
    await expect(page.getByTestId("selected-atom")).toHaveText(atom);
    await expect(
      page.getByRole("heading", { name: "TAKE YOUR ATOM WITH YOU" }),
    ).toBeVisible();
    await expect(
      page.getByText("confirmed connections", { exact: true }),
    ).toBeVisible();
    expect((await counts(request)).bonds).toBe(before.bonds + 1);
  } finally {
    release();
  }
});

test("reload during success cannot restore the consumed receipt or repeat acceptance", async ({
  page,
  request,
}) => {
  await ready(page, request);
  const before = await counts(request);
  await page.getByRole("button", { name: "ACCEPT BOND" }).click();
  await expect(page.getByText(bannerText, { exact: true })).toBeVisible();
  const atom = await page.getByTestId("selected-atom").innerText();
  await page.reload();
  await expect(page.getByTestId("selected-atom")).toHaveText(atom);
  await expect(page.getByText(bannerText, { exact: true })).toHaveCount(0);
  const replay = await page.request.post(origin + endpoint, {
    headers: { origin },
  });
  expect((await replay.json()).next).toBeUndefined();
  await page.goto("/auth/register/invitation");
  await expect(page).toHaveURL("/explore");
  expect((await counts(request)).bonds).toBe(before.bonds + 1);
});

for (const state of ["expired", "cancelled"] as const)
  test(`${state} invitation cannot display success`, async ({
    page,
    request,
  }) => {
    const invite = await ready(page, request);
    const before = await counts(request);
    await request.get(
      state === "expired"
        ? `${fixture}/__test/expire-invites`
        : `${fixture}/__test/cancel-invitation?id=${invite.id}`,
    );
    await page.getByRole("button", { name: "ACCEPT BOND" }).click();
    await expect(page.locator(".auth-panel").getByRole("alert")).toContainText(
      "could not be confirmed",
    );
    await expect(page.getByText(bannerText, { exact: true })).toHaveCount(0);
    expect((await counts(request)).bonds).toBe(before.bonds);
  });

test("NOT NOW, missing session and foreign origin cannot confirm a Bond", async ({
  page,
  request,
}) => {
  const anonymous = await request.post(origin + endpoint, {
    headers: { origin },
  });
  expect((await anonymous.json()).next).toBeUndefined();
  await ready(page, request);
  const before = await counts(request);
  const forbidden = await page.request.post(origin + endpoint, {
    headers: { origin: "https://other.example.invalid" },
  });
  expect(forbidden.status()).toBe(400);
  await page.getByRole("button", { name: "NOT NOW", exact: true }).click();
  await expect(page).toHaveURL("/explore");
  await expect(page.getByTestId("selected-atom")).toBeVisible();
  await expect(page.getByText(bannerText, { exact: true })).toHaveCount(0);
  expect((await counts(request)).bonds).toBe(before.bonds);
});

test("lost success response preserves the committed Bond and cannot replay acceptance", async ({
  page,
  request,
}) => {
  await ready(page, request);
  const before = await counts(request);
  await page.route(`**${endpoint}`, async (route) => {
    const response = await route.fetch();
    expect((await response.json()).next).toBe("/explore");
    await route.abort("failed");
  });
  await page.getByRole("button", { name: "ACCEPT BOND" }).click();
  await expect(page.locator(".auth-panel").getByRole("alert")).toContainText(
    "Unable to confirm",
  );
  await expect(page.getByText(bannerText, { exact: true })).toHaveCount(0);
  await page.goto("/explore");
  await expect(page.getByTestId("selected-atom")).toBeVisible();
  await expect(
    page.getByText("confirmed connections", { exact: true }),
  ).toBeVisible();
  const replay = await page.request.post(origin + endpoint, {
    headers: { origin },
  });
  expect((await replay.json()).next).toBeUndefined();
  expect((await counts(request)).bonds).toBe(before.bonds + 1);
});
