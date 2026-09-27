import { describe, it, expect } from "vitest";
import { publicGraph } from "../../src/data/supabase/projections";
import { networkReach } from "../../src/graph/metrics/network-reach";
import { emotionalNetwork } from "../../src/graph/metrics/emotional-network";
import {
  COUNTRIES,
  canonicalRegion,
  regionLocationId,
  searchRegions,
  isCanonicalRegionId,
} from "../../src/services/locations/canonical-regions";
describe("bundled canonical geography", () => {
  it("groups legacy and canonical regions together without inventing cities", () => {
    const graph = publicGraph({
      nodes: [
        {
          publicId: "1",
          createdAt: "2026-01-01",
          degree: 1,
          metadata: {
            region: "Florida",
            countryCode: "US",
            countryName: "United States",
          },
        },
        {
          publicId: "2",
          createdAt: "2026-01-01",
          degree: 2,
          metadata: {
            region: "Florida",
            countryCode: "US",
            countryName: "United States",
            subdivisionCode: "US-FL",
          },
        },
        {
          publicId: "3",
          createdAt: "2026-01-01",
          degree: 1,
          metadata: {
            region: "",
            countryCode: "VA",
            countryName: "Vatican City",
          },
        },
      ],
      edges: [
        { source: "1", target: "2", createdAt: "2026-01-01" },
        { source: "2", target: "3", createdAt: "2026-01-01" },
      ],
    });
    expect(networkReach(graph, "1")).toMatchObject({
      cities: [],
      regions: ["US-FL"],
      countries: ["US", "VA"],
    });
    const result = emotionalNetwork(
      graph,
      "1",
      graph.nodes.map((n) => ({
        id: n.id,
        atomId: n.id,
        emotion: "curious",
        createdAt: 0,
        expiresAt: 100,
      })),
      50,
    );
    expect(result.regions.map((r) => [r.key, r.count])).toEqual([
      ["US-FL", 2],
      ["VA", 1],
    ]);
    expect(result.regions[0]?.label).toBe("Florida, United States");
  });
  it.each([
    ["US", "US-FL"],
    ["CA", "CA-ON"],
    ["MX", "MX-CMX"],
    ["BR", "BR-SP"],
    ["GB", "GB-ENG"],
    ["PT", "PT-11"],
    ["DE", "DE-BY"],
    ["ZA", "ZA-WC"],
    ["IN", "IN-MH"],
    ["JP", "JP-13"],
    ["AU", "AU-VIC"],
  ])("resolves %s / %s", (country, subdivision) => {
    const place = canonicalRegion(country, subdivision)!;
    expect(place.countryCode).toBe(country);
    expect(place.subdivisionCode).toBe(subdivision);
    expect(place.id).toBe(regionLocationId(subdivision));
    expect(isCanonicalRegionId(place.id)).toBe(true);
    expect(place).not.toHaveProperty("city");
    expect(place).not.toHaveProperty("latitude");
  });
  it("searches names, codes, aliases and Unicode without accepting free text", () => {
    expect(searchRegions(COUNTRIES, "united states")[0]?.code).toBe("US");
    const brazil = COUNTRIES.find((c) => c.code === "BR")!;
    expect(searchRegions(brazil.subdivisions, "sao paulo")[0]?.code).toBe(
      "BR-SP",
    );
    expect(canonicalRegion("US", "CA-ON")).toBeUndefined();
    expect(canonicalRegion("US")).toBeUndefined();
    expect(canonicalRegion("made up")).toBeUndefined();
    expect(isCanonicalRegionId("free text")).toBe(false);
  });
  it("supports country-only territories and unique stable identifiers", () => {
    expect(canonicalRegion("VA")?.subdivisionCode).toBeUndefined();
    expect(canonicalRegion("VA")?.countryCode).toBe("VA");
    expect(canonicalRegion("VA", "US-FL")).toBeUndefined();
    const ids = COUNTRIES.flatMap((c) =>
      c.subdivisions.length
        ? c.subdivisions.map((s) => regionLocationId(s.code))
        : [regionLocationId(c.code)],
    );
    expect(COUNTRIES).toHaveLength(249);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
