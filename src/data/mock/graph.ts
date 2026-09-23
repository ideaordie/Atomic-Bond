import type { GraphData, GraphEdge, GraphNode } from "../../types/graph";

const regions = [
  ["Ontario", "CA"],
  ["Scotland", "GB"],
  ["Kanto", "JP"],
  ["Gauteng", "ZA"],
  ["Victoria", "AU"],
] as const;

export const MOCK_GRAPH_VERSION = "1";
export const mockAtomId = (index: number): string =>
  `mock-atom-${String(index + 1).padStart(8, "0")}`;

/** Fixed topology: no clock, randomness, network, or mutable shared result. */
export function generateMockGraph(): GraphData {
  const edges: GraphEdge[] = [];
  const degrees = Array<number>(1_000).fill(0);
  const addEdge = (a: number, b: number) => {
    const source = mockAtomId(Math.min(a, b));
    const target = mockAtomId(Math.max(a, b));
    edges.push({
      id: `mock-bond:${source}:${target}`,
      source,
      target,
      createdAt: "2026-01-01T00:00:00.000Z",
      metadata: { synthetic: true },
    });
    degrees[a] = degrees[a]! + 1;
    degrees[b] = degrees[b]! + 1;
  };

  // Five 180-node ring lattices. Four dense clusters, one sparse cluster.
  for (let cluster = 0; cluster < 5; cluster++) {
    const neighbors = cluster === 4 ? 2 : 5;
    for (let local = 0; local < 180; local++) {
      for (let offset = 1; offset <= neighbors; offset++) {
        addEdge(
          cluster * 180 + local,
          cluster * 180 + ((local + offset) % 180),
        );
      }
    }
  }
  // Exactly two connections between clusters; cluster 3 and 4 stay separate.
  addEdge(0, 180);
  addEdge(180, 360);
  // A 100-edge tail on cluster 0 provides a unique, predictable long path.
  addEdge(0, 900);
  for (let index = 900; index < 999; index++) addEdge(index, index + 1);

  const nodes: GraphNode[] = Array.from({ length: 1_000 }, (_, index) => {
    const cluster = index < 900 ? Math.floor(index / 180) : 5;
    const [region, countryCode] = regions[cluster % regions.length]!;
    return {
      id: mockAtomId(index),
      publicId: String(index + 1).padStart(8, "0"),
      degree: degrees[index]!,
      displayName: `Simulated Atom ${index + 1}`,
      metadata: {
        region,
        countryCode,
        clusterId: `cluster-${cluster}`,
        synthetic: true,
      },
    };
  });
  return { nodes, edges };
}
