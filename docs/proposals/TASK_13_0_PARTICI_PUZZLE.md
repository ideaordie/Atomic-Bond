# Approved specification addition — incorporated in v0.5

Task #13.3 explicitly approved the exact Section 48B below. Master Spec v0.5
incorporates it while preserving frozen v0.4 and all its other product sections.
Public gameplay activation remains separately gated.

## 48B. PARTICI-PUZZLE

PARTICI-PUZZLE is an optional shared weekly picture puzzle for verified ACTIVE
Atom owners. It initially uses a 25-piece, 5 × 5 board and administrator-approved
artwork. Administrator-controlled weekly windows do not overlap. Database time
determines the current puzzle; if none is scheduled, show a waiting state.

REVEAL MY PIECE reserves one available piece for five minutes. Each participant
may hold only one reservation. Cancellation or expiration returns the piece and
starts a five-minute reveal cooldown. Revealing does not consume PLACE allowance.

PLACE MY PIECE permits one successful placement per rolling 60 minutes. MOVE A
PIECE permits one successful move per rolling 60 minutes, independently. Both
cooldowns persist across weekly puzzle changes. Incorrectly placed pieces remain
movable and two unlocked pieces may be swapped. Correct placements permanently
lock. Completion requires every piece to occupy its correct position. Failed
actions consume neither gameplay allowance; request throttling still applies.

Authoritative atomic database operations determine ownership, reservation validity,
correctness, locks, deadlines, board revision and allowances. Clients cannot assert
these properties. Participants may see their reserved piece and placed pieces,
but cannot request arbitrary source regions. Full-image delivery is permitted
after authoritative completion or scheduled expiration. Before then, unrevealed
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

Puzzle content remains available throughout its scheduled period and for 30 days
after that period closes, including puzzles completed early. Afterward, bounded
cleanup removes source artwork and detailed gameplay records, retaining only
minimal aggregate statistics. Backup retention may delay physical erasure from
recovery copies; restored systems must reapply retention before serving content.

Collective progress may be displayed without individual rankings, rewards or
personal contribution histories retained indefinitely. This feature introduces
no comments, messaging, participant image uploads, votes, push notifications or
changes to Bonds and Pulse. Keyboard/touch operation, Light/Dark presentation and
reduced-motion accessibility are required.

---

See the [local service checkpoint](../architecture/PARTICI_PUZZLE_SERVICE_v0.1.md)
for credential, migration, retention and rollout gates. This proposal does not
authorize hosted execution or a broadly privileged secret.
