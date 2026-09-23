import { getPerspective } from "../degrees/perspective";
import type { GraphData, NetworkReach } from "../../types/graph";

export function networkReach(graph: GraphData, id: string): NetworkReach {
  const view = getPerspective(graph, id);
  const nodes = [...view.distances.keys()].map((key) => view.nodes.get(key)!);
  const unique = (values: (string | undefined)[]) =>
    [...new Set(values.filter((v): v is string => !!v))].sort();
  return {
    direct: view.neighbors.get(id)!.size,
    people: view.distances.size,
    cities: unique(
      nodes.map((n) =>
        n.metadata?.city
          ? `${n.metadata.city}, ${n.metadata.region}, ${n.metadata.countryCode}`
          : undefined,
      ),
    ),
    regions: unique(
      nodes.map((n) =>
        n.metadata?.region
          ? `${n.metadata.region}, ${n.metadata.countryCode}`
          : undefined,
      ),
    ),
    countries: unique(nodes.map((n) => n.metadata?.countryCode)),
  };
}
