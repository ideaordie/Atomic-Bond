import {
  ACTION_DURATION_MS,
  pulseStepMs,
} from "../../src/living-atom/pulse/traversal";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { EMOTIONS, PULSE_LIFETIME_MS } from "../../src/types/emotional-pulse";
import { EMOTION_DEFINITIONS } from "../../src/living-atom/pulse/emotions";
import { generateMockGraph, mockAtomId } from "../../src/data/mock/graph";
import { createScene } from "../../src/living-atom/layout/scene";
import { sendEmotionalPulse } from "./pulse-helpers";
const duration = ACTION_DURATION_MS;
async function capture(page: Page, info: TestInfo, name: string) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath(`${name}.png`),
    fullPage: true,
  });
}
async function setup(page: Page) {
  await page.clock.install({ time: new Date("2026-09-23T12:00:00Z") });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.pauseAt(new Date("2026-09-23T12:00:02Z"));
  await page.goto("/explore");
  // Hydration schedules the initial Pulse snapshot; advance the paused clock
  // while waiting so setup does not depend on page hydration timing.
  await expect
    .poll(async () => {
      await page.clock.runFor(20);
      return page.getByTestId("active-pulse-count").textContent();
    })
    .toContain("128 active Pulses");
  await expect(page.getByTestId("active-pulse-count")).toContainText(
    "128 active Pulses",
  );
  await page.clock.runFor(50);
}
test("explicit emotion selection, eight visual states, replacement and full graph reach", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  await setup(page);
  const canvas = page.getByTestId("atom-canvas");
  await page.getByRole("button", { name: "Pulse", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "How are you feeling?" });
  await expect(dialog.getByRole("radio")).toHaveCount(8);
  await expect(
    dialog.getByRole("button", { name: "Send Pulse", exact: true }),
  ).toBeDisabled();
  await capture(page, info, "selector");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("own-pulse")).toHaveCount(0);
  const frames = new Set<string>();
  for (const emotion of EMOTIONS) {
    const definition = EMOTION_DEFINITIONS[emotion];
    await sendEmotionalPulse(page, definition.label);
    await expect(page.getByTestId("own-pulse")).toContainText(definition.label);
    await expect(canvas).toHaveAttribute("data-pulse-color", definition.color);
    await page.clock.runFor(
      Math.ceil(
        pulseStepMs(
          createScene(generateMockGraph(), mockAtomId(0), true).maxDistance,
        ) * 1.5,
      ),
    );
    await expect(page.getByTestId("pulse-status")).toHaveAttribute(
      "data-degree",
      "1",
    );
    await page.clock.runFor(50);
    await capture(page, info, `outgoing-${emotion}`);
    await page.clock.fastForward(duration);
    await page.clock.runFor(50);
    await expect(page.getByTestId("pulse-status")).toContainText(
      "640 connected Atoms reached",
    );
    await expect(page.getByTestId("pulse-status")).toContainText("3 countries");
    frames.add(
      await canvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL()),
    );
    await capture(page, info, `active-${emotion}`);
  }
  expect(frames.size).toBe(8);
  await expect(canvas).toHaveAttribute("data-motion", "still");
});

test("Living emotional network coverage, progressive clouds, selected state and neutral omissions", async ({
  page,
}, info) => {
  await setup(page);
  await page.getByRole("button", { name: /YOUR NETWORK OVERVIEW/ }).click();
  await expect(page.getByTestId("active-pulse-count")).toContainText(
    "128 active Pulses",
  );
  await expect(
    page.getByRole("region", { name: "Your Network Overview details" }),
  ).toBeVisible();
  const canvas = page.getByTestId("atom-canvas");
  for (const [view, mode] of [
    ["People", "people"],
    ["Networks", "networks"],
    ["Regions", "regions"],
  ]) {
    await page.getByRole("button", { name: view!, exact: true }).click();
    await page.clock.runFor(50);
    await expect(canvas).toHaveAttribute("data-representation", mode!);
    await capture(page, info, `feel-${mode}`);
  }

  await expect(
    page.getByText(
      "Percentages use 128 active visible Pulses only. Atoms without an active Pulse remain neutral.",
    ),
  ).toBeVisible();
  await capture(page, info, "coverage");
  await expect(
    page.locator(".emotion-distribution li").filter({ hasText: "Curious" }),
  ).toHaveText("Curious16 · 12.5%");
  await page
    .getByRole("button", { name: "Close Your Network Overview" })
    .click();
  await page.getByRole("button", { name: "People", exact: true }).click();
  await page.clock.runFor(50);
  for (const [id, name, active] of [
    ["mock-atom-00000002", "active", true],
    ["mock-atom-00000006", "expired", false],
    ["mock-atom-00000003", "no-emotion", false],
  ] as const) {
    await page.getByLabel("Select an Atom", { exact: true }).focus();
    await page.getByLabel("Select an Atom", { exact: true }).selectOption(id);
    await expect(page.getByTestId("current-pulse")).toHaveCount(active ? 1 : 0);
    if (active)
      await expect(page.getByTestId("current-pulse")).toContainText("Calm");
    await capture(page, info, `context-${name}`);
    await page.getByRole("button", { name: "Close selected Atom" }).click();
  }
});

