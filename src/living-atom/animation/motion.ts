import type { Point, VisualNode } from "../types/scene";
import { stableHash } from "../layout/scene";

/** Small local drift, never orbital rotation; the center stays exactly fixed. */
export function animatedPosition(
  node: VisualNode,
  elapsedMs: number,
  reducedMotion: boolean,
): Point {
  if (reducedMotion || node.distance === 0) return { x: node.x, y: node.y };
  const phase = (stableHash(node.id) % 1000) / 100;
  return {
    x: node.x + Math.sin(elapsedMs / 3500 + phase) * 3,
    y: node.y + Math.cos(elapsedMs / 4200 + phase) * 3,
  };
}

export function transitionProgress(
  elapsedMs: number,
  reducedMotion: boolean,
): number {
  if (reducedMotion) return 1;
  return Math.min(1, Math.max(0, elapsedMs / 420));
}
