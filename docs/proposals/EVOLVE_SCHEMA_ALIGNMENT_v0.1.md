# EVOLVE governance schema alignment — Task #19.1

October 18, 2026. Local candidate only. Baseline remains v0.16.4.6 / `6df0a19`.
The approved governance is implemented in
`supabase/candidates/202610210001_evolve.sql`, outside the hosted migration chain.
No production integration, UI change, new credential, commit, deployment or spec
freeze. Earlier review documents are historical.

## Exact policy-to-schema mapping

| Policy                                  | Candidate enforcement                                                                                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ACTIVE owners only                      | account_owner/live session/lifecycle epoch, explicit ACTIVE check and default-OFF gate on every RPC                                                        |
| Equal rights                            | Same server-time 24-hour account cooldown, support composite primary key and throttling for owners and administrators                                      |
| Voluntary own support                   | Submit inserts zero support; authors may explicitly support a visible idea once                                                                            |
| Private pending review                  | PENDING is author/admin only; successful submit returns acknowledgment text                                                                                |
| Anonymous default / public alias opt-in | authorAlias resolves current ACTIVE display_name only; no cached alias, number or identity fallback                                                        |
| Withdrawal at every stage               | Owner-only withdraw with expected account revision and lifecycle-first transaction lock; no idea-status restriction                                        |
| Immediate hiding / support invalidation | HIDDEN and withdrawn_at, attribution cleared and all attached support deleted in the same transaction; further support denied                              |
| No resurrection                         | Moderation cannot republish withdrawn or expired ideas; reactivation restores neither content visibility nor support                                       |
| 90-day withdrawal deadline              | Fixed withdrawn_at + 90 days, shortened by privacy_deadline; repeated withdrawal cannot renew it                                                           |
| Public DECLINED deadline                | Explicit publication/decline sets first declined_at + 90 days; repeated decisions do not renew it; first_published_at records publication                  |
| Deactivation/DORMANT                    | Hide, clear attribution/support, set earliest existing deadline or 30 days; cooldown survives                                                              |
| Deletion/moderation removal             | Body/owner/explanation nulled, attribution/support removed immediately; audit identity and source-idea links detached                                      |
| Independent factual release history     | Separate private RLS table and safe projection: improvement, completion date, result explanation, generated ID/time; no source-idea/owner/admin/alias link |
| Private audit                           | evolve_history stores admin reference, transition, fixed reason code and time; no suggestion or explanation copy; admin-only pagination                    |
| Audit expiry                            | Exact 30-day read cutoff and bounded cleanup; no legal/security exception mechanism added                                                                  |
| History stewardship                     | Admin-only publish_history requires sanitized=true, bounded plain text and non-future completion date; remove_history deletes unsafe/obsolete facts        |

The six development statuses remain unchanged; withdrawal is a timestamp and
HIDDEN visibility, not a seventh public status. Support withdrawal remains distinct
from idea withdrawal. Withdrawing a LIVE idea never changes released application
features. No withdrawal control is added to the prototype; the service contract
supports later separately approved integration.

## History security boundary

Release history is not an automatically anonymized copy of suggestions. It is
separately authored factual product documentation. The RPC accepts no suggestion,
contributor, alias or attribution linkage. There is no relational path from a
retained product fact to the original author. The minimal implementation omits
optional release-history attribution altogether.

Only an existing authorized administrator can publish/remove facts. sanitized=true
requires explicit review; it is not a PII detector. Administrators must exclude
suggestion quotations, names, aliases, participant numbers and identifying anecdotes.
Escaped plain-text rendering prevents HTML execution, not identification through
free text. This human moderation boundary must be enforced in the future admin
workflow. Unsafe entries can be removed immediately. No claim is made to erase
content already seen/copied by people or instantly purge backups.

Audit reasons are fixed codes: STATUS_REVIEW, HIDE, REMOVE, WITHDRAW,
PUBLISH_HISTORY and REMOVE_HISTORY. Free-text idea explanations remain only on the
idea and are erased with it. Removal detaches audit source-idea and administrator
references. Deleted administrators lose their audit identity associations as well.
Independent facts survive because they contain neither suggestion content nor
identity linkage by policy; this is not an exemption from privacy removal.

