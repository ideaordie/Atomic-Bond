import { selectHomeRegion } from "./home-region";
import { expect, test } from "@playwright/test";

test("registration clarity, field errors, long places and keyboard-sized viewport", async ({
  page,
}, info) => {
  await page.goto("/auth?mode=register");
  await expect(
    page.getByRole("heading", { name: "CREATE MY ATOM" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveAttribute("required", "");
  await expect(page.getByLabel("Country", { exact: false })).toHaveAttribute(
    "required",
    "",
  );
  await expect(page.getByLabel("Name / alias")).not.toHaveAttribute("required");
  await expect(page.getByLabel("X handle")).not.toHaveAttribute("required");
  await page
    .getByLabel("Email")
    .fill(`clarity-${info.project.name}@example.invalid`);
  await page.getByLabel("Name / alias").fill("Alexandra".repeat(6));
  await page.getByLabel("X handle").fill("https://x.com/not_a_handle");
  await selectHomeRegion(page);
  await page
    .getByRole("button", { name: "Create my Atom", exact: true })
    .click();
  await expect(page.getByLabel("X handle")).toBeFocused();
  await expect(page.getByLabel("X handle")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.locator("#x-error")).toContainText("URLs are not accepted");
  // Presentation-only stress fixture; does not change the canonical location ID or database.
  await page.locator("#selected-region").evaluate((el) => {
    el.textContent =
      "Selected: Llanfair­pwllgwyngyll­gogerychwyrn­drobwll­llantysilio­gogogoch, Isle of Anglesey, United Kingdom";
  });
  await page.getByLabel("X handle").fill("@abcdefghijklmno");
  for (const width of [390, 599, 600, 601, 767, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await page
        .locator(".auth-panel")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
  }
  // A resized viewport approximates available space, not a real OS keyboard.
  await page.setViewportSize({ width: 390, height: 380 });
  await page.getByLabel("X handle").focus();
  await page
    .getByRole("button", { name: "Create my Atom", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("button", { name: "Create my Atom", exact: true }),
  ).toBeInViewport();
  await page.setViewportSize(info.project.use.viewport!);
  await page.screenshot({
    path: info.outputPath("registration-long-content.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Create my Atom", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("CHECK YOUR EMAIL");
  await expect(page.getByRole("status")).toContainText("spam or junk");
  await page.screenshot({
    path: info.outputPath("check-email.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to Access my Atom" }).click();
  await expect(page.getByText(/no password needed/)).toBeVisible();
  await expect(page.getByLabel("Country", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("status")).toBeEmpty();
});
