# PostgreSQL puzzle media — Task #13.2

Controlled candidate; public launch is not approved. Frozen Master Spec v0.4 is
unchanged. The exact proposed Section 48B remains in
`../proposals/TASK_13_0_PARTICI_PUZZLE.md`.

## Authority and delivery

`private.puzzle_media` stores immutable bounded PNG bytea, keyed to the existing
opaque asset IDs. It has RLS and no client/service/growth-role table privileges.
`puzzle_media_get` requires the existing verified ACTIVE owner and rollout gate.
It checks database time, puzzle window/retention, own live reservation or placed
piece, and completed/expired full artwork. It returns bytes, not object names,
solution coordinates or contributor identities. Original sources remain private
in the originals bucket and are never returned by this operation.

The RPC takes the existing lifecycle/puzzle transaction lock before checking and
selecting bytes. Cancellation/lifecycle changes serialize against that operation.
A request authorized first can finish after cancellation; a request serialized
after it is denied. Already downloaded bytes cannot be revoked. Expiry uses
database time without executing reservation cleanup. Request counters share the
existing 120/minute boundary, but PLACE/MOVE/reveal deadlines are not modified.

The existing Next.js route returns PNG directly with private/no-store browser and
CDN controls. There are no runtime Storage reads, redirects, signed URLs or new
credentials. The existing service worker does not cache API responses. Actual
hosted repeat/cancellation/expiry HTTP checks remain mandatory; headers alone do
not establish acceptance.

## Preparation, migration and cleanup

Preparation still validates/normalizes the source and generates 25 tiles. The
normalized original uses the existing private upload; the 25 tiles and full
display derivative use the administrator-only immutable `puzzle_media_put` RPC.
READY requires all 26 database assets plus the source object.

The initial additive migration retains all old Storage objects and policies.
Temporary copy authority is limited to existing signal administrators, READY
non-retiring tile/display assets, and BOTH rollout gates OFF. It grants no source
read, listing or unrelated bucket access. The controlled copy reads at most 26
objects per invocation, prioritizes missing records and compares SHA-256 and byte
counts. A differing existing payload is rejected; retries are safe. Temporary
copy functions/policy must be removed during the separate retirement stage.

Existing bounded retention cleanup protects active/scheduled assets. Deleting
eligible asset manifests after Storage cleanup acknowledgement cascades to media
bytes. Failed batches retain the existing 24-hour cleanup eligibility; closed
puzzles retain 30 days. Copying does not alter game or participant records.

## Recovery and rollout

On October 13, the dashboard listed daily physical backups through October 12,
12:31:24 UTC; no restore was exercised. Storage bytes are excluded. Retain the
existing immutable Storage copy until replacement acceptance and independent
media recovery verification. The disposable source is retained locally. No
whole-project rollback or deletion of unrelated activity is appropriate.

Safe compensation is to close both gates and retain additive media records for
diagnosis. Do not roll back to participant-accessible cached Storage delivery.
After verified replacement, revoke ordinary Storage access, separately retire
obsolete objects, investigate provider cache purge, and test old cached URLs.
Neither RLS revocation nor deletion alone proves global cache invalidation.

## Local verification

415 regression tests pass, including database permissions, own/foreign/expired/
cancelled requests, lifecycle/session denial, future/retention boundaries,
preparation and bounded cleanup. Native cancellation/deactivation races and 20
concurrent byte reads pass. A 12-byte synthetic payload measured approximately
93 ms median / 204 ms p95 over 30 local native RPC transactions; this includes
fixture connection overhead, is not a realistic image benchmark, and is not a
hosted latency claim. Production build, TypeScript, focused lint and secret scans
pass. The hosted results and remaining limits are recorded below.

## Hosted evidence — October 13 controlled rollout

