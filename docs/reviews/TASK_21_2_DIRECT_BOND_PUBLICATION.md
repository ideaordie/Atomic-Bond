# Task #21.2 / #21.2A — Direct Bond Requests publication

Status: approved hosted migration and scheduled cleanup verified on October 25, 2026; database gate OFF. Disabled application publication is authorized; deployment/CI and activation acceptance remain pending at this evidence checkpoint.

## Baseline and scope

Production v0.20.1, `0c2e01238e5dc4ceecc6f1978d3b2c69a3340469`, Vercel Ready. Fresh remote main lookup agrees with local HEAD. All 32 hosted migration identifiers match, through `202610220001`. Required ownership/reachability/lifecycle definitions match the prior read-only preflight; all three existing database cleanup jobs remain active. Supabase lists an October 25, 2026 12:27:30 UTC physical backup. Restore was not exercised; no zero-loss recovery is claimed.

The 23 approved implementation paths are listed in `docs/proposals/DIRECT_BOND_REQUESTS_LOCAL_REVIEW.md`. Release metadata adds this report, v0.21.0 package/changelog metadata, frozen v0.11, and authority references in AGENTS.md/Build Blueprint. The candidate moves unchanged in executable SQL to `supabase/migrations/202610250001_direct_bond_requests.sql`; its header is updated. The direct-request fixture now consumes it through the existing migration loader instead of applying the candidate twice. No authentication or external invitation implementation changes.

## Rate limiter prerequisite — configured

Published Vercel rule `rule_direct_bond_requests_sdk_protection_h22hB5`, **Direct Bond Requests SDK protection**:

- SDK identifier: `atomic-bond-direct-requests`.
- Fixed window: 60 requests per 60 seconds, API-controlled counter key; excess response 429.
- Only this SDK identifier matches. Existing five rules remain enabled and unchanged. No secrets or environment variables were added.
- Rules are project-scoped; the approved server action explicitly uses the canonical production APP_ORIGIN host for lookup. This is not a new global path-based restriction on other application requests.
- The SDK defaults its key to `x-real-ip`; the application passes Vercel's request header, not a browser payload identity. A missing IP/key throws and is caught fail-closed. IP identifies an infrastructure address, not verified ownership; owner verification remains independent and mandatory before database access.
- Shared NAT/VPN addresses share the allowance, including list/notice/preferences operations. Fixed-window boundaries may permit adjacent-window bursts. Database per-Atom limits remain independently enforced.

Verification: one installed-SDK probe against `atomicbond.ideaordie.com`, using an isolated synthetic counter key and no owner credentials, returned allowed with no configuration error. It did not invoke application/Bond operations. Local installed-SDK simulations verified 204 allow, 429 rateLimited, 404 not-found and absent-key rejection; existing server-action security tests passed 3/3. No production traffic burst was used. Actual end-to-end authenticated action verification awaits deployment; production exhaustion behavior was not load-tested. The controlled action error must not be described as a guaranteed application HTTP 429: the SDK receives 429 and the server action returns its existing neutral error.

