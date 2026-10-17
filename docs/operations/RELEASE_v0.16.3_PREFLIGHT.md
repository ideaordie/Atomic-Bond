# v0.16.3 — Invitation authentication restoration preflight (historical checkpoint)

Prepared locally; publication is not authorized. Production baseline remains
v0.16.2 / 2a5651b. No production environment, Auth, database or specification
changes have been made. Frozen Master Spec v0.8 remains unchanged.

## Test-runner investigation

The previous native failure was `jit_page_->allocations_.erase(addr) == 1` on
Node v24.21.0 while running the complete suite in thread workers. This is a V8
native assertion, not an application assertion or a JavaScript heap-OOM message.
The suite uses PGlite/WebAssembly extensively. Node's upstream issue
https://github.com/nodejs/node/issues/66366 reports the identical assertion on
v24.21.0 in WebAssembly code reclamation. This is strong evidence of a runtime/
test-infrastructure interaction, not proof that our exact trigger is identical.
There is no evidence establishing memory exhaustion as the cause.

Controlled command (all tests included, no test/config changes):

```powershell
$env:NODE_OPTIONS='--max-old-space-size=4096'
node node_modules/vitest/vitest.mjs run --pool=forks --maxWorkers=1 --reporter=verbose
```

The 4 GiB setting limits JavaScript old-space per process, not total native/WASM
memory. One worker prevents concurrent suite workers; test bodies and assertions
are unchanged. The earlier thread crash is not grounds to disable security tests.
A separate PGlite-only control with two workers, each creating/querying/closing
three databases, passed. Thus the crash is not deterministically reproduced by
that minimal control. No Node dependency, CI or production runtime was changed.

Full controlled run: **81 files, 470 tests passed, zero skipped**, exit 0,
267.91 seconds. No native crash reproduced with this configuration. Output is
retained locally in artifacts/task163-preflight-unit.log. This establishes a
passing complete suite, not a guarantee that the upstream intermittent runtime
bug cannot recur under other worker patterns.

## Security acceptance

The 18 targeted browser cases passed at 390 × 844, 768 × 1024 and 1440 × 900.
They exercise fresh-context email entry, callback reload, explicit acceptance,
OTP replay, expiration/cancellation during authentication, safe dismissal,
corrupted ciphertext, parallel flows, and another existing authenticated session.
An added check swaps two encrypted cookies under the wrong flow locator: the
server rejects it before authentication. Tests use only isolated synthetic data.

The previous unchanged-application regression run passed 108 authenticated,
114 general and 3 persistence browser tests, including ordinary login,
registration, reactivation, deletion, installation invitation and standalone
return. PostgreSQL concurrency/restart, TypeScript, lint and production build
also passed at that checkpoint. Final metadata/format checks are recorded below.

AES-256-GCM uses a random 96-bit IV, 128-bit authentication tag, and purpose-specific
AAD. The request is bound to normalized email and its original deadline; the
signed Auth email hook binds the final envelope to the exact user ID and OTP.
It expires at the earlier of one hour or the existing invitation deadline.
Neither browser storage nor a flow locator alone can redeem it. HttpOnly,
Secure-in-production, SameSite=Lax cookies are scoped to /auth/confirm. OTP
single-use verification remains authoritative, followed by existing owner and
Bond eligibility checks. Login never invokes Bond confirmation.

A different existing session cannot substitute its identity. Possession of the
complete unexpired email link remains possession of a passwordless bearer
credential: opening it can authenticate as the intended recipient. This design
does not claim to prevent stolen-email-link login. Multiple links do not overwrite
one another, but provider OTP invalidation rules still apply.

## Secrets and privacy

AUTH_CONTINUATION_KEY must be a cryptographically random 32-byte value encoded as
64 lowercase hexadecimal characters, stored as a server-only managed environment
secret. It is never NEXT_PUBLIC. Application code has no hardcoded key. The fixed
fixture key in Playwright/unit tests is deliberately synthetic, not a production
secret and must never be provisioned. .env.example contains a blank placeholder.
No production key has been created or inspected.

