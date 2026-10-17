# Task #16.3 — Invitation authentication continuation proposal

**Historical proposal, subsequently rolled back:** The approval status below
records the original checkpoint, not current deployment guidance. The v0.16.3
implementation and v0.16.3.1 repair were reverted; see the
[recovery record](../operations/ROLLBACK_TO_v0.16.2.md). The active v0.16.4.1
new-registration-only design is documented in
[New-Atom Invitation Continuity](NEW_ATOM_INVITATION_CONTINUITY_v0.1.md) and its
[single-click repair acceptance](../operations/TASK_16_4_1_LOCAL_ACCEPTANCE.md).

Status: approved for local implementation by the product owner; hosted configuration, commit and deployment remain unauthorized.

## Evidence and limits

Baseline: v0.16.2, commit 2a5651b. Production was verified Ready/current and
local main matched origin/main with a clean tree before this document.
The participant confirms selecting ACCESS MY ATOM on the invitation page.

The existing page passes `/bond/<secret>` to `/auth` in `next`. The form passes
it to requestAccess, which sends it in Supabase's emailRedirectTo query.
The signed email hook copies it into the email fragment. ConfirmAccess reads
that fragment, removes it from history, and holds the values in React state.
completeAccess verifies the OTP, resolves ownership and returns nextPath(next).
Missing or malformed next becomes `/explore`.

Thus a lost destination produces precisely the reported outcome, but the
specific production component that dropped it is NOT established. Normal
existing-owner and new-owner cross-context flows pass in the local fixture.
The fixture constructs mail itself and does not exercise the real signed hook,
provider redirect validation, email rendering or mobile link handling.
Reload before verification also loses the cleared fragment, though that alone
does not reproduce successful authentication followed by lost invitation.

Verified locally: 13 Auth policy/email tests and 3 mobile ownership tests pass.
Hosted redirect configuration contains both exact callback URLs and `?next=*`
entries for the custom and Vercel domains. Email hook is enabled. These facts
do not prove the delivered link retained the destination. No production email,
invitation, registration or Bond was generated during this audit.

## Proposed bounded repair

Use a server-encrypted continuation envelope instead of the raw invitation path
in authentication redirect parameters. This is NOT a replacement Auth token.
Supabase remains the only authority that authenticates the participant.

1. On the existing same-origin access request, validate the invitation and seal
   its destination, normalized requested identity, random flow nonce, purpose,
   version and deadline. Bound the deadline by the original invitation expiry
   and a short authentication-continuation limit (proposed: one hour).
2. Pass only opaque authenticated ciphertext through the provider callback
   parameter. Do not use editable Auth metadata or a per-email global last-path
   slot. Concurrent requests must retain separate flow identities.
3. The signature-verified email hook validates the envelope against the signed
   recipient identity and binds it to that exact Auth token hash and Auth user.
   Deliver one sealed fragment value containing the Auth material and its
   continuation, rather than two independently editable fragment parameters.
4. On explicit VERIFY / ACCESS MY ATOM, decrypt/validate on the server, invoke
   existing verifyOtp, then verify the resolved user matches the bound identity.
   Never substitute an already-present session for verification of this link.
   A substituted, expired or replayed envelope cannot resume another account's
   invitation. Supabase OTP consumption remains the single-use Auth boundary.
5. Revalidate the invitation and lifecycle before showing the existing Bond
   confirmation component. Authentication never invokes acceptance. Retain
   registration, activation, deletion and explicit reactivation prerequisites.
6. Use a short-lived, sealed HttpOnly callback cookie only to survive a reload
   after the initial fragment is received. It supplements the email envelope;
   cross-browser entry must work without any cookie from the requesting browser.
   Clear on successful completion/dismissal/error as appropriate. Do not persist
   Auth material in localStorage, sessionStorage, service workers or analytics.
7. Resume once at successful authentication. Subsequent normal login/navigation
   has no implicit pending redirect. NOT NOW leaves through the existing owner
   destination. Acceptance still uses the existing authoritative Bond RPC.

## Boundary and approval

A dedicated server-only encryption key is preferable to repurposing the Auth
webhook signing secret. It grants no Supabase database or Auth administrative
access. Its compromise would compromise continuation confidentiality/integrity,
so it needs explicit provisioning, rotation and log-redaction rules. It cannot
replace OTP verification or the Bond RPC's consent/authorization checks.

No new database table appears necessary for this design: OTP replay is rejected
by Auth, and Bond replay by the existing atomic invitation-consumption rules.
This must be established with substitution/replay and interrupted-callback tests,
not assumed from cryptography alone. If durable post-OTP recovery requires a
consumption ledger, present its precise grants and retention before adding it.

Affected modules: Auth actions/policy, signed email hook, callback UI/server
entry, existing Bond confirmation copy, test Auth fixture, targeted tests and
architecture documentation. No gameplay, invitation lifetime, consent invariant,
frozen specification, analytics event or production configuration changes here.

Tradeoffs: server key management and larger email fragments, versus removing
raw invitation secrets from provider redirect parameters and binding the entire
handoff to the actual verification flow. Missing/corrupted envelopes must show
safe recovery rather than infer an invitation from a different flow.

AGENTS.md section 13 requires review before material architectural changes.
Approve this scoped envelope/key boundary before implementation. Hosted setup,
commit and deployment remain separately gated by the Task #16.3 checkpoint.

## Required verification after approval

Use the actual application hook and email builder in the synthetic provider.
Cover existing/new owners, fresh contexts, reload, wrong account, altered or
missing envelope, token replay, multiple simultaneous invitations, invitation
expiry/cancellation, explicit acceptance/dismissal, lifecycle and installation
regressions. Check sensitive URLs/referrers/logging and no-store responses.
Run database concurrency and the applicable browser/security/build checks.

Physical Safari/email-app/installed-PWA handoff remains a device acceptance
requirement. A session established in another browser does not imply that iOS
will transfer its cookies to an installed PWA. No automatic Bond or automatic
cross-browser session transfer should be promised.
