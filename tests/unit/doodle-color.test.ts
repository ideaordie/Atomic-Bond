import { expect, it } from "vitest";
import {
  DoodleEditor,
  decode,
  encode,
  pixel,
  setPixel,
  dotCount,
  replayFrame,
  COLOR_BYTES,
} from "../../src/prototypes/doodle/model";
import { reviewFrame } from "../../src/prototypes/doodle/review-frame";
import { containsColorDrawing } from "../../src/services/doodle/ingress";
it("packs two indices per byte, rejects unused values and keeps v1 distinct", () => {
  const bits = new Uint8Array(COLOR_BYTES);
  setPixel(bits, 0, 1);
  setPixel(bits, 1, 8);
  expect(bits[0]).toBe(129);
  expect(encode(bits)).toHaveLength(2732);
  expect(decode(encode(bits), 2)).toEqual(bits);
  expect(() => decode(encode(bits))).toThrow();
  for (let c = 9; c < 16; c++) {
    const invalid = bits.slice();
    invalid[0] = c;
    expect(() => decode(btoa(String.fromCharCode(...invalid)), 2)).toThrow();
    expect(() => setPixel(bits, 1, c)).toThrow();
  }
  const old = new DoodleEditor();
  old.begin(0, true);
  old.finish();
  expect(old.export().version).toBe(1);
  expect(old.bits[0]).toBe(1);
  expect(decode(old.export().bitmap)).toHaveLength(512);
});
it("draws, overwrites, erases, cancels, clears and undoes with identical replay", () => {
  const e = new DoodleEditor(2);
  e.begin(0, true, 3);
  e.move(3);
  e.finish();
  expect(dotCount(e.bits)).toBe(4);
  e.begin(0, true, 8);
  e.finish();
  expect(pixel(e.bits, 0)).toBe(8);
  expect(dotCount(e.bits)).toBe(4);
  e.begin(1, false);
  e.finish();
  expect(pixel(e.bits, 1)).toBe(0);
  expect(dotCount(e.bits)).toBe(3);
  expect(replayFrame(e.export(), 0.9999)).toEqual(reviewFrame(e.export(), 5));
  expect(reviewFrame(e.export(), 6)).toEqual(e.bits);
  e.undo();
  expect(pixel(e.bits, 1)).toBe(3);
  e.undo();
  expect(pixel(e.bits, 0)).toBe(3);
  e.begin(0, true, 7);
  e.finish(true);
  expect(pixel(e.bits, 0)).toBe(3);
  const before = e.export();
  e.clear();
  expect(dotCount(e.bits)).toBe(0);
  e.undo();
  expect(e.export()).toEqual(before);
});
it("identifies nested color payloads for stale-client protection", () => {
  expect(
    containsColorDrawing({ items: [{ version: 2, bitmap: "opaque" }] }),
  ).toBe(true);
  expect(containsColorDrawing({ items: [{ bitmap: "legacy" }] })).toBe(false);
});
