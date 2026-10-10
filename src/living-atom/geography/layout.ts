import type { GraphData, GraphNode } from "../../types/graph";
import type { SpatialScene } from "../types/spatial";
import type { Point } from "../types/scene";
import { getPerspective } from "../../graph/degrees/perspective";

export interface Geography {
  revision: string;
  anchors: Record<string, readonly [number, number]>;
  outlines: readonly (readonly (readonly [number, number])[])[];
}
export interface MapPoint extends Point {
  located: boolean;
  anchor: string;
}
export interface GeographicLayout {
  points: ReadonlyMap<string, MapPoint>;
  geography: Geography;
  unlocated: number;
}

/** Consolidate all authorized members at their canonical anchor, independent of orbital groups. */
export function geographicScene(
  base: SpatialScene,
  graph: GraphData,
  data: Geography,
): SpatialScene {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const sourceNodes = new Map(
    base.nodes.flatMap((n) => n.members.map((id) => [id, n] as const)),
  );
  const groups = new Map<string, string[]>();
  for (const member of [...sourceNodes.keys()].sort()) {
    const source = byId.get(member);
    if (!source) continue;
    const key = geographicAnchor(source, data)?.code ?? "unlocated";
    const members = groups.get(key) ?? [];
    members.push(member);
    groups.set(key, members);
  }
  const representatives = new Map<string, string>();
  const nodes = [...groups].map(([key, members]) => {
    const selected = members.includes(base.selected.id);
    const source = sourceNodes.get(selected ? base.selected.id : members[0]!)!;
    const id = selected ? `atom:${base.selected.id}` : `geo:${key}`;
    members.forEach((member) => representatives.set(member, id));
    const country = key.split("-")[0]!;
    const countryName =
      key === "unlocated"
        ? "LOCATION NOT AVAILABLE"
        : (new Intl.DisplayNames(["en"], { type: "region" }).of(country) ??
          country);
    const location = byId.get(members[0]!)?.metadata;
    const label = key.includes("-")
      ? location?.homeRegion || `${location?.region || key}, ${countryName}`
      : countryName;
    return {
      ...source,
      id,
      members,
      label,
      kind: members.length === 1 ? ("atom" as const) : ("aggregate" as const),
    };
  });
  const distances = getPerspective(graph, base.selected.id).distances;
  const edges = new Map<string, SpatialScene["edges"][number]>();
  for (const edge of graph.edges) {
    const source = representatives.get(edge.source),
      target = representatives.get(edge.target);
    if (!source || !target || source === target) continue;
    const id = JSON.stringify([source, target].sort());
    edges.set(id, {
      id,
      source,
      target,
      count: (edges.get(id)?.count ?? 0) + 1,
      distance: Math.max(
        distances.get(edge.source)!,
        distances.get(edge.target)!,
      ),
    });
  }
  return { ...base, nodes, edges: [...edges.values()] };
}

/** Defense in depth for the already server-authorized component. No inferred locations. */
export function connectedComponent(
  graph: GraphData,
  ownerId: string,
): GraphData {
  const ids = getPerspective(graph, ownerId).distances;
  return {
    nodes: graph.nodes.filter((n) => ids.has(n.id)),
    edges: graph.edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
  };
}
export function geographicAnchor(
  node: GraphNode,
  data: Geography,
): { code: string; point: readonly [number, number] } | null {
  if (node.status === "DELETED" || node.status === "DEACTIVATED") return null;
  const country = node.metadata?.countryCode;
  const subdivision = node.metadata?.subdivisionCode;
  if (!country) return null;
  if (subdivision?.startsWith(country + "-") && data.anchors[subdivision])
    return { code: subdivision, point: data.anchors[subdivision] };
  return data.anchors[country]
    ? { code: country, point: data.anchors[country] }
    : null;
}
/** Equirectangular world coordinates; regional representative points, never participant GPS. */
export function geographicPoint([longitude, latitude]: readonly [
  number,
  number,
]): Point {
  return { x: longitude * 2.5, y: -latitude * 2.5 || 0 };
}
export function geographicLayout(
  scene: SpatialScene,
  graph: GraphData,
  data: Geography,
): GeographicLayout {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const anchors = new Map<string, ReturnType<typeof geographicAnchor>>();
  const groups = new Map<string, string[]>();
  let unlocated = 0;
  for (const node of scene.nodes) {
    const all = node.members.map((id) => geographicAnchor(byId.get(id)!, data));
    // Existing aggregates can cover multiple regions. Never assign such a group to a false location.
    const first = all[0] ?? null;
    const anchor =
      first && all.every((a) => a?.code === first.code) ? first : null;
    anchors.set(node.id, anchor);
    const key = anchor?.code ?? "unlocated";
    if (!anchor) unlocated += node.members.length;
    const ids = groups.get(key) ?? [];
    ids.push(node.id);
    groups.set(key, ids);
  }
  const points = new Map<string, MapPoint>();
  for (const [key, ids] of groups) {
    ids.sort();
    ids.forEach((id, index) => {
      const anchor = anchors.get(id);
      const center = anchor
        ? geographicPoint(anchor.point)
        : { x: -390 + (index % 12) * 65, y: 285 + Math.floor(index / 12) * 30 };
      const offset = { x: 0, y: 0 };
      points.set(id, {
        x: center.x + offset.x,
        y: center.y + offset.y,
        located: Boolean(anchor),
        anchor: key,
      });
    });
  }
  return { points, geography: data, unlocated };
}
/** Split a crossing into two segments meeting opposite world edges. */
export function datelineSegments(
  a: Point,
  b: Point,
): readonly (readonly [Point, Point])[] {
  if (Math.abs(a.x - b.x) <= 450) return [[a, b]];
  const shifted = { x: b.x + (b.x > a.x ? -900 : 900), y: b.y };
  const edge = shifted.x > a.x ? 450 : -450;
  const t = (edge - a.x) / (shifted.x - a.x);
  const y = a.y + (b.y - a.y) * t;
  return [
    [a, { x: edge, y }],
    [{ x: -edge, y }, b],
  ];
}
