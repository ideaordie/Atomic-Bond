# Master Spec v0.4 — proposed Global Doodle delta

Status: APPROVED on 2026-10-12. Incorporated into `../MASTER_SPEC_v0.4.md`.
Frozen Master Spec v0.3 remains unchanged. This file preserves the reviewed delta.

The following is the exact proposed delta. All other v0.3 text remains unchanged.

## Section 1 — append

Global Doodle is a narrowly scoped exception: a moderated, bounded visual-expression
surface available to authenticated ACTIVE participants across Atomic Bond. It does
not require a confirmed Bond and does not authorize a general social-content feed.

## Section 5 — replace the final sentence

X is an optional bridge to an existing public identity. Atomic Bond does not become
a general content-feed platform; the limited Global Doodle exception is defined in
Section 48A.

## Section 47 — append

The only appreciation/ranking exception is attached to individual Global Doodle
drawings under Section 48A. It does not authorize participant popularity profiles,
influence scores, conventional Likes elsewhere, or ranking people or their networks.

## Insert Section 48A — Global Doodle

Global Doodle lets authenticated ACTIVE Atoms share temporary 64 × 64 monochrome
dot drawings. Drawing, erasing, undo, clear, preview, bounded replay, accessible
controls and Light/Dark presentation are supported. The final bitmap is 512 bytes.
No confirmed Bond is required to create, view, appreciate or report a drawing.
Anonymous access is not part of this feature.

An Atom may have at most one live drawing. PostgreSQL enforces a minimum of 60
minutes between accepted submissions, including after removal. Retries are
idempotent. Drafts remain local. A valid submission from an authenticated ACTIVE
owner is published immediately after server-side payload/replay validation,
ownership/lifecycle checks, cooldown and request throttling. Ordinary publication
has no pending-review state and requires no administrator approval.

Publication lasts exactly 60 minutes from successful publication using database
time, unless removed earlier for moderation or account lifecycle reasons. Content
is immutable. The approved editor's bounded-history fallback may submit a still
bitmap with no replay; any submitted replay must be complete within its bounds and
reconstruct the final bitmap. A partial or inconsistent replay is rejected.

There is no fixed global daily submission quota. Per-Atom cooldown, one live slot,
payload/replay bounds and server-enforced request throttling remain authoritative.
Administrators may explicitly pause and resume new submissions globally. Pausing
intake does not hide existing eligible drawings, stop voting, or affect other Atomic
Bond features. An idempotent retry does not republish content or extend its lifetime.

Moderation is reactive. Authorized administrators can inspect active and reported
drawings, including every retained intermediate replay state; remove content
immediately from all public retrieval operations; restrict or restore Doodle posting;
and inspect a private moderation decision record. Review uses bounded cursor pages
without an overall record ceiling. Reports prioritize review but never automatically
remove content solely because of report volume.

APPRECIATE is the sole voting interaction. Each authenticated ACTIVE Atom may
appreciate another Atom's currently published drawing once. Self-voting is
prohibited. No votes are accepted outside its original 60-minute publication
window. Retries cannot add votes. There is no dislike, downvote, comment, reply,
repost, follower system, financial reward or transferable reward. The live drawing
shows its appreciation count and whether the viewing owner has appreciated it.

The GLOBAL DOODLE HALL OF FAME holds at most ten read-only drawings. Final scores
are frozen when the original voting window closes. Initial qualification requires
five unique appreciations. Authorized administrators may explicitly change the
threshold to five or higher; it is never automatically lowered. Each drawing uses the threshold
in force at its publication, so later changes do not rewrite eligibility.

Qualification does not itself publish artwork to the Hall of Fame. A qualifying
drawing waits privately for explicit administrator approval for at most seven days
after its live window ends. It then expires if not promoted. At promotion, the
database atomically checks the current gallery. An empty position may be filled;
a full gallery accepts a candidate only if its score is strictly higher than the
lowest incumbent. Equal scores never displace an incumbent. Display ordering is
score descending, promotion time ascending, then drawing identifier ascending.
Among tied lowest incumbents, the newest promotion is displaced first, with the
drawing identifier resolving any remaining tie. Administrator operations cannot
set scores or bypass qualification or capacity rules.

Hall of Fame entries may show rank, drawing, final score, public Atom number and
original publication date. They have no ongoing voting. A displaced entry becomes
unavailable immediately and its payload/replay is deleted by bounded cleanup.
There is no archive of former winners. Artwork remains stored while it occupies
a Hall position, subject to moderation and account lifecycle removal.

Attribution uses only the existing public Atom number; private identity, Auth
identifiers, internal Atom UUIDs, location, preferences and Pulse history are never
part of Doodle display data. Drawings must not be used to infer personal traits.
Participants should not put private personal information into drawings. ACTIVE
participants may report drawings through predefined categories and bounded,
duplicate-protected reporting. Reports alone do not automatically remove content.
Authorized administrators may reject/remove content and restrict Doodle posting.

Deactivation and deletion remove the author's live, qualifying and Hall artwork and
replay. Reactivation does not restore that content. Deactivation retains the
submission cooldown; deletion clears account-linked Doodle state. Votes legitimately
cast before deactivation remain valid. On deletion, private voter links are removed;
open-window counts may consequently decrease. Closed-window scores remain frozen.
Account lifecycle changes never permit new votes from an ineligible account.

Ordinary expired drawing payloads are deleted within 24 hours. Removed, rejected
and displaced artwork becomes inaccessible immediately and is queued for the next
five-minute cleanup, with a one-hour operational removal deadline. Public visibility
never depends on cleanup running. Qualifying private review and
current Hall storage are the explicit retention exceptions. Minimal cooldown and
retry metadata may outlive payloads; it contains no bitmap or replay. Reports/voter
links are removed with their drawing. A minimal private moderation decision log may
remain for up to 30 days, without bitmap/replay or private email; deleted drawing links and
deleted Auth identities are cleared. This log never appears in participant data. Longer retention requires an actual
legal requirement and a separately documented, restricted operational procedure;
this feature introduces no automatic legal hold. No immediate erasure promise is made for
backups or copies already downloaded by another participant.

This exception adds no targeting, notifications, email campaigns, emotional
profiling, changes to Bonds, or broader social-feed authorization.

## Approval notes

The user has explicitly approved removal of artwork on both deactivation and
deletion, with no automatic restoration. The approved seven-day private promotion-review limit,
publication-time threshold snapshot, deterministic tie order, voter deletion
semantics and public-number attribution are presented here for final product review.
The owner explicitly approved freezing this delta as v0.4 on 2026-10-12.
Frozen v0.3 is not modified.

This revised proposal supersedes mandatory ordinary pre-review and all fixed global
daily admission quotas. Hall promotion still requires explicit administrator approval.
The owner has approved up to 30 days of minimal non-content moderation records.
Request quotas (120 requests, including at most 30 mutations per owner per fixed
one-minute window) are operational controls, not an additional engagement mechanic.
They may be tuned after measured beta workload and security review.