Migration 202610150001 was applied after a clean preview and synchronized
migration history. Sixteen existing table fingerprints and the game snapshot
were unchanged by migration. Two prepared puzzles were copied through the
existing administrator session: 52 tile/display assets, 184,244 payload bytes,
all source/destination SHA-256 hashes and sizes verified. PostgreSQL media table
allocation measured 278,528 bytes. An ignored local export was decoded and
hash-verified for recovery; no original source or game record was replaced.

Hosted rollback-only authenticated RPC checks denied unrevealed/future/unknown
pieces, premature full artwork, anonymous execution and direct table access.
Twenty authorized 2,112-byte reads averaged 1.523 ms inside PostgreSQL (maximum
3.883 ms); this excludes network and application time. Browser HTTP requests for
a 2,245-byte valid reservation returned 200 in 715 and 666 ms, both CDN MISS.
The identical cancelled reservation URL returned 403 with zero image bytes.
A second continuously authenticated Atom #4 reservation returned HTTP 200 (2,529 bytes, 721 ms) before expiry and HTTP 403 (0 bytes, 774 ms) afterward. Read-only snapshots show its expired row present before and after the request, with identical pieces, puzzle records, Atom #5 and allowance deadlines. No cleanup ran during this check. A separate hosted rollback-only authenticated RPC test used Atom #5's existing session and passwordless claims to deny Atom #4's live reservation while allowing 20 placed-tile reads. This is database authorization evidence, not a separate foreign-owner browser HTTP measurement.

The provider documents a manual CDN purge API for Pro and above, requiring a
secret key (not an owner JWT), with up to 60 seconds propagation. No broad
credential was introduced or reused for purging. RLS changes alone are not a
purge. Provider documentation:
https://supabase.com/docs/guides/storage/cdn/purge-cdn-cache

## Storage retirement and remaining launch gates

Migration 202610150002 was previewed and applied after replacement verification
with both rollout gates closed. It removed the owner download and temporary
administrator copy policies, removed the copy RPC/helper, revoked the old asset
RPC, and retained a restrictive Storage boundary even in the presence of another
permissive policy. Original upload and bounded cleanup remain authorized through
their existing administrator checks. All 52 media rows and both locked pieces
were preserved. Ordinary users have no direct media-table grant.

Three known old URLs (previously expired, previously cancelled, and the current
acceptance tile cached while authorized) returned Storage HTTP 400/BYPASS with
zero bytes after retirement. Both ordinary and diagnostic fresh requests denied.
A placed tile still returned HTTP 200, 2,112 bytes, 1,392 ms through PostgreSQL.
These are sampled observations from the available session/edge, not proof that
all historical JWT/cache-key combinations are purged worldwide. No signed URLs
are generated by the replacement. Already downloaded bytes, browser copies and
requests authorized before cancellation cannot be revoked.

The old objects remain isolated for recovery, temporarily duplicating 184,244
bytes. Do not restore their participant read policies. A provider purge or an
explicit containment decision is still required before claiming comprehensive
historical cache invalidation. The documented purge API requires a privileged
secret; none was provisioned or repurposed. Future runtime tiles are stored only
in PostgreSQL, so they do not create this legacy Storage exposure.

Both database participation gates are closed after acceptance. Public application
access stays OFF. Temporary media-copy and Storage-probe server actions/UI are
removed; historical helper unit tests remain where applicable. Master Spec v0.4
is unchanged. No gameplay, lifecycle, production schedule or participant
preference change was made. Test sign-ins naturally update access timestamps;
normal reveal/cancel/expiry operations affect only the approved Atom #4 reveal
allowance. PLACE/MOVE deadlines and the two locked pieces remain unchanged.

Remaining launch requirements: explicit legacy-cache containment/purge decision,
any desired additional foreign-owner browser HTTP evidence, fresh-image hosted
preparation through the new database upload path, final specification approval,
operational cleanup readiness and separate public activation approval. Existing
isolated completion/rollover, lifecycle, retention and concurrency evidence is
preserved; those scenarios were not repeated destructively in production.
