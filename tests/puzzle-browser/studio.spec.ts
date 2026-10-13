import { test, expect } from "@playwright/test";
for (const theme of ["light", "dark"])
  test(`Studio ${theme}: responsive private preview and deliberate schedule confirmation`, async ({
    page,
  }) => {
    await page.addInitScript(
      (t) => localStorage.setItem("atomic-bond-appearance", t),
      theme,
    );
    await page.route("**/api/puzzle/studio?batch=*", (r) =>
      r.fulfill({
        status: 200,
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          "base64",
        ),
      }),
    );
    await page.goto("/review/puzzle/studio");
    await expect(
      page.getByRole("heading", { name: "PUZZLE STUDIO", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "PREVIEW ARTWORK 1" }).click();
    await expect(
      page.getByRole("img", {
        name: "Prepared puzzle artwork with a five by five tile guide",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "REVIEW SCHEDULE" }),
    ).toBeDisabled();
    await page.getByLabel("I have reviewed").check();
    await page.getByLabel("Weekly start (UTC)").fill("2026-10-27T04:00");
    await page.getByRole("button", { name: "REVIEW SCHEDULE" }).click();
    await expect(
      page.getByRole("group", { name: "Confirm puzzle schedule" }),
    ).toContainText("2026-11-03 04:00:00 UTC");
    await page.getByRole("button", { name: "CANCEL", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "CONFIRM WEEKLY SCHEDULE" }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/studio-${theme}-${test.info().project.name}.png`,
      fullPage: true,
    });
  });
