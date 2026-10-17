import { COUNTRIES, regionLocationId } from "./region-lookup";
export { COUNTRIES, canonicalRegion, regionLocationId } from "./region-lookup";
export { searchRegions, type RegionChoice } from "./region-search";

const validIds = new Set(
  COUNTRIES.flatMap((c) =>
    c.subdivisions.length
      ? c.subdivisions.map((s) => regionLocationId(s.code))
      : [regionLocationId(c.code)],
  ),
);
export function isCanonicalRegionId(id: string): boolean {
  return validIds.has(id);
}
