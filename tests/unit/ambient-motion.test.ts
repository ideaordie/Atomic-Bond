import { describe, expect, it, vi } from "vitest";
import { generateMockGraph, mockAtomId } from "../../src/data/mock/graph";
import { createAmbientClock } from "../../src/living-atom/animation/ambient-clock";
import {
  orbitalPosition,
  spatialPositions,
} from "../../src/living-atom/animation/spatial-motion";
import { createScene } from "../../src/living-atom/layout/scene";
import { createSpatialScene } from "../../src/living-atom/layout/spatial";
import { INITIAL_CAMERA } from "../../src/living-atom/interaction/camera";
import { createCanvasRenderer } from "../../src/living-atom/renderer/canvas-renderer";
import { projectPoint } from "../../src/living-atom/renderer/projection";
import type { RenderFrame } from "../../src/living-atom/types/scene";

const graph = generateMockGraph();
const scene = createSpatialScene(
  createScene(graph, mockAtomId(0)),
  graph,
  "networks",
);
const direct = scene.nodes.filter((node) => node.distance === 1);

describe("ambient motion regression", () => {
  it("advances only active time, freezes the current frame, and resumes without a jump", () => {
    const clock = createAmbientClock();
    expect(clock.sample(1000, true)).toBe(0);
    expect(clock.sample(11_000, true)).toBe(10_000);
    const before = spatialPositions(scene.nodes, 10_000);
    expect(clock.sample(11_010, false)).toBe(10_000);
    const stopped = clock.sample(60_000, false);
    expect(spatialPositions(scene.nodes, stopped)).toEqual(before);
    const resumed = clock.sample(90_000, true);
    expect(spatialPositions(scene.nodes, resumed)).toEqual(before);
    expect(clock.sample(90_033, true)).toBe(10_033);
    expect(clock.sample(90_066, true)).toBe(10_066);
    clock.reset();
    expect(clock.sample(95_000, true)).toBe(0);
  });

  it("never advances for reduced-motion/hidden time or a backwards timestamp", () => {
    const clock = createAmbientClock();
    expect(clock.sample(1000, false)).toBe(0);
    expect(clock.sample(50_000, false)).toBe(0);
    expect(clock.sample(51_000, true)).toBe(0);
    expect(clock.sample(51_100, true)).toBe(100);
    expect(clock.sample(51_050, true)).toBe(100);
  });

  it("makes direct motion perceptible over ten seconds after mobile projection", () => {
    const a = spatialPositions(scene.nodes, 0);
    const b = spatialPositions(scene.nodes, 10_000);
    const pixels = direct
      .map((node) => {
        const start = projectPoint(
          a.get(node.id)!,
          390,
          543,
          scene.extent,
          INITIAL_CAMERA,
        ).point;
        const end = projectPoint(
          b.get(node.id)!,
          390,
          543,
          scene.extent,
          INITIAL_CAMERA,
        ).point;
        return Math.hypot(end.x - start.x, end.y - start.y);
      })
      .sort((x, y) => x - y);
    // v0.3.0's median was 1.33px: numerically changing, perceptually static.
    expect(pixels[Math.floor(pixels.length / 2)]).toBeGreaterThan(8);
    expect(pixels.at(-1)).toBeLessThan(30);
    const center = scene.nodes.find((node) => node.distance === 0)!;
    expect(b.get(center.id)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("uses independent ellipses around the center rather than a rigid wheel", () => {
    const turns = direct.map((node) => {
      const position = orbitalPosition(node, 10_000, false);
      expect(Math.abs(position.z - node.z)).toBeGreaterThan(0.1);
      const cosine = Math.cos(node.orbit.inclination);
      const sine = Math.sin(node.orbit.inclination);
      const x = position.x * cosine + position.y * sine;
      const y = -position.x * sine + position.y * cosine;
      expect(
        (x / node.orbit.radiusX) ** 2 + (y / node.orbit.radiusY) ** 2,
      ).toBeCloseTo(1, 9);
      return Math.atan2(position.y, position.x) - Math.atan2(node.y, node.x);
    });
    expect(new Set(turns.map((turn) => turn.toFixed(3))).size).toBeGreaterThan(
      6,
    );
    expect(new Set(direct.map((node) => node.orbit.radiusX)).size).toBe(12);
  });

  it("carries local systems with their real direct parent, independently of input order", () => {
    const positions = spatialPositions(scene.nodes, 10_000);
    const child = scene.nodes.find((node) => node.orbit.parentId)!;
    const parent = scene.nodes.find(
      (node) => node.id === child.orbit.parentId,
    )!;
    expect(parent.distance).toBe(1);
    const local = orbitalPosition(child, 10_000, false);
    const movedParent = positions.get(parent.id)!;
    const movedChild = positions.get(child.id)!;
    for (const axis of ["x", "y", "z"] as const)
      expect(movedChild[axis] - local[axis]).toBeCloseTo(
        movedParent[axis] - parent[axis],
        9,
      );
    expect(spatialPositions([...scene.nodes].reverse(), 10_000)).toEqual(
      positions,
    );
    expect(
      scene.nodes
        .filter((node) => node.kind === "aggregate")
        .every((node) => {
          const moved = positions.get(node.id)!;
          return Math.hypot(moved.x - node.x, moved.y - node.y) > 0.5;
        }),
    ).toBe(true);
  });

  it("draws Bond endpoints and updates hit targets from the same moving positions", () => {
    const gradient = { addColorStop: vi.fn() };
    const context = {
      scale: vi.fn(),
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      clip: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      fillText: vi.fn(),
      setLineDash: vi.fn(),
      createRadialGradient: () => gradient,
      createLinearGradient: () => gradient,
    };
    const canvas = {
      getContext: () => context,
      ownerDocument: { createElement: () => ({ getContext: () => context }) },
    } as unknown as HTMLCanvasElement;
    const renderer = createCanvasRenderer(canvas);
    renderer.resize(390, 543, 1);
    const frame: RenderFrame = {
      scene,
      camera: INITIAL_CAMERA,
      elapsedMs: 0,
      transition: 1,
      reducedMotion: false,
      pulseDistance: null,
      pulseStartedAt: 0,
      pulseDirection: "outgoing",
      now: 0,
      originalId: mockAtomId(0),
      inspectedId: null,
    };
    renderer.draw(frame);
    const initialEndpoints = context.quadraticCurveTo.mock.calls.map((call) =>
      call.slice(2),
    );
    context.quadraticCurveTo.mockClear();
    renderer.draw({ ...frame, elapsedMs: 10_000, now: 10_000 });
    const endpoints = context.quadraticCurveTo.mock.calls.map((call) =>
      call.slice(2),
    );
    expect(endpoints).not.toEqual(initialEndpoints);
    const positions = spatialPositions(scene.nodes, 10_000);
    const nodes = new Map(scene.nodes.map((node) => [node.id, node]));
    for (const edge of scene.edges) {
      const a = nodes.get(edge.source)!;
      const b = nodes.get(edge.target)!;
      const end = a.distance <= b.distance ? b : a;
      const point = projectPoint(
        positions.get(end.id)!,
        390,
        543,
        scene.extent,
        INITIAL_CAMERA,
      ).point;
      expect(endpoints).toContainEqual([point.x, point.y]);
    }
    for (const node of direct) {
      const point = projectPoint(
        positions.get(node.id)!,
        390,
        543,
        scene.extent,
        INITIAL_CAMERA,
      ).point;
      expect(renderer.hitTest(point)?.id).toBe(node.id);
    }
    renderer.dispose();
  });
});
