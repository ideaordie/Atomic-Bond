# PARTICI-PUZZLE — local game-service checkpoint

Latest approved integration: [existing-session private tiles](PARTICI_PUZZLE_OWNER_INTEGRATION_v0.1.md).
It supersedes custom-role issuance and runtime cropping described historically below.

Current media direction: [pre-generated private tile comparison](PARTICI_PUZZLE_PREGENERATED_TILES_v0.1.md).
The dynamic source-reader implementation below is historical local candidate work
and is not approved for deployment under the revised direction.

Follow-up: [media authority audit](PARTICI_PUZZLE_MEDIA_SECURITY_v0.1.md)
records hosted read-only findings, effective privilege limits and additional
production gates. In particular, the current Storage SELECT policy allows
listing; download-only restriction is proposed, not yet applied.

Status: local implementation for review, not a production release. Baseline:
v0.12.4 (`956e353`). Frozen specifications, deployed migrations, production
configuration and Tuesday growth scheduling are unchanged. The browser review
remains an in-memory demonstration; isolated integration tests exercise the
database service independently.

## Migration preview and authority

Two version-controlled SQL candidates live outside migration discovery in
`supabase/candidates/`. Neither has been applied to hosted Supabase.

`202610140001_partici_puzzle.sql` adds eight private RLS-protected tables:
`puzzles`, `puzzle_pieces`, `puzzle_allowances`, `puzzle_reservations`,
`puzzle_receipts`, `puzzle_contributors`, `puzzle_tile_tickets`, and
`puzzle_cleanup_queue`. There are no ordinary client table grants or permissive
client RLS policies. Two authenticated-session RPCs are added:

- `puzzle_request`: read, reveal, cancel, place, move and media tickets. Each call
  resolves verified ACTIVE ownership from the existing Auth session. Client
  identity, correctness and lock assertions are not accepted.
- `puzzle_schedule`: existing Signal administrator authorization, exact 168-hour
  windows, serialized overlap rejection and 25 opaque piece records.

Private helpers are `puzzle_now`, `puzzle_lock`, `puzzle_owner`, `puzzle_expire`,
`puzzle_snapshot`, `puzzle_lifecycle_cleanup`, and `puzzle_cleanup`. Functions use
empty controlled search paths; privileged entry points are owned by postgres.
Only authenticated clients receive execution on the two owner/admin RPCs;
anonymous, growth and service-role execution is revoked. The new AFTER status
trigger on `atoms` cleans only puzzle records for the affected lifecycle change.
Installation does not rewrite existing Atoms, Bonds, Pulse, preferences, numbers
or growth data. No existing scheduler is changed.

Operations acquire the existing lifecycle lock before the puzzle advisory lock.
Deferrable position uniqueness permits atomic swaps. Correctness, completion,
revision and cooldown updates occur in the same transaction. Idempotency keys
bind owner and exact action arguments; saved results survive restart. Clients
refresh after retries because a persisted result is historical.

Allowances belong to the Atom, not a weekly puzzle. PLACE and MOVE remain
independent across rollover. Cancel adds five minutes from cancellation; expiry
adds five minutes from actual expiry even when observed later. Reservations end
no later than the puzzle window. Valid owner requests are limited to 120/minute.
Expected rejections return error envelopes so throttle accounting commits.
Production ingress protection remains a rollout gate.

## Exact image credential boundary

`202610140002_puzzle_media.sql` proposes `atomic_bond_puzzle_media`: NOLOGIN,
NOINHERIT, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS.
Grants are membership to the managed API `authenticator`; USAGE on
public/storage/private schemas; SELECT on `storage.objects` constrained by RLS
to registered retained sources in `puzzle-sources`; and EXECUTE on exactly
`puzzle_media_resolve` and `puzzle_source_available`. No application-table access,
Auth administration, uploads, deletes or bucket administration is granted.

The owner RPC issues a single-use ten-second ticket after tile authorization.
Only the media role resolves it, rechecking live Auth session, verified identity,
ACTIVE lifecycle, retained puzzle and placed/owned reservation. The source name
and private solution index go only to the server. Full-image tickets require
completion; expiry alone never discloses the unrevealed solution.

The server adapter uses fixed HTTPS Supabase endpoints, bounded downloads,
timeouts, no redirects, no caching and no sensitive logging. It accepts only a
restricted-role token with at most one hour remaining. Decoding claims is a
configuration guard; Supabase must verify the signature and expiry. No token,
signing key or environment setting was created. No broad-key fallback exists.

