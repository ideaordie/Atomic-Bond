# Task 16.4 — isolated new-Atom invitation continuity

Local implementation accepted; controlled v0.16.4 publication authorized by the
product owner. Pre-publication production and synchronized main/origin/main were
verified at recovery baseline `f9b2aa66e7001f972178832c6f9b01aae2df6b73`, with v0.16.2 application behavior.
Frozen Master Spec v0.8 and all migrations remain unchanged.

## Implementation and authority

Only invitation-originated CREATE MY ATOM selects the new registration action.
Switching to ACCESS MY ATOM still selects the existing requestAccess action.
Ordinary registration, completeAccess, ConfirmAccess, auth/server and auth/policy
remain unchanged. The shared form and confirmation component have opt-in behavior;
their existing-owner defaults are preserved.

The request action validates Home Region and the current invitation through existing
RPCs. It seals optional metadata using AES-256-GCM, random 96-bit IVs and a distinct
new-registration v1 domain. The existing AUTH_CONTINUATION_KEY format is 32 bytes
encoded as 64 hexadecimal characters. No new production credential is required.

Only a verified, signed signup email hook can bind that request to the provider user
ID and SHA-256 digest of the exact verification token. Magic-link email construction
is unchanged. A static, non-secret registration_invitation=1 redirect marker is also
required, so a later ordinary registration cannot reuse old optional metadata.
Editable user metadata or the marker alone is not sufficient authority. A bad receipt or
missing key produces an ordinary verification email instead.

The normal verification token remains intact in the dedicated email fragment; it
is never wrapped inside the optional receipt. No invitation is in the Auth redirect
query. The callback retains the fragment until verification so pre-verification
reload does not discard the only credential. It clears the fragment after success.
Fragments do not enter HTTP request URLs/referrers, but remain sensitive to browser
extensions, a compromised browser, and email-provider processing. No worldwide
upstream-log or email-retention guarantee is made.

After actual OTP verification, the new action resolves the server-verified user and
uses the existing registration/activation action. A valid optional receipt is bound
to that user's authenticated session ID in an encrypted HttpOnly, Secure, SameSite
Lax cookie scoped to /auth/register. Incomplete Home Region details use the existing
form at a dedicated recovery route. An invalid receipt cannot block activation.

The fixed /auth/register/invitation route reads current invitation eligibility and
uses the existing BondConfirmation component. ACCEPT BOND invokes the unchanged
confirmOwnerBond operation; the raw invitation is not sent as a component property.
NOT NOW clears only the optional intent cookie and opens MY ATOM. Acceptance also
clears it. Existing database expiration, cancellation, mutual consent and atomic
single-use acceptance remain authoritative.

Only successful OTP verification can stage intent. A replayed email cannot restage
it through an existing session. Callback recovery may resume an already staged,
session-bound intent or open MY ATOM. Copying its cookie to a different user/session
does not authorize it. A user restoring their own previously saved session cookie
could reopen an unconsumed invitation until its deadline; this is not a durable
server-side revocation ledger. It cannot create duplicate Bonds or bypass consent.

## Privacy and retention

The original invitation URL remains a bearer capability, subject to the documented
upstream URL-log limitation. New dedicated routes inherit /auth no-store/no-referrer
headers, Analytics allowlist exclusion and the existing no-runtime-data-cache service
worker. No analytics event or application logging was added.

Request/verification receipts expire at the earlier of one hour or the original
invitation deadline. The session intent remains bounded by that original deadline;
it never extends the server's 24-hour invitation validity. Cookie expiry is bounded
to 24 hours and server validation enforces the earlier absolute deadline.
Expired encrypted metadata may remain in the provider's user metadata until normal
account deletion; it contains no usable credential after expiry. No cleanup job,
database table or production retention change is introduced.

## Verification record

Verification on the local production build:

- Full unit/integration/security suite: 475 tests, 82 files passed, serial forks,
  6 GiB V8 limit. No tests skipped. An earlier two-worker run produced no reportable
  progress and was interrupted; it is not counted as a pass or a diagnosed V8 crash.
- Full authenticated browser suite: 114 passed across 390×844, 768×1024 and 1440×900.
  Final focused rerun: 39 passed, covering the final marker guard, existing-owner
  login and added recovery-email cases. The explicit Chromium iPhone user-agent,
  touch and standalone simulation also passed separately.
- General browser suite: 113 passed initially; the existing tablet Pulse traversal
  test timed out at 30 seconds under concurrent verification. It passed twice in
  isolated serial reruns without changing its assertions or application code.
- Persistence browser suite: 3 passed.
- Native disposable PostgreSQL concurrency: passed all existing Bond/lifecycle,
  growth, Signal and Home Region race checks.
- Production build, TypeScript, lint, formatting and diff whitespace checks passed.
- Privileged client-import negative build passed. Bounded secret scan found no
  known local managed secret or private-key content in repository files and no
  secret/receipt implementation in the 52 client bundles. No secret values printed.
- Local callback HTTP response: 200, Cache-Control `no-store, private`,
  Referrer-Policy `no-referrer`.

The focused expired-email assertion initially matched both the form alert and Next's
route announcer. It was scoped to the main form, preserving the same error and
no-activation assertions. No product correction was needed for that test ambiguity.

All fixtures are loopback-only synthetic identities, invitations and Bonds. The
browser provider fixture now invokes the actual signed email-hook implementation
with a captured notification transport instead of constructing the desired URL itself.
This verifies application behavior, not the real provider's resend classification.

The local review app is running at `http://127.0.0.1:3104` against only the disposable
loopback provider on port 54330. The Codex browser is left at
`http://127.0.0.1:3104/auth/register/invitation`, with a synthetic new Atom verified
through the actual signed-hook fixture and no Bond accepted yet. ACCEPT BOND and
NOT NOW can be reviewed there. Another browser without that local session will
correctly require authentication. No real email was sent.

