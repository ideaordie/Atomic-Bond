import { selectHomeRegion } from "./home-region";
import {
  expect,
  test,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import jsQR from "jsqr";
import { PNG } from "pngjs";

async function register(page: Page, request: APIRequestContext, email: string) {
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
    page.getByRole("heading", { name: "YOUR ATOM IS READY", exact: true }),
  ).toBeVisible();
  const number = (
    await page.locator(".auth-panel p").first().innerText()
  ).replace("ATOM #", "");
  await page.goto("/explore");
  return number;
}
async function invitation(page: Page) {
  await page
    .getByRole("button", { name: /^CREATE (YOUR FIRST )?BOND$/ })
    .click();
  const dialog = page.getByRole("dialog", {
    name: /^CREATE (YOUR FIRST )?BOND$/,
  });
  await dialog.getByRole("button", { name: /TOGETHER IN PERSON/ }).click();
  await expect(dialog.getByRole("timer")).toContainText(
    "Invitation expires in:",
  );
  await expect(
    dialog.getByText("INVITATION VALID FOR 24 HOURS", { exact: true }),
  ).toBeVisible();
  const src = await dialog.getByRole("img").getAttribute("src");
  const png = PNG.sync.read(Buffer.from(src!.split(",")[1]!, "base64"));
  const qr = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  if (!qr) throw new Error("QR could not be decoded");
  const url = new URL(qr.data);
  expect(url.origin).toBe("http://127.0.0.1:3104");
  expect(/^\/bond\/[a-f0-9]{64}$/.test(url.pathname)).toBe(true);
  expect(url.search + url.hash).toBe("");
  return { dialog, url: qr.data, src };
}
test("first invitation cancellation and expiry preserve the genuine zero-Bond state", async ({
  page,
  request,
}, info) => {
  await register(
    page,
    request,
    `first-expiry-${info.project.name}@example.invalid`,
  );
  const before = await (
    await request.get("http://127.0.0.1:54330/__test/counts")
  ).json();
  const cancelled = await invitation(page);
  await cancelled.dialog
    .getByRole("button", { name: "CANCEL INVITATION" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "CREATE YOUR FIRST BOND", exact: true }),
  ).toBeVisible();
  const expired = await invitation(page);
  expect(expired.url).not.toBe(cancelled.url);
  await page.clock.install();
  await page.clock.fastForward(86401000);
  await expect(
    expired.dialog.getByText(
      "Waiting for their confirmation. No Bond has been created yet.",
    ),
  ).toHaveCount(0);
  await expect(expired.dialog.getByRole("img")).toHaveCount(0);
  await expired.dialog
    .getByRole("button", { name: "Back to CREATE BOND" })
    .click();
  await expect(page.getByTestId("atom-canvas")).toHaveAttribute(
    "data-invitation-markers",
    "4 decorative",
  );
  await expect(page.getByTestId("reachable-count")).toHaveText("1");
  expect(
    await (await request.get("http://127.0.0.1:54330/__test/counts")).json(),
  ).toEqual(before);
});
test("real QR transport, isolated recipients, consent, reciprocal graph, reuse and connected Pulse", async ({
  page,
  browser,
  request,
}, info) => {
  test.setTimeout(120000);
  const first = await register(
    page,
    request,
    `qr-a-${info.project.name}@example.invalid`,
  );
  await expect(page.getByTestId("reachable-count")).toHaveText("1");
  await expect(
    page.getByText("YOUR ATOM IS READY", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("atom-canvas")).toHaveAttribute(
    "data-invitation-markers",
    "4 decorative",
  );
  await expect(
    page.getByRole("button", { name: "CREATE YOUR FIRST BOND", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Select an Atom", { exact: true }).locator("option"),
  ).toHaveCount(2);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByTestId("atom-canvas")).toHaveAttribute(
    "data-motion",
    "still",
  );
  await expect(page.getByTestId("atom-canvas")).toHaveAttribute(
    "data-invitation-markers",
    "4 decorative",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const publicPage = await browser.newPage();
  await publicPage.goto(`http://127.0.0.1:3104/a/${first}`);
  await expect(publicPage.getByTestId("atom-canvas")).toHaveAttribute(
    "data-invitation-markers",
    "none",
  );
  await expect(
    publicPage.getByText("YOUR ATOM IS READY", { exact: true }),
  ).toHaveCount(0);
  await publicPage.close();
  await page.getByRole("button", { name: /YOUR NETWORK OVERVIEW/ }).click();
  const empty = page.getByRole("region", {
    name: "Your Network Overview details",
  });
  await expect(empty).toContainText("0 active Pulses");
  await expect(empty).toContainText("1 connected Atom");
  await expect(empty).toContainText("No active Pulses right now");
  await expect(empty.locator("li")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Close Your Network Overview" })
    .click();
  await page.screenshot({
    path: info.outputPath("small-no-pulses.png"),
    fullPage: true,
  });
  const original = await invitation(page);
  const qrBox = await original.dialog.getByRole("img").boundingBox();
  expect(qrBox!.width).toBeGreaterThanOrEqual(250);
  await expect(
    original.dialog.getByText(/Ask someone you're with to scan/),
  ).toBeVisible();
  await expect(
    original.dialog.getByText(/their own Atom, then confirm/),
  ).toBeVisible();
  await expect(
    original.dialog.getByText(
      "Waiting for their confirmation. No Bond has been created yet.",
    ),
  ).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  const qrImage = original.dialog.getByRole("img");
  await qrImage.scrollIntoViewIfNeeded();
  expect(
    await qrImage.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return [
        [r.left + 2, r.top + 2],
        [r.right - 2, r.bottom - 2],
        [r.left + r.width / 2, r.top + r.height / 2],
      ].every(([x, y]) => document.elementFromPoint(x!, y!) === el);
    }),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("qr-landscape-redacted.png"),
    mask: [qrImage],
    fullPage: true,
  });
  await page.setViewportSize(info.project.use.viewport!);
  await page.screenshot({
    path: info.outputPath("qr-layout-redacted.png"),
    mask: [original.dialog.getByRole("img")],
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await original.dialog
    .getByRole("button", { name: "Close invitation" })
    .click();
  const reused = await invitation(page);
  expect(reused.src === original.src).toBe(true);
  await reused.dialog.getByRole("button", { name: "Close invitation" }).click();
  await page.goto(original.url);
  await expect(page.getByText(/This is your invitation/)).toBeVisible();
  await expect(page.getByRole("button", { name: "ACCEPT BOND" })).toHaveCount(
    0,
  );
  await page.goto("/explore");
  const isolated = await browser.newContext({
    viewport: info.project.use.viewport ?? { width: 390, height: 844 },
  });
  const receiver = await isolated.newPage();
  // Install before the application creates reconciliation/expiry timers.
  await receiver.clock.install();
  await receiver.goto(original.url);
  await expect(
    receiver.getByRole("link", { name: "CREATE MY ATOM", exact: true }),
  ).toBeVisible();
  await expect(
    receiver.getByRole("button", { name: "ACCEPT BOND" }),
  ).toHaveCount(0);
  const second = await register(
    receiver,
    request,
    `qr-b-${info.project.name}@example.invalid`,
  );
  expect(second === first).toBe(false);
  await receiver.goto(original.url);
  const before = await (
    await request.get("http://127.0.0.1:54330/__test/counts")
  ).json();
  await receiver.getByRole("link", { name: "NOT NOW", exact: true }).click();
  await expect(receiver.getByTestId("reachable-count")).toHaveText("1");
  expect(
    await (await request.get("http://127.0.0.1:54330/__test/counts")).json(),
  ).toEqual(before);
  await receiver.goto(original.url);
  await receiver
    .getByRole("button", { name: "ACCEPT BOND", exact: true })
    .click();
  await expect(
    receiver.getByText("YOUR NETWORK HAS BEGUN", { exact: true }),
  ).toBeVisible();
  await expect(receiver.getByTestId("selected-atom")).toHaveText(`#${second}`);
  await expect(receiver.getByTestId("reachable-count")).toHaveText("2");
  await expect(page.getByTestId("reachable-count")).toHaveText("2", {
    timeout: 65000,
  });
  await expect(
    page.getByText("YOUR NETWORK HAS BEGUN", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("atom-canvas")).toHaveAttribute(
    "data-invitation-markers",
    "none",
  );
  await expect(
    page.getByText("YOUR ATOM IS READY", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "CREATE BOND", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("first-bond-confirmed.png"),
    fullPage: true,
  });
  await expect(
    page.getByText("YOUR NETWORK HAS BEGUN", { exact: true }),
  ).toHaveCount(0, { timeout: 5000 });
  const after = await (
    await request.get("http://127.0.0.1:54330/__test/counts")
  ).json();
  expect(after.bonds - before.bonds).toBe(1);
  await page.getByRole("button", { name: "Pulse", exact: true }).click();
  await page.getByRole("radio", { name: "Curious", exact: true }).check();
  await page.getByRole("button", { name: "Send Pulse", exact: true }).click();
  await expect(page.getByTestId("own-pulse")).toContainText("Curious");
  // Reconciliation must reveal the other owner’s Pulse without navigation.
  await receiver.bringToFront();
  await receiver.getByRole("button", { name: /YOUR NETWORK OVERVIEW/ }).click();
  // Browser time is controlled; server requests remain real asynchronous work.
  await expect
    .poll(
      async () => {
        await receiver.clock.fastForward(30_000);
        return receiver.getByTestId("active-pulse-count").innerText();
      },
      { timeout: 15000 },
    )
    .toContain("1 active Pulse");
  await expect(
    receiver
      .getByRole("region", { name: "Your Network Overview details" })
      .getByRole("listitem")
      .filter({ hasText: "Curious" }),
  ).toContainText("100.0%");
  await receiver
    .getByRole("button", { name: "Close Your Network Overview" })
    .click();
  await receiver.screenshot({
    path: info.outputPath("living-small-emotional.png"),
    fullPage: true,
  });
  await receiver.getByLabel("Select an Atom", { exact: true }).focus();
  await receiver
    .getByLabel("Select an Atom", { exact: true })
    .selectOption(first);
  await expect(receiver.getByTestId("current-pulse")).toContainText("Curious");
  await receiver.getByRole("button", { name: "View their network" }).click();
  await expect(receiver.getByTestId("selected-atom")).toHaveText(`#${first}`);
  await expect(receiver.getByTestId("active-pulse-count")).toContainText(
    "1 active Pulse",
  );
  await receiver.getByRole("button", { name: "My Atom", exact: true }).click();
  await isolated.setOffline(true);
  await expect(receiver.getByTestId("active-pulse-count")).toContainText(
    "unavailable",
  );
  await isolated.setOffline(false);
  await expect
    .poll(
      async () => {
        await receiver.clock.fastForward(5000);
        return receiver.getByTestId("active-pulse-count").innerText();
      },
      { timeout: 15000 },
    )
    .toContain("1 active Pulse");
  const visitor = await browser.newPage({
    viewport: info.project.use.viewport ?? { width: 390, height: 844 },
  });
  await visitor.goto(`http://127.0.0.1:3104/a/${first}`);
  await expect(
    visitor.getByRole("button", { name: /YOUR NETWORK OVERVIEW/ }),
  ).toHaveCount(0);
  await expect(visitor.getByTestId("atom-canvas")).toHaveAttribute(
    "data-emotional-view",
    "structural",
  );
  await visitor.getByLabel("Select an Atom", { exact: true }).focus();
  await visitor
    .getByLabel("Select an Atom", { exact: true })
    .selectOption(first);
  await expect(visitor.getByTestId("current-pulse")).toHaveCount(0);
  await visitor.screenshot({
    path: info.outputPath("public-emotion-free.png"),
    fullPage: true,
  });
  await visitor.close();
  await receiver.goto(original.url);
  await expect(
    receiver.getByRole("heading", { name: "Invitation unavailable" }),
  ).toBeVisible();
  const next = await invitation(page);
  await receiver.goto(next.url);
  await expect(
    receiver.getByText("YOU ARE ALREADY BONDED", { exact: true }),
  ).toBeVisible();
  await next.dialog.getByRole("button", { name: "CANCEL INVITATION" }).click();
  await expect(next.dialog).not.toBeVisible();
  await receiver.reload();
  await expect(
    receiver.getByRole("heading", { name: "Invitation unavailable" }),
  ).toBeVisible();
  const expiring = await invitation(page);
  await page.clock.install();
  await page.clock.fastForward(86401000);
  await expect(expiring.dialog.getByRole("img")).toHaveCount(0);
  await expect(
    expiring.dialog.getByText(/THIS BOND INVITATION HAS EXPIRED/),
  ).toBeVisible();
  await request.get("http://127.0.0.1:54330/__test/expire-invites");
  await receiver.goto(expiring.url);
  await expect(
    receiver.getByText(/Ask the other person for a new Bond invitation/),
  ).toBeVisible();
  expect(
    await (await request.get("http://127.0.0.1:54330/__test/counts")).json(),
  ).toEqual(after);
  await isolated.close();
});

test("invitation paths defer creation, share privately, fall back to copy, and retain the deadline", async ({
  page,
  request,
}, info) => {
  await page.addInitScript(() => {
    const state = window as typeof window & {
      shared?: ShareData[];
      copied?: string;
      shareMode?: string;
      copyFails?: boolean;
    };
    state.shared = [];
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        state.shared!.push(data);
        if (state.shareMode === "cancel")
          throw new DOMException("Cancelled", "AbortError");
        if (state.shareMode === "fail")
          throw new DOMException("Blocked", "NotAllowedError");
      },
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          if (state.copyFails)
            throw new DOMException("Blocked", "NotAllowedError");
          state.copied = text;
        },
      },
    });
  });
  await register(page, request, `sharing-${info.project.name}@example.invalid`);
  const count = async () =>
    (
      await (
        await request.get("http://127.0.0.1:54330/__test/invitation-count")
      ).json()
    ).count as number;
  const before = await count();
  const snapshot = async () =>
    (await (
      await request.get("http://127.0.0.1:54330/__test/invitation-count")
    ).json()) as {
      count: number;
      latest: { id: string; createdAt: string; expiresAt: string };
    };
  await page
    .getByRole("button", { name: "CREATE YOUR FIRST BOND", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: /SEND TO SOMEONE/ }),
  ).toBeVisible();
  expect(await count()).toBe(before);
  await expect(dialog.getByRole("timer")).toHaveCount(0);
  await page.getByRole("button", { name: "Close invitation" }).click();
  expect(await count()).toBe(before);
  await page
    .getByRole("button", { name: "CREATE YOUR FIRST BOND", exact: true })
    .click();
  await dialog.getByRole("button", { name: /SEND TO SOMEONE/ }).click();
  await expect(
    dialog.getByRole("button", { name: "SEND INVITATION", exact: true }),
  ).toBeVisible();
  expect(await count()).toBe(before + 1);
  await expect(
    dialog.getByText("INVITATION VALID FOR 24 HOURS", { exact: true }),
  ).toBeVisible();
  const prepared = await snapshot();
  expect(
    Date.parse(prepared.latest.expiresAt) -
      Date.parse(prepared.latest.createdAt),
  ).toBe(86400000);
  await expect(dialog.getByRole("timer")).toContainText(
    /Invitation expires in: (24h 00m|23h 59m)/,
  );
  await expect(dialog.getByRole("img")).toHaveCount(0);
  const send = dialog.getByRole("button", {
    name: "SEND INVITATION",
    exact: true,
  });
  await expect(dialog.getByRole("timer")).toBeInViewport();
  const box = await send.boundingBox();
  expect(box!.y + box!.height).toBeLessThan(info.project.use.viewport!.height);
  await page.screenshot({
    path: info.outputPath("remote-invitation-light.png"),
    fullPage: true,
  });
  await page.evaluate(() => {
    document.documentElement.dataset.appearance = "dark";
  });
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "dark");
  await page.screenshot({
    path: info.outputPath("remote-invitation-dark.png"),
    fullPage: true,
  });
  await page.evaluate(() => {
    document.documentElement.dataset.appearance = "light";
  });
  await send.focus();
  await page.keyboard.press("Enter");
  await expect(dialog.getByRole("status")).toContainText(
    "Delivery is not confirmed",
  );
  const shared = await page.evaluate(
    () => (window as typeof window & { shared: ShareData[] }).shared,
  );
  expect(shared).toHaveLength(1);
  expect(shared[0]!.title).toBe("Connect on Atomic Bond");
  expect(shared[0]!.text).toContain("confirm our Bond");
  expect(shared[0]!.url).toMatch(
    /^http:\/\/127\.0\.0\.1:3104\/bond\/[a-f0-9]{64}$/,
  );
  await page.evaluate(() => {
    (window as typeof window & { shareMode: string }).shareMode = "cancel";
  });
  await send.click();
  await expect(dialog.getByRole("status")).toContainText("Sharing cancelled");
  expect(await snapshot()).toEqual(prepared);
  await page.getByRole("button", { name: "Close invitation" }).click();
  await page
    .getByRole("button", { name: "CREATE YOUR FIRST BOND", exact: true })
    .click();
  await expect(dialog.getByRole("timer")).toHaveCount(0);
  await dialog.getByRole("button", { name: /SEND TO SOMEONE/ }).click();
  await expect(send).toBeVisible();
  expect(await snapshot()).toEqual(prepared);
  await page.evaluate(() => {
    (window as typeof window & { shareMode: string }).shareMode = "fail";
  });
  await send.click();
  await expect(dialog.getByRole("status")).toContainText("Use COPY LINK");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    });
  });
  await send.click();
  await expect(dialog.getByRole("status")).toContainText(
    "unavailable in this browser",
  );
  await dialog.getByRole("button", { name: "COPY LINK", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText(
    "Nothing has been sent automatically",
  );
  expect(
    await page.evaluate(
      () => (window as typeof window & { copied: string }).copied,
    ),
  ).toBe(shared[0]!.url);
  await page.evaluate(() => {
    (window as typeof window & { copyFails: boolean }).copyFails = true;
  });
  await dialog.getByRole("button", { name: "COPY LINK", exact: true }).click();
  await expect(
    dialog.getByRole("textbox", { name: "Private invitation link" }),
  ).toHaveValue(shared[0]!.url!);
  await dialog.getByRole("button", { name: "SHOW QR CODE" }).click();
  await expect(dialog.getByRole("img")).toBeVisible();
  await expect(dialog.getByRole("textbox")).toHaveCount(0);
  expect(await count()).toBe(before + 1);
  await expect(dialog.getByRole("timer")).toContainText(
    "Invitation expires in:",
  );
  expect(await snapshot()).toEqual(prepared);
  await page.screenshot({
    path: info.outputPath("in-person-invitation-light.png"),
    // This QR points only to the isolated loopback fixture, never production.
    fullPage: true,
  });
  await expect(dialog.getByRole("timer")).toBeInViewport();
  await page.clock.install();
  await page.clock.fastForward(86401000);
  await expect(dialog.getByRole("img")).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "COPY LINK", exact: true }),
  ).toHaveCount(0);
  await expect(
    dialog.getByText("THIS BOND INVITATION HAS EXPIRED"),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Back to CREATE BOND" }).click();
  expect(await count()).toBe(before + 1);
  // Expire the synthetic database record too: client time is not authorization.
  await request.get("http://127.0.0.1:54330/__test/expire-invites");
  await page.clock.setFixedTime(new Date());
  await dialog.getByRole("button", { name: /TOGETHER IN PERSON/ }).click();
  await expect(dialog.getByRole("img")).toBeVisible();
  const replacement = await snapshot();
  expect(replacement.count).toBe(before + 2);
  expect(replacement.latest.id).not.toBe(prepared.latest.id);
  expect(
    Date.parse(replacement.latest.expiresAt) -
      Date.parse(replacement.latest.createdAt),
  ).toBe(86400000);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
