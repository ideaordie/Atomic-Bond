import { test, expect } from "@playwright/test";
import { selectHomeRegion } from "./home-region";
import { EMOTIONS } from "../../src/types/emotional-pulse";
import {
  EMOTION_DEFINITIONS,
  PULSE_CATEGORIES,
} from "../../src/living-atom/pulse/emotions";
test("expanded Pulse preview is local; all categories persist singly through owner RPC", async ({
  page,
  request,
}, info) => {
  await page.goto("/auth?mode=register");
  const email = `expanded-${info.project.name}@example.invalid`;
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
  await page.getByRole("button", { name: "Pulse", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "How are you right now?" });
  await expect(
    dialog.getByRole("button", { name: "Send Pulse", exact: true }),
  ).toBeDisabled();
  for (const category of PULSE_CATEGORIES) {
    await dialog.getByRole("tab", { name: category, exact: true }).click();
    await expect(dialog.getByRole("radio")).toHaveCount(8);
    for (const state of EMOTIONS.filter(
      (s) => EMOTION_DEFINITIONS[s].category === category,
    )) {
      await dialog
        .getByRole("radio", {
          name: EMOTION_DEFINITIONS[state].label,
          exact: true,
        })
        .check();
      await expect(dialog.locator(".pulse-preview strong")).toHaveText(
        EMOTION_DEFINITIONS[state].label,
      );
      await expect(page.getByTestId("own-pulse")).toHaveCount(0);
      await expect(page.getByTestId("active-pulse-count")).toContainText(
        "0 active Pulses",
      );
      await page.screenshot({
        path: info.outputPath(`preview-${state}.png`),
        fullPage: true,
      });
    }
  }
  await dialog.getByRole("tab", { name: "VIBE", exact: true }).focus();
  await page.keyboard.press("Home");
  await expect(
    dialog.getByRole("tab", { name: "FEELING", exact: true }),
  ).toBeFocused();
  await expect(
    dialog.getByRole("tab", { name: "FEELING", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.reload();
  await expect(page.getByTestId("own-pulse")).toHaveCount(0);
  for (const [category, label] of [
    ["FEELING", "Joyful"],
    ["VIBE", "Tipsy"],
    ["ENERGY", "Focused"],
  ] as const) {
    await page.getByRole("button", { name: "Pulse", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "How are you right now?" });
    await dialog.getByRole("tab", { name: category, exact: true }).click();
    await dialog.getByRole("radio", { name: label, exact: true }).check();
    await dialog
      .getByRole("button", { name: "Send Pulse", exact: true })
      .click();
    await expect(page.getByTestId("own-pulse")).toContainText(label);
    await page.reload();
    await expect(page.getByTestId("own-pulse")).toContainText(label);
    await page.getByRole("button", { name: /YOUR NETWORK OVERVIEW/ }).click();
    await expect(page.locator(".emotion-distribution li")).toHaveCount(1);
    await expect(page.locator(".emotion-distribution li")).toContainText(label);
    await page
      .getByRole("button", { name: "Close Your Network Overview" })
      .click();
  }
});
