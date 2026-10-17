# Invitation authentication continuation — Task #16.3

**Historical, rolled back:** This document describes the v0.16.3 experiment,
including its v0.16.3.1 repair, not the active authentication architecture.
Both were reverted by recovery commit f9b2aa66e7001f972178832c6f9b01aae2df6b73.
See the [recovery record](../operations/ROLLBACK_TO_v0.16.2.md).
The active v0.16.4.1 implementation isolates invitation-originated new-Atom
registration; see the [approved design](../proposals/NEW_ATOM_INVITATION_CONTINUITY_v0.1.md)
and [single-click repair acceptance](../operations/TASK_16_4_1_LOCAL_ACCEPTANCE.md).
Existing-owner authentication does not use this historical broad continuation.
The original release description and evidence below are preserved.

Release v0.16.3. Master Spec v0.8 is unchanged. Earlier local-checkpoint results below are retained as historical evidence.

## Diagnosis

The participant used ACCESS MY ATOM on the invitation page. The old code passes
the invitation path through the login form, provider redirect query, email
fragment, React state and completeAccess's client-supplied next argument. A
missing next silently becomes /explore. No server binding associates that path
with the specific OTP or identity. Clearing the fragment before keeping a durable
copy also makes a callback reload lose its input.

The unmodified synthetic cross-browser flow passed. The exact production loss
point has not been established; do not describe email-client truncation or
provider redirect rewriting as confirmed. The new single sealed fragment removes
the independent next field and fails closed for corruption. Provider/inbox/device
acceptance remains necessary. No production test records or emails were created.

## Boundary

The existing same-origin requestAccess validates the invitation and encrypts its
path, normalized requested email, random nonce and expiration with AES-256-GCM.
The provider redirect parameter contains opaque ciphertext, not the invitation
secret or email. Lifetime is the earlier of one hour and the invitation deadline.
The existing signed Send Email Hook verifies the request envelope's recipient
against the signed user, then seals it with that exact Auth user ID and OTP hash.
The email has one continuation fragment, without a separate editable next field.

The callback stages the encrypted envelope in a Secure, HttpOnly, SameSite=Lax
cookie scoped to /auth/confirm. Its URL contains only a SHA-256-derived flow ID
(128 bits); that ID cannot authenticate or retrieve an invitation without the
cookie. Up to four distinct in-flight cookies are allowed; a fifth is refused,
never silently substituted. Cookies expire at the envelope deadline. Dismissing
one does not dismiss another. No browser storage or service-worker cache holds it.

Explicit verification reads and authenticates the envelope server-side, invokes
the existing Supabase verifyOtp, and checks the verified user ID and email match.
An existing session does not replace OTP verification. Supabase's single-use OTP
remains the replay authority. The cookie is cleared after the completion attempt.
Only then does existing ownership/activation/lifecycle resolution choose the next
page. Reactivation remains explicit; deletion takes precedence. The invitation
page and acceptance RPC independently recheck deadline, cancellation, recipient
eligibility, duplicate pairs and single use.

The existing BondConfirmation component displays YOU’VE BEEN INVITED TO BOND,
ACCEPT BOND and NOT NOW. Authentication never calls the acceptance action. NOT NOW
returns to /explore without a global pending-invitation redirect. Reloading an
accepted invitation cannot create another Bond.

## Deployment configuration and compatibility

No migration, service-role credential, new Auth token issuer or hosted change is
included. AUTH_CONTINUATION_KEY is a dedicated server-only 32-byte key encoded as
64 lowercase hexadecimal characters. Provision it only with publication approval,
on every server deployment that requests/delivers/completes these links. The Auth
hook host and application must use the same key. Never use NEXT_PUBLIC or reuse
the provider's webhook signing key. Missing configuration fails closed for new
invitation access requests; ordinary access remains available.

Rotation invalidates outstanding continuation envelopes, but never changes Auth
sessions, Bond invitations or their deadlines. Users reopen the original invitation
and request fresh access. Keep application and hook deployments consistent during
rollout. Retired deployments must not be used to originate current access links.

Previously issued unsigned invitation email links may authenticate normally but
show a message to reopen the original invitation. Do not silently trust their
editable next field. Ordinary /explore and account-deletion callbacks retain the
existing behavior. Original invitation links remain governed by the same 24-hour
database deadline; no invitation is extended or recreated during login.

