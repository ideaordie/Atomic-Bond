# PARTICI-PUZZLE — controlled hosted acceptance

Task #13.1, in progress. General participation is not approved. Frozen Master
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

Real owner-session upload/download, direct Storage denial/allow cases, gameplay,
cleanup and disabled deployment remain uncompleted until
separately recorded. Isolated database tests are not hosted Storage evidence.
The owner approved isolated PostgreSQL evidence for completion, weekly rollover
and retention deadlines. No hosted clock or cooldown manipulation is authorized.