Supabase documents [custom Storage roles](https://supabase.com/docs/guides/storage/schema/custom-roles).
Its documented JWT issuance requires signing authority. That broad signing
authority must NOT be placed in the app. A trusted issuer outside the app would
provide and rotate short-lived restricted tokens. Exact issuance, rotation and
hosted Storage API compatibility need approval and verification before wiring.
The local Storage-schema fixture proves PostgreSQL permissions, not hosted HTTP
compatibility. No new credential was introduced.

A compromised restricted token can read retained registered source images,
including hidden pieces. It cannot administer Auth or write application tables.
Server isolation and short token lifetime remain necessary. Emergency revocation
can remove media-role membership from authenticator and revoke its grants.

One metadata-stripped 500 × 500 RGBA PNG is normalized per source, with a 2 MB
input bound. Unsupported, animated and interlaced input is rejected before
decoding. On-demand 100 × 100 crops use only database-resolved coordinates. No
per-piece files or external processor are used. Responses are private/no-store,
nosniff and no-referrer. Authorized screenshots cannot be revoked; colluding
owners may reconstruct revealed artwork. Opaque IDs do not prevent copying.

## Lifecycle and retention

Deactivation cancels reservations/tickets, adds reveal cooldown where needed,
preserves allowances and leaves collective progress intact. Deletion also removes
receipts, contributor links and allowances. Display data contains aggregate
participation only. Historical collective counts remain after identity deletion.

Content is retained through the scheduled week and scheduled end plus 30 days,
including early-completed puzzles. Metadata cleanup handles at most 25 puzzles
per call (maximum 100), deletes detailed pieces/contributor links, and queues
source removal. Expired tickets/receipts and stale allowances also have bounded
cleanup. Minimal puzzle totals/source references remain without person links.
Access deadlines are enforced even if physical cleanup is late.

The tested cleanup worker contract removes objects via Storage API, then
acknowledges them, serially in bounded batches. Failure leaves work for retry.
It never deletes Storage metadata directly in SQL. Production queue claim/ack
adapters, scoped Storage DELETE authority and scheduling remain unwired. Extend
an approved maintenance mechanism or approve a small cleanup job before rollout;
activation needs no Cron. Monitor backlog age and retry missing-object deletion
idempotently. Physical erasure is not confirmed until Storage deletion succeeds.

Backups may retain content for the configured recovery window; confirm that
window before rollout. After recovery, reconcile lifecycle and reapply retention
and queued source deletion before reopening access. Database recovery does not
restore an already deleted Storage object. Recovery copies require the same
approved retention policy.

## Verification and performance

384 unit/integration/security tests passed. Eight new database integration cases
cover reservations, retries, swaps, completion, rollover, overlap, private
serialization, role restrictions, tickets, lifecycle and retention. Native
PostgreSQL tests separately cover concurrent reveals/placements/moves,
deactivation race, atomic completion and restart-persistent idempotency.

Twelve browser cases passed at 390×844, 768×1024 and 1440×900, covering keyboard
play, Light/Dark, target sizing, reduced motion and overflow. These test the
prototype, not a production-connected client. Formatting, lint, TypeScript,
production build and repository/browser secret checks passed at this checkpoint.

Local Windows samples: completed snapshot 2,256 bytes; 40 native reads measured
86.36 ms median / 216.87 ms p95 including isolated harness overhead. Synthetic
source: 157,485 bytes; 25 crops: 160,576 bytes. Initial tile processing measured
122.61 ms median / 173.81 ms p95; a subsequent 25-tile run measured 57.37 ms
median / 65.07 ms p95, demonstrating local runtime variability. Both exclude
network latency. These are measured
samples, not hosted latency or capacity guarantees. At this size, one full tile
set for 1,000 viewers is approximately 161 MB; 100 snapshots each add 226 MB,
before retries and protocol overhead.

Production should refresh only while visible, with bounded intervals and after
mutations, initially without Realtime. Benchmark hosted CPU, memory, Storage
latency and lifecycle-lock contention before choosing polling/concurrency limits.
The candidate normalizes/decodes each source per crop; optimize only with evidence
and without weakening authorization.

## Remaining gates and recovery

1. Approve the exact proposed Section 48B; frozen v0.4 remains unchanged.
2. Approve restricted token issuance/rotation and verify hosted compatibility.
   Stop if this requires broadly privileged signing authority in the app.
3. Complete authorized upload/normalization and ready-source validation before
   scheduling. Current scheduling accepts an admin source key but does not prove
   the Storage object is ready.
4. Complete scoped physical cleanup authority, queue integration, ingress limits
   and backup/recovery verification.
5. Wire the server endpoint and owner UI afterward. Promote existing pngjs from
   development-only when the runtime endpoint is introduced; no dependency change
   was made now.
6. Preview hosted grants/schema and seek migration/controlled rollout approval.
   Start with no scheduled puzzle and test permitted and denied real HTTP access.

If rollout fails, close the puzzle entry point and revoke media access while
preserving state for diagnosis. Never reset Atom numbers or reverse unrelated
production data. This checkpoint made no hosted changes, commits or deployments.
