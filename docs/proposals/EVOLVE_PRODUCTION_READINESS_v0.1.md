# EVOLVE production readiness — Task #19.3

Status: hosted migration and cleanup verified; application publication in progress.

## Verified preflight

- Repository and remote baseline: v0.16.4.6, `6df0a190071400d99616ac552e7d8d3c3d234e6b`.
- Production deployment was Ready at the same baseline.
- Hosted migration history synchronized through `202610200001` (30 migrations).
- Daily physical database backup shown for 2026-10-18 12:29:24 UTC. Restoring it would lose later writes; Storage objects are outside that backup. Prefer feature disablement and compensating fixes, not database restoration.
- Existing administrator session successfully opens the production Admin Hub. This verifies the established owner/admin path, not yet the new hosted EVOLVE RPC.
- Pre-change aggregates: 73 Atoms, 23 Bonds, one administrator; EVOLVE tables absent.
- Existing Doodle and Puzzle cleanup jobs: every five minutes, 288 successful executions each in the inspected day. Tuesday Weekly Growth configuration unchanged.
- Hosted default privileges grant new public functions execution to `service_role`. The promoted production migration explicitly revokes that inherited grant (and growth-role execution) from both EVOLVE RPCs. Targeted tests confirm those roles and anonymous callers have no execution privilege; authenticated calls still require database owner/admin authorization.

## Release boundary

The production page and API require `EVOLVE_ENABLED=true`. PostgreSQL independently requires `private.evolve_settings.enabled=true`. The migration creates that setting OFF. Fixture sessions are restricted to the development-only loopback review route; production uses the existing verified owner session and `public.evolve_request`.

`/api/evolve` requires same-origin JSON, bounds the request body to 8 KiB, and fails closed when the Vercel SDK rate limiter is unavailable. Before launch, configure the independent `atomic-bond-evolve` limiter; preserve all existing protection rules. PostgreSQL additionally enforces participant request limits, ACTIVE ownership, the rolling submission deadline and transactional support uniqueness.

## Cleanup operation

The migration adds only the `atomic-bond-evolve-cleanup` pg_cron job, every five minutes. Each invocation processes at most 100 due ideas and 100 audit records, under the existing EVOLVE lock. It does not modify Doodle, Puzzle or Weekly Growth scheduling.

Private `evolve_cleanup_health` records successful/failed runs, timestamps, SQLSTATE and the last successful idea count. It stores no idea text or identities. The administrator-only `evolve_cleanup_status()` RPC reports this health, including overdue ideas; `/admin/evolve` displays a compact summary. An absent success for ten minutes or a failed last run is unhealthy. Database unavailability can prevent recording failure, so stale success must also be checked.

Logical visibility deadlines are enforced on reads regardless of cleanup. Physical purge occurs on bounded scheduled execution; scheduling delay or a backlog can postpone it. Monitor overdue records and retry the same bounded function. Account deletion and qualifying moderation erase applicable content synchronously. Backup copies follow the provider's recovery retention and are not individually rewritten; after restoration, rerun cleanup and lifecycle reconciliation before reopening access.

## Publication sequence and recovery

1. Finish regression/security checks and resolve specification authority discrepancy.
2. Freeze only the approved EVOLVE amendment in v0.9, preserving v0.8 bytes.
3. Recheck migration synchronization and pre-change comparison; apply the version-controlled additive migration with its gate OFF.
4. Inspect actual hosted grants, RLS, functions, constraints and scheduled cleanup execution. Preserve pre-existing record aggregates and schedules.
5. Configure dedicated ingress protection; publish the verified interface and check real administrator Auth/RPC compatibility without creating participant test records.
6. Open participation only after the hosted security gate passes; verify production navigation, health, Vercel Ready and Foundation checks.

If verification fails, keep or set the database gate OFF and disable the application entry point. Preserve genuine contributions, private audit, history and all existing application data. Do not drop EVOLVE tables or roll back shared schema. No new credential is required.

Initial administrator suggestions require explicit confirmation of their exact production writes. The sole administrator retains the same one-per-24-hours submission rule; three suggestions cannot be seeded at once by bypassing that rule.

## Evidence so far

- Full unit/integration/security suite: 86 files, 503 tests passed.
- Additional production adapter/ingress tests: nine passed.
- EVOLVE native PostgreSQL concurrency checks passed.
- Existing native PostgreSQL concurrency regressions passed.
- Client-boundary negative build passed (requires child-process permissions locally).
- EVOLVE browser acceptance: seven passed across mobile, tablet and desktop; two duplicate lifecycle cases are intentionally scheduled only once against the shared disposable fixture.
- Lint passed; TypeScript passed after production-adapter typing correction.
- Secret scan: 662 repository files and 56 browser bundles, no configured-secret or private receipt-implementation leak detected.
- Persistence browser suite: three passed.
- General browser suite: 118 passed, two Pulse cases hit the existing 30-second test limit while suites ran concurrently. Both passed unchanged on a one-worker rerun (12.8 and 14.0 seconds).
- Authenticated browser suite: 152 passed, one tablet Pulse case hit the existing 30-second limit with a closed browser session. The isolated unchanged case passed in 9.9 seconds. Resource contention is the leading explanation, not a conclusively established application defect. No test timeouts or assertions were changed.
- Targeted hosted-role/cleanup governance rerun: eight passed.
- Final production build passed. Production-build EVOLVE isolation checks passed at all three viewports; fixture-session API and disabled production API return 404. Page assertions verify the Next.js not-found content (streamed pages may return HTTP 200). Final secret scan covered 664 repository files and 56 browser bundles without a finding. No hosted EVOLVE migration, specification freeze, commit or deployment has occurred. The subsequent user clarification explicitly retains the v0.8 → v0.9 sequence.

## Hosted execution — 2026-10-19 UTC

- Applied `202610210001_evolve.sql` after a one-migration dry run. All seven tables have RLS and deny anonymous/authenticated direct reads. Both public RPCs deny anonymous/service-role execution and permit authenticated execution subject to their independent owner/admin checks. All 25 constraints are present.
- Participation remains OFF pending application deployment and live session acceptance. Atom/Bond hashes and counts match the pre-migration snapshot; existing Cron definitions match exactly.
- Scheduled cleanup succeeded at 03:25:00 UTC, with zero eligible records and no failure. This establishes actual execution, not just registration. Disposable local tests cover removal, retry and concurrency.
- Rollback-only hosted checks denied anonymous execution and missing verified owner/admin sessions; no participant fixtures were created.
- Dedicated Vercel SDK limiter `atomic-bond-evolve`: 120 requests per 60-second fixed window, HTTP 429; existing rules preserved. Production `EVOLVE_ENABLED=true` saved with explicit action-time approval; it takes effect on the next deployment.
- Specification clarification approved: v0.8 → v0.9. New frozen v0.9 contains only approved EVOLVE additions and version metadata. AGENTS.md and Build Blueprint changes are limited to authority version references. All earlier frozen files remain unchanged.
- The user approved the exact first administrator idea: “Private check-ins between confirmed Bonds, with clear consent and no public activity feed.” Submit and approve it through normal production controls only after live authorization passes; do not add support. The remaining group-challenge and network-exploration ideas stay drafts because equal 24-hour submission limits apply to administrators.
