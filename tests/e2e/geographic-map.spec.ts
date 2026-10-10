import { readFileSync } from "node:fs";
import { mapScreen } from "../../src/living-atom/geography/paint";
import { geographicPoint } from "../../src/living-atom/geography/layout";
import { test, expect } from "@playwright/test";
import { setMotion } from "./motion-helpers";
import { sendEmotionalPulse } from "./pulse-helpers";

for (const theme of ["light", "dark"])
  test(`geographic map preserves cameras and topology in ${theme}`, async ({
    page,
  }, info) => {
    await page.addInitScript(
      (value) => localStorage.setItem("atomic-bond-appearance", value),
      theme,
    );
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/explore");
    const canvas = page.getByTestId("atom-canvas");
    await expect(canvas).toHaveAttribute("data-layout", "orbital");
    const count = await page.getByTestId("reachable-count").innerText();
    const center = await canvas.getAttribute("data-center");
    await page.getByRole("button", { name: "Zoom in" }).click();
    const zoom = await canvas.getAttribute("data-zoom");
    await page.getByRole("button", { name: "SHOW MAP", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-layout", "geographic");
    await expect(canvas).toHaveAttribute("data-motion", "still");
    await expect(canvas).toHaveAttribute("data-zoom", "1.00");
    await expect(canvas).toHaveAttribute("data-map-progress", "1.000");
    const clusters = page.getByLabel("Geographic clusters", { exact: true });
    await expect(clusters.locator("option")).toHaveCount(4);
    const geography = JSON.parse(
      readFileSync("public/geography/world-v1.json", "utf8"),
    );
    const bounds = (await canvas.boundingBox())!;
    const marker = mapScreen(
      geographicPoint(geography.anchors.CA),
      bounds.width,
      bounds.height,
      { zoom: 1, x: 0, y: 0 },
    );
    await canvas.click({ position: marker });
    await expect(clusters).not.toHaveValue("");

    await expect(page.getByLabel("Inspect cluster member")).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`${theme}-cluster.png`),
      fullPage: true,
    });
    await page.getByLabel("Inspect cluster member").selectOption({ index: 2 });
    await expect(
      page.getByRole("button", { name: "View their network" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Close selected Atom", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Close cluster", exact: true })
      .click();
    await page.screenshot({
      path: info.outputPath(`${theme}-map.png`),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.getByRole("button", { name: "HIDE MAP", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-zoom", zoom!);
    await expect(canvas).toHaveAttribute("data-center", center!);
    await expect(page.getByTestId("reachable-count")).toHaveText(count);
    for (let i = 0; i < 3; i++) {
      await page.getByRole("button", { name: "SHOW MAP", exact: true }).click();
      await page.getByRole("button", { name: "HIDE MAP", exact: true }).click();
    }
    await setMotion(page, false);
    await expect(canvas).toHaveAttribute("data-motion", "still");
    await page.getByRole("button", { name: "SHOW MAP", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-layout", "geographic");
    await page.getByRole("button", { name: "HIDE MAP", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-motion", "still");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByRole("button", { name: "SHOW MAP", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-layout", "geographic");
    const selector = page.getByLabel("Select an Atom", { exact: true });
    const id = await selector.locator("option").nth(2).getAttribute("value");
    await selector.selectOption(id!);
    await expect(
      page.getByRole("button", { name: "View their network" }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

test("map transition preserves Pulse progress and settles without continuous painting", async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    const state = window as unknown as { mapPaints: number[] };
    state.mapPaints = [];
    const clear = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      if (this.canvas.dataset.testid === "atom-canvas")
        state.mapPaints.push(performance.now());
      return clear.apply(this, args);
    };
  });
  await page.goto("/explore");
  await page.getByRole("button", { name: "SHOW MAP", exact: true }).click();
  await expect(page.getByTestId("atom-canvas")).toHaveAttribute(
    "data-layout",
    "geographic",
  );
  await expect(page.getByTestId("atom-canvas")).toHaveAttribute(
    "data-map-progress",
    "1.000",
  );
  const times = await page.evaluate(
    () => (window as unknown as { mapPaints: number[] }).mapPaints,
  );
  const intervals = times
    .slice(1)
    .map((t, i) => t - times[i]!)
    .filter((dt) => dt > 0 && dt < 150);
  const median =
    intervals.sort((a, b) => a - b)[Math.floor(intervals.length / 2)] ?? 0;
  console.info(
    "MAP_TIMING",
    JSON.stringify({
      viewport: info.project.name,
      medianFrameMs: median,
      approximateFps: median ? 1000 / median : 0,
    }),
  );
  await info.attach("map-frame-timing", {
    body: JSON.stringify({
      paints: times.length,
      medianFrameMs: median,
      approximateFps: median ? 1000 / median : 0,
    }),
    contentType: "application/json",
  });
  const paints = times.length;
  await page.waitForTimeout(700);
  expect(
    await page.evaluate(
      () => (window as unknown as { mapPaints: number[] }).mapPaints.length,
    ),
  ).toBe(paints);
  await sendEmotionalPulse(page, "Joyful");
  const status = page.getByTestId("pulse-status");
  await page.waitForTimeout(1200);
  const before = Number(await status.getAttribute("data-degree"));
  await page.getByRole("button", { name: "HIDE MAP", exact: true }).click();
  await page.getByRole("button", { name: "SHOW MAP", exact: true }).click();
  const after = Number(await status.getAttribute("data-degree"));
  expect(after).toBeGreaterThanOrEqual(before);
  await expect(status).toContainText("Pulse complete", { timeout: 8000 });
  await expect(page.getByTestId("own-pulse")).toContainText("Joyful");
});
