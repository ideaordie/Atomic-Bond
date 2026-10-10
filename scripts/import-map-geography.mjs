import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";

// Reproducible offline import. Inputs are downloaded separately; never fetch at runtime.
const revision = "ca96624a56bd078437bca8184e78163e5039ad19";
const catalog = JSON.parse(
  await readFile("src/data/locations/catalog.json", "utf8"),
);
const load = async (name) => {
  const raw = await readFile(`artifacts/${name}.json`, "utf8");
  return {
    data: JSON.parse(raw),
    sha256: createHash("sha256").update(raw).digest("hex"),
  };
};
const countries = await load("ne_50m_admin_0_countries");
const subdivisions = await load("ne_10m_admin_1_states_provinces");
const mapUnits = await load("ne_10m_admin_0_map_units");
const countryCodes = new Set(catalog.map((c) => c.code));
const subdivisionCodes = new Set(
  catalog.flatMap((c) => c.subdivisions.map((s) => s.code)),
);
const point = (x, y) =>
  Number.isFinite(x) &&
  Number.isFinite(y) &&
  Math.abs(x) <= 180 &&
  Math.abs(y) <= 90
    ? [Math.round(x * 100) / 100, Math.round(y * 100) / 100]
    : null;
const anchors = {};
const outlines = [];
// Douglas–Peucker in source degrees; antimeridian is split by the renderer.
function simplify(points, tolerance = 0.08) {
  if (points.length <= 3) return points;
  const a = points[0],
    b = points.at(-1),
    dx = b[0] - a[0],
    dy = b[1] - a[1];
  let best = tolerance * tolerance,
    index = -1;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i],
      t = Math.max(
        0,
        Math.min(
          1,
          ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1),
        ),
      );
    const d = (p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dy) ** 2;
    if (d > best) {
      best = d;
      index = i;
    }
  }
  return index < 0
    ? [a, b]
    : [
        ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
        ...simplify(points.slice(index), tolerance),
      ];
}
for (const f of countries.data.features) {
  const p = f.properties;
  const code = [p.ISO_A2, p.ISO_A2_EH].find((c) => countryCodes.has(c));
  if (code) anchors[code] = point(p.LABEL_X, p.LABEL_Y);
  const polygons =
    f.geometry.type === "Polygon"
      ? [f.geometry.coordinates]
      : f.geometry.coordinates;
  for (const polygon of polygons)
    for (const ring of polygon) {
      const reduced = simplify(ring).map(([x, y]) => point(x, y));
      if (reduced.length >= 4 && reduced.every(Boolean)) outlines.push(reduced);
    }
}
// Add small territories omitted from the generalized country layer where ISO matches exactly.
for (const f of mapUnits.data.features) {
  const p = f.properties;
  const code = [p.ISO_A2, p.ISO_A2_EH].find((c) => countryCodes.has(c));
  if (!code || anchors[code]) continue;
  const candidate = point(p.LABEL_X, p.LABEL_Y);
  if (!candidate) continue;
  anchors[code] = candidate;
  const polygons =
    f.geometry.type === "Polygon"
      ? [f.geometry.coordinates]
      : f.geometry.coordinates;
  for (const polygon of polygons)
    for (const ring of polygon) {
      const reduced = simplify(ring, 0.02).map(([x, y]) => point(x, y));
      if (reduced.length >= 4 && reduced.every(Boolean)) outlines.push(reduced);
    }
}
for (const f of subdivisions.data.features) {
  const p = f.properties,
    code = p.iso_3166_2;
  if (subdivisionCodes.has(code)) {
    const candidate = point(p.longitude, p.latitude);
    if (candidate) anchors[code] = candidate;
  }
}
const report = {
  revision,
  countrySourceSha256: countries.sha256,
  subdivisionSourceSha256: subdivisions.sha256,
  mapUnitsSourceSha256: mapUnits.sha256,
  countries: countryCodes.size,
  countryAnchors: [...countryCodes].filter((c) => anchors[c]).length,
  subdivisions: subdivisionCodes.size,
  subdivisionAnchors: [...subdivisionCodes].filter((c) => anchors[c]).length,
  countryFallback: [...subdivisionCodes].filter(
    (c) => !anchors[c] && anchors[c.slice(0, 2)],
  ),
  unlocatedCountries: [...countryCodes].filter((c) => !anchors[c]),
  unlocatedSubdivisions: [...subdivisionCodes].filter(
    (c) => !anchors[c] && !anchors[c.slice(0, 2)],
  ),
};
await mkdir("public/geography", { recursive: true });
await mkdir("src/data/geography", { recursive: true });
await writeFile(
  "public/geography/world-v1.json",
  JSON.stringify({ revision, anchors, outlines }),
);
await writeFile(
  "src/data/geography/coverage.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    countries: report.countryAnchors,
    subdivisions: report.subdivisionAnchors,
    unlocated: report.unlocatedCountries,
    bytes: JSON.stringify({ revision, anchors, outlines }).length,
  }),
);
