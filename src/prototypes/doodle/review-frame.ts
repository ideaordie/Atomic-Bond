import { BYTES, COLOR_BYTES, decode, setPixel, type Drawing } from "./model";

/** Exact integer stepping: never skip an intermediate state through float rounding. */
export function reviewFrame(drawing: Drawing, point: number): Uint8Array {
  if (!drawing.strokes?.length) return decode(drawing.bitmap, drawing.version);
  const bits = new Uint8Array(drawing.version === 1 ? BYTES : COLOR_BYTES);
  let index = 0;
  for (const stroke of drawing.strokes)
    for (const cell of stroke.points) {
      if (index++ >= point) return bits;
      setPixel(
        bits,
        cell,
        drawing.version === 1 ? Number(stroke.draw) : stroke.color!,
      );
    }
  return bits;
}
