import { paintCore } from "../../living-atom/renderer/celestial-paint";
import { CONTINENTS } from "../introduction/world";
import { STORY_ATOMS, mix, progress, project } from "../introduction/timeline";
import { sampleTimeline } from "./timeline";

type C = CanvasRenderingContext2D;
function text(
  c: C,
  s: string,
  x: number,
  y: number,
  size: number,
  weight = 600,
) {
  c.fillStyle = "#ffffff";
  c.font = `${weight} ${size}px Arial, Helvetica, sans-serif`;
  c.textAlign = "center";
  c.fillText(s, x, y);
}
function layer(c: C, alpha: number, draw: () => void) {
  if (alpha <= 0) return;
  c.save();
  c.globalAlpha *= alpha;
  draw();
  c.restore();
}
const dot = (c: C, x: number, y: number, r: number) => {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
};
// Original synthetic pixel drawings: a heart, flower and smiling sun. No submissions.
function pixel(x: number, y: number, kind: number) {
  const a = (x - 31.5) / 23,
    b = (31.5 - y) / 23;
  if (kind === 0) return (a * a + b * b - 0.65) ** 3 - a * a * b * b * b < 0;
  const r = Math.hypot(x - 32, y - 32);
  if (kind === 1)
    return (
      r < 7 ||
      Math.abs(r - (16 + 5 * Math.cos(Math.atan2(y - 32, x - 32) * 6))) < 3
    );
  return (
    Math.abs(r - 22) < 2 ||
    (y > 35 && y < 46 && Math.abs(Math.hypot(x - 32, y - 32) - 13) < 2) ||
    ((Math.abs(x - 24) < 2 || Math.abs(x - 40) < 2) && Math.abs(y - 26) < 3)
  );
}
function drawing(
  c: C,
  x: number,
  y: number,
  size: number,
  kind: number,
  amount: number,
  grid: boolean,
) {
  c.fillStyle = "#080c12";
  c.fillRect(x - 12, y - 12, size + 24, size + 24);
  c.strokeStyle = "#ffffff55";
  c.lineWidth = 2;
  c.strokeRect(x - 12, y - 12, size + 24, size + 24);
  const step = size / 64;
  for (let row = 0; row < 64; row++)
    for (let col = 0; col < 64; col++) {
      const on = pixel(col, row, kind) && row * 64 + col < amount * 4096;
      if (!on && !grid) continue;
      c.fillStyle = on ? ["#ff718c", "#f7ca64", "#7de3d0"][kind]! : "#ffffff16";
      dot(
        c,
        x + (col + 0.5) * step,
        y + (row + 0.5) * step,
        step * (on ? 0.42 : 0.17),
      );
    }
}
// Original vector landscape generated in-code. Each crop is private to this synthetic illustration.
function landscape(c: C) {
  c.fillStyle = "#152b43";
  c.fillRect(0, 0, 640, 640);
  c.fillStyle = "#ffc779";
  dot(c, 460, 115, 59);
  for (let i = 0; i < 9; i++) {
    c.fillStyle = i % 2 ? "#426b69" : "#315959";
    c.beginPath();
    c.moveTo(i * 95 - 100, 370);
    c.lineTo(i * 95 + 30, 130 + (i % 3) * 45);
    c.lineTo(i * 95 + 180, 370);
    c.fill();
  }
  c.fillStyle = "#73b5bb";
  c.beginPath();
  c.moveTo(300, 330);
  c.bezierCurveTo(130, 430, 490, 470, 240, 640);
  c.lineTo(550, 640);
  c.bezierCurveTo(610, 470, 270, 430, 390, 330);
  c.fill();
  for (let i = 0; i < 7; i++) {
    const x = i * 96;
    c.fillStyle = i % 2 ? "#d98f65" : "#edd2a0";
    c.fillRect(x, 290 + (i % 3) * 20, 62, 90);
    c.fillStyle = "#1d354a";
    for (let j = 0; j < 4; j++)
      c.fillRect(
        x + 10 + (j % 2) * 27,
        310 + Math.floor(j / 2) * 28 + (i % 3) * 20,
        12,
        15,
      );
  }
  c.strokeStyle = "#f6d8a1";
  c.lineWidth = 17;
  c.beginPath();
  c.moveTo(95, 450);
  c.quadraticCurveTo(330, 320, 570, 450);
  c.stroke();
  c.lineWidth = 5;
  for (let i = 0; i < 10; i++) {
    c.beginPath();
    c.moveTo(100 + i * 51, 449);
    c.lineTo(100 + i * 51, 393 + Math.abs(i - 4.5) * 10);
    c.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const x = (i * 113) % 640,
      y = 465 + (i % 4) * 43;
    c.fillStyle = "#1d4941";
    c.fillRect(x, y, 6, 55);
    c.fillStyle = i % 2 ? "#82b87b" : "#4f977e";
    dot(c, x + 3, y, 22);
  }
}
function puzzle(c: C, t: number) {
  const x = 640,
    y = 292,
    cell = 128;
  c.strokeStyle = "#ffffff44";
  c.lineWidth = 2;
  for (let i = 0; i < 25; i++) {
    const col = i % 5,
      row = Math.floor(i / 5),
      order = (i * 7) % 25;
    const arrival = order === 0 ? 17.1 : 18 + order * 0.13;
    const p = progress(t, arrival, arrival + 0.65);
    c.strokeRect(x + col * cell, y + row * cell, cell, cell);
    if (p === 0 && order !== 0) continue;
    const dx = (1 - p) * (order === 0 ? -280 : col < 3 ? -230 : 230),
      dy = (1 - p) * (order === 0 ? 220 : -90);
    c.save();
    c.globalAlpha *=
      order === 0 ? progress(t, 16.25, 16.7) : Math.min(1, p * 3);
    c.translate(x + dx, y + dy);
    c.beginPath();
    c.rect(col * cell + 2, row * cell + 2, cell - 4, cell - 4);
    c.clip();
    landscape(c);
    c.restore();
    if (p === 1) {
      c.strokeStyle = "#ffffff70";
      c.strokeRect(x + col * cell + 2, y + row * cell + 2, cell - 4, cell - 4);
    }
  }
  if (t > 17.75 && t < 19.2) {
    text(c, "LOCKED", 1480, 600, 44);
    c.strokeStyle = "#ffffff88";
    c.beginPath();
    c.moveTo(1360, 560);
    c.lineTo(1320, 560);
    c.stroke();
  }
}
export function paintPromotion(c: C, seconds: number) {
  const { time: t, sceneIndex, scene } = sampleTimeline(seconds);
  c.save();
  c.setTransform(c.canvas.width / 1920, 0, 0, c.canvas.height / 1080, 0, 0);
  c.fillStyle = "#030609";
  c.fillRect(0, 0, 1920, 1080);
  const map = progress(t, 4.6, 6.3),
    toDots = progress(t, 9.4, 10.7),
    final = progress(t, 22.6, 24.2);
  layer(c, map * (1 - toDots) * (1 - final), () => {
    c.strokeStyle = "#ffffff55";
    c.lineWidth = 2;
    for (const polygon of CONTINENTS) {
      c.beginPath();
      polygon.forEach(([lon, lat], i) => {
        const p = project(lon, lat);
        if (i === 0) c.moveTo(p.x, p.y);
        else c.lineTo(p.x, p.y);
      });
      c.closePath();
      c.stroke();
    }
  });
  const networkOpacity = t < 12 ? 1 - toDots : final * 0.55;
  layer(c, networkOpacity, () => {
    const positions = STORY_ATOMS.map((n) => {
      const p = project(n.longitude, n.latitude);
      const grow = progress(t, 1.7, 4.8);
      return {
        x: mix(
          mix(
            mix(n.index === 0 ? 960 : 1250, n.x, grow),
            p.x,
            map * (1 - final),
          ),
          660 + (n.index % 9) * 75,
          toDots * (1 - final),
        ),
        y: mix(
          mix(mix(640, n.y, grow), p.y, map * (1 - final)),
          310 + Math.floor(n.index / 9) * 75,
          toDots * (1 - final),
        ),
      };
    });
    for (const n of STORY_ATOMS) {
      const birth =
        n.index === 0 ? 0 : n.index === 1 ? 0.75 : 1.7 + n.index * 0.035;
      const a =
        final > 0 || n.index === 0 ? 1 : progress(t, birth, birth + 0.5);
      if (!a) continue;
      const p = positions[n.index]!;
      layer(c, a, () => {
        if (n.parent !== null) {
          const q = positions[n.parent]!;
          c.strokeStyle = n.color + "66";
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(q.x, q.y);
          c.lineTo(mix(q.x, p.x, a), mix(q.y, p.y, a));
          c.stroke();
        }
        paintCore(
          c,
          p,
          mix(n.index < 2 ? 70 : 13, 12, progress(t, 1.7, 4.8)),
          t * 1000,
          true,
          n.color,
        );
      });
    }
  });
  layer(c, progress(t, 9.5, 10.5) * (1 - progress(t, 15.5, 16.5)), () => {
    const feed = progress(t, 13, 14.6);
    const drift = progress(t, 14.1, 15.8) * 70;
    c.translate(-drift, 0);
    const size = mix(600, 420, feed);
    drawing(
      c,
      mix(660, 750, feed),
      mix(310, 425, feed),
      size,
      0,
      progress(t, 10.4, 12.8),
      true,
    );
    layer(c, feed, () => {
      drawing(c, 180, 425, 420, 1, 1, false);
      drawing(c, 1320, 425, 420, 2, 1, false);
    });
  });
  // The dot canvas' perimeter expands into the next 5×5 board before its
  // artwork arrives; no hidden mutable simulation is required for the handoff.
  layer(c, progress(t, 15.15, 15.7) * (1 - progress(t, 16.1, 16.7)), () => {
    const p = progress(t, 15.2, 16.3),
      x = mix(750, 640, p),
      y = mix(425, 292, p),
      size = mix(420, 640, p);
    c.strokeStyle = "#ffffff66";
    c.lineWidth = 2;
    for (let i = 0; i <= 5; i++) {
      c.beginPath();
      c.moveTo(x + (i * size) / 5, y);
      c.lineTo(x + (i * size) / 5, y + size);
      c.moveTo(x, y + (i * size) / 5);
      c.lineTo(x + size, y + (i * size) / 5);
      c.stroke();
    }
  });
  layer(c, progress(t, 15.5, 16.4) * (1 - final), () => puzzle(c, t));
  if (sceneIndex < 4) {
    const alpha =
      progress(t, scene.start, scene.start + 0.45) *
      (1 - progress(t, scene.end - 0.4, scene.end));
    layer(c, alpha, () => {
      text(
        c,
        sceneIndex === 2
          ? "GLOBAL DOODLE"
          : sceneIndex === 3
            ? "PARTICI-PUZZLE"
            : "ATOMIC BOND",
        960,
        100,
        52,
        500,
      );
      scene.lines.forEach((s, i) => text(c, s, 960, 200 + i * 80, 68));
    });
  } else
    layer(c, progress(t, 23, 24), () => {
      c.fillStyle = "#030609bb";
      c.fillRect(180, 160, 1560, 760);
      text(c, "ATOMIC BOND", 960, 330, 116, 500);
      text(c, "CONNECT. CREATE. PLAY.", 960, 455, 74);
      text(c, "TOGETHER.", 960, 545, 90);
      text(c, "ONE WORLD. MORE WAYS TO CONNECT.", 960, 650, 62, 400);
      text(c, "ATOMICBOND.IDEAORDIE.COM", 960, 750, 64, 500);
      c.strokeStyle = "#ffffff";
      c.lineWidth = 2;
      c.strokeRect(780, 802, 360, 96);
      text(c, "JOIN FREE", 960, 867, 52);
    });
  c.restore();
}
