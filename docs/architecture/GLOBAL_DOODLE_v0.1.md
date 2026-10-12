# Global Doodle — Task 12.1

Status: controlled production rollout. Master Spec v0.4 is approved; frozen v0.3
remains unchanged. The migration, Firewall rules and cleanup job are installed.
Public activation remains gated. See `GLOBAL_DOODLE_ROLLOUT_v0.1.md` for current
verification, temporary membership, deployment and acceptance status.

## Local preview

Run `node scripts/review-doodle.mjs`, then the existing Next development server on
port 3140. Open `http://127.0.0.1:3140/review/doodle/production`.
The approved original prototype remains unchanged at `/review/doodle`.

The review server binds only to 127.0.0.1:3141 and creates a disposable PGlite database
with synthetic Auth/Atom records. The same-origin, size-bounded development proxy
uses only that fixed loopback destination. Both review pages and proxy are unavailable
in production builds. No real credentials or participant identities are loaded.
Synthetic session, clock, reset and cleanup controls must never become production APIs.

Preview walkthrough:

1. Participant 1: draw, PREVIEW, SEND. The drawing immediately joins LIVE DRAWINGS.
2. APPRECIATE another drawing; a repeat cannot add a vote and self-voting is blocked.
3. Expand REPORT DRAWING and choose a predefined category. The drawing stays public.
4. Switch the synthetic session to Administrator, MODERATION REVIEW, Reported drawings.
   Inspect the bitmap/replay and REMOVE DRAWING. It disappears from feed/replay reads.
5. PAUSE NEW SUBMISSIONS blocks only new intake. Existing live drawings and voting
   remain available. RESUME SUBMISSIONS restores normal validated submissions.
6. +60 MIN demonstrates exact expiry. No expired drawing remains in live retrieval.
7. The seeded eight-vote drawing qualifies privately; review every replay point,
   acknowledge review and APPROVE HALL PROMOTION. It atomically replaces a lower score
   in the seeded ten-entry gallery. No automatic promotion occurs.
8. RUN CLEANUP removes eligible expired/removed payloads. RESET FIXTURES restores
   only the local demonstration data.

## Authority and database boundary

Implemented, default-off production path: UI → application service → existing authenticated Supabase
session → `public.doodle_request(text,jsonb)`. No privileged server credential.
Ordinary operations derive verified ownership and require ACTIVE lifecycle. Every
admin operation independently invokes the existing private Signal administrator
membership check; public Atom numbers never prove authorization.

`supabase/migrations/202610120001_global_doodle.sql` was applied after approval.
It creates nine private RLS tables: settings, expiring rollout membership, account controls, drawings,
appreciations, Hall slots, reports, request counters and moderation decisions. It adds
Doodle functions and one narrowly scoped lifecycle cleanup trigger. Existing rows and
migrations are not rewritten. SECURITY DEFINER functions have controlled empty search
paths and explicit revocations. Only the gateway is executable by authenticated clients;
underlying operations and direct tables are unavailable to anonymous/authenticated,
service and growth roles. Cleanup remains a trusted database operation.

The gateway uses an explicit operation whitelist, not caller-controlled SQL. Inputs,
outputs and error envelopes are bounded. It holds the existing lifecycle lock before
the Doodle lock. The synthetic clock override exists only in the test fixture.
Production adapters must check the returned error envelope even on HTTP 200.

## Immediate publication, cooldown and throttling

DRAFT is local editor state. Authoritative states are PUBLISHED, EXPIRED, CANDIDATE,
HALL, REJECTED and REMOVED. There is no normal pending-review path or ordinary approval
operation. A valid submission publishes immediately with publication time and a deadline
exactly 24 hours later, both based on database time after locking and validation.

Multiple live drawings are permitted; one accepted submission every 60 minutes per Atom is
enforced. Removal does not reset cooldown. An identical request ID/payload returns its
prior result without a new drawing/deadline; altered content under that key is rejected.
Latest retry metadata survives payload cleanup; older retained drawings deduplicate too.
This is not an unlimited historical request ledger. Content is immutable after acceptance.

