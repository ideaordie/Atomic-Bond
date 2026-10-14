import {
  expect,
  test,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { selectHomeRegion } from "./home-region";

async function owner(page: Page, request: APIRequestContext, email: string) {
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
  await page.goto("/explore");
  // Next streams a hidden server segment while hydrating the owner view.
  await expect(page.getByTestId("atom-canvas")).toHaveCount(1);
  await expect(page.getByTestId("atom-canvas")).toBeVisible();
}
async function installEvent(page: Page, outcome = "accepted") {
  await page.evaluate((outcome) => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, {
      prompt: async () => {
        document.documentElement.dataset.nativePrompt = "called";
      },
      userChoice: Promise.resolve({ outcome }),
    });
    window.dispatchEvent(event);
  }, outcome);
}

async function accessLink(
  page: Page,
  request: APIRequestContext,
  email: string,
) {
  // Model a later signed-out visit without clearing browser-local install preferences.
  await page.context().clearCookies();
  await page.goto("/auth?mode=access");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me an access link" }).click();
  await expect(page.getByRole("status")).toContainText("secure link");
  const { link } = await (
    await request.get(`http://127.0.0.1:54330/__test/mail?email=${email}`)
  ).json();
  await page.goto(link);
}

for (const theme of ["light", "dark"]) {
  test(`returning access invites only after verification; ${theme} dismissal is readable and persistent`, async ({
    page,
    request,
  }, info) => {
    await page.goto("/auth?mode=access");
    await page.evaluate(
      (value) => localStorage.setItem("atomic-bond-appearance", value),
      theme,
    );
    const before = await (
      await request.get("http://127.0.0.1:54330/__test/counts")
    ).json();
    await accessLink(page, request, "inviter@example.invalid");
    const offer = page.getByRole("region", { name: "Install Atomic Bond" });
    await expect(offer).toHaveCount(0);
    // Hold only the response transport: the real local server still performs verification.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/auth/confirm", async (route) => {
      if (route.request().method() === "POST") await gate;
      await route.continue();
    });
    await page.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }).click();
    await expect(
      page.getByRole("button", { name: "Verifying…" }),
    ).toBeDisabled();
    await expect(offer).toHaveCount(0);
    release();
    await expect(
      page.getByRole("heading", { name: "WELCOME BACK" }),
    ).toBeVisible();
    await expect(offer).toHaveCount(1);
    await expect(offer).toContainText(
      "Add Atomic Bond to your device for quick access.",
    );
    const dismiss = offer.getByRole("button", { name: "NOT NOW", exact: true });
    const contrast = () =>
      dismiss.evaluate((button) => {
        const luminance = (rgb: string) => {
          const channels = rgb
            .match(/[\d.]+/g)!
            .slice(0, 3)
            .map(Number)
            .map((v) => {
              const c = v / 255;
              return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
            });
          return (
            channels[0]! * 0.2126 +
            channels[1]! * 0.7152 +
            channels[2]! * 0.0722
          );
        };
        let surface: Element = button;
        while (
          getComputedStyle(surface).backgroundColor === "rgba(0, 0, 0, 0)" &&
          surface.parentElement
        )
          surface = surface.parentElement;
        const fg = luminance(getComputedStyle(button).color);
        const bg = luminance(getComputedStyle(surface).backgroundColor);
        return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
      });
    expect(await contrast()).toBeGreaterThanOrEqual(4.5);
    await dismiss.hover();
    expect(await contrast()).toBeGreaterThanOrEqual(4.5);
    await page.mouse.down();
    expect(await contrast()).toBeGreaterThanOrEqual(4.5);
    await page.mouse.move(0, 0);
    await page.mouse.up();
    await dismiss.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(dismiss).toBeFocused();
    expect(
      await dismiss.evaluate((el) => getComputedStyle(el).outlineStyle),
    ).not.toBe("none");
    expect(await contrast()).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({
      path: info.outputPath(`returning-${theme}.png`),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await installEvent(page, "dismissed"); // Provider rerender must not duplicate the invitation.
    await expect(offer).toHaveCount(1);
    await dismiss.press("Enter");
    await expect(offer).toHaveCount(0);
    await page.getByRole("link", { name: "MY ATOM", exact: true }).click();
    await expect(page.getByTestId("atom-canvas")).toBeVisible();
    const number = await page.getByTestId("selected-atom").innerText();
    await page.reload();
    await expect(offer).toHaveCount(0);
    await expect(page.getByTestId("selected-atom")).toHaveText(number);
    await expect(
      page.getByRole("button", { name: "INSTALL APP", exact: true }),
    ).toBeVisible();
    await accessLink(page, request, "inviter@example.invalid");
    await page.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }).click();
    await expect(
      page.getByRole("heading", { name: "WELCOME BACK" }),
    ).toBeVisible();
    await expect(offer).toHaveCount(0);
    expect(
      await (await request.get("http://127.0.0.1:54330/__test/counts")).json(),
    ).toEqual(before);
  });
}

