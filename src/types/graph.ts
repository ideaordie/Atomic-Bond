import type { PublicSocialProfiles } from "./public-profile";

/** Public, renderer-independent graph data. Never attach private identity data. */
export interface GraphNode {
  readonly id: string;
  readonly publicId: string;
  /** Number of incident edges, not distance from a selected Atom. */
  readonly degree: number;
  readonly displayName?: string;
  readonly socialProfiles?: PublicSocialProfiles;
  readonly metadata?: {
    readonly city?: string;
    readonly locationId?: string;
    readonly homeRegion?: string;
    readonly region?: string;
    readonly countryCode?: string;
    readonly clusterId?: string;
    readonly synthetic?: boolean;
  };
}

/** An undirected, confirmed connection in a public graph projection. */
export interface GraphEdge {
  readonly id: string;
  readonly source: GraphNode["id"];
  readonly target: GraphNode["id"];
  readonly createdAt?: string;
  readonly metadata?: { readonly synthetic?: boolean };
}

export interface GraphData {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

/** Derived public reach; city coverage may be partial. Includes the selected Atom. */
export interface NetworkReach {
  readonly direct: number;
  readonly people: number;
  readonly cities: readonly string[];
  readonly regions: readonly string[];
  readonly countries: readonly string[];
}
