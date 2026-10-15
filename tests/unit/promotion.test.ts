import { describe, it, expect } from "vitest";
import {
  DURATION,
  FPS,
  FRAMES,
  frameTime,
  sampleTimeline,
  SCENES,
} from "../../src/prototypes/promotion/timeline";
describe("campaign timeline", () => {
  it("has exactly 900 frames and contiguous 30-second scene windows", () => {
    expect(FRAMES).toBe(900);
    expect(FRAMES / FPS).toBe(DURATION);
    expect(SCENES.map((s) => [s.start, s.end])).toEqual([
      [0, 5],
      [5, 10],
      [10, 16],
      [16, 23],
      [23, 30],
    ]);
    expect(frameTime(899)).toBe(899 / 30);
  });
  it("seeks deterministically and clamps invalid input", () => {
    for (const t of [0, 5, 10, 16, 23, 30])
      expect(sampleTimeline(t)).toEqual(sampleTimeline(t));
    expect(sampleTimeline(NaN).time).toBe(0);
    expect(sampleTimeline(99).sceneIndex).toBe(4);
    expect([0, 5, 10, 16, 23].map((t) => sampleTimeline(t).sceneIndex)).toEqual(
      [0, 1, 2, 3, 4],
    );
  });
});
