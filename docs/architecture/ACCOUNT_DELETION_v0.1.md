# Account deletion and dormancy — Task #9.2

Status: pre-implementation audit and proposal. No deletion capability or migration
has been implemented or applied. This document does not claim release acceptance.

## Approved product policy

DELETE ACCOUNT is an explicit owner action with two confirmations and recent
passwordless authentication. Inactivity never deletes an account. DORMANT remains
owned, recoverable and structurally present; automatic dormancy timing is deferred.

Deletion removes personal identity, optional profile, home-region association,
Pulse, preferences and access. The permanent Atom number and confirmed Bonds
remain as an anonymized structural tombstone. Numbers are never recycled.
Rejoining with the same email creates a new Atom without the former Bonds.
Atom #3 must never be used for destructive acceptance testing.

## Verified starting baseline

- Application version 0.9.1, main commit
  `7bc6b5887ed2a49666c9dff1bec60d52371d2f5b`.
- After fetching origin, main and origin/main matched; working tree was clean.
- Hosted migration history matches all six local migrations through
  `202610030002_growth_rpc.sql`.
- Vercel reported this commit as the Ready production deployment; the custom-domain
  About page loaded successfully during the audit. This is a route/deployment
  health check, not a new transactional email or destructive live test.

## Current implementation audit

| Area                 | Current behavior and required change                                                                                                                                                                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lifecycle            | PENDING, ACTIVE, DORMANT and DELETED exist. No automatic inactivity deletion or dormancy job was found.                                                                                                                                                                          |
| Tombstone            | Atom row deletion is blocked by `private.protect_atom`. DELETED cannot reactivate. Setting DELETED alone does not scrub identity or related data. No owner deletion RPC/UI exists.                                                                                               |
| Number               | Unique bigint sequence and append-only ledger; assigned at activation. Existing public numbers cannot change. Preserve both protections unchanged.                                                                                                                               |
| Bonds                | UUID foreign keys reference retained Atom rows without cascade deletion. Confirmed Bond rows can survive status DELETED. They are currently hidden from graph traversal when an endpoint is DELETED.                                                                             |
| Graph                | `private.reachable` and `public.public_graph` accept only ACTIVE/DORMANT. Deleting bridge B currently disconnects A from C in the retrieved graph. This conflicts with the newly approved structural-retention policy.                                                           |
| Identity             | Unique normalized email/Auth-user association has a foreign key to `auth.users` without cascade. No cleanup operation exists. Remove the private identity before Auth-user deletion; otherwise the foreign key blocks it.                                                        |
| Auth                 | Owner actions validate Supabase Auth and derive ownership using private identity. There is no Auth-admin deletion adapter or recent-authentication deletion gate. Local-device sign-out exists.                                                                                  |
| Location             | `atoms.location_id` is NOT NULL and graph projection uses an inner join. An anonymized tombstone needs nullable location restricted to DELETED, with a safe projection that omits geography. Existing canonical location rows remain unchanged.                                  |
| Public serialization | Allowlisted public fields exclude private identity and emotion, but there is no tombstone discriminator and the profile parser requires location. Add an explicit safe tombstone representation.                                                                                 |
| Pulse                | One current Pulse row per Atom, 24-hour lifetime. No cleanup on DELETED transition. Current reads exclude deleted nodes indirectly through traversal; after traversal changes, explicitly exclude DELETED Pulse owners too.                                                      |
| Invitations          | Current resolution/acceptance rejects ineligible creators, but status change does not cancel invitations or erase encrypted token recovery. Cleanup and shared lifecycle locking are needed.                                                                                     |
| Preferences          | Private preference row and current provenance remain until explicitly removed. Deletion must remove them rather than retain unnecessary notification information.                                                                                                                |
| Growth               | Eligibility already excludes DELETED/DORMANT/unverified owners. Delivery rows additionally retain recipient email and encrypted unsubscribe capabilities; removing only `atom_identities` is insufficient. Delete the account's growth state and delivery payloads/capabilities. |
| Send race            | Claim/authorize recheck eligibility, but authorization and the external Resend call are separate operations. A send already handed to Resend cannot be recalled. A prepared reservation must be invalidated, and in-flight coordination must be tested explicitly.               |
| Counts               | `networkReach.people`, emotional `connectedCount` and growth `connectedAtoms` count reachable nodes. Current graph membership excludes DELETED, so including tombstones without updating language would misleadingly count them as people.                                       |
| Sessions/PWA         | HttpOnly cookies and server owner checks exist; the worker caches only generic offline assets. Removing identity must deny stale owner operations immediately, clear the current browser session and return to anonymous entry. Installed PWA remains installed.                 |

Source of truth for this audit: migrations, `services/auth`, `services/growth`,
`data/supabase/projections.ts`, `graph/metrics`, and `components/auth/OwnerSettings.tsx`.
Older architecture release records describing deletion as deferred are historical.

## Proposed implementation for review

### Owner flow and authentication

Add a separated ACCOUNT area at the bottom of Profile & Preferences. First show
the consequences and Cancel/Continue. Final confirmation requires typing DELETE
and an explicit final button; neither opening the panel nor an email callback deletes.

