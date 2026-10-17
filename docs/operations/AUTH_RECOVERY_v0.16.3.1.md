# Task #16.3.1 — Authentication recovery investigation (local checkpoint)

Production inspected: v0.16.3, e98cbe7ff1f23ee5e3a3f9a7de4e5f73363b4afd.
Vercel deployment 9f8KGWgx7DDLVYYYwgbDSKTrsgui remains Ready. No production
configuration, Auth records, invitations, Bonds, deployment or database was changed.
Frozen Master Spec v0.8 is unchanged.

## Evidence and limits

- The unmodified local mobile reproduction matrix passed nine existing cases:
  existing/new invited owners, ordinary recovery, fresh context, explicit consent,
  expiry, cancellation and replay. This does not reproduce the reported physical
  iPhone failure or establish provider compatibility.
- A new regression test FAILED on the baseline: create and verify an Atom, reload
  `/auth/confirm`, then try to reach MY ATOM. The valid owner session survives,
  but the client shows the credential-less verification screen and offers no
  MY ATOM recovery. This callback-reload gap also exists in v0.16.2.
- v0.16.3 added a pre-verification NOT NOW action that deletes the envelope without
  consuming its OTP or establishing a session. Its subsequent `/explore` navigation
  sends the signed-out visitor back to entry. This is a confirmed v0.16.3 defect.
- v0.16.3 places the sole authentication credential inside optional invitation
  ciphertext. Rejecting that envelope blocks authentication itself. Existing
  authenticated sessions are not offered recovery on a failed or replayed callback.
- Read-only production diagnostics for an iPhone callback at 2026-10-17 04:32:25 UTC
  show verifyOtp, getUser, my_atom, account_deletion_status and activate_atom calls.
  Its subsequent invitation request includes getUser and my_atom calls. Those
  calls contradict a blanket claim that encryption prevented verification in that
  trace. They do not prove every RPC returned a usable owner or every UI worked.
- No runtime error logs matched the inspected deployment/time interval. Application
  errors are often returned in HTTP 200 Server Action responses; an empty error log
  is not authentication acceptance. Configuration format had been validated at
  publication; this investigation has not read or printed any production secret.
- The exact physical-device failure remains UNCONFIRMED. No real email authentication
  or production test registration was initiated. Ordinary login is passing locally;
  production ordinary email-to-owner completion remains unverified in this incident.

## Local correction

Authentication and optional Bond restoration now fail independently. New invitation
emails carry an independently AES-256-GCM-encrypted access capsule in the URL
fragment alongside the encrypted bound invitation. The provider OTP hash is not
exposed in the new invitation email URL; neither envelope enters the HTTP query or
referrer. Ordinary and previously issued token-hash fragments remain compatible.
The provider remains the only OTP issuer and single-use authority; there is no new
key, credential or migration.

The callback stages credentials and optional context in a purpose-separated encrypted,
Secure, HttpOnly, SameSite=Lax cookie scoped to `/auth/confirm`. Flow IDs are hashes
of high-entropy OTPs; they cannot authenticate without the encrypted cookie. Reopening
one email reuses its flow locator instead of accumulating cookies. Four distinct
staged flows remain the limit. If staging is unavailable, an independently valid
legacy token-hash fragment can still use ordinary verification without invitation
context. New encrypted links retain the bounded staging requirement; finish an
existing staged flow or wait for its bounded cookie expiry if that limit is reached.

The server verifies the OTP first. It restores a Bond destination only when the
continuation is valid, unexpired, and matches that exact OTP and verified user ID
and normalized email. Corrupt/missing/expired/substituted context cannot restore a
Bond; it does not invalidate a legitimate independent login. Signed hook context
binding failure also falls back to an encrypted access-only link. Signature, origin and
OTP validation remain mandatory.

NOT NOW on the callback performs verification and skips only the invitation.
NOT NOW on Bond confirmation still creates no Bond; installation dismissal remains
separate. Reload/error recovery consults verified current-session ownership and
lifecycle, never stale invitation input. It cannot accept a Bond or reactivate an
account. Missing registration details lead to the existing completion form.

