# Task #21.1 — Direct Bond Requests local review

Status: LOCAL REVIEW ONLY. No commit, hosted migration, deployment, production configuration change or specification freeze.

## Baseline

Repository HEAD and remote main: `0c2e01238e5dc4ceecc6f1978d3b2c69a3340469`, package v0.20.1. Vercel production overview was inspected read-only on October 25, 2026: Ready, same commit. Frozen v0.10 and all earlier specifications are untouched. The two #21.0 proposal files were already untracked at the start; no unrelated work was present.

## Preview

`http://127.0.0.1:3140/review/direct-bonds`

Run `node scripts/review-direct-bonds.mjs` alongside the local Next development server. The fixture binds only 127.0.0.1:54341, contains synthetic verified owners, and never reads hosted credentials. Data persists across page reloads for the lifetime of the fixture process; restarting deliberately resets it. In the production build, the review page renders Next.js not-found content with noindex and no review UI (the streamed response has HTTP 200); its operation endpoint returns HTTP 404. The proxy checks development mode and same-origin localhost requests.

Select synthetic owner 1 (public Atom #2), select Atom #3 using the accessible Atom selector, and request a Bond. Switch to owner 2 (public Atom #3). NOT NOW dismisses without acceptance; BOND REQUESTS reopens it. ACCEPT BOND updates the real local graph. Sender cancellation and recipient Settings opt-out use the same components and RPC as the candidate application integration. Owner 0 is the synthetic bridge. No production participant is used.

## Architecture and policy mapping

- Private request rows store recipient-bound state, authoritative seven-day deadlines and notice claim. The authenticated gateway resolves `private.account_owner()` and explicitly requires ACTIVE status.
- Creation and acceptance revalidate existing ACTIVE-only `private.reachable`, endpoint eligibility, opt-in and canonical Bond uniqueness. Both run under the existing lifecycle advisory lock. No external invitation SQL, tokens, callback, session or acceptance code is changed.
- Five new requests per rolling 24 hours and ten outstanding outgoing requests. Independent short-lived sender-only send records preserve the daily allowance even when a recipient deletes their account. No incoming cap or extra per-pair daily restriction.
- Ordered pending-pair uniqueness; retries reuse the request without extending time or spending another allowance. Reciprocal requests never imply consent. One acceptance supersedes its reciprocal pending request.
- Only the recipient can accept/decline/dismiss; only the sender can cancel. NOT NOW marks seen without starting the decline cooldown. Decline starts thirty days. Opt-out in Settings cancels incoming requests; opt-in does not resurrect them.
- Non-ACTIVE endpoint transitions invalidate pending rows. Account deletion erases request, preference and sender-rate records applicable to that account. Confirmed Bonds are untouched. An inactive intermediary makes a request unavailable immediately through eligibility revalidation; it is not proactively rewritten.
- Every private table has RLS and no client table grants. Only the authenticated gateway is executable by participants. Responses contain opaque request IDs, public Atom numbers, expiry/creation times and permitted states, not private identity or contact fields.
- Separate application flag `DIRECT_BOND_REQUESTS_ENABLED` and private database setting both default OFF. Vercel ingress uses the proposed `atomic-bond-direct-requests` limiter and fails closed if unavailable. Database creation allowances apply even to direct authenticated RPC calls.
- UI services remain outside Living Atom; the renderer receives only an optional action slot. VIEW THEIR NETWORK remains. The inbox has keyset pagination, no new primary navigation section, and a server-claimed one-time automatic notice. Interrupted notice display can suppress a popup but cannot lose the pending list entry.

## Cleanup and monitoring

`private.direct_bond_cleanup(100)` expires and purges bounded batches using database time. Expiration/authorization never depends on cleanup. Closed request rows expire after thirty days; sender-rate rows after 24 hours. Live pending requests/preferences remain as required. Account deletion applies immediately.

`select * from private.direct_bond_cleanup_status;` is an operator-only health query showing last success, last failure, SQLSTATE only, expired count and removed request count. A failed cleanup rolls back its work, records redacted failure status and returns `ok:false`; retry is safe. Monitoring must inspect that result/status, not merely cron job completion. No hosted job has been created.

## Verification

- Initial applicable regression run: 120 tests across 19 files passed (database, external 24-hour invitations, QR/first-Bond/preferences and security).
- Final candidate database tests: 13 passed, including missing/revoked session, disabled gate, recipient isolation, exact expiry, decline deadline, limits, deletion, RLS, cleanup failure/retry and existing external invitations.
- New server-action boundary tests: 3 passed (gate, origin, ACTIVE ownership, authenticated RPC, neutral errors and fail-closed ingress).
- Native PostgreSQL: simultaneous duplicate creation, recipient acceptance/replay, sender limits, cancellation/acceptance, reciprocal/external acceptance, real account-deactivation/acceptance races and concurrent cleanup passed.
- Synthetic browser: send/pending, NOT NOW, reload/reopen, explicit acceptance and graph refresh, direct-Bond exclusion and opt-out passed with zero browser page errors. Sender and recipient screenshots cover all three target viewports in both themes.
- Production build and TypeScript passed. Client-boundary security check and secret scan passed; scan reported no repository or browser secret leak.
- Final lint, formatting and diff whitespace checks passed. Authenticated ownership, QR, registration continuity and success-screen browser regressions: 71/72 passed across mobile/tablet/desktop (5.7 minutes). The tablet slow-verification test passed verification and invitation restoration but timed out at its final NOT NOW → /explore assertion (line 143). Three unchanged isolated repetitions passed (10 seconds total). The cause remains uncertain; no authentication implementation or test assertion was changed. Preserve this intermittent failure as a separate publication-readiness issue, not an all-green suite claim.

## Proposed production sequence — requires separate approval

1. Reverify production commit, migration synchronization, recovery arrangements and schema compatibility; retain privacy-safe pre-change counts. Resolve any conflicting candidate ID.
2. Review/promote candidate `202610250001_direct_bond_requests.sql`, with the existing bounded transaction timeouts. Apply only after authorization. Database gate remains OFF; this adds private objects and one lifecycle trigger, and does not rewrite existing Bonds or invitations.
3. Deploy approved application with `DIRECT_BOND_REQUESTS_ENABLED=false`. Verify real hosted session resolution, RLS/grants, ACTIVE reachability and non-destructive denials. Synthetic sessions are not proof of hosted Auth compatibility.
4. Configure the dedicated Vercel limiter (proposed 60 requests/minute/IP, independently approved operational threshold) and a separate existing-pg_cron cleanup job every five minutes. Verify actual execution, failure health query, bounded backlog and unchanged unrelated schedules. No new credential or external scheduler is needed.
5. Obtain activation approval, then enable the database setting and application flag. Run controlled acceptance with explicitly approved disposable owners; never create genuine participant Bonds automatically. Freeze v0.11 only when separately authorized.

The Vercel limiter threshold is an operational proposal, not an additional implemented product restriction. It requires hosted configuration verification before activation.

Recovery: disable the database gate first, then the application flag. Retain tables, confirmed Bonds, preferences and request history; continue privacy cleanup. Do not destructively roll back the schema or delete participant Bonds. An application revert does not require changing authentication, external invitations or existing data.

## Limitations and review decisions

Physical iPhone/Safari and installed-PWA testing are pending. Local Chromium viewports are not physical-device evidence. Hosted Auth, ingress configuration, scheduled cleanup and publication are intentionally unverified here. Existing graph traversal fails closed above its established 5,000-Atom bound; this task does not broaden graph semantics. The shared lifecycle lock favors correctness over parallel throughput; load testing at production scale remains a launch consideration. A failed post-acceptance graph refresh cannot undo a confirmed Bond; refreshing MY ATOM safely retrieves it, and repeated acceptance cannot create another Bond.

The exact proposed v0.11 amendment is in `MASTER_SPEC_v0.11_DIRECT_BOND_REQUESTS.md`. It is not frozen.

## Exact changed-file inventory

- `docs/proposals/DIRECT_BOND_REQUESTS_LOCAL_REVIEW.md`
- `docs/proposals/DIRECT_BOND_REQUESTS_v0.1.md`
- `docs/proposals/MASTER_SPEC_v0.11_DIRECT_BOND_REQUESTS.md`
- `scripts/review-direct-bonds.mjs`
- `scripts/test-direct-bond-browser.mjs`
- `scripts/test-direct-bond-concurrency.mjs`
- `src/app/owner/page.tsx`
- `src/app/review/direct-bonds/operation/route.ts`
- `src/app/review/direct-bonds/page.tsx`
- `src/app/review/direct-bonds/view.tsx`
- `src/components/auth/NetworkPage.tsx`
- `src/components/auth/OwnerExperience.tsx`
- `src/components/auth/OwnerSettings.tsx`
- `src/components/direct-bonds/direct-bonds.css`
- `src/components/direct-bonds/DirectRequests.tsx`
- `src/living-atom/interaction/AtomContextPanel.tsx`
- `src/living-atom/LivingAtom.tsx`
- `src/services/direct-bonds/actions.ts`
- `src/services/direct-bonds/types.ts`
- `supabase/candidates/202610250001_direct_bond_requests.sql`
- `tests/helpers/direct-bond-fixture.mjs`
- `tests/integration/direct-bond-requests.test.ts`
- `tests/security/direct-bond-actions.test.ts`

## Visual evidence

Screenshots are under `artifacts/task211/`: `mobile-light-sender.png`, `mobile-dark-sender.png`, `tablet-light-sender.png`, `tablet-dark-sender.png`, `desktop-light-sender.png`, `desktop-dark-sender.png`, plus the same six viewport/theme names ending `-recipient.png`. The browser checks use keyboard-accessible native selects and buttons; dialogs use native modal focus management. Physical touch/Safari acceptance remains pending.

Review disposition: local feature acceptance passed; not approved for production activation. Read-only hosted catalog verification is recorded below; hosted execution of the new gateway remains pending. The intermittent NOT NOW failure remains unresolved evidence, not an all-green authenticated-suite claim.

## Final acceptance review — October 25, 2026

### Tablet NOT NOW investigation

The original `registration-invitation.spec.ts:143` failure retained an error-context snapshot but no Playwright trace, console log or request timeline. Verification and invitation restoration had passed; the final snapshot remained on `/auth/register/invitation` with ACCEPT BOND and NOT NOW enabled and no displayed error. This establishes that navigation did not meet the five-second assertion, but does not establish whether the click was lost, processing was delayed, or navigation failed.

The unchanged tablet verification-navigation tests were repeated ten times each with tracing: **20/20 passed**, including ten repetitions of the affected slow-verification/NOT NOW case. All ten dismissal POSTs returned HTTP 200 (15.5–86.7 ms), and the existing destination assertions passed. Traces also include successful `/explore` responses and some incomplete/cancelled request entries; those are not evidence that the original failure was harmless. Authentication source and assertions were left unchanged. The direct-request gate is OFF in this existing authenticated fixture. No reproducible functional defect was established, and no speculative authentication correction was made. Residual intermittent uncertainty remains; retain tracing on the next complete authenticated acceptance run.

Evidence: `artifacts/task211/auth-results/.../error-context.md` and `artifacts/task211/final-timeout-traces/`. These ignored local artifacts may contain synthetic test credentials and must not be published as public diagnostic logs.

### Final focused results

- Candidate database and server-action tests rerun: **16/16 passed**. Coverage includes unique pending creation, exact recipient binding, single acceptance, notification claim/dismissal, decline and thirty-day retry boundary, cancellation, opt-out, seven-day expiration without cleanup, inactive bridges, lifecycle erasure, RLS, cleanup failure/retry and external invitation preservation.
- Native PostgreSQL concurrency rerun: **passed** duplicate creation, double acceptance, sender limits, cancellation/acceptance, reciprocal/external acceptance, account-lifecycle races and concurrent cleanup. The sandbox initially prevented PostgreSQL subprocess creation; the authorized isolated local rerun completed successfully.
- Existing synthetic browser acceptance and twelve viewport/theme screenshots remain applicable because no UI code changed during final review. They cover the visible sender action, pending state, recipient notice, NOT NOW across reload, reopening, explicit acceptance, graph refresh and opt-out at 390×844, 768×1024 and 1440×900. Install invitation is deferred while the request dialog is open; external Bond confirmation suppresses automatic request presentation. No new navigation item was introduced.
- Reused the previously passing build, TypeScript, lint, formatting, client-boundary and secret checks; this review changes only this report. Existing CI requirements remain unchanged. The earlier 71/72 authenticated run is not superseded by a claimed full-suite pass.

### Read-only hosted compatibility preflight

A bounded read-only SQL transaction inspected catalogs, migration identifiers and cron metadata; no participant rows, credentials or invitation data were retrieved. All **32 hosted migration identifiers exactly match** the repository, ending `202610220001`. No `private.direct_bond_%` relations exist. The expected `private.account_owner()`, `private.reachable(uuid)` and `private.lifecycle_lock()` dependencies exist with their established security-definer/search-path configuration. Hosted canonical Bond-pair uniqueness, ordered endpoints, confirmation-state constraint and invitation uniqueness are present. Existing Doodle, Puzzle, EVOLVE and growth-preference lifecycle triggers remain present; all three existing database cleanup jobs remain active on their five-minute schedules.

The candidate adds five private RLS tables (`direct_bond_settings`, `direct_bond_requests`, `direct_bond_preferences`, `direct_bond_sends`, `direct_bond_cleanup_status`), the authenticated `public.direct_bond_request(text,jsonb)` gateway, private time/eligibility/lifecycle/cleanup helpers, indexes and one additive Atom lifecycle trigger. It grants no direct participant table access and adds no permissive table policy. Existing Bond/invitation rows and external invitation functions are not rewritten. The migration stays in `supabase/candidates/`; it was not applied.

This supports catalog compatibility, not complete hosted acceptance. Before publication, recheck collisions and synchronization, verify backup/recovery readiness, then test the deployed gateway against actual Supabase Auth sessions with gates OFF. Real hosted owner mapping, ingress limiter configuration, actual scheduled cleanup execution and approved controlled acceptance remain activation gates. The separate cleanup job must leave existing schedules unchanged.

### Specification, inventory and recovery

The exact EVOLVE-independent v0.11 proposal above remains the final proposed amendment: Sections 12 and 31 clarification, new Section 31A, and necessary future version metadata only. Frozen v0.10 is unchanged. The exact 23-file inventory above is unchanged; this acceptance pass modifies only this report and ignored diagnostic artifacts.

Publication sequence remains candidate review → authorized migration with database gate OFF → application deployment with application gate OFF → hosted Auth/RLS/ingress/cleanup verification → separately approved activation. On failure, keep or return both gates OFF while preserving new private records, confirmed Bonds and cleanup; do not destructively revert the schema. Physical iPhone/Safari/PWA acceptance remains pending. No commit, deployment, hosted migration or specification freeze was performed.

## Task #21.2 publication preflight — stopped October 25, 2026

Production publication was authorized conditionally, with an explicit stop if any security-critical prerequisite was missing. The following read-only checks were completed:

- Vercel production remains Ready on `0c2e01238e5dc4ceecc6f1978d3b2c69a3340469`, v0.20.1.
- Local HEAD and cached origin/main match that commit. A fresh remote lookup was blocked by the shell's network access; fresh remote synchronization is not claimed.
- The working tree contains exactly the 23 approved paths. Frozen v0.10 has no diff.
- All 32 hosted migration identifiers still match. No new direct-request relations exist. Ownership, reachability and lifecycle-lock definition hashes match the prior preflight. All three existing database cleanup jobs remain active every five minutes.
- Supabase lists a physical backup dated October 25, 2026, 12:27:30 UTC and preceding daily backups. No restore was attempted; this is availability evidence, not a zero-loss recovery guarantee.
- Vercel lists five active custom rules: Doodle SDK and endpoint protection, Puzzle SDK and endpoint protection, and EVOLVE SDK protection. The required dedicated `atomic-bond-direct-requests` SDK limiter is absent. Existing rules must not be repurposed or weakened.

**Blocking prerequisite:** the approved server action calls `checkRateLimit("atomic-bond-direct-requests")` and fails closed when that limiter is unavailable. The proposed dedicated 60-requests-per-minute/IP configuration must be provisioned and verified before resuming publication. The database's five-send daily allowance does not replace endpoint ingress protection.

Stopped at this gate as instructed. No commit, push, specification freeze, migration, scheduled job, activation flag or production rule was changed. Consequently there is no new deployment, Foundation run or publication secret scan to report. New hosted RPC authorization and cleanup execution remain unperformed. The intermittent tablet NOT NOW uncertainty and pending physical-device acceptance remain unchanged.
