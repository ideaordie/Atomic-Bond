# Growth email v0.1 — Task #9.1

Task #9.3 [account deactivation](ACCOUNT_DEACTIVATION_v0.1.md) preserves preference
and provenance while lifecycle-ineligible. Unsent deliveries are cancelled with
period uniqueness retained; explicit reactivation establishes the current graph
baseline without resetting completed-period protection. The Tuesday schedule is
unchanged.

## v0.9.1 production activation and acceptance

Controlled real acceptance passed: the owner received the digest, VIEW MY ATOM
restored Atom #3, unsubscribe produced OFF/unsubscribe, transactional access still
worked, and manual re-enable produced weekly/owner_choice. Profile synchronization,
safety-cap, kill-switch, authorization, no-growth, concurrency and restart
idempotency checks passed. One accepted digest advanced the baseline to 5 connected
Atoms and 2 direct Bonds (one region/country). An explicitly approved revised
footer test copy reused its content/capability without changing delivery state.

Current provenance is authoritative, not an append-only event history. Explicit
owner re-enable correctly replaces unsubscribe. Historical auditing is a possible
future operations enhancement, not a Task #9.1 gate.

Production configuration: GROWTH_EMAIL_ENABLED=true, GROWTH_SEND_CAP=10,
GROWTH_TEST_ATOM empty/unset. No preference changes accompany activation.
Repository vercel.json registers /api/growth/run?dryRun=false at 0 16 * * 2:
Tuesday 16:00 UTC (12:00 EDT / 11:00 EST). Initial expected run: October 6, 2026.
Vercel supplies the existing CRON_SECRET authorization header. Deployment only
registers the schedule; no operator live-send request is made at activation.

Initial cap: 10 attempts per run, sequential with at least one second between
attempts; batch size 50, three pages, 210-second work budget. Adjust
GROWTH_SEND_CAP in Vercel Production (0–100), redeploy, and check a dry run before
increasing it. Cap/time-limit results retain pending recipients and provide a
continuation cursor; an operator must deliberately resume incomplete batches.

Fast emergency stop: disable Cron Jobs in Vercel project settings, then set
GROWTH_EMAIL_ENABLED=false and redeploy. This affects only engagement delivery;
authentication, verification and transactional email stay enabled. An in-flight
provider request cannot be recalled. Re-enable only after checking the incident.

Operator dry run: authenticated GET /api/growth/run?dryRun=true, using CRON_SECRET
in the Authorization header, never a URL. Review aggregate output only. Never use
the Vercel Run button merely to check registration; it invokes the live path.
First scheduled run: PENDING. Use the first-week checklist below after it occurs.

The approved Task #9.1 preference migration preserves every existing
`growth_digest` value, including monthly and disabled. Historical intent cannot
be recovered and is never inferred from timestamps or profile saves.

Private `growth_preference_source` records:

- `legacy_unknown`: all rows present before migration; values stay unchanged.
- `unset`: a new pending Atom, with no explicit preference yet.
- `activation_default`: weekly enabled at first verified activation.
- `owner_choice`: an explicit authenticated preference operation.
- `unsubscribe`: disabled by the internal unsubscribe operation.

The activation trigger defaults only `unset` preferences when the permanent
public number is first assigned. Returning activation, dormancy recovery,
profile edits and unrelated actions cannot reset OFF. Legacy pending records
also remain unchanged. Existing monthly values are not converted to weekly.

Profile submissions change preferences only if the owner changed that control;
a stale weekly selection on an unrelated profile save cannot undo unsubscribe.
An intentional owner preference update can re-enable weekly updates.

`private.unsubscribe_growth` is a restricted internal primitive, not a public
endpoint. Neither anonymous nor authenticated browser roles can execute it.
The email-unsubscribe flow validates a purpose-scoped token before
calling it. It sets the same authoritative preference to disabled and records
unsubscribe provenance. No token or email is added to public Atom data.

