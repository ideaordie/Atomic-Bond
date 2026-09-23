import type { GraphNode } from "../../types/graph";
import type { SpatialScene } from "./spatial";
import type { PulseDirection } from "../pulse/presentation";

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface VisualNode extends Point {
  readonly id: string;
  readonly kind: "atom" | "aggregate";
  readonly distance: number;
  readonly members: readonly string[];
  readonly label: string;
}

export interface VisualEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  /** Number of actual graph edges summarized by this line. */
  readonly count: number;
  readonly distance: number;
}

export interface AtomScene {
  readonly selected: GraphNode;
  readonly nodes: readonly VisualNode[];
  readonly edges: readonly VisualEdge[];
  readonly directCount: number;
  /** Counts include the selected Atom. */
  readonly reachableCount: number;
  readonly representedCount: number;
  readonly disconnectedCount: number;
  readonly maxDistance: number;
  readonly extent: number;
}

export interface Camera {
  readonly zoom: number;
  readonly x: number;
  readonly y: number;
}

export interface RenderFrame {
  readonly scene: SpatialScene;
  readonly camera: Camera;
  readonly elapsedMs: number;
  readonly transition: number;
  readonly reducedMotion: boolean;
  readonly pulseDistance: number | null;
  readonly pulseStartedAt: number;
  readonly pulseDirection: PulseDirection;
  readonly now: number;
  readonly originalId: string;
  readonly inspectedId: string | null;
  readonly arrival?: { readonly id: string; readonly progress: number };
}

/** Replace the adapter without changing traversal, scene generation or React UI. */
export interface AtomRenderer {
  resize(width: number, height: number, pixelRatio: number): void;
  draw(frame: RenderFrame): void;
  hitTest(point: Point): VisualNode | undefined;
  dispose(): void;
}

export type RendererFactory = (canvas: HTMLCanvasElement) => AtomRenderer;