Built .next/static assets contain neither AUTH_CONTINUATION_KEY nor the crypto
module's purpose marker. Credential-pattern scanning of tracked and candidate
files found no matching production credentials; pattern scanning is not exhaustive.
Auth actions/hook return generic errors and do not log envelopes, decrypted data,
OTP or invitation tokens. Analytics rejects auth/bond routes, queries, fragments
and unsafe referrers; those routes use no-referrer and private/no-store responses.
Email contains the envelope in the fragment, never plaintext invitation data in
the auth redirect. The provider sees opaque request ciphertext, which must still
be treated as sensitive. Original invitation URLs retain the known upstream URL-
log/history limitation. No claim is made about uninspected provider log retention.

## Environment and rollout requirements — approval still required

1. Provision one dedicated managed secret consistently for production application
   and its signed email-hook host. Keep preview/development environments isolated;
   do not expose production keys to unrelated preview deployments or test fixtures.
2. Confirm exact allowed origins and the existing Auth callback allowlist accept
   the sealed next query. Keep email link tracking disabled. No migration required.
3. Deploy application and hook together. New invitation login fails closed if the
   key is absent/mismatched; ordinary login remains available. Old unsigned
   invitation access emails authenticate but request reopening the original invite.
4. Perform an approved real email/device acceptance after deployment; local provider
   tests cannot establish production provider/client behavior. No production test
   invitation or registration was generated for this preflight.
5. Rotation invalidates existing continuation envelopes. Coordinate all active
   servers, request fresh email links, and preserve sessions/Bonds/deadlines. A
   rollback to old code cannot decode new envelopes; use fresh access, then reopen
   the original invitation. Do not restore unsigned binding or extend deadlines.

## Platform evidence and remaining limitations

Automated Chromium tests cover a fresh cookie jar, reload, and another existing
session at mobile/tablet/desktop sizes. Existing PWA tests simulate standalone
and iOS instruction selection. This is not physical Safari or real email-app
handoff verification. Email opening in Safari does not ensure session transfer to
an installed iOS PWA. Physical iPhone/Safari/email/PWA acceptance remains required.
A completely stripped email fragment cannot be recovered; request a fresh link.
The original production context-loss point remains unconfirmed.

Do not commit, deploy, provision secrets or amend the frozen specification until
final publication authorization. No new application features are included.

## Exact candidate file list

- `.env.example`
- `docs/CHANGELOG.md`
- `docs/architecture/AUTH_EMAIL_v0.1.md`
- `docs/architecture/INVITATION_AUTH_CONTINUATION_v0.1.md`
- `docs/operations/RELEASE_v0.16.3_PREFLIGHT.md`
- `docs/proposals/INVITATION_AUTH_CONTINUATION_v0.1.md`
- `package.json`
- `playwright.auth.config.ts`
- `scripts/test-auth-server.mjs`
- `src/app/bond/[token]/page.tsx`
- `src/components/auth/BondConfirmation.tsx`
- `src/components/auth/ConfirmAccess.tsx`
- `src/services/auth/actions.ts`
- `src/services/auth/email-hook.ts`
- `src/services/auth/invitation-continuation.ts`
- `tests/auth-browser/invitation-continuation.spec.ts`
- `tests/auth-browser/ownership.spec.ts`
- `tests/auth-browser/qr-bond.spec.ts`
- `tests/security/deployment.test.ts`
- `tests/unit/invitation-continuation.test.ts`

Package metadata is prepared as 0.16.3; README continues to identify the actual
production release as v0.16.2 until publication. No dependency/lockfile change.
TypeScript and lint passed in this preflight. All existing browser regression
evidence remains applicable because no application logic changed during it.

Final production build and repository formatting passed. Frozen v0.8, migrations,
CI workflow and dependency lockfile are unchanged. Final tracked/candidate-file
credential-pattern scan passed. No code/security blocker was found in this
preflight. Publication still requires explicit authorization, managed secret
provisioning and consistent application/email-hook deployment; real provider and
physical iPhone/PWA acceptance remain disclosed verification limitations.

## Publication authorization addendum

The product owner subsequently approved publication and saved the dedicated
managed Production Secret. Its metadata was verified without revealing its value.
The Send Email hook targets the same production custom domain and application.
A narrowly scoped Production build/cold-start key validation guard was added
for the required runtime verification; eight focused cryptographic/deployment
tests passed, including missing/malformed key cases. This adds one test to the
470-test preflight inventory. No CI, schema, Auth policy or frozen-spec changes.
README is also updated for the release. Publication status is reported separately
after hosted deployment and Foundation checks complete.
