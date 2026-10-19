# Task #19.2 — EVOLVE local integration review

Status: LOCAL REVIEW ONLY. No commit, hosted migration, deployment, production job, secret change or specification freeze.

## Baseline

Repository HEAD and origin/main: `6df0a190071400d99616ac552e7d8d3c3d234e6b`, v0.16.4.6. Vercel production overview independently showed the same commit, Ready. Frozen Master Spec v0.8 has no diff. Existing tracked production files remain unchanged; EVOLVE work is still untracked, including the earlier #19.0/#19.1 foundation.

## Preview and demonstration

Open http://127.0.0.1:3140/review/evolve. The running fixture uses `artifacts/evolve-local-db/data` and retains a synthetic participant-a idea across database-server restarts. Choose participant-a, participant-b or administrator in LOCAL TEST SESSION. These are disposable fixture identities, never production accounts.

Start fixture: `node scripts/evolve-local-server.mjs`.
Start the existing Next development server on 3140 if needed. No production environment values are used by the EVOLVE adapter; its upstream is hardcoded loopback port 54339.

For repeatable browser acceptance, start the fixture with a **new** safe directory name: `node scripts/evolve-local-server.mjs evolve-test-<unique-name>`. Only one fixture may bind port 54339. Run `playwright test --config tests/review/evolve.config.ts`. Reusing an already-submitted fixture correctly preserves its 24-hour cooldown; tests must not reset it. The desktop-only final lifecycle test follows the viewport tests and withdraws their disposable idea. No security assertion is skipped; that lifecycle scenario runs once, while privacy/HTTP/layout checks run at all three sizes.

Participant sequence: submit -> acknowledgment/awaiting review -> reload -> switch participant and verify private absence. Administrator: LOCAL ADMIN VIEW -> choose visibility/status, add explanation -> SAVE DECISION. Participant: support/withdraw support -> reload. Author: WITHDRAW IDEA (confirmation). Administrator history is private. Independent development history requires newly authored factual text and an explicit privacy-review checkbox; suggestion text is never copied automatically.

## Effective boundary and limitations

This is a Supabase JavaScript client connected to a local Auth/PostgREST-compatible fixture, **not a full running Supabase GoTrue/PostgREST deployment**. The fixture uses disk-backed PGlite and the existing real migration SQL, RLS, account-owner validation and EVOLVE RPC. Native PostgreSQL independently verifies concurrent operations. Hosted protocol and actual passwordless-session integration remain unverified and require a later controlled checkpoint.

The local fixture alone issues synthetic sessions. Random 256-bit credentials are stored hashed in the fixture and carried in a dedicated HttpOnly, SameSite=Strict, /review/evolve-scoped cookie. Eight-hour expiry and auth.sessions membership are checked upstream. The Next adapter verifies the user before each RPC; SQL independently verifies ACTIVE ownership, gate, administrator membership, revisions, cooldown and rate limits. No client-supplied owner/admin identity reaches SQL authorization. Synthetic session selection is intentionally a development test facility, not a production login mechanism.

Page and API reject production/VERCEL execution. API requires loopback Host, exact same Origin and POST. Reads use no-store; no idea persistence in browser storage. Visible pages refresh every 30 seconds and on pageshow/visibility restoration. Generation checks prevent stale refresh/pagination responses replacing newer state. Removed content cannot be fetched again; already downloaded pixels/text cannot be remotely erased, and another open page can display old content until its next refresh.

Idea-level support totals are now participant-visible because Task #19.2 explicitly requests support counts. Voter identities remain private. The proposed v0.9 text reflects this; frozen v0.8 is untouched.

## Verification

