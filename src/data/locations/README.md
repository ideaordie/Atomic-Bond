# Bundled canonical geography

Source: [amckenna41/iso3166-2](https://github.com/amckenna41/iso3166-2), MIT (see LICENSE.txt).
Pinned commit: `1d1a86a6d5ff67359c0ae7287037f66b136be9dc`.
Input: `iso3166_2/iso3166-2.json` at that commit.
SHA-256: `65b79dfc18c791ac69f29f50777aa63b3b3c0dc1b1f2556609a13af594f5f97f`.

The reviewed snapshot contains 249 countries/territories and 3,590 root
subdivisions. Entries with a parent subdivision are excluded. 49 countries or
territories have no root subdivisions and use country-only selection. Names,
codes and search aliases are retained; coordinates, flags and history are not.
Country display names were generated using Node 24 English Intl.DisplayNames;
the committed output fixes the application names independently of browser locale.
Subdivision names retain the source's Unicode spelling and aliases.

For exact-source review, download the pinned raw JSON into ignored artifacts,
then run `node scripts/import-region-catalog.mjs artifacts/iso3166-source.json`
and format the JSON with the repository formatter. Review the resulting diff.
`node scripts/generate-region-migration.mjs` reproduces the initial seed from
the committed catalog. Once applied, do not edit this migration: future dataset
updates need a new reviewed migration that preserves existing location IDs.

This snapshot is bundled, not live-updated. Administrative changes require a
reviewed catalog update. Source hierarchy determines whether a subdivision is
applicable; Atomic Bond does not reinterpret territorial classifications.