There is no global admission table, pending ceiling or daily submission quota.
The request gateway permits 120 requests including at most 30 mutations per owner per
fixed one-minute window. Accounting precedes a nested exception block, so malformed
business payloads and rejected operations consume quota without rolling the counter
back. Responses contain sanitized codes, never raw database exceptions or caller data.
Stale counters are pruned after 24 hours; deletion removes the owner's counters.

The production API adds the official Vercel Firewall SDK check before authentication,
body parsing and database access. Missing/failed rule checks fail closed. It enforces
same-origin JSON, a streamed 70 KB body limit, a five-second body timeout and generic
no-store responses. Database submission JSON remains capped at 64 KiB. The named
project Firewall rule must still be configured and verified before rollout. Direct
authenticated Supabase RPC traffic remains bounded by the database quota; application
Firewall limits do not replace that boundary. Neither layer eliminates distributed
multi-account abuse. This design does not claim Sybil resistance.
All Doodle requests currently share the lifecycle lock: acceptable for measured pilot
use, but lock contention requires monitoring before scale. No IP profiling is added.

## Payload and replay

A 64 × 64 occupancy bitmap is 512 bytes. Replay is at most 256 strokes / 8,192 points,
packed into at most 16,896 bytes; combined binary payload is at most 17,408 bytes (17 KiB).
Validation checks version, booleans, integer coordinates, bounds and exact final-bitmap
agreement. No file upload, SVG, remote URL or executable content is accepted.

The approved editor's bounded-history fallback submits the final bitmap with no replay.
It never submits a truncated partial replay. All submitted draw/erase points are
inspectable, including intermediate erased content, through playback and exact point
stepping. Content undone or dropped locally is not transmitted and cannot be inspected.
Static-only submissions are explicitly labeled. Moderators can inspect the complete
submitted replay both while live and during private Hall qualification review.

## Reactive moderation and reports

Authorized administrators have stable 25-record cursor pages for all reviewable, active,
reported, qualifying and Hall drawings. There is no total-record ceiling. Cursors use
(submission time, drawing ID), without OFFSET; concurrent changes are observed on the
next pass from page one. Refresh preserves the current page. The full replay loads only
when selected. Removal takes effect in every subsequent server feed/replay retrieval.
Downloaded content cannot be recalled; the UI refreshes on focus and once per visible
minute and clears an open replay if its drawing is no longer available.

Reports use ABUSE, PERSONAL_INFORMATION, SEXUAL or OTHER; there is no unbounded free text.
An ACTIVE participant can report each drawing once and make at most ten new reports per
hour. Duplicate reports do not add report count/quota; request throttling still applies.
Reports prioritize review and never auto-remove. Doodle posting restrictions can be set
or lifted by authorized admins, including by public Atom number after artwork cleanup.
That number identifies the target only; existing private admin membership authorizes it.
Restrictions do not revoke authentication or access to unrelated Atomic Bond features.

Removal/rejection/promotion/displacement, restrictions, pause/resume and threshold changes
produce private moderation decisions. History is paginated by ID, 25 records per page.
It contains action, time, optional drawing ID and public Atom number. The internal admin
Auth reference is never serialized and is cleared on Auth deletion; drawing references
are cleared when payloads are removed. No bitmap, replay, private email or profile is
copied into this log. Retention is at most 30 days; cleanup starts at day 29 to leave a one-day
operational recovery margin. History reads exclude records at day 30 independently. This is
an operational decision log, not an artwork archive or permanent preference history.

PAUSE NEW SUBMISSIONS and RESUME SUBMISSIONS are authorized database operations.
Pause blocks new submissions only; reads, votes, moderation, cleanup and idempotent
accepted retries remain safe. It does not extend lifetimes or affect Bonds, Pulse,
Network Signal, authentication, growth scheduling or account lifecycle behavior.

## Appreciation and Hall of Fame

Only authenticated ACTIVE participants may appreciate another ACTIVE author's currently
live drawing. The composite drawing/voter primary key prevents duplicate votes; no
self-voting or post-deadline voting. No dislike, comments, reposts or participant ranking.

Expiration freezes the authoritative unique-vote score. Qualification requires at least
five; admin threshold adjustments cannot go below five. Each drawing snapshots the
threshold at publication. Qualifiers become private CANDIDATE records for at most seven days
after their live deadline. They are absent from all participant feed/replay retrieval.
Explicit administrator approval is required for Hall promotion, with full replay review
and an immutable payload fingerprint. A checkbox cannot prove moderator diligence.

