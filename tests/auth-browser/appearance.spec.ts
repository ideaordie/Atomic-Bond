import { expect, test } from "@playwright/test";

test("owner appearance switches immediately, persists through navigation and synchronizes live canvas", async ({
  page,
  context,
  request,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && /hydrat/i.test(m.text())) errors.push(m.text());
  });
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
  await expect(canvas).toBeVisible();
  await canvas.focus();
  await page.keyboard.press("+");
  await page.keyboard.press("ArrowRight");
  const zoom = await canvas.getAttribute("data-zoom"),
    pan = await canvas.getAttribute("data-pan");
  const settings = await context.newPage();
  await settings.goto("/owner");
  for (const theme of ["dark", "light"] as const) {
    await settings
      .getByRole("button", { name: theme.toUpperCase(), exact: true })
      .click();
    await expect(settings.locator("html")).toHaveAttribute(
      "data-appearance",
      theme,
    );
    await expect(canvas).toHaveAttribute("data-appearance", theme);
    await expect(canvas).toHaveAttribute("data-zoom", zoom!);
    await expect(canvas).toHaveAttribute("data-pan", pan!);
    await settings.reload();
    await expect(
      settings.getByRole("button", { name: theme.toUpperCase(), exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      await settings.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await settings.screenshot({
      path: info.outputPath(`${theme}-preferences.png`),
      fullPage: true,
    });
    await settings.goto("/admin/signals");
    await expect(
      settings.getByRole("heading", { name: "NETWORK SIGNAL ADMINISTRATION" }),
    ).toBeVisible();
    await settings.screenshot({
      path: info.outputPath(`${theme}-signal-admin.png`),
      fullPage: true,
    });
    for (const path of ["/admin", "/admin/network"]) {
      await settings.goto(path);
      await expect(settings.locator("html")).toHaveAttribute(
        "data-appearance",
        theme,
      );
      expect(
        await settings.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await settings.screenshot({
        path: info.outputPath(`${theme}-${path.replaceAll("/", "-")}.png`),
        fullPage: true,
      });
    }
    await settings.goto("/owner");
  }
  expect(errors).toEqual([]);
});
