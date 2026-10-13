# Proposed specification addition — not finalized

Preserve frozen Master Spec v0.4. The exact proposed future addition is Section
48B below; no other product sections change. Versioning and publication require
explicit approval.

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
source regions remain inaccessible. Pre-generated private tiles use existing
verified-owner sessions and Storage authorization; equivalent direct reads are
permitted only for independently authorized content.

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
