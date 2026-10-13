# PARTICI-PUZZLE — controlled hosted acceptance

Task #13.1, blocked at v0.13.0-rc.2. General participation is not approved. Frozen Master
Spec v0.4 remains unchanged; the proposed addition remains in
`docs/proposals/TASK_13_0_PARTICI_PUZZLE.md`.

## Recovery and migration

On October 12, 2026 the Supabase dashboard listed seven daily physical backups,
including October 12 at 12:31:24 UTC. Point-in-time recovery is not enabled.
Database backups exclude Storage object bytes. Supabase also reported an ongoing
Edge Function incident, including investigation of affected backup jobs; the
listed latest backup predates that incident. No restore was performed or tested.
A whole-project restore could lose unrelated writes after the backup and is not
the routine compensation for this additive change.

All 17 pre-existing migration versions matched before application. The reviewed
combined `202610140001_puzzle_controlled_infrastructure.sql` applied successfully.
It combines gameplay candidate 001, owner-session Storage candidate 003 and the
approved default-OFF controlled gate 004 in one transaction. Historical candidate
002, which proposed a separate media authority, was NOT applied.

Hosted inspection confirmed 12 private RLS tables with no authenticated direct
table access, hardened guarded RPCs, two private PNG buckets (2 MB per object),
and eight scoped Storage policies including restrictive boundaries. Both public
and controlled access initially remain OFF; no test memberships or puzzles were
created by the migration. No new credential or role was introduced.

Sixteen existing-table count/fingerprint comparisons were captured in ignored
local artifacts. Fourteen matched exactly. Atom and private identity fingerprints
changed during the owner's sign-in window; recent updates align with Atom #1/#5
sign-in timestamps. Those two tables cannot be described as byte-for-byte
unchanged. The migration contains no writes to their rows. Bond, Pulse,
preferences, growth, Signal and Doodle fingerprints matched. Counts were stable.

## Controlled access

Only the operator can change `private.puzzle_access_settings` or provision
`private.puzzle_test_members`. No self-enrollment or application management RPC
exists. Membership is keyed to the existing Atom and expires at database time.
It grants neither ownership nor administrator access. All gameplay and tile reads
still require a verified ACTIVE owner. Storage independently invokes the same gate.
An expired membership denies access even with a previously obtained object name.

The approved disposable owners are Atoms #4 and #5. Atom #1 is used for existing
administrator operations only. It is not a gameplay or lifecycle test target.
The controlled application flag is `PARTICI_PUZZLE_CONTROLLED_ACCESS`; it does
not override database authorization. `PARTICI_PUZZLE_ENABLED` stays false.
The isolated acceptance surface is `/review/puzzle/hosted`, absent from ordinary
navigation and gated on the controlled flag plus existing admin/cohort authority.
The approved synthetic prototype remains separate and unchanged.

The owner approved deploying after hosted SQL authorization and local regression
checks, then completing real owner-session HTTP/Storage verification. This resolves
the ordering dependency created by HttpOnly production sessions and the initially
undeployed puzzle endpoint. It does not authorize general participation.

## Recovery procedure

Disable both database access booleans first, then disable both application flags.
This closes direct RPC/Storage reads as well as application delivery. Administrator
cleanup remains available under existing administrator authorization. Preserve
puzzle state for diagnosis; do not drop tables or restore the whole database as
an automatic response. If cleanup is needed, delete only identified puzzle objects
through Storage API, then acknowledge their bounded database manifests. Never
delete Storage metadata directly or touch unrelated buckets.

Disposable image inputs are locally reproducible and non-sensitive. Preserve the
local test image until acceptance ends because database backups cannot recover
its Storage bytes. Future production artwork needs a documented separate asset
recovery process before general launch.

## Outstanding acceptance

### Authorized tile 404 investigation

