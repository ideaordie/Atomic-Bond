import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { geographicPoint } from "../../src/living-atom/geography/layout";
import { mapScreen } from "../../src/living-atom/geography/paint";

for (const theme of ["light", "dark"])
  test(`map zoom range and input consistency in ${theme}`, async ({
    page,
  }, info) => {
    await page.addInitScript(
      (value) => localStorage.setItem("atomic-bond-appearance", value),
      theme,
    );
    await page.goto("/explore");
    await page.getByRole("button", { name: "SHOW MAP", exact: true }).click();
    const canvas = page.getByTestId("atom-canvas");
    await expect(canvas).toHaveAttribute("data-map-progress", "1.000");
    const reset = page.getByRole("button", { name: "Fit", exact: true });
    await page.screenshot({
      path: info.outputPath("default.png"),
      fullPage: true,
    });
    for (let i = 0; i < 12; i++)
      await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-zoom", "8.00");
    await page.screenshot({
      path: info.outputPath("maximum.png"),
      fullPage: true,
    });
    for (let i = 0; i < 12; i++)
      await page.getByRole("button", { name: "Zoom out", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-zoom", "1.00");
    await page.screenshot({
      path: info.outputPath("minimum.png"),
      fullPage: true,
    });
    const box = (await canvas.boundingBox())!;
    const geography = JSON.parse(
      readFileSync("public/geography/world-v1.json", "utf8"),
    );
    let outside = 0;
    for (const ring of geography.outlines)
      for (const coordinate of ring) {
        const point = mapScreen(
          geographicPoint(coordinate),
          box.width,
          box.height,
          { zoom: 1, x: 0, y: 0 },
        );
        if (
          point.x < 0 ||
          point.x > box.width ||
          point.y < 0 ||
          point.y > box.height
        )
          outside++;
      }
    expect(outside).toBe(0);
    await canvas.focus();
    for (let i = 0; i < 12; i++) await page.keyboard.press("+");
    await expect(canvas).toHaveAttribute("data-zoom", "8.00");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, 100);
      await page.waitForTimeout(20);
    }
    await expect(canvas).toHaveAttribute("data-zoom", "1.00");
    const session = await page.context().newCDPSession(page);
    const x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    const pinch = async (from: number, to: number) => {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { x: x - from, y, id: 1 },
          { x: x + from, y, id: 2 },
        ],
      });
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: x - to, y, id: 1 },
          { x: x + to, y, id: 2 },
        ],
      });
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    };
    await pinch(10, 120);
    await expect(canvas).toHaveAttribute("data-zoom", "8.00");
    await pinch(120, 10);
    await expect(canvas).toHaveAttribute("data-zoom", "1.00");
    await canvas.focus();
    await page.keyboard.press("ArrowRight");
    await expect(canvas).not.toHaveAttribute("data-pan", "0,0");
    await reset.click();
    await expect(canvas).toHaveAttribute("data-pan", "0,0");
    await expect(canvas).toHaveAttribute("data-zoom", "1.00");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
