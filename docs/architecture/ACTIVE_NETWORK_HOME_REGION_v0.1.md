# Editable Home Region and ACTIVE-only network — Task #14.1

Status: production acceptance passed; v0.14.1 is the approved production baseline. Hosted migration applied and integrity verified on October 14, 2026 UTC.

## Product authority

Master Spec v0.6 contains the approved amendments to sections 6, 34, 38, 42,
57 and 62, plus version metadata. Frozen v0.5 remains unchanged. All other
numbered sections are identical. Only ACTIVE Atoms and confirmed Bonds between
ACTIVE endpoints participate in current network connectivity. DORMANT does not
participate; no automatic dormancy or lifecycle-transition changes are introduced.

## Home Region

Settings uses the existing canonical country/root-subdivision selector in a
separate form. The action validates request origin, verified owner, ACTIVE state
and the bundled canonical identifier. `update_my_home_region(uuid)` independently
resolves ownership, takes the existing lifecycle lock, rejects inactive owners and
validates the operator-seeded canonical location row. It updates only location
(and the existing automatic updated timestamp). It takes no owner/Atom argument.

The legacy `update_my_atom(text,text,uuid)` signature remains compatible with old
clients, but its location argument has no effect. The wrapper reads the current
location after locking and supplies that to the private profile implementation.
Concurrent profile saves cannot revert a dedicated location edit. Existing
DORMANT transitions in other account operations are unchanged. Public responses
contain only current coarse location, never previous locations.

## Connectivity and refresh

`private.reachable` is the shared ACTIVE-only traversal. Indexed forward/reverse
confirmed edge scans and recursive UNION deduplicate cycles. A demand-driven
5,001-row limit precedes aggregation; more than 5,000 nodes raises an error rather
than returning a partial component. Traversal never walks through inactive nodes.

Public graph reads, connected Pulse authorization, Doodle MY NETWORK, administrator
Connected Groups and growth metrics use this traversal. Inactive number lookups
return an empty graph and the generic unavailable experience. WORLD, Hall of Fame,
appreciations, moderation and all stored Bond IDs remain unchanged.

Geographic positioning and overview metrics derive from the refreshed graph.
Deactivation can split components; reactivation reconnects only ACTIVE endpoints.
No Pulse or invitation is restored. The existing visible-page topology refresh
(approximately 60 seconds) and resume refresh are retained. A removed selection
falls back to the owner and its details panel is no longer displayed. Public
serialization also filters inactive nodes and incident edges defensively.
When the refreshed session no longer resolves to an ACTIVE owner, the client
receives an empty graph and removes the stale owner visualization and controls.

## Growth transition

The migration takes the lifecycle lock and aborts if any attempted delivery has a
live lease. It recalculates mutable `growth_state.baseline` and `evaluated_at` only.
It cancels outstanding prepared/attempted/failed jobs, retaining their period keys,
snapshots and hashes. Reusing an uncertain provider idempotency key with changed
content is deliberately avoided. Accepted emails, historical metric payloads,
sent timestamps/periods, preferences and unsubscribe capabilities remain intact.
Blocked jobs remain blocked. A cancelled period may conservatively omit that
week's update; future periods compare with the new ACTIVE-only baseline.

Existing growth-delta clamping remains unchanged. The Tuesday schedule, scheduler
credentials, provider handoff protocol and account lifecycle procedures are not
modified. Future Home Region changes affect current metrics, not historical email
snapshots.

## Migration preview

Applied: `202610180001_active_network_home_region.sql`.

- Replaces private `reachable`, `growth_metrics`, `doodle_network_feed`.
- Replaces public `public_graph`, `connected_emotional_pulses`,
  `admin_network_report`, `update_my_atom`.
- Adds public `update_my_home_region(uuid)`, authenticated execution only.
- Updates mutable growth baselines and outstanding delivery status as above.
- No new tables, columns, enums, policies, credentials, schedules or indexes.
- Fixed empty search paths; existing private helpers remain non-client-callable.
- No Atom UUID, number, lifecycle, ownership, profile, location, preference, Bond
  or historical snapshot is rewritten by the migration itself.

Before any equivalent hosted transition, inspect migration synchronization, growth leases, component
sizes and recovery readiness; capture comparison snapshots. Any guard failure
rolls back the transaction. Deploy the RPC migration before the Settings UI.
Do not casually restore old growth baselines after sending new-period emails;
any compensating data operation requires a separate reviewed plan.

## Local review and limitations

