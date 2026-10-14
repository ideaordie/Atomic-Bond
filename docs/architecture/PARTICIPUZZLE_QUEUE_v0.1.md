# PARTICIPUZZLE automatic queue — Task #15.0

Status: approved for v0.15.0 publication. Section 48B is incorporated in frozen
Master Spec v0.7; v0.6 remains unchanged. See the release execution record below.

## Production inventory (read-only, October 14, 2026, 14:11:39 UTC)

| Puzzle                                                                 | Observed state                                                                                 | Progress                                     | Existing retention deadline      |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------- |
| `f2870bd6-d907-4282-9008-20d02f95f3b0` — Connected Landscape           | Completed at 11:41:13.596188 UTC; original window still ends October 20 at 17:16:50.300673 UTC | 25/25 locked; 25 PLACE, 19 MOVE; revision 72 | November 19, 17:16:50.300673 UTC |
| `1129c11d-cea4-4b90-bd0b-1ea0516fd0f3` — historical disposable fixture | Closed October 6                                                                               | Two locked pieces; revision 16               | November 5, 17:16:50.300673 UTC  |
| `cd79a42e-28e3-4ce0-b55b-3b50bfbfd611` — historical disposable fixture | Closed October 13                                                                              | Untouched                                    | November 12, 17:16:50.300673 UTC |

There is no incomplete active puzzle and no future window in the audited database.
No 14:00 UTC or 02:00 UTC additional schedule exists. The owner clarified that the
reported time may have been mistaken. Do not remove a nonexistent schedule or
infer a new order from upload timestamps.

Five READY batches each contain all 27 private PostgreSQL media assets. Three are
associated with the rows above. Unused batches:

- `6b93f7ad-f433-4e14-83b9-a537704b629c`: current abandonment deadline October 14,
  16:04:38.959813 UTC.
- `9859b633-08b2-4caa-82f7-856d0fb9474c`: deadline October 15, 00:57:24.007200 UTC.

Neither deadline was extended. Re-audit before a transition; cleanup may legitimately
remove unqueued content before approval. Keep source artwork locally for re-preparation.
Do not resurrect removed content from audit records.

Eight allowance rows exist; none has an outstanding PLACE, MOVE or reveal cooldown
at the snapshot. No reservations exist. These are observations, not authorization
to reset any allowance. Public participation is ON; controlled participation OFF.
Puzzle cleanup last succeeded at 14:10 UTC with 318 successes, zero failures. The
Doodle and puzzle five-minute Cron jobs are active. Tuesday growth configuration is
unchanged. The ignored inventory contains aggregate evidence, no owner identity or
artwork bytes. Production can continue changing after this snapshot.

## Architecture and transition

Migration: `supabase/migrations/202610190001_puzzle_queue.sql`, promoted from the reviewed candidate after explicit approval. It adds lifecycle/order/retention
fields, private RLS-protected singleton settings and a minimal private audit table.
No client table grants, new roles, credentials, media provider or external scheduler.
All existing weekly rows remain unchanged. Queue mode defaults OFF and paused.

The existing owner session, ACTIVE lifecycle check, request throttling, image
preparation, private PostgreSQL bytes and lifecycle/puzzle advisory lock are reused.
PLACE/MOVE/SWAP correctness, reservations, idempotency and rolling allowances remain
in the existing service. Its temporal predicates now distinguish legacy windows
from adopted queue rows. New receipts have bounded 30-day retention even if a puzzle
stays incomplete indefinitely.

One partial unique index prohibits two ACTIVE/COMPLETED/CELEBRATING rows. A second
protects queue positions. Queue mutations use an optimistic revision plus the same
transaction lock. Reorder requires the exact current set; removal requires an unused
QUEUED row; retirement requires ACTIVE plus a reason. Both require explicit UI
confirmation. Retirement preserves board/history, cancels reservations with the
existing reveal penalty, and never resets PLACE/MOVE deadlines. No participant can
retire, reorder, activate, preview future artwork or access audit metadata.

`private.puzzle_queue_adopt` is operator-only and never called by the migration or
normal UI. It requires an explicit current ID and ordered list of every future
window. Unexpected current/future state aborts. Future IDs/pieces are preserved;
their previous windows are recorded in private audit metadata. Adopting an already
completed puzzle uses its real completion timestamp, does not replay celebration,
and does not shorten its previously approved retention. The transition stays paused.

For this audited production inventory, propose adopting Connected Landscape as
ARCHIVED (its celebration would have ended at 12:41:13 UTC), leaving both historical
test records unchanged. No unused batch is automatically enqueued. The owner must
approve intended artwork/order from a fresh inventory before activation. If gameplay
or schedules differ at rollout, stop and reconcile the plan before mutation.

## Progression, privacy and operations

Completion is recorded atomically with the final correct placement. COMPLETED is
an audit event followed by CELEBRATING in the same transaction; clients see the
celebration and cannot continue gameplay. At completion plus one hour, archive and
activate the next READY head atomically. Repeated/concurrent transitions are safe.
An invalid head blocks advancement instead of silently skipping operator order.

Owner gameplay reads and mutations resolve advancement lazily. The existing
`private.puzzle_run_cleanup()` entry also advances; its registered five-minute Cron
schedule remains unchanged. With no requests, activation can lag the boundary by
up to five minutes, plus outages. On recovery, the same operation reconciles state;
it never backdates activity or generates missed puzzles. Pausing prevents activation
only; celebration still expires and the current ACTIVE puzzle remains playable.

