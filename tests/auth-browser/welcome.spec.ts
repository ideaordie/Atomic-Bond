import { test, expect } from "@playwright/test";
import { selectHomeRegion } from "./home-region";

test("welcome CTA uses verified registration and recognizes the same returning owner", async ({
  page,
  request,
}, info) => {
  await page.goto("/welcome");
  await page
    .getByRole("link", { name: "CREATE YOUR ATOM", exact: true })
    .click();
  await expect(page).toHaveURL(/\/auth\?mode=register$/);
  await expect(page.getByLabel("Country", { exact: false })).toBeVisible();
  const email = `welcome-${info.project.name}@example.invalid`;
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
  await expect(page.getByRole("heading")).toHaveText("YOUR ATOM IS READY");
  const identity = await page.locator(".auth-panel p").first().innerText();
  await page.goto("/welcome");
  await page
    .getByRole("link", { name: "CREATE YOUR ATOM", exact: true })
    .click();
  await expect(page.getByRole("heading")).toHaveText("WELCOME BACK");
  await expect(page.getByText(identity, { exact: true })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveCount(0);
  await page.getByRole("link", { name: "MY ATOM", exact: true }).click();
  await expect(page.getByTestId("selected-atom")).toHaveText(
    identity.replace("ATOM ", ""),
  );
});
