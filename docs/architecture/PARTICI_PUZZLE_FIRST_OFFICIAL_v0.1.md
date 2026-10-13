# First official puzzle — Task 13.4

Approved release: v0.13.0-rc.6, following rc.5 (`154628d`). Publication of the reviewed
player/navigation is authorized. No migration, scheduling or participation enablement
is performed by this release.
Master Spec v0.5 remains unchanged. Its inherited Section 62 still says v0.4;
the v0.5 header and approved Section 48B identify current authority. This task does
not silently edit frozen text to correct that historical metadata inconsistency.

## Artwork and protected review

CONNECTED LANDSCAPE is the original AI-generated square artwork prepared in Task
13.3. It contains a stone bridge, river, large tree, buildings and detailed terrain.
No participant identity or third-party supplied imagery is used. The private local
original and normalized PNG remain under ignored `artifacts/`, never public assets.

The production `/admin/puzzles` upload completed at 2026-10-13 16:04:38 UTC:
READY, 27 assets and 27 PostgreSQL payloads, 2,477,981 total bytes, no Storage objects,
unscheduled. The existing preparation validates format/size/decoded dimensions,
strips metadata, normalizes to 500 × 500 and creates 25 opaque 100 × 100 tiles.
After artwork/player approval, the identical local PNG was re-prepared through Studio
at 2026-10-13 16:27:16 UTC, again READY with all 27 private assets and no schedule.
The current batch expires on 2026-10-14 16:27:16 UTC if unscheduled. The original batch
retains its earlier deadline. Re-prepare the preserved local source if scheduling
approval takes longer; do not bypass retention or repeatedly renew it automatically.

`/review/puzzle/player` is development-only and reads that ignored local artwork.
It shows the complete image, 25 tiles, hidden board, reserved piece, correct locked
and incorrect movable examples, and completed image. These are presentation fixtures,
not production gameplay. It is unavailable in production. Ordinary participants
cannot use the administrator full-image preview.

## Player and navigation

`/partici-puzzle` requires the public environment gate, verified ACTIVE ownership
and the existing database gate. The existing scrollable navigation inserts
PARTICI-PUZZLE between GLOBAL DOODLE and ABOUT only for ACTIVE owners when the public
environment gate is enabled. Controlled access alone does not expose this destination.

The player calls the existing `/api/puzzle` route. PostgreSQL remains authoritative
for reservations, deadlines, correctness, locks, allowances, revision and lifecycle.
The client refreshes after actions, on visibility return, and every 30 seconds while
visible. It never supplies solution mappings. Display countdowns derive from server
time; the server rechecks every request. Full-image bytes are requested only in the
completed/ended presentation; database authorization still independently applies.
No Storage delivery, new credential, service-worker cache or analytics event is added.
Already delivered content and an authorized in-flight response cannot be revoked.

## Schedule and unchanged operations

The proposed authoritative UTC window is 2026-10-27 04:00 through 2026-11-03 04:00
(168 hours). Hosted overlap count is zero, including the existing disposable window
ending exactly at its start. No existing windows or participant cooldowns change.
Both database gates remain OFF; two existing locked pieces remain intact. Hosted
cleanup is healthy; puzzle and Doodle Cron remain every five minutes. Vercel's Tuesday
growth schedule remains `0 16 * * 2`.

## Acceptance and activation

Local regression and PostgreSQL fixtures verify gameplay/security boundaries without
changing genuine participants or opening hosted participation. Previous accepted
hosted media and lifecycle evidence remains applicable. The player is published
behind the disabled public feature gate, not exercised with public production gameplay.

Verification: 429 existing tests plus two new rendering/navigation security tests
passed; 27 browser cases passed across 390 × 844, 768 × 1024 and 1440 × 900,
including Light/Dark, keyboard/reduced-motion and the production API-client workflow
against isolated HTTP fixtures. Native PostgreSQL concurrent reveal/place/move,
ticket redemption, lifecycle races, completion and restart idempotency passed on
an isolated final run (earlier parallel attempts hit Windows teardown/restart errors).
Formatting, lint, TypeScript, production build, privileged-client boundary and
repository/browser secret scans passed. No physical installed-PWA test was repeated.
No database migration, frozen specification, service worker or production schedule
is changed by this candidate.

Required approvals/actions, in order:

1. Artwork, local player/navigation and rc.6 publication are approved.
2. Publish the reviewed candidate with participation still OFF; verify Ready and health.
3. Obtain separate approval for the exact UTC window. Re-prepare if draft retention elapsed,
   then explicitly confirm its schedule in Studio after checking overlap again.
4. Separately approve public activation. Enable the database public gate through the
   existing controlled operator procedure and `PARTICI_PUZZLE_ENABLED=true` in Vercel;
   keep controlled access OFF and retire the diagnostic controlled environment flag.
5. Verify an ACTIVE owner reaches the waiting/scheduled state, navigation appears,
   ordinary/admin boundaries hold, media remains private, and cleanup remains healthy.
   Gameplay begins only at the database-authoritative scheduled start.

Rollback before launch: keep/restore both public gates OFF; retain scheduled assets
and existing progress. Do not reset cooldowns or delete approved media as a rollback.
