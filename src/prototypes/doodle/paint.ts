import { hasDot, SIDE, COLOR_BYTES, pixel } from "./model";
import { PALETTE, contrast } from "./palette";
export function paintDoodle(
  canvas: HTMLCanvasElement,
  bits: Uint8Array,
  editing = false,
  cursor: number | null = null,
) {
  const size = canvas.getBoundingClientRect().width;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const pixels = Math.max(1, Math.round(size * ratio));
  if (canvas.width !== pixels || canvas.height !== pixels) {
    canvas.width = pixels;
    canvas.height = pixels;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, size, size);
  const style = getComputedStyle(canvas);
  const step = size / SIDE;
  if (editing) {
    ctx.fillStyle = style.getPropertyValue("--border");
    ctx.beginPath();
    for (let p = 0; p < SIDE * SIDE; p++) {
      const x = ((p % SIDE) + 0.5) * step,
        y = (Math.floor(p / SIDE) + 0.5) * step;
      ctx.moveTo(x + 0.45, y);
      ctx.arc(x, y, 0.45, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  const colored = bits.length === COLOR_BYTES;
  for (let index = 1; index <= (colored ? 8 : 1); index++) {
    const fill = colored ? PALETTE[index - 1]!.hex : style.color;
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (let p = 0; p < SIDE * SIDE; p++)
      if (colored ? pixel(bits, p) === index : hasDot(bits, p)) {
        const x = ((p % SIDE) + 0.5) * step,
          y = (Math.floor(p / SIDE) + 0.5) * step,
          r = step * 0.38;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
    ctx.fill();
    // Literal black/white/yellow need a contrasting edge on some themes.
    // Keep the occupied dot's outside radius unchanged; legacy ink is untouched.
    if (
      colored &&
      contrast(fill, style.getPropertyValue("--surface").trim()) < 3
    ) {
      ctx.strokeStyle = style.color;
      ctx.lineWidth = Math.min(0.65, step * 0.15);
      ctx.save();
      ctx.clip();
      ctx.stroke();
      ctx.restore();
    }
  }
  if (cursor !== null) {
    ctx.strokeStyle = style.color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      (cursor % SIDE) * step - 1,
      Math.floor(cursor / SIDE) * step - 1,
      step + 2,
      step + 2,
    );
  }
}
