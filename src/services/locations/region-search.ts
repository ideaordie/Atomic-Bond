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