Hosted Storage logs identified `object.get_authenticated_info` as the prerequisite
operation denied before downloads. Migration `202610140002_puzzle_storage_download_info.sql`
adds that operation to the two read policies under the unchanged
`private.puzzle_asset_allowed` predicate. There are no table grants or data writes.
The attempted authenticated-path URL rewrite was ineffective and is removed.
Local regression verifies own and board tile info/download, and rejects foreign,
unrevealed, expired, inactive and source access; listing/signing remain denied.
The policy correction was applied after a clean single-migration preview.
Commit `ffd0b40` reached Vercel Ready on the production custom domain. Atom #4
revealed a 100 x 100 tile successfully and placed it incorrectly, leaving it
unlocked. After a separate real passwordless sign-in, the UI confirmed MY ATOM #5.
Atom #5 read the shared placed tile and revealed a different private tile. A fresh
request for that private tile after its natural five-minute expiry returned
`Tile unavailable`. Atom #5 moved the shared tile to its correct position and the
hosted board marked it locked. No clocks, allowances or puzzle deadlines were edited.

Atom #5 subsequently revealed and correctly placed its own tile despite having
used MOVE, verifying independent allowances in production. The board contains two
locked pieces. Anonymous media HTTP returned 403 with private/no-store headers.
A rollback-only two-owner SQL probe omitted the lifecycle AMR claims required by
previously reactivated Atom #5 and denied its positive control; it is not counted
as foreign-reservation acceptance evidence. No production mutation resulted.

The approved Atom #5 deactivation check completed through Settings. Preflight
found no retained Doodles or active Pulse. Afterwards Atom #5 was DEACTIVATED,
its reservation count was zero, and both placed/locked shared pieces remained.
The browser showed ATOM DEACTIVATED and ended the owner session. After the owner
completed fresh passwordless authentication, the UI still identified Atom #5 as
deactivated and a placed-tile HTTP request returned `Tile unavailable`. Explicit
REACTIVATE MY ATOM restored ACTIVE; reloading the identical tile request returned
the 100 x 100 artwork. Hosted checks confirmed both hourly PLACE/MOVE cooldowns
remained in force, two locked pieces remained, public access stayed OFF and both
buckets remained private. Deleted Atom #8 remained DELETED. Atom #5 is left ACTIVE.

Post-fix regression passed all 400 tests, the production build, targeted lint,
TypeScript and the repository/browser secret scan. Native PostgreSQL concurrency,
lifecycle-race, completion and restart-idempotency checks also passed. Hosted
aggregate checks confirmed both buckets private, no direct client puzzle-table
access, the object authorization predicate on both read policies, and public
database access OFF. Remaining HTTP denial/lifecycle cases are not claimed passed.

The approved cohort script subsequently enabled controlled database access for
Atoms #4/#5 with a 24-hour expiry; public access remains OFF. Vercel Production
flags were saved as `PARTICI_PUZZLE_ENABLED=false` and
`PARTICI_PUZZLE_CONTROLLED_ACCESS=true`, effective on the next deployment.

Dedicated endpoint and SDK Firewall rules were published at 120 requests per
60 seconds. A bounded verification observed 120 allowed SDK requests followed
by a limit response, and endpoint HTTP 429 responses after the allowed window.
Existing application health routes remained HTTP 200. Existing Doodle rules and
the Tuesday growth schedule were not changed.

Local verification passed 400 tests across 59 Vitest files, 111 main browser
cases, 12 puzzle browser cases, three persistence cases, and native PostgreSQL
gameplay, owner-media and database concurrency/restart checks. The authentication
suite passed 74 of 75 cases initially; the remaining sign-out test had a navigation
race. After waiting for the sign-out redirect, that test passed on all three
viewports. No authentication implementation was changed.

### Continued hosted acceptance — October 13

The controlled Storage probe uses the existing verified owner session and SDK
download without the application asset resolver, testing Storage RLS independently.
Actual hosted reads allowed a placed tile (2,112 bytes) and denied an unrevealed
tile, original source, and incomplete full image (zero bytes). After fresh sign-in,
MY ATOM #4 was verified and its read of a separate future puzzle tile was denied.

