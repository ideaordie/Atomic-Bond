import type { AtomScene, Point, VisualNode } from "./scene";

export type ViewScale = "people" | "networks" | "regions";
export interface Point3D extends Point {
  readonly z: number;
}
export interface Orbit {
  readonly anchor: Point3D;
  /** Nearby systems inherit their direct parent's displacement. */
  readonly parentId: string | null;
  readonly radiusX: number;
  readonly radiusY: number;
  readonly inclination: number;
  readonly phase: number;
  readonly speed: number;
  readonly depthRadius: number;
  readonly depthPhase: number;
}
export interface SpatialNode extends VisualNode, Point3D {
  readonly orbit: Orbit;
  readonly regionKey: string;
  readonly tint: string;
  /** Precomputed local particle offsets; these represent density, not individual people. */
  readonly particles: readonly Point3D[];
}
/** Coarse public geography only. No coordinates, inferred location, or identity data. */
export interface RegionSummary {
  readonly key: string;
  readonly label: string;
  readonly countryCode: string | undefined;
  readonly reachableCount: number;
  readonly representedCount: number;
  readonly anchor: Point3D;
  readonly tint: string;
}
export interface SpatialScene extends AtomScene {
  readonly nodes: readonly SpatialNode[];
  readonly regions: readonly RegionSummary[];
  readonly regionCount: number;
  readonly countryCount: number;
  readonly mode: ViewScale;
}
