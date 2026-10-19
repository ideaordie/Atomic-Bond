export const SIDE = 64;
export const DOTS = SIDE * SIDE;
export const BYTES = DOTS / 8;
export const COLOR_BYTES = DOTS / 2;
export type EncodingVersion = 1 | 2;
export const MAX_STROKES = 256;
export const MAX_POINTS = 8192;
export const MAX_UNDO = 32;
export const LIFETIME = 60 * 60 * 1000;
export const MAX_FEED = 24;
export type Stroke = { draw: boolean; color?: number; points: number[] };
export type Drawing = {
  version: EncodingVersion;
  bitmap: string;
  strokes: Stroke[] | null;
};
export type Doodle = {
  id: string;
  attribution: string;
  description: string;
  createdAt: number;
  expiresAt: number;
  drawing: Drawing;
};
export function pixel(bits: Uint8Array, point: number): number {
  return bits.length === COLOR_BYTES
    ? (bits[point >> 1]! >> ((point & 1) * 4)) & 15
    : Number(Boolean(bits[point >> 3]! & (1 << (point & 7))));
}
export function setPixel(bits: Uint8Array, point: number, color: number) {
  if (
    !Number.isInteger(point) ||
    point < 0 ||
    point >= DOTS ||
    !Number.isInteger(color) ||
    color < 0 ||
    color > 8
  )
    throw new Error("Invalid pixel");
  if (bits.length === BYTES) {
    setDot(bits, point, color !== 0);
    return;
  }
  if (bits.length !== COLOR_BYTES) throw new Error("Invalid bitmap length");
  const shift = (point & 1) * 4;
  bits[point >> 1] = (bits[point >> 1]! & ~(15 << shift)) | (color << shift);
}
export const hasDot = (bits: Uint8Array, point: number) =>
  Boolean(bits[point >> 3]! & (1 << (point & 7)));
export function setDot(bits: Uint8Array, point: number, draw: boolean) {
  if (!Number.isInteger(point) || point < 0 || point >= DOTS)
    throw new Error("Invalid grid point");
  const byte = point >> 3,
    mask = 1 << (point & 7);
  bits[byte] = draw ? bits[byte]! | mask : bits[byte]! & ~mask;
}
export const dotCount = (bits: Uint8Array) => {
  if (bits.length === COLOR_BYTES) {
    let count = 0;
    for (const byte of bits)
      count += Number((byte & 15) !== 0) + Number(byte >> 4 !== 0);
    return count;
  }
  let count = 0;
  for (const byte of bits)
    for (let bit = 0; bit < 8; bit++) count += (byte >> bit) & 1;
  return count;
};
/** Integer Bresenham interpolation, including both endpoints. */
export function line(from: number, to: number): number[] {
  if (![from, to].every((p) => Number.isInteger(p) && p >= 0 && p < DOTS))
    throw new Error("Invalid grid point");
  let x = from % SIDE,
    y = Math.floor(from / SIDE);
  const tx = to % SIDE,
    ty = Math.floor(to / SIDE);
  const dx = Math.abs(tx - x),
    dy = -Math.abs(ty - y);
  const sx = x < tx ? 1 : -1,
    sy = y < ty ? 1 : -1;
  let error = dx + dy;
  const points: number[] = [];
  while (true) {
    points.push(y * SIDE + x);
    if (x === tx && y === ty) return points;
    const twice = 2 * error;
    if (twice >= dy) {
      error += dy;
      x += sx;
    }
    if (twice <= dx) {
      error += dx;
      y += sy;
    }
  }
}
export function encode(bits: Uint8Array): string {
  if (![BYTES, COLOR_BYTES].includes(bits.length))
    throw new Error("Invalid bitmap length");
  if (
    bits.length === COLOR_BYTES &&
    bits.some((b) => (b & 15) > 8 || b >> 4 > 8)
  )
    throw new Error("Invalid palette index");
  return btoa(String.fromCharCode(...bits));
}
export function decode(
  bitmap: string,
  version: EncodingVersion = 1,
): Uint8Array {
  if (version !== 1 && version !== 2)
    throw new Error("Unsupported drawing version");
  if (
    bitmap.length !== (version === 1 ? 684 : 2732) ||
    !/^[A-Za-z0-9+/]+=$/.test(bitmap)
  )
    throw new Error("Invalid bitmap encoding");
  const bits = Uint8Array.from(atob(bitmap), (c) => c.charCodeAt(0));
  if (
    bits.length !== (version === 1 ? BYTES : COLOR_BYTES) ||
    encode(bits) !== bitmap
  )
    throw new Error("Invalid bitmap encoding");
  return bits;
}

