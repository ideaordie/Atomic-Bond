import { BYTES, decode, setDot, type Drawing } from "./model";

/** Exact integer stepping: never skip an intermediate state through float rounding. */
export function reviewFrame(drawing: Drawing, point: number): Uint8Array {
  if (!drawing.strokes?.length) return decode(drawing.bitmap);
  const bits = new Uint8Array(BYTES);
  let index = 0;
  for (const stroke of drawing.strokes)
    for (const cell of stroke.points) {
      if (index++ >= point) return bits;
      setDot(bits, cell, stroke.draw);
    }
  return bits;
}
