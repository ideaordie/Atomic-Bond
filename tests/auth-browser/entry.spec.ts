import { expect, test } from "@playwright/test";

test("entry, isolated owner sessions, explicit public viewing and empty real network", async ({
  page,
  browser,
  request,
}, info) => {
  await page.goto("/");
  await page.getByRole("link", { name: "ACCESS MY ATOM", exact: true }).click();
  await expect(page.getByLabel("Home region")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Email me an access link" }),
  ).toBeVisible();
  await page.goto("/");
  await page.getByRole("link", { name: "CREATE MY ATOM", exact: true }).click();
  const email = `isolated-${info.project.name}@example.invalid`;
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Home region").selectOption({ index: 1 });
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
  const number = (
    await page.locator(".auth-panel p").first().innerText()
  ).replace("ATOM #", "");
  await page.goto("/");
  await expect(
    page.getByText(`MY ATOM #${number}`, { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("selected-atom")).toHaveText(`#${number}`);
  await expect(page.getByTestId("reachable-count")).toHaveText("1");
  await expect(
    page.getByRole("button", { name: "CREATE BOND", exact: true }),
  ).toBeEnabled();
  const isolated = await browser.newContext({
    viewport: info.project.use.viewport ?? { width: 390, height: 844 },
  });
  const visitor = await isolated.newPage();
  await visitor.goto("http://127.0.0.1:3104/");
  await expect(
    visitor.getByRole("link", { name: "ACCESS MY ATOM", exact: true }),
  ).toBeVisible();
  await expect(visitor.getByTestId("living-atom")).toHaveCount(0);
  await visitor.goto(`http://127.0.0.1:3104/a/${number}`);
  await expect(
    visitor.getByText(`PUBLIC ATOM VIEW · ATOM #${number}`, { exact: true }),
  ).toBeVisible();
  await expect(
    visitor.getByRole("button", { name: "CREATE BOND", exact: true }),
  ).toHaveCount(0);
  await expect(
    visitor.getByRole("button", { name: "Pulse", exact: true }),
  ).toBeDisabled();
  await expect(
    visitor.getByRole("link", { name: "Profile & preferences" }),
  ).toHaveCount(0);
  await page.goto(`/a/${number}`);
  await expect(
    page.getByText(`PUBLIC ATOM VIEW · ATOM #${number}`, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "CREATE BOND", exact: true }),
  ).toHaveCount(0);
  await page.goto("/");
  await expect(
    page.getByText(`MY ATOM #${number}`, { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("isolated-owner.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Profile & preferences" }).click();
  await page.getByRole("button", { name: "Sign out on this device" }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3104/");
  await page.reload();
  await expect(
    page.getByRole("link", { name: "ACCESS MY ATOM", exact: true }),
  ).toBeVisible();
  await page.goto("/explore?atom=999999");
  await expect(page.getByTestId("living-atom")).toHaveCount(0);
  await isolated.close();
});