test("registration invitation persists on reload; dismissal keeps navigation; native install is user initiated", async ({
  page,
  request,
}, info) => {
  await owner(page, request, `pwa-native-${info.project.name}@example.invalid`);
  const number = await page.getByTestId("selected-atom").textContent();
  const offer = page.getByRole("region", { name: "Install Atomic Bond" });
  await expect(
    offer.getByRole("heading", { name: "TAKE YOUR ATOM WITH YOU" }),
  ).toBeVisible();
  await page.reload();
  await expect(offer).toBeVisible();
  await offer.getByRole("button", { name: "NOT NOW" }).click();
  await page.reload();
  await expect(offer).toHaveCount(0);
  const entry = page.getByRole("button", { name: "INSTALL APP", exact: true });
  await entry.click();
  await expect(page.getByRole("dialog")).toContainText("Chrome or Edge");
  await page.keyboard.press("Escape");
  await expect(entry).toBeFocused();
  await installEvent(page, "dismissed");
  await entry.click();
  await expect(entry).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute(
    "data-native-prompt",
    "called",
  );
  await installEvent(page);
  await entry.click();
  await expect(entry).toHaveCount(0);
  await expect(page.getByTestId("selected-atom")).toHaveText(number!);
});

test("iOS instructions are optional, keyboard closable and fit", async ({
  page,
  request,
}, info) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "platform", { get: () => "MacIntel" });
    Object.defineProperty(navigator, "maxTouchPoints", { get: () => 5 });
  });
  await owner(page, request, `pwa-ios-${info.project.name}@example.invalid`);
  await page
    .getByRole("button", { name: "INSTALL ATOMIC BOND", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Tap Share");
  await expect(dialog).toContainText("Open as Web App");
  await expect(dialog).not.toContainText("Chrome or Edge");
  await page.screenshot({
    path: info.outputPath("ios-install.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await dialog.getByRole("button", { name: "CLOSE INSTRUCTIONS" }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "NOT NOW" }).click();
  await expect(
    page.getByRole("button", { name: "INSTALL APP", exact: true }),
  ).toBeVisible();
});

test("standalone restores the same owner and suppresses install UI", async ({
  page,
  request,
}, info) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "standalone", { get: () => true });
  });
  await owner(
    page,
    request,
    `pwa-installed-${info.project.name}@example.invalid`,
  );
  const number = await page.getByTestId("selected-atom").textContent();
  await page.goto("/");
  await expect(page.getByTestId("selected-atom")).toHaveText(number!);
  await accessLink(
    page,
    request,
    `pwa-installed-${info.project.name}@example.invalid`,
  );
  await page.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }).click();
  await expect(
    page.getByRole("heading", { name: "WELCOME BACK" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Install Atomic Bond" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "MY ATOM", exact: true }).click();
  await expect(page.getByTestId("selected-atom")).toHaveText(number!);
  await page.getByRole("link", { name: "Settings" }).click();
  await installEvent(page);
  await expect(
    page.getByRole("region", { name: "Install Atomic Bond" }),
  ).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("standalone-profile.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "RETURN TO MY ATOM" }).click();
  await page
    .getByRole("button", { name: /^CREATE (YOUR FIRST )?BOND$/ })
    .click();
  await expect(
    page
      .getByRole("dialog", { name: /^CREATE (YOUR FIRST )?BOND$/ })
      .getByRole("img"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close invitation" }).click();
  await page.getByRole("button", { name: "Pulse", exact: true }).click();
  const composer = page.getByRole("dialog", { name: "How are you right now?" });
  await composer.getByRole("tab", { name: "VIBE", exact: true }).click();
  await composer.getByRole("radio", { name: "Tipsy", exact: true }).check();
  await composer
    .getByRole("button", { name: "Send Pulse", exact: true })
    .click();
  await expect(page.getByTestId("own-pulse")).toContainText("Tipsy");
  await page.getByRole("button", { name: /^YOUR NETWORK OVERVIEW/ }).click();
  await expect(
    page.getByRole("region", { name: "Your Network Overview details" }),
  ).toBeVisible();
});

test("Light/Dark invitation and Android fallback remain accessible without a native event", async ({
  page,
  request,
}, info) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "userAgent", {
      get: () => "Mozilla/5.0 Android Chrome/130.0 Mobile",
    }),
  );
  await owner(
    page,
    request,
    `pwa-android-${info.project.name}@example.invalid`,
  );
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (theme) => localStorage.setItem("atomic-bond-appearance", theme),
      theme,
    );
    await page.reload();
    const offer = page.getByRole("region", { name: "Install Atomic Bond" });
    await expect(offer).toBeVisible();
    const invitationBox = await offer.boundingBox();
    const headerBox = await page.locator("header.explore-nav").boundingBox();
    expect(invitationBox!.y).toBeGreaterThanOrEqual(
      headerBox!.y + headerBox!.height,
    );
    const entryBox = await page
      .getByRole("button", { name: "INSTALL APP", exact: true })
      .boundingBox();
    expect(entryBox!.x).toBeGreaterThanOrEqual(0);
    expect(entryBox!.x + entryBox!.width).toBeLessThanOrEqual(
      page.viewportSize()!.width,
    );
    await page.screenshot({
      path: info.outputPath(`invitation-${theme}.png`),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "INSTALL APP", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("three dots");
    await expect(dialog).not.toContainText("Safari");
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await page.screenshot({
      path: info.outputPath(`android-${theme}.png`),
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await expect(
    page.getByRole("button", { name: "INSTALL APP", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Install Atomic Bond" }),
  ).toHaveCount(0);
});