Require a passwordless authentication event within the preceding ten minutes,
validated from trusted Auth/session information, not JWT refresh issuance time or
browser state. Older sessions use the existing email verification flow with a
narrowly allowlisted return to the deletion confirmation. Recheck recency and
ownership at the authoritative operation. No passwords or parallel identity system.

### Auth administration boundary — requires approval

Recommend a separate server-only account-deletion adapter using the supported
Supabase Auth Admin `deleteUser` API, with a separately rotatable secret dedicated
operationally to this purpose. Do not reuse or widen the growth worker adapter.
Only the authenticated, recently verified owner's server-resolved Auth identity
may be passed to that adapter. No public arbitrary user-ID deletion endpoint.

The Supabase secret is nevertheless broadly privileged: naming the key and limiting
the adapter do not make it database-enforced least privilege. This is a material
new Auth-administration boundary requiring approval under AGENTS.md section 13.
Affected modules: owner server actions, a private deletion adapter/service,
environment configuration, version-controlled deletion RPCs, tests and operations.

Alternative: delete `auth.users` inside an owner-scoped SECURITY DEFINER transaction.
That avoids a new secret and external partial completion, but couples application
migrations to Supabase-managed Auth schema and cleanup internals. Prefer the
supported Auth Admin API and an explicit recoverable deletion workflow.

### Transaction and failure recovery

Proposed first transaction derives the owner from the authenticated request, locks
the Atom, permanently retires access, anonymizes the Atom, removes private identity,
Pulse, preferences, growth records/capabilities, and invalidates outstanding
invitations. Retain confirmed Bonds and the number. No migration-wide anonymization
or deletion of existing participants is permitted.

Retain only the minimum private pending-cleanup reference needed to remove the
specific Auth user. Guard registration/activation against that pending Auth identity,
so stale Auth metadata or a failed Auth-admin request cannot recreate access or
silently register a replacement Atom. Retry Auth cleanup idempotently; clear the
temporary reference after confirmed success. Do not claim complete removal while
Auth cleanup remains pending. Pending references must not be public or logged.

Database anonymization commits before external Auth removal, so an Auth outage
cannot restore ownership or engagement eligibility. Clear local cookies/client
state and deny stale sessions through authoritative ownership checks. Deleting an
Auth user alone does not immediately invalidate every previously issued JWT.

Serialize Bond confirmation, Pulse writes and deletion using a consistent lock
order and lifecycle recheck. Cancel prepared growth deliveries. Coordinate already
authorized sends before reporting deletion complete; test the authorization/send
gap, not only the simpler reserve/delete/claim sequence. Provider-accepted email
cannot be recalled, and provider retention/backups must not be described as erased
by application database cleanup.

### Metrics and public view — proposed clarification

- Preserve traversal through numbered DELETED tombstones and confirmed Bonds.
- Define **Connected Atoms** as structural reach, including tombstones. Use Atoms,
  not people/active users, for that count and disclose retained deleted records.
- Define participant counts separately, excluding DELETED. DORMANT remains a
  participant, but is not described as currently active.
- Direct Bonds continue counting retained confirmed relationships.
- Emotional coverage counts only eligible non-deleted participants; percentages
  still use active authorized Pulses only. Tombstones carry no emotion.
- Regional/country reach excludes removed location associations. Counts may decline
  when the last participant associated with a region deletes; do not fabricate a
  location to retain historical metrics.
- Growth summaries retain structural connected-Atom/Bond semantics, with clear
  terminology; never treat a deletion or a migration as newly acquired growth.
- Explicit `/a/<number>` shows ATOM #number / DELETED and retained structure only.
  No former name, X, location, Pulse, private data or owner controls. Isolated old
  verification tombstones are not automatically selected as the public default.

## Verification and release gates

Before hosted changes, implement and test migrations locally, enumerate affected
tables/functions/triggers/grants, review exact pending migration history and confirm
no existing ACTIVE profile, Bond or number is modified by migration application.
No hosted migration or account deletion has been performed for Task #9.2.

Tests must cover two-stage cancellation, recent/stale authentication, anonymous and
cross-owner denial, privacy cleanup, stale sessions, same-email re-registration,
number retention, A–deleted B–C traversal, counts, geography, Pulse cleanup,
invitation invalidation, pending digest suppression, concurrency, idempotency and
Auth-admin failure/retry. Preserve full regression/security/build and responsive
390×844, 768×1024, 1440×900 coverage.

Controlled live acceptance requires an explicitly designated disposable identity,
never Atom #3 or another genuine participant. Do not send verification mail or
create/delete a hosted participant until the controlled identity is approved.
Document consumed numbers without resetting them. Physical PWA behavior and inbox
acceptance must be distinguished from local automated simulations.

Update README, changelog and beta About copy when implementation is verified.
Keep the frozen Master Specification unchanged. This audit document alone does
not satisfy Task #9.2 implementation or live acceptance.

References: [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data),
[Auth Admin deletion](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser),
[JWT claims](https://supabase.com/docs/guides/auth/jwt-fields),
[session revocation](https://supabase.com/docs/guides/auth/signout).
