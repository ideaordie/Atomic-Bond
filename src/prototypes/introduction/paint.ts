import { paintCore, glow } from "../../living-atom/renderer/celestial-paint";
import { CONTINENTS } from "./world";
import {
  FRAME,
  STORY_ATOMS,
  mix,
  progress,
  project,
  sampleTimeline,
} from "./timeline";

type Point = { x: number; y: number };
const FONT = "Arial, Helvetica, sans-serif";
function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  y: number,
  size: number,
  weight = 500,
) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(value, 960, y);
}
function curve(
  ctx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  bend: number,
  fraction = 1,
) {
  // Fixed subdivisions make partial curves reproducible at any timeline position.
  const control = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - bend };
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  for (let step = 1; step <= 36; step++) {
    const u = (fraction * step) / 36;
    ctx.lineTo(
      (1 - u) ** 2 * a.x + 2 * (1 - u) * u * control.x + u * u * b.x,
      (1 - u) ** 2 * a.y + 2 * (1 - u) * u * control.y + u * u * b.y,
    );
  }
  ctx.stroke();
}

/** Pure frame painter. Seconds are the only clock; no mutable simulation or live data. */
export function paintIntroduction(
  ctx: CanvasRenderingContext2D,
  seconds: number,
) {
  const state = sampleTimeline(seconds);
  const t = state.time;
  ctx.save();
  ctx.setTransform(
    ctx.canvas.width / FRAME.width,
    0,
    0,
    ctx.canvas.height / FRAME.height,
    0,
    0,
  );
  ctx.clearRect(0, 0, 1920, 1080);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 1920, 1080);
  const atmosphere = ctx.createRadialGradient(960, 660, 20, 960, 660, 820);
  atmosphere.addColorStop(0, "#f0f0f0");
  atmosphere.addColorStop(1, "#ffffff");
  ctx.fillStyle = atmosphere;
  ctx.fillRect(0, 300, 1920, 700);

  ctx.save();
  ctx.globalAlpha = state.map * (1 - state.finale * 0.7);
  ctx.fillStyle = "#eceeef";
  ctx.strokeStyle = "#b8bec2";
  ctx.lineWidth = 1.7;
  for (const polygon of CONTINENTS) {
    ctx.beginPath();
    polygon.forEach(([lon, lat], i) => {
      const p = project(lon, lat);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  const pullback = progress(t, 8, 13.8);
  const positions = STORY_ATOMS.map((n) => {
    const openingX = n.index === 0 ? mix(960, 700, progress(t, 4, 6.2)) : 1220;
    const x = mix(openingX, n.x, pullback);
    const y = mix(650, n.y, pullback);
    const mapPoint = project(n.longitude, n.latitude);
    const drift = Math.sin(t * 0.5 + n.index) * 4 * (1 - state.map);
    return {
      x: mix(x, mapPoint.x, state.map),
      y: mix(y + drift, mapPoint.y, state.map),
    };
  });
  ctx.save();
  ctx.globalAlpha = 1 - state.finale * 0.88;
  for (const node of state.nodes) {
    if (node.parent === null) continue;
    const a = positions[node.parent]!;
    const b = positions[node.index]!;
    const start = node.index === 1 ? 5.3 : node.birth;
    const formation = progress(
      t,
      start,
      start + (node.index === 1 ? 1.2 : 0.7),
    );
    const colored = progress(t, 6.5, 7.2);
    ctx.lineWidth = mix(2.5, 1.5, state.map);
    ctx.strokeStyle = colored > 0.5 ? node.color + "88" : "#777777";
    const bend = state.map * Math.min(120, Math.abs(a.x - b.x) * 0.2);
    curve(ctx, a, b, bend, formation);
    if (node.index === 1 && t >= 6.5 && t < 7.8) {
      const wave = progress(t, 6.5, 7.8);
      const point = { x: mix(a.x, b.x, wave), y: mix(a.y, b.y, wave) };
      glow(ctx, point, 52, node.color, Math.sin(wave * Math.PI) * 0.45);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (formation > 0 && formation < 1) {
      const u = formation;
      const point = {
        x: mix(a.x, b.x, u),
        y: mix(a.y, b.y, u) - 2 * (1 - u) * u * bend,
      };
      glow(ctx, point, 24, node.color, 0.35);
    }
  }
  for (const n of state.nodes) {
    const p = positions[n.index]!;
    const alpha = n.index === 0 ? 1 : progress(t, n.birth, n.birth + 0.65);
    const radius = mix(
      n.index < 2 ? 105 : 24,
      mix(11 + (n.index % 6), 6, state.map),
      pullback,
    );
    const colorAmount = progress(
      t,
      n.index < 2 ? 6.5 : n.birth + 0.3,
      n.index < 2 ? 7.3 : n.birth + 0.9,
    );
    ctx.save();
    ctx.globalAlpha *= alpha;
    if (state.map > 0) glow(ctx, p, 52, n.color, 0.12 * state.map);
    paintCore(ctx, p, radius, t * 1000, false);
    if (colorAmount > 0) {
      ctx.save();
      ctx.globalAlpha *= colorAmount;
      paintCore(ctx, p, radius, t * 1000, true, n.color);
      ctx.restore();
    }
    if (radius > 30) {
      ctx.strokeStyle = "#66666660";
      ctx.lineWidth = 1.1;
      for (let orbit = 0; orbit < 3; orbit++) {
        const angle = (orbit * Math.PI) / 3 + t * 0.065;
        ctx.beginPath();
        ctx.ellipse(
          p.x,
          p.y,
          radius * 1.55,
          radius * 0.55,
          angle,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
        const phase = t * 0.5 + orbit * 2.1;
        const dx = Math.cos(phase) * radius * 1.55,
          dy = Math.sin(phase) * radius * 0.55;
        ctx.fillStyle = "#555555";
        ctx.beginPath();
        ctx.arc(
          p.x + dx * Math.cos(angle) - dy * Math.sin(angle),
          p.y + dx * Math.sin(angle) + dy * Math.cos(angle),
          3.5,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
    ctx.restore();
  }
  ctx.restore();

  // Typography is inside the source frame, so captures and future video match exactly.
  ctx.fillStyle = "#111111";
  if (state.sceneIndex < 4) {
    text(ctx, "ATOMIC BOND", 85, 32, 500);
    ctx.save();
    ctx.globalAlpha = state.textOpacity;
    state.scene.lines.forEach((line, i) =>
      text(ctx, line, 192 + i * 86, 76, 600),
    );
    ctx.restore();
  } else {
    ctx.save();
    ctx.globalAlpha = state.textOpacity;
    text(ctx, "ATOMIC BOND", 238, 46, 500);
    state.scene.lines.forEach((line, i) =>
      text(ctx, line, 376 + i * 98, 86, 600),
    );
    text(ctx, "CREATE YOUR ATOM.", 580, 64);
    text(ctx, "MAKE A BOND. SEE WHERE IT LEADS.", 654, 64);
    ctx.fillStyle = "#111111";
    ctx.beginPath();
    ctx.roundRect(545, 745, 830, 120, 60);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    text(ctx, "CREATE YOUR ATOM", 827, 64, 600);
    ctx.restore();
  }
  ctx.fillStyle = "#555555";
  text(ctx, "ILLUSTRATIVE NETWORK", 996, 42);
  text(ctx, "NOT LIVE PARTICIPANT DATA", 1043, 42);
  ctx.restore();
}
