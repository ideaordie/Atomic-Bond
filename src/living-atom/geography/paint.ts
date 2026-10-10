import type { Camera, Point } from "../types/scene";
import type { Geography } from "./layout";
import { geographicPoint } from "./layout";

export function mapTransform(width: number, height: number, camera: Camera) {
  const left = width >= 700 ? 215 : 18;
  const scale =
    Math.min((width - left - 18) / 1000, (height - 100) / 700) * camera.zoom;
  return {
    scale,
    x: (width + left - 18) / 2 + camera.x,
    y: height * 0.46 + camera.y,
  };
}
export function mapScreen(
  point: Point,
  width: number,
  height: number,
  camera: Camera,
): Point {
  const t = mapTransform(width, height, camera);
  return { x: t.x + point.x * t.scale, y: t.y + point.y * t.scale };
}
export function countryPath(data: Geography): Path2D {
  const path = new Path2D();
  for (const ring of data.outlines) {
    let previous: Point | null = null;
    for (const coordinate of ring) {
      const p = geographicPoint(coordinate);
      if (!previous || Math.abs(previous.x - p.x) > 450) path.moveTo(p.x, p.y);
      else path.lineTo(p.x, p.y);
      previous = p;
    }
  }
  return path;
}
