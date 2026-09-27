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
  await expect(dialog.getByRole("timer")).toContainText("Expires in:");
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
  test.setTimeout(60000);
  const first = await register(
    page,
    request,
    `qr-a-${info.project.name}@example.invalid`,
  );
  await expect(page.getByTestId("reachable-count")).toHaveText("1");
  const original = await invitation(page);
  const qrBox = await original.dialog.getByRole("img").boundingBox();
  expect(qrBox!.width).toBeGreaterThanOrEqual(250);
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
    timeout: 15000,
  });
  await expect(page.getByText("BOND CREATED", { exact: true })).toBeVisible();
  const after = await (
    await request.get("http://127.0.0.1:54330/__test/counts")
  ).json();
  expect(after.bonds - before.bonds).toBe(1);
  await page.getByRole("button", { name: "Pulse", exact: true }).click();
  await page.getByRole("radio", { name: "Curious", exact: true }).check();
  await page.getByRole("button", { name: "Send Pulse", exact: true }).click();
  await receiver.reload();
  await receiver
    .getByRole("button", { name: "FEEL YOUR NETWORK", exact: true })
    .click();
  await expect(
    receiver.getByRole("region", { name: "NETWORK EMOTION RESULTS" }),
  ).toContainText("1 active Pulses");
  await expect(
    receiver
      .getByRole("region", { name: "NETWORK EMOTION RESULTS" })
      .getByRole("listitem")
      .filter({ hasText: "Curious" }),
  ).toContainText("100.0%");
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
  await expect(expiring.dialog.getByText(/Invitation expired/)).toBeVisible();
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