Transactional authentication email remains independent and enabled. The growth
worker and public unsubscribe flow are deployed. Controlled acceptance passed;
the production activation record above supersedes earlier checkpoint notes.

## Approved pilot RPC transport

The pilot uses Vercel Cron → protected server endpoint → GrowthService → an
isolated server-only Supabase client → seven thin public RPC wrappers → private
growth_jobs operations → Resend. `SUPABASE_GROWTH_SECRET_KEY` has broad service-role
authority, including RLS bypass. Its fixed application interface is not a
database-enforced least-privilege credential. This tradeoff is explicitly approved.

Migration `202610030002_growth_rpc.sql` adds `public.growth_scan`,
`growth_evaluate`, `growth_reserve`, `growth_claim`, `growth_authorize_send`,
`growth_finish` and `growth_unsubscribe`, with the signatures listed below for
their underlying operations. Each wrapper has postgres ownership, SECURITY DEFINER,
an empty search_path and a single fully qualified call. Execution is revoked from
PUBLIC, anon, authenticated and atomic_bond_growth and granted only to service_role.
No table grants or growth_jobs schema exposure are added.

The client is private to `src/data/growth/store.ts`, protected by `server-only`,
with session persistence, refresh and URL-session detection disabled. It uses no
cookies or owner Auth state and exports only the seven typed operations. Scheduler
requests accept only dryRun/after; recipient, RPC, table and Atom overrides fail.
Owner authentication and transactional email never import this privileged client.

Create a separate secret key in the intended Supabase project's Settings → API
Keys (Secret keys), named for the growth worker. Put it in `.env.local` and Vercel
Production sensitive configuration as `SUPABASE_GROWTH_SECRET_KEY`. Never put it
in chat, NEXT_PUBLIC variables or Git. A legacy service-role key is supported,
but a separately rotatable modern secret is preferred. Rotate by creating a new
key, replacing the configuration, deploying/verifying, then revoking the old key.
For an incident, disable scheduling/sending and revoke the growth key immediately.
Keep `GROWTH_EMAIL_ENABLED=false` until controlled acceptance passes.

Pilot configuration needs neither psql nor GROWTH_DATABASE_URL nor pooler setup.
The RPC migration was applied on 2026-10-03 after an exact one-migration preview.
Hosted audit confirmed seven hardened service-role wrappers and zero browser-role
execution grants; all existing preference values remained unchanged. The configured
local server credential successfully invoked the hosted RPCs, and all seven
anonymous calls were denied. The complete scheduler, run from an isolated local
production build against hosted data with sending disabled, evaluated seven records:
two eligible without baselines, three disabled and two ineligible; zero attempts,
failures or cap events. Missing/invalid scheduler authorization was rejected.

Atom #3's initial authoritative baseline was then established without reserving or
sending email. At that checkpoint evaluation returned no_growth and the network
had five ACTIVE Atoms and four confirmed Bonds. Subsequent genuine growth supported
the accepted controlled digest recorded above; historical reach was not invented.

## Preserved dedicated worker role — future hardening

The dedicated PostgreSQL login, `atomic_bond_growth`, remains intact with no
production password or connection configured. It is the preferred future
least-privilege path when scale, expanded background processing or security needs
justify a separate connection. It is not the active pilot transport.

The version-controlled migration creates the role without a password and
with NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOINHERIT, NOREPLICATION and NOBYPASSRLS.
It owns no tables/functions and has no membership in application or
administrative roles. Credential provisioning/rotation would be a separate
secure operator step, never a password in a migration or a browser variable.

Migration `202610030001_growth_jobs.sql` grants only database CONNECT, USAGE on
the non-API `growth_jobs` schema, and EXECUTE on these exact functions:

