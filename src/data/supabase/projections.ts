import type { GraphData, GraphNode } from "../../types/graph";
import type { PublicAtomProfile } from "../../types/atom";
import { normalizeXHandle } from "../../utils/x-profile";
import { COUNTRIES } from "../../services/locations/canonical-regions";

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid database response");
  return value as Record<string, unknown>;
}
export function string(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid database response");
  return value;
}
export function publicNumber(value: unknown): string {
  const n = string(value);
  if (!/^[1-9][0-9]*$/.test(n) || BigInt(n) > 9223372036854775807n)
    throw new Error("Invalid public Atom number");
  return n;
}
/** Allowlist, never object spread: RPC additions cannot accidentally widen public data. */
export function publicAtom(value: unknown): PublicAtomProfile {
  const safe = record(value);
  if (safe.status === "DELETED" || safe.status === "DEACTIVATED")
    return {
      publicId: publicNumber(safe.publicId),
      createdAt: string(safe.createdAt),
      status: safe.status,
    };
  const row = record(value),
    metadata = record(row.metadata);
  const name = row.displayName == null ? undefined : string(row.displayName);
  const x = normalizeXHandle(
    row.xHandle == null ? undefined : string(row.xHandle),
  );
  return {
    publicId: publicNumber(row.publicId),
    createdAt: string(row.createdAt),
    ...(name ? { displayName: name } : {}),
    ...(x ? { xHandle: x } : {}),
    location: {
      region: string(metadata.region),
      countryCode: string(metadata.countryCode),
      ...(typeof metadata.countryName === "string"
        ? { countryName: metadata.countryName }
        : {}),
      ...(typeof metadata.subdivisionCode === "string"
        ? { subdivisionCode: metadata.subdivisionCode }
        : {}),
    },
  };
}
export function publicGraph(value: unknown): GraphData {
  const row = record(value);
  if (!Array.isArray(row.nodes) || !Array.isArray(row.edges))
    throw new Error("Invalid graph response");
  const nodes: GraphNode[] = row.nodes.map((value) => {
    const atom = publicAtom(value),
      raw = record(value);
    if (!Number.isSafeInteger(raw.degree) || Number(raw.degree) < 0)
      throw new Error("Invalid graph degree");
    if (atom.status === "DELETED" || atom.status === "DEACTIVATED")
      return {
        id: atom.publicId,
        publicId: atom.publicId,
        degree: Number(raw.degree),
        status: atom.status,
      };
    if (!atom.location) throw new Error("Missing public region");
    // Legacy city rows keep their UUID/association; map known region names only in the public projection.
    const country = COUNTRIES.find(
      (c) => c.code === atom.location?.countryCode,
    );
    const subdivision = country?.subdivisions.find(
      (s) =>
        s.code === atom.location?.subdivisionCode ||
        s.name === atom.location?.region,
    );
    return {
      id: atom.publicId,
      publicId: atom.publicId,
      degree: Number(raw.degree),
      ...(atom.displayName ? { displayName: atom.displayName } : {}),
      ...(atom.xHandle
        ? {
            socialProfiles: {
              x: {
                handle: atom.xHandle,
                verification: { status: "unverified" as const },
              },
            },
          }
        : {}),
      metadata: {
        region: atom.location.region,
        homeRegion: [atom.location.region, atom.location.countryName]
          .filter(Boolean)
          .join(", "),
        countryCode: atom.location.countryCode,
        ...(atom.location.countryName
          ? { countryName: atom.location.countryName }
          : {}),
        ...(subdivision ? { subdivisionCode: subdivision.code } : {}),
      },
    };
  });
  const ids = new Set(nodes.map((n) => n.id));
  const edges = row.edges.map((value) => {
    const edge = record(value),
      source = publicNumber(edge.source),
      target = publicNumber(edge.target);
    if (source === target || !ids.has(source) || !ids.has(target))
      throw new Error("Invalid public Bond");
    return {
      id: `${source}:${target}`,
      source,
      target,
      createdAt: string(edge.createdAt),
    };
  });
  return { nodes, edges };
}
