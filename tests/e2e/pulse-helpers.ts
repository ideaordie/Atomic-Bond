import { EMOTION_DEFINITIONS } from "../../src/living-atom/pulse/emotions";
import { expect, type Page } from "@playwright/test";
export async function sendEmotionalPulse(page: Page, emotion = "Calm") {
  await page.getByRole("button", { name: "Pulse", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "How are you right now?" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Send Pulse", exact: true }),
  ).toBeDisabled();
  const definition = Object.values(EMOTION_DEFINITIONS).find(
    (d) => d.label === emotion,
  )!;
  await dialog
    .getByRole("tab", { name: definition.category, exact: true })
    .click();
  await dialog.getByRole("radio", { name: emotion, exact: true }).check();
  await dialog.getByRole("button", { name: "Send Pulse", exact: true }).click();
}