Empty queue returns WAITING FOR THE NEXT PUZZLE. A later addition starts immediately
if eligible and unpaused. No synthetic production puzzle or recycling exists.
Ordinary snapshots expose the current board, clock, allowances and celebration
deadline, never queued artwork, source mappings, administration or owner metadata.
Full images require completion for queue puzzles; incomplete retirement does not
reveal them. Existing already-delivered/in-flight content limitations still apply.

Studio reuses upload/preview/cleanup services and existing administrator membership.
It shows current progress, celebration, ordered READY queue, upload pagination,
keyboard UP/DOWN reordering, pause/resume, reasoned retirement/removal and recent
operations. It refreshes while visible. There are no routine date inputs. The old
scheduling RPC rejects calls once queue mode is enabled; legacy recovery is operator
work, not a hidden participant capability. The existing preview route remains local.

## Retention and recovery

QUEUED/ACTIVE content has no age deadline. Completed content expires 30 days after
celebration ends, even if advancement was paused. Retired incomplete content retains
30 days from retirement. Removed unused queue content retains 24 hours; ordinary
abandoned uploads retain the existing 24-hour deadline. Cron and manual/legacy
cleanup paths all use the same lifecycle-aware retention boundary. Allowances are
not purged. Minimal aggregate puzzle and queue audit records remain; Auth deletion
nulls the private administrator audit identity.

Existing job health reports last success/failure and deletion counts. Advancement
errors fail closed and update cleanup health. The current Studio reports health;
the operator query in the cleanup documentation remains applicable. Cron can retry
after lock timeout, failure or restart. Active and queued bytes cannot be eligible
for cleanup merely because an old weekly end has passed.

Before rollout: verify backup readiness, take fresh non-secret fingerprints, freeze
an explicit transition plan, validate no unexpected reservations/progress/window
changes, apply the candidate through version-controlled migration discovery, verify
grants, deploy compatible code, then explicitly adopt and resume after approval.
No automatic rollback to weekly functions is safe after queue writes. Recovery is
pause/fail-closed, retain state, diagnose and apply a reviewed compensation; never
reset participant cooldowns or reverse unrelated production activity. Backups may
retain removed media and must reapply retention before reopening access.

## Local review and specification

Preview: `/review/puzzle/queue` (development only). Synthetic time/completion controls
demonstrate the actual new Studio and player components. Uploads there are explicitly
simulated sample artwork; database tests independently exercise authoritative state.
This is not hosted acceptance evidence.

The exact proposed replacement is
`docs/proposals/TASK_15_0_PUZZLE_QUEUE_SPEC.md`. Only Section 48B is proposed for change.
Frozen v0.6 and all other product requirements remain unchanged. The candidate's
retirement/removal retention and pause semantics are included for review.

## Local verification — October 14, 2026

- Formatting, lint, TypeScript and production build passed in an isolated copy
  without `.env.local`; the final celebration wording was rebuilt separately.
- 459 unit/integration/security tests passed, including eight queue database cases.
- Existing PostgreSQL concurrency checks and the dedicated queue concurrency/restart
  runner passed: simultaneous final placement/advancement, media/cleanup race and
  cross-puzzle allowance preservation.
- General browser suite: 110 passed initially; one existing desktop Pulse animation
  case timed out under concurrent browser workloads and passed its isolated rerun.
  No code or assertion was changed to obtain that result.
- Persistence: 3 passed. Authenticated browser regression: 87 passed.
- Puzzle browser regression: 72 passed, including six queue cases across Light/Dark
  and 390×844, 768×1024 and 1440×900. Screenshots were visually inspected for clipping,
  overlap and usable controls; keyboard confirmation was exercised.
- Repository and built-browser secret scan found no leaks or unintended artifacts.

Local evidence above is retained. The product owner subsequently approved v0.7,
the hosted migration, guarded empty-queue transition and v0.15.0 publication.

## Approved release execution

Supabase listed a physical backup from October 14, 2026, 12:30:59 UTC. No restore
was exercised; whole-project restoration is not a routine rollback. Current media
is in PostgreSQL. The dashboard still displayed a general service-incident banner.

Migration 202610190001 applied successfully. RLS and direct-table denial were
verified, and the adoption function is not callable by authenticated clients.
Before/after hashes matched Atoms, Bonds, private identities/preferences, puzzle
pieces/media/reservations/allowances and participation gates. The existing cleanup
job successfully ran after the schema change with queue mode still disabled.

The version-controlled `docs/operations/TASK_15_0_QUEUE_TRANSITION.sql` passed a
hosted transaction ending in ROLLBACK. After compatible deployment it adopts only
the approved completed official puzzle, preserves its November 19 retention,
checks protected records before commit, and resumes an empty queue. It does not
select unused artwork. Public participation remains ON and controlled access OFF.
Until an administrator adds approved artwork, participants see the waiting state.
Unexpected puzzle/progress/reservation changes abort this transition.

The original general browser timeout and successful isolated rerun remain disclosed
above. Release preparation also adjusts the Doodle test fixture migration filter:
puzzle migrations are loaded by the puzzle fixture only after its prerequisite
tables exist. No test assertion or production rule is weakened.
