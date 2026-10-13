# Seven-day Global Doodle — Task #12.4

Status: v0.12.4 publication approved on October 12, 2026, based on v0.12.3 (`c3ae52f`). The exact Section 48A amendment is applied; v0.3 is preserved.

## Implementation and migration preview

Migration: `supabase/migrations/202610130001_doodle_seven_day_lifetime.sql`.
One transaction replaces only `public.submit_doodle(uuid,jsonb)`, retaining its
owner, SECURITY DEFINER boundary, empty search_path and existing grants. The only
function-body difference is two `24 hours` intervals becoming `168 hours` for
new `expires_at` and initial `purge_at` values. There are no existing-row updates,
tables, policies, triggers, roles, credentials or Cron changes.

The authoritative timestamp is captured after payload validation under the
existing lifecycle lock. Both feed scopes, displayed-row revalidation and voting
already require `expires_at > database time`. At the exact deadline, public
retrieval and appreciation stop even if cleanup has not run. Idempotent retries
return the original record and deadline; they do not extend legacy drawings.

Finalization counts accepted appreciations and freezes the score. Qualifying
drawings remain private until explicit administrator promotion, with a review
deadline of **stored expiration + seven days**, not cleanup time + seven days.
Cleanup excludes live PUBLISHED content and current HALL entries, finalizes ended
publications before purging, and removes expired candidates. Existing ordinary
24-hour cleanup and removed/rejected-content cleanup policies remain unchanged.

The feed heading gains “Draw something. Make someone's day.” using existing theme
colors and readable text. Existing feed-control layout, pagination, refresh,
navigation and editor tools are unchanged. Editor lifetime copy says seven days.

## Local verification and preview

The explicit seven-day fixture option selects the seven-day migration in isolated
synthetic PostgreSQL/PGlite databases. Historical one-hour and 24-hour regression
fixtures remain available. The current network review server uses the seven-day
migration and seeds its Hall with the corresponding controlled clock.

Preview: `/review/doodle/network?feed=1` on the local development server.
The release adds tests for unchanged legacy deadlines/ACLs, 168-hour new
deadlines, exact hourly cooldown, multiple live drawings, expiry in both feed
scopes, last-second appreciation, duplicate/self-vote denial, frozen scores,
candidate retention, late cleanup, Hall retention and lifecycle removal.
Native concurrency tests can run with `DOODLE_REVIEW_NEXT=true`,
`DOODLE_NETWORK_REVIEW=true`, and `DOODLE_SEVEN_DAY_REVIEW=true`.

## Approval and rollout

The exact amendment in `docs/proposals/TASK_12_4_SPEC_AMENDMENT.md` is approved.
The reviewed SQL is in the migration chain. Publication uses linked migration
preview, capture of existing deadlines, application of the function-only change,
and confirmation that existing deadlines remain unchanged before deploying the
matching copy. No timestamp backfill is included. The Doodle cleanup and Tuesday
growth-email schedules are unchanged.

Recovery: restore the preceding submission function to return future submissions
to 24 hours. Leave every already-published deadline intact unless separately
approved. Roll back the corresponding UI copy with the application if needed.

Seven-day visibility can retain roughly seven times as many live drawings as a
24-hour window at the same submission rate. Pages and browser memory remain
bounded; actual database volume, moderation workload and cleanup lag should
continue to be monitored. This task introduces no quota or moderation-policy change.

## Verification record

- 360 unit/integration/security tests passed, including six new seven-day cases.
- Native PostgreSQL concurrent submission/voting, atomic Top 10 replacement,
  cleanup, lifecycle race, expiration under lock and restart-persistent idempotency
  passed with the seven-day candidate.
- Formatting, lint, TypeScript, production build, privileged-client boundary and
  repository/browser-bundle secret scans passed.
- The migration was compared against the preceding submission function: only the
  two lifetime intervals differ. Historical migrations, frozen v0.3,
  production schedules and credentials remain unchanged.
- 54 Doodle browser regressions and three owner-session browser tests passed at
  390×844, 768×1024 and 1440×900. Owner-session SEND confirmed a 168-hour expiry
  and unchanged 60-minute cooldown.
- Browser verification includes Light/Dark contrast (at least 4.5:1), heading/tagline
  order, no overlap or horizontal page overflow, unchanged same-row controls with
  44-pixel targets, WORLD/MY NETWORK, global Hall and editor guidance.

Product review and the exact specification amendment are approved for publication.
Release verification applies the migration before deploying the matching UI copy.

Hosted migration `202610130001` applied on October 12, 2026 after a clean dry run. Before/after fingerprints confirmed all existing drawing deadlines, drawing count, Doodle settings, Cron definitions and submission-function ACL unchanged. Previous function definitions were captured locally for recovery. No backfill or schedule change was performed.
