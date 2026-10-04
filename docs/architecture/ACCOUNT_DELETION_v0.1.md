# Account deletion and dormancy — Task #9.2

Status: v0.9.2 controlled-acceptance candidate. Local verification passed and the
reviewed migration is applied. The separate secret is configured in local and
Vercel Production environments. Controlled live acceptance remains pending; this
is not a completed production acceptance report.

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

## Pre-implementation audit (historical starting state)

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

## Approved design from the audit

### Owner flow and authentication

Add a separated ACCOUNT area at the bottom of Profile & Preferences. First show
the consequences and Cancel/Continue. Final confirmation requires typing DELETE
and an explicit final button; neither opening the panel nor an email callback deletes.

Require a passwordless authentication event within the preceding ten minutes,
validated from trusted Auth/session information, not JWT refresh issuance time or
browser state. Older sessions use the existing email verification flow with a
narrowly allowlisted return to the deletion confirmation. Recheck recency and
ownership at the authoritative operation. No passwords or parallel identity system.

### Auth administration boundary — approved for implementation

Recommend a separate server-only account-deletion adapter using the supported
Supabase Auth Admin `deleteUser` API, with a separately rotatable secret dedicated
operationally to this purpose. Do not reuse or widen the growth worker adapter.
Only the authenticated, recently verified owner's server-resolved Auth identity
may be passed to that adapter. No public arbitrary user-ID deletion endpoint.

The Supabase secret is nevertheless broadly privileged: naming the key and limiting
the adapter do not make it database-enforced least privilege. This is a material
new Auth-administration boundary approved under AGENTS.md section 13 when the
user instructed implementation to proceed after the audit.
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
The implementation checkpoint below records hosted migration status. No controlled
account deletion has yet been performed for Task #9.2.

Tests must cover two-stage cancellation, recent/stale authentication, anonymous and
cross-owner denial, privacy cleanup, stale sessions, same-email re-registration,
number retention, A–deleted B–C traversal, counts, geography, Pulse cleanup,
invitation invalidation, pending digest suppression, concurrency, idempotency and
Auth-admin failure/retry. Preserve full regression/security/build and responsive
390×844, 768×1024, 1440×900 coverage.

Controlled live acceptance requires an explicitly approved identity, never Atom #3.
The user explicitly approved existing Atom #8 for this destructive acceptance test.
No other participant is authorized for deletion. Owner authentication and both
confirmation stages still apply; approval is not a bypass of owner authorization.
Document consumed numbers without resetting them. Physical PWA behavior and inbox
acceptance must be distinguished from local automated simulations.

Update README, changelog and beta About copy when implementation is verified.
Keep the frozen Master Specification unchanged. This audit document alone does
not satisfy Task #9.2 implementation or live acceptance.

