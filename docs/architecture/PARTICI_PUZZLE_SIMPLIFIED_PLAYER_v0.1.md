# PARTICI-PUZZLE simplified player — Task #13.7

Local product-review checkpoint; production remains v0.13.1 (`bd28a89`). Initial
working tree was clean and main matched origin/main. Hosted read-only verification
confirmed public participation ON and controlled participation OFF. No production
write, gameplay action, configuration change or migration is part of this task.

## Interaction

The player automatically uses the existing reveal operation when an ACTIVE puzzle
has unplaced pieces and the current server-returned PLACE/reveal deadlines permit.
A valid reservation is displayed directly and reused on reload. Displaying a piece
does not spend PLACE. Automatic attempts are serialized and bounded to at most one
per minute; server reservation uniqueness, five-minute lifetime and reveal cooldown
remain authoritative, including across tabs. An unavailable piece is retried later,
not in a render loop. Hidden tabs do not reserve automatically.

An empty square previews the held piece; PLACE HERE confirms once. Selecting an
unlocked board piece directly starts movement even while holding a reservation.
A destination previews the move or both sides of a swap; MOVE HERE confirms once.
Locked squares announce their status without initiating an action. CANCEL selection
clears only the proposed action, retaining the existing reservation until its normal
expiry; it does not cancel/reveal repeatedly. Independent allowances and correct
locking remain server decisions.

REVEAL MY PIECE, PLACE/MOVE mode buttons, REFRESH BOARD and the older confirmation
buttons are removed from the production player. Error-only retry controls remain.
Native button keyboard navigation, focus, square/preview labels, status messages,
monochrome themes and reduced-motion behavior are preserved.

## Refresh and recovery

Visible pages read every approximately 60 seconds. Hidden pages pause; visibility
restoration performs an overdue read. Errors back off from 60 to 120 seconds up to
five minutes. Requests are serialized. Authentication/authorization HTTP denial
clears private player state and stops polling; unmount stops timers. A sign-out in
another tab is detected by the next authorized read, never bypassing server checks.

Fresh reads follow actions. Older revisions of the same puzzle cannot replace a
newer board. Unaffected previews survive refresh; changed source/destination squares,
changed reservation or puzzle invalidate the selection with a concise explanation.
A transport-uncertain write retains its exact request UUID/payload for RETRY ACTION;
a fresh read, rather than a potentially old receipt, supplies the visible snapshot.

## Security and specification

No server handler, media adapter, database function, RLS grant, throttle, scheduler,
allowance or reservation rule changes. PostgreSQL still validates ownership,
lifecycle, time, revision and idempotency. Private media still uses the existing
owner-session PostgreSQL path. The Section 48B operation names retain their gameplay
meaning; only their player-facing controls change under this explicit UX approval.
Frozen Master Spec v0.5 is untouched.

## Review and verification

`/review/puzzle/player` is development-only and now provides an interactive disposable
presentation fixture using the same player. Hidden board automatically reserves;
Placements demonstrates selecting/moving/swapping, and Completed shows the final
state. LIGHT/DARK controls are local review controls. Production routes retain real
session authorization; the review transport is not an authoritative game service.

76 existing puzzle unit/integration/security tests and native PostgreSQL concurrent
reveal/place/move, lifecycle race, completion and restart idempotency pass. The
48-case puzzle browser suite passes at 390×844, 768×1024 and 1440×900, including
Light/Dark, reduced motion, keyboard, automatic reservation reuse, placement/move
previews, expiry, stale state, polling/backoff and same-request retry. A supplemental
cooldown/older-snapshot browser check is also run. Production build passes; final
formatting, lint, TypeScript and secret checks are recorded in the task report.

No live official puzzle actions were used for UX testing. Physical installed-PWA
interaction was not repeated. Product approval is required before commit/deployment.

Final checkpoint: all 51 browser cases (48 suite + 3 supplemental boundary cases),
formatting, lint, TypeScript, build and secret/client-boundary checks pass. No commit
or deployment was made. The working changes are available for product review.

## Approved release

Product review approved publication as v0.13.2. The display name is PARTICIPUZZLE
in the game, navigation and browser title; existing routes remain unchanged.
The earlier local-only checkpoint statements describe the pre-approval stage.
No database migration, feature-gate or schedule change is required.
