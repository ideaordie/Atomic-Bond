import { describe, expect, it } from "vitest";
import { SCIENTIFIC_PALETTE } from "../../src/living-atom/renderer/scientific-palette";
import {
  EMOTION_DEFINITIONS,
  NEUTRAL_EMOTION_COLOR,
} from "../../src/living-atom/pulse/emotions";
import { EMOTIONS } from "../../src/types/emotional-pulse";

describe("monochrome presentation preserves expressive Pulse colors", () => {
  it("keeps all structural materials neutral", () => {
    for (const color of [
      ...Object.values(SCIENTIFIC_PALETTE).flat(),
      NEUTRAL_EMOTION_COLOR,
    ]) {
      expect(color.slice(1, 3)).toBe(color.slice(3, 5));
      expect(color.slice(3, 5)).toBe(color.slice(5, 7));
    }
  });
  it("retains the exact 24 approved state colors", () => {
    expect(EMOTIONS.map((state) => EMOTION_DEFINITIONS[state].color)).toEqual([
      "#F4C400",
      "#FF7417",
      "#00B9E8",
      "#00BEAC",
      "#47BB53",
      "#3266E3",
      "#8951E8",
      "#EB4932",
      "#A6CB00",
      "#0088C4",
      "#00A874",
      "#E32AB4",
      "#6461BB",
      "#766078",
      "#B64DEA",
      "#B48DCA",
      "#73CFF0",
      "#F59127",
      "#DFA000",
      "#EF599B",
      "#A87535",
      "#CEAE55",
      "#B9C63C",
      "#7896AC",
    ]);
  });
});
