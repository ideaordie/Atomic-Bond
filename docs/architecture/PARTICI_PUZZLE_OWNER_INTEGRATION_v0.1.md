# PARTICI-PUZZLE — approved owner-session media integration

This records the local checkpoint. Current hosted status and the subsequent 3 MB
upload limit are documented in [controlled hosted acceptance](PARTICI_PUZZLE_HOSTED_ACCEPTANCE_v0.1.md).

Local checkpoint, October 12, 2026. The approved architecture is pre-generated
private tiles with existing owner-session authorization. Equivalent authorized
direct Storage reads are intentionally permitted. No new media role, token issuer,
service credential, external image service or runtime cropping is used by this
integration. Frozen Master Spec v0.4 and production configuration remain unchanged.

## Integrated implementation

`prepare.ts` accepts bounded JPEG/PNG buffers (5 MB encoded, 16 million decoded
pixels, maximum dimension 8000), rejects unsupported/animated/malformed input,
normalizes orientation, center-crops/resizes to 500 × 500, converts to sRGB,
strips metadata and generates 25 optimized 100 × 100 PNG tiles using Sharp 0.35.5.
Processing occurs only during administrator preparation. The original upload is
not saved; one normalized private master is retained. A separate full-image
display derivative is prepared for completion/expiry. Total: 27 private objects.
Vercel's actual request-body limit must be reconciled with the encoded input limit
before enabling the upload endpoint; this is a rollout check, not a promise that
every locally accepted upload size works on the hosted plan.

`owner-upload.ts` obtains an administrator-only database manifest before decoding,
uploads through the existing session with immutable opaque names and cache age
zero, then asks the database to mark the batch READY. It does not return private
solution positions to the participant UI. Failed/partial preparation stays
unpublished. Only administrators may upload; this assumes trusted administrators,
not adversarial administrators attempting to bypass the server normalization path.

`owner-media.ts` uses the existing verified owner session to resolve a permitted
asset and download from `puzzle-tiles`. Storage rechecks permission independently.
The runtime never requests the master bucket. No image processor is called on
tile reads. App responses are private/no-store, no-referrer and nosniff; Storage
fetch uses no-store and a five-second timeout. No signed URLs are generated.

`http.ts` connects the gameplay RPCs and media pipeline. `/api/puzzle` supports
bounded same-origin POST gameplay requests and administrator binary upload,
plus GET of an opaque puzzle/piece. Unknown query/body fields and client identity
assertions are rejected. The endpoint is disabled unless the server-only
`PARTICI_PUZZLE_ENABLED` flag is true; `.env.example` leaves it blank (disabled).
Nothing was enabled in the local secret file or Vercel. Administrator scheduling
and cleanup have session RPCs; a production administrator screen is not added at
this checkpoint. Existing review UI remains the approved synthetic prototype.

Gameplay still runs the unchanged database transition body: five-minute reservations,
cancel/expiry reveal cooldown, independent rolling PLACE/MOVE allowances across
weeks, swaps, correct locks, revision checks and idempotency. The new public wrapper
admits only read/reveal/cancel/place/move. Superseded source-ticket operations are
not reachable through it. The new asset resolver supports full artwork after
completion OR scheduled expiry, following the latest explicit product decision.

## Version-controlled migration preview

Apply only these candidates after future approval, in order:

1. `supabase/candidates/202610140001_partici_puzzle.sql`: private game tables,
   lifecycle trigger and gameplay functions, previously reviewed locally.
2. `supabase/candidates/202610140003_puzzle_owner_tiles.sql`: owner-session media.

**Do not apply `202610140002_puzzle_media.sql`.** It is historical local audit
material for the rejected custom-role architecture, retained only for comparison
tests. It is not part of the rollout manifest. Neither candidate has been placed
in automated hosted migration discovery or applied to Supabase.

003 adds private RLS-protected `puzzle_batches` and `puzzle_assets`; creates two
private PNG-only, 2 MB/object buckets (`puzzle-originals`, `puzzle-tiles`); and adds:

- `puzzle_prepare`: independently rechecks existing ACTIVE Signal administrator
  membership; at most three new batches/admin/hour, 27 opaque entries and readiness
  checks against uploaded Storage metadata.
- `puzzle_asset`: verified ACTIVE owner, request throttle and per-piece asset
  resolution, exposing only an authorized opaque name.
- Updated `puzzle_schedule`: requires a READY, non-retiring batch, current database
  time and non-overlapping 168-hour window; creates the same 25 opaque game pieces.
- `puzzle_cleanup_batch`: administrator-only bounded manifest/ack for one batch,
  after scheduled end plus 30 days or 24 hours for an unscheduled preparation.
- Private helpers `puzzle_upload_allowed`, `puzzle_asset_allowed`,
  `puzzle_asset_retired`, plus relocation of the unchanged game body into private
  `puzzle_game_request` with direct client execution revoked.

Security definers have explicit postgres ownership and empty search paths. The
authenticated role receives execution on the guarded APIs/policy helpers and
Storage SELECT/INSERT/DELETE, always constrained by RLS; UPDATE is not granted.
It gets no direct private game/identity table privileges. No anon permissions,
role membership, credential, Auth-management or BYPASSRLS capability is added.

Permissive policies allow only authorized download, administrator staging upload
and administrator expired-object cleanup. Four restrictive SELECT/INSERT/UPDATE/
DELETE policies prevent other permissive policies from widening these two
buckets. Other buckets receive no new allowing policy. Verify all existing hosted
Storage policies/default grants before applying, since effective grants matter.
No Atom, Bond, Pulse, number, growth record or existing lifecycle function is
rewritten by 003. The additive lifecycle trigger in 001 cleans only puzzle state.

