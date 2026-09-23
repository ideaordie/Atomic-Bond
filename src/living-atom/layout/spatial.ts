import type { GraphData, GraphNode } from "../../types/graph";
import { getPerspective } from "../../graph/degrees/perspective";
import type { AtomScene, VisualEdge } from "../types/scene";
import type {
  Point3D,
  RegionSummary,
  SpatialNode,
  SpatialScene,
  ViewScale,
} from "../types/spatial";
import { stableHash } from "./scene";

export const regionKey = (node: GraphNode) =>
  JSON.stringify([
    node.metadata?.countryCode ?? "",
    node.metadata?.region ?? "Unspecified region",
  ]);
export const viewScale = (zoom: number): ViewScale =>
  zoom < 0.86 ? "regions" : zoom >= 1.4 ? "people" : "networks";
export const fraction = (id: string, salt: number) => {
  // Avalanche the stable hash so adjacent particle salts do not form bands.
  let value = stableHash(`${id}:${salt}`);
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
};
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const TINTS = [
  "#65ccec",
  "#b9a0ec",
  "#77e3cf",
  "#ecbf7e",
  "#8eaeec",
  "#d5b6e7",
];

export function regionAnchor(index: number): Point3D {
  const angle = [-2.25, -0.25, 1.9, 0.9, -1.15, 2.9, 0.1][index % 7]!;
  return {
    x: Math.cos(angle) * 370,
    y: Math.sin(angle) * 325,
    z: 70 + (index % 3) * 30,
  };
}

