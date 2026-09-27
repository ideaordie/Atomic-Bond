# Home Region - bundled canonical geography v0.1

Task #8.3 supersedes the earlier external-provider evaluation. Atomic Bond intentionally uses coarse canonical country/subdivision geography rather than city-level geocoding for the MVP. This supports privacy, simplicity, reliability, global consistency, no external geocoding dependency and sufficient resolution for regional network visualization.

## Registration and validation

Production registration offers all 249 bundled countries/territories. Select Country, then State / Province / Region when the country has applicable root subdivisions. The searchable comboboxes support Unicode and accent-insensitive names, codes and source aliases, keyboard navigation and mobile scrolling. Changing text clears the canonical selection; arbitrary text cannot be submitted as geography. Countries without subdivisions use country alone. City, exact address and GPS are neither requested nor required.

`canonical-regions.ts` is the shared catalog/validation boundary. The UI submits a deterministic canonical location UUID. Server actions require membership in the bundled catalog and resolve that UUID through the existing Supabase LocationService. The database remains authoritative. Pending verification links issued before this change may still resolve their existing legacy location IDs.

## Canonical data and persistence

The MIT-licensed ISO 3166-based snapshot is vendored in `src/data/locations`, with source commit, hash, import instructions and license. It supplies 3,590 root subdivisions plus 49 country-only choices (3,639 selectable locations). Only subdivisions without a parent are offered: for example, the United Kingdom offers its four constituent countries rather than collecting local councils. Native subdivision names are retained (for example Lisboa, Portugal); search aliases may include English alternatives. No location API, Geoapify integration or LOCATION_PROVIDER_API_KEY is used.

Canonical countryCode/countryName map to existing `country_code`/`country` columns. subdivisionCode/subdivisionName map to `subdivision_code`/`region`. New records use an empty legacy `city` field and null centroids. Their canonical keys are `iso3166:<code>`, with stable UUIDs derived from ASCII codes in a reserved namespace. No user identifiers participate in those UUIDs.

Migration `202609280001_coarse_regions.sql` adds the subdivision-code constraint, seeds the catalog and extends the allowlisted canonical-location/public-graph RPC outputs. Existing city rows, IDs, Atom associations, permissions and RLS remain intact. Known historical region names are mapped to canonical codes in the graph adapter without rewriting records. Unknown historical names retain their existing coarse labels. Public projections never add email, GPS or private identity.

## Network presentation

Public context and emotion results show regions/countries rather than requiring city counts. Subdivision codes group canonical regions; country-only locations aggregate at country level. Country names make labels human-readable. Legacy optional city metadata remains supported by deterministic mock fixtures and internal compatibility types; new registrations do not fabricate cities. Existing real locations and owners continue to resolve normally.

## Deployment and maintenance

Apply the version-controlled migration through the existing reviewed Supabase CLI workflow before deploying this application version. The approved hosted migration was applied and verified on the Atomic-Bond project. Without the seed migration, new canonical registration fails validation rather than silently storing unvalidated geography. No new environment variable is required.

The committed dataset is an intentional snapshot, not a live provider. Review upstream changes, license, root hierarchy and canonical-code continuity before updating it. Never rewrite an applied migration or remove location rows referenced by existing Atoms. Dataset changes need additive reviewed migrations. See the bundled data README for reproducibility.

## Verification

Coverage includes the United States, Canada, Mexico, Brazil, United Kingdom, Portugal, Germany, South Africa, India, Japan and Australia; country-only Vatican City; Unicode search; stable code/UUID uniqueness; stale/free-text selection rejection; migration seeding; legacy-place preservation; registration persistence; public privacy; responsive keyboard/browser registration; and existing authentication/Bond regression tests.

Local verification: 173 unit/graph/service/database/security tests, native PostgreSQL concurrency/restart checks, 72 visualization browser cases, 24 authentication browser cases, three public-persistence browser cases, and six final focused geography browser checks passed. Long-name screenshots were reviewed at 390 x 844, 768 x 1024 and 1440 x 900. Touch selection and absence of external geography requests were verified. Formatting, lint, TypeScript and production build passed. Real-device review remains a user acceptance step. Hosted migration 202609280001 is applied: 3,639 canonical locations across 249 countries, including 3,590 subdivisions, with no city/centroid data in the new rows. Existing Atom-location associations, legacy rows, RLS settings and network counts were preserved; anonymous canonical resolution and public-graph privacy checks passed. No verification participants or Bonds were created.
