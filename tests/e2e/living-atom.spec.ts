import {
  ACTION_DURATION_MS,
  pulseStepMs,
} from "../../src/living-atom/pulse/traversal";
import { sendEmotionalPulse } from "./pulse-helpers";
import { expect, test } from "@playwright/test";
import { generateMockGraph, mockAtomId } from "../../src/data/mock/graph";
import { createScene } from "../../src/living-atom/layout/scene";
import { createSpatialScene } from "../../src/living-atom/layout/spatial";
import { projectPoint } from "../../src/living-atom/renderer/projection";
import { INITIAL_CAMERA } from "../../src/living-atom/interaction/camera";

const graph = generateMockGraph();
const scene = createSpatialScene(
  createScene(graph, mockAtomId(0)),
  graph,
  "networks",
);

test("Living Atom renders, recenters, returns home and supports view controls", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/explore");
  const canvas = page.getByTestId("atom-canvas");
  await expect(canvas).toHaveAttribute("data-motion", "still");
  await expect(page.getByTestId("selected-atom")).toHaveText("#00000001");
  await expect(page.getByTestId("direct-count")).toHaveText("12");
  await expect(page.getByTestId("reachable-count")).toHaveText("640");
  await page.getByRole("button", { name: "Explore Atoms" }).click();
  await page.getByText("Network details", { exact: true }).click();
  await expect(page.getByTestId("represented-count")).toHaveText("221");
  await expect(page.getByTestId("max-degree")).toHaveText("8");
  await expect(
    page.getByRole("button", { name: "Motion reduced" }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);

  await page.getByRole("button", { name: "Close exploration tools" }).click();

  // Click a real drawn node using the public scene projection, not a test-only UI hook.
  const target = scene.nodes.find(
    (node) => node.members[0] === mockAtomId(180),
  )!;
  const bounds = (await canvas.boundingBox())!;
  const point = projectPoint(
    target,
    bounds.width,
    bounds.height,
    scene.extent,
    INITIAL_CAMERA,
  ).point;
  await canvas.click({ position: point });
  await expect(page.getByTestId("selected-atom")).toHaveText("#00000001");
  await expect(page.getByTestId("relationship")).toHaveText(
    "Directly Bonded to you",
  );
  await page.getByRole("button", { name: "View their network" }).click();
  await expect(page.getByTestId("selected-atom")).toHaveText("#00000181");
  await expect(page.getByTestId("direct-count")).toHaveText("12");
  await expect(canvas).toHaveAttribute("data-pan", "0,0");
  await page.getByRole("button", { name: "My Atom" }).click();
  await expect(page.getByTestId("selected-atom")).toHaveText("#00000001");
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-zoom", "1.25");
  await canvas.focus();
  await page.keyboard.press("ArrowRight");
  await expect(canvas).toHaveAttribute("data-pan", "-30,0");
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-pan", "0,0");
  await expect(canvas).toHaveAttribute("data-zoom", "1.00");

  await page.getByRole("button", { name: "Explore Atoms" }).click();
  await page
    .getByLabel("Select an Atom", { exact: true })
    .selectOption(mockAtomId(1));
  await expect(page.getByTestId("selected-atom")).toHaveText("#00000001");
  await page.getByRole("button", { name: "View their network" }).click();
  await expect(page.getByTestId("selected-atom")).toHaveText("#00000002");
  await expect(page.getByTestId("direct-count")).toHaveText("10");
  await page.getByRole("button", { name: "My Atom" }).click();
  await page.getByRole("button", { name: "Explore Atoms" }).click();
  await page.getByText("Explore grouped Atoms", { exact: true }).click();
  const groupMember = scene.nodes.find((node) => node.kind === "aggregate")!
    .members[0]!;
  await page.getByLabel("Select a grouped Atom").selectOption(groupMember);
  await expect(canvas).toHaveAttribute("data-center", mockAtomId(0));
  await expect(page.getByTestId("relationship")).toContainText(
    "Bonds from you",
  );
  await page.getByRole("button", { name: "View their network" }).click();
  await expect(canvas).toHaveAttribute("data-center", groupMember);
  await expect(canvas).toHaveAttribute("data-pan", "0,0");
  await page.getByRole("button", { name: "My Atom" }).click();
  await canvas.scrollIntoViewIfNeeded();
  // Pixel stability also verifies no hidden continuous motion in reduced-motion mode.
  const first = await canvas.screenshot();
  await page.waitForTimeout(150);
  expect(await canvas.screenshot()).toEqual(first);
  await page.screenshot({
    path: testInfo.outputPath("living-atom.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("Pulse advances by degree and recentering cancels the old traversal", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/explore");
  await page.clock.install({ time: new Date("2026-09-21T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-09-21T00:00:01Z"));
  await sendEmotionalPulse(page);
  const status = page.getByTestId("pulse-status");
  await expect(status).toHaveAttribute("data-degree", "0");
  const pulseFrames: string[] = [];
  for (
    let distance = 1;
    distance <= createScene(graph, mockAtomId(0), true).maxDistance;
    distance++
  ) {
    await page.clock.runFor(
      pulseStepMs(
        createScene(generateMockGraph(), mockAtomId(0), true).maxDistance,
      ),
    );
    await expect(status).toHaveAttribute("data-degree", String(distance));
    if (distance <= 2) {
      await page.clock.runFor(20);
      pulseFrames.push(
        await page
          .getByTestId("atom-canvas")
          .evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL()),
      );
    }
  }
  expect(pulseFrames[0]).not.toEqual(pulseFrames[1]);
  await page.clock.runFor(
    pulseStepMs(
      createScene(generateMockGraph(), mockAtomId(0), true).maxDistance,
    ),
  );
  await page.clock.fastForward(ACTION_DURATION_MS);
  await expect(status).toContainText("Pulse complete");
  await sendEmotionalPulse(page);
  await page.clock.runFor(
    pulseStepMs(
      createScene(generateMockGraph(), mockAtomId(0), true).maxDistance,
    ),
  );
  await page.getByRole("button", { name: "Explore Atoms" }).click();
  await page
    .getByLabel("Select an Atom", { exact: true })
    .selectOption(mockAtomId(1));
  await expect(page.getByTestId("selected-atom")).toHaveText("#00000001");
  await expect(status).toHaveAttribute("data-degree", "1");
  await page.getByRole("button", { name: "View their network" }).click();
  await expect(status).toHaveAttribute("data-degree", "idle");
  await page.clock.runFor(1200);
  await expect(status).toHaveAttribute("data-degree", "idle");
});

test("motion can be paused and responds to changed system preferences", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/explore");
  const canvas = page.getByTestId("atom-canvas");
  await expect(canvas).toHaveAttribute("data-motion", "gentle");
  await page.getByRole("button", { name: "Explore Atoms" }).click();
  await page.getByRole("button", { name: "Pause motion" }).click();
  await expect(canvas).toHaveAttribute("data-motion", "still");
  await page.getByRole("button", { name: "Resume motion" }).click();
  await expect(canvas).toHaveAttribute("data-motion", "gentle");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(canvas).toHaveAttribute("data-motion", "still");
});

test.describe("touch interaction", () => {
  test.use({ hasTouch: true });
  test("supports tapping an Atom, dragging and a two-finger pinch", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/explore");
    const canvas = page.getByTestId("atom-canvas");
    await canvas.scrollIntoViewIfNeeded();
    const bounds = (await canvas.boundingBox())!;
    const target = scene.nodes.find(
      (node) => node.members[0] === mockAtomId(180),
    )!;
    const point = projectPoint(
      target,
      bounds.width,
      bounds.height,
      scene.extent,
      INITIAL_CAMERA,
    ).point;
    await page.touchscreen.tap(bounds.x + point.x, bounds.y + point.y);
    await expect(page.getByTestId("selected-atom")).toHaveText("#00000001");
    await page.getByRole("button", { name: "View their network" }).click();
    await expect(page.getByTestId("selected-atom")).toHaveText("#00000181");

    await canvas.scrollIntoViewIfNeeded();
    const rect = (await canvas.boundingBox())!;
    const x = rect.x + rect.width / 2;
    const y = rect.y + rect.height / 2;
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, id: 1 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + 40, y: y + 20, id: 1 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(canvas).not.toHaveAttribute("data-pan", "0,0");
    await expect(page.getByTestId("selected-atom")).toHaveText("#00000181");
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: x - 30, y, id: 1 },
        { x: x + 30, y, id: 2 },
      ],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: x - 60, y, id: 1 },
        { x: x + 60, y, id: 2 },
      ],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-zoom")))
      .toBeGreaterThan(1.5);
    await session.detach();
  });
});

