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
    radius * 4.8 * breath,
    tone ?? "#e7ad51",
    active ? 0.29 : 0.18,
  );
  glow(ctx, point, radius * 2, tone ?? "#ffd890", 0.35);
  const sphere = ctx.createRadialGradient(
    point.x - radius * (0.32 + Math.sin(time / 6000) * 0.04),
    point.y - radius * 0.4,
    0,
    point.x + radius * 0.12,
    point.y + radius * 0.12,
    radius * 1.2,
  );
  sphere.addColorStop(0, "#fff7cf");
  sphere.addColorStop(0.28, tone ?? "#f4d992");
  sphere.addColorStop(0.72, tone ? `${tone}99` : "#c8903c");
  sphere.addColorStop(1, tone ? "#122238" : "#55351b");
  ctx.fillStyle = sphere;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 55; i++) {
    const angle = CORE_PARTICLES[i]!.angle + time / (45000 + i * 1500);
    const distance = CORE_PARTICLES[i]!.distance * radius;
    ctx.fillStyle = i % 4 === 0 ? "#fff6cc" : "#fce3a680";
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
  ctx.strokeStyle = tone ?? "#ffe9b7";
  ctx.lineWidth = 1.15;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(-0.45);
  const ray = ctx.createLinearGradient(-radius * 3.5, 0, radius * 3.5, 0);
  ray.addColorStop(0, "#ffd58a00");
  ray.addColorStop(0.5, "#ffe9b799");
  ray.addColorStop(1, "#ffd58a00");
  ctx.strokeStyle = ray;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-radius * 3.5, 0);
  ctx.lineTo(radius * 3.5, 0);
  ctx.stroke();
  ctx.restore();
}

/** Cached atmospheric field; stars are decorative, not additional reachable Atoms. */
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
  ctx.fillStyle = "#030a13";
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 18; i++) {
    const angle = i * 0.48;
    const point = {
      x: width / 2 + Math.cos(angle) * width * 0.33,
      y: height / 2 + Math.sin(angle) * height * 0.32,
    };
    glow(
      ctx,
      point,
      Math.min(width, height) * (0.15 + fraction("fog", i) * 0.15),
      i % 3 === 0 ? "#2a345f" : "#144c68",
      0.055,
    );
  }
  for (let i = 0; i < 620; i++) {
    const x = fraction("star-x", i) * width;
    const y = fraction("star-y", i) * height;
    const radius = fraction("star-r", i) > 0.94 ? 1.2 : 0.45;
    ctx.globalAlpha = 0.12 + fraction("star-a", i) * 0.48;
    ctx.fillStyle = i % 4 === 0 ? "#dfc6a0" : "#93c5de";
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    if (radius > 1) glow(ctx, { x, y }, 5, "#71c2e8", 0.25);
  }
  ctx.globalAlpha = 1;
  return background;
}
