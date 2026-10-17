# Task 16.4.1 — single-click verification navigation

Local verification accepted and publication authorized as v0.16.4.1. No production
configuration, migration or frozen specification change is included.

## Baseline and diagnosis

Repository HEAD and origin/main: `6047602d599518ddaf3506c4e9d9ef2d31c71b2e`.
Vercel production still shows this v0.16.4 commit Ready. The working tree was clean
before this task. The product owner confirmed the complete v0.16.4 new-participant
invitation journey on a physical iPhone, but reported a second verification press.

The server action already awaits provider verification, verified owner resolution,
optional receipt validation and normal Atom activation before returning a destination.
There is no required second verification stage. There is one click handler and no
surrounding form submission. Existing-owner authentication is separate.

Confirmed local defect: the callback's `finally` clears pending after starting
navigation, re-enabling VERIFY / ACCESS MY ATOM while the next document is loading.
A delayed action/destination browser regression records that reset against the
unchanged v0.16.4 build. The handler also calls `history.replaceState` on the current
callback before `location.replace`; Next patches that history call to enqueue a
router restore. That intermediate transition is unnecessary. Fragment credentials
were also read from effect-populated state rather than at the deliberate press.

These are confirmed code/state issues, not proof of the exact Safari-internal cause
of the reported second tap. Local Chromium reached the destination even though its
button reset. Physical iPhone verification of the correction remains required.

## Narrow correction

- Read the current fragment synchronously at the deliberate press, without relying
  on an earlier effect or a stale replacement-email render.
- Use an immediate ref guard against duplicate invocation.
- Keep the button disabled and displaying Verifying until navigation unloads it.
- Use only `location.replace` for the successful transition; this also replaces the
  sensitive fragment in history without an intermediate router restore.
- Re-enable only on an actionable error. Do not add retry loops or auto-confirm Bonds.

Only ConfirmRegistration, its browser tests, this report, release version and changelog change. All server
actions, encrypted receipt/attempt/session binding, email hook, existing-owner
callback, ordinary registration, Home Region, installation policy, database and
Master Spec v0.8 remain unchanged.

## Verification and device limitation

The targeted regression holds both the server-action response and destination
request, verifies one invocation through rerenders, and observes button state until
unload. Service workers are blocked only in those request-interception tests so
Playwright can control synthetic HTTP timing. Production service-worker policy is
unchanged. Synthetic Bond counts must remain unchanged before explicit acceptance.

Results: 475 unit/integration/security tests passed (82 files); 123 complete
authenticated browser cases passed across 390×844, 768×1024 and 1440×900. The full
run blocked service workers for deterministic timing. A follow-up uses fresh
fixtures and normal service-worker behavior for existing PWA checks, with blocking
scoped only to the new interception tests. A reused-fixture exploratory run was
discarded because fixed registration test emails already owned Atoms and no longer
represented first-time registration.

The clean follow-up passed all 24 cases, including rapid duplicate clicks and
replacement-email credentials, at all three viewports. A manual local-browser
demonstration also reached /auth/register/invitation after exactly one verification
click, displaying ACCEPT BOND / NOT NOW. No Bond was accepted in that demonstration.
The local review is available at http://127.0.0.1:3104/auth/register/invitation in
the prepared synthetic browser session. Mobile screenshot:
`artifacts/task1641-one-click-mobile.jpg` (ignored local evidence).

Production build, TypeScript, lint, formatting, diff check and source/client-bundle
secret scans passed. The build has no production deployment. Existing v0.16.4
PostgreSQL concurrency results remain applicable: this patch changes no service,
SQL, reservation, invitation deadline, or confirmation operation.

An exploratory Windows WebKit run over local HTTP did not preserve the production
Secure session cookies across navigation and reached /auth. It is not evidence of
a production HTTPS regression and is not counted as a passing Safari test. No
cookie-security settings were weakened to make that run pass.

After publication approval, repeat the already-successful real-iPhone invitation
registration journey, pressing VERIFY once. Expect Verifying until the original
invitation appears automatically. Test slower connectivity, callback reload,
ACCEPT BOND and separate NOT NOW dismissal. Safari/email/PWA behavior must be
reported as physical evidence rather than inferred from Chromium mobile viewports.

## Publication and recovery

Publish this narrow patch on main and verify Vercel Ready, Foundation checks and
production route health without creating production accounts, invitations or Bonds.
If recovery is required, revert the v0.16.4.1 release commit through a new Git commit
and redeploy v0.16.4 application behavior. Do not revert database records, secrets,
invitations or the frozen specification.
