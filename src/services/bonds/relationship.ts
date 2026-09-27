import type { GraphData } from "../../types/graph";

export function bondRelationship(
  graph: GraphData,
  owner: string | null,
  inviter: string,
) {
  if (owner === inviter) return "self";
  if (
    owner &&
    graph.edges.some(
      (e) =>
        (e.source === owner && e.target === inviter) ||
        (e.target === owner && e.source === inviter),
    )
  )
    return "bonded";
  return "available";
}