`/review/network-lifecycle` is development-only and uses synthetic Atoms. It offers
the same editor, country/subdivision selection, map view, Light/Dark appearance
and a bridge-state selector demonstrating split/reconnection. Its DELETED toggle
is fixture manipulation, not a production reactivation capability.

The graph ceiling remains a beta limit. Local PostgreSQL/PGlite timings are not a
hosted latency guarantee. Other open browsers converge on their next normal
refresh; content already displayed is not retroactively erased. Physical-device
acceptance remains a manual check; hosted migration/data comparisons passed.

## Local verification evidence

- 22 isolated integration files / 118 tests passed, including migration abort,
  immutable-record comparisons, canonical edits, legacy bypass closure, graph
  splits, Pulse/Doodle authorization, lifecycle and existing puzzle regressions.
- 330 unit/graph/security tests passed; three additional inactive-session refresh
  cases passed in the targeted owner-action suite.
- Native loopback PostgreSQL concurrency/restart suite passed, including concurrent
  Home Region/profile saves and Home Region/deactivation races.
- Full authenticated browser suite: 81 passed. Synthetic map/lifecycle review:
  three passed at 390×844, 768×1024 and 1440×900. Light/Dark, map repositioning,
  inactive selection removal, region persistence and no horizontal overflow checked.
- PGlite synthetic cyclic graph with 5,001 nodes / 9,999 Bonds: 84 ms to reject
  over-limit reach; 71 ms for a 5,000-node traversal; 35 ms for the 2,500-node split
  component. Full 5,000-node public graph serialization: 3,672 ms. Single local
  samples, not production or physical-device performance guarantees.
- Production build, TypeScript, lint, formatting and secret scans passed. Existing
  negative-build checks reject privileged growth/deletion adapters in client code.

## Hosted migration evidence

- October 14, 2026 UTC: migration applied through the linked Supabase CLI; migration history synchronized.
- Daily physical backup verified (October 13, 12:28:59 UTC). A local ignored recovery capture preserves the seven previous function definitions and mutable growth values. A full backup restore is not a selective rollback and may lose later activity; Storage objects are not covered by database backups.
- No active growth query or delivery lease. All seven deliveries were accepted; no outstanding job required cancellation. Mutable baselines were rebased and verified against current metrics.
- All 24 before/after relation fingerprints matched, including preserved growth fields; number sequences and both five-minute cleanup jobs matched. Tuesday 16:00 UTC growth configuration is unchanged.
- Hosted inactive graphs are empty; returned nodes are ACTIVE and expose no private identity fields. New RPC grants permit authenticated owners only; anonymous/service-role execution and direct private traversal are denied.
- Doodle and puzzle cleanup executions succeeded; puzzle cleanup reported zero failures.
- Rollback was not required. Any later compensation must be reviewed against intervening activity and must not blindly restore growth history.

## Production acceptance and approved baseline

The product owner explicitly accepted Task #14.1 after the following production verification. The approved application baseline is **v0.14.1**, release commit `e66fc02e082d27d731ad307f1a4b94544edb347a`, with frozen Master Spec v0.6 unchanged.

- The release deployment was Vercel Ready at `https://atomicbond.ideaordie.com`; Git was synchronized and clean at publication. Hosted migration history was current.
- The verified Atom #4 owner used the production Settings form to save Canada → Ontario. The success message appeared, and Ontario persisted after a full Settings reload.
- Living Atom retained four direct Bonds and nine connected Atoms. Regional reach changed from one region / one country to two regions / two countries, and persisted on a fresh Living Atom load.
- The geographic map placed Atom #4 in the Ontario cluster (one Atom), with the other eight connected Atoms in Florida. The accessible cluster member selector identified Atom #4. Existing Pulse and Network Signal remained visible.
- Atom #4 remains in Ontario by explicit product-owner choice; no restoration is pending. The product owner separately reported testing a location change on another Atom and confirmed all features worked. That second test is user-reported acceptance, not an independently observed browser test.
- Release verification included 333 unit/graph/security tests, 118 integration tests, native PostgreSQL concurrency/restart checks, 81 authenticated browser tests and three responsive lifecycle/map tests. Formatting, lint, TypeScript, production build and secret checks passed. The integration/concurrency/browser evidence was reused from the verified implementation checkpoint; the final 333-test suite and release build were rerun before publication.
- Existing account records, historical Bonds, number sequences, schedules and preserved growth history matched the pre-migration comparison. No rollback was required.

This acceptance record changes documentation only. It introduces no application, schema, participant-data, schedule or specification changes. Existing beta scale and refresh limitations above remain applicable.
