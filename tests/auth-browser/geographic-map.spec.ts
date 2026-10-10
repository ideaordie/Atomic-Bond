import { test, expect } from "@playwright/test";

test("owner map, motion preference, anonymous isolation and sign-out", async ({
  page,
  request,
  context,
}, info) => {
  await page.goto("/auth?mode=access");
  await page.getByLabel("Email").fill("inviter@example.invalid");
  await page.getByRole("button", { name: "Email me an access link" }).click();
  await expect(page.getByRole("status")).toContainText("secure link");
  const { link } = await (
    await request.get(
      "http://127.0.0.1:54330/__test/mail?email=inviter@example.invalid",
    )
  ).json();
  await page.goto(link);
  await page.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }).click();
  await expect(
    page.getByRole("heading", { name: "WELCOME BACK" }),
  ).toBeVisible();
  await page.goto("/explore");
  const canvas = page.getByTestId("atom-canvas");
  const center = await canvas.getAttribute("data-center");
  const settings = await context.newPage();
  await settings.goto("/owner");
  await settings
    .getByRole("group", { name: "Atom motion", exact: true })
    .getByRole("button", { name: "OFF", exact: true })
    .click();
  await expect(canvas).toHaveAttribute("data-motion", "still");
  await settings.reload();
  await expect(
    settings
      .getByRole("group", { name: "Atom motion", exact: true })
      .getByRole("button", { name: "OFF", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  for (const theme of ["LIGHT", "DARK"]) {
    await settings.getByRole("button", { name: theme, exact: true }).click();
    await page.getByRole("button", { name: "SHOW MAP", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-layout", "geographic");
    await expect(canvas).toHaveAttribute("data-center", center!);
    await expect(canvas).toHaveAttribute("data-invitation-markers", "none");
    await expect(
      page.getByRole("button", { name: /NETWORK SIGNAL/ }),
    ).toBeVisible();
    await expect(canvas).toHaveAttribute("data-map-progress", "1.000");
    await page.screenshot({
      path: info.outputPath(`${theme}-owner-map.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "HIDE MAP", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-motion", "still");
  }
  await settings
    .getByRole("button", { name: "Sign out on this device" })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "SHOW MAP", exact: true }),
  ).toHaveCount(0);
  await page.goto(`/a/${center}`);
  await expect(
    page.getByRole("button", { name: "SHOW MAP", exact: true }),
  ).toHaveCount(0);
});
