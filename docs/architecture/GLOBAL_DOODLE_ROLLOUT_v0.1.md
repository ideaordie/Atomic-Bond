# Global Doodle — controlled production readiness

Status: CONTROLLED ROLLOUT, 2026-10-12. The approved migration and cleanup job
are installed; application deployment and live acceptance remain pending.
Master Spec v0.4 is approved and frozen. Frozen v0.3 is unchanged.
The exact reviewed delta is `../proposals/MASTER_SPEC_v0.4_GLOBAL_DOODLE.md`.

## Migration preview

`supabase/migrations/202610120001_global_doodle.sql` is one additive transaction.
Do not run a general hosted `db push` before approval: this migration is now staged
in the normal chain. Existing migration files are unchanged.

Nine private tables: `doodle_settings`, `doodle_rollout_members`, `doodle_accounts`, `doodles`,
`doodle_appreciations`, `doodle_hall`, `doodle_reports`, `doodle_requests`,
`doodle_moderation`. Each enables RLS, with no client access policies or direct
table grants. The moderation identity sequence is also revoked from client roles.
Initial threshold is five, **submissions start paused**, and database `public_access`
starts false. No participant is seeded by the migration.

Public functions: `doodle_request`, `submit_doodle`, `read_doodles`, `doodle_replay`,
`appreciate_doodle`, `report_doodle`, `doodle_admin_queue`, `doodle_admin_replay`,
`doodle_admin_history`, `doodle_admin_restrict_atom`, `doodle_admin_pause`,
`moderate_doodle`, `doodle_admin_settings`, `restrict_doodle_author`.

Private functions: `doodle_now`, `doodle_owner`, `doodle_lock`, `doodle_pack`,
`doodle_unpack`, `doodle_immutable`, `doodle_finalize`, `doodle_display`,
`doodle_record`, `cleanup_doodles`, `doodle_lifecycle_cleanup`.

All new functions have explicit `postgres` ownership and controlled empty search
paths. Only `public.doodle_request(text,jsonb)` grants EXECUTE to `authenticated`.
Underlying operations, private helpers and cleanup are unavailable to PUBLIC,
anonymous, authenticated, service-role and growth-role callers. No new server
credential, administrator membership, Auth metadata authority or self-enrollment.
The gateway derives verified ACTIVE ownership and each admin operation independently
uses the existing Signal administrator check. Its whitelist contains no dynamic SQL.

Two triggers: immutable submitted content on `private.doodles`; narrowly scoped
Doodle cleanup after lifecycle changes on `public.atoms`. The latter does nothing
to existing accounts at migration time. No existing Atom, Bond, Pulse, number,
preference, growth record or Signal is rewritten. Lifecycle cleanup removes only
Doodle data. Existing lifecycle-lock ordering precedes the Doodle advisory lock.

## Production integration and ingress

`GLOBAL_DOODLE_ENABLED` defaults off. `/doodle`, `/admin/doodle`, `/api/doodle`
and the Settings/Admin Hub entry points remain unavailable until explicitly enabled.
The service uses existing Supabase owner cookies and `auth.getUser()` verification,
then the authenticated gateway. Synthetic actor, reset and clock arguments are rejected.
The original local preview remains separate and unavailable in production.

The official `@vercel/firewall` SDK checks rule `atomic-bond-doodle` before Auth,
JSON parsing or RPC access. Configure this project-level SDK rule for **120 requests
per source IP per 60 seconds**, with a 429 result. This is a proposed starting
operational threshold, not a global daily quota. Counters are regional; shared IPs
may encounter limits and distributed abuse still needs monitoring. The SDK receives
only the configured host and platform-supplied IP header, not cookies, email or body.
No IP is persisted by the application. Vercel processes IPs for abuse protection.
Do not add participant identity as a rate-limit key.

Missing, blocked, timed-out or failed rule checks return 503 and do not invoke the
database. Non-Vercel operation also fails closed except the existing explicit
loopback-only Auth test configuration. Requests require same-origin JSON, no
compressed body, at most 70,000 streamed bytes and a five-second body read limit.
Responses are private/no-store with no-referrer and sanitized errors.

