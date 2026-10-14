# Global Doodle standalone navigation — Task #12.3

> Task #14.1 / v0.14.1 applies ACTIVE-only connectivity to current network metrics and connected authorization. See [current semantics and transition](ACTIVE_NETWORK_HOME_REGION_v0.1.md); historical release descriptions below are retained.

Status: v0.12.3 publication authorized on October 12, 2026, based on v0.12.2 (`d4e8cec`). The approved Section 48A amendment is applied; v0.3 remains unchanged.

## Routes and navigation

`/explore` retains the full Living Atom without a feed/sidebar. `/global-doodle`
is the authenticated ACTIVE-owner feed; `/doodle` remains the approved editor.
The shared navigation configuration groups core, application and informational
destinations. MY ATOM, GLOBAL DOODLE, ABOUT and SETTINGS remain on one row with
horizontal overflow inside the navigation, keyboard focus and an active-page
indicator. Anonymous visitors retain public ABOUT access, without owner links.
Feature and controlled-access gates remain authoritative on Doodle routes.
The existing session-refresh/private-cache proxy covers `/global-doodle` and
the now owner-aware ABOUT navigation, using the same existing Auth mechanism.

The standalone feed retains LIVE and global HALL OF FAME. LIVE defaults to WORLD.
MY NETWORK uses only the authenticated owner's component, irrespective of public
Atom views. Scope changes remount the feed window, abort the previous request,
clear cached rows/cursors and reject late responses. No scope-specific persistence
or new service-worker caching is introduced. The editor downloads no public replay.

## Database and privacy preview

Migration: `supabase/migrations/202610120003_doodle_network_feed.sql`.

- Adds private `doodle_network_feed(timestamptz, uuid, jsonb)`; owner `postgres`,
  SECURITY DEFINER with empty search_path and fully qualified references.
- Explicitly denies direct execution to public, anon, authenticated, service_role
  and atomic_bond_growth.
- Replaces the existing `public.doodle_request(text,jsonb)` implementation only to
  dispatch `read_network_doodles` and classify it as a throttled read. Existing
  grants, lifecycle locking, argument limits and other dispatch branches remain.
- No new tables, indexes, RLS policies, credentials or public RPC grants. No data
  rewrite, cleanup change, scheduler change or historical-migration edit.

The owner is derived from `private.doodle_owner()`, never a supplied Atom ID.
One recursive traversal per request follows confirmed Bonds through numbered
ACTIVE/DORMANT/DEACTIVATED/DELETED structural nodes, matching existing graph
semantics. Separate indexed edge directions avoid repeating an OR-join scan.
UNION prevents cycles from duplicating nodes. Only ACTIVE authors with unexpired
PUBLISHED drawings appear. Revalidation applies the same membership filter.
Hall of Fame remains global, with its existing ACTIVE-author and HALL checks.
Display fields reuse `private.doodle_display`; no identity, email, location,
membership list or private topology is added to the response.

## Bounds and performance

Pages remain 20 (21st row detects continuation); revalidation accepts at most 100
IDs and browser memory remains at most 100 drawings. Hall remains at most ten.
Visible-only approximately 30-second refresh/backoff is unchanged. The Living Atom
no longer mounts the feed, so it makes no Doodle polling requests.

Traversal is capped at 5,001 discovered nodes to detect the existing 5,000-node
beta retrieval ceiling. Oversized components fail closed, not as partial results;
WORLD remains available. Graph work still scales with component edges and database
load. This is not an unlimited-scale performance guarantee.

`scripts/test-doodle-network-plan.mjs` measures an isolated 1,025-node chain with
25 drawings and records EXPLAIN ANALYZE/BUFFERS JSON under ignored artifacts.
The initial existing-helper implementation measured about 1,137 ms median locally;
the final indexed candidate measured about 64 ms median / 84 ms p95 in PGlite.
These are synthetic local measurements, not hosted
latency or throughput promises. Existing lifecycle serialization is retained.

## Local review and rollout gate

Run the synthetic server with DOODLE_REVIEW_NEXT=true and
DOODLE_NETWORK_REVIEW=true, then visit `/review/doodle/network` on the local
development server. GLOBAL DOODLE opens `?feed=1`; CREATE DOODLE opens `?draw=1`.
Synthetic confirmed connections make both scopes pageable. This route remains
unavailable in production builds.

The approved Section 48A amendment is recorded in
`docs/proposals/TASK_12_3_SPEC_AMENDMENT.md`. Run linked migration preview, apply the migration,
then deploy the approved application checkpoint. No production flags, credentials,
Cron jobs or Tuesday growth schedule changes are required.

Rollback is an application rollback plus restoring the preceding doodle_request
function if needed; the additive private helper can remain inaccessible. Do not
delete drawings or rewrite deadlines. Production owner-session smoke verification follows deployment.

## Verification record (local)

- 354 unit/integration/security tests passed, including five new database tests
  for session scoping, private helper access, direct/indirect connectivity,
  inactive-node traversal, moderation/expiration and global Hall behavior.
- 111 main browser tests covered; four animation timeouts under parallel suite
  load passed on single-worker rerun without product-code changes.
- 75 Auth/browser cases covered; updated assertions for the approved shared
  navigation and one timed-out Pulse case passed in a 15-case targeted rerun.
- 15 retained feed/editor cases plus six scope/navigation cases passed across
  mobile, tablet and desktop. Three production-route owner-session cases and
  three persistence cases passed.
- Native PostgreSQL lifecycle/security/concurrency and Doodle concurrency/restart
  suites passed with the candidate loaded. The Doodle harness now waits one second
  on Windows after its embedded server stop so child-process memory handles are
  released before restart; no production behavior changes.
- Formatting, lint, TypeScript, production build, privileged-client boundary and
  repository/browser-bundle secret scans passed.
- Light/Dark review at 390×844, 768×1024 and 1440×900; no page overflow. Navigation
  stays on one row, supports horizontal scrolling, and reveals focused links.
  Scope controls preserve keyboard focus. Full feed panels remain separate from
  the Living Atom. Physical-device and hosted rollout verification remain pending.

## Release verification

The approved function-only migration `202610120003` was applied on October 12,
2026 after a clean linked dry run. Hosted ACL checks confirmed the private helper
is inaccessible directly to anonymous, authenticated and service roles; the existing
authenticated gateway remains the only client boundary. Before/after aggregate
fingerprints confirmed unchanged Atoms, Bonds, Pulse, identities, preferences,
invitations, number sequence, drawings, appreciations, Hall and Doodle settings.
Cleanup Cron remained active and successful. The Tuesday growth schedule and
production flags were not changed. Prior function definitions were captured locally
for recovery; no data rollback is required.

Release checks repeated successfully: 354 unit/integration/security tests, native
PostgreSQL and Doodle concurrency/restart suites, three owner-session browser tests,
six responsive/navigation cases, formatting, lint, TypeScript, build and secret
scans. The LIVE / HALL OF FAME / WORLD / MY NETWORK controls share one row at
390×844, 768×1024 and 1440×900, retaining 44-pixel touch targets.
