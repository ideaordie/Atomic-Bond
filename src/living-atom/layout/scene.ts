import type { GraphData } from "../../types/graph";
import { getPerspective } from "../../graph/degrees/perspective";
import type { AtomScene, VisualEdge, VisualNode } from "../types/scene";

export const DISPLAY_DEPTH = 8;
export const ATOMS_PER_LAYER = 24;
export const AGGREGATES_PER_LAYER = 4;

export function stableHash(value: string): number {
  let hash = 2166136261;
  for (const character of value)
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
}

export function shellRadius(distance: number): number {
  return distance === 0
    ? 0
    : distance === 1
      ? 110
      : distance === 2
        ? 195
        : distance === 3
          ? 265
          : 320 + (distance - 4) * 38;
}

/** Pure and input-order-independent. Aggregates never mix different distances. */
export function createScene(graph: GraphData, selectedId: string): AtomScene {
  const perspective = getPerspective(graph, selectedId);
  const groups = new Map<
    string,
    { distance: number; members: string[]; kind: "atom" | "aggregate" }
  >();
  const layerCounts = new Map<number, number>();
  const ids = [...perspective.distances.keys()].sort();
  for (const id of ids) {
    const distance = perspective.distances.get(id)!;
    if (distance > DISPLAY_DEPTH) continue;
    const count = layerCounts.get(distance) ?? 0;
    const individual =
      distance === 0 || (distance <= 3 && count < ATOMS_PER_LAYER);
    layerCounts.set(distance, count + 1);
    const node = perspective.nodes.get(id)!;
    const bucket =
      stableHash(node.metadata?.clusterId ?? id) % AGGREGATES_PER_LAYER;
    const key = individual ? `atom:${id}` : `aggregate:${distance}:${bucket}`;
    const group = groups.get(key) ?? {
      distance,
      members: [],
      kind: individual ? "atom" : "aggregate",
    };
    group.members.push(id);
    groups.set(key, group);
  }
  const sortedGroups = [...groups.entries()].sort(
    ([a, left], [b, right]) =>
      left.distance - right.distance || (a < b ? -1 : a > b ? 1 : 0),
  );
  const nodes: VisualNode[] = [];
  const representatives = new Map<string, string>();
  for (let distance = 0; distance <= DISPLAY_DEPTH; distance++) {
    const layer = sortedGroups.filter(
      ([, group]) => group.distance === distance,
    );
    layer.forEach(([id, group], index) => {
      const angle =
        (index / layer.length) * Math.PI * 2 - Math.PI / 2 + distance * 0.39;
      const radius = shellRadius(distance);
      const atom = perspective.nodes.get(group.members[0]!)!;
      nodes.push({
        id,
        kind: group.kind,
        distance,
        members: group.members,
        label:
          group.kind === "atom"
            ? `Atom #${atom.publicId}`
            : `${group.members.length} Atoms · degree ${distance}`,
        x: distance === 0 ? 0 : Math.cos(angle) * radius,
        y: distance === 0 ? 0 : Math.sin(angle) * radius,
      });
      for (const member of group.members) representatives.set(member, id);
    });
  }
  const edgesByPair = new Map<string, VisualEdge>();
  const seenPairs = new Set<string>();
  for (const edge of graph.edges) {
    // Defensive deduplication of the undirected public projection.
    const originalPair = JSON.stringify([edge.source, edge.target].sort());
    if (seenPairs.has(originalPair)) continue;
    seenPairs.add(originalPair);
    const a = representatives.get(edge.source);
    const b = representatives.get(edge.target);
    if (!a || !b || a === b) continue;
    const [source, target] = [a, b].sort() as [string, string];
    const id = JSON.stringify([source, target]);
    const previous = edgesByPair.get(id);
    edgesByPair.set(id, {
      id,
      source,
      target,
      count: (previous?.count ?? 0) + 1,
      distance: Math.max(
        perspective.distances.get(edge.source)!,
        perspective.distances.get(edge.target)!,
      ),
    });
  }
  const maxDistance = Math.max(...nodes.map((node) => node.distance));
  return {
    selected: perspective.nodes.get(selectedId)!,
    nodes,
    edges: [...edgesByPair.values()].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    ),
    directCount: perspective.neighbors.get(selectedId)!.size,
    reachableCount: perspective.distances.size,
    representedCount: representatives.size,
    disconnectedCount: graph.nodes.length - perspective.distances.size,
    maxDistance,
    extent: Math.max(220, shellRadius(maxDistance) + 72),
  };
}