type Snapshot = { bits: Uint8Array; strokes: Stroke[] | null };
/** Mutable drawing buffer; React receives updates only at stroke boundaries. */
export class DoodleEditor {
  bits: Uint8Array;
  constructor(readonly version: EncodingVersion = 1) {
    this.bits = new Uint8Array(version === 1 ? BYTES : COLOR_BYTES);
  }
  strokes: Stroke[] | null = [];
  private undoStack: Snapshot[] = [];
  private pending: {
    before: Snapshot;
    draw: boolean;
    color: number;
    points: number[];
    last: number;
  } | null = null;
  get canUndo() {
    return this.undoStack.length > 0;
  }
  get drawing() {
    return this.pending !== null;
  }
  begin(point: number, draw: boolean, color = 1) {
    if (this.pending) return;
    this.pending = {
      before: { bits: this.bits.slice(), strokes: this.strokes },
      draw,
      color: draw ? color : 0,
      points: [],
      last: point,
    };
    this.move(point);
  }
  move(point: number) {
    const stroke = this.pending;
    if (!stroke) return;
    for (const p of line(stroke.last, point)) {
      if (
        pixel(this.bits, p) !==
        (this.version === 1 ? Number(stroke.draw) : stroke.color)
      ) {
        setPixel(this.bits, p, stroke.color);
        stroke.points.push(p);
      }
    }
    stroke.last = point;
  }
  finish(cancel = false) {
    const stroke = this.pending;
    if (!stroke) return;
    this.pending = null;
    if (cancel) {
      this.bits = stroke.before.bits;
      return;
    }
    if (!stroke.points.length) return;
    this.undoStack.push(stroke.before);
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    if (this.strokes) {
      const count =
        this.strokes.reduce((n, s) => n + s.points.length, 0) +
        stroke.points.length;
      this.strokes =
        count > MAX_POINTS || this.strokes.length >= MAX_STROKES
          ? null
          : [
              ...this.strokes,
              {
                draw: stroke.draw,
                ...(this.version === 2 ? { color: stroke.color } : {}),
                points: stroke.points,
              },
            ];
    }
  }
  undo() {
    if (this.pending) return;
    const previous = this.undoStack.pop();
    if (previous) {
      this.bits = previous.bits;
      this.strokes = previous.strokes;
    }
  }
  clear() {
    if (this.pending || !dotCount(this.bits)) return;
    this.undoStack.push({ bits: this.bits.slice(), strokes: this.strokes });
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    this.bits = new Uint8Array(this.version === 1 ? BYTES : COLOR_BYTES);
    this.strokes = [];
  }
  export(): Drawing {
    return {
      version: this.version,
      bitmap: encode(this.bits),
      strokes:
        this.strokes?.map((s) => ({
          draw: s.draw,
          ...(this.version === 2 ? { color: s.color } : {}),
          points: [...s.points],
        })) ?? null,
    };
  }
}
export function replayFrame(drawing: Drawing, progress: number): Uint8Array {
  if (drawing.version !== 1 && drawing.version !== 2)
    throw new Error("Unsupported drawing version");
  if (!drawing.strokes?.length || progress >= 1)
    return decode(drawing.bitmap, drawing.version);
  const bits = new Uint8Array(drawing.version === 1 ? BYTES : COLOR_BYTES);
  let remaining = Math.floor(
    Math.max(0, progress) *
      drawing.strokes.reduce((n, s) => n + s.points.length, 0),
  );
  for (const stroke of drawing.strokes)
    for (const point of stroke.points) {
      if (remaining-- <= 0) return bits;
      setPixel(
        bits,
        point,
        drawing.version === 1 ? Number(stroke.draw) : stroke.color!,
      );
    }
  return bits;
}
export const activeDoodles = (items: Doodle[], now: number) =>
  items.filter((item) => item.createdAt <= now && item.expiresAt > now);
export function submitDoodle(
  items: Doodle[],
  drawing: Drawing,
  now: number,
  id: string,
): Doodle[] {
  if (!dotCount(decode(drawing.bitmap, drawing.version)))
    throw new Error("Empty drawing");
  return [
    {
      id,
      drawing,
      attribution: "YOUR LOCAL DEMO",
      description: "Your dot drawing",
      createdAt: now,
      expiresAt: now + LIFETIME,
    },
    ...activeDoodles(items, now),
  ].slice(0, MAX_FEED);
}
