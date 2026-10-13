# PARTICI-PUZZLE public launch — Task #13.6

The product owner approved public activation and the additional launch boundary.
Release v0.13.0 preserves frozen Master Spec v0.5 and all gameplay mechanics.

## Authoritative launch boundary

Migration `202610170001_puzzle_launch_boundary.sql` adds one private, RLS-protected
singleton setting. It references the first official puzzle; a missing anchor fails
closed. No client or service-role table grant is added. Operator provisioning set
the anchor to `f2870bd6-d907-4282-9008-20d02f95f3b0` after checking both gates OFF,
the exact approved window, READY batch `7c36c311-2a91-465e-8923-10e7efccc903` and
all 27 media records. No existing puzzle, piece, reservation or cooldown was changed.

Public gameplay and media RPCs independently require the existing verified ACTIVE
owner and participation gate. Puzzles starting before the anchor are excluded,
including explicit ID requests. The verified private gameplay/media implementations
retain lifecycle locking, rate limiting, reservation checks and retention rules.
The delegated media helper has no participant EXECUTE grant.

Before the official start, the ordinary read returns only WAITING, server time,
next start and a first-community indicator. The browser interpolates elapsed time
from that server clock and refreshes visibly every 30 seconds; countdown zero never
authorizes gameplay. The database admits the official puzzle at the exact start.

## Activation and recovery

- Official window: October 27, 2026, 04:00 UTC–November 3, 2026, 04:00 UTC.
- Database: public participation ON, controlled participation OFF.
- Vercel Production: `PARTICI_PUZZLE_ENABLED=true`,
  `PARTICI_PUZZLE_CONTROLLED_ACCESS=false`.
- Public player: `/partici-puzzle`; administrator preparation: `/admin/puzzles`.
- Emergency rollback: close the public database gate and application flag; retain
  the launch anchor, scheduled assets, progress and cooldowns. Do not remove security
  migration wrappers or reactivate historical test windows.

## Verification and limits

434 tests and 30 browser cases passed, including all three reference viewports,
Light/Dark, keyboard/reduced-motion, countdown, no early images and existing player
operations. Isolated PostgreSQL proved automatic exact-start eligibility and native
gameplay concurrency/restart protections. Hosted checks used approved Atoms #4/#5
with their existing verified-session claims in a transaction rolled back afterward;
no participant lifecycle or gameplay was changed. Both denied historical/future
gameplay and artwork and received the correct October 27 waiting response.

No production clock was advanced. Real gameplay at the future start cannot be
observed before that time; the database boundary is exercised with isolated clocks.
Physical installed-PWA acceptance was not repeated. Historical disposable Storage
CDN cache limitations remain as previously documented; official artwork uses only
authorized PostgreSQL delivery. No new credential, external service or Cron job.
