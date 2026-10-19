# EVOLVE foundation — Task #19.1

**Historical foundation design:** This document describes the initial candidate.
`EVOLVE_SCHEMA_ALIGNMENT_v0.1.md` supersedes its public-number attribution,
retention, history and own-support policies and records the aligned local SQL.
The earlier validation record remains historical evidence. The reviewed prototype
and existing application behavior are unchanged. Hosted application is not approved.

Status: local candidate for review; not connected, migrated, committed or deployed.
Baseline: v0.16.4.6, `6df0a190071400d99616ac552e7d8d3c3d234e6b`, Vercel Ready
at baseline inspection. Frozen Master Spec v0.8 and existing production services
remain unchanged. The approved #19.0 prototype remains synthetic and unchanged.

## Decisions and implementation

The owner approved administrator visibility review before publication and the
privacy-first deactivation/deletion policy. Everything below is modeled locally;
retention durations and production integration still require review.

Candidate: `supabase/candidates/202610210001_evolve.sql`. Kept outside the hosted
migration chain deliberately, following existing puzzle candidate conventions.
Before a future hosted application, reconcile migration identifiers, promote the
reviewed file into migrations, verify recovery and grants, and obtain approval.
Do not apply both candidate and promoted copy. No credential, extension, dependency,
public route, production navigation or scheduler is introduced.

Five private RLS-enabled tables:

| Table           | Purpose / relationship                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| evolve_settings | Singleton default-OFF gate; operator-only configuration                                                                                 |
| evolve_accounts | Internal Atom FK, last accepted submission, mutation revision, bounded request counter                                                  |
| evolve_ideas    | Opaque ID, internal author FK, 1–250-character plain text, optional public-number attribution, status, visibility, revision, timestamps |
| evolve_support  | Composite idea/Atom primary key; one equal support; withdrawal physically deletes it                                                    |
| evolve_history  | Idea FK, private administrator FK, previous/new status and visibility, explanation, time                                                |

No duplicated profile/email fields, supporter list, person ranking, public support
total or automatic popularity ordering. Administrators can inspect current counts.
Current authenticated supporters and authors privately qualify for optional LIVE
acknowledgment; withdrawing support removes support-based eligibility. Preference
presentation remains in the existing prototype, not a new notification system.

## Authorization and transaction boundaries

Only `public.evolve_request(text,jsonb)` is granted to authenticated sessions.
Every call takes the existing lifecycle lock, then the EVOLVE transaction lock,
resolves `private.account_owner()` (verified email plus live session and lifecycle
epoch), explicitly requires ACTIVE, and checks the default-OFF gate. DORMANT is
not eligible even where older shared helpers permit it. No client owner ID is
accepted. Administrator operations additionally call `require_signal_admin()`.
Tables and helpers have no public/anon/authenticated direct grants or permissive
RLS policies. SECURITY DEFINER functions use an empty search path and qualified
objects; the reviewed migration must run under the existing trusted migration
owner, never an application session. No service-role client is proposed.

Operations: list, submit, support (explicit desired boolean), admin_list, moderate,
history. The service-layer TypeScript contract is intentionally not a live adapter.
Lists/history use stable timestamp/UUID keyset cursors, at most 25 records; there
is no fixed total moderation-queue ceiling. Participant projections omit internal
Atom/auth identifiers, administrative actors and supporter identities. The idea
UUID is a resource identifier, never a credential. Attribution defaults OFF and,
when opted in, includes only the existing public Atom number of an ACTIVE author.

All successful participant writes require the current account mutation revision.
Concurrent or replayed stale writes fail with STALE_REVISION; clients must refresh
and let the participant confirm a new action, never silently retry a stale intent.
This also prevents replaying a pre-withdrawal support request to restore support.
Admin decisions use the idea revision. The database primary key independently
prevents duplicate weight. Administrative votes have exactly the same weight.
Authors may support their own idea once: unlike Doodle, no self-support ban was
requested, and this must be confirmed in the future product integration.

The 24-hour limit uses database time and a retained account timestamp independent
of idea moderation/cleanup. Exactly at the deadline a different valid idea is
accepted. Repeated same-author, case-insensitive trimmed content is rejected while
retained. No global quota. Cross-author semantic duplicate review stays human.

