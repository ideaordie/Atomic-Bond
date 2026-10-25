import { chromium, expect } from "@playwright/test";
const b = await chromium.launch();
const page = await b.newPage();
const failures = [];
page.on("pageerror", (e) => failures.push(e.message));
await page.goto("http://127.0.0.1:3140/review/direct-bonds");
await page.getByLabel("Select an Atom", { exact: true }).selectOption("3");
await page
  .getByRole("button", { name: "REQUEST DIRECT BOND", exact: true })
  .click();
await expect(page.getByText("REQUEST PENDING", { exact: true })).toBeVisible();
for (const [name, width, height] of [
  ["mobile", 390, 844],
  ["tablet", 768, 1024],
  ["desktop", 1440, 900],
]) {
  await page.setViewportSize({ width, height });
  for (const theme of ["LIGHT", "DARK"]) {
    await page.getByRole("button", { name: theme, exact: true }).click();
    await page.screenshot({
      path: `artifacts/task211/${name}-${theme.toLowerCase()}-sender.png`,
      fullPage: true,
    });
  }
}
await page.getByLabel("Synthetic owner").selectOption("2");
await expect(
  page.getByRole("button", { name: "ACCEPT BOND", exact: true }),
).toBeVisible();
await page.screenshot({
  path: "artifacts/task211/recipient.png",
  fullPage: true,
});
await page.getByRole("button", { name: "NOT NOW", exact: true }).click();
await expect(page.getByRole("dialog")).not.toBeVisible();
await page.reload();
await expect(page.getByLabel("Select an Atom", { exact: true })).toBeVisible();
await page.getByLabel("Synthetic owner").selectOption("2");
await page.getByRole("button", { name: /^BOND REQUESTS/ }).click();
await expect(
  page.getByRole("button", { name: "ACCEPT BOND", exact: true }),
).toBeVisible();
await page.getByRole("button", { name: "ACCEPT BOND", exact: true }).click();
await expect(page.getByText("BOND CREATED", { exact: true })).toBeVisible();
await expect(page.getByRole("dialog")).not.toBeVisible();
await page.getByLabel("Select an Atom", { exact: true }).selectOption("2");
await expect(
  page.getByRole("button", { name: "REQUEST DIRECT BOND", exact: true }),
).toHaveCount(0);
await page.getByLabel("Receive direct Bond requests").click();
await expect(page.getByLabel("Receive direct Bond requests")).not.toBeChecked();
await page.getByLabel("Synthetic owner").selectOption("3");
await page.getByLabel("Select an Atom", { exact: true }).selectOption("3");
await expect(
  page.getByRole("button", { name: "REQUEST DIRECT BOND", exact: true }),
).toHaveCount(0);
console.log(
  "PASS: sender pending, six responsive/theme screenshots, recipient notice, NOT NOW/reload/reopen, explicit acceptance updates graph, direct-Bond exclusion, opt-out. Browser errors:",
  failures.length,
);
await b.close();