- `scan(bigint,integer)`: bounded public-number page and eligibility categories.
- `evaluate(bigint,boolean)`: evaluate or persist a baseline; never returns email.
- `reserve(bigint)`: reserve eligible Atom/weekly period atomically.
- `claim(uuid)`: lease a reservation and return its private delivery payload.
- `authorize_send(uuid,uuid,text)`: recheck eligibility and bind the payload hash.
- `finish(uuid,uuid,boolean)`: record acceptance/failure for the current lease.
- `unsubscribe(text)`: validate the capability hash and disable growth only.

No direct table SELECT/INSERT/UPDATE/DELETE is granted. SECURITY DEFINER
functions have a fixed empty search_path, qualified references, validated
arguments and explicit privilege revocations from PUBLIC, anon and authenticated.
They cannot accept an arbitrary recipient email, impersonate an owner, issue an
Auth session, or mutate profiles, Bonds or Pulses. Existing owner RPCs and RLS
remain unchanged. Audit effective PUBLIC privileges as well as role-specific
grants; NOINHERIT alone does not remove PUBLIC privileges.

The future Node-only adapter would use the `pg` driver and a bounded
connection pool (initially one connection), verified TLS and transaction-pooler
compatible queries without named prepared statements. A server-only
`GROWTH_DATABASE_URL` would hold the dedicated credential. Separate `CRON_SECRET`
protects Vercel invocation; the engagement kill switch defaults to disabled.
Neither secret is exposed, logged or included in client imports. Functions are
explicitly owned by the existing migration owner `postgres`; the login does not
inherit that ownership. These elevated bodies are the narrow audited authority,
not general-purpose query functions. No caller-controlled dynamic SQL is used.
The one migration-time CONNECT statement formats the trusted database name.

Affected areas: one additional migration, a server-only data adapter, growth
application services/job routes, unsubscribe handling, local database/privilege
tests, dependency lockfile, environment example and deployment documentation.
Existing notification delivery continues through NotificationService/Resend.

Tradeoff: this enforces a narrower database privilege boundary than a service
key, but adds a database driver, pooler configuration and separate credential
rotation. A compromised worker can still use its expressly granted digest
operations and obtain eligible recipients; batching, reservations, rate limits,
caps and operational shutdown remain necessary. This is not a zero-privilege
credential.

Acceptance tests connect as the actual login role (not merely as an admin
with an application-side allowlist), reject direct private reads/mutations and
role escalation, reject unauthorized function calls, and prove reservation
concurrency and restart persistence. Production sending was enabled only after
the explicit acceptance and activation approval recorded above.

The single controlled real-email recipient approved by the project owner is
public ATOM #3. The controlled live test and revised-footer copy were received.

