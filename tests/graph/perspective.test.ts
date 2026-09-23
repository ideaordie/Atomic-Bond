import { describe, expect, it } from "vitest";
import { getPerspective } from "../../src/graph/degrees/perspective";
import { generateMockGraph, mockAtomId } from "../../src/data/mock/graph";
import type { GraphData } from "../../src/types/graph";

const graph: GraphData = {
  nodes: ["a", "b", "c", "d", "isolated"].map((id) => ({
    id,
    publicId: id,
    degree: 99,
  })),
  edges: [
    ["a", "b"],
    ["a", "c"],
    ["b", "d"],
    ["c", "d"],
  ].map(([source, target], index) => ({
    id: String(index),
    source: source!,
    target: target!,
  })),
};

describe("visualization graph distances", () => {
  it("uses shortest-path distance, not GraphNode.degree, and handles cycles", () => {
    const result = getPerspective(graph, "a");
    expect([...result.distances.entries()]).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 1],
      ["d", 2],
    ]);
    expect(result.neighbors.get("a")?.size).toBe(2);
  });
  it("recalculates relationships from a different center", () => {
    const result = getPerspective(graph, "b");
    expect(result.distances.get("b")).toBe(0);
    expect(result.distances.get("d")).toBe(1);
    expect(result.distances.get("c")).toBe(2);
  });
  it("never includes a disconnected node and supports an isolated center", () => {
    expect(getPerspective(graph, "a").distances.has("isolated")).toBe(false);
    expect([...getPerspective(graph, "isolated").distances]).toEqual([
      ["isolated", 0],
    ]);
  });
  it("matches known fixture paths and disconnected component sizes", () => {
    const fixture = generateMockGraph();
    const root = getPerspective(fixture, mockAtomId(0));
    expect(root.distances.size).toBe(640);
    expect(root.distances.get(mockAtomId(999))).toBe(100);
    expect(root.distances.get(mockAtomId(360))).toBe(2);
    expect(getPerspective(fixture, mockAtomId(540)).distances.size).toBe(180);
  });
  it("rejects missing centers, duplicate IDs and malformed endpoints", () => {
    expect(() => getPerspective(graph, "unknown")).toThrow("absent");
    expect(() =>
      getPerspective(
        { ...graph, nodes: [...graph.nodes, graph.nodes[0]!] },
        "a",
      ),
    ).toThrow("Duplicate");
    expect(() =>
      getPerspective(
        { ...graph, edges: [{ id: "bad", source: "a", target: "unknown" }] },
        "a",
      ),
    ).toThrow("Invalid");
    expect(() =>
      getPerspective(
        { ...graph, edges: [{ id: "bad", source: "a", target: "a" }] },
        "a",
      ),
    ).toThrow("Invalid");
  });
});