test("spatial views remain usable and provide review captures", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install({ time: new Date("2026-09-21T00:00:00Z") });
  await page.goto("/explore");
  const canvas = page.getByTestId("atom-canvas");
  const capture = async (name: string) => {
    await page.screenshot({
      path: testInfo.outputPath(`${name}.png`),
      fullPage: true,
    });
  };
  await expect(canvas).toHaveAttribute("data-representation", "networks");
  await capture("initial");
  await page.getByRole("button", { name: "Explore Atoms" }).click();
  await page
    .getByLabel("Select an Atom", { exact: true })
    .selectOption(mockAtomId(180));
  await expect(page.getByTestId("relationship")).toHaveText(
    "Directly Bonded to you",
  );
  const panel = (await page.getByTestId("atom-context").boundingBox())!;
  expect(panel.height).toBeLessThan(page.viewportSize()!.height / 3);
  await capture("selected-direct");
  await page.getByRole("button", { name: "Close selected Atom" }).click();
  await page.getByRole("button", { name: "Explore Atoms" }).click();
  await page.getByText("Explore grouped Atoms", { exact: true }).click();
  const group = scene.nodes.find(
    (node) => node.kind === "aggregate" && node.distance >= 4,
  )!;
  await page
    .getByLabel("Network group", { exact: true })
    .selectOption(group.id);
  await page
    .getByLabel("Select a grouped Atom")
    .selectOption(group.members[0]!);
  await expect(page.getByTestId("relationship")).toContainText(
    `${group.distance} Bonds from you`,
  );
  await expect(page.getByLabel(/Relationship path:/)).toBeVisible();
  await capture("selected-distant");
  await page.getByRole("button", { name: "Close selected Atom" }).click();
  await page.clock.pauseAt(new Date("2026-09-21T00:00:10Z"));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(canvas).toHaveAttribute("data-motion", "gentle");
  await page.clock.runFor(50);
  await sendEmotionalPulse(page);
  await page.clock.runFor(
    Math.ceil(
      pulseStepMs(
        createScene(generateMockGraph(), mockAtomId(0), true).maxDistance,
      ) * 1.25,
    ),
  );
  await expect(page.getByTestId("pulse-status")).toHaveAttribute(
    "data-degree",
    "1",
  );
  const midway = await canvas.evaluate((node) =>
    (node as HTMLCanvasElement).toDataURL(),
  );
  await capture("pulse");
  await page.clock.runFor(180);
  const later = await canvas.evaluate((node) =>
    (node as HTMLCanvasElement).toDataURL(),
  );
  expect(
    later !== midway,
    "moving Pulse changes the rendered frame within a graph step",
  ).toBe(true);
  await page.getByRole("button", { name: "Stop Pulse" }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.clock.runFor(50);
  await expect(canvas).toHaveAttribute("data-representation", "networks");
  await capture("medium-zoom");
  await page.getByRole("button", { name: "People", exact: true }).click();
  await page.clock.runFor(50);
  await expect(canvas).toHaveAttribute("data-representation", "people");
  await capture("near-people");
  await page.getByRole("button", { name: "Regions", exact: true }).click();
  await page.clock.runFor(50);
  await expect(canvas).toHaveAttribute("data-representation", "regions");
  await capture("far-regions");
  await page.getByRole("button", { name: "My Atom" }).click();
  await expect(canvas).toHaveAttribute("data-representation", "networks");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
