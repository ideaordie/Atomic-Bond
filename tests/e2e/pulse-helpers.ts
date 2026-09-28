import { expect, type Page } from "@playwright/test";
export async function sendEmotionalPulse(page: Page, emotion = "Calm") {
  await page.getByRole("button", { name: "Pulse", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "How are you feeling?" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Send Pulse", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("radio", { name: emotion, exact: true }).check();
  await dialog.getByRole("button", { name: "Send Pulse", exact: true }).click();
}
