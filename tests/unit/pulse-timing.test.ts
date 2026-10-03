import { describe, expect, it } from "vitest";
import {
  ACTION_DURATION_MS,
  pulseStepMs,
  pulseSteps,
} from "../../src/living-atom/pulse/traversal";
import { pulsePhase } from "../../src/living-atom/pulse/presentation";
import { generateMockGraph, mockAtomId } from "../../src/data/mock/graph";
import { createScene } from "../../src/living-atom/layout/scene";

describe("six-second complete Pulse propagation", () => {
  it("scales both shallow and deep traversal proportionally rather than clipping the old sequence", () => {
    expect(ACTION_DURATION_MS).toBe(6_000);
    for (const depth of [0, 1, 12, 24, 40, 200, 4999]) {
      const oldStep = Math.min(
        600,
        Math.max(1, Math.floor(15_000 / (depth + 1))),
      );
      const step = pulseStepMs(depth);
      // Integer timer rounding may differ by less than a millisecond.
      expect(Math.abs(step - oldStep * 0.4)).toBeLessThan(1);
      expect((depth + 1) * step).toBeLessThanOrEqual(ACTION_DURATION_MS);
      expect(pulsePhase(depth * step, (depth + 1) * step, false, step)).toBe(1);
      expect(pulsePhase(depth * step, depth * step, true, step)).toBe(1);
    }
  });
  it("reaches every intended Atom in BFS order before settling in the deterministic network", () => {
    const scene = createScene(generateMockGraph(), mockAtomId(0), true);
    const steps = pulseSteps(scene);
    const stepMs = pulseStepMs(scene.maxDistance);
    expect(steps.map((s) => s.distance)).toEqual(
      Array.from({ length: scene.maxDistance + 1 }, (_, i) => i),
    );
    expect(steps.reduce((sum, s) => sum + s.atomCount, 0)).toBe(640);
    expect((steps.at(-1)!.distance + 1) * stepMs).toBeLessThanOrEqual(6_000);
  });
});
