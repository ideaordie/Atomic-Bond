import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateMockGraph, mockAtomId } from "../../src/data/mock/graph";
import type { GraphData } from "../../src/types/graph";

// Test-only traversal oracle; production graph algorithms belong to later tasks.
function adjacency(graph: GraphData, omittedEdge?: string) {
  const result = new Map(graph.nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of graph.edges) {
    if (edge.id === omittedEdge) continue;
    result.get(edge.source)!.push(edge.target);
    result.get(edge.target)!.push(edge.source);
  }
  return result;
}

function distances(neighbors: Map<string, string[]>, start: string) {
  const result = new Map([[start, 0]]);
  const queue = [start];
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index]!;
    for (const next of neighbors.get(current)!) {
      if (result.has(next)) continue;
      result.set(next, result.get(current)! + 1);
      queue.push(next);
    }
  }
  return result;
}

describe("mock graph v1", () => {
  it("repeats exactly and returns independent data", () => {
    const first = generateMockGraph();
    const second = generateMockGraph();
    expect(first).toEqual(second);
    expect(first.nodes[0]).not.toBe(second.nodes[0]);
    expect(first.edges[0]).not.toBe(second.edges[0]);
    expect(first.nodes[0]?.metadata).not.toBe(second.nodes[0]?.metadata);
  });

  it("locks the complete fixture against accidental topology or metadata drift", () => {
    const digest = createHash("sha256")
      .update(JSON.stringify(generateMockGraph()))
      .digest("hex");
    expect(digest).toBe(
      "e1865e180db4f4c4251315e02e879892e0c7b0e9b6ca821cd7fabf69b1947751",
    );
  });

  it("has 1,000 unique Atoms and 4,062 unique, valid undirected Bonds", () => {
    const graph = generateMockGraph();
    const ids = new Set(graph.nodes.map((node) => node.id));
    expect(graph.nodes).toHaveLength(1_000);
    expect(ids.size).toBe(1_000);
    expect(new Set(graph.nodes.map((node) => node.publicId)).size).toBe(1_000);
    expect(graph.edges).toHaveLength(4_062);
    expect(new Set(graph.edges.map((edge) => edge.id)).size).toBe(4_062);
    const pairs = new Set<string>();
    for (const edge of graph.edges) {
      expect(ids.has(edge.source) && ids.has(edge.target)).toBe(true);
      expect(edge.source).not.toBe(edge.target);
      pairs.add([edge.source, edge.target].sort().join("|"));
      expect(edge.metadata?.synthetic).toBe(true);
    }
    expect(pairs.size).toBe(graph.edges.length);
    const neighbors = adjacency(graph);
    for (const node of graph.nodes)
      expect(node.degree).toBe(neighbors.get(node.id)!.length);
    expect(graph.nodes.reduce((sum, node) => sum + node.degree, 0)).toBe(
      2 * graph.edges.length,
    );
  });

  it("has exactly three components of sizes 640, 180 and 180", () => {
    const graph = generateMockGraph();
    const neighbors = adjacency(graph);
    const unseen = new Set(neighbors.keys());
    const sizes: number[] = [];
    for (const id of neighbors.keys()) {
      if (!unseen.has(id)) continue;
      const component = distances(neighbors, id);
      sizes.push(component.size);
      for (const member of component.keys()) unseen.delete(member);
    }
    expect(sizes.sort((a, b) => a - b)).toEqual([180, 180, 640]);
  });

  it("contains dense and sparse clusters across five coarse regions", () => {
    const { nodes } = generateMockGraph();
    expect(new Set(nodes.map((node) => node.metadata?.clusterId)).size).toBe(6);
    expect(new Set(nodes.map((node) => node.metadata?.countryCode)).size).toBe(
      5,
    );
    expect(nodes[1]?.degree).toBe(10);
    expect(nodes[720]?.degree).toBe(4);
    expect(nodes[999]?.degree).toBe(1);
  });

  it("proves known Bridges by removing each and checking reachability", () => {
    const graph = generateMockGraph();
    const bridges: [number, number][] = [
      [0, 180],
      [180, 360],
      [0, 900],
    ];
    for (let index = 900; index < 999; index++)
      bridges.push([index, index + 1]);
    for (const [a, b] of bridges) {
      const edge = graph.edges.find(
        (candidate) =>
          candidate.source === mockAtomId(a) &&
          candidate.target === mockAtomId(b),
      )!;
      expect(edge).toBeDefined();
      expect(
        distances(adjacency(graph, edge.id), edge.source).has(edge.target),
      ).toBe(false);
    }
    // A ring edge is not a Bridge: alternate routes remain.
    const ordinary = graph.edges[0]!;
    expect(
      distances(adjacency(graph, ordinary.id), ordinary.source).has(
        ordinary.target,
      ),
    ).toBe(true);
  });

  it("preserves known shortest distances and unreachable destinations", () => {
    const neighbors = adjacency(generateMockGraph());
    const fromRoot = distances(neighbors, mockAtomId(0));
    expect(fromRoot.get(mockAtomId(360))).toBe(2);
    expect(fromRoot.get(mockAtomId(999))).toBe(100);
    expect(fromRoot.has(mockAtomId(540))).toBe(false);
    expect(distances(neighbors, mockAtomId(900)).get(mockAtomId(999))).toBe(99);
  });

  it("exposes only the explicitly allowed synthetic public fields", () => {
    const graph = generateMockGraph();
    for (const node of graph.nodes) {
      expect(Object.keys(node).sort()).toEqual([
        "degree",
        "displayName",
        "id",
        "metadata",
        "publicId",
      ]);
      expect(Object.keys(node.metadata!).sort()).toEqual([
        "clusterId",
        "countryCode",
        "region",
        "synthetic",
      ]);
      expect(node.metadata?.synthetic).toBe(true);
    }
    for (const edge of graph.edges) {
      expect(Object.keys(edge).sort()).toEqual([
        "createdAt",
        "id",
        "metadata",
        "source",
        "target",
      ]);
      expect(Object.keys(edge.metadata!)).toEqual(["synthetic"]);
    }
  });
});
