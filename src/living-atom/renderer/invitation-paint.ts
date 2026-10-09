import type { Point } from "../types/scene";
import { invitationGesture } from "../animation/first-bond";

/** Decorative open rings only: no identities, hit targets, graph nodes or edges. */
export function paintInvitation(
  ctx: CanvasRenderingContext2D,
  center: Point,
  radius: number,
  opacity: number,
  elapsedMs: number,
  still: boolean,
) {
  const gesture = invitationGesture(elapsedMs, still);
  ctx.save();
  ctx.strokeStyle = "#777777";
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 2;
    const dx = Math.cos(angle),
      dy = Math.sin(angle);
    ctx.globalAlpha = opacity * 0.32;
    ctx.setLineDash([2, 7]);
    ctx.beginPath();
    ctx.moveTo(center.x + dx * 48, center.y + dy * 48);
    ctx.lineTo(center.x + dx * (radius - 22), center.y + dy * (radius - 22));
    ctx.stroke();
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.arc(center.x + dx * radius, center.y + dy * radius, 10, 0, Math.PI * 2);
    ctx.stroke();
    if (i === gesture.marker && gesture.opacity > 0) {
      ctx.globalAlpha = opacity * gesture.opacity;
      ctx.setLineDash([]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      const distance = 48 + (radius - 70) * gesture.progress;
      ctx.moveTo(
        center.x + dx * Math.max(48, distance - 15),
        center.y + dy * Math.max(48, distance - 15),
      );
      ctx.lineTo(center.x + dx * distance, center.y + dy * distance);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }
  ctx.restore();
}