Administrator Atom #1 prepared the disposable synthetic image through the real
upload pipeline and scheduled the second puzzle for October 20. Two READY batches
contain 54 private objects totaling 251,174 bytes. The two placed pieces in the
current puzzle remain unchanged. The bounded cleanup check returned zero eligible
objects; no Storage deletion was performed. Actual age-based asset deletion has
not yet been exercised in production.

A rollback-only hosted check using Atom #4's current session claims replayed its
recorded PLACE request. Identical retry returned the recorded result, changed
arguments returned IDEMPOTENCY_CONFLICT, and the board checksum was unchanged.
The obsolete media ticket resolver is absent. This is SQL idempotency evidence,
not a claim of a successful HTTP stale-ticket redemption test.

Commit `efb5cf0` is Vercel Production Ready on the custom domain; local main and
origin/main agree. Public database access remains false, controlled access true,
and both buckets private. Regression passed 403 tests across 60 files, build,
lint, TypeScript and secret checks. Native owner-media cancellation/deactivation
race tests passed, with subsequent direct reads denied.

Live foreign-reservation and cancelled-reservation Storage reads remain pending:
Atom #4's existing hourly PLACE cooldown was preserved. Atom #5 remains ACTIVE;
its lifecycle test is not repeated. Expired-reservation application HTTP denial
was observed earlier, but independent expired-reservation Storage verification
is still outstanding. Isolated database tests are not hosted Storage evidence.
The owner approved isolated PostgreSQL evidence for completion, weekly rollover
and retention deadlines. No hosted clock or cooldown manipulation is authorized.

### Expiration probe correction

The previous probe called gameplay `read` for throttling before downloading.
That RPC also cleans expired reservations, so it cannot establish denial before
cleanup. The owner approved a probe-only deployment correction: verified session,
same-origin/controlled flag, the existing fail-closed Vercel puzzle rate limiter,
then direct SDK Storage download with no gameplay RPC. Storage itself retains
the ACTIVE owner, cohort, puzzle and reservation-deadline checks. No schema,
policy, gameplay, cooldown or feature-gate change is included.

## Final disabled checkpoint — October 13, 2026

The approved probe correction (`df6982c`) reached Vercel Ready. Actual direct SDK
Storage requests as verified ACTIVE Atom #5 denied Atom #4's live reserved tile
(zero bytes). After fresh Atom #4 sign-in, the same object was allowed (2,362 bytes).
The deadline was 00:30:08.876 Eastern. At 00:30:38 the database still contained
that reservation with `expired=true`; after another direct Storage request the
probe still reported ALLOWED, 2,362 bytes. At 00:30:57 the expired row remained.
No gameplay read or cleanup ran between the positive and expired reads.

**Security blocker:** hosted SQL under the owner's authenticated claims returned
`puzzle_asset_allowed=false` and zero visible Storage objects, while HTTP delivery
had reported success. The HTTP/database discrepancy is unresolved; caching is
not established as the cause. Do not claim expiry acceptance passed. Cancelled
reservation HTTP acceptance remains incomplete because the sequence stopped on
this failure. Existing isolated cancellation/expiry tests are supporting evidence,
not substitutes for hosted HTTP acceptance.

The operator shutdown script `supabase/maintenance/puzzle-disable-access.sql` was
applied: public and controlled database gates are both false. It touches only the
gate row under the existing lifecycle/puzzle lock. Buckets, policies, participants,
piece records and cooldown timestamps are preserved. The expired disposable
reservation remains for diagnosis; no clock adjustment or cleanup was performed.
The application public flag remains false. The controlled application flag alone
cannot override the closed database gate.

Verification reused the passing production build, TypeScript, lint and secret
checks for the probe code. Final regression: 406 tests across 61 files; native
owner-media cancellation/deactivation races passed; 12 puzzle browser cases passed
at 390×844, 768×1024 and 1440×900. The subsequent release changes are version,
documentation and the operator shutdown script only.

