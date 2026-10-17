# Universal 24-hour Bond invitations — v0.16.2

Task #16.2. Baseline v0.16.1, commit
821f435491adbab87b1b842f5b088e545d0a36f3. Production was verified Ready before
local implementation. Publication and the exact v0.8 amendment were subsequently authorized.

## Behavior and authority

Both invitation paths use the same owner-authorized creation RPC. Opening the
chooser creates nothing. Deliberately choosing QR or remote sharing creates or
reuses the owner's one ACTIVE invitation. New records expire exactly 86,400
seconds after creation. Reuse returns the same token and deadline. Acceptance
checks the stored deadline while holding the invitation lock; expiration is
exclusive and independent of cleanup. Explicit recipient confirmation remains
mandatory. Cancellation, lifecycle locking, owner serialization, unique Bond
pairs and single-use consumption are unchanged.

The sender shows hours/minutes/seconds. A returned creation timestamp distinguishes
new 24-hour invitations from reused legacy five-minute invitations, which retain
an ORIGINAL INVITATION DEADLINE label. Share text and recipient pages state the
actual UTC deadline rather than promise another 24 hours from sharing/opening.
The creation timestamp is additive API metadata, not an identity or secret.

## Migration preview and rollout

`supabase/migrations/202610200001_bond_invitation_24_hours.sql` changes only:

- The existing invitation deadline CHECK upper bound, from five minutes to 86,400 seconds.
- The expires_at default for future inserts.
- The existing private creation function's new-invitation duration and additive createdAt response.

There is no row UPDATE/DELETE, new table, policy, grant, credential or schedule.
Public wrappers and function ACLs are preserved. Existing deadlines, identities,
Bonds, tokens, statuses and frozen specifications are not rewritten. The CHECK
still permits shorter legacy records. DDL takes a table lock and validates existing
rows; schedule a short controlled application window and check lock contention.

After approval: verify migration synchronization and recovery readiness; compare
non-secret before-state counts/deadlines and function ACLs; apply the transaction;
verify unchanged existing rows and privileges; deploy the UI; verify read-only
production health. Do not create production invitations merely for validation.
Database first is preferable; the optional createdAt UI tolerates an older server.
Hosted execution and comparison follow the approved publication runbook.

Rollback: reviewed `docs/operations/ROLLBACK_BOND_INVITATION_24_HOURS.sql` restores
five-minute FUTURE issuance atomically. It deliberately retains the permissive
24-hour CHECK so already-issued invitations keep their legitimate deadlines.
A complete restoration of the old CHECK would conflict with retained 24-hour
historical records; do not truncate deadlines or delete history to restore it.

## Security assessment and limitations

Tokens remain 32 cryptographically random bytes, stored as a hash with private
encrypted recovery material for reuse. The longer duration increases the useful
lifetime of a leaked bearer capability by 288 times; entropy is unchanged. A
forwarded invitation can still be used by an eligible person who explicitly
confirms, as before. Owners can cancel. Only one outstanding ACTIVE general
invitation per owner is permitted; expired entries are expired on the next create.

No rate limits are removed or newly introduced. Existing controls are verified
ownership, lifecycle eligibility, owner/row locks, the outstanding-invitation
limit and existing ingress protections. The original invitation architecture does
not implement a dedicated per-owner/IP creation rate limiter; do not describe it
as doing so. Longer-lived invitations do not justify weakening any existing control.

No analytics events are enabled. Existing sensitive-route filtering, no-referrer
headers and private response handling remain. Tokens do not enter application
logs. The capability remains in the invitation URL path, so upstream hosting,
email and recipient/browser history may retain it under their existing policies;
this task does not prove provider log redaction. No absolute no-copy guarantee is
possible for a voluntarily shared link. Avoid screenshots/logs containing real links.

Expired encrypted recovery material is removed on subsequent owner creation or
lifecycle cleanup. There is no newly introduced periodic invitation cleanup or
retention job. Expired records cannot authorize a Bond even while stored. Existing
bounded-retention work remains separate; no unrelated infrastructure is changed.

## Specification and review

See `docs/proposals/MASTER_SPEC_v0.8_BOND_INVITATIONS.md` for the exact proposal.
Frozen v0.7 is unchanged. The approved Section 31 amendment is frozen in v0.8.
Release version: 0.16.2.
Local preview: `/review/invitation` with synthetic data only. Physical iPhone
native share-sheet behavior remains a device verification item; browser mocks
verify cancellation, copy fallback and deadline reuse, not native OS delivery.

## Exact changed-file inventory

- `src/app/bond/[token]/page.tsx`
- `src/app/review/invitation/view.tsx`
- `src/components/auth/BondInvitation.tsx`
- `src/components/participation/BondFlow.tsx`
- `src/services/auth/actions.ts`
- `src/services/bonds/mock-bond-service.ts`
- `src/services/supabase/services.ts`
- `src/utils/invitation-time.ts`
- `supabase/migrations/202610200001_bond_invitation_24_hours.sql`
- `tests/auth-browser/qr-bond.spec.ts`
- `tests/e2e/participation.spec.ts`
- `tests/unit/participation.test.ts`
- `tests/unit/invitation-time.test.ts`
- `tests/integration/bond-invitation-lifetime.test.ts`
- `AGENTS.md`
- `README.md`
- `docs/BUILD_BLUEPRINT_v0.1.md`
- `docs/MASTER_SPEC_v0.8.md`
- `package.json`
- `docs/operations/RELEASE_v0.16.2_PREFLIGHT.md`
- `docs/CHANGELOG.md`
- `docs/architecture/BOND_INVITATION_24_HOURS_v0.1.md`
- `docs/operations/ROLLBACK_BOND_INVITATION_24_HOURS.sql`
- `docs/proposals/MASTER_SPEC_v0.8_BOND_INVITATIONS.md`

## Local verification (2026-10-16)

- 465 unit, graph, integration and security tests passed (80 files).
- PostgreSQL concurrency/restart checks passed, including duplicate invitation creation,
  concurrent acceptance and account lifecycle races with the new migration applied.
- 90 authenticated browser tests passed (nine targeted invitation cases plus 81
  existing authentication/application regressions).
- Three persistence browser tests passed.
- Production build, TypeScript, lint, formatting and privileged-client negative build passed.
- Secret scan found no configured private credential values or private-key blocks in
  tracked/candidate source or generated browser assets. No new credential is used.
- QR and remote flows checked at 390 x 844, 768 x 1024 and 1440 x 900; Light/Dark
  captures are in the ignored local `test-results/auth` directory. QR decoding,
  keyboard actions, visible remote timer, cancellation, copy fallback, reuse,
  expired recipient rejection and explicit mutual confirmation passed.
- Exact database boundary acceptance succeeds immediately before 86,400 seconds and
  rejects at the deadline without cleanup. Migration/rollback tests preserve legacy
  rows, tokens and deadlines, function ACLs and already-issued 24-hour invitations.
- No production invitations, Bonds or participant changes were made. Frozen v0.7,
  production application version and CI configuration remain unchanged. Physical native iPhone
  share-sheet behavior remains unverified.
- General browser suite: 111/114 passed on the initial concurrent run; three Pulse
  animation cases exceeded the unchanged 30-second timeout. All affected cases
  passed in a sequential four-case rerun (mobile and desktop), with no code,
  assertion or timeout changes. This is recorded as test-run timing sensitivity,
  not an unqualified clean initial suite run. No invitation case failed.