- SQL foundation: 7 passing tests, including verified ACTIVE authorization, RLS, private helper denial, cooldown boundary, revision replay, private pending visibility, support uniqueness/counts, moderation, lifecycle and pagination.
- SQL governance: 7 passing tests, including every withdrawal stage, immediate support invalidation, 90-day content removal, shorter privacy precedence, deletion/moderation erasure, no resurrection, independent history and 30-day audit expiry.
- Added cleanup failure test: injected trigger failure rolls back deletion; expired content remains unavailable; removing the injected fault allows retry; repeated cleanup returns zero.
- Native PostgreSQL concurrency passed: 8-way submissions/support, competing withdrawal, four supporters versus author withdrawal, deletion/withdrawal/cleanup, lifecycle races and stale moderation.
- Browser: six participant/HTTP checks passed across 390x844, 768x1024 and 1440x900, plus one desktop LIVE/history/author-withdrawal scenario passed. Themes have no horizontal overflow. Reload preserves submission/support and cooldown. Pending content is absent for another owner. Non-admin admin_list is FORBIDDEN; missing session 401; cross-origin 404; no-store verified.
- Separate restart smoke test confirmed the original persistent idea survives fixture shutdown/restart.
- Final production build/TypeScript, scoped ESLint/Prettier and client-boundary checks passed. Final secret scan: 652 repository files and 54 browser bundles, no flagged paths. Production-build isolation: API returns 404; the page renders not-found with no local session controls (Next streamed not-found returns HTTP 200).
- Earlier failures were a stale support-count expectation, a multi-statement fixture setup using the single-query API, and label selectors that included nested control text. These were corrected without removing privacy assertions. Shell sandbox initially blocked scanner child processes; authorized reruns passed.

Screenshots: artifacts/evolve-final-mobile-light.png, evolve-final-mobile-dark.png, evolve-admin-mobile.png; tablet/desktop light/dark captures use artifacts/evolve-{tablet|desktop}-{light|dark}.png.

## Local cleanup operation

The fixture runs private.evolve_cleanup(100) at startup and every 60 seconds, with a non-overlap guard. Results and failures are stored in private.evolve_local_cleanup. This test-only table is not part of the migration. Five actual worker runs succeeded in the isolated acceptance database; zero records were due. Controlled-time SQL tests separately verified actual expired-content/audit deletion and failure recovery.

Operational query (local operator connection; stop the fixture before opening its PGlite files from another process):

```sql
select max(at) filter(where succeeded) last_success,
       max(at) filter(where not succeeded) last_failure,
       sum(removed) removed,
       max(at) > clock_timestamp()-interval '2 minutes' recent_execution
from private.evolve_local_cleanup;
```

Retry is automatic on the next tick or restart. Failure reasons are intentionally not persisted with content/identities. A complete database outage also prevents logging; absence of recent success signals unhealthy execution. Worker reports count idea records, not audit rows. A hosted cleanup cadence, backlog monitoring, bounded-run capacity and physical-retention operational deadline still need approval and implementation. No hosted Cron job was created or modified.

## Exact Task #19.2 changed-file inventory

New:

- scripts/evolve-local-server.mjs
- src/services/evolve/server.ts
- src/app/review/evolve/api/route.ts
- docs/proposals/EVOLVE_LOCAL_INTEGRATION_v0.1.md

Updated existing uncommitted EVOLVE files:

- src/app/review/evolve/page.tsx
- src/app/review/evolve/view.tsx
- src/app/review/evolve/view.module.css
- src/services/evolve/contracts.ts
- supabase/candidates/202610210001_evolve.sql
- tests/integration/evolve-foundation.test.ts
- tests/integration/evolve-governance.test.ts
- tests/review/evolve.spec.ts
- docs/proposals/MASTER_SPEC_v0.9_EVOLVE.md

No existing authentication, Bond, Doodle, Puzzle, PWA, CI, production navigation or frozen specification files changed.

## Proposed hosted sequence — not executed

1. Product review this local integration and updated support-total presentation; approve exact specification separately.
2. Audit current hosted migration synchronization, recoverability and grants. Promote reviewed candidate to a version-controlled migration only with approval. Keep its gate OFF.
3. Replace local-only fixture adapter with the established production verified-owner client; never ship fixture-session issuance as production authentication. Verify actual Supabase Auth/RPC compatibility in controlled acceptance.
4. Approve bounded cleanup integration into existing database scheduling, health reporting and retention/backlog guarantees. Preserve other jobs.
5. Apply approved additive migration, inspect actual grants/RLS and gate OFF, deploy disabled integration, run authorized disposable acceptance. No new broad credential is needed by the request adapter.
6. Approve production navigation, administrator entry point, operational readiness and v0.9 freeze separately. Enable only after explicit publication/activation authorization.

Recovery: disable EVOLVE participation and roll back its application entry point while preserving production records; do not drop retained user data or reverse unrelated migrations. Local fixture directories are isolated and disposable but should be preserved during review when testing persistence.