Old sealed-only emails remain supported while valid. If an old envelope is corrupt
and contains the only credential, a signed-out user must request a fresh email;
there is no safe way to authenticate unreadable ciphertext. An already verified
owner can recover account access without it. Expired/used provider credentials
remain invalid. Content lost before reaching the browser cannot be reconstructed.

## Recovery assessment and deployment plan

No automatic rollback is recommended solely from this evidence: a broad production
ordinary-login outage is not established, and v0.16.2 retains the callback reload
problem. If the owner confirms ordinary login is broadly unavailable, authorize a
rollback explicitly. v0.16.2 would require fresh emails for outstanding sealed-only
v0.16.3 links and lose secure invitation restoration; it would not change existing
sessions, identities, Bonds or invitation deadlines. Retain the managed key.

The local repair is NOT a declaration that the reported production failure is
resolved. Before publication, obtain the exact device error and reproduce the
reported path or perform approved real-device acceptance. Publish only after
approval and passing final checks. No secret rotation, database migration, frozen
specification change or production test Bonds are necessary. App and email hook
share the same deployment; preserve that arrangement. Use fresh email links for
post-deployment device acceptance. A rollback after new links are issued would
need fresh links because the prior callback prioritizes the old sealed-only flow.

## Test results

Results will be appended after completion. Safari-like user-agent and standalone
simulations are automated Chromium tests, not physical Safari/email/PWA proof.

## Exact changed-file list

- `src/components/auth/ConfirmAccess.tsx`
- `src/services/auth/actions.ts`
- `src/services/auth/email-hook.ts`
- `src/services/auth/invitation-continuation.ts`
- `scripts/test-auth-server.mjs` (loopback-only synthetic fixture)
- `tests/auth-browser/auth-recovery.spec.ts` (new)
- `tests/auth-browser/invitation-continuation.spec.ts`
- `tests/unit/invitation-continuation.test.ts`
- `docs/architecture/INVITATION_AUTH_CONTINUATION_v0.1.md`
- `docs/operations/AUTH_RECOVERY_v0.16.3.1.md` (new)
- `docs/CHANGELOG.md` (explicitly unreleased)

Package version, dependencies, CI, frozen specification, migrations, service worker,
Bond acceptance implementation, invitation deadlines and production configuration
are unchanged. The new continuation codec uses the existing managed key and
AES-256-GCM purpose separation. No new production secret is needed.

## Completed regression evidence

- Baseline nine-case mobile matrix: passed. Newly added callback-reload regression:
  failed on baseline, then passed with the local repair.
- Complete unit/integration/security suite: **472 passed in 81 files**, one thread,
  4 GiB old-space limit. The initial fork run stalled without results and was stopped;
  it is not recorded as passing. No reproducible application assertion or V8 crash
  occurred in the successful run. The fork-stall cause remains undetermined.
- Complete authenticated browser suite: **123 passed** across 390 x 844, 768 x 1024
  and 1440 x 900. Additional legacy/encrypted-format regression results follow below.
- Complete general browser suite: **114 passed** with two workers. An earlier
  overlapping run was deliberately interrupted to avoid output/resource contention;
  the complete bounded rerun is the passing evidence.
- Persistence browser suite: **3 passed**.
- Existing native PostgreSQL concurrency/restart/authorization suite: passed.
- Server-only client-boundary negative build: passed after allowing the required
  child build process. The sandbox-blocked attempt is not passing evidence.
- TypeScript, lint, formatting and production build: passed; final changed-test
  checks and final-build evidence are retained under `artifacts/task1631-*`.
- Tracked/candidate-file credential-pattern scan: passed. No continuation key name,
  AES implementation or continuation AAD markers were found in browser JS chunks.
  This is a bounded pattern/bundle scan, not a claim of exhaustive secret detection.
- Final signed email-hook/crypto tests: **7 passed**, including an invalid optional
  request context falling back to an encrypted access-only email and tampered
  webhook signatures being rejected.

