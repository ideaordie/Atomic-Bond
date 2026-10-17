import {
  expect,
  test,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { selectHomeRegion } from "./home-region";
const fixture = "http://127.0.0.1:54330";
async function prepare(page: Page, request: APIRequestContext) {
  const invite = await (await request.get(`${fixture}/__test/invite`)).json();
  const email = `new-${crypto.randomUUID()}@example.invalid`;
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
  expect(new URL(link).pathname).toBe("/auth/register/confirm");
  expect(new URL(link).search).toBe("");
  expect(link).not.toContain(invite.token);
  return { link: link as string, invite, email };
}

test.describe("verification navigation", () => {
  test.use({ serviceWorkers: "block" });
  test("a replacement email is read at click time and rapid duplicate clicks send one action", async ({
    page,
    request,
  }) => {
    const first = await prepare(page, request);
    const second = await prepare(page, request);
    await page.goto(first.link);
    await expect(
      page.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }),
    ).toBeVisible();
    const expectedToken = new URLSearchParams(
      new URL(second.link).hash.slice(1),
    ).get("token_hash")!;
    const submitted: string[] = [];
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/auth/register/confirm"
      )
        submitted.push(request.postData() || "");
    });
    await page.evaluate((hash) => {
      window.location.hash = hash;
      const button =
        document.querySelector<HTMLButtonElement>(".auth-panel button")!;
      button.click();
      button.click();
    }, new URL(second.link).hash);
    await expect(page).toHaveURL("/auth/register/invitation");
    expect(submitted.length).toBe(1);
    // Compare synthetic credentials without including them in assertion output.
    expect(submitted[0]?.includes(expectedToken)).toBe(true);
    await expect(
      page.getByRole("button", { name: "ACCEPT BOND" }),
    ).toBeVisible();
  });
  test("one verification click stays busy through slow action and destination navigation", async ({
    page,
    request,
  }) => {
    const { link } = await prepare(page, request);
    const before = await (await request.get(`${fixture}/__test/counts`)).json();
    await page.goto(link);
    await page.evaluate(() => {
      let busy = false;
      sessionStorage.removeItem("test-verification-reset");
      new MutationObserver(() => {
        const button =
          document.querySelector<HTMLButtonElement>(".auth-panel button");
        if (button?.textContent === "Verifying…") busy = true;
        if (busy && button && !button.disabled)
          sessionStorage.setItem("test-verification-reset", "yes");
      }).observe(document.body, {
        subtree: true,
        attributes: true,
        childList: true,
        characterData: true,
      });
    });
    let actions = 0;
    let releaseAction!: () => void;
    const actionDelay = new Promise<void>(
      (resolve) => (releaseAction = resolve),
    );
    await page.route("**/auth/register/confirm", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      actions++;
      const response = await route.fetch();
      await actionDelay;
      await route.fulfill({ response });
    });
    let destinationRequested = false;
    let releaseNavigation!: () => void;
    const navigationDelay = new Promise<void>(
      (resolve) => (releaseNavigation = resolve),
    );
    await page.route("**/auth/register/invitation", async (route) => {
      destinationRequested = true;
      await navigationDelay;
      await route.continue();
    });
    try {
      await page
        .getByRole("button", { name: "VERIFY / ACCESS MY ATOM" })
        .click();
      await expect.poll(() => actions).toBe(1);
      await expect(
        page.getByRole("button", { name: "Verifying…" }),
      ).toBeDisabled();
      // Force an immediate unrelated component update while verification is pending.
      await page.evaluate(() => window.dispatchEvent(new Event("hashchange")));
      await expect(
        page.getByRole("button", { name: "Verifying…" }),
      ).toBeDisabled();
      releaseAction();
      await expect.poll(() => destinationRequested).toBe(true);
      expect(actions).toBe(1);
      releaseNavigation();
      await expect(page).toHaveURL("/auth/register/invitation");
      expect(
        await page.evaluate(() =>
          sessionStorage.getItem("test-verification-reset"),
        ),
      ).toBeNull();
      await expect(
        page.getByRole("button", { name: "ACCEPT BOND" }),
      ).toBeVisible();
      expect(
        (await (await request.get(`${fixture}/__test/counts`)).json()).bonds,
      ).toBe(before.bonds);
      await page.getByRole("button", { name: "NOT NOW", exact: true }).click();
      await expect(page).toHaveURL("/explore");
    } finally {
      releaseAction();
      releaseNavigation();
    }
  });
});
test("same-browser registration, pre-verification reload, explicit consent and one Bond", async ({
  page,
  request,
}, info) => {
  const { link } = await prepare(page, request);
  const before = await (await request.get(`${fixture}/__test/counts`)).json();
  await page.goto(link);
  await page.reload();
  await expect(page.getByRole("button", { name: "ACCEPT BOND" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }).click();
  await expect(page).toHaveURL("/auth/register/invitation");
  await expect(
    page.getByRole("heading", { name: "YOU’VE BEEN INVITED TO BOND" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "ACCEPT BOND" })).toBeVisible();
  const activated = await (
    await request.get(`${fixture}/__test/counts`)
  ).json();
  expect(activated.bonds).toBe(before.bonds);
  for (const theme of ["dark", "light"]) {
    await page.evaluate(
      (value) =>
        document.documentElement.setAttribute("data-appearance", value),
      theme,
    );
    await page.screenshot({
      path: info.outputPath(`confirmation-${theme}.png`),
      fullPage: true,
    });
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "ACCEPT BOND" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/explore");
  await expect(page.getByTestId("selected-atom")).toBeVisible();
  const after = await (await request.get(`${fixture}/__test/counts`)).json();
  expect(after.bonds).toBe(before.bonds + 1);
  await page.goto(link);
  await page.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }).click();
  await expect(page).toHaveURL("/explore");
  expect(
    (await (await request.get(`${fixture}/__test/counts`)).json()).bonds,
  ).toBe(after.bonds);
});
test("fresh browser verification and NOT NOW preserve Atom without restaging on email replay", async ({
  page,
  request,
  browser,
}) => {
  const { link } = await prepare(page, request);
  const before = await (await request.get(`${fixture}/__test/counts`)).json();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });
  await context.addInitScript(() =>
    Object.defineProperty(navigator, "standalone", { value: true }),
  );
  const fresh = await context.newPage();
  await fresh.goto(link);
  await fresh.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }).click();
  await expect(fresh).toHaveURL("/auth/register/invitation");
  await expect(
    fresh.getByRole("dialog", { name: "TAKE YOUR ATOM WITH YOU" }),
  ).toHaveCount(0);
  await fresh.getByRole("button", { name: "NOT NOW", exact: true }).click();
  await expect(fresh).toHaveURL("/explore");
  await expect(fresh.getByTestId("selected-atom")).toBeVisible();
  expect(
    (await context.cookies()).some(
      (c) => c.name === "ab-registration-invitation",
    ),
  ).toBe(false);
  await fresh.goto(link);
  await fresh.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }).click();
  await expect(fresh).toHaveURL("/explore");
  expect(
    (await (await request.get(`${fixture}/__test/counts`)).json()).bonds,
  ).toBe(before.bonds);
  await context.close();
});
test("expired invitation does not prevent activation or permit confirmation", async ({
  page,
  request,
}) => {
  const { link } = await prepare(page, request);
  await request.get(`${fixture}/__test/expire-invites`);
  await page.goto(link);
  await page.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }).click();
  await expect(
    page.getByRole("heading", { name: "Invitation unavailable" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "ACCEPT BOND" })).toHaveCount(
    0,
  );
  await page.getByRole("link", { name: "MY ATOM", exact: true }).click();
  await expect(page.getByTestId("selected-atom")).toBeVisible();
});
for (const mode of ["missing", "modified", "substituted"] as const) {
  test(`${mode} optional receipt does not block verified Atom activation`, async ({
    page,
    request,
  }) => {
    const first = await prepare(page, request);
    const url = new URL(first.link),
      fragment = new URLSearchParams(url.hash.slice(1));
    if (mode === "missing") fragment.delete("receipt");
    else if (mode === "modified") fragment.set("receipt", "invalid");
    else {
      const other = await prepare(page, request);
      fragment.set(
        "receipt",
        new URLSearchParams(new URL(other.link).hash.slice(1)).get("receipt")!,
      );
    }
    url.hash = fragment.toString();
    await page.goto(url.href);
    await page.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }).click();
    await expect(page).toHaveURL("/explore");
    await expect(page.getByTestId("selected-atom")).toBeVisible();
    await expect(page.getByRole("button", { name: "ACCEPT BOND" })).toHaveCount(
      0,
    );
  });
}
test("verified registration recovery retains invitation through Home Region completion", async ({
  page,
  request,
}) => {
  const { link, email } = await prepare(page, request);
  await request.get(
    `${fixture}/__test/missing-registration-details?email=${email}`,
  );
  await page.goto(link);
  await page.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }).click();
  await expect(page).toHaveURL("/auth/register/details");
  await page.reload();
  await selectHomeRegion(page);
  await page
    .getByRole("button", { name: "Complete my Atom", exact: true })
    .click();
  await expect(page).toHaveURL("/auth/register/invitation");
  await expect(page.getByRole("button", { name: "ACCEPT BOND" })).toBeVisible();
});
test("cancelled invitation is unavailable after otherwise successful registration", async ({
  page,
  request,
}) => {
  const { link, invite } = await prepare(page, request);
  const cancelled = await request.get(
    `${fixture}/__test/cancel-invitation?id=${invite.id}`,
  );
  expect(cancelled.ok()).toBe(true);
  await page.goto(link);
  await page.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }).click();
  await expect(
    page.getByRole("heading", { name: "Invitation unavailable" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "MY ATOM", exact: true }).click();
  await expect(page.getByTestId("selected-atom")).toBeVisible();
});
test("expired registration email cannot activate an Atom", async ({
  page,
  request,
}) => {
  const { link } = await prepare(page, request);
  const before = await (await request.get(`${fixture}/__test/counts`)).json();
  await request.get(`${fixture}/__test/expire-access`);
  await page.goto(link);
  await page.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "invalid, expired, or already used",
  );
  expect(
    (await (await request.get(`${fixture}/__test/counts`)).json()).atoms,
  ).toBe(before.atoms);
});
test("a replacement signup email binds the receipt to its own verification attempt", async ({
  page,
  request,
}) => {
  const { email } = await prepare(page, request);
  await page
    .getByRole("button", { name: "Create my Atom", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("secure link");
  const { link } = await (
    await request.get(`${fixture}/__test/mail?email=${email}`)
  ).json();
  await page.goto(link);
  await page.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }).click();
  await expect(page).toHaveURL("/auth/register/invitation");
});
