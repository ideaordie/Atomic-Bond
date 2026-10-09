import { SCIENTIFIC_PALETTE as palette } from "./scientific-palette";
import type { Point } from "../types/scene";
import { fraction } from "../layout/spatial";

const CORE_PARTICLES = Array.from({ length: 55 }, (_, index) => ({
  angle: fraction("core", index) * Math.PI * 2,
  distance: Math.sqrt(fraction("core-r", index)),
}));

export function glow(
  ctx: CanvasRenderingContext2D,
  point: Point,
  radius: number,
  color: string,
  alpha: number,
) {
  const gradient = ctx.createRadialGradient(
    point.x,
    point.y,
    0,
    point.x,
    point.y,
    radius,
  );
  gradient.addColorStop(
    0,
    `${color}${Math.round(alpha * 255)
      .toString(16)
      .padStart(2, "0")}`,
  );
  gradient.addColorStop(1, `${color}00`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fill();
}

export function paintPerson(
  ctx: CanvasRenderingContext2D,
  point: Point,
  radius: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(point.x, point.y - radius * 0.23, radius * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(
    point.x,
    point.y + radius * 0.37,
    radius * 0.44,
    radius * 0.29,
    0,
    Math.PI,
    0,
  );
  ctx.fill();
}

export function paintCore(
  ctx: CanvasRenderingContext2D,
  point: Point,
  radius: number,
  time: number,
  active: boolean,
  tone?: string,
) {
  const breath = 1 + Math.sin(time / 3400) * 0.08;
  glow(
    ctx,
    point,
    radius * 2.4 * breath,
    tone ?? palette.atmosphere,
    active ? 0.25 : 0.08,
  );
  glow(ctx, point, radius * 2, tone ?? palette.atmosphere, 0.12);
  const sphere = ctx.createRadialGradient(
    point.x - radius * (0.32 + Math.sin(time / 6000) * 0.04),
    point.y - radius * 0.4,
    0,
    point.x + radius * 0.12,
    point.y + radius * 0.12,
    radius * 1.2,
  );
  sphere.addColorStop(0, palette.highlight);
  sphere.addColorStop(0.28, tone ?? "#dddddd");
  sphere.addColorStop(0.72, tone ?? palette.core);
  sphere.addColorStop(1, palette.shade);
  ctx.fillStyle = sphere;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 55; i++) {
    const angle = CORE_PARTICLES[i]!.angle + time / (45000 + i * 1500);
    const distance = CORE_PARTICLES[i]!.distance * radius;
    ctx.fillStyle = i % 4 === 0 ? "#ffffffb3" : "#eeeeee6b";
    ctx.beginPath();
    ctx.arc(
      point.x + Math.cos(angle) * distance,
      point.y + Math.sin(angle) * distance,
      i % 5 === 0 ? 1.1 : 0.55,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = tone ?? palette.shade;
  ctx.lineWidth = 1.15;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.stroke();
}

/** Cached light atmosphere, independent of graph membership. */
export function createStarfield(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  ratio: number,
) {
  const background = canvas.ownerDocument.createElement("canvas");
  background.width = Math.round(width * ratio);
  background.height = Math.round(height * ratio);
  const ctx = background.getContext("2d")!;
  ctx.scale(ratio, ratio);
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, width, height);
  glow(
    ctx,
    { x: width * 0.5, y: height * 0.55 },
    Math.max(width, height) * 0.6,
    palette.atmosphere,
    0.1,
  );
  return background;
}
