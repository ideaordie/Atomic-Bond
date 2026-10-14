import { expect, test } from "@playwright/test";
import { selectHomeRegion } from "./home-region";

test("owner edits canonical Home Region separately from profile and retains it on reload", async ({
  page,
  request,
}, info) => {
  const email = `region-${info.project.name}@example.invalid`;
  await page.goto("/auth?mode=register");
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
  await expect(
    page.getByRole("heading", { name: "YOUR ATOM IS READY", exact: true }),
  ).toBeVisible();
  await page.goto("/owner");
  const heading = await page
    .getByRole("heading", { name: /ATOM #/ })
    .innerText();
  await page
    .getByRole("button", { name: "EDIT HOME REGION", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Country (required)", exact: true })
    .fill("Canada");
  await page.getByRole("option", { name: "Canada CA", exact: true }).click();
  await page
    .getByRole("combobox", {
      name: "State / Province / Region (required)",
      exact: true,
    })
    .fill("Ontario");
  await page
    .getByRole("option", { name: "Ontario CA-ON", exact: true })
    .click();
  await page
    .getByRole("button", { name: "SAVE HOME REGION", exact: true })
    .click();
  await expect(
    page.getByText("Home Region updated.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Ontario, Canada", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Name / alias").fill("Current alias");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: heading, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Ontario, Canada", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Name / alias")).toHaveValue("Current alias");
  await page
    .getByRole("button", { name: "EDIT HOME REGION", exact: true })
    .click();
  await page.getByRole("button", { name: "CANCEL", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "SAVE HOME REGION", exact: true }),
  ).toHaveCount(0);
  for (const mode of ["LIGHT", "DARK"]) {
    await page.getByRole("button", { name: mode, exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`region-${mode}.png`),
      fullPage: true,
    });
  }
});
