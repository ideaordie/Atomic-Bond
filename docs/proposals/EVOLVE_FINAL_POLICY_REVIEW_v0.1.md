# EVOLVE final product policy and migration design — Task #19.1

**Historical review, now approved for local alignment.** The subsequent governance
approval authorizes withdrawal at every stage and independent sanitized release
history. See `EVOLVE_SCHEMA_ALIGNMENT_v0.1.md` for the implemented candidate,
current policy mapping and validation. Outstanding-policy wording below records
the earlier checkpoint and no longer requests those same approvals.

October 18, 2026. Architecture review only. Baseline remains v0.16.4.6 / `6df0a19`.
This supersedes the initial foundation's public-number attribution and retention
proposal. Frozen v0.8, the approved synthetic interface, SQL candidate, services,
production and schedules remain unchanged in this review. No Task #19.2 work.

## Approved product direction

- Anonymous publicly by default means no author label in participant projections;
  it does not mean anonymous submission or concealment from authorized services.
- Explicit opt-in displays only the existing public alias, resolved from the
  ACTIVE author's current public profile. No alias means no attribution. Never
  fall back to Atom number, email, auth ID or internal owner ID. Do not snapshot
  aliases indefinitely. Alias changes/removal must be reflected on the next read.
- Aliases are not unique identity claims. Render them as escaped plain text,
  without links, badges or implied administrator authority. Existing public alias
  governance remains necessary: aliases can themselves contain identifying text.
- Every verified ACTIVE Atom has the same 250-character proposal allowance,
  rolling 24-hour cooldown and one equally weighted support per idea. Neither
  account age, Bonds nor administrator membership grants additional influence.
- Supporting one's own visible idea is voluntary. Submitting creates zero support.
  Support may be withdrawn; the row is deleted. Other ideas and votes are unaffected.
- New ideas remain PENDING, visible to their author and authorized administrators.
  A successful RPC response must produce immediate inline acknowledgment in the
  existing status area: **IDEA RECEIVED — awaiting administrator review.** A failed
  request must not show success. An uncertain network outcome requires re-reading
  the author's submissions before retrying; do not manufacture a success message.
- No interface expansion, notifications, public counts, voter lists or rankings.

## Retention recommendation and conflict resolution

| Category                                      | Visibility                                   | Content/history retention                                                                        |
| --------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Approved, relevant idea                       | Reviewed participant visibility              | While relevant; administrator stewardship, not an automatic expiry of PLANNED work               |
| Previously public, DECLINED                   | May remain publicly visible with explanation | 90 days from first effective decline decision                                                    |
| Previously public, withdrawn by author        | Hidden immediately                           | Up to 90 days privately from withdrawal, unless a shorter privacy/safety rule applies            |
| PENDING, never published                      | Author/admin only                            | 30 days pending review                                                                           |
| Other HIDDEN content                          | Author/admin as appropriate                  | 30 days; never reinterpret a safety hide as a 90-day withdrawal                                  |
| DORMANT or DEACTIVATED author                 | Hidden immediately; support removed          | Earlier of existing deadline or 30 days from lifecycle change                                    |
| Deleted author or explicit moderation removal | Inaccessible immediately                     | Erase content, reviewed history and attribution immediately; only minimal redacted audit remains |
| Private administrative audit                  | Authorized administrators only               | 30 days from the decision; no duplicated content or public explanation                           |

The 90-day direction conflicts with the initial candidate in two places: VISIBLE
DECLINED ideas currently have no expiry, and all HIDDEN ideas have only 30 days.
It must not override the previously approved privacy-first lifecycle or safety
removal. The earlier deadline wins. Repeated hide/decline/withdraw operations must
not reset deadlines. A genuinely new, explicitly reviewed development decision can
reopen a declined idea; this is auditable and cannot automatically restore votes.
Restore after account reactivation still requires administrator review and never
restores support. A deleted or purged idea cannot be revived.

"Withdrawn public idea" is distinct from withdrawing a support vote. There is no
author idea-withdrawal operation in the approved prototype or current candidate.
Do not silently equate all admin hides with withdrawals or add a new control here.
The recommendation is an explicitly classified withdrawal handled only through a
separately approved integration workflow. Confirm this interpretation before SQL
implementation; if withdrawal instead means immediate content erasure, use the
existing removal path and retain no 90-day content copy.

Meaningful development history cannot remain in the current 30-day private audit
table: its explanations would disappear. Conversely, keeping that table indefinitely
would preserve administrative identities unnecessarily. Separate reviewed public
development explanations from private audit metadata. Public history contains no
admin identifiers, internal notes or unreviewed moderation reasons. It follows the
idea's visibility/deletion rules; anonymous attribution does not justify retaining
identifiable free text after deletion. Backup expiry remains separate from online
deletion; restore procedures must reapply removals before serving data.

## Final migration design — not yet implemented

Revise the unpublished `202610210001_evolve.sql` candidate only after retention and
history decisions are approved. Do not apply the existing candidate as if it
already enforced these policies. No hosted migration or backfill is needed now.

