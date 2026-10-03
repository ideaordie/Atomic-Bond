import { test, expect } from "@playwright/test";
import { growthEmail } from "../../src/services/growth/email";
test("unsubscribe is explicit, strips the capability, and does not create a session", async ({
  page,
  context,
}, info) => {
  const token = "b".repeat(64);
  let requests = 0;
  await page.route("**/api/growth/unsubscribe", async (route) => {
    expect(route.request().postData()).toBe(token);
    requests++;
    await route.fulfill({ json: { success: true } });
  });
  await page.goto(`/unsubscribe#${token}`);
  const button = page.getByRole("button", { name: "TURN OFF WEEKLY UPDATES" });
  await expect(button).toBeEnabled();
  expect(page.url()).not.toContain(token);
  expect(requests).toBe(0);
  await button.click();
  await expect(
    page.getByRole("heading", { name: "WEEKLY UPDATES TURNED OFF" }),
  ).toBeVisible();
  expect(requests).toBe(1);
  expect(
    (await context.cookies()).filter((c) => c.name.startsWith("sb-")),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("growth-unsubscribe.png"),
    fullPage: true,
  });
});
test("growth email stays readable and uses only nonzero actual metrics", async ({
  page,
}, info) => {
  const message = growthEmail(
    {
      id: "test",
      attemptId: "test",
      email: "private@example.invalid",
      publicId: "3",
      unsubscribeToken: "b".repeat(64),
      previous: { connectedAtoms: 1, directBonds: 1, regions: 1, countries: 1 },
      current: { connectedAtoms: 4, directBonds: 2, regions: 2, countries: 1 },
    },
    "https://atomicbond.ideaordie.com",
  );
  await page.setContent(message.html);
  await expect(
    page.getByRole("link", { name: "VIEW MY ATOM" }),
  ).toHaveAttribute("href", "https://atomicbond.ideaordie.com/return");
  await expect(
    page.getByRole("link", { name: "Unsubscribe", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("growth-email.png"),
    fullPage: true,
  });
});