Both WAF rules were configured on 2026-10-12 after the owner accepted Vercel's
pricing prompt. The official SDK allowed 120 checks and limited the next. The
endpoint rule allowed 120 body-free requests to the undeployed endpoint (404),
then returned 429. Existing landing/About/Explore/access routes returned 200.
Authenticated application behavior still requires deployment verification.
Use the Vercel dashboard/API-supported rule configuration, not an invented
`vercel.json` rate-limit field. For edge rejection before function invocation,
also configure the matching `/api/doodle` path rule with the same IP budget.
Validate combined behavior and the correct SDK rule identifier before enabling.

Direct authenticated Supabase RPC access is still possible, as with existing
owner-session RPCs. Database limits remain authoritative on that path: 120 calls,
at most 30 mutations per owner/minute, ten new reports/hour, 60-minute submission
cooldown, one active drawing and bounded payload/replay. Ingress cannot replace
those protections. No new arbitrary recipient, participant or privilege input.

References: [Vercel SDK](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting-sdk),
[custom rules](https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules).

## Retention and cleanup

| Data                                 | Access deadline                                      | Cleanup policy                                        |
| ------------------------------------ | ---------------------------------------------------- | ----------------------------------------------------- |
| Ordinary drawing                     | 60 minutes after publication                         | Next five-minute batch; at most 24 hours after expiry |
| Qualified candidate                  | Private admin review only, until expiry + seven days | Next batch after that deadline                        |
| Occupied Hall slot                   | While approved and in Top 10                         | Excluded from ordinary cleanup                        |
| Removed/rejected/displaced content   | Immediately unavailable                              | Next batch; proposed operational maximum one hour     |
| Author deactivation/deletion artwork | Immediately unavailable                              | Removed in the lifecycle transaction, including Hall  |
| Minimal moderation record            | Private; absent from history at day 30               | Prune starting day 29, at most day 30                 |

No pending-review state, daily quota, content archive or automatic Hall promotion.
Replay and report/voter links disappear with payloads. Cooldown/retry metadata has
no content. Longer moderation retention requires an actual legal requirement and
a separately approved restricted procedure; no legal-hold feature is implemented.
Existing backups and downloaded copies are outside immediate erasure guarantees.

`supabase/candidates/global_doodle_cron.sql` previews the isolated job
`atomic-bond-doodle-cleanup`, `*/5 * * * *`, invoking `private.cleanup_doodles(500)`.
It uses a 30-second statement timeout and two-second lock timeout, finalizes bounded
expired windows before deletion, and prunes only its own completed job logs after
seven days. It does not alter the Tuesday Vercel growth schedule.

Batch ceilings are 500 payloads and 500 moderation records per execution; up to
1,000 expired windows and 1,000 stale candidates are finalized. These are capacity
bounds, not measured hosted throughput. Cleanup must be monitored, not assumed.
Use the read-only aggregate `supabase/candidates/global_doodle_health.sql` after
rollout to inspect deadlines and the last five job results. Alert on two missed executions, failed runs, removed-content backlog approaching
30 minutes, ordinary backlog approaching 12 hours, or audit rows approaching 30 days.
Pause intake and drain bounded batches before the stated deadlines. Escalate failure
to the operator; never claim deadlines were met during an unverified outage.

## Read-only hosted Cron audit

On 2026-10-12: pg_cron is available and preloaded, but not installed; `cron.job`
does not exist. The authenticated operator is `postgres`, has database CREATE,
and is not a superuser. The extension declares superuser installation requirements.
Supabase managed extension settings and its Cron access hook are present. This
supports the managed installation path, but does **not prove a successful install**.
No extension, job, permission or hosted Doodle schema was created during the audit.

