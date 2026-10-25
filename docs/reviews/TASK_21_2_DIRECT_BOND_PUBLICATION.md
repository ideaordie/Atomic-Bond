# Task #21.2 / #21.2A — Direct Bond Requests publication

Status: release preparation in progress. Application/database activation and publication acceptance are not yet complete.

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

Hosted new-RPC authorization, scheduled cleanup execution, deployment and Foundation acceptance are pending. No production test account, invitation, request or Bond has been created by this task. Physical iPhone/PWA verification remains pending. The prior tablet NOT NOW timeout remains intermittent and unresolved: 20 traced unchanged reruns passed, but the original failure lacked a trace. No assertion was weakened.
