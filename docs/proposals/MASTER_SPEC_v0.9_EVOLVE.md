# Proposed Master Spec v0.9 — exact EVOLVE delta

**APPROVED in Task #19.3.** Incorporated into `docs/MASTER_SPEC_v0.9.md`; this file preserves the reviewed amendment.
Frozen `docs/MASTER_SPEC_v0.8.md` remains unchanged. No other requirements change.
Only EVOLVE additions and necessary version metadata are proposed. The separately
identified Section 62 stale version reference is handled solely as version metadata
in the future v0.9 document, without altering any substantive requirement.

## Version metadata

Change the title to `Master Product Specification --- v0.9` and Supersedes to
`Master Product Specification v0.8`. Only after approval, retain the status
`APPROVED --- FROZEN BASELINE` in the newly created v0.9 document.

## Section 1 — append after the Global Doodle exception

EVOLVE is a narrowly scoped, moderated community-development surface for verified
ACTIVE participants. Participants may propose improvements and support ideas with
equal weight. This does not authorize a social-content feed, person rankings,
comments, inferred trust, or automatic implementation by vote count.

## Section 47 — replace the final exception paragraph only

The appreciation/ranking exception is attached to individual Global Doodle
drawings under Section 48A. EVOLVE additionally permits equal, idea-specific,
withdrawable support under Section 48C. Neither exception authorizes participant
popularity profiles, influence scores, conventional Likes elsewhere, or ranking
people or their networks.

## Insert Section 48C after Section 48B

### 48C. EVOLVE

EVOLVE allows verified ACTIVE Atoms to suggest improvements, support community
ideas and understand development decisions. Its guiding message is: YOU DON'T
JUST USE ATOMIC BOND. YOU HELP SHAPE WHAT IT BECOMES.

Each idea contains at most 250 characters. One accepted submission per Atom is
allowed in any rolling 24-hour period, enforced using authoritative database time.
Moderation, removal, account deactivation or reactivation cannot reset that
cooldown. Opening the interface does not create a submission.

New ideas require administrator visibility review before other participants can
see them. Immediately after a successful authoritative submission, the author
receives a visible acknowledgment: IDEA RECEIVED — awaiting administrator review.
The author can see the pending idea; other participants cannot. Administrators
can publish, hide or remove content. Ideas and decision explanations are plain
text; they do not introduce comments, discussions, messaging or actionable links.

The statuses are PROPOSED, UNDER REVIEW, PLANNED and LIVE, with DEFERRED and
DECLINED outcomes also available. Every administrative change has an explanation
and a bounded private audit record. Independent sanitized factual release history
may describe implemented improvements, completion or release dates and short
result explanations while relevant. It must not copy withdrawn suggestion text
or preserve deleted participant identity. Attribution is optional and permitted
only while authorized and retained; the initial foundation keeps release history
unattributed and unlinked to suggestions or participants. This history is separate
from private administrative audit records.
Statuses may be revised transparently.
Support informs decisions but never guarantees implementation or automatically
changes status. Administrators retain responsibility for feasibility, safety and
implementation using existing secured administrator membership.

Each eligible Atom may support multiple visible ideas, including its own, once
per idea. Submission never automatically creates support. Proposal and support
rights are identical regardless of Bond count, account age or administrator status.
Support has equal weight and may be withdrawn. Withdrawal removes the
support record. No paid influence, Bond weighting, administrator weighting,
personal popularity score or leaderboard is permitted. The participant interface
may display aggregate idea-level support totals, as requested in Task #19.2,
but never voter lists or personal rankings. Concurrent requests cannot add extra weight.

Ideas are publicly unattributed by default. Opted-in attribution displays only the
author's existing public alias while ACTIVE. A missing or removed alias remains
unattributed; never substitute an Atom number, email or private identity. Aliases
are displayed as escaped text and are not unique identity or authority claims.
Anonymous presentation does not conceal authorship from authorized services.
Emails, authentication IDs,
internal owner identifiers, private profiles and supporter identities are never
exposed in participant responses. Optional private YOU HELPED SHAPE THIS
acknowledgment requires authorship or current support for a LIVE idea and may be
suppressed by the participant. No email notifications are introduced.

DORMANT and DEACTIVATED Atoms cannot participate. Their authored ideas become
hidden and their support is removed immediately, including support attached to
their hidden ideas. Reactivation restores neither support nor public visibility;
ideas require another administrator visibility review. Deletion removes authored
content, attribution and support immediately. Only redacted, non-content decision
records may remain temporarily. Account lifecycle controls remain authoritative.

Approved ideas and reviewed development history remain available while relevant,
subject to administrator stewardship and lifecycle removal. Previously public
DECLINED ideas and their reviewed history may remain visible for 90 days from
the authoritative decline decision. A previously public idea withdrawn by its
author becomes hidden immediately. Authors may withdraw at every development stage,
including before publication. The original suggestion and attribution leave public
visibility and community prioritization; all attached support is removed and no
further support is accepted. Content may remain privately for up to 90 days, unless
a shorter privacy deadline applies. Withdrawal does not reverse released features;
independent sanitized factual release history may remain. Withdrawing support is
not withdrawing an idea and does not change that idea's retention.

The 90-day policy never delays privacy or safety removal. Deletion and explicit
moderation removal erase content and attribution immediately. DORMANT or
DEACTIVATED authors' ideas become hidden immediately and retain the shorter
30-day cleanup deadline. Unreviewed PENDING and otherwise HIDDEN ideas likewise
have a 30-day deadline. The earliest applicable deadline takes precedence;
repeated requests or unchanged decisions cannot extend it. Withdrawn or purged
suggestions cannot be republished, including after reactivation. Expired content is
excluded from participant retrieval even if cleanup is delayed. Reviewed history
inherits its idea's visibility and removal rules unless it is a separately reviewed,
independent product fact retaining neither suggestion text nor identity linkage.

Private administrative audit records contain only the minimum authorized action,
timestamp, status/moderation transition and bounded reason metadata. They remain
private and expire after 30 days unless an existing legal or security obligation
requires a documented exception; the initial implementation adds no such exception.
They do not duplicate suggestion content or public explanations. Account deletion removes
identity associations; any retained removal record is redacted and non-content.
Bounded cleanup uses database time, with monitored execution required before
production. Normal backup expiry applies; recovery must reapply removals before
restored data is served.

All operations independently verify the current verified owner and ACTIVE state.
Private RLS-protected tables are accessible only through narrow authorized
operations. Database cooldowns, support uniqueness, request throttling, lifecycle
locking and stale-write protection remain authoritative. Client identity claims,
local storage and public Atom numbers cannot grant privileges. The frontend never
receives a privileged database credential. No new general social-network feature
or unrelated product behavior is authorized by this section.

## Section 62 — replace its paragraph only

This v0.9 document is the authoritative frozen product specification.
v0.1, v0.2, v0.3, v0.4, v0.5, v0.6, v0.7 and v0.8 remain historical. New ideas
may be proposed, but any change to protected/core product principles requires an
explicit approved future specification revision rather than silent drift.

## Approval boundary

The product owner approved withdrawal at every stage, privacy-first retention
precedence and separate independent history/private audit for local schema alignment.
This is the finalized proposal, not a frozen specification. Publication, hosted
migration, production integration, cleanup scheduling and freezing v0.9 still
require separate approval. No interface expansion is included in this task.
Frozen v0.8 remains unchanged.
