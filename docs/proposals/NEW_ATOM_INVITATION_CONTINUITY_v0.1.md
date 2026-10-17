# Task 16.4 — New-Atom invitation continuity: architecture checkpoint

Status: architecture approved for local implementation. Candidate implementation
and verification are in progress. No migration, commit, deployment, production
secret change or frozen-specification amendment is authorized at this checkpoint.

## Baseline and confirmed evidence

Production Vercel is Ready/current at recovery commit
`f9b2aa66e7001f972178832c6f9b01aae2df6b73`. Main and origin/main match; application,
fixtures, tests and migrations are identical to v0.16.2 commit `2a5651b`.
Frozen v0.8 Sections 31/32 require 24-hour invitations and explicit confirmation
after new-person verification. The preceding recovery read-only hosted check found
30 migrations, latest 202610200001, and 86400-second issuance/default/CHECK.
No hosted database mutation is part of this audit.

The existing path already forwards a syntactically allowlisted invitation:

1. Bond page CREATE MY ATOM links to registration with a next destination.
2. AccessForm includes next in its submitted form.
3. requestAccess includes next in the provider emailRedirectTo.
4. The signed email hook copies it into the delivered link fragment.
5. ConfirmAccess sends it with the OTP to completeAccess.
6. completeAccess verifies the OTP, resolves ownership, creates/activates the Atom,
   and returns next. ConfirmAccess navigates to the Bond page.
7. BondConfirmation calls the existing authorized confirmation action only on click.

There is no unconditional loss in this successful path. The unchanged mobile-sized
new-invitation test passed, including Home Region, fresh browser email entry,
activation, explicit confirmation, reload and same-Atom returning access.
All 13 signed-email/policy tests passed. The hosted exact-origin callback and
`/auth/confirm?next=*` entries are present. No production email was generated.

Confirmed gaps:

- The callback removes its fragment into React state before verification. Reloading
  at that point loses both credential and destination. This is a code-path finding,
  not a reproduced physical-device incident.
- If activation/details completion fails, the recovery link points to bare /auth;
  it does not preserve next. Missing Home Region completion can therefore lose intent.
- next is format-allowlisted but not cryptographically bound to a registration/OTP.
  This is not an automatic-Bond vulnerability, since consent and database authorization
  remain mandatory, but it does not satisfy Task 16.4's stronger anti-substitution rule.
- The browser fixture constructs email links itself. It does not exercise the real
  signed email hook, Supabase redirect validation, email client or physical Safari.

The actual reported mobile loss is still unconfirmed. Do not label provider URL
rewriting, encryption, iOS or session failure as its established root cause.

## Proposed minimal isolated design

Do not modify the behavior of ACCESS MY ATOM, completeAccess, existing /auth/confirm,
reactivation, ordinary registration or signed-in invitation acceptance.

Add a new-registration-only branch and callback for CREATE MY ATOM from an invitation:

1. A dedicated server registration action checks origin, validated Home Region and
   live invitation possession. It creates a short-lived encrypted request receipt
   bound to normalized registration email, invitation, absolute invitation deadline,
   flow nonce, purpose and version. No raw invitation is added to Auth redirect URLs.
2. Carry that receipt as optional registration metadata through the normal signup
   request, with an ordinary fixed callback fallback. Editable metadata alone is
   never trusted: the receipt's authenticated encryption must validate.
3. Only a verified signed signup email-hook event can finalize the receipt, binding
   it to that event's Auth user ID and exact OTP hash. The input receipt must match
   the event recipient; the event must represent new-user verification, not returning
   owner magic-link access. Resend/retry semantics must be tested against the actual
   provider contract before choosing the final branch predicate.
4. Deliver the normal token_hash credential unchanged in the fragment of an isolated
   registration callback, plus a separate optional encrypted receipt. Never wrap the
   sole authentication credential inside the invitation envelope. Ordinary email
   construction remains unchanged. Invalid/missing receipt falls back to ordinary mail.
5. Implementation detail: the isolated callback uses the same provider verifyOtp
   primitive and existing finishRegistration activation action, leaving completeAccess
   byte-for-byte unchanged. This separates successful authentication from incomplete
   Home Region details, allowing an authenticated recovery form without redeeming a
   receipt on the strength of a pre-existing session. Only successful OTP verification
   for an owner without an activated Atom can stage the optional session-bound intent.
   Invalid receipt returns ordinary MY ATOM and never fails legitimate activation.
6. Keep valid post-activation intent in a bounded HttpOnly/Secure/SameSite cookie,
   bound to the verified Auth user and session. Use a fixed registration confirmation
   route so the raw invitation is not added to another public URL. The ordinary
   BondConfirmation and confirmOwnerBond operation remain the acceptance mechanism;
   supply registration-only labels ACCEPT BOND and NOT NOW through optional props.