Provider references: [SDK configuration](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting-sdk), [trusted request headers](https://vercel.com/docs/headers/request-headers). Local screenshot: `artifacts/task212/limiter.jpg`.

## Migration, cleanup and recovery sequence

1. Commit approved release and exact v0.11 amendment; preserve all earlier frozen files.
2. Apply the bounded migration transaction and record its version atomically; retain database gate OFF.
3. Verify private RLS, grants, gateway definition, owner binding and policy constants without creating participant Bonds.
4. Register a separate five-minute pg_cron job calling `private.direct_bond_cleanup(100)` with bounded statement/lock timeouts. Verify an actual scheduled success and `private.direct_bond_cleanup_status`; a cron success alone is insufficient because the function returns redacted failure status. Leave unrelated jobs unchanged.
5. Deploy application with gate OFF; verify Vercel Ready and all Foundation suites. Verify real hosted-session behavior, then enable approved gates only after required acceptance passes.
6. If any required check fails, stop; keep/return gates OFF. Preserve private tables, requests and confirmed Bonds, and continue privacy cleanup. Do not destructively roll back schema or authentication.

## Remaining acceptance

Local release verification: 533 tests across 91 files passed with one worker (373.56 seconds); focused direct-request tests passed 16/16. Native PostgreSQL direct-request concurrency, production build, TypeScript, lint, formatting, client-boundary checks and the repository/browser-bundle secret scan passed. The v0.10-to-v0.11 diff is limited to the approved Sections 12/31/31A and version metadata. No frozen predecessor changed.

Scheduled cleanup execution, deployment and Foundation acceptance are pending. No production test account, invitation, request or Bond has been created by this task. Physical iPhone/PWA verification remains pending. The prior tablet NOT NOW timeout remains intermittent and unresolved: 20 traced unchanged reruns passed, but the original failure lacked a trace. No assertion was weakened.

## Authorized migration-only stage — October 25, 2026

Reconfirmed the 32-version hosted baseline, today's physical backup, documented non-destructive recovery, and active 60-request/60-second SDK limiter. Applied only `202610250001_direct_bond_requests`, with migration-history registration in the same bounded transaction. Hosted identifiers now match all 33 local migrations. The history entry matches the approved SQL exactly after newline normalization; all five installed function-body fingerprints match the candidate.

Hosted read-only verification:

- Gate remained OFF; request count is zero.
- All five private tables have RLS enabled, no permissive policies, and no direct anon/authenticated/service-role table grants.
- The public gateway grants execution to authenticated and the existing default service role, but both still require verified owner authorization. Private helpers are postgres-only. Security-definer functions use an empty search path.
- Actual calls as anon, authenticated without an owner session, and service role without an owner session each failed with SQLSTATE 42501 in a read-only transaction. No production identity was impersonated.
- Exact installed definitions retain recipient binding, ACTIVE reachability, acceptance revalidation, five/day and ten-outstanding limits, seven-day expiration, thirty-day decline cooldown, cancellation/opt-out, lifecycle locking and Bond uniqueness. Lifecycle trigger is enabled. Successful owner operations and concurrency were tested locally, not exercised against genuine production participants.
- Existing public/private function definitions and grants retain their pre-migration aggregate fingerprint `196e1f043f4761727282d1355fff8192`; existing cron fingerprint remains `c0e235844647c48e51dcdc24eaebfe95`. Atom/Bond counts remain 78/23. The migration does not rewrite existing participant or application data; counts alone are not represented as full content checksums.

Evidence: `artifacts/task212/hosted-migration-verification.jpg` and `artifacts/task212/hosted-denials.jpg` (local ignored artifacts).

Stopped at the authorized checkpoint: no application push, feature activation, cleanup job registration, or additional specification change. Local commit `97254ad` already contained frozen v0.11 from the preceding preparation stage; it remains unpushed. This evidence update is uncommitted. Remaining prerequisites require review: bounded cleanup scheduling and actual execution, application deployment, real-session acceptance without creating genuine test Bonds, Vercel/Foundation acceptance, and subsequent activation authorization. Recovery remains gate OFF with schema and records preserved; backup restore was not exercised.

## Authorized disabled deployment and cleanup checkpoint

Rechecked production Ready on `0c2e012`, remote main unchanged, all 33 migration identifiers synchronized, database gate OFF, zero requests and 78/23 Atom/Bond counts. Vercel has no `DIRECT_BOND_REQUESTS_ENABLED` variable: the approved server code defaults the UI and actions OFF. The dedicated limiter remains active. Anonymous read-only checks of welcome, authentication/registration, owner, EVOLVE, Doodle and Puzzle routes returned HTTP 200. The existing secret scan passed across 696 repository files and 58 client bundles.

Registered only job 4, `atomic-bond-direct-requests-cleanup`, at `*/5 * * * *`, executing:

```sql
set lock_timeout='5s';
set statement_timeout='30s';
select private.direct_bond_cleanup(100);
```

The function bounds each expiration/request-retention/send-retention batch to 100 records and serializes with the existing lifecycle lock. Execute permission remains postgres-only. Two successive manual calls completed; repeated execution reported `ok=true`, zero expired and zero purged. Actual pg_cron execution succeeded from `2026-10-25 14:55:00.047601+00` to `14:55:00.081+00`; the function recorded success at `14:55:00.069191+00`. No live request fixtures were generated. Local synthetic tests cover nonempty retention, failure recovery and concurrent work; empty hosted runs do not prove those cases anew.

Operational monitoring combines `cron.job_run_details` for this job with `private.direct_bond_cleanup_status` (`last_success`, `last_failure`, `error_code`, `removed`, `expired`). Function-caught failures record redacted SQLSTATE; uncaught timeout/connection failures must also be checked in cron run details. Alert operationally on a missing recent success or failed run; no new alert delivery service was introduced. The existing unrelated schedules are preserved. Evidence: `artifacts/task212/cleanup-scheduled.jpg`.

The migration-stage report is included as release evidence without changing application code. Publication verification will report the actual Vercel and Foundation outcomes separately; this checkpoint does not claim a future CI pass. Participant-facing activation remains explicitly unauthorized and OFF.
