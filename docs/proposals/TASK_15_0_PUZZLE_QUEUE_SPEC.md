# Task #15.0 — exact proposed Section 48B replacement

Status: approved and incorporated into Master Spec v0.7 for v0.15.0. Frozen v0.6
remains unchanged. Only Section 48B and specification version metadata changed.
This document preserves the reviewed amendment and implementation interpretation.

## 48B. PARTICI-PUZZLE

PARTICIPUZZLE is an optional shared picture puzzle for verified ACTIVE Atom owners.
It initially uses a 25-piece, 5 × 5 board and administrator-approved artwork.
An administrator-managed ordered queue replaces mandatory weekly windows.
Only one puzzle may be ACTIVE or in its completion celebration at a time.
Queued artwork is private and must be fully prepared and READY before activation.
The lifecycle is QUEUED → ACTIVE → COMPLETED → CELEBRATING → ARCHIVED;
completion and the start of celebration occur atomically at the recorded database
completion timestamp.

An incomplete puzzle remains ACTIVE until all pieces are correct or an authorized
administrator explicitly retires it with confirmation and an auditable reason.
Completion locks further gameplay and begins a 60-minute celebration displaying
the completed artwork and a countdown. After that period, an atomic, idempotent
transition activates the first READY queued puzzle. No administrator needs to be
online. Database time determines eligibility; concurrent requests and restarts
must not cause duplicate activation.

If the queue is empty after celebration, show WAITING FOR THE NEXT PUZZLE.
Do not recycle completed puzzles. Adding READY artwork may activate it immediately
when no active puzzle or celebration remains and advancement is not paused.
Administrators may reorder the queue, remove unused queued puzzles, and pause or
resume automatic advancement. Pause prevents the next activation; it does not
interrupt the current puzzle, extend celebration or alter participant allowances.
The normal Studio workflow is UPLOAD → PREVIEW → ADD TO QUEUE, without required
dates. All queue changes require authoritative administrator authorization.

REVEAL MY PIECE reserves one available piece for five minutes. Each participant
may hold only one reservation. Cancellation or expiration returns the piece and
starts a five-minute reveal cooldown. Revealing does not consume PLACE allowance.

PLACE MY PIECE permits one successful placement per rolling 60 minutes. MOVE A
PIECE permits one successful move per rolling 60 minutes, independently. Both
cooldowns persist across puzzle changes. Incorrectly placed pieces remain
movable and two unlocked pieces may be swapped. Correct placements permanently
lock. Completion requires every piece to occupy its correct position. Failed
actions consume neither gameplay allowance; request throttling still applies.

Authoritative atomic database operations determine ownership, reservation validity,
correctness, locks, deadlines, board revision and allowances. Clients cannot assert
these properties. Participants may see their reserved piece and placed pieces,
but cannot request arbitrary source regions. Full-image delivery is permitted
after authoritative completion. Retirement of an incomplete queue puzzle does not
reveal its unplaced artwork. Before then, unrevealed
source regions remain inaccessible. Pre-generated private tile bytes are selected by a narrowly authorized PostgreSQL
operation using the existing verified-owner session and database time. Normalized source
artwork is retained privately in PostgreSQL for the same bounded retention period;
source records are not participant-readable. Authorization
and byte selection are serialized with reservation and lifecycle changes. The
application returns private, non-cacheable binary responses; ordinary participants
have no direct Storage access to puzzle media. New retrieval after cancellation or
expiry is denied unless another current rule authorizes that content (for example,
a placed board piece). An already-authorized in-flight response may complete;
previously delivered content cannot be revoked.

Deactivation cancels reservations and prevents participation while preserving
applicable cooldowns and shared progress. Deletion removes participant-linked
private puzzle records and reservations without reversing anonymous shared
progress. Contributor identities are never included in display data.

ACTIVE and QUEUED puzzle media are protected from age-based cleanup. Completed
artwork remains privately retained for 30 days after its celebration period ends.
Explicitly retired incomplete puzzles retain their private media and progress for
30 days after retirement; unplaced artwork remains unavailable to participants.
Unused uploads that were never queued expire after 24 hours. Removed unused queue
entries become cleanup-eligible after 24 hours. Bounded cleanup then removes source
artwork and detailed gameplay records, retaining only minimal aggregate statistics
and non-content queue audit records. Existing historical records and approved
retention deadlines are preserved by an explicitly reviewed transition. Backup retention may delay physical erasure from
recovery copies; restored systems must reapply retention before serving content.

Collective progress may be displayed without individual rankings, rewards or
personal contribution histories retained indefinitely. This feature introduces
no comments, messaging, participant image uploads, votes, push notifications or
changes to Bonds and Pulse. Keyboard/touch operation, Light/Dark presentation and
reduced-motion accessibility are required.

## Implementation interpretation

Lazy resolution permits the first request at/after the one-hour boundary to advance.
The existing five-minute puzzle Cron job also advances with no clients online;
there may be up to five minutes of idle-time delay, plus service outages. No early
activation is permitted. Expired celebration eligibility never depends on browser time.
