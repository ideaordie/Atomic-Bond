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
pass. Hosted media copy/HTTP acceptance and realistic performance are pending.
