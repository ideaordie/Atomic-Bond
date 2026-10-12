export const SIDE = 64;
export const DOTS = SIDE * SIDE;
export const BYTES = DOTS / 8;
export const MAX_STROKES = 256;
export const MAX_POINTS = 8192;
export const MAX_UNDO = 32;
export const LIFETIME = 60 * 60 * 1000;
export const MAX_FEED = 24;
export type Stroke = { draw: boolean; points: number[] };
export type Drawing = { version: 1; bitmap: string; strokes: Stroke[] | null };
export type Doodle = {
  id: string;
  attribution: string;
  description: string;
  createdAt: number;
  expiresAt: number;
  drawing: Drawing;
};
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
  if (bits.length !== BYTES) throw new Error("Invalid bitmap length");
  return btoa(String.fromCharCode(...bits));
}
export function decode(bitmap: string): Uint8Array {
  if (bitmap.length !== 684 || !/^[A-Za-z0-9+/]+=$/.test(bitmap))
    throw new Error("Invalid bitmap encoding");
  const raw = atob(bitmap);
  if (raw.length !== BYTES) throw new Error("Invalid bitmap length");
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
type Snapshot = { bits: Uint8Array; strokes: Stroke[] | null };
/** Mutable drawing buffer; React receives updates only at stroke boundaries. */
export class DoodleEditor {
  bits: Uint8Array = new Uint8Array(BYTES);
  strokes: Stroke[] | null = [];
  private undoStack: Snapshot[] = [];
  private pending: {
    before: Snapshot;
    draw: boolean;
    points: number[];
    last: number;
  } | null = null;
  get canUndo() {
    return this.undoStack.length > 0;
  }
  get drawing() {
    return this.pending !== null;
  }
  begin(point: number, draw: boolean) {
    if (this.pending) return;
    this.pending = {
      before: { bits: this.bits.slice(), strokes: this.strokes },
      draw,
      points: [],
      last: point,
    };
    this.move(point);
  }
  move(point: number) {
    const stroke = this.pending;
    if (!stroke) return;
    for (const p of line(stroke.last, point)) {
      if (hasDot(this.bits, p) !== stroke.draw) {
        setDot(this.bits, p, stroke.draw);
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
          : [...this.strokes, { draw: stroke.draw, points: stroke.points }];
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
    this.bits = new Uint8Array(BYTES);
    this.strokes = [];
  }
  export(): Drawing {
    return {
      version: 1,
      bitmap: encode(this.bits),
      strokes:
        this.strokes?.map((s) => ({ draw: s.draw, points: [...s.points] })) ??
        null,
    };
  }
}
export function replayFrame(drawing: Drawing, progress: number): Uint8Array {
  if (drawing.version !== 1) throw new Error("Unsupported drawing version");
  if (!drawing.strokes?.length || progress >= 1) return decode(drawing.bitmap);
  const bits = new Uint8Array(BYTES);
  let remaining = Math.floor(
    Math.max(0, progress) *
      drawing.strokes.reduce((n, s) => n + s.points.length, 0),
  );
  for (const stroke of drawing.strokes)
    for (const point of stroke.points) {
      if (remaining-- <= 0) return bits;
      setDot(bits, point, stroke.draw);
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
  if (!dotCount(decode(drawing.bitmap))) throw new Error("Empty drawing");
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