All test emails, owners, invitations and Bonds above are synthetic and local.
Physical iPhone Safari, actual email-client fragment handling, and browser-to-installed
PWA session transfer remain unverified. Browser user-agent and standalone overrides
do not establish real-device compatibility.

## Callback reuse correction during final acceptance

The first final-format run passed 62 cases but caught one intermittent account-switch
failure: opening a second owner's email while already on `/auth/confirm` left the
previous WELCOME BACK screen visible. Five isolated reruns passed, so this is not
claimed as a deterministic reproduction of the reported production failure.
An initial repetition attempt reused synthetic identities and produced fixture
collisions; repeat identities now include the repeat index.

The callback now reloads its document when a new credential-bearing hash arrives
through same-document navigation. The browser preserves the fragment without
sending it in the HTTP request. This discards prior React results and in-flight
callback state; initial page load does not trigger a reload loop. The strengthened
account-switch test explicitly verifies the old document is replaced before the
new credential is processed. Final rerun results follow below; the 62/63 run is
not reported as a pass.

Rollback compatibility clarification: v0.16.3 can still read the valid bound
continuation in new dual-envelope invitation emails. It does not understand new
access-only fallback emails, which require fresh links after rollback. v0.16.2
cannot read either encrypted fragment format. No rollback should rotate the key
or change participant records/invitation deadlines.

## Final candidate verification

- Final encrypted-format and callback-document-isolation browser run: **63/63 passed**
  across all three viewports. Covers all four auth journeys, standalone simulation,
  optional-context corruption/missing/substitution, legacy emails, explicit consent,
  cancellation/expiry, callback reload and installation dismissal.
- Previously intermittent account-switch case: **5/5 additional mobile repetitions
  passed**, using distinct synthetic identities and explicit old-document rejection.
- Final unit/security rerun: **328/328 passed in 54 files**. The unchanged integration
  and graph results from the complete 472-test run remain applicable.
- Final production build, TypeScript, lint, credential-pattern scan and browser-bundle
  boundary scan passed. Light/Dark captures at 390 x 844, 768 x 1024 and 1440 x 900
  were generated; representative captures were inspected without clipping/overflow.
- No commit, hosted migration, secret modification, rollout or production test record.
  HEAD and origin/main remain the approved e98cbe7 baseline; only the listed local
  repair/documentation/test files are modified.

Local review is ready. The production incident is not declared conclusively resolved:
exact phone error details and real-device/provider acceptance are still outstanding.
Publication requires explicit authorization. No unrelated task has been started.

## Publication authorization and physical-device acceptance

The product owner approved publication as v0.16.3.1 — Authentication Flow Repair.
The package version is `0.16.3-1` (SemVer-compatible metadata); the release name is
v0.16.3.1. The approved eleven-file candidate is unchanged except release wording;
`package.json` is the sole additional release-metadata file. No migration, key
rotation, environment change or frozen-specification change is included.

Publication sequence: commit the reviewed candidate, push main, verify Vercel Ready
and the custom domain, wait for Foundation checks, inspect redacted diagnostics,
and confirm main/origin synchronization and a clean working tree. Existing full
local test evidence above remains applicable. Production verification must not
create test accounts, invitations or Bonds.

Physical iPhone Safari and email-to-installed-PWA acceptance remain outstanding:

1. Existing owner: use ACCESS MY ATOM without an invitation, open the new email,
   complete verification, confirm the original MY ATOM, then reload.
2. Existing owner: open a valid invitation while signed out, authenticate using a
   fresh email, and confirm the original invitation returns without automatic Bonding.
3. On a separate intended new participant's device, register through an invitation,
   verify email, finish activation, and confirm the invitation returns.
4. Choose invitation NOT NOW and confirm normal MY ATOM access. Separately dismiss
   the installation invitation; neither dismissal should end the authenticated session.
5. Only when both people intend the real Bond, choose ACCEPT BOND explicitly and
   verify one confirmation. Repeat the login handoff from email to installed PWA.

These are manual acceptance instructions, not authorization for automated production
record creation. Do not send email links, credentials or tokens in test reports.
