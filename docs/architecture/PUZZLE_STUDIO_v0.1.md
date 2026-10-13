# Puzzle Studio v0.1

Task #13.3 introduces permanent administrator operations at `/admin/puzzles`, linked
from the existing Admin Hub. Public and controlled database participation remain OFF.

## Authority and privacy

The existing verified ACTIVE administrator membership authorizes the page and every
RPC independently. No new credential, role or participant capability is introduced.
`puzzle_studio(integer)` provides a bounded, paginated inventory (20 batches), weekly
windows, aggregate placed/locked counts, participation-gate status and cleanup health.
It exposes no contributor identity, reservation owner or private solution mapping.
`puzzle_studio_preview(uuid)` returns prepared full-image bytes only to administrators.
Both functions deny anonymous, ordinary, deactivated and deleted owners.

`/api/puzzle/studio` reuses the existing owner session, image preparation service and
Vercel puzzle limiter. Preview responses are private/no-store and bypass Next image
optimization. Uploads require same origin, bounded input and administrator validation
before image decoding. The PWA has no runtime media cache; analytics excludes admin
and API routes. The original participant media authorization path is unchanged.

## Operation

1. Upload original or licensed PNG/JPEG (maximum 3 MB).
2. Existing preparation validates/normalizes the image and stores source, full image
   and 25 tiles privately in PostgreSQL (27 immutable records).
3. Verify READY and review the normalized image with a 5 × 5 guide.
4. Explicitly approve the artwork, enter a UTC start and review the calculated
   168-hour end. A separate confirmation calls the existing authoritative schedule RPC.
5. PostgreSQL rejects overlap, reused batches, incomplete/retiring batches and past
   starts. Scheduling does not enable either participation gate.
6. Browse all prepared/scheduled batches using pagination; refresh current progress.
7. Cleanup requires confirmation and reuses the accepted bounded cleanup service.
   Cron remains the normal execution path. Existing schedules are unchanged.

Unscheduled batches expire after 24 hours under the existing abandonment policy.
Keep the original source locally and prepare it again if product review takes longer.
This release does not introduce indefinite draft storage or schedule official artwork.

## Specification and release

Frozen Master Spec v0.5 is v0.4 plus the exact approved Section 48B and version metadata.
An automated equality test protects all pre-existing sections. v0.4 remains unchanged.
The release candidate is v0.13.0-rc.5; public launch requires separate approval.

## Legacy Storage retirement

The captured 55-object manifest consists of three normalized synthetic source images
and 52 corresponding tile/full-image assets. SHA-256 comparisons identify only the
original numbered-grid test artwork. The three downloaded source objects match the
normalized full-image digest. No official artwork or participant image is included.

The guarded one-time `supabase/maintenance/puzzle-retire-legacy-sources.sql` preserves
three identical source payloads in PostgreSQL before physical Storage deletion. It
checks closed gates, exactly 55 mapped objects, tile replacements and source hashes.
It neither deletes Storage metadata nor changes game progress, windows or cooldowns.
The operator must use the Storage API/dashboard for physical deletion and retain the
manifest/hash audit in the private local `artifacts/task133-legacy-before.json` record.
The migration removes obsolete source-upload permission; legacy participant read and
copy permissions remain revoked. Private buckets remain private.

Object deletion and policy retirement do not establish worldwide CDN invalidation.
Historical cached test responses or content already downloaded may persist. Official
artwork is prepared directly in PostgreSQL and never enters that legacy delivery path.

## Official artwork and launch gate

Connected Landscape is original AI-generated artwork prepared with the built-in image
generation tool: a detailed square village landscape containing a stone bridge, tree,
river and buildings, with minimal blank regions and no text or identifiers. The local
private source is `artifacts/connected-landscape-original.png`; the normalized review
image is `artifacts/connected-landscape-prepared.png`. Neither belongs in public assets
or Git. Its generation prompt/provenance is retained with the local release artifacts.

The 55 artwork objects were physically deleted through the Supabase dashboard after
action-time approval. Hosted inventory now contains only two provider-created
`.emptyFolderPlaceholder` entries, no artwork. PostgreSQL progress/allowance hashes
and both locked pieces are unchanged. Ordinary-owner and anonymous Studio access
deny; administrator inventory/preview succeed with both participation gates OFF.

Validation: 428 regression tests passed, plus the exact-spec preservation test;
18 puzzle/Studio browser cases passed across the three reference viewports (Studio
in both Light/Dark). Native PostgreSQL concurrent reveal/place/move, lifecycle race,
completion and restart-persistent idempotency passed on an isolated retry after an
initial process failure. Formatting, lint, TypeScript, production build and client/
repository secret-boundary checks passed. Existing hosted gameplay evidence remains
applicable; participant gameplay is not repeated with gates closed.

Proposed window: 2026-10-27 04:00 UTC through 2026-11-03 04:00 UTC. It starts exactly
when the last disposable scheduled window ends. Artwork approval, scheduling and
public activation remain separate human decisions. No official puzzle is scheduled
by this release.