## Privacy, recovery and limitations

Encrypted envelopes are still sensitive link material: do not log payloads,
include them in analytics, expose them in screenshots or enable email tracking.
Existing no-referrer/private-no-store handling and sensitive-route analytics
exclusion remain. The original shared /bond/<secret> URL still has the previously
documented upstream URL-log/browser-history limitation.

The email envelope supports a fresh browser with no cookies from the requesting
browser. Once staged, the callback survives a normal reload. It cannot restore
an email link whose entire fragment was removed before the application received
it; recovery is to reopen the original invitation and request access again.
If an OTP is consumed and the response/session is lost, it is not replayed or
silently replaced by another session: request a fresh email. This is safe recovery,
not a claim of transactional delivery across Auth and the browser.

An authenticated bearer of an original general invitation can still voluntarily
forward that invitation, as before. Continuation binding prevents substitution
within the authentication handoff; it does not redesign invitations as named-
recipient invitations. An email opened in Safari does not guarantee that iOS
will transfer the established session into an installed PWA. Physical iOS/email
client and PWA acceptance remains unverified.

## Local verification scope

The synthetic provider calls the same bindInvitation implementation as the real
hook. Unit tests exercise the real signed hook, encryption tampering, purpose
separation, wrong identity, exact expiry, concurrent flows and key rotation.
Browser tests use synthetic identities and real isolated migrated PostgreSQL,
covering cross-context/reload/explicit acceptance/replay/cancellation/expiration/
dismissal and existing registration. They do not contact production Auth or Resend.
Final test counts and screenshots are reported at the local review checkpoint.

## Changed files

- `.env.example`
- `docs/CHANGELOG.md`
- `docs/architecture/AUTH_EMAIL_v0.1.md`
- `docs/architecture/INVITATION_AUTH_CONTINUATION_v0.1.md`
- `docs/proposals/INVITATION_AUTH_CONTINUATION_v0.1.md`
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

## Review checkpoint results

- Authenticated browser suite: 108 passed, including 18 new continuation cases.
- General browser suite: 114 passed. Persistence browser suite: 3 passed.
- Responsive Light/Dark captures inspected at 390 × 844, 768 × 1024 and 1440 × 900.
- Earlier full unit/graph/integration/security run: 469 passed; its one failure was the exact environment-placeholder inventory. After adding the approved blank key placeholder to that assertion, all seven focused continuation/deployment tests passed. A redundant full rerun stalled using fork workers; a thread-worker rerun encountered a native Node/V8 JIT allocation crash. Neither rerun is recorded as passing.
- PostgreSQL concurrency/restart checks passed. Production build, TypeScript and lint passed. Changed-file credential-pattern scan passed; this is not a claim of exhaustive secret detection.
- No hosted migration, production key, commit, deployment or frozen-specification change.

The reproducible local demonstration is the authenticated browser test named
“existing owner resumes a bound invitation in a fresh context after reload,
explicitly accepts, and cannot replay.” It uses synthetic records only and captures
Light/Dark confirmation screens in test-results/auth for all three viewports.
Physical iPhone/email/PWA testing remains outstanding.

## Final preflight follow-up

The controlled full rerun passed all 470 tests in 81 files using one fork worker
and a 4 GiB old-space limit. The 18 continuation browser cases passed again,
including an added swapped-cookie/flow-ID rejection. See
[final preflight](../operations/RELEASE_v0.16.3_PREFLIGHT.md) for the native-runtime
investigation, exact candidate file list and publication requirements.

## Publication configuration verification

The product owner provisioned AUTH_CONTINUATION_KEY as a managed Vercel
Production Secret. Supabase Send Email targets the same production application
at /api/auth/email-hook. No second key or Supabase secret is required.
In Vercel Production the shared module validates key format during build and
server cold start, emitting only `Invitation continuation configuration validated.`
A missing/malformed key fails the candidate build before promotion. The same
check in the email hook and callback runtime verifies both consumers. Neither
keys nor fingerprints nor ciphertext are included in this diagnostic.

## Local Task #16.3.1 correction (not published)

The local candidate separates provider authentication from optional invitation
restoration and adds verified-session callback recovery. See the
[incident report](../operations/AUTH_RECOVERY_v0.16.3.1.md) for exact behavior,
compatibility and unresolved production-device evidence. The v0.16.3 description
above records the deployed historical implementation, not the corrected candidate.
