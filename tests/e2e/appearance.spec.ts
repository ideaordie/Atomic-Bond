import { expect, test } from "@playwright/test";
for (const appearance of ["light", "dark"] as const) {
  test(`${appearance} surfaces, canvas, navigation and offline appearance`, async ({
    page,
    context,
  }, info) => {
    await page.addInitScript(
      (value) => localStorage.setItem("atomic-bond-appearance", value),
      appearance,
    );
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && /hydrat/i.test(m.text()))
        errors.push(m.text());
    });
    await page.goto("/explore");
    await expect(page.locator("html")).toHaveAttribute(
      "data-appearance",
      appearance,
    );
    const canvas = page.getByTestId("atom-canvas");
    await expect(canvas).toHaveAttribute("data-appearance", appearance);
    await canvas.focus();
    await page.keyboard.press("+");
    await page.keyboard.press("ArrowRight");
    const zoom = await canvas.getAttribute("data-zoom"),
      pan = await canvas.getAttribute("data-pan");
    await page.evaluate(
      (value) =>
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "atomic-bond-appearance",
            newValue: value,
          }),
        ),
      appearance === "light" ? "dark" : "light",
    );
    await expect(canvas).toHaveAttribute(
      "data-appearance",
      appearance === "light" ? "dark" : "light",
    );
    await expect(canvas).toHaveAttribute("data-zoom", zoom!);
    await expect(canvas).toHaveAttribute("data-pan", pan!);
    await page.reload();
    await expect(canvas).toHaveAttribute("data-appearance", appearance);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: info.outputPath(`${appearance}-graph.png`) });
    for (const path of ["/about", "/welcome"]) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute(
        "data-appearance",
        appearance,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath(
          `${appearance}-${path.split("?")[0]!.slice(1)}.png`,
        ),
        fullPage: true,
      });
    }
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await context.setOffline(true);
    await page.goto("/owner");
    await expect(
      page.getByRole("heading", { name: "You're offline." }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute(
      "data-appearance",
      appearance,
    );
    await page.screenshot({
      path: info.outputPath(`${appearance}-offline.png`),
    });
    expect(errors).toEqual([]);
  });
}
test("light remains default even with operating-system dark preference", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.removeItem("atomic-bond-appearance"),
  );
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/about");
  await expect(page.locator("html")).toHaveAttribute(
    "data-appearance",
    "light",
  );
});