## Direct Storage authorization

Each authenticated download invokes current verified-session/ACTIVE ownership
checks and database-time rules. RLS allows only a currently owned reservation or
placed board tile. No blanket active-puzzle access is granted. Future tiles,
foreign reservations and hidden pieces remain denied even with known filenames.
The full-image derivative becomes readable after completion or expiry, and all
delivery ends at scheduled end plus 30 days. The master has no participant read
policy, including for administrators using ordinary download operations.

List, info, signing and image transformations are excluded by operation-specific
policies. Solution mappings and participant identities remain private. RLS applies
whether bytes are requested through Next.js or directly with the owner's session.
Repeated authorized reads are allowed; an opaque filename is not a capability.
Old names cease to authorize after reservation expiry, session revocation or
lifecycle changes. No new bearer ticket or reusable signed URL is introduced.

The gameplay RPC throttle is not a Storage-download throttle. A direct authorized
reader can repeat downloads without going through the application. Provider
request/egress monitoring and suitable ingress protections are production gates;
do not claim the API's 120/minute counter also meters direct Storage requests.
Already delivered pixels cannot be revoked. A read that precedes cancellation in
the database serialization order may finish in flight; subsequent reads deny.

## Caching and cleanup

The existing service worker caches only its explicit public offline asset list;
it does not cache puzzle routes or images. No analytics event or image logging is
introduced. Direct private Storage responses must be tested for actual CDN/cache
headers with two owners before enablement. Upload cacheControl zero and app
no-store are not substitutes for hosted verification of the direct route.

Cleanup marks one expired/orphan batch retiring under the lifecycle-compatible
lock, preventing new scheduling while Storage deletions are in flight. A manifest
contains at most 27 names. An authenticated administrator removes these through
Storage API, then acknowledges. The database refuses acknowledgment while any
object remains; partial failure is retryable. SQL never deletes Storage metadata
in production. Tests simulate the API's authorized metadata removal locally.
Aggregate puzzle records remain after details/content are removed. Active and
future scheduled content cannot qualify for cleanup.

An unattended Storage-cleanup executor is not configured. The existing admin
session provides a safe manual execution boundary without a new credential;
approve its operational cadence or an existing trusted automation mechanism
before production retention acceptance. Backups can retain older content until
their own recovery window ends; reconcile cleanup and lifecycle after restore.
Never restore public access before validating retention and Storage permissions.

## Verification

The final unit/integration/security run passed 397 of 398 tests; its deployment
placeholder allowlist check identified the newly added feature flag. The flag
was changed to the required blank form and the allowlist updated; both deployment
security tests then passed on targeted rerun. The final focused preparation/owner
suite passed nine tests. Native PostgreSQL verified tile reads racing with cancellation
and deactivation: subsequent reads deny. Existing concurrency/restart tests retain
the gameplay invariants. Formatting, lint, TypeScript and production build are
checked separately at this checkpoint.

Coverage includes authorized direct read, known hidden tile, foreign reservation,
expired reservation, invalid/revoked session, deactivated/deleted owner, future
content, master source denial, private mapping/identity denial, repeated reads,
operation restrictions, broad permissive-policy resistance, completion/expiry/
retention, admin-only upload, immutable READY batches, full 27-object preparation,
bounded cleanup, same-origin HTTP writes and no-store tile delivery.

Twelve existing browser cases passed at 390×844, 768×1024 and 1440×900, including
keyboard, Light/Dark, target sizes, reduced motion and overflow. These exercise
the preserved prototype. The new media service is exercised through integrated
HTTP handlers and isolated PostgreSQL/Storage-policy fixtures, not a hosted or
connected-browser Storage deployment. Hosted response latency and mobile network
performance remain unmeasured.

Sharp benchmark: ten runs of a 700 × 600 JPEG with orientation metadata measured
210.71 ms median / 215.04 ms maximum for normalization and all 25 tiles. Tiles
totaled 685,085 bytes (median reveal 27,335 bytes); normalized master/display were
588,191 bytes each; total storage was 1,861,467 bytes. A full cold board needs
~685 KB image bytes plus the ~2.3 KB snapshot and protocol overhead. These are
synthetic artwork-specific measurements, not universal sizes or hosted latency.
Prepared delivery still performs no decoding/cropping at runtime. Earlier simple
gradient PNG results are retained in the comparison document for context.

## Rollout sequence and remaining approvals

1. Review the two-file migration manifest and confirm obsolete 002 is excluded.
   Approve future spec wording separately; frozen v0.4 remains untouched.
2. Confirm current backups, Storage helper operations/grants and recovery plan.
   Snapshot non-secret schema/data invariants. Keep feature flag false.
3. Only after explicit approval, apply candidates and create the private buckets.
   Verify no genuine account/network state changed and no custom media role exists.
4. Upload synthetic artwork with an approved administrator; test real Storage
   HTTP with two controlled ACTIVE owners plus revoked/inactive sessions. Check
   authorized direct reads, all denied cases, cache isolation, upload/cleanup
   operations and object immutability. Measure actual bandwidth and latency.
5. Establish bounded cleanup operations and ingress/egress monitoring; reconcile
   the hosted request-body limit. Test recovery from partial upload and deletion.
6. Connect the production UI behind the flag and run controlled browser/PWA/mobile
   acceptance. Enable only after actual hosted Storage verification passes.

Recovery: disable the route flag, revoke the puzzle allowing policies if necessary,
and preserve state for diagnosis. The flag alone does not disable independently
authorized direct Storage reads. Do not revoke unrelated global Auth permissions
or delete unrelated data. No hosted Storage creation, migration, credentials,
commit, deployment or specification finalization occurred at this checkpoint.
