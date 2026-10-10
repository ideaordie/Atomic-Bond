import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  connectedComponent,
  geographicAnchor,
  geographicPoint,
  geographicLayout,
  geographicScene,
  datelineSegments,
  type Geography,
} from "../../src/living-atom/geography/layout";
import { createScene } from "../../src/living-atom/layout/scene";
import { createSpatialScene } from "../../src/living-atom/layout/spatial";
import type { GraphData } from "../../src/types/graph";
import catalog from "../../src/data/locations/catalog.json";
const data = JSON.parse(
  readFileSync("public/geography/world-v1.json", "utf8"),
) as Geography;
const graph: GraphData = {
  nodes: [
    {
      id: "1",
      publicId: "1",
      degree: 1,
      metadata: { countryCode: "US", subdivisionCode: "US-FL" },
    },
    {
      id: "2",
      publicId: "2",
      degree: 2,
      metadata: { countryCode: "US", subdivisionCode: "US-FL" },
    },
    {
      id: "3",
      publicId: "3",
      degree: 1,
      status: "DEACTIVATED",
      metadata: { countryCode: "US", subdivisionCode: "US-FL" },
    },
    { id: "4", publicId: "4", degree: 0, metadata: { countryCode: "JP" } },
  ],
  edges: [
    { id: "a", source: "1", target: "2" },
    { id: "b", source: "2", target: "3" },
  ],
};
describe("geographic presentation", () => {
  it("limits nodes and Bonds to the owner component", () => {
    const component = connectedComponent(graph, "1");
    expect(component.nodes.map((n) => n.id)).toEqual(["1", "2", "3"]);
    expect(component.edges).toEqual(graph.edges);
  });
  it("never recovers hidden geography or infers mismatched subdivisions", () => {
    expect(geographicAnchor(graph.nodes[2]!, data)).toBeNull();
    expect(
      geographicAnchor({ ...graph.nodes[0]!, status: "DELETED" }, data),
    ).toBeNull();
    expect(
      geographicAnchor(
        {
          ...graph.nodes[0]!,
          metadata: { countryCode: "JP", subdivisionCode: "US-FL" },
        },
        data,
      )?.code,
    ).toBe("JP");
    expect(
      geographicAnchor({ ...graph.nodes[0]!, metadata: {} }, data),
    ).toBeNull();
  });
  it("pins coverage with honest fallbacks for every canonical choice", () => {
    expect(catalog.filter((c) => data.anchors[c.code])).toHaveLength(248);
    expect(
      catalog
        .flatMap((c) => c.subdivisions)
        .filter((s) => data.anchors[s.code]),
    ).toHaveLength(2963);
    for (const country of catalog)
      for (const subdivision of country.subdivisions) {
        const a = geographicAnchor(
          {
            id: "t",
            publicId: "1",
            degree: 0,
            metadata: {
              countryCode: country.code,
              subdivisionCode: subdivision.code,
            },
          },
          data,
        );
        expect(a?.code ?? "unlocated").toBe(
          data.anchors[subdivision.code]
            ? subdivision.code
            : data.anchors[country.code]
              ? country.code
              : "unlocated",
        );
      }
    for (const code of [
      "US-FL",
      "CA-ON",
      "MX-JAL",
      "BR-SP",
      "PT-11",
      "DE-BY",
      "ZA-WC",
      "IN-MH",
      "JP-13",
      "AU-VIC",
    ])
      expect(data.anchors[code]).toBeDefined();
    expect(data.anchors.GB).toBeDefined();
  });
  it("consolidates shared anchors without offsets and preserves members and external Bond counts", () => {
    const component = connectedComponent(graph, "1"),
      base = createSpatialScene(
        createScene(component, "1", true),
        component,
        "people",
      );
    const scene = geographicScene(base, component, data),
      layout = geographicLayout(scene, component, data);
    expect(scene.nodes.flatMap((n) => n.members).sort()).toEqual([
      "1",
      "2",
      "3",
    ]);
    expect(scene.edges.reduce((n, e) => n + e.count, 0)).toBe(1);
    expect(component.edges).toHaveLength(2);
    expect(scene.nodes).toHaveLength(2);
    expect(scene.nodes.find((n) => n.id === "atom:1")?.members).toEqual([
      "1",
      "2",
    ]);
    expect(layout.unlocated).toBe(1);
    expect(layout.points.get("atom:1")).toMatchObject(
      geographicPoint(data.anchors["US-FL"]!),
    );
    expect(geographicLayout(scene, component, data)).toEqual(layout);
  });
  it("keeps distinct subdivisions, country fallback and hidden geography at exact anchors", () => {
    const nodes = [
      "US-FL",
      "US-CA",
      "US-MISSING",
      "JP-13",
      "DE-BY",
      "hidden",
    ].map((code, i) => ({
      id: String(i),
      publicId: String(i),
      degree: 2,
      ...(code === "hidden" ? { status: "DELETED" as const } : {}),
      metadata: {
        countryCode: code === "hidden" ? "US" : code.split("-")[0]!,
        subdivisionCode: code,
      },
    }));
    const sample = {
      nodes,
      edges: nodes
        .slice(1)
        .map((n, i) => ({ id: String(i), source: "0", target: n.id })),
    };
    const base = createSpatialScene(
      createScene(sample, "0", true),
      sample,
      "networks",
    );
    const scene = geographicScene(base, sample, data);
    const layout = geographicLayout(scene, sample, data);
    expect(scene.nodes).toHaveLength(6);
    expect(scene.edges.reduce((sum, e) => sum + e.count, 0)).toBe(5);
    for (const node of scene.nodes) {
      const anchor = geographicAnchor(
        nodes.find((n) => n.id === node.members[0])!,
        data,
      );
      if (anchor)
        expect(layout.points.get(node.id)).toMatchObject(
          geographicPoint(anchor.point),
        );
      else expect(layout.points.get(node.id)?.located).toBe(false);
    }
  });
  it("projects and splits dateline crossings without a world-spanning line", () => {
    expect(geographicPoint([0, 0])).toEqual({ x: 0, y: 0 });
    const segments = datelineSegments({ x: 440, y: 20 }, { x: -440, y: 40 });
    expect(segments).toHaveLength(2);
    for (const [a, b] of segments) expect(Math.abs(a.x - b.x)).toBeLessThan(25);
    expect(datelineSegments({ x: 0, y: 0 }, { x: 100, y: 20 })).toHaveLength(1);
  });
});