1. **Attribution:** retain the opt-in boolean and internal author reference; replace
   `authorPublicId` in the projection/TypeScript contract with nullable `authorAlias`.
   Resolve `public.atoms.display_name` only when ACTIVE and opted in; no new profile
   column or duplicated alias storage is needed. Never return both identifiers.
2. **Retention classification:** add nullable `first_published_at`,
   `retired_at` and `retirement_reason` constrained to DECLINED/WITHDRAWN. Keep
   `purge_at` as the earliest effective content deadline. Add checks and an indexed
   deadline query. Status and moderation stay separate; no seventh public status.
   First publication distinguishes never-public rejected submissions from previously
   public ideas. Deadline derivation occurs only in authorized database operations.
3. **Reviewed history:** add private/RLS-protected `evolve_development_history`
   keyed to idea ID, with an opaque event ID, status, reviewed explanation and
   authoritative timestamp. No author/admin identity columns. No direct client
   access: bounded projections inherit current idea visibility and deadline checks.
4. **Private audit:** keep administrator reference and previous/new status/visibility
   plus a bounded machine reason code and timestamp in `evolve_history`; remove
   free-text explanation duplication. Public explanation and private audit creation
   are atomic with the authorized status change. Audit records expire at 30 days.
   Removal/deletion redacts identity and deletes development-history content in the
   same transaction. Audit metadata cannot reveal removed content.
5. **Authorization:** preserve default-OFF gate, verified live session, explicit
   ACTIVE check, existing administrator membership, lifecycle-first locks, empty
   search paths, RLS, revoked direct grants and private helpers. Add no credential.
6. **Reads and support:** reject content at its deadline using database time, not
   cleanup timing. Expired/hidden/pending ideas cannot receive support from other
   participants. Public history is available only with its visible parent idea.
   Retained hidden content remains private. Audit access requires administrator auth.
7. **Cleanup:** bounded batches delete eligible content/history and redact parent
   records, then purge minimal audit/tombstones at their fixed deadlines. Preserve
   published, relevant ideas without retirement deadlines. All paths use the same
   lifecycle-compatible locking; failures retry safely. Do not extend a deadline
   each time cleanup runs. Published-history growth needs a documented finite page
   size and monitored storage; per-request throttling alone is not storage control.
8. **Rollout:** keep migration outside the hosted chain until approval. Review
   schema diff/recovery, promote once, verify actual grants and lifecycle behavior,
   connect existing session-bound services and approve monitored cleanup/ingress
   separately. No existing production data or unrelated schedules change here.

Schema changes are therefore required for retirement classification and durable
reviewed history. Alias attribution requires a projection/contract change only.
Own-support equality needs no schema or behavior change. Acknowledgment needs only
future wiring to the existing successful submission response, not another panel.

## Security confirmation: implemented versus still required

The accepted initial candidate and prior tests establish database-time cooldown,
transactional support uniqueness/withdrawal, stale-write protection, pending
author/admin isolation, admin-only status changes with explanations, private audit
access, default-OFF gate, ACTIVE-only participation and lifecycle removal.
The accepted seven-test foundation suite and real PostgreSQL races are evidence
for that candidate, not for the unimplemented changes above.

Approved ideas and explanations must render as escaped plain text. Manual review
must screen personal information, abuse, malicious links and duplicate suggestions.
No automated moderation guarantee is claimed. No server/service-role credentials,
private identity data, HTML rendering or URL-based author fields are introduced.
Administrator authority is for decisions only, not additional proposal/vote rights.

Required targeted tests after approval: opted-in/out/missing/changed aliases;
no automatic own support; equal cooldowns for administrators; public versus private
history projections; exactly 90-day boundaries; repeated decisions not extending
retention; earliest-deadline precedence; deletion during retention; reactivation
without restoration; transactional status/history updates; bounded cleanup under
concurrent support/lifecycle operations. Existing authorization tests remain.

## Review outcome and remaining decisions

No newly identified weakness in the accepted cooldown/support/authentication design.
The current migration is not policy-complete for these new retention requirements
and must not be promoted unchanged. Confirm (1) hidden/private 90-day withdrawal
semantics and its future authorized workflow, (2) the proposed retention precedence
and audit duration, and (3) separation of durable reviewed history from private
audit. Then implement and test the narrowly scoped candidate revision locally.

The exact proposed v0.9 text is in `MASTER_SPEC_v0.9_EVOLVE.md`. Only Sections 1,
47, new 48C and necessary version metadata change; frozen v0.8 remains untouched.
No product policy is frozen by this review.

## Validation / changed files for this review

Documentation only: this document, `EVOLVE_FOUNDATION_v0.1.md` (supersession notice),
and `MASTER_SPEC_v0.9_EVOLVE.md` (exact revised proposal). Formatting and diff/scope
checks apply; previous runtime results remain historical evidence. No full suite
rerun is necessary for this documentation-only policy review. No claim of new SQL
enforcement, production verification or physical-device acceptance is made.
