# Bundled map geometry and representative points

Source: Natural Earth, public-domain vector data: https://www.naturalearthdata.com/about/terms-of-use/

Pinned repository revision: `ca96624a56bd078437bca8184e78163e5039ad19` in `nvkelso/natural-earth-vector`.

Inputs under its `geojson/` directory:

- `ne_50m_admin_0_countries.geojson`: simplified global outlines and country label points.
- `ne_10m_admin_0_map_units.geojson`: small territory fallback geometry/points.
- `ne_10m_admin_1_states_provinces.geojson`: subdivision representative points only; subdivision boundaries are not shipped.

Download these exact revision files into ignored `artifacts/` using the same names with `.json` extension. Run `node scripts/import-map-geography.mjs`. Input SHA-256 values and exact missing-code lists are recorded in `coverage.json`. The importer retains only geometry and code/point mappings; demographic, political and other source attributes are discarded.

Coverage: 248/249 country/territory anchors and 2,963/3,590 subdivision anchors match the existing canonical catalog. Unmatched subdivisions fall back explicitly to the country anchor. UM has no matched country point and is unlocated. No fuzzy geographic inference is used. The registration catalog is not modified. The source hierarchy does not exactly match all root subdivisions (including the UK's constituent countries); fallback is intentional, not invented precision.

Outlines are simplified in degrees using Douglas–Peucker, rounded to two decimals and bundled in `public/geography/world-v1.json` (about 465 KB uncompressed). Every rendered location is a regional representative point, never user GPS. Atoms sharing a canonical anchor use a counted marker and member inspector; no within-region residence positions are fabricated.

Made with Natural Earth. Boundaries follow the pinned source's cartographic representation; this product is not a political boundary authority. Review source/license/code continuity, coverage changes and output size before replacing the snapshot. No runtime provider requests, keys, tracking or geocoding are involved.