References: [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data),
[Auth Admin deletion](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser),
[JWT claims](https://supabase.com/docs/guides/auth/jwt-fields),
[session revocation](https://supabase.com/docs/guides/auth/signout).

## Implemented local architecture

Migration `202610040001_account_deletion.sql` adds nullable location only for
DELETED Atoms and an RLS-protected `private.account_deletions` recovery marker.
It does not update existing participants, Bonds, public numbers or preferences.
The marker contains only Auth UUID, Atom UUID and creation time, and is erased
when Auth removal has completed. It is not an identity-history archive.

Authenticated RPCs `account_deletion_status()` and `delete_my_account(text)`
use the verified request identity. Deletion requires literal DELETE, a live
`auth.sessions` row and an OTP/magic-link AMR timestamp within ten minutes.
Refreshing a JWT does not make its original authentication recent. The UI first
explains consequences, then requires typed confirmation. Both stages can cancel.
Older authentication uses the existing passwordless flow and a fixed allowlisted
`/account/delete` return. Following the email does not itself delete anything.

The database transaction removes private identity, location association, alias/X,
Pulse, preferences, growth baselines/deliveries and invitation secrets, and cancels
active invitations. Confirmed Bonds remain. The existing number ledger/sequence
and anti-reactivation trigger are unchanged. `guard_retired_identity` prevents
pending Auth cleanup from registering again through stale registration metadata.

The separate `server-only` Auth adapter checks `account_cleanup_pending(uuid)`
before calling supported Auth Admin deletion, then calls
`account_cleanup_finish(uuid)`. These two RPCs are service-role only, and finish
will not erase the marker while the Auth user still exists. The adapter accepts
only a separate `SUPABASE_ACCOUNT_DELETION_SECRET_KEY`; it rejects the growth
credential and public keys. No generic admin client is exported to UI or owner
services. The secret still has broad Supabase authority; the narrow adapter is an
application boundary, not database-enforced least privilege.

On successful removal, sign out globally, clear Auth cookies and replace the page
with `/account/deleted`, clearing the client component tree. Other sessions fail
Auth/ownership checks. PWA installation remains; its next authenticated request
resolves anonymously. The service worker stores no owner, deletion, Auth or graph
responses. Already-open devices may briefly show stale pixels until their next
request; they cannot make authorized owner changes.

## Failure recovery and operational configuration

Create a separately named Supabase secret for account deletion and place it only
in local/Vercel server configuration as `SUPABASE_ACCOUNT_DELETION_SECRET_KEY`.
Never paste it into chat, URLs, source or command arguments. Rotation replaces
that environment value and redeploys; revoke the old key after verification.
Emergency shutdown: remove/revoke this key. The server checks configuration before
starting anonymization. Do not disable existing growth or transactional keys.

If Auth removal fails, the Atom is already anonymous and inaccessible, with no
Pulse, private identity or engagement eligibility. The UI reports cleanup pending
and offers a retry while the Auth session exists. A reload through `/owner` routes
to cleanup. If Auth removal succeeded but marker completion failed, the session
may no longer resolve. An operator must then use the same server-only adapter's
`finish` operation on the protected pending marker's Auth UUID. It tolerates
`user_not_found` and only clears the marker after confirming Auth absence. Do not
restore identity/profile data or grant the former session ownership as recovery.
Review pending markers promptly; they are temporary operational data, not desired
long-term retention. No secret-bearing admin HTTP recovery endpoint is exposed.

After Auth cleanup, explicit CREATE MY ATOM with the same email can verify a new
Auth identity and receive a new sequence number. ACCESS MY ATOM cannot restore the
retired account. Existing Bonds are not inherited. Supabase/provider backups and
already-delivered emails are outside live application-row deletion; no claim of
instant erasure from those external retention systems is made.

## Concurrency and send-time boundary

All eight owner write RPCs and seven growth operations acquire the same short
transaction advisory lock before existing row locks. This deliberately serializes
these small pilot writes and prevents inconsistent lock ordering; it does not hold
a database connection/lock across HTTP. At larger scale, replace it with carefully
ordered per-Atom locks only after equivalent race tests pass. Original RPC bodies
are retained as private, revoked helpers; existing public signatures stay stable.

Deletion cancels prepared/claimed but unauthorized digests by removing their
records. A worker must pass the existing authoritative send authorization before
Resend. If a send has already been authorized and its five-minute lease remains
live, deletion returns `delivery_in_progress` with no mutation; the user retries
after settlement. The scheduler refuses an authorization delayed over ten seconds,
and the existing provider transport has an eight-second timeout. An external
provider handoff already in progress cannot be recalled. This is an explicit
ordering boundary, not a claim of a distributed transaction with Resend.

Deletion versus Pulse leaves no Pulse on a tombstone; deletion versus confirmation
allows only a Bond committed before deletion, otherwise rejects confirmation.
Repeated deletion returns the same pending-cleanup result without a new tombstone.

## Migration preview and release gates

Affected objects: atoms location constraint; private account_deletions table/RLS;
identity guard trigger; lifecycle lock; eight owner RPC wrappers/private originals;
seven growth-job wrappers/private originals; four deletion/cleanup RPCs;
reachable/public_graph/connected_emotional_pulses projections. No broad DELETE,
sequence reset, public-number update, Auth schema mutation or existing participant
anonymization runs when applying the migration. DELETE statements are confined to
the explicitly owner-authorized operation. Anonymous/browser roles receive no
private table or Auth-admin grants. Growth role gets no deletion privileges.

Before hosted application, compare pending history and preview exactly this file.
Take read-only counts/hashes of current ACTIVE/Bond/number state and verify them
unchanged after migration. Do not apply unexpected migrations. Configure the
separate secret before offering production deletion. Local tests are not hosted
acceptance: use a designated disposable test participant, never Atom #3. Verify
email/confirmation, retained number/Bonds, Pulse/privacy cleanup, anonymous PWA
return and optional fresh-number re-registration. Record consumed numbers without
resetting them. Publication remains a separate checkpoint after local review.

## Candidate verification checkpoint — 2026-10-04 UTC

- Formatting, lint, TypeScript, 219 unit/integration/security tests (including
  21 database tests), client-bundle boundary checks, native PostgreSQL concurrency
  and restart checks, and production build passed.
- Main browser coverage passed across all 81 cases, with two animation timeout
  cases passing on an isolated rerun. Persistence browser checks passed 3/3.
  Final complete authentication/QR/PWA/deletion browser run passed 45/45.
- Deletion confirmation and public tombstone were checked at 390×844, 768×1024
  and 1440×900. An installation test now explicitly waits for React hydration
  before advancing its clock; application installation behavior is unchanged.
- Repository/browser-bundle secret scan found no configured credential leakage
  or unintended tracked artifacts. Master Spec remains unchanged.
- Hosted migration `202610040001` applied alone. Local/hosted histories match.
  Before/after profile/number and Bond integrity hashes match: 7 ACTIVE Atoms,
  2 existing tombstones, 8 confirmed Bonds, sequence value 9. Atoms #3 and #8
  remain ACTIVE. No pending deletion marker exists.
- Hosted grants confirm anonymous and growth-role deletion denial, private
  recovery-table RLS/read denial, owner-only deletion and server-only Auth cleanup.
- Atom #8 is explicitly approved for the upcoming owner-authenticated live test.
  Inbox interaction, actual deletion, cleanup verification and physical PWA
  acceptance remain pending. No claim of live deletion success is made.
