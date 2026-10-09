import { describe, expect, it } from "vitest";
import {
  DURATION,
  FRAME,
  PALETTE,
  SCENES,
  STORY_ATOMS,
  sampleTimeline,
} from "../../src/prototypes/introduction/timeline";
import { EMOTION_DEFINITIONS } from "../../src/living-atom/pulse/emotions";

describe("isolated introduction timeline", () => {
  it("has an exact 25-second, 16:9 source and the five approved windows", () => {
    expect(DURATION).toBe(25);
    expect(FRAME).toEqual({ width: 1920, height: 1080 });
    expect(SCENES.map((s) => [s.start, s.end])).toEqual([
      [0, 4],
      [4, 8],
      [8, 15],
      [15, 21],
      [21, 25],
    ]);
    expect(sampleTimeline(100).time).toBe(25);
    expect(sampleTimeline(-1).time).toBe(0);
    expect(sampleTimeline(NaN).time).toBe(0);
    expect(sampleTimeline(25).sceneIndex).toBe(4);
    expect(sampleTimeline(25).textOpacity).toBe(1);
  });
  it("creates a connected branching tree through existing people", () => {
    expect(sampleTimeline(3).nodes).toHaveLength(1);
    expect(sampleTimeline(7.9).nodes).toHaveLength(2);
    expect(sampleTimeline(8.01).nodes).toHaveLength(3);
    expect(sampleTimeline(15).nodes).toHaveLength(72);
    expect(STORY_ATOMS.filter((n) => n.parent === 0)).toHaveLength(1);
    for (const node of STORY_ATOMS.slice(1)) {
      expect(node.parent).not.toBeNull();
      expect(node.parent!).toBeLessThan(node.index);
      expect(STORY_ATOMS[node.parent!]!.birth).toBeLessThan(node.birth);
    }
  });
  it("is seek-order independent and finishes geography before the end card", () => {
    const first = JSON.stringify(sampleTimeline(11.25));
    sampleTimeline(24);
    sampleTimeline(2);
    sampleTimeline(19);
    expect(JSON.stringify(sampleTimeline(11.25))).toBe(first);
    expect(sampleTimeline(15).map).toBe(0);
    expect(sampleTimeline(20).map).toBe(1);
    expect(sampleTimeline(21).finale).toBe(0);
    expect(sampleTimeline(25).finale).toBe(1);
  });
  it("uses the current 24-color palette without identities or production fields", () => {
    expect(PALETTE).toHaveLength(24);
    expect(PALETTE).toEqual(
      Object.values(EMOTION_DEFINITIONS)
        .slice(0, 24)
        .map((e) => e.color),
    );
    for (const node of STORY_ATOMS) {
      expect(Object.keys(node).sort()).toEqual([
        "birth",
        "color",
        "index",
        "latitude",
        "longitude",
        "parent",
        "x",
        "y",
      ]);
      expect(PALETTE).toContain(node.color);
    }
  });
});
