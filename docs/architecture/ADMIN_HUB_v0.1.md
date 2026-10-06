# Admin Hub and Connected Groups v0.1

v0.10.2, approved for publication. `/admin` is a static navigation hub; `/admin/network`
is a read-only current structural report; `/admin/signals` retains Signal authoring.
Both tools link to Admin Home and My Atom. No public navigation entry is added.

## Authority and privacy

The hub uses the existing Signal history authorization RPC without displaying its
payload. Signals retains its existing independent check. Network uses the single
new `admin_network_report()` RPC, which independently calls
`private.require_signal_admin()`: live authenticated session, verified identity,
ACTIVE ownership and private membership. Public number 1 defines the founding
component only; it never authorizes access. No secret, role or membership change.

The migration creates only this STABLE SECURITY DEFINER read function, owned by
postgres with empty search_path. PUBLIC/anon execution is revoked; authenticated
execution is granted subject to the internal authorization check. No table grants,
policies, mutations, dynamic SQL or new tables are introduced. No data is seeded.
The response contains public numbers, component counts, aggregate visible coarse
geography and retained confirmation timestamps; no identity/profile/Pulse data.
Pages render dynamically from the authenticated session, with no runtime caching.
Existing service-worker navigation remains network-only with the offline fallback.

## Current graph semantics

Confirmed Bonds are undirected. The RPC visits each connected component once using
the existing authoritative `private.reachable` traversal. Numbered ACTIVE, DORMANT,
DEACTIVATED and DELETED nodes remain structural members. PENDING/unnumbered rows
are excluded. Components with Bonds count as connected groups. ACTIVE zero-Bond
Atoms are separately isolated, not organic groups. Largest group counts structural
nodes in bonded groups (zero when there are none). ACTIVE counts exclude all other
lifecycle states. Founding network includes number 1 even when isolated.

Organic groups are current bonded components without number 1. Their displayed ID
is their smallest current public number, a snapshot label rather than a permanent
group identity. Merges change membership/labels naturally. Each structural member
appears in exactly one component. Regional counts use only the coarse geography
normally visible for ACTIVE/DORMANT members, never retained deactivated locations.
Legacy/canonical subdivision matching follows the existing growth metric convention.

## Historical limits

The schema has confirmation timestamps, but no complete append-only removal/status
history or commit-order record. Consequently no formation or merge events are
asserted. Earliest retained Bond is explicitly not a formation date. Current
organic status does not prove historical independence. No event tracking is added.

## Operations and rollout

Migration: `202610070001_admin_network.sql`. Preview before hosted application;
verify only the one function/EXECUTE boundary is added. Existing Atoms, Bonds,
Signals, lifecycle, Pulse and growth infrastructure must remain unchanged.
No scheduler or provider is involved. Reload the report for a fresh snapshot.
The full component scan is intended for the small beta graph; no per-Bond remote
requests occur. Larger networks should be measured before adding pagination or
aggregation infrastructure. Never display a truncated graph as a complete report.

Product review precedes release finalization. Live acceptance must use existing
administrator membership, navigate all three routes and back to My Atom, compare
current counts and verify anonymous/ordinary/inactive denial. Do not publish or
alter WELCOME TO THE BETA as part of this test.

## Review evidence — 2026-10-06

The hosted CLI dry run lists only `202610070001_admin_network.sql`; it has not
been applied. Local database tests execute the RPC inside a read-only transaction
and cover authorization, disconnected groups, merges, isolates, retained lifecycle
nodes and hidden-location exclusion. Browser tests cover independent route denial,
authorized navigation and deactivated administrator denial at 390×844, 768×1024
and 1440×900. The implementation remains uncommitted for product review.

Verification passed: formatting, lint, TypeScript/production build, 236 unit and
integration tests, native PostgreSQL concurrency/restart tests, server-only
credential-boundary tests and secret scans. Browser coverage passed 81 public,
57 authenticated and 3 persistence cases. The three new admin cases initially
navigated before sign-in completion; after adding an explicit completion wait,
all three passed on rerun. Hub/report screenshots were visually checked at all
three reference sizes. Production root, Auth, Explore and anonymous admin-denial
health probes passed during candidate review.

A separate read-only production audit found 17 ACTIVE Atoms, 10 confirmed Bonds,
one bonded component (the founding network: 9 structural Atoms, 8 ACTIVE), zero
separate organic groups and 9 isolated ACTIVE Atoms. These are audit observations,
not a claim that the new report is already deployed.

The production Signal differs from the request's historical expectation:
`WELCOME TO SPATIAL MEDIA` is ACTIVE; `WELCOME TO THE BETA` records are UNPUBLISHED.
No Signal was modified during this implementation. Preserve the actual current
Signal during rollout; do not republish a historical one to satisfy an old title.

## Publication — 2026-10-06

Product review was approved with an explicit commit/publish instruction. Migration
`202610070001_admin_network.sql` was applied through the linked Supabase CLI after
reconfirming it was the sole pending migration. It adds only the approved read-only
RPC; no application records or Signal publication state were modified. v0.10.2
publishes the reviewed implementation. The review-stage pending/uncommitted notes
above describe the earlier checkpoint.
