import { test, expect } from "@playwright/test";
import { selectHomeRegion } from "./home-region";

test("deactivate, anonymous reopen, explicit same-Atom reactivation and preserved profile", async ({
  page,
  request,
}, info) => {
  const email = `deactivation-${info.project.name}@example.invalid`;
  const verify = async () => {
    const { link } = await (
      await request.get(`http://127.0.0.1:54330/__test/mail?email=${email}`)
    ).json();
    await page.goto(link);
    await page.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }).click();
  };
  await page.goto("/auth?mode=register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Name / alias").fill("Returning test owner");
  await page.getByLabel("X handle").fill("return_test");
  await selectHomeRegion(page);
  await page
    .getByRole("button", { name: "Create my Atom", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("secure link");
  await verify();
  await expect(
    page.getByRole("heading", { name: "YOUR ATOM IS READY" }),
  ).toBeVisible();
  await page.goto("/owner");
  const number = (
    await page.getByRole("heading", { level: 1 }).innerText()
  ).replace("ATOM #", "");
  await page
    .getByRole("button", { name: "DEACTIVATE ACCOUNT", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "DEACTIVATE YOUR ACCOUNT?" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "CANCEL", exact: true }).click();
  await expect(page.getByLabel("Name / alias")).toHaveValue(
    "Returning test owner",
  );
  await page
    .getByRole("button", { name: "DEACTIVATE ACCOUNT", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("deactivation-confirmation.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "CONFIRM DEACTIVATION" }).click();
  await expect(
    page.getByRole("heading", { name: "ATOM DEACTIVATED" }),
  ).toBeVisible();
  await page.goto("/owner");
  await expect(page).toHaveURL(/\/auth$/);
  await page.goto(`/a/${number}`);
  await expect(
    page.getByText("DEACTIVATED · Anonymized connection"),
  ).toBeVisible();
  await expect(
    page.getByText("Returning test owner", { exact: true }),
  ).toHaveCount(0);
  await page.goto("/auth?mode=access");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me an access link" }).click();
  await expect(page.getByRole("status")).toContainText("secure link");
  await verify();
  await expect(page).toHaveURL(/\/account\/reactivate/);
  await expect(
    page.getByText(`ATOM #${number} is currently deactivated.`),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^CREATE (YOUR FIRST )?BOND$/ }),
  ).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("reactivation.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "REACTIVATE MY ATOM" }).click();
  await expect(
    page.getByRole("heading", { name: "ATOM REACTIVATED" }),
  ).toBeVisible();
  await expect(
    page.getByText(`ATOM #${number} is currently deactivated.`),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "VIEW MY ATOM" }).click();
  await expect(
    page.getByText(`MY ATOM #${number}`, { exact: true }),
  ).toBeVisible();
  await page.goto("/owner");
  await expect(page.getByLabel("Name / alias")).toHaveValue(
    "Returning test owner",
  );
  await expect(page.getByLabel("X handle")).toHaveValue("return_test");
});
