import type { GraphData } from "../types/graph";

/** Public projections and synthetic fixtures share the same lifecycle filter. */
export function activeNetwork(graph: GraphData): GraphData {
  const nodes = graph.nodes.filter(
    (node) => !node.status || node.status === "ACTIVE",
  );
  if (nodes.length === graph.nodes.length) return graph;
  const ids = new Set(nodes.map((node) => node.id));
  const edges = graph.edges.filter(
    (edge) => ids.has(edge.source) && ids.has(edge.target),
  );
  const degrees = new Map<string, number>();
  for (const edge of edges) {
    degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1);
    degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1);
  }
  return {
    nodes: nodes.map((node) => ({
      ...node,
      degree: degrees.get(node.id) ?? 0,
    })),
    edges,
  };
}
