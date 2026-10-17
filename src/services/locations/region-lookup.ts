import catalog from "../../data/locations/catalog.json";

export const COUNTRIES = catalog;
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
