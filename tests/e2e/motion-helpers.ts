import type { Page } from "@playwright/test";
/** Synthetic viewer has no Profile route. Exercise the browser preference synchronization boundary. */
export async function setMotion(page: Page, enabled: boolean) {
  await page.evaluate((value) => {
    localStorage.setItem("atomic-bond-motion", value ? "on" : "off");
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "atomic-bond-motion",
        newValue: value ? "on" : "off",
      }),
    );
  }, enabled);
}
