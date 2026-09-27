// Offline import of the reviewed upstream snapshot; no runtime geocoding.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const bytes = readFileSync(process.argv[2] ?? "artifacts/iso3166-source.json");
if (
  createHash("sha256").update(bytes).digest("hex") !==
  "65b79dfc18c791ac69f29f50777aa63b3b3c0dc1b1f2556609a13af594f5f97f"
)
  throw Error("Unreviewed dataset snapshot");
const source = JSON.parse(bytes.toString("utf8"));
const names = new Intl.DisplayNames(["en"], { type: "region" });
const catalog = Object.entries(source)
  .sort(([a], [b]) => a.localeCompare(b, "en"))
  .map(([code, entries]) => ({
    code,
    name: names.of(code),
    subdivisions: Object.entries(entries)
      .filter(([, s]) => s.parentCode == null)
      .sort(([a], [b]) => a.localeCompare(b, "en"))
      .map(([code, s]) => ({
        code,
        name: s.name,
        ...(s.localOtherName ? { aliases: s.localOtherName } : {}),
      })),
  }));
writeFileSync(
  "src/data/locations/catalog.json",
  JSON.stringify(catalog, null, 2) + "\n",
);
