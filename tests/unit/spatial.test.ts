import { describe, expect, it } from "vitest";
import { generateMockGraph, mockAtomId } from "../../src/data/mock/graph";
import { getPerspective } from "../../src/graph/degrees/perspective";
import { createScene } from "../../src/living-atom/layout/scene";
import {
  createSpatialScene,
  viewScale,
} from "../../src/living-atom/layout/spatial";
import {
  depthOrder,
  projectPoint,
} from "../../src/living-atom/renderer/projection";
import { INITIAL_CAMERA } from "../../src/living-atom/interaction/camera";
import { orbitalPosition } from "../../src/living-atom/animation/spatial-motion";
import { atomContext } from "../../src/living-atom/interaction/atom-context";
import {
  idlePulse,
  pulsePhase,
} from "../../src/living-atom/pulse/presentation";
import { pulseSteps } from "../../src/living-atom/pulse/traversal";

const graph = generateMockGraph();
const base = createScene(graph, mockAtomId(0));
const scene = createSpatialScene(base, graph, "networks");

describe("spatial presentation preserves graph meaning", () => {
  it("is deterministic and gives direct Bonds varied depth and orbital geometry", () => {
    expect(createSpatialScene(base, graph, "networks")).toEqual(scene);
    const direct = scene.nodes.filter((node) => node.distance === 1);
    expect(direct).toHaveLength(12);
    expect(direct.some((node) => node.z < 0)).toBe(true);
    expect(direct.some((node) => node.z > 0)).toBe(true);
    expect(
      new Set(direct.map((node) => Math.round(Math.hypot(node.x, node.y))))
        .size,
    ).toBeGreaterThan(6);
    expect(
      new Set(direct.map((node) => node.orbit.speed)).size,
    ).toBeGreaterThan(6);
  });

  it("projects near objects larger, far objects smaller, and sorts far to near without mutation", () => {
    const near = projectPoint(
      { x: 100, y: 20, z: -100 },
      390,
      600,
      525,
      INITIAL_CAMERA,
    );
    const far = projectPoint(
      { x: 100, y: 20, z: 100 },
      390,
      600,
      525,
      INITIAL_CAMERA,
    );
    expect(near.perspective).toBeGreaterThan(far.perspective);
    expect(near.point.x).toBeGreaterThan(far.point.x);
    expect(
      projectPoint({ x: 100, y: 20, z: -100 }, 390, 600, 525, INITIAL_CAMERA),
    ).toEqual(near);
    const objects = [
      { id: "near", z: -100 },
      { id: "b", z: 0 },
      { id: "far", z: 100 },
      { id: "a", z: 0 },
    ];
    expect(depthOrder(objects).map((node) => node.id)).toEqual([
      "far",
      "a",
      "b",
      "near",
    ]);
    expect(objects[0]!.id).toBe("near");
  });

  it("keeps orbital motion bounded and freezes it under reduced motion", () => {
    const node = scene.nodes.find((node) => node.distance === 1)!;
    const initial = { x: node.x, y: node.y, z: node.z };
    expect(orbitalPosition(node, 0, false)).toEqual(initial);
    const moved = orbitalPosition(node, 30_000, false);
    expect(moved).not.toEqual(initial);
    expect(Math.hypot(moved.x - node.x, moved.y - node.y)).toBeLessThan(180);
    expect(orbitalPosition(node, 30_000, true)).toEqual(initial);
    const center = scene.nodes.find((node) => node.distance === 0)!;
    expect(orbitalPosition(center, 30_000, false)).toEqual({
      x: 0,
      y: 0,
      z: 0,
    });
  });

  it("keeps exact BFS membership and Pulse counts through each representation", () => {
    const perspective = getPerspective(graph, mockAtomId(0));
    const expectedMembers = base.nodes.flatMap((node) => node.members).sort();
    for (const mode of ["people", "networks", "regions"] as const) {
      const spatial = createSpatialScene(base, graph, mode);
      expect(spatial.nodes.flatMap((node) => node.members).sort()).toEqual(
        expectedMembers,
      );
      for (const node of spatial.nodes) {
        for (const member of node.members)
          expect(perspective.distances.get(member)).toBe(node.distance);
      }
      expect(pulseSteps(spatial).map((step) => step.atomCount)).toEqual(
        pulseSteps(base).map((step) => step.atomCount),
      );
      expect(spatial.nodes.length).toBeLessThan(130);
      const ids = new Set(spatial.nodes.map((node) => node.id));
      expect(
        spatial.edges.every(
          (edge) =>
            ids.has(edge.source) &&
            ids.has(edge.target) &&
            edge.source !== edge.target,
        ),
      ).toBe(true);
    }
  });

  it("collapses extended individuals into real regional clouds when zooming out", () => {
    const regional = createSpatialScene(base, graph, "regions");
    expect(regional.nodes.filter((node) => node.kind === "atom")).toHaveLength(
      13,
    );
    expect(
      scene.nodes.filter((node) => node.kind === "atom").length,
    ).toBeGreaterThan(13);
    expect(
      regional.nodes
        .filter((node) => node.kind === "aggregate")
        .every(
          (node) => node.particles.length > 0 && node.particles.length <= 48,
        ),
    ).toBe(true);
    expect(regional.regions.map((region) => region.label).sort()).toEqual([
      "Kanto",
      "Ontario",
      "Scotland",
    ]);
    expect(
      regional.regions.reduce((sum, region) => sum + region.reachableCount, 0),
    ).toBe(640);
    expect(
      regional.regions.reduce(
        (sum, region) => sum + region.representedCount,
        0,
      ),
    ).toBe(221);
    expect([0.7, 1, 1.65].map(viewScale)).toEqual([
      "regions",
      "networks",
      "people",
    ]);
  });

  it("explains real paths and only reports a direct Bond date for direct relationships", () => {
    const direct = atomContext(graph, mockAtomId(0), mockAtomId(180));
    expect(direct.distance).toBe(1);
    expect(direct.bondedAt).toBeDefined();
    expect(direct.reachableCount).toBe(640);
    const distant = atomContext(graph, mockAtomId(0), mockAtomId(907));
    expect(distant.distance).toBe(8);
    expect(distant.path.map((node) => node.id)).toEqual([
      mockAtomId(0),
      ...Array.from({ length: 8 }, (_, i) => mockAtomId(900 + i)),
    ]);
    expect(distant.bondedAt).toBeUndefined();
    const disconnected = atomContext(graph, mockAtomId(0), mockAtomId(540));
    expect(disconnected.distance).toBeUndefined();
    expect(disconnected.path).toEqual([]);
  });

  it("keeps unknown geography honest", () => {
    const anonymous = {
      ...graph,
      nodes: graph.nodes.map(({ id, publicId, degree }) => ({
        id,
        publicId,
        degree,
      })),
    };
    const unknown = createSpatialScene(
      createScene(anonymous, mockAtomId(0)),
      anonymous,
      "regions",
    );
    expect(unknown.regionCount).toBe(0);
    expect(unknown.countryCount).toBe(0);
    expect(unknown.regions[0]!.label).toBe("Unspecified region");
  });

  it("keeps Pulse origin/direction explicit and reduced motion discrete", () => {
    expect(idlePulse(mockAtomId(0))).toMatchObject({
      originId: mockAtomId(0),
      direction: "outgoing",
      distance: null,
      completed: false,
    });
    expect(pulsePhase(1000, 1300, false)).toBe(0.5);
    expect(pulsePhase(1000, 900, false)).toBe(0);
    expect(pulsePhase(1000, 2000, false)).toBe(1);
    expect(pulsePhase(1000, 1100, true)).toBe(1);
  });
});
