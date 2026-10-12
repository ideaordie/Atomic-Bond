import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test.beforeEach(async ({ page }) => {
  await page.goto("/review/doodle/production");
  const reset = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/review/doodle") &&
      response.request().postDataJSON()?.action === "reset",
  );
  await page.getByRole("button", { name: "RESET FIXTURES" }).click();
  expect((await reset).ok()).toBe(true);
  await expect(
    page.getByRole("button", { name: "RESET FIXTURES" }),
  ).toBeEnabled();
  await expect(
    page.getByText("8 appreciations", { exact: true }),
  ).toBeVisible();
});

test("moderation pages remain bounded and keyboard accessible without resetting on focus", async ({
  page,
}, info) => {
  const bits = Buffer.alloc(512);
  bits[0] = 1;
  for (const actor of [
    ...Array.from({ length: 10 }, (_, i) => i + 1),
    ...Array.from({ length: 13 }, (_, i) => i + 13),
  ]) {
    const response = await page.request.post("/api/review/doodle", {
      headers: { Origin: "http://127.0.0.1:3140" },
      data: {
        actor,
        action: "submit",
        args: [
          randomUUID(),
          {
            version: 1,
            bitmap: bits.toString("base64"),
            strokes: [{ draw: true, points: [0] }],
          },
        ],
      },
    });
    expect(response.ok()).toBe(true);
  }
  await page.getByLabel("Synthetic session").selectOption("0");
  await page.getByRole("button", { name: "MODERATION REVIEW" }).click();
  await expect(page.locator(".doodle-moderation-list article")).toHaveCount(25);
  const next = page.getByRole("button", { name: "NEXT REVIEW PAGE" });
  await next.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".doodle-moderation-list article")).toHaveCount(10);
  await expect(next).toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator(".doodle-moderation-list article")).toHaveCount(10);
  await page.getByRole("button", { name: "FIRST REVIEW PAGE" }).click();
  await expect(page.locator(".doodle-moderation-list article")).toHaveCount(25);
  await next.scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `artifacts/doodle-readiness-pagination-${info.project.name}.png`,
  });
});

