import catalog from "../../data/locations/catalog.json";

export const COUNTRIES = catalog;
export interface RegionChoice {
  code: string;
  name: string;
  aliases?: string;
}
const fold = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("en");
export function searchRegions<T extends RegionChoice>(
  choices: readonly T[],
  query: string,
): T[] {
  const text = fold(query.trim());
  return choices
    .filter((c) =>
      fold(`${c.code} ${c.name} ${c.aliases ?? ""}`).includes(text),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
}
/** Stable UUID namespace for bundled ISO codes, not a participant identifier. */
export function regionLocationId(code: string): string {
  if (!/^[A-Z]{2}(?:-[A-Z0-9]{1,3})?$/.test(code))
    throw new Error("Invalid canonical code");
  const hex = [...code]
    .map((c) => c.charCodeAt(0).toString(16))
    .join("")
    .padEnd(12, "0");
  return `ab830000-0000-4000-8000-${hex}`;
}
export function canonicalRegion(countryCode: string, subdivisionCode = "") {
  const country = COUNTRIES.find((c) => c.code === countryCode);
  if (!country) return undefined;
  const subdivision = country.subdivisions.find(
    (s) => s.code === subdivisionCode,
  );
  if (country.subdivisions.length ? !subdivision : Boolean(subdivisionCode))
    return undefined;
  return {
    id: regionLocationId(subdivision?.code ?? country.code),
    countryCode: country.code,
    countryName: country.name,
    subdivisionCode: subdivision?.code,
    subdivisionName: subdivision?.name,
    displayName: [subdivision?.name, country.name].filter(Boolean).join(", "),
  };
}
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