Actual installation permission, five-minute execution and first-run success remain
approval-gated checks. Use the supported [Supabase installation procedure](https://supabase.com/docs/guides/cron/install).
If managed installation is refused, stop and ask the project operator; do not grant
superuser/BYPASSRLS or substitute an unapproved scheduler.

## Rollout sequence — approval required

1. Approve the exact proposed v0.4 text and the one-hour removed-content cleanup
   deadline. Preserve v0.3 as history; do not overwrite it.
2. Assign a moderator and backup operator, incident response coverage and retention
   alerts. Confirm database backup/recovery availability and record aggregate baseline.
3. Configure/test the ingress rules with the application gate off. Confirm plan
   support and SDK identifier; prove 429 and fail-closed behavior without mass traffic.
4. Review/apply only the staged migration. Confirm initial pause, owners/grants/RLS,
   no unexpected existing-data change and ordinary/anonymous administrator denial.
5. Install approved pg_cron and only the named five-minute job. Verify effective
   job owner, statement/lock timeouts, first successful execution and backlog queries.
6. Publish the reviewed candidate with the feature gate still off. Verify unrelated
   Auth/Bond/Pulse/Signal/PWA/Analytics/growth/lifecycle behavior and Tuesday schedule.
7. Enable only `GLOBAL_DOODLE_CONTROLLED_ACCESS` and provision the approved expiring
   members; keep `GLOBAL_DOODLE_ENABLED=false` and database `public_access=false`.
   Begin with submissions paused. Verify
   real owner/admin routing and all security boundaries. Explicitly resume for the
   approved controlled participant; verify SEND, reporting/removal, Hall approval,
   expiration, cleanup, lifecycle erasure and emergency controls. Do not use a
   genuine participant for destructive acceptance without separate approval.
8. Open beta intake only after those checks pass and operator coverage is active.
   No global daily admission quota is introduced.

## Recovery

### Controlled rollout checkpoint — 2026-10-12

The owner approved Atom #4 for controlled acceptance, including deactivation.
Atom #1 is not a destructive test target; deleted Atom #8 remains excluded.
Fresh hosted migration listing matched every existing migration; only
`202610120001` remained unapplied. Local HEAD and the locally recorded origin/main
both remained `cb495aa4c5e3ad1ce662e1492415318f7caa5ccf`.

The authenticated Supabase dashboard listed seven completed daily physical backups,
October 5–11. The latest was October 11, 2026 at 12:34:06 UTC. Point-in-time recovery
was not enabled. The restore-to-new-project page listed those completed backups.
No restore was initiated or tested. Database backups exclude Storage API objects.
Daily backups cannot recover changes after their cutoff. Prefer isolated recovery
and selective, reviewed repair over restoring the live database and losing unrelated
activity. Fresh pre-migration comparison snapshots are still required immediately
before applying the migration; comparison hashes are not recovery backups.

The owner approved controlled membership and isolated Hall evidence on 2026-10-12.
`GLOBAL_DOODLE_CONTROLLED_ACCESS=true` opens only the session-checked application
path; `GLOBAL_DOODLE_ENABLED` stays false. Database `public_access=false` restricts
every gateway operation, including direct RPC requests, to unexpired private
membership. Provision only verified ACTIVE owners #1 and #4 using the guarded
`global_doodle_controlled_members.sql`; it grants no administrator membership and
expires after 24 hours. No self-enrollment/renewal API exists. Expired rows are
cleaned in bounded batches; deletion removes membership. Deactivation denies use.
Public navigation remains unavailable to unlisted owners. Emergency pause is
independent: even admitted members cannot submit while paused. For controlled SEND,
an authorized moderator may resume with `public_access` still false; all unrelated
owners remain denied. Re-pause after the acceptance window. Public activation
requires separate approval to change database public access and the application gate.

Atom #4 alone cannot legitimately qualify a drawing with five non-self appreciations
or populate a full Hall. The owner approved isolated PostgreSQL evidence for those
multi-participant invariants; do not manufacture production votes or create unapproved
participants. Native concurrency/Hall/restart tests passed. Hosted schema verification
passed for nine RLS tables, 25 controlled functions and two enabled triggers. All
captured before/after hashes and counts matched. Cron installation succeeded and
the first actual scheduled execution succeeded at 12:45 UTC (08:45 Eastern) on
October 12, while intake remained paused. Two guarded memberships were provisioned
for #1 and #4, expiring October 13 at 12:47 UTC. Public access remains false and
intake paused. Candidate version is `0.12.1-rc.1`; production acceptance is not complete.

The controlled-access follow-up passed 345 unit/integration/security cases (one
expected placeholder inventory assertion was updated and rerun), native PostgreSQL
Doodle concurrency/restart, all 75 existing authenticated browser regressions and
three Doodle owner-session browser scenarios. The latter covers all three reference
viewports. Formatting, lint, TypeScript, production build and configured-secret scans
passed. No private identities or secrets appear in the comparison evidence.

First pause submissions through the authorized admin operation. Disable the feature
gate to remove application entry points if necessary; that alone does not disable
direct RPC submissions, so the database pause is also required. Keep cleanup running
to honor retention. For an authorization incident, a trusted operator may revoke
only the Doodle gateway's authenticated EXECUTE until reviewed; restore the exact
grant only after repair. Other Atomic Bond RPCs and the growth schedule remain intact.

Do not roll back unrelated production activity or drop Doodle tables as an improvised
rollback. Repair forward with a version-controlled migration. Recover only affected
data from the verified backup if required and explicitly approved. Already downloaded
content cannot be recalled. If Cron is faulty, replace/repair only its named job;
do not leave retention without an operator-run bounded cleanup while repairing it.
If cleanup fails, inspect aggregate counts/oldest deadlines and retry bounded batches
with the same timeouts. Never log artwork, replay, Auth IDs or private identities.

## Verification record

Local verification on 2026-10-12:

- 342 unit/graph/integration/security tests across 46 files passed (339 in the full
  run plus three new Firewall adapter checks). Coverage includes seven-day candidate
  expiry, Hall preservation beyond 30 days, 30-day audit visibility, private table/
  sequence grants, explicit ownership, body timeouts and Analytics exclusions.
- Both native PostgreSQL suites passed: existing application concurrency/restart
  regressions and Doodle submissions/voting/Hall/lifecycle/cleanup/idempotency races.
- 219 unique browser cases passed: 111 main, 75 authenticated, three persistence,
  27 Doodle preview and three owner-session integration cases. Default-off route
  checks were also rerun on the final production build. The owner-session checks
  exercise Settings/Admin Hub navigation, passwordless owner resolution, SEND,
  appreciation, reports, removal and pause/resume without synthetic actor authority.
- Light/Dark, keyboard, touch, reduced motion, replay inspection and responsive
  layouts were checked at 390×844, 768×1024 and 1440×900. Screenshot review identified
  and corrected text encoding and the SEND success message; affected checks reran.
- Formatting, lint, TypeScript, production build, privileged-client negative build,
  Git whitespace and configured-secret scans passed. No configured secrets appeared
  in repository files or browser bundles; no unintended generated artifacts were found.
- Synthetic PGlite benchmark: 50 reads, median 15.77 ms, p95 31.98 ms, 10,900-byte
  feed for two live drawings plus ten Hall entries, with no replay included. This
  excludes real network/Auth/Firewall latency and is not hosted capacity evidence.
- Hosted migration listing confirmed all prior migrations current and only
  `202610120001` unapplied. Local HEAD and origin/main remain at `cb495aa`; this work
  is uncommitted. Frozen v0.3, existing migration files, service worker and Tuesday
  growth scheduling configuration remain unchanged.

The earlier checkpoint's hosted WAF/Cron limitations are superseded by the rollout
record above. Hosted owner-session and real artwork acceptance remain pending. Local browser
tests use real migrated SQL plus isolated synthetic passwordless sessions, not real
production credentials. No physical-device or hosted-throughput claim is made.