Before public launch: resolve and repeat actual hosted expiry/cancellation reads;
verify the bounded cleanup execution/operating procedure and separate Storage-byte
recovery arrangements; obtain exact specification approval and explicit public
activation approval. Neither this checkpoint nor its deployment authorizes launch.

## Security investigation — verified Storage CDN behavior

Controlled diagnostics were deployed in `5e2c12e`. They preserve the existing
owner-session SDK request and record only status, byte count, Date, Cache-Control,
Age and cf-cache-status; no authorization headers, URLs, tokens or bodies are
reported. A second request adds the documented `cacheNonce` solely for comparison.
No source/media credential, RLS policy or gameplay rule changed.

Actual hosted HTTP evidence, October 13 Eastern:

| State                                                         | Ordinary URL          | Fresh cacheNonce request |
| ------------------------------------------------------------- | --------------------- | ------------------------ |
| Previously expired tile, 00:42:10                             | 200, HIT, 2,362 bytes | 400, BYPASS, zero bytes  |
| New valid Atom #4 reservation, 00:43:21                       | 200, HIT, 2,070 bytes | 200, HIT, 2,070 bytes    |
| Same tile after authoritative cancellation, 00:43:59–00:44:00 | 200, HIT, 2,070 bytes | 400, BYPASS, zero bytes  |

Successful cached responses carried `Cache-Control: public, max-age=0`, despite
private buckets, upload `cacheControl: "0"` and download `cache: "no-store"`.
This identifies cached Storage CDN delivery as the mechanism serving revoked
content. No signed URL is generated or used. The earlier retained-expired-row
snapshot proves the deadline test did not depend on cleanup. Reopening the
controlled page for this diagnostic subsequently cleaned that expired row through
its ordinary read; the expired cached response survived that removal too.
Cancellation was an ordinary approved Atom #4 operation, not age-based cleanup.
Prior real foreign-owner denial remains valid evidence; this investigation did
not repeat Atom #5 sign-in or alter its state.

Supabase documents [private-bucket per-user caching and HIT headers](https://supabase.com/docs/guides/storage/cdn/fundamentals)
and [Smart CDN cache behavior/cacheNonce](https://supabase.com/docs/guides/storage/cdn/smart-cdn).
Changing the application's query string is not an enforceable correction: a
caller can reuse the already-authorized cached URL. Purge/delete is not an atomic
reservation boundary and must not destroy shared assets. No narrow hotfix is
claimed complete and no new release version is declared.

Both database gates were closed again. The two locked pieces and all piece rows,
Atom #5's row/allowances, and both PLACE/MOVE timestamps match the captured baseline.
Atom #4's reveal cooldown changed only through ordinary expiry/cancellation.
Closing gates denies fresh authorization; it must NOT be described as proof that
previously cached Storage bytes have been purged.

Next decision, before implementation:

1. Prefer a Supabase-supported configuration that disables/bypasses caching for
   every private puzzle request, including adversarial reuse of old URLs. Obtain
   provider confirmation and repeat the exact tests; no such enforceable project
   configuration was verified in this audit.
2. Otherwise approve a media-boundary change: for these small pre-generated tiles,
   private PostgreSQL byte storage with existing-session authorized RPC delivery
   avoids Storage CDN and a new privileged credential; it requires a migration,
   performance review and removal of old Storage access/caches. An isolated
   non-caching media origin is another option with additional operations overhead.

Already downloaded bytes/screenshots cannot be revoked, regardless of architecture.
The enforceable target is denial of new server retrieval after the deadline or
cancellation, not erasure from a participant's device. The current cached URL
behavior fails that target.

Targeted checks passed: eight diagnostic/probe tests; native PostgreSQL direct-read
cancellation/deactivation concurrency; TypeScript, lint, production build and
secret scan. Existing 406-test and 12-case responsive browser regression evidence
is reused for unchanged gameplay. The only runtime addition is controlled,
redacted instrumentation, disabled by the closed database gate.