Light/Dark confirmation layouts were checked at the three required sizes. Captures
are in ignored `artifacts/task164-review-*.jpg`; the settled mobile dark capture is
`artifacts/task164-review-mobile-dark.jpg`. No clipping or horizontal overflow was
observed. Browser viewport overrides were reset after review.

## Exact changed-file inventory

- `src/services/auth/registration-receipt.ts` — authenticated encryption and bindings.
- `src/services/auth/registration-intent.ts` — verified user/session cookie resolution.
- `src/services/auth/registration-actions.ts` — isolated registration, recovery, dismissal and acceptance adapters.
- `src/services/auth/email-hook.ts` — signed, marked signup-only email branch.
- `src/app/auth/page.tsx` — opt in only for invitation-originated new registration.
- `src/app/auth/register/confirm/page.tsx` — dedicated callback.
- `src/app/auth/register/details/page.tsx` — authenticated incomplete-registration recovery.
- `src/app/auth/register/invitation/page.tsx` — fixed private confirmation destination.
- `src/components/auth/ConfirmRegistration.tsx` — explicit verification and reload-safe fragment handling.
- `src/components/auth/AccessForm.tsx` — optional isolated registration submission, unchanged access defaults.
- `src/components/auth/BondConfirmation.tsx` — optional registration labels/actions, existing acceptance service.
- `playwright.auth.config.ts` — synthetic local receipt key.
- `scripts/test-auth-server.mjs` — real signed-hook capture and bounded local-only fixture operations.
- `scripts/test-typescript-loader.mjs` — Node 24 fixture loading of actual TypeScript hook implementation.
- `tests/auth-browser/ownership.spec.ts` — update only the new-registration confirmation destination/label.
- `tests/auth-browser/registration-invitation.spec.ts` — new journey and failure/recovery acceptance.
- `tests/security/registration-receipt.test.ts` — encryption, purpose, identity, attempt, expiry and email isolation.
- `tests/security/registration-intent.test.ts` — authenticated user/session binding.
- `docs/proposals/NEW_ATOM_INVITATION_CONTINUITY_v0.1.md` — approved design and isolated activation implementation detail.
- `docs/operations/TASK_16_4_LOCAL_ACCEPTANCE.md` — this acceptance, rollout and recovery record.

## Physical iPhone and hosted acceptance still required

Automated Chromium viewports, standalone detection and email handoffs are simulations.
They do not establish physical Safari, Mail, Gmail or installed-PWA compatibility.
Before declaring mobile acceptance complete, obtain an explicitly approved genuine
or disposable new participant and inviter for these checks:

1. Open the invitation in iPhone Safari. CREATE MY ATOM, choose Home Region, and request email.
2. Open the email in Safari in a fresh browser context. Verify the normal credential,
   complete any required details, and confirm the correct inviter is displayed.
3. Choose NOT NOW. Confirm MY ATOM opens and the same Atom survives a fresh launch.
4. In an independently approved intended connection, explicitly ACCEPT BOND and
   confirm exactly one Bond. No automatic acceptance is permitted.
5. Repeat the email-open step from the actual email app and with an installed PWA.
   A browser/PWA session is not promised to transfer between isolated cookie stores.
6. Test a fresh recovery email, callback reload, cancelled/expired invitation, and
   ordinary existing-owner login and signed-in acceptance. Keep installation prompt
   dismissal separate from Bond invitation dismissal.

## Authorized controlled deployment and recovery

No migration is needed. Vercel confirms the existing AUTH_CONTINUATION_KEY is a
Production secret. The application and same-origin Node.js email hook deploy together
and read that same environment variable. Its value was not revealed or changed.
Missing configuration safely loses only optional context;
it must still be treated as a continuity rollout blocker.

Verify the real signed signup/resend hook contract and callback reachability using an
approved controlled workflow. The configured provider redirect stays /auth/confirm;
the hook's resulting link points to /auth/register/confirm. No assumption that a mock
proves provider resend classification or mobile deep-link behavior is acceptable.

Deploy application and same-origin email hook together under the publication authorization.
No production test registrations or Bonds may be generated without separate approval.
Rollback is an application-only revert preserving all database records, deadlines,
secrets and frozen specifications. Already delivered dedicated callback links need a
compatible ordinary-verification fallback route during rollback; reverting that route
without compatibility would strand those emails. Alternatively clearly instruct users
to request a fresh ordinary access email. Do not promise existing dedicated emails
survive removal of their route.

Key rotation invalidates outstanding optional receipts; the normal OTP still verifies
independently. Deploy key changes consistently, retain no hardcoded keys, and document
any planned compatibility interval. No rotation is performed here.

### Immediate history-preserving recovery procedure

If physical-device acceptance fails, stop the rollout and record only the failing
step, device/browser, approximate time, and redacted error. Do not capture email
links, tokens, cookies, private identities, or decrypted receipts.

From clean synchronized main, run `git revert <v0.16.4-release-commit>` (the commit
titled `Atomic Bond v0.16.4 - New-Atom Bond Invitation Continuity`). Verify the
application, package, tests and configuration match recovery commit `f9b2aa6`, then
run the applicable checks and push the revert to main. Verify Vercel Ready and CI.
Do not reset or force-push history. Do not change the database, migrations, secrets,
invitation deadlines, accounts, Bonds or frozen specification.

The exact revert removes the dedicated registration callback. Recipients with an
already-delivered dedicated email must request a fresh ordinary ACCESS MY ATOM
email, complete account access, then reopen their original unexpired invitation.
The restored baseline may lose invitation context during authentication; this
recovery does not claim to fix that limitation.
