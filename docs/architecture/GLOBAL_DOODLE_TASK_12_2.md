# Global Doodle Task #12.2 — local review candidate

Status: v0.12.2 publication authorized October 12, 2026. The approved function-only migration is applied; application publication follows verification.

## Behavior

Future accepted drawings expire after 24 hours. Each retains its own publication deadline, votes and reports. The existing 60-minute per-Atom submission cooldown remains authoritative; multiple live drawings are allowed. Existing production deadlines and scores are not rewritten. Hall eligibility, minimum five appreciations, frozen scores, explicit administrator approval, atomic Top 10 replacement, retention, removal and lifecycle cleanup remain unchanged.

The authenticated ACTIVE owner's Living Atom gains a static-bitmap global feed: right column at desktop width, below the graph/controls on smaller screens. It is not a personal-network feed. Public attribution is the existing Atom number only. The separate Hall tab retains frozen scores. The editor uses the canvas as preview; ordinary replay is removed while authorized administrator replay remains complete.

SEND uses an immutable request ID and payload for safe retries. An uncertain attempt preserves and locks that draft until retry resolves. Successful publication returns the database's next eligible time. The UI offers RETURN TO MY ATOM and a cooldown-disabled DRAW ANOTHER; opening a new editor never deletes previous drawings. Rejected attempts refresh the server's eligibility time rather than trusting the browser clock.

## Retrieval and resource bounds

Twenty drawings per cursor page; at most 100 live drawing records/canvases plus ten Hall entries retained. Older loading drops the distant head while preserving a visible anchor. A refresh at the head establishes a fresh contiguous cursor page. While reading older drawings, refresh revalidates retained IDs and offers SHOW NEW DRAWINGS without inserting above the reader. Choosing it returns to a fresh head/cursor.

Visible, foreground feeds refresh approximately every 30 seconds, backing off to five minutes after failures. Hidden/offscreen requests are aborted; unmount aborts and pagehide clears private feed state. Server deadlines drive local expiration without one-second network polling. Removed/expired/lifecycle-ineligible records are rejected on every authoritative retrieval; already-rendered content is removed on refresh, normally within 30 seconds while visible. No client can promise instantaneous removal of pixels already downloaded.

No localStorage, service-worker cache, offline artwork cache, telemetry or new credential is introduced. The existing authenticated POST boundary, same-origin enforcement, Vercel ingress protection, database attempt throttling, RLS and lifecycle locking remain intact.

## Candidate migration preview

`supabase/migrations/202610120002_doodle_24_hour_feed.sql` is the approved version-controlled migration.

- Replace `public.submit_doodle`: remove one-live-slot check; set new publication/purge deadlines to 24 hours; retain validation, locking, cooldown and idempotency.
- Replace `public.doodle_request`: add `publish_doodle` response metadata and bounded feed refresh arguments; retain all prior operation authorization and rate accounting.
- Add `private.doodle_feed(timestamptz, uuid, jsonb)`: cursor/visible-window validation, 20-entry retrieval, up to 100 revalidated IDs and own next-eligible time. Owned by postgres, empty search path, no caller-controlled SQL; all direct client/service/growth-role execution revoked.
- Replace `public.doodle_replay`: ordinary eligible read returns static bitmap without strokes. Administrator replay RPC is unchanged.
- No tables, columns, indexes, RLS policies, broad grants, extensions, credentials, Cron jobs or existing-row writes. Existing public function grants/ownership persist through CREATE OR REPLACE.

The five-minute cleanup and Tuesday growth-email schedule are unchanged. Cleanup already uses each record's deadline, so no hard-coded one-hour cleanup rewrite is required.

## Rollout and recovery after approval

