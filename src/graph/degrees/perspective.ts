import type { GraphData, GraphNode } from "../../types/graph";

export interface GraphPerspective {
  readonly nodes: ReadonlyMap<string, GraphNode>;
  readonly neighbors: ReadonlyMap<string, ReadonlySet<string>>;
  /** Shortest unweighted distance from the selected Atom, not incident degree. */
  readonly distances: ReadonlyMap<string, number>;
  readonly selectedId: string;
}

/** O(V + E) traversal of a public, undirected graph. Disconnected nodes are absent. */
export function getPerspective(
  graph: GraphData,
  selectedId: string,
): GraphPerspective {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  if (nodes.size !== graph.nodes.length) throw new Error("Duplicate Atom ID");
  if (!nodes.has(selectedId))
    throw new Error("Selected Atom is absent from graph");
  const neighbors = new Map(
    graph.nodes.map((node) => [node.id, new Set<string>()]),
  );
  for (const edge of graph.edges) {
    if (
      !nodes.has(edge.source) ||
      !nodes.has(edge.target) ||
      edge.source === edge.target
    ) {
      throw new Error("Invalid graph edge");
    }
    neighbors.get(edge.source)!.add(edge.target);
    neighbors.get(edge.target)!.add(edge.source);
  }
  const distances = new Map([[selectedId, 0]]);
  const queue = [selectedId];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const id = queue[cursor]!;
    for (const neighbor of neighbors.get(id)!) {
      if (distances.has(neighbor)) continue;
      distances.set(neighbor, distances.get(id)! + 1);
      queue.push(neighbor);
    }
  }
  return { nodes, neighbors, distances, selectedId };
}
