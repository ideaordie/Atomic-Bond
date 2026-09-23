import { expect, test } from "@playwright/test";

test("ambient motion advances, freezes in place, resumes smoothly and leaves Pulse independent", async ({
  page,
}) => {
  // This exercises over 19 seconds of animation, including every scheduled frame.
  test.setTimeout(60_000);
  // Observe real Canvas drawing, without a production-only testing API or React frame state.
  await page.addInitScript(() => {
    type Probe = { nodes: number[][]; center: number[]; paints: number };
    const state = window as unknown as { motionProbe: Probe };
    state.motionProbe = { nodes: [], center: [], paints: 0 };
    let arc: number[] = [];
    const originalClear = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      if (this.canvas.dataset.testid === "atom-canvas") {
        state.motionProbe = {
          nodes: [],
          center: [],
          paints: state.motionProbe.paints + 1,
        };
      }
      return originalClear.apply(this, args);
    };
    const originalArc = CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc = function (...args) {
      arc = args.slice(0, 3) as number[];
      return originalArc.apply(this, args);
    };
    const originalStroke = CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke = function (
      ...args: [] | [Path2D]
    ) {
      if (this.canvas.dataset.testid === "atom-canvas") {
        if (Math.abs(this.lineWidth - 0.8) < 0.001)
          state.motionProbe.nodes.push([...arc]);
        if (Math.abs(this.lineWidth - 1.15) < 0.001)
          state.motionProbe.center = [...arc];
      }
      return Reflect.apply(originalStroke, this, args);
    };
  });
  await page.clock.install({ time: new Date("2026-09-21T00:00:00Z") });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/explore");
  const canvas = page.getByTestId("atom-canvas");
  await expect(canvas).toHaveAttribute("data-motion", "gentle");
  await page.clock.pauseAt(new Date("2026-09-21T00:00:05Z"));
  await page.clock.runFor(50);
  const sample = () =>
    page.evaluate(() => {
      const state = window as unknown as {
        motionProbe: { nodes: number[][]; center: number[]; paints: number };
      };
      return {
        ...state.motionProbe,
        nodes: [...state.motionProbe.nodes].sort((a, b) => a[0]! - b[0]!),
      };
    });
  const pixels = () =>
    canvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL());
  const start = await sample();
  expect(start.nodes.length).toBeGreaterThan(12);
  await page.clock.runFor(10_000);
  const moved = await sample();
  expect(moved.paints - start.paints).toBeGreaterThan(200);
  expect(moved.nodes).not.toEqual(start.nodes);
  expect(moved.center).toEqual(start.center);
  const bounds = (await canvas.boundingBox())!;
  expect(moved.center[0]).toBeCloseTo(bounds.width / 2, 1);
  expect(moved.center[1]).toBeCloseTo(bounds.height / 2, 1);

  await page.getByRole("button", { name: "Explore Atoms" }).click();
  await page.clock.runFor(50);
  const beforePause = await sample();
  await page.getByRole("button", { name: "Pause motion", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-motion", "still");
  await page.clock.runFor(50);
  const frozen = await sample();
  expect(frozen.nodes).toEqual(beforePause.nodes);
  const stillPixels = await pixels();
  await page.clock.runFor(2000);
  expect((await sample()).paints).toBe(frozen.paints);
  expect(
    (await pixels()) === stillPixels,
    "paused ambient frame stays pixel-identical",
  ).toBe(true);

  await page
    .getByRole("button", { name: "Resume motion", exact: true })
    .click();
  await expect(canvas).toHaveAttribute("data-motion", "gentle");
  await page.clock.runFor(16);
  expect((await sample()).nodes).toEqual(frozen.nodes);
  await page.clock.runFor(1000);
  const resumed = await sample();
  expect(resumed.nodes).not.toEqual(frozen.nodes);
  const nearestDisplacements = resumed.nodes.map((node) =>
    Math.min(
      ...frozen.nodes.map((old) =>
        Math.hypot(node[0]! - old[0]!, node[1]! - old[1]!),
      ),
    ),
  );
  expect(Math.max(...nearestDisplacements)).toBeLessThan(8);

  // Pulse energy still travels while ambient time is paused.
  await page.getByRole("button", { name: "Pause motion", exact: true }).click();
  await page.clock.runFor(50);
  const pausedNodes = (await sample()).nodes;
  await page.getByRole("button", { name: "Send Pulse", exact: true }).click();
  await page.clock.runFor(900);
  await expect(page.getByTestId("pulse-status")).toHaveAttribute(
    "data-degree",
    "1",
  );
  const pulsePixels = await pixels();
  await page.clock.runFor(150);
  expect(
    (await pixels()) !== pulsePixels,
    "Pulse travels while ambient positions are frozen",
  ).toBe(true);
  expect((await sample()).nodes).toEqual(pausedNodes);
  await page
    .getByRole("button", { name: "Resume motion", exact: true })
    .click();
  await page.clock.runFor(600);
  await expect(page.getByTestId("pulse-status")).toHaveAttribute(
    "data-degree",
    "2",
  );
  expect((await sample()).nodes).not.toEqual(pausedNodes);
  await page.clock.runFor(4000);
  await expect(page.getByTestId("pulse-status")).toContainText(
    "Pulse complete",
  );

  // Live accessibility changes freeze the current arrangement, not the initial layout.
  const beforeReduced = await sample();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(canvas).toHaveAttribute("data-motion", "still");
  await expect(
    page.getByRole("button", { name: "Motion reduced" }),
  ).toBeDisabled();
  await page.clock.runFor(50);
  expect((await sample()).nodes).toEqual(beforeReduced.nodes);
  const reducedPixels = await pixels();
  await page.clock.runFor(1000);
  expect((await pixels()) === reducedPixels).toBe(true);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(canvas).toHaveAttribute("data-motion", "gentle");
  await page.getByRole("button", { name: "Close exploration tools" }).click();
  await page.clock.runFor(50);

  // Selection uses the currently drawn position, not the static layout.
  const visible = (await sample()).nodes.find(
    (node) =>
      node[0]! > 70 &&
      node[0]! < bounds.width - 70 &&
      node[1]! > bounds.height * 0.35 &&
      node[1]! < bounds.height * 0.65,
  )!;
  await canvas.click({ position: { x: visible[0]!, y: visible[1]! } });
  await expect(page.getByTestId("atom-context")).toBeVisible();
  await expect(page.getByTestId("selected-atom")).toHaveText("#00000001");
  await page.getByRole("button", { name: "View their network" }).click();
  await expect(page.getByTestId("selected-atom")).not.toHaveText("#00000001");
  await page.getByRole("button", { name: "My Atom" }).click();
  await expect(page.getByTestId("selected-atom")).toHaveText("#00000001");
});
