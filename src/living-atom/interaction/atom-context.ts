import type { GraphData } from "../../types/graph";
import { getPerspective } from "../../graph/degrees/perspective";
import { regionKey } from "../layout/spatial";

/** Follow descending, already-computed BFS distances; no alternative traversal algorithm. */
export function atomContext(
  graph: GraphData,
  centerId: string,
  selectedId: string,
) {
  const center = getPerspective(graph, centerId);
  const selected = center.nodes.get(selectedId);
  if (!selected) throw new Error("Selected Atom is absent from graph");
  const distance = center.distances.get(selectedId);
  const path = distance === undefined ? [] : [selectedId];
  while (path.length && path[0] !== centerId) {
    const current = path[0]!;
    const depth = center.distances.get(current)!;
    path.unshift(
      [...center.neighbors.get(current)!]
        .filter((id) => center.distances.get(id) === depth - 1)
        .sort()[0]!,
    );
  }
  const network = getPerspective(graph, selectedId);
  const members = [...network.distances.keys()].map((id) =>
    network.nodes.get(id)!,
  );
  const regions = new Set(
    members.filter((node) => node.metadata?.region).map(regionKey),
  );
  const countries = new Set(
    members.map((node) => node.metadata?.countryCode).filter(Boolean),
  );
  const cities = new Set(
    members
      .filter((node) => node.metadata?.city)
      .map((node) =>
        JSON.stringify([
          node.metadata?.countryCode,
          node.metadata?.region,
          node.metadata?.city,
        ]),
      ),
  );
  const directEdge =
    distance === 1
      ? graph.edges.find(
          (edge) =>
            (edge.source === centerId && edge.target === selectedId) ||
            (edge.target === centerId && edge.source === selectedId),
        )
      : undefined;
  return {
    selected,
    distance,
    path: path.map((id) => center.nodes.get(id)!),
    reachableCount: network.distances.size,
    directCount: network.neighbors.get(selectedId)!.size,
    regionCount: regions.size,
    countryCount: countries.size,
    cityCount: cities.size,
    bondedAt: directEdge?.createdAt,
  };
}