1. Approve the exact Section 48A amendment in `docs/proposals/MASTER_SPEC_v0.4_TASK_12_2.md`; retain frozen files until that approval.
2. Review fresh production state/recovery readiness and migration diff. Move the approved candidate into the version-controlled migration chain, apply transactionally, and compare existing drawing/deadline/vote/Hall/report hashes.
3. Publish the matching application checkpoint, verify owner/admin authorization, static feed, editor and rate protections. Do not modify the growth scheduler.
4. Use a separately authorized participant for live publication. Verify 24-hour timestamp, 60-minute cooldown and later independent publication without manufacturing votes or changing deadlines.
5. If a release regression occurs, pause new Doodle submissions with the existing emergency control. Restore the previous application/functions through a reviewed compensating migration; retain accepted data and original deadlines. Do not bulk rewrite/delete drawings or undo unrelated product activity.

## Local evidence and limits

Isolated SQL tests cover multiple live drawings, 24-hour independent expiry, retained legacy deadlines, cooldown/idempotency, cursor retrieval, removal, ordinary replay exclusion, moderator replay and lifecycle cleanup. Native PostgreSQL tests cover concurrent sends, voting, Hall replacement, lifecycle races, cleanup and restart-persistent idempotency. Existing graph/Auth/Bond/Pulse/Signal/PWA/security suites are also exercised.

Measured on isolated PGlite with 200 live rows: 20-entry response 18,058 bytes; 30 reads median 15.39 ms, p95 40.39 ms. This is a local bounded-query measurement, not a production throughput/load guarantee. Replay is not included in feed payloads. The existing global lifecycle lock remains a scaling limit requiring measurement at larger production load.

Light/Dark browser review covers 390×844, 768×1024 and 1440×900. Physical installed-PWA and hosted acceptance are not claimed. Existing Task #12.1 unfinished live checks are not silently marked complete by this local work.

## Local preview

Run the existing Next development server on 3140 and `DOODLE_REVIEW_NEXT=true node scripts/review-doodle.mjs` for isolated synthetic SQL on 3143. Open `/review/doodle/network`. The fixture contains multiple drawings per synthetic participant, cursor pages and ten synthetic Hall entries. ADVANCE 60 MINUTES controls only this disposable database. `/review/doodle/network?draw=1` opens the revised editor. All review pages/APIs return unavailable in a production build.

## Verification record (local, October 12, 2026)

- Formatting, ESLint, TypeScript, production build and Git whitespace checks passed.
- 349 unit/integration/security tests passed across 48 files.
- 111 existing main-browser regressions passed; 75 Auth/PWA cases passed across the initial run and an unchanged isolated retry of the desktop Pulse screenshot timeout.
- Three owner-session Doodle browser cases passed (mobile/tablet/desktop); three persistence cases passed; final production review-route isolation passed.
- Six Light/Dark feed-layout cases passed. New browser tests passed for SEND, return, failure preservation, identical retry, cooldown unlock/reset, automatic refresh, removal revalidation, reading-anchor preservation, pagination and the 100-item bound.
- Native PostgreSQL existing concurrency/restart suite and revised Doodle concurrency/restart suite passed. Two initial Doodle native restart attempts failed to start the local process; the isolated diagnostic rerun passed. No production database was involved.
- Server-only client-boundary negative build passed. Repository and browser-bundle scan found no configured secret/test-inbox leakage and no accidentally included generated artifacts.
- Frozen v0.3/v0.4, hosted migration chain, Vercel configuration and production schedules have no changes in this working diff.

Publication approved after local review. Section 48A is amended exactly as reviewed; frozen v0.3 is unchanged. Hosted live publication/24-hour expiry acceptance and physical-PWA testing are not claimed by deployment alone.

## Publication checkpoint

On October 12, 2026 the user authorized commit/publication. Hosted migration 202610120002 applied successfully. Fresh before/after hashes matched for Atoms, Bonds, identities, preferences, growth state/deliveries, Pulses, invitations, administrator membership, Signals, ledger/sequence and Doodle records/votes/Hall/settings. There were zero retained drawings immediately before migration; no synthetic production drawing was created. Cleanup remains enabled every five minutes with its latest run successful; public intake remains enabled and unpaused. Tuesday growth scheduling is unchanged.

Recovery readiness: Supabase listed the completed October 12 12:31:24 UTC physical backup. Current function definitions were captured privately before replacement; no restore was performed. Daily backups are not point-in-time recovery.