Thirty RPC requests per owner per rolling one-minute window limit reads and writes.
Rejected payload/permission/stale requests count: handled error envelopes preserve
the counter rather than rolling it back with the failed operation. This cannot
persist through a caller explicitly rolling back a SQL transaction; authenticated
clients receive only the HTTP RPC surface, not SQL connections. Future app routes
still need existing ingress protection, small request limits, session-bound calls,
same-origin mutation protection and no-store responses. Database throttling alone
cannot stop unauthenticated network floods. No hosted Firewall changes were made.

Short feature transactions serialize through the existing lifecycle-compatible
lock order. This is simple for an initial low-volume service but adds contention
with lifecycle-sensitive operations; load measurement is required before launch.
No network I/O occurs while holding the locks.

## Moderation and privacy

Submissions start PENDING and are visible only to their author and administrators.
Explicit admin review makes an idea VISIBLE. Any status decision requires a short
explanation; DEFERRED and DECLINED are not hidden automatically. Administrators
can hide or remove content immediately. Status transitions are reversible with an
explanation, not vote-triggered promises. There are no comments, links-as-actions,
discussions, public APIs or participant notifications in this foundation.

Render suggestions and explanations as escaped plain text, never HTML, markdown
or clickable URLs. Review for abuse, personal information, malicious links and
duplicates before visibility. No automated moderation accuracy claim is made.
Hide removes support; publishing again does not restore it. Removal deletes content,
author association, attribution and support immediately and redacts history text
and administrator references. The retained tombstone contains only idea ID,
statuses/visibility and decision times, for at most 30 days subject to cleanup.

DORMANT and DEACTIVATED hide authored ideas and delete both that participant's
support and support attached to their now-hidden ideas. Reactivation does not
republish ideas or restore support; visibility requires another administrator
review. Last-submission cooldown survives. DELETED immediately removes authored
content/attribution and support and deletes the EVOLVE account row. Existing Atom
lifecycle RPCs are not replaced: a scoped status trigger handles EVOLVE records.
Existing account-deletion timestamps, authentication and other features are intact.

## Proposed retention and cleanup — approval pending

- PENDING ideas not reviewed within 30 days: remove content and attribution.
- HIDDEN ideas: same 30-day deadline; re-review before the deadline may republish.
- VISIBLE ideas: retained while published; no automatic development expiration.
  Administrator stewardship must periodically remove obsolete ideas. Content is
  removed immediately on account deletion or an administrator removal decision.
- Decision history: at most 30 days. The latest public explanation stays attached
  to a published idea; private historical decisions are bounded.
- Removed tombstones: purge after 30 days; no personal identity or content retained.
- Active-owner cooldown/revision rows remain necessary to reject stale requests.
  Account deletion removes them. No indefinite withdrawn-vote history is kept.

`private.evolve_cleanup(limit)` handles at most 100 ideas plus 100 historical
decisions per call, using server time and the same transaction lock. It is
operator-only and idempotent. It never deletes published ideas. No Cron job is
registered in this task. Before production, approve the retention policy and
reuse existing database scheduling with run-health monitoring and backlog checks;
do not silently alter Doodle cleanup or Tuesday Weekly Growth schedules.
Cleanup eligibility is not a guaranteed wall-clock deletion deadline until that
execution path is approved and verified. Backups may retain removed data until
their normal expiry; restored databases must reapply deletion/lifecycle decisions
before serving data. No promise of immediate backup erasure is made.

## Review / rollout requirements

1. Approve the exact proposed v0.9 delta separately; do not edit frozen v0.8.
2. Confirm retention, own-idea support, explicit attribution and admin workload.
3. Review the candidate SQL and tests; verify hosted schema/grants/recovery before
   separately authorizing migration. Default gate remains OFF on application.
4. Implement the session-bound server adapter, existing ingress protections and
   paginated admin workflow only in a separately authorized integration stage.
5. Verify actual hosted authorization, lifecycle races, cleanup execution and
   operational monitoring before enabling participation. Local tests are not
   evidence of hosted configuration or physical-device integration.

Recovery: leave gate OFF or disable it with authorized operator action; remove
future routes if needed. Do not drop idea tables or rewind account lifecycle.
There are no required changes to existing production credentials or schedules.

## Validation

See `EVOLVE_FOUNDATION_VALIDATION_v0.1.md` for exact local commands/results and
changed-file inventory. Preview remains http://127.0.0.1:3140/review/evolve.