test("appreciation persists, Hall is read-only, admin authorization and promotion replace an incumbent", async ({
  page,
}) => {
  await page
    .locator(".doodle-live-grid article")
    .filter({ hasText: "8 appreciations" })
    .getByRole("button", { name: "APPRECIATE", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "APPRECIATED", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(
    page.getByText("9 appreciations", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "HALL OF FAME", exact: true }).click();
  await expect(page.locator(".doodle-hall-grid article")).toHaveCount(10);
  await expect(
    page.getByRole("button", { name: "APPRECIATE", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "MODERATION REVIEW" }).click();
  await expect(
    page.getByText("Administrator authorization required.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "+60 MIN", exact: true }).click();
  await page.getByLabel("Synthetic session").selectOption("0");
  await page
    .getByRole("button", { name: "REVIEW CANDIDATE", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "APPROVE HALL PROMOTION" }),
  ).toBeDisabled();
  await page.getByLabel("Replay point", { exact: true }).fill("20");
  await page.getByLabel("I reviewed the bitmap", { exact: false }).check();
  await page.getByRole("button", { name: "APPROVE HALL PROMOTION" }).click();
  await expect(
    page.getByRole("region", { name: "Moderation decision" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "HALL OF FAME", exact: true }).click();
  await expect(page.locator(".doodle-hall-grid article")).toHaveCount(10);
  await expect(page.locator(".doodle-hall-grid article").first()).toContainText(
    "9 appreciations",
  );
  await page.getByRole("button", { name: "RUN CLEANUP" }).click();
  await expect(page.locator(".doodle-hall-grid article")).toHaveCount(10);
});

test("SEND publishes immediately without review and expiry hides content", async ({
  page,
}) => {
  await page.getByTestId("doodle-editor").focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "PREVIEW", exact: true }).click();
  await page.getByRole("button", { name: "SEND", exact: true }).click();
  await expect(page.getByText("PUBLISHED", { exact: true })).toBeVisible();
  await expect(page.locator(".doodle-live-grid article")).toHaveCount(3);
  await page.getByRole("button", { name: "+60 MIN", exact: true }).click();
  await expect(page.locator(".doodle-live-grid article")).toHaveCount(0);
});

test("reporting, reactive removal and emergency pause preserve existing feed", async ({
  page,
}) => {
  const drawing = page
    .locator(".doodle-live-grid article")
    .filter({ hasText: "8 appreciations" });
  await drawing.getByText("REPORT DRAWING", { exact: true }).click();
  await drawing.getByRole("button", { name: "ABUSE", exact: true }).click();
  await expect(page.locator(".doodle-live-grid article")).toHaveCount(2);
  await page.getByLabel("Synthetic session").selectOption("0");
  await page.getByRole("button", { name: "MODERATION REVIEW" }).click();
  await page.getByLabel("MODERATION VIEW").selectOption("REPORTED");
  await expect(page.locator(".doodle-moderation-list article")).toHaveCount(1);
  await page
    .getByRole("button", { name: "REVIEW PUBLISHED", exact: true })
    .click();
  await page
    .getByRole("button", { name: "REMOVE DRAWING", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Moderation history" }),
  ).toContainText("REMOVED");
  await page.getByRole("button", { name: "PAUSE NEW SUBMISSIONS" }).click();
  await page.getByLabel("Synthetic session").selectOption("1");
  await page.getByRole("button", { name: "LIVE DRAWINGS" }).click();
  await expect(page.locator(".doodle-live-grid article")).toHaveCount(1);
  await expect(
    page.getByText("NEW SUBMISSIONS PAUSED.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "APPRECIATE", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "APPRECIATED", exact: true }),
  ).toBeDisabled();
  await page.getByTestId("doodle-editor").focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "PREVIEW", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "SEND", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Synthetic session").selectOption("0");
  await page.getByRole("button", { name: "MODERATION REVIEW" }).click();
  await page.getByRole("button", { name: "RESUME SUBMISSIONS" }).click();
  await expect(
    page.getByRole("button", { name: "PAUSE NEW SUBMISSIONS" }),
  ).toBeVisible();
});

test("Light/Dark layout, keyboard controls, private backend payloads and lazy replay", async ({
  page,
}, info) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") requests.push(r.postData() ?? "");
  });
  for (const theme of ["DARK", "LIGHT"]) {
    await page.getByRole("button", { name: theme, exact: true }).click();
    await page
      .getByRole("button", { name: "HALL OF FAME", exact: true })
      .click();
    await expect(page.locator(".doodle-hall-grid article")).toHaveCount(10);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/doodle121-${info.project.name}-${theme.toLowerCase()}.png`,
      fullPage: true,
    });
  }
  expect(requests.some((r) => JSON.parse(r).action === "replay")).toBe(false);
  await page
    .getByRole("button", { name: "REPLAY", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("region", { name: "Drawing replay" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "CLOSE REPLAY" }).click();
  await page.getByLabel("Synthetic session").selectOption("-1");
  await expect(page.locator(".doodle-hall-grid article")).toHaveCount(0);
});

test("static-only fallback is explicit to the moderator", async ({ page }) => {
  const bits = Buffer.alloc(512);
  bits[0] = 1;
  const response = await page.request.post("/api/review/doodle", {
    headers: { Origin: "http://127.0.0.1:3140" },
    data: {
      actor: 13,
      action: "submit",
      args: [
        randomUUID(),
        { version: 1, bitmap: bits.toString("base64"), strokes: null },
      ],
    },
  });
  expect(response.ok()).toBe(true);
  await page.getByLabel("Synthetic session").selectOption("0");
  await page.getByRole("button", { name: "MODERATION REVIEW" }).click();
  await page
    .locator(".doodle-moderation-list article")
    .filter({ hasText: "ATOM 14 · PUBLISHED" })
    .getByRole("button", { name: "REVIEW PUBLISHED" })
    .click();
  await expect(
    page.getByText("Static-only submission:", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "APPROVE PUBLICATION" }),
  ).toHaveCount(0);
});
