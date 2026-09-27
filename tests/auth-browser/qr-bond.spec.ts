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
  await page.getByLabel("Home region").selectOption({ index: 1 });
  await page
    .getByRole("button", { name: "Create my Atom", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("secure link");
  const { link } = await (
    await request.get(`http://127.0.0.1:54330/__test/mail?email=${email}`)
  ).json();
  await page.goto(link);
  await page.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }).click();
  await expect(page.getByRole("heading")).toHaveText("YOUR ATOM IS READY");
  const number = (
    await page.locator(".auth-panel p").first().innerText()
  ).replace("ATOM #", "");
  await page.goto("/explore");
  return number;
}
async function invitation(page: Page) {
  await page.getByRole("button", { name: "CREATE BOND", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "CREATE BOND", exact: true });
  await expect(dialog.getByRole("timer")).toContainText(
    "Invitation expires in:",
  );
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
  await page.getByRole("button", { name: /YOUR NETWORK NOW/ }).click();
  const empty = page.getByRole("region", { name: "Your Network Now details" });
  await expect(empty).toContainText("0 active Pulses");
  await expect(empty).toContainText("1 connected Atom");
  await expect(empty).toContainText("No active Pulses right now");
  await expect(empty.locator("li")).toHaveCount(8);
  await page.getByRole("button", { name: "Close Your Network Now" }).click();
  await page.screenshot({
    path: info.outputPath("small-no-pulses.png"),
    fullPage: true,
  });
  const original = await invitation(page);
  const qrBox = await original.dialog.getByRole("img").boundingBox();
  expect(qrBox!.width).toBeGreaterThanOrEqual(250);
  await expect(original.dialog.getByText(/other person scan/)).toBeVisible();
  await expect(
    original.dialog.getByText(/Keep this screen open/),
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
  await expect(page.getByRole("button", { name: "CONFIRM BOND" })).toHaveCount(
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
    receiver.getByRole("button", { name: "CONFIRM BOND" }),
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
  await receiver.getByRole("link", { name: "DECLINE", exact: true }).click();
  await expect(receiver.getByTestId("reachable-count")).toHaveText("1");
  expect(
    await (await request.get("http://127.0.0.1:54330/__test/counts")).json(),
  ).toEqual(before);
  await receiver.goto(original.url);
  await receiver
    .getByRole("button", { name: "CONFIRM BOND", exact: true })
    .click();
  await expect(
    receiver.getByText("BOND CREATED", { exact: true }),
  ).toBeVisible();
  await expect(receiver.getByTestId("selected-atom")).toHaveText(`#${second}`);
  await expect(receiver.getByTestId("reachable-count")).toHaveText("2");
  await expect(page.getByTestId("reachable-count")).toHaveText("2", {
    timeout: 65000,
  });
  await expect(page.getByText("BOND CREATED", { exact: true })).toBeVisible();
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
  await receiver.getByRole("button", { name: /YOUR NETWORK NOW/ }).click();
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
      .getByRole("region", { name: "Your Network Now details" })
      .getByRole("listitem")
      .filter({ hasText: "Curious" }),
  ).toContainText("100.0%");
  await receiver
    .getByRole("button", { name: "Close Your Network Now" })
    .click();
  await receiver.screenshot({
    path: info.outputPath("living-small-emotional.png"),
    fullPage: true,
  });
  await receiver.getByRole("button", { name: "Explore Atoms" }).click();
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
    visitor.getByRole("button", { name: /YOUR NETWORK NOW/ }),
  ).toHaveCount(0);
  await expect(visitor.getByTestId("atom-canvas")).toHaveAttribute(
    "data-emotional-view",
    "structural",
  );
  await visitor.getByRole("button", { name: "Explore Atoms" }).click();
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
  await receiver.reload();
  await expect(
    receiver.getByRole("heading", { name: "Invitation unavailable" }),
  ).toBeVisible();
  const expiring = await invitation(page);
  await page.clock.install();
  await page.clock.fastForward(301000);
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