7. Dismissal clears only this registration intent and opens MY ATOM. Expired/cancelled
   invitations show an unavailable explanation and normal MY ATOM access. Never extend
   the original 24-hour deadline. Completion/replay is constrained by provider OTP
   single use, exact receipt/OTP/user binding and existing single-use Bond confirmation.

No global callback recovery layer, encrypted authentication capsule, multi-flow
staging-cookie system, existing-login interception or automatic Bond acceptance.

Before implementing cookie recovery, define and test exact replay/dismissal behavior:
only successful OTP verification may establish the post-activation intent; replaying
an email receipt cannot re-stage it using a pre-existing session alone. Reloads may
resume the same unfinished intent but cannot confirm twice. Missing/invalid cookie
must resolve to MY ATOM. Pre-verification reload must preserve the original fragment
or safely request a fresh link; it cannot claim a completed session.

If required details are incomplete, authentication succeeds independently and the
isolated flow carries only a user/session-bound optional intent into the existing
Home Region form. It must not trust a client next field to establish that intent.
Existing-owner/deactivated-owner results never acquire a new-registration intent.

## Security and operational boundary

Proposed cryptography: reuse the already managed server-only continuation key with
new purpose/version separation and AES-256-GCM. No production key reading, rotation
or provisioning is authorized here. Local tests use an explicitly synthetic key.
Missing key must fall back to ordinary registration; do not restore the reverted
global startup/import failure. Require approval for this new use of the existing key.

No database migration is proposed for the initial design. A persistent replay ledger
or new privileged credential, if later shown necessary, requires a separate proposal;
do not silently add it. A receipt is not consent, ownership of an email alone is not
invitation possession, and editable Auth metadata cannot establish authorization.
No new analytics/logging. New routes require private/no-store, no-referrer, analytics
and service-worker exclusion. Existing upstream original-invitation URL retention
limitations remain; no claim that this removes already logged original URLs.

Affected modules: dedicated registration action/receipt service/callback/confirmation
route; registration entry selection; signup-only email-hook branch; optional labels
on the existing confirmation component; route privacy coverage; synthetic fixtures
and tests. Existing callback/action/access behavior must have parity tests.

## Required local verification after architectural approval

Upgrade the synthetic provider path to invoke the actual signed hook with a captured
local notification transport; do not just concatenate a desired email URL. Cover
signup versus magic-link events, resends, altered/missing metadata and callback fallback.

Cover same/fresh browser, Safari-like and standalone simulations, required Home Region,
explicit one-Bond acceptance, NOT NOW, expiry/cancellation, wrong user/session/OTP,
substitution, expired receipts, missing key, reloads before/after verification, stale
email replay, multiple emails and ordinary/existing/reactivation parity. Then run
full unit/integration/security, all browser suites, native PostgreSQL concurrency,
format/lint/TypeScript/build and bounded secret scans. No tests disabled or relaxed.

Current evidence is baseline evidence only: one comprehensive mobile browser test and
13 email/policy tests. No candidate implementation or candidate full-suite pass exists.
Initial test-runner argument/path errors and sandbox child-process denial were resolved;
only the successful reruns are counted. No physical Safari test has been performed.

## Physical iPhone acceptance and rollout

After local approval, require a separately authorized controlled real new participant
and inviter. Open the invitation in Safari, choose CREATE MY ATOM, select Home Region,
request verification, open the email in a fresh Safari context and separately through
an installed PWA where feasible. Verify activation and original inviter, choose NOT NOW
first, and confirm normal Atom access. For an intended genuine connection, explicitly
ACCEPT BOND and confirm exactly one connection. Test stale/cancelled invitation with
approved disposable records, and independently recheck existing-owner login/acceptance.
Never request tokens, emails or secrets in the report. Simulations do not prove iOS.

Publish only after approval and real-provider compatibility verification. App and its
same-origin email hook deploy together. Preserve existing routes and fixed normal-mail
fallback throughout. Recovery is an application-only revert; no database changes,
identity deletion, Bond alteration or key rotation. New dedicated-route emails may
need fresh ordinary login emails after rollback; disclose this before any rollout.

## Approval checkpoint

AGENTS.md section 13 requires approval before a material architectural change:
explain the limitation, proposed change, benefits, tradeoffs, affected modules and
"wait for approval." The new registration receipt/metadata/callback authorization
boundary is a material change even though it is isolated from existing login.
Request approval for this local-only design before introducing it. Preserve the
current working application and frozen Master Spec v0.8 in the meantime.

Provider reference: [Supabase Send Email Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook). Its documented payload includes the user metadata and email action type. This supports the proposed branch design, but does not establish actual resend behavior or physical-device compatibility.