/** Presentation adapter only: consumes the v0.1 scene and unchanged BFS results. */
export function createSpatialScene(
  base: AtomScene,
  graph: GraphData,
  mode: ViewScale,
): SpatialScene {
  const perspective = getPerspective(graph, base.selected.id);
  const represented = new Set(base.nodes.flatMap((node) => node.members));
  const regionMembers = new Map<string, string[]>();
  for (const id of [...perspective.distances.keys()].sort()) {
    const key = regionKey(perspective.nodes.get(id)!);
    const members = regionMembers.get(key) ?? [];
    members.push(id);
    regionMembers.set(key, members);
  }
  const regionKeys = [...regionMembers.keys()].sort();
  // Bound coarse group diversity; preserve genuine labels, never invent regions.
  const displayedKeys = regionKeys.slice(0, 6);
  const bucketKey = (key: string) =>
    displayedKeys.includes(key) ? key : "other-regions";
  const regions: RegionSummary[] = displayedKeys.map((key, index) => {
    const ids = regionMembers.get(key)!;
    const first = perspective.nodes.get(ids[0]!)!;
    return {
      key,
      label: first.metadata?.region ?? "Unspecified region",
      countryCode: first.metadata?.countryCode,
      reachableCount: ids.length,
      representedCount: ids.filter((id) => represented.has(id)).length,
      anchor: regionAnchor(index),
      tint: TINTS[index % TINTS.length]!,
    };
  });
  if (regionKeys.length > 6) {
    const ids = regionKeys.slice(6).flatMap((key) => regionMembers.get(key)!);
    regions.push({
      key: "other-regions",
      label: "Other regions",
      countryCode: undefined,
      reachableCount: ids.length,
      representedCount: ids.filter((id) => represented.has(id)).length,
      anchor: regionAnchor(6),
      tint: TINTS[0]!,
    });
  }
  const regionMap = new Map(regions.map((region) => [region.key, region]));
  const individuals = new Set(
    base.nodes
      .filter(
        (node) =>
          node.kind === "atom" && (mode !== "regions" || node.distance <= 1),
      )
      .flatMap((node) => node.members),
  );
  const groups = new Map<
    string,
    {
      members: string[];
      distance: number;
      region: string;
      kind: "atom" | "aggregate";
    }
  >();
  for (const id of [...represented].sort()) {
    const distance = perspective.distances.get(id)!;
    const region = bucketKey(regionKey(perspective.nodes.get(id)!));
    const kind = individuals.has(id) ? "atom" : "aggregate";
    const key = kind === "atom" ? `atom:${id}` : `cloud:${distance}:${region}`;
    const group = groups.get(key) ?? { members: [], distance, region, kind };
    group.members.push(id);
    groups.set(key, group);
  }
  const ordered = [...groups.entries()].sort(
    ([a, left], [b, right]) => left.distance - right.distance || compare(a, b),
  );
  const directIds = ordered
    .filter(([, group]) => group.distance === 1 && group.kind === "atom")
    .map(([id]) => id);
  const positions = new Map<string, Point3D>();
  const branch = (id: string): string => {
    let cursor = id;
    while ((perspective.distances.get(cursor) ?? 0) > 1) {
      const depth = perspective.distances.get(cursor)!;
      cursor = [...perspective.neighbors.get(cursor)!]
        .filter(
          (candidate) => perspective.distances.get(candidate) === depth - 1,
        )
        .sort()[0]!;
    }
    return `atom:${cursor}`;
  };
  const representatives = new Map<string, string>();
  const nodes: SpatialNode[] = ordered.map(([id, group]) => {
    const region = regionMap.get(group.region)!;
    const first = perspective.nodes.get(group.members[0]!)!;
    let point: Point3D;
    let parentId: string | null = null;
    let anchor: Point3D = { x: 0, y: 0, z: 0 };
    if (group.distance === 0) point = anchor;
    else if (group.kind === "aggregate") {
      anchor = region.anchor;
      point = {
        x: anchor.x + (fraction(id, 1) - 0.5) * 150,
        y: anchor.y + (fraction(id, 2) - 0.5) * 120,
        z: anchor.z + (fraction(id, 3) - 0.5) * 90,
      };
    } else if (group.distance === 1) {
      const index = directIds.indexOf(id);
      const angle =
        (index / Math.max(1, directIds.length)) * Math.PI * 2 +
        (fraction(id, 1) - 0.5) * 0.65 -
        0.7;
      const radius = 150 + fraction(id, 2) * 100;
      point = {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius * (0.68 + fraction(id, 4) * 0.24),
        z: (fraction(id, 3) - 0.5) * 260,
      };
    } else {
      const directParent = branch(group.members[0]!);
      parentId = positions.has(directParent) ? directParent : null;
      anchor = positions.get(directParent) ?? {
        x: region.anchor.x * 0.55,
        y: region.anchor.y * 0.55,
        z: 0,
      };
      const angle = fraction(id, 1) * Math.PI * 2;
      const spread = 45 + fraction(id, 2) * 65 + (group.distance - 2) * 28;
      point = {
        x: anchor.x * 1.2 + Math.cos(angle) * spread,
        y: anchor.y * 1.2 + Math.sin(angle) * spread * 0.75,
        z: anchor.z + (fraction(id, 3) - 0.5) * 170,
      };
      if (Math.hypot(point.x, point.y) < 85)
        point = { ...point, x: point.x + (point.x >= 0 ? 90 : -90) };
    }
    positions.set(id, point);
    for (const member of group.members) representatives.set(member, id);
    const particles =
      group.kind === "aggregate"
        ? Array.from(
            { length: Math.min(48, 10 + group.members.length * 3) },
            (_, index) => {
              const angle = fraction(id, 20 + index) * Math.PI * 2;
              const radius =
                Math.sqrt(fraction(id, 120 + index)) *
                (24 + Math.sqrt(group.members.length) * 7);
              return {
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius * 0.55,
                z: (fraction(id, 220 + index) - 0.5) * 30,
              };
            },
          )
        : [];
    // Fit an ellipse through the approved initial position about its actual
    // center/parent. Small local offsets alone were imperceptible after projection.
    const inclination = fraction(id, 5) * Math.PI;
    const relativeX = point.x - anchor.x;
    const relativeY = point.y - anchor.y;
    const localX =
      relativeX * Math.cos(inclination) + relativeY * Math.sin(inclination);
    const localY =
      -relativeX * Math.sin(inclination) + relativeY * Math.cos(inclination);
    const axisRatio = 0.72 + fraction(id, 4) * 0.18;
    const radiusX = Math.hypot(localX, localY / axisRatio);
    const cloud = group.kind === "aggregate";
    return {
      ...point,
      id,
      kind: group.kind,
      members: group.members,
      distance: group.distance,
      label:
        group.kind === "atom"
          ? `Atom #${first.publicId}`
          : `${region.label} · ${group.members.length} people`,
      regionKey: group.region,
      tint: group.distance <= 1 ? "#efc778" : region.tint,
      particles,
      orbit: {
        anchor,
        parentId,
        radiusX: cloud ? 12 + fraction(id, 6) * 6 : radiusX,
        radiusY: cloud ? 8 + fraction(id, 4) * 4 : radiusX * axisRatio,
        inclination,
        phase: cloud
          ? fraction(id, 6) * Math.PI * 2
          : Math.atan2(localY / axisRatio, localX),
        speed:
          group.distance === 1
            ? 0.000016 + fraction(id, 7) * 0.000009
            : 0.000022 + fraction(id, 7) * 0.000012,
        depthRadius: cloud
          ? 12
          : group.distance === 1
            ? 45 + fraction(id, 8) * 25
            : 18,
        depthPhase: fraction(id, 9) * Math.PI * 2,
      },
    };
  });
  const edges = new Map<string, VisualEdge>();
  const seen = new Set<string>();
  for (const edge of graph.edges) {
    const pair = JSON.stringify([edge.source, edge.target].sort());
    if (seen.has(pair)) continue;
    seen.add(pair);
    const a = representatives.get(edge.source);
    const b = representatives.get(edge.target);
    if (!a || !b || a === b) continue;
    const [source, target] = [a, b].sort() as [string, string];
    const id = JSON.stringify([source, target]);
    edges.set(id, {
      id,
      source,
      target,
      count: (edges.get(id)?.count ?? 0) + 1,
      distance: Math.max(
        perspective.distances.get(edge.source)!,
        perspective.distances.get(edge.target)!,
      ),
    });
  }
  const knownRegionKeys = new Set(
    [...perspective.nodes.values()]
      .filter(
        (node) => perspective.distances.has(node.id) && node.metadata?.region,
      )
      .map(regionKey),
  );
  const countries = new Set(
    [...perspective.distances.keys()]
      .map((id) => perspective.nodes.get(id)!.metadata?.countryCode)
      .filter(Boolean),
  );
  return {
    ...base,
    nodes,
    edges: [...edges.values()].sort((a, b) => compare(a.id, b.id)),
    regions,
    mode,
    regionCount: knownRegionKeys.size,
    countryCount: countries.size,
    extent: 525,
  };
}