## Retention and cleanup requirements

Unreviewed ideas retain the 30-day review window. Withdrawal before expiry gives
up to 90 days private retention, shortened by any existing privacy deadline.
The first decline timestamp is never renewed. Explicit reviewed reopening can
remove the decline deadline while active, but a later decline still uses the
original date; expired or withdrawn content cannot reopen.

Moderation hiding establishes a maximum 30-day privacy deadline. DORMANT and
deactivation use the earlier existing deadline or 30 days. Reactivation does not
clear that privacy deadline. Deletion and REMOVED erase online content immediately.
All content listing and support RPCs enforce deadlines even before cleanup,
including administrator listing. Audit retrieval likewise enforces its deadline.

private.evolve_cleanup(limit) handles at most 100 ideas and 100 audit rows per
transaction with indexed deadlines and shared lifecycle-compatible locking. It
removes eligible content, then purges minimal redacted tombstones after at most
30 additional days. It is idempotent. Relevant published ideas and independent
product facts have no automatic expiry; administrators remove obsolete facts.

No scheduler is added. Before production: approve monitored scheduling using the
existing database infrastructure, verify real execution, retries/backlog and
physical-deletion timing, document backup expiry and recovery deletion replay,
and preserve Doodle cleanup and Tuesday Weekly Growth schedules. Logical expiry
is verified locally; a hosted physical-deletion SLA is not yet established. No
new external scheduler, privilege or credential is introduced.

## Migration and specification boundary

The candidate adds four idea timestamps and one private product-history table,
and replaces audit free text with fixed reasons. The RPC retains existing gates,
authorization and throttling, adding withdraw, development_history, publish_history
and remove_history; history also supports a bounded global admin view. No direct
table grants, anonymous access or public HTTP route is introduced. Promote the
candidate exactly once only after hosted approval and recovery verification.

MASTER_SPEC_v0.9_EVOLVE.md is the finalized proposed amendment. Governance is
approved for local implementation; publication and freezing are not authorized.
Frozen v0.8 is unchanged. No unresolved governance choice blocks the local
candidate; hosted authorization, ingress, admin sanitization workflow and cleanup
verification remain required before integration/activation.

## Exact files changed in this alignment

1. supabase/candidates/202610210001_evolve.sql
2. src/services/evolve/contracts.ts
3. tests/integration/evolve-governance.test.ts (new)
4. scripts/test-evolve-concurrency.mjs
5. docs/proposals/EVOLVE_SCHEMA_ALIGNMENT_v0.1.md (new)
6. docs/proposals/MASTER_SPEC_v0.9_EVOLVE.md
7. docs/proposals/EVOLVE_FOUNDATION_v0.1.md (historical notice)
8. docs/proposals/EVOLVE_FINAL_POLICY_REVIEW_v0.1.md (historical notice)

No prototype, dependency, application version, CI, frozen spec or existing
production source file changed. Earlier evidence is retained as historical.

## Validation

Only synthetic accounts, isolated clocks and disposable databases were used.
No hosted data access.

- Full unit/integration/security regression: **85 files, 496 tests passed**, 207.04s,
  controlled two-worker run. No disabled or skipped checks.
- Final targeted foundation/governance run: **13 tests passed**. Covers every
  withdrawal stage, author authorization, no automatic self-vote, support removal,
  fixed deadlines, expiry before cleanup, deactivation precedence, deletion,
  moderation removal, alias handling, independent history, audit cutoff and RLS.
- Native PostgreSQL concurrency: passed eight-way submission/vote races,
  withdrawal versus four supporters, deletion/withdrawal/cleanup, existing lifecycle
  races and stale moderation. The runner exited zero and cleaned its local database.
- Production build, TypeScript, targeted ESLint and formatting: passed.
- Secret scan: 648 repository files and 54 built client bundles; no known managed
  secret, private-key marker or receipt implementation leakage detected.
- Frozen v0.8 and tracked production files: unchanged. Prototype appearance and
  browser runtime are unchanged, so responsive/browser suites were not repeated.

The final audit source-link detachment was verified with targeted tests after the
full suite. Existing regression evidence is not represented as hosted acceptance.
No physical-device or production-integrated EVOLVE behavior is claimed.
