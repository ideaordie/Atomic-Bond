import type { Camera, Point } from "../types/scene";
import type { Point3D } from "../types/spatial";

export interface Projection {
  readonly point: Point;
  readonly perspective: number;
  readonly depth: number;
}
export function projectPoint(
  point: Point3D,
  width: number,
  height: number,
  extent: number,
  camera: Camera,
): Projection {
  const perspective = 900 / (900 + Math.max(-450, point.z));
  const scale = (Math.min(width, height) / (extent * 2)) * camera.zoom;
  return {
    point: {
      x:
        width / 2 +
        camera.x +
        point.x *
          perspective *
          scale *
          Math.max(1, Math.min(1.35, width / height)),
      y: height / 2 + camera.y + point.y * perspective * scale,
    },
    perspective,
    depth: point.z,
  };
}
/** Positive z is farther away. Paint far objects first, breaking ties deterministically. */
export function depthOrder<T extends { id: string; z: number }>(
  nodes: readonly T[],
): T[] {
  return [...nodes].sort(
    (a, b) => b.z - a.z || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}
