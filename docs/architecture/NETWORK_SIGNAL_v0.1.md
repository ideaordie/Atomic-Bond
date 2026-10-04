# Network Signal v0.1 — Task #10

Version: 0.10.0, persistent Network Signal. The owner published the first
welcome Signal; this correction does not change that record or publish another.

## Purpose and presentation

Occasional global COMMUNITY or ATOMIC_BOND announcements appear beside Network
Overview above Create Bond/Pulse. On narrow screens the information cards stack.
No active record shows NO CURRENT SIGNAL; request failure shows SIGNAL UNAVAILABLE.
The expanded panel contains the complete text, publication time and optional HTTPS
CTA. Text is rendered as text, never HTML. No feed, targeting, email or push exists.

## Authorization

`private.signal_administrators` stores Auth user membership, with cascading removal
when that Auth identity is deleted. No email or fixed Auth UUID is in source.
Every admin RPC calls `private.require_signal_admin`: existing verified ownership,
live Auth session and lifecycle cutoff, ACTIVE Atom, explicit membership. Deactivated
and deleted owners fail. `/admin/signals` is not in ordinary navigation and separately
checks the RPC. Route hiding is not authorization. Server Actions enforce same origin.

No new server secret or service-role client is used. Owner-session clients call
named RPCs. Tables have RLS with no client table grants/policies. Private helpers
are not callable by ordinary authenticated/anonymous/growth roles. Existing Auth,
Bond, Pulse, growth and lifecycle functions are unchanged.

## Operations and membership

After migration and ownership verification, an authorized database operator may
invoke `private.provision_signal_administrator(public_number, enabled)` using the
existing secure CLI/database administration workflow. This function is not granted
to application clients; there is no self-enrollment. Atom #3 is the explicitly
approved initial administrator. Public number is only an operator lookup, never
runtime proof. Revocation uses the same function with false and takes effect on
the next request. Administrative role changes are operational actions, not UI features.

Admin RPCs: `signal_admin_history`, `save_signal_draft`, `publish_network_signal`,
`end_network_signal`. `current_network_signal` is the separate ACTIVE-owner read.
All return only their purpose-specific data. No administrator identifier appears
in display payloads. History includes the latest 50 records plus the current active Signal if older.

## Content and lifecycle

Titles are at most 80 characters, messages 500 and CTA labels 40. One CTA is optional;
label and URL must be paired. Both application and database reject unsafe schemes,
credentials, whitespace and backslashes. HTTPS links open externally with noopener.
SPONSORED is reserved in storage but cannot be authored/published in the beta;
future enablement must include explicit visible sponsorship labeling and approval.

Records store DRAFT/PUBLISHED/UNPUBLISHED. Database time derives SCHEDULED, ACTIVE
and EXPIRED from a published half-open [start,end) interval. No cron is needed.
Admin time inputs explicitly use UTC. Saving never publishes. Editing invalidates
preview; publication requires a saved preview. Published records are immutable
through the draft operation; create a new draft instead.

Publication takes a transaction advisory lock, rejects intersecting publication
windows and optionally ends an explicitly named currently ACTIVE replacement in
the same transaction. A stale replacement or conflict rolls back everything.
Scheduled conflicts must be explicitly ended before scheduling. Multiple disjoint
future windows are allowed; at most one is effective at a time. Direct application
table writes are denied, so clients cannot bypass this controlled operation.

## Persistent delivery and closing

Reads are independent of graph size. Active owners poll every 30 seconds while the
page is visible and refresh on focus. Changes appear on the next successful read;
database time always decides eligibility. Private responses are not service-worker
cached. Public anonymous views receive no Signal panel. Every eligible owner receives
the same record, independent of geography, emotions, identity or graph position.

The compact panel persistently represents the current authoritative Signal. Closing
the expanded view only closes that view; it never changes publication or visibility.
There is no dismissal control or browser-storage state used for Signal visibility.
A narrow cleanup removes obsolete Signal dismissal keys from the initial candidate
when the network mounts; it creates no new keys and touches no other storage.
If browser storage is unavailable, those inert keys are ignored.
Reloading or navigating away/back still shows the active Signal. Only administrator
replacement, unpublication or database-time expiration removes it. No forced popup
is introduced; the expanded view remains independently closable.

## Migration and rollout

`202610060001_network_signal.sql` adds two private RLS tables, an index, constraints,
private authorization/projection/provisioning helpers and five authenticated RPCs.
It seeds no memberships or messages and changes no participant/network data.
Preview hosted history, diff existing participant/Bond/Pulse/preference integrity,
apply only this migration, then provision Atom #3 and verify authorization.
No production publication is permitted until separate explicit approval.

Local tests may publish synthetic Signals only in isolated test databases. Live
acceptance creates/previews a draft and stops before publishing. Membership history,
Auth identifiers and secrets must never be included in operational reports.

## Candidate verification

Version 0.10.0-rc.1 passed 234 unit/integration/security tests, native PostgreSQL
concurrency/restart checks, 81 main browser cases, 3 persistence cases and 51 Auth,
QR, lifecycle, growth and PWA browser cases. Timing-sensitive animation and isolated
offline-navigation failures passed targeted reruns without changing their assertions.
Signal request-failure recovery also passed at all three viewport sizes.
Formatting, lint, TypeScript, production build and configured-secret scans passed.

Migration 202610060001 is applied. Existing Atom, Bond, private identity, invitation,
preference, Pulse and number-sequence integrity comparisons are unchanged. Atom #3's
verified ownership was resolved and membership provisioned through the controlled
operator function. The candidate deployed successfully on the production custom
domain. Atom #3 opened the admin route and saved/previewed WELCOME TO THE BETA as
one DRAFT; the ordinary owner-facing panel still showed NO CURRENT SIGNAL.
Anonymous production admin access was denied. No production Signal was published.
The owner subsequently published the first welcome Signal and approved persistent
compact visibility in place of dismissal. Replacement and expiration retain their
automated coverage; the existing production welcome Signal must not be changed
merely for testing this correction.
