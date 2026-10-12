import { describe, expect, it } from "vitest";
import {
  activeDoodles,
  BYTES,
  decode,
  DoodleEditor,
  dotCount,
  encode,
  hasDot,
  line,
  LIFETIME,
  MAX_FEED,
  MAX_STROKES,
  MAX_UNDO,
  replayFrame,
  submitDoodle,
} from "../../src/prototypes/doodle/model";
import { demoDoodles } from "../../src/prototypes/doodle/fixtures";

describe("local Global Doodle", () => {
  it("encodes all 4096 points in exactly 512 bytes and round-trips", () => {
    const bits = new Uint8Array(BYTES).fill(255);
    expect(dotCount(bits)).toBe(4096);
    expect(encode(bits)).toHaveLength(684);
    expect(decode(encode(bits))).toEqual(bits);
    expect(() => decode("bad")).toThrow();
    expect(() => encode(new Uint8Array(1))).toThrow();
  });
  it("interpolates fast diagonal and horizontal strokes without gaps", () => {
    expect(line(0, 4095)).toEqual(Array.from({ length: 64 }, (_, i) => i * 65));
    expect(line(63, 0)).toHaveLength(64);
    expect(() => line(-1, 64)).toThrow();
    const editor = new DoodleEditor();
    editor.begin(0, true);
    editor.move(63);
    editor.finish();
    expect(dotCount(editor.bits)).toBe(64);
    editor.undo();
    expect(dotCount(editor.bits)).toBe(0);
  });
  it("erases whole strokes, ignores no-op strokes and restores cancelled gestures", () => {
    const editor = new DoodleEditor();
    editor.begin(0, true);
    editor.move(63);
    editor.finish();
    editor.begin(0, false);
    editor.move(31);
    editor.finish();
    expect(dotCount(editor.bits)).toBe(32);
    editor.undo();
    expect(dotCount(editor.bits)).toBe(64);
    editor.begin(0, true);
    editor.finish();
    editor.undo();
    expect(dotCount(editor.bits)).toBe(0);
    editor.begin(30, true);
    editor.move(45);
    editor.finish(true);
    expect(dotCount(editor.bits)).toBe(0);
  });
  it("clear can be undone without corrupting deterministic replay", () => {
    const editor = new DoodleEditor();
    editor.begin(0, true);
    editor.move(10);
    editor.finish();
    const before = editor.export();
    editor.clear();
    expect(dotCount(editor.bits)).toBe(0);
    editor.undo();
    expect(editor.export()).toEqual(before);
    editor.begin(5, false);
    editor.move(10);
    editor.finish();
    const drawing = editor.export();
    expect(replayFrame(drawing, 0.8)).toEqual(replayFrame(drawing, 0.8));
    expect(replayFrame(drawing, 1)).toEqual(editor.bits);
    expect(hasDot(replayFrame(drawing, 0.5), 5)).toBe(true);
    expect(hasDot(replayFrame(drawing, 1), 5)).toBe(false);
  });
  it("bounds undo and replay history while preserving final bitmap", () => {
    const editor = new DoodleEditor();
    for (let i = 0; i < MAX_STROKES + 1; i++) {
      editor.begin(i, true);
      editor.finish();
    }
    expect(editor.strokes).toBeNull();
    expect(replayFrame(editor.export(), 0)).toEqual(editor.bits);
    for (let i = 0; i < MAX_UNDO + 10; i++) editor.undo();
    expect(dotCount(editor.bits)).toBe(MAX_STROKES + 1 - MAX_UNDO);
    const dense = new DoodleEditor();
    for (let stroke = 0; stroke < 3; stroke++) {
      dense.begin(0, stroke % 2 === 0);
      for (let row = 0; row < 64; row++) {
        dense.move(row * 64 + (row % 2 ? 63 : 0));
        dense.move(row * 64 + (row % 2 ? 0 : 63));
      }
      dense.finish();
    }
    expect(dense.strokes).toBeNull();
    expect(dotCount(dense.bits)).toBe(4096);
  });
  it("expires exactly at one hour and bounds the local feed", () => {
    const now = 100000000,
      examples = demoDoodles(now);
    expect(examples).toHaveLength(4);
    expect(activeDoodles(examples, now)).toHaveLength(4);
    expect(activeDoodles(examples, now + 60000)).toHaveLength(3);
    expect(activeDoodles(examples, now + LIFETIME)).toHaveLength(0);
    let feed = examples;
    for (let i = 0; i < 30; i++)
      feed = submitDoodle(feed, examples[0]!.drawing, now, String(i));
    expect(feed).toHaveLength(MAX_FEED);
    expect(feed[0]!.expiresAt).toBe(now + LIFETIME);
    expect(activeDoodles(feed, now + LIFETIME - 1)).toHaveLength(MAX_FEED);
    expect(activeDoodles(feed, now + LIFETIME)).toHaveLength(0);
    expect(() =>
      submitDoodle([], new DoodleEditor().export(), now, "empty"),
    ).toThrow();
  });
});
