import { getPerspective } from "../degrees/perspective";
import type { GraphData, NetworkReach } from "../../types/graph";

export function networkReach(graph: GraphData, id: string): NetworkReach {
  const view = getPerspective(graph, id);
  const nodes = [...view.distances.keys()].map((key) => view.nodes.get(key)!);
  const visibleLocations = nodes.filter(
    (n) => n.status !== "DEACTIVATED" && n.status !== "DELETED",
  );
  const unique = (values: (string | undefined)[]) =>
    [...new Set(values.filter((v): v is string => !!v))].sort();
  return {
    direct: view.neighbors.get(id)!.size,
    people: view.distances.size,
    cities: unique(
      visibleLocations.map((n) =>
        n.metadata?.city
          ? `${n.metadata.city}, ${n.metadata.region}, ${n.metadata.countryCode}`
          : undefined,
      ),
    ),
    regions: unique(
      visibleLocations.map((n) =>
        n.metadata?.region
          ? (n.metadata.subdivisionCode ??
            `${n.metadata.region}, ${n.metadata.countryCode}`)
          : undefined,
      ),
    ),
    countries: unique(visibleLocations.map((n) => n.metadata?.countryCode)),
  };
}
