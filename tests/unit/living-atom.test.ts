import { describe, expect, it } from "vitest";
import { generateMockGraph, mockAtomId } from "../../src/data/mock/graph";
import { createScene, DISPLAY_DEPTH } from "../../src/living-atom/layout/scene";
import {
  animatedPosition,
  transitionProgress,
} from "../../src/living-atom/animation/motion";
import {
  INITIAL_CAMERA,
  MAX_ZOOM,
  MIN_ZOOM,
  panCamera,
  returnToOriginal,
  selectAtom,
  zoomCamera,
} from "../../src/living-atom/interaction/camera";
import { pulseSteps } from "../../src/living-atom/pulse/traversal";
import { getPerspective } from "../../src/graph/degrees/perspective";

const fixture = generateMockGraph();
const originalId = mockAtomId(0);

describe("deterministic visualization input", () => {
  it("is repeatable, independent of input ordering, and does not mutate the graph", () => {
    const before = JSON.stringify(fixture);
    const first = createScene(fixture, originalId);
    expect(createScene(fixture, originalId)).toEqual(first);
    expect(
      createScene(
        {
          nodes: [...fixture.nodes].reverse(),
          edges: [...fixture.edges].reverse(),
        },
        originalId,
      ),
    ).toEqual(first);
    expect(JSON.stringify(fixture)).toBe(before);
  });
  it("places only the selected Atom exactly at the origin", () => {
    for (const id of [originalId, mockAtomId(180), mockAtomId(999)]) {
      const scene = createScene(fixture, id);
      const centers = scene.nodes.filter((node) => node.distance === 0);
      expect(centers).toHaveLength(1);
      expect(centers[0]).toMatchObject({
        x: 0,
        y: 0,
        members: [id],
        kind: "atom",
      });
    }
  });
  it("represents reachable nodes exactly once and reports omitted/disconnected nodes honestly", () => {
    const scene = createScene(fixture, originalId);
    const distances = getPerspective(fixture, originalId).distances;
    const members = scene.nodes.flatMap((node) => node.members);
    expect(new Set(members).size).toBe(members.length);
    expect(scene.representedCount).toBe(members.length);
    expect(scene.reachableCount).toBe(640);
    expect(scene.disconnectedCount).toBe(360);
    expect(scene.maxDistance).toBe(DISPLAY_DEPTH);
    expect(members.length).toBe(
      [...distances.values()].filter((distance) => distance <= DISPLAY_DEPTH)
        .length,
    );
    expect(scene.nodes.some((node) => node.kind === "aggregate")).toBe(true);
    for (const node of scene.nodes) {
      for (const member of node.members)
        expect(distances.get(member)).toBe(node.distance);
    }
  });
  it("only draws connections supported by real edges", () => {
    const scene = createScene(fixture, originalId);
    const representatives = new Map(
      scene.nodes.flatMap((node) =>
        node.members.map((member) => [member, node.id] as const),
      ),
    );
    const counts = new Map<string, number>();
    for (const edge of fixture.edges) {
      const source = representatives.get(edge.source);
      const target = representatives.get(edge.target);
      if (!source || !target || source === target) continue;
      const pair = JSON.stringify([source, target].sort());
      counts.set(pair, (counts.get(pair) ?? 0) + 1);
    }
    expect(scene.edges).toHaveLength(counts.size);
    for (const edge of scene.edges)
      expect(edge.count).toBe(counts.get(edge.id));
  });
  it("handles disconnected components and isolated Atoms without invented connections", () => {
    const scene = createScene(fixture, mockAtomId(720));
    expect(scene.reachableCount).toBe(180);
    expect(scene.disconnectedCount).toBe(820);
    const isolated = createScene(
      { nodes: [{ id: "alone", publicId: "alone", degree: 0 }], edges: [] },
      "alone",
    );
    expect(isolated.nodes).toHaveLength(1);
    expect(isolated.edges).toEqual([]);
    expect(isolated.maxDistance).toBe(0);
    expect(pulseSteps(isolated).map((step) => step.distance)).toEqual([0]);
  });
  it("bounds glyph count even when the selected Atom has thousands of direct Bonds", () => {
    const nodes = Array.from({ length: 5_001 }, (_, index) => ({
      id: String(index),
      publicId: String(index),
      degree: index === 0 ? 5_000 : 1,
    }));
    const edges = nodes
      .slice(1)
      .map((node) => ({ id: node.id, source: "0", target: node.id }));
    const scene = createScene({ nodes, edges }, "0");
    expect(scene.directCount).toBe(5_000);
    expect(scene.representedCount).toBe(5_001);
    expect(scene.nodes.length).toBeLessThanOrEqual(29);
    expect(scene.edges.length).toBeLessThanOrEqual(28);
  });
});

describe("selection and camera", () => {
  it("recenters without losing the original Atom and returns home", () => {
    const original = { originalId, selectedId: originalId };
    const next = selectAtom(original, mockAtomId(180));
    expect(createScene(fixture, next.selectedId).selected.id).toBe(
      mockAtomId(180),
    );
    expect(returnToOriginal(next)).toEqual(original);
    expect(original.selectedId).toBe(originalId);
  });
  it("clamps zoom and keeps the anchor stationary", () => {
    expect(zoomCamera(INITIAL_CAMERA, 100).zoom).toBe(MAX_ZOOM);
    expect(zoomCamera(INITIAL_CAMERA, 0.01).zoom).toBe(MIN_ZOOM);
    const camera = zoomCamera(INITIAL_CAMERA, 2, { x: 40, y: 30 });
    expect(camera.x + 40 * camera.zoom).toBe(40);
    expect(camera.y + 30 * camera.zoom).toBe(30);
    expect(panCamera(camera, { x: 10, y: -5 })).toEqual({
      zoom: 2,
      x: -30,
      y: -35,
    });
  });
});

describe("graph-aware Pulse and motion", () => {
  it("activates each represented Atom once in actual BFS order, including aggregate members", () => {
    const scene = createScene(fixture, originalId);
    const steps = pulseSteps(scene);
    expect(steps.map((step) => step.distance)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(steps.reduce((sum, step) => sum + step.atomCount, 0)).toBe(
      scene.representedCount,
    );
    for (const node of scene.nodes)
      expect(steps[node.distance]!.nodeIds).toContain(node.id);
    for (const edge of scene.edges)
      expect(steps[edge.distance]!.edgeIds).toContain(edge.id);
    expect(steps[0]!.edgeIds).toEqual([]);
  });
  it("keeps the center fixed and suppresses all spatial drift in reduced-motion mode", () => {
    const scene = createScene(fixture, originalId);
    const center = scene.nodes.find((node) => node.distance === 0)!;
    const outer = scene.nodes.find((node) => node.distance === 1)!;
    expect(animatedPosition(center, 7000, false)).toEqual({ x: 0, y: 0 });
    expect(animatedPosition(outer, 7000, true)).toEqual({
      x: outer.x,
      y: outer.y,
    });
    expect(animatedPosition(outer, 7000, false)).not.toEqual(
      animatedPosition(outer, 0, false),
    );
    expect(transitionProgress(0, true)).toBe(1);
    expect(transitionProgress(0, false)).toBe(0);
    expect(transitionProgress(420, false)).toBe(1);
  });
});
