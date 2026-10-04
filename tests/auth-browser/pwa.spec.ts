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
  await expect(page.getByRole("heading")).toHaveText("YOUR ATOM IS READY");
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

test("contextual native install, dismissal, owner preferences and installed suppression", async ({
  page,
  request,
}, info) => {
  await page.clock.install();
  await owner(page, request, `pwa-native-${info.project.name}@example.invalid`);
  const number = await page.getByTestId("selected-atom").textContent();
  const offer = page.getByRole("region", { name: "Install Atomic Bond" });
  await expect(offer).toHaveCount(0); // Unsupported/no event never gets a fake button.
  await installEvent(page);
  await page.clock.fastForward(31_000);
  await expect(offer).toBeVisible();
  await page.screenshot({
    path: info.outputPath("native-offer.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await offer.getByRole("button", { name: "NOT NOW" }).click();
  await page.reload();
  await installEvent(page);
  await page.clock.fastForward(31_000);
  await expect(offer).toHaveCount(0);
  await page.getByRole("link", { name: "Profile & preferences" }).click();
  await expect(offer).toBeVisible();
  await page.screenshot({
    path: info.outputPath("preferences-install.png"),
    fullPage: true,
  });
  await offer
    .getByRole("button", { name: "ADD TO HOME SCREEN", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-native-prompt",
    "called",
  );
  await expect(offer).toHaveCount(0);
  await page.getByRole("link", { name: "RETURN TO MY ATOM" }).click();
  await expect(page.getByTestId("selected-atom")).toHaveText(number!);
});

test("iOS manual guidance stays optional and fits each viewport", async ({
  page,
  request,
}, info) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "platform", { get: () => "MacIntel" });
    Object.defineProperty(navigator, "maxTouchPoints", { get: () => 5 });
  });
  await page.clock.install();
  await owner(page, request, `pwa-ios-${info.project.name}@example.invalid`);
  // Verify hydration before advancing the install timer. A visible streamed
  // canvas alone does not prove that client effects have registered yet.
  await page.getByRole("button", { name: "Pause motion", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Resume motion", exact: true }),
  ).toBeVisible();
  await page.clock.runFor(100);
  await page.clock.fastForward(31_000);
  const offer = page.getByRole("region", { name: "Install Atomic Bond" });
  await offer
    .getByRole("button", { name: "HOW TO ADD TO HOME SCREEN" })
    .click();
  await expect(offer).toContainText("Tap Share");
  await expect(offer).toContainText("Open as Web App");
  await page.screenshot({
    path: info.outputPath("ios-guidance.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await offer.getByRole("button", { name: "DONE" }).click();
  await expect(offer).toHaveCount(0);
  await page.getByRole("button", { name: "Pulse", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "How are you feeling?" }),
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
  await page.getByRole("link", { name: "Profile & preferences" }).click();
  await installEvent(page);
  await expect(
    page.getByRole("region", { name: "Install Atomic Bond" }),
  ).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("standalone-profile.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "RETURN TO MY ATOM" }).click();
  await page.getByRole("button", { name: "CREATE BOND", exact: true }).click();
  await expect(
    page
      .getByRole("dialog", { name: "CREATE BOND", exact: true })
      .getByRole("img"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close invitation" }).click();
  await page.getByRole("button", { name: "Pulse", exact: true }).click();
  const composer = page.getByRole("dialog", { name: "How are you feeling?" });
  await composer.getByRole("radio", { name: "Curious", exact: true }).check();
  await composer
    .getByRole("button", { name: "Send Pulse", exact: true })
    .click();
  await expect(page.getByTestId("own-pulse")).toContainText("Curious");
  await page.getByRole("button", { name: /^YOUR NETWORK OVERVIEW/ }).click();
  await expect(
    page.getByRole("region", { name: "Your Network Overview details" }),
  ).toBeVisible();
});
