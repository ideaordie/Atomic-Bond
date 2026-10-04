# One-time pre-beta maintenance exception

Status: completed. Production transaction committed on October 4, 2026.
Database and fresh passwordless-session acceptance passed. The owner manually
confirmed successful Pulse operation and a fresh installed-PWA launch as Atom 1.

The owner approved assigning public number 1 to the genuine account formerly
numbered 3. This is not product renumbering functionality. Normal permanent-number
rules and the frozen Master Spec remain unchanged. Historical documentation is
not rewritten.

## Operation and guards

`supabase/maintenance/atom3-to-atom1.sql` is an explicitly invoked, version-controlled
data operation, intentionally outside schema migrations: a new installation must
not attempt this production-specific reassignment. It preserves the genuine UUID,
Auth relationship, all identity/profile/preferences, Bonds, Pulse, growth records,
and administrator membership. The unused test tombstone becomes unnumbered and
loses its location association; Atom 2 and the shared location record are retained.
Ledger entries 1 and 3 remain, the sequence is never changed, and 3 is unavailable
without a redirect or historical identity disclosure.

The transaction takes the lifecycle advisory lock, an exclusive Atom-table lock,
and read locks blocking writes to all affected dependency tables. Lock acquisition
times out rather than waiting indefinitely. Source UUID, verified administrator,
ACTIVE lifecycle, five exact counterpart numbers, test destination identity and
absence of dependencies, weekly owner preference, baseline, delivery safety and
protection are checked. The sole temporarily disabled trigger is protect_atom;
it is restored before commit. Full related-row comparisons remain in transaction
memory, never output. Other Atoms, topology and sequence are compared too. Any
exception rolls the transaction back, including trigger changes.

## External gates

Confirm no Vercel growth execution is running, no delivery lease is active, and
no pending/retry source delivery exists. Avoid Tuesday 16:00 UTC. Prevent manual
scheduler invocations during the short window; do not change the Tuesday schedule.
Capture fresh non-secret before-state comparisons and the obsolete tombstone's
location UUID for compensating recovery. Verify physical backup availability.
At preparation, Supabase reported a completed October 4 backup at 12:28 UTC and
PITR disabled. A full backup restore is disaster recovery, not the normal rollback:
it could erase unrelated changes.

## Recovery

Before commit, a failure is a transaction rollback. After commit, stop and assess
any material failure. A compensating transaction must acquire the same locks and
assert the same stable account is currently number 1, the test tombstone remains
unnumbered/DELETED, number 3 has no Atom, and no conflicting delivery is running.
With only protect_atom temporarily disabled, restore the genuine number to 3,
then restore the old tombstone number 1 and its captured location UUID. Restore
the trigger and verify unchanged related data, sequence and ledger before commit.
Never restore whole tables or overwrite legitimate post-maintenance activity.
Do not execute compensation automatically or improvise a recovery after a guard fails.

## Acceptance

Compare all five Bond IDs/endpoints, UUID graph reach, profile, preferences,
identity, growth state/history, administrator membership and welcome Signal.
Verify number 2 and sequence unchanged. Fresh passwordless authentication must
resolve MY ATOM 1; public 3 must show only ATOM UNAVAILABLE. Verify owner controls,
Signal administration without republishing, growth dry-run/idempotency and fresh
PWA behavior. No actual growth email or unnecessary Bond is needed. The service
worker has no owner/graph runtime cache; stale open tabs require refresh.

Local tests run the exact SQL and changed-source, missing-admin, destination-data,
changed-Bonds and repeat-operation aborts. Ordinary renumbering must still fail.

## Execution record

The support release bc991bb deployed successfully before execution. Vercel runtime
logs showed no growth endpoint requests in the preceding 30 minutes, outside the
Tuesday schedule. No conflicting delivery was present. Fresh production guards
matched the audited state. The exact version-controlled transaction committed.

All 14 before/after comparisons passed: normalized Atom rows, Auth users, private
identities, preferences, Bonds, invitations, Pulses, growth state, deliveries,
Signal membership/content, ledger, sequence, and UUID traversal. The genuine UUID
now has number 1 and its five unchanged confirmed Bonds. The obsolete test row is
unnumbered DELETED with no location; number 2 is unchanged. Number 3 remains in
the ledger with no Atom assignment. The protection trigger is enabled. Sequence
last_value=13/is_called=true; no allocation was made to test the next value.

Public 1 returned HTTP 200 normally. Public 3 returned HTTP 200 with only the
generic unavailable page and no redirect. Refreshed owner/profile screens showed
Atom 1; Signal administration remained authorized and the welcome Signal stayed
active. The browser was then explicitly signed out for fresh-email acceptance.

Production dry run: evaluated 12, eligible 7, would-send 0, initial-baseline 6,
disabled 3, ineligible 2, already-sent 1, attempted/accepted/failed 0. The owner
appeared once under number 1 and never under number 3. No baseline was persisted
by dry run: 5 connected Atoms/2 direct Bonds/1 region/1 country and completed period
2026-09-28 remained intact. No rollback or compensating recovery was needed.

Verification: 235 automated tests, exact-operation abort/rollback checks including
interruption with the protection trigger disabled, production build/TypeScript,
lint, secret scan, and three unavailable-page browser checks at 390x844, 768x1024,
1440x900 passed. Subsequent live acceptance is recorded below.

Fresh passwordless acceptance subsequently passed: the owner completed the email
flow after sign-out and MY ATOM 1 resolved with the same UUID, one verified owner,
five unchanged Bonds, unchanged preferences/baseline, one admin membership and no
sequence allocation. Fresh-session /admin/signals access succeeded. CREATE BOND
generated a QR invitation; it was cancelled without creating a Bond, leaving zero
usable active invitations. Pulse composer and all eight choices were available;
no emotion was selected or sent by the agent. Existing emotional state was preserved.
The owner subsequently confirmed the live Pulse works and a fresh installed-PWA
launch resolves MY ATOM 1. These are owner-reported physical/live acceptance
results, not agent-operated device tests. No acceptance checks remain pending.
