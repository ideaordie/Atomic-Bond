# PARTICI-PUZZLE bounded cleanup

## Authority and schedule

`202610150003_puzzle_scheduled_cleanup.sql` reuses installed Supabase `pg_cron`
with a separate `atomic-bond-puzzle-cleanup` job, every five minutes. It calls
`private.puzzle_run_cleanup()` as the database operator. No external scheduler,
HTTP invocation, new role, secret, or participant execution privilege is added.
Global Doodle's existing job and Vercel's Tuesday 16:00 UTC growth schedule are
unchanged. Puzzle participation gates are unrelated to cleanup and remain OFF.

## Bounded transaction

Every run takes the existing lifecycle/puzzle lock and uses database time.
At most 500 expired reservations, 500 receipts, 500 obsolete tickets and 25 media
batches are selected per run. Reservation expiration applies the existing
five-minute reveal penalty; PLACE/MOVE deadlines are not changed. Valid
reservations are excluded. Allowances are not purged or reset.

Unscheduled abandoned/failed batches become eligible after 24 hours. Scheduled
puzzle content is protected until 30 days after its scheduled end, even if
completed early. Active and future puzzles are excluded. Only beyond retention
are detailed pieces/contributor records removed; the aggregate puzzle record
remains. Foreign keys prevent orphan media bytes; unreferenced batches use the
same 24-hour rule. No arbitrary orphan/Storage metadata deletion is attempted.

The operation is transactional and retryable. A failed step rolls back its
cleanup changes. The wrapper records only SQLSTATE, not error text or participant
identifiers, and the next five-minute invocation retries. Lock contention times
out after two seconds. A process crash or statement cancellation can prevent the
health update, so monitor both health age and Cron run status. Never interpret a
Cron `succeeded` row alone as proof that the inner cleanup succeeded.

## Source storage and legacy objects

New preparation uploads 25 tiles, one display image and the normalized source
into the existing private PostgreSQL media table. Source assets remain excluded
from participant reads. No image bytes are written to new Storage objects.
The previous Storage-source READY check remains compatible during rollout; old
READY batches are not rewritten. Participant source access remains denied.

If an eligible legacy batch still has Storage objects, Cron deletes eligible
PostgreSQL bytes but retains its manifests and queues Storage retirement. It never
deletes Storage metadata using SQL. An ACTIVE administrator can run bounded
cleanup from the controlled page: one plan, at most 27 validated object names,
Storage API removal using the existing owner session/RLS, then database
acknowledgment. Partial failure keeps the manifest; retries are safe. The database
refuses acknowledgment while any matching Storage object remains. Monitor queued
legacy batches until this finite legacy backlog is retired. No new source uploads
should add to that backlog after deployment.

Legacy tile copies are no longer runtime dependencies. Their eventual Storage
retirement does not prove worldwide historical CDN purge or erase downloaded
copies. Old participant read policies remain retired. Keep the historical cache
containment limitation explicit; do not claim retroactive revocation.

## Monitoring and recovery

Run `supabase/maintenance/puzzle-cleanup-status.sql` through an operator connection.
It reports last attempt/success/failure, SQLSTATE, removed counts, total successful
and failed runs, 15-minute freshness and queued legacy batches; no identity is
returned. Check the job is active as well as the health row. Investigate FAILED,
STALE, NEVER_SUCCEEDED or an accumulating legacy queue.

To halt faulty cleanup, unschedule only `atomic-bond-puzzle-cleanup`; leave Doodle
and growth jobs alone. Do not disable gameplay security, reset cooldowns or restore
old Storage read policies. Cleanup commits intentionally remove expired content;
rollback of code cannot resurrect it. Recovery requires the verified pre-change
export/provider backup and a reviewed scoped restoration, never a broad restore
over unrelated production activity. Reapply retention before serving recovered
content. Backup copies may outlive live-record deletion.

## Verification

Local tests cover time boundaries, fresh/future preservation, valid reservations,
existing reveal penalty, bounded batches, retained Storage manifests, failure
rollback/retry, idempotency and denied participant execution. Native PostgreSQL
checks race cleanup with authorized tile reads while preserving a locked piece.
Hosted acceptance uses newly created disposable expired/future fixtures, never
backdates existing participant content or changes the database clock. Run results
and production-integrity comparison are recorded in the launch-readiness report.