Hall contains at most ten entries. Promotion atomically checks lifecycle, restriction,
qualification and current slots. An empty slot may be filled; a full gallery requires a
strictly higher score than the lowest incumbent. Equal scores do not displace. Display
order: score descending, promotion time ascending, drawing ID ascending. Among equally
low incumbents, newest promotion is displaced first. Scores cannot be edited, and Hall
has no ongoing voting. Displaced content is immediately unavailable and queued for
cleanup. No automatic backfill or archive exists.

## Expiration, cleanup and Cron

Every participant read/replay/vote checks the server deadline even if cleanup is delayed.
Finalization handles at most 1,000 ended live windows plus 1,000 stale candidates per call.
Cleanup deletes at most 500 eligible non-Hall payloads. It never deletes unfinalized
PUBLISHED backlog before evaluating its score. Nonqualifiers are eligible at expiration;
qualifiers retain only the bounded private seven-day review exception. Removed/rejected/
displaced payloads are eligible immediately. Reports/votes cascade with payload deletion.
Current Hall artwork remains until replacement, moderation or author lifecycle removal.
Request-counter and moderation-log pruning are independently bounded at 500 per call.

A prior read-only hosted audit (2026-10-11) found pg_cron available but not installed.
On October 12 the approved `supabase/candidates/global_doodle_cron.sql` installed
`atomic-bond-doodle-cleanup`, every five minutes, `private.cleanup_doodles(500)`,
30-second statement timeout and two-second lock timeout. It prunes at most 1,000 of its
own completed run records older than seven days, never another job's records. Availability
alone does not prove execution: the first scheduled run was verified successful at
12:45 UTC on October 12. The Tuesday growth schedule remains unchanged.

Visibility expires at exactly 24 hours for new publications; physical deletion waits for bounded cleanup.
At five-minute intervals the nominal delete capacity is 6,000 payloads/hour and finalize
capacity 12,000/hour, before lock contention/timeouts. These are batch ceilings, not an
SLA. Monitor oldest backlog/run failures and tune batch/cadence under review if needed.
Backups and participant-downloaded copies are not immediately erased.

## Lifecycle, privacy and rendering

Deactivation/deletion remove all the author's live, qualifying and Hall artwork/replay;
reactivation restores none. Deactivation preserves cooldown/restrictions, while deletion
clears account controls. Votes legitimately cast before voter deactivation remain valid.
Deletion removes private voter links; open scores can decrease, but closed scores freeze
before links are removed. Lifecycle and Doodle operations use the same lock ordering.
No new submission or vote from an ineligible lifecycle is permitted.

Display attribution is public Atom number only. No private email, Auth ID, internal Atom
UUID, location, preferences or Pulse is serialized. No targeting, custom analytics,
notifications or new provider. Artwork itself may contain personal information: reporting
and rapid removal remain necessary. Minimal audit metadata is private and time-bounded.

Feed pages contain at most 20 final bitmaps, no replay; Hall is at most ten. Replay loads
on demand. Server deadlines drive local expiry between refreshes. No private payload is
stored in browser persistence or service-worker caches. Existing Canvas tools, theme
tokens, reduced-motion and keyboard/pointer/touch behavior are preserved. The default-off `GLOBAL_DOODLE_ENABLED` gate protects `/doodle`, `/admin/doodle`
and `/api/doodle`, plus Settings/Admin Hub links. The reviewed editor is shared with
the isolated local preview. Living Atom/Network Signal layout remains unchanged.

## Operating expectations and remaining gates

Immediate publication permits exposure before reactive moderation. Neither compact pixels
nor a one-hour lifetime guarantees safe content. No automated screening provider is
integrated; bitmap screening alone would miss intermediate frames and context. Operators
must review reports and active drawings, inspect replay, remove violations and restrict
repeat abuse. Name a responsible moderator and escalation/coverage procedure before launch.
Use the global pause when coverage or incident response is inadequate; there is no daily
quota or replacement admission cap. Hall review remains a separate deliberate decision.

