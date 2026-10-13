# PARTICI-PUZZLE launch readiness — October 13, 2026

The initial checkpoint below is historical. See the rc.4 update at the end for
subsequent approved cleanup work.

Baseline: v0.13.0-rc.3, `d838af8`. Public launch is **not yet ready**.
Both hosted database participation gates remain OFF. No official puzzle was
scheduled, no specification was finalized, and no deployment was performed.

## Fresh hosted administrator acceptance

The existing Atom #1 administrator session successfully uploaded disposable
artwork through the production preparation UI. The new unscheduled batch is
READY: 27 asset manifests, 25 tiles and one display image in PostgreSQL,
92,122 media bytes, one private original in Storage, and zero new Storage tiles.
All 26 database images were independently decoded: PNG, 100 × 100 tiles,
500 × 500 display image, and no EXIF, XMP or orientation metadata.
Malformed/oversized input rejection remains covered by the passing local tests;
this session did not repeat malformed uploads against production.

The hosted cleanup control returned zero eligible objects and deleted nothing.
Fresh unscheduled batches are eligible after 24 hours; scheduled puzzle assets
remain protected through their window and 30-day retention. No clocks, ages,
participant cooldowns or puzzle states were changed to accelerate acceptance.

Before/after fingerprints matched for all 16 protected application tables.
Puzzle records, piece records, both locked pieces, Atom #5 and the #4/#5
allowance deadlines also matched. Administrator sign-in occurred before these
comparison snapshots.

## Security and regression evidence

- Seven targeted test files / 31 tests passed: gameplay, database media,
  controlled access, owner tiles, preparation, media adapter and cleanup.
- Native PostgreSQL media cancellation/deactivation races passed, including
  concurrent reads and subsequent denial.
- Native gameplay concurrency, atomic completion and restart-persistent
  idempotency passed on a standalone rerun. The initial run terminated with an
  unlabelled Node exception after its read benchmark; that run is not counted
  as passing.
- Production build passed; repository/browser secret scan reported no leaks or
  unintended artifacts. Landing and ABOUT returned 200; anonymous media returned
  403 with private/no-store response policy.
- Earlier accepted expiry-before-cleanup, cancellation, foreign-owner database
  authorization, rollover, throttle and lifecycle evidence remains applicable.
  Participation gates were not opened to repeat gameplay in this session.

## Legacy Storage boundary

Runtime media comes from PostgreSQL and does not depend on old Storage tile
objects. Old asset RPC access, owner download and administrator-copy policies
remain retired; the restrictive Storage boundary remains installed. Legacy
objects remain isolated for recovery and their manifests support eventual
cleanup. They were not deleted in this session.

Previous sampled old URLs denied access, but this is not worldwide CDN cache
invalidation evidence. Historical edge/browser copies and already downloaded
content cannot be claimed revoked. Do not restore the retired read policies.
An explicit legacy-cache containment or provider-purge decision remains pending.

## Remaining launch requirements

1. Complete the cleanup execution path and its operational cadence. The deployed
   CHECK BOUNDED CLEANUP action only plans work; the generic worker contract is
   not connected to an owner-session Storage deletion/acknowledgment executor.
   Full hosted deletion acceptance has therefore **not passed**. Use naturally
   eligible disposable assets; preserve active/future puzzles. No new privileged
   credential or unrelated Cron change is authorized by this report.
2. Resolve the historical CDN containment decision above.
3. Obtain explicit approval of the exact future specification amendment; frozen
   Master Spec v0.4 remains unchanged.
4. After accepting the test workflow, select and prepare official artwork and its
   weekly window, then obtain separate public activation approval.

No release version bump or launch-ready declaration is warranted yet. This
report is available for review without a commit.

## rc.4 cleanup update

The owner approved private PostgreSQL source storage and publication of the
disabled cleanup release. Migration 202610150003 is applied. The existing
Supabase pg_cron service now runs a separate puzzle job every five minutes;
the existing Doodle command/schedule is preserved and vercel.json is unchanged.

Actual scheduled runs at 07:45 and 07:50 Eastern succeeded. The second removed
an expired disposable receipt, two old fixture media rows/manifests/batches and
25 expired fixture pieces; a future fixture retained its media and 25 locked
pieces. These are synthetic fixtures, not genuine gameplay progress. Both
participation gates stayed OFF. Final reservation, legacy API and deployment
acceptance follow below when complete.

All 422 regression tests passed, plus native cleanup/media concurrency, lint,
TypeScript, production build, secret scan and privileged-client boundary checks.
The source pipeline now writes all 27 assets to private PostgreSQL. Legacy
Storage API removal is bounded to one eligible batch and acknowledges only
successful deletion; failed attempts can retry. See the cleanup operations
reference for bounds, monitoring, retention, recovery and old Storage handling.

The remaining launch decisions are historical CDN containment, approval of the
exact proposed Section 48B, official artwork/window selection and separate
public activation approval. Frozen v0.4 is unchanged.

At 07:55 Eastern, a further real Cron run removed the expired reservation
fixture and the newly prepared legacy cleanup fixture's 26 PostgreSQL assets,
while preserving a valid reservation and future media. Test-only setup gave that
new unscheduled disposable upload a 25-hour age; existing batches and the database
clock were not changed. The Storage source/manifests were correctly retained for
API retirement. Synthetic puzzle fixtures were then removed under exact-ID,
window and zero-gameplay guards. All 16 protected table fingerprints, genuine
puzzle/piece fingerprints, #4/#5 cooldowns and Atom #5 matched the before snapshot.
Doodle's Cron configuration hash was identical and Tuesday growth configuration
was unchanged. Ordinary users cannot execute cleanup or read its health table.