test("expiry updates the mounted network exactly at the deadline", async ({
  page,
}) => {
  await setup(page);
  await sendEmotionalPulse(page, "Sad");
  await page.getByRole("button", { name: "Stop Pulse", exact: true }).click();
  await page.getByRole("button", { name: /YOUR NETWORK OVERVIEW/ }).click();
  await expect(page.getByTestId("active-pulse-count")).toContainText(
    "129 active Pulses",
  );
  await page.clock.fastForward(PULSE_LIFETIME_MS - 1);
  await expect(page.getByTestId("own-pulse")).toContainText("Sad");
  await page.clock.runFor(1);
  await expect(page.getByTestId("own-pulse")).toHaveCount(0);
  await expect(page.getByTestId("active-pulse-count")).toContainText(
    "0 active Pulses",
  );
});

test("Pulse stops at 15 seconds while active material remains independent of the disclosure", async ({
  page,
}) => {
  await setup(page);
  await expect(
    page.getByRole("button", { name: "FEEL YOUR NETWORK" }),
  ).toHaveCount(0);
  await expect(page.getByTestId("atom-canvas")).toHaveAttribute(
    "data-emotional-view",
    "active",
  );
  await sendEmotionalPulse(page, "Curious");
  await page.clock.runFor(14999);
  await expect(
    page.getByRole("button", { name: "Stop Pulse", exact: true }),
  ).toBeVisible();
  await page.clock.runFor(1);
  await expect(
    page.getByRole("button", { name: "Pulse", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("pulse-status")).toContainText(
    "640 connected Atoms reached",
  );
  const toggle = page.getByRole("button", { name: /YOUR NETWORK OVERVIEW/ });
  await toggle.click();
  await toggle.click();
  await page.clock.fastForward(60_000);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("atom-canvas")).toHaveAttribute(
    "data-emotional-view",
    "active",
  );
  await expect(page.getByTestId("own-pulse")).toContainText("Curious");
});

test("Curious appears in Living emotional network and selected context, then expires", async ({
  page,
}, info) => {
  await setup(page);
  await sendEmotionalPulse(page, "Curious");
  await page.getByRole("button", { name: "Stop Pulse", exact: true }).click();
  await page.getByRole("button", { name: /YOUR NETWORK OVERVIEW/ }).click();
  await page
    .getByRole("button", { name: "Close Your Network Overview" })
    .click();
  await page.getByLabel("Select an Atom", { exact: true }).focus();
  await page
    .getByLabel("Select an Atom", { exact: true })
    .selectOption(mockAtomId(0));
  await expect(page.getByTestId("current-pulse")).toContainText("Curious");
  await page.clock.runFor(50);
  await capture(page, info, "curious-context");
  await page.clock.fastForward(PULSE_LIFETIME_MS);
  await expect(page.getByTestId("current-pulse")).toHaveCount(0);
  await expect(page.getByTestId("own-pulse")).toHaveCount(0);
});

test("Your Network Overview expands, updates without losing scroll, expires and closes accessibly", async ({
  page,
}, info) => {
  await setup(page);
  const toggle = page.getByRole("button", { name: /YOUR NETWORK OVERVIEW/ });
  const results = page.getByRole("region", {
    name: "Your Network Overview details",
  });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(results).toHaveCount(0);
  await capture(page, info, "network-now-collapsed");
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(results).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(results).toContainText("128 active Pulses");
  await expect(results.locator("li")).toHaveCount(8);
  expect(
    (await results.locator(".emotion-distribution").boundingBox())!.height,
  ).toBeGreaterThan(140);
  await capture(page, info, "network-now-expanded");
  const distribution = results.locator(".emotion-distribution");
  const top = await distribution.evaluate((el) => {
    el.scrollTop = 100;
    el.querySelector("ul")!.setAttribute("data-stable-results", "true");
    return el.scrollTop;
  });
  expect(top).toBeGreaterThan(0);
  await sendEmotionalPulse(page, "Curious");
  await page.clock.runFor(50);
  await expect(results).toContainText("129 active Pulses");
  await expect(
    results.locator("li").filter({ hasText: "Curious" }),
  ).toContainText("17");
  await page.clock.fastForward(60_000);
  await expect(results.locator("ul")).toHaveAttribute(
    "data-stable-results",
    "true",
  );
  expect(await distribution.evaluate((el) => el.scrollTop)).toBe(top);
  await page.clock.runFor(50);
  const activeFrame = await page
    .getByTestId("atom-canvas")
    .evaluate((node) => (node as HTMLCanvasElement).toDataURL());
  await page.clock.fastForward(PULSE_LIFETIME_MS);
  await expect(results).toContainText("0 active Pulses");
  // Flush the scheduled paint as well as React's expiry update under the paused test clock.
  await page.clock.runFor(50);
  expect(
    await page
      .getByTestId("atom-canvas")
      .evaluate((node) => (node as HTMLCanvasElement).toDataURL()),
  ).not.toBe(activeFrame);
  await capture(page, info, "expired-neutral");
  const close = results.getByRole("button", {
    name: "Close Your Network Overview",
  });
  const box = (await close.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await close.click();
  await expect(toggle).toBeFocused();
  await expect(results).toHaveCount(0);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Escape");
  await expect(results).toHaveCount(0);
  await expect(toggle).toBeFocused();
});
