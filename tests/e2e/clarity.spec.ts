import { expect, test } from "@playwright/test";

test("network panels fit breakpoint widths and recover after orientation", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/explore");
  for (const width of [390, 599, 600, 601, 767, 768, 900]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: /YOUR NETWORK OVERVIEW/ }).click();
    const details = page.getByRole("region", {
      name: "Your Network Overview details",
    });
    const box = (await details.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.x + box.width / 2).toBeCloseTo(width / 2, 0);
    expect(box.y + box.height / 2).toBeCloseTo(844 / 2, 0);
    expect(
      await details.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Close Your Network Overview" })
      .click();
  }
  await page.setViewportSize({ width: 844, height: 390 });
  await page.getByRole("button", { name: "Pulse", exact: true }).click();
  const composer = page.getByRole("dialog", { name: "How are you feeling?" });
  await expect(composer.getByRole("radio")).toHaveCount(8);
  await composer.getByRole("radio", { name: "Curious", exact: true }).check();
  await composer
    .getByRole("button", { name: "Send Pulse" })
    .scrollIntoViewIfNeeded();
  await expect(
    composer.getByRole("button", { name: "Send Pulse" }),
  ).toBeInViewport();
  expect(
    await composer.evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page.setViewportSize(info.project.use.viewport!);
  await page.screenshot({
    path: info.outputPath("emotion-selector.png"),
    fullPage: true,
  });
  await composer.getByRole("button", { name: "Cancel" }).click();
  await expect(
    page.getByRole("button", { name: "Pulse", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: /YOUR NETWORK OVERVIEW/ }).click();
  const results = page.getByRole("region", {
    name: "Your Network Overview details",
  });
  // Text-only stress: large counts must not collide with labels or escape the panel.
  await page.getByTestId("active-pulse-count").evaluate((el) => {
    el.textContent = "9,999,999 active Pulses · 99,999,999 connected Atoms";
  });
  await results
    .locator(".emotion-distribution li > span:last-child")
    .evaluateAll((els) => {
      for (const el of els) el.textContent = "9,999,999 · 100.0%";
    });
  expect(await results.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  const resultsBox = (await results.boundingBox())!;
  expect(resultsBox.x + resultsBox.width / 2).toBeCloseTo(
    page.viewportSize()!.width / 2,
    0,
  );
  expect(resultsBox.y + resultsBox.height / 2).toBeCloseTo(
    page.viewportSize()!.height / 2,
    0,
  );
  await page.screenshot({
    path: info.outputPath("centered-overview.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Close Your Network Overview" })
    .click();
  await page.getByLabel("Select an Atom", { exact: true }).focus();
  await page
    .getByLabel("Select an Atom", { exact: true })
    .selectOption("mock-atom-00000002");
  const panel = page.getByTestId("atom-context");
  // Text-only stress for the database bigint range and future large counts.
  await panel.getByRole("heading").evaluate((el) => {
    el.textContent = "ATOM #9223372036854775807";
  });
  await panel
    .locator(".context-metrics dd")
    .first()
    .evaluate((el) => {
      el.textContent = "9,999,999 people";
    });
  expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: info.outputPath("selected-long-number.png"),
    fullPage: true,
  });
  await panel.getByRole("button", { name: "View their network" }).click();
  await page.getByRole("button", { name: "My Atom", exact: true }).click();
  await expect(page.getByTestId("selected-atom")).toHaveText("#00000001");
});