References: [Supabase custom-role pooled connections](https://supabase.com/docs/guides/database/connecting-to-postgres),
[PostgreSQL role privileges](https://www.postgresql.org/docs/current/sql-createrole.html).

## Eligibility, metrics and baselines

Recipients must be ACTIVE, verified both in private identity and Supabase Auth,
with matching normalized email and weekly enabled. Missing identity/preferences,
PENDING, DELETED and DORMANT are excluded from sending. Dormant graph members
remain structurally reachable under existing graph semantics. Synthetic fixtures
never enter production; the adapter rejects mock mode and no migration seeds
participants or Bonds.

Metrics use only confirmed reachable Bonds: connected Atoms excluding self,
direct Bonds, regions and countries reached through other members. No city/GPS
or emotional-state information is used. Initial evaluation persists a baseline
without email. Subsequent positive differences are meaningful growth. No-growth
evaluation updates its timestamp and retains the comparison baseline, avoiding
false historical growth or repeated shrink/rebound reports.

Private `growth_state` holds the last communicated counts and evaluation/sent
timestamps. `growth_deliveries` holds one immutable reservation per Atom/UTC
Monday-based weekly period. Successful provider acceptance atomically advances
the baseline to the reserved metrics. Failed attempts do not advance it; growth
occurring after reservation remains available for a later digest.

## Delivery and concurrency

The worker calls NotificationService/Resend with text and restrained responsive
HTML. It includes only nonzero actual deltas and public Atom number. It contains
no visible private email, another person's identity, Pulse data, tracking pixel
or owner credential. VIEW MY ATOM opens configured APP_ORIGIN `/return`;
valid owners see their existing Atom continuation, otherwise existing passwordless
access resumes. Browser and PWA links remain ordinary HTTPS; the OS chooses the
application that opens them.

Database Atom locks serialize reservations; a unique Atom/period key prevents
duplicates. Claims last five minutes. Provider payload hashes freeze template,
origin, recipient and token across retries under `growth/<delivery UUID>`.
Acceptance suppresses any further digest in its actual UTC week, including when
an older prepared reservation is delivered after a week boundary.
Retries wait at least one minute and require the same payload within 23 hours of
first attempt. Resend retains keys for 24 hours. Uncertain older attempts or
changed payloads block further delivery for that Atom pending operator review;
never clear this state and blindly resend. Provider acceptance is not inbox
delivery. A timeout can be ambiguous; persisted keys make bounded retries safe.

The sender is sequential, at most one request per second. HTTP 429 stops the run
without repeated retries. Other individual failures are recorded without aborting
unrelated recipients. Review known bounces/complaints in Resend, disable engagement
sending while investigating, and use the controlled unsubscribe capability for
the affected recipient. Automated bounce webhooks are deferred; do not knowingly
continue sending to an undeliverable or complaining recipient.

## Unsubscribe and preferences

Each reservation generates 256 random bits. The database stores a SHA-256 hash
for validation and a private encrypted recovery value for immutable retries.
The secret is neither an Auth token nor a Bond secret and has no general access
capability. It does not expire, so old emails remain usable. Database credential
rotation does not invalidate it; preserve the private encryption key for retries.

Visible email links use `/unsubscribe#<capability>`. The client removes the
fragment from history, then requires a clear TURN OFF WEEKLY UPDATES action.
This avoids passive email scanners unsubscribing users. POST submits a bounded
64-character body with credentials omitted. No email/Atom identifier is accepted,
no session is issued, and repeated valid use succeeds. Responses are no-store;
the service worker never caches this route or capability. An already in-flight
provider request cannot be recalled; eligibility is checked immediately before
sending, and subsequent requests remain suppressed.

List-Unsubscribe/one-click POST headers are deferred for this pilot: standard
HTTPS one-click URLs would place a bearer capability in server request URLs,
unlike the selected fragment/body design. Do not emit a misleading fragment-based
one-click header. Visible low-friction unsubscribe is always present. Header and
mail-client review remains an explicit rollout limitation, not a claim of support.

Profile & Preferences now exposes Weekly ON/OFF, saved immediately by the existing
owner-authorized RPC without profile resubmission. Legacy monthly is shown as
weekly OFF and remains stored unchanged until an explicit selection. Monthly
delivery is a future feature. New-registration disclosure explains default ON
and how to disable it; login never resets an existing preference.

## Future dedicated-role credential operations (not required for pilot)

Provision a unique random password for `atomic_bond_growth` using an authorized
PostgreSQL session and secure password prompt (for example psql `\password
atomic_bond_growth`). This is credential configuration, not a manual schema
change. Never paste it in chat or put it in shell arguments/history. Store the
URL only in ignored local configuration and Vercel's sensitive Production
environment. Shared-pooler username is `atomic_bond_growth.<project reference>`;
use the project Connect panel's shared pooler host, port 6543, verified TLS and
database. Do not substitute an administrative URL. No query-string SSL overrides.

- `GROWTH_DATABASE_URL`: dedicated role pooler connection, server-only.
- `CRON_SECRET`: independent cryptographically random scheduler bearer secret.
- `GROWTH_EMAIL_ENABLED`: exact `true` enables sends; absent/false is a kill switch.
- `GROWTH_TEST_ATOM`: set to `3` for controlled acceptance; unset only after gates.
- `GROWTH_BATCH_SIZE`: default 50, maximum 100.
- `GROWTH_SEND_CAP`: default 1, maximum 100 attempted sends per invocation.

Existing APP_ORIGIN, RESEND_API_KEY and RESEND_FROM_EMAIL remain the source of
origin/sender configuration. Auth email ignores the growth kill switch.

Rotate the role password through the secure operator connection, replace only
GROWTH_DATABASE_URL and redeploy. Drain/revoke existing worker sessions if
responding to compromise; PostgreSQL password changes do not kill open sessions.
Emergency immediate database shutdown: authorized operator sets the role NOLOGIN
and terminates its sessions; record permission changes in a follow-up migration.
For normal shutdown set GROWTH_EMAIL_ENABLED=false and redeploy, and disable the
Vercel cron. This does not revoke transactional email configuration. Re-enable
only after verifying the cause and explicit rollout gates.

## Scheduler operations and rollout gates

The approved production cadence is Tuesday 16:00 UTC, without collecting user
timezone. Controlled email, unsubscribe, owner return and security gates passed. [Vercel cron behavior](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
requires application-level idempotency and manual recovery; it does not retry
failed invocations automatically.

Protected `/api/growth/run` defaults to dry run; `?dryRun=false` additionally
requires the enabled flag. Use an authenticated server-side operator request,
never place CRON_SECRET in the URL. Output contains aggregate counts, operational
flags and a public-number continuation cursor, no emails or capabilities.
Dry run computes eligibility/growth without writes, reservations or Resend calls.
The worker handles at most three pages and 210 seconds per invocation. If `more`
is true, resume intentionally using `after=<nextCursor>`; if rate-limited, wait
for provider cooldown first. Failed individual Atoms can be retried from an
earlier cursor subject to persisted leases/idempotency. Hitting a cap leaves the
next recipient unprocessed rather than marking it sent. This initial bounded
schedule requires operational continuation when the population exceeds a run;
do not claim unattended unlimited scaling.

Before hosted migration: compare migration history, preview exact role/grants,
snapshot existing preference values privately, and stop on unexpected changes.
Afterward compare values/provenance without outputting private identities. Prove
the role's denials using its actual credential before enabling sending. Run a
hosted aggregate dry run. Atom #3 is approved for the controlled real test; if it
has no baseline, create one without inventing prior growth. Wait for genuine
growth or an explicitly approved isolated test method. Do not create fake public
Bonds or silently opt in existing disabled participants.

Real acceptance must confirm inbox receipt/mobile rendering, same-owner return,
unsubscribe OFF, authentication email after unsubscribe, explicit re-enable and
no-growth suppression. Browser simulations cannot replace physical acceptance.
Hosted migrations `202610010001` and `202610030001` were applied after preview on
2026-10-03. Hosted audit confirmed all five existing preference records unchanged,
all five marked legacy provenance, no direct table privileges or role memberships,
no administrative flags, exactly the seven listed executable functions, and no
anonymous/authenticated execution of them. All seven functions have explicit
postgres ownership and empty search paths; the three new tables have RLS enabled.
The public network remained five active Atoms and four confirmed Bonds.

Dedicated-role password/pooler configuration is intentionally deferred. Native
local PostgreSQL tests already exercise an actual restricted login.
At that earlier checkpoint no live growth email or schedule activation had occurred.
The first scheduled run remains pending.

## First-week monitoring and limits

At every run review execution, plausible evaluated/eligible/disabled/no-growth
counts, attempted/accepted/failed, blocked reservations, cap/time-limit flags,
cursor completion, unsubscribe provenance counts and visible Resend bounces or
complaints. Record aggregate results only. Investigate duplicate anomalies or
ambiguous acceptance before retrying. No admin dashboard is added.

Future privacy-reviewed metrics could include acceptance, aggregate unsubscribe
rate, CTA return and network growth. No open tracking, pixels or invasive
user-level analytics are implemented. Event-triggered mail, Web Push and dormancy
automation are out of scope.