Staff time depends on actual reports and Hall candidates. A planning estimate of 2–5
minutes per complete review is not a measured guarantee. Monitor report age, active
volume, candidate backlog, removal/restriction counts, throttling and cleanup duration.
Storage scales with accepted submissions, not a fixed quota: each 1,000 maximum-sized
payloads is about 16.6 MiB before rows, indexes, votes/reports and backups; ten Hall entries
use at most 170 KiB raw payload. Private qualifying retention may span seven days. Request,
compute and transfer costs depend on usage; no hosted load/cost guarantee is claimed.

Rollout checklist (completed and pending evidence is in the rollout document):

1. Approve the exact v0.4 delta and retention/tie/voter semantics; preserve frozen v0.3.
2. Approve a separate previewed migration/Cron rollout with trusted ownership/grants.
3. Configure and verify the named ingress Firewall rule. The implemented production
   service uses existing verified owner sessions, with no synthetic actor/clock authority.
   Keep no-store responses and current privacy/analytics exclusions.
4. Verify hosted RLS, real admin membership, cleanup installation/first run, emergency
   controls and isolated lifecycle acceptance before opening the real feed.
5. Establish reactive moderation coverage and incident response; measure operational
   backlog and pause intake when response capacity is inadequate.

No new privileged credential is required. Public activation needs separate approval.

## Local verification — 2026-10-12

- 328 unit/graph/integration/security tests passed across 44 files. Final candidate
  SQL rerun passed all 17 Doodle tests; the precise five-vote threshold boundary
  passed an additional nine-test database rerun.
- Native PostgreSQL Doodle concurrency/restart and the existing full database suite
  passed. Coverage includes same/different concurrent submissions, duplicate votes,
  atomic Top 10 replacement, lifecycle races, pause races, request quota races,
  expiration under locks, cleanup backlog and persistent retry protection.
- 216 unique browser cases passed: 111 main, 75 Auth/Bond/Pulse/Signal/lifecycle/PWA,
  three persistence, nine approved original-editor and 18 revised candidate cases.
  The final 18-case candidate rerun passed after administrator spacing refinement.
- Light/Dark screenshots and keyboard/touch/reduced-motion checks cover 390×844,
  768×1024 and 1440×900. Moderation pagination/history and Hall layouts were inspected
  without horizontal overflow or overlapping controls. These are browser simulations,
  not physical-device acceptance.
- Formatting, lint, TypeScript, production build, server-only negative build,
  configured-secret scan and Git whitespace checks passed. Production browser tests
  verify the isolated review pages/API remain unavailable.
- One native restart process failure passed an isolated rerun. The long browser run
  had multi-hour timing gaps, fixture connection resets and timeout failures; 12 main
  and four Auth cases passed unchanged in single-worker reruns. No unrelated source
  or assertion was changed to obtain passing results.
- A 50-read synthetic PGlite sample measured median 16.37 ms / p95 27.68 ms during
  local test activity. Two live drawings plus ten Hall entries transferred 10,900
  JSON bytes without replay; twelve fixture payloads used 10,972 bytes. This is not
  a hosted throughput or cost guarantee.
- Frozen v0.3, existing migrations, production configuration and package version remain
  unchanged. No hosted mutation, new credential, commit or deployment occurred.

Local revised-rule verification is complete. Final v0.4 approval, hosted migration/
Cron approval, hosted ingress verification and live operational acceptance
remain separate gates. No production-readiness claim substitutes for those checks.

## Controlled production readiness follow-up

See `GLOBAL_DOODLE_ROLLOUT_v0.1.md` for the exact staged migration inventory,
retention deadlines, read-only hosted Cron findings, ingress configuration, rollout
and recovery. The earlier verification record above is historical; final follow-up
results are recorded in that rollout document. The owner subsequently approved
the staged disabled rollout and Master Spec v0.4. Public activation still requires
separate approval.

## Task #12.2 publication

v0.12.2 supersedes the original one-live-drawing/one-hour lifetime design for new submissions. Existing deadlines remain unchanged. See `GLOBAL_DOODLE_TASK_12_2.md` for main-page feed, editor, pagination, static ordinary display, retained moderator replay, migration and verification details. Earlier verification records remain historical.
