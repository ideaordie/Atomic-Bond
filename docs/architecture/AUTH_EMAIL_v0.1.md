# Verified email identity and passwordless ownership v0.1

Task #7, application 0.7.0. Master Spec v0.2 and the Task #6 invariants remain unchanged.

## Ownership and registration

Supabase Auth is the authority for email control and sessions. A private unique
`auth_user_id` maps to exactly one private identity and Atom. No UI accepts an
owner UUID. `my_atom()` derives ownership from `auth.uid()` and matching normalized
email; it returns only the owner's public profile, lifecycle and coarse location ID.
Private identity tables remain inaccessible through client table queries.

`/auth` supports new registration and returning access without passwords.
Email is trimmed/lowercased without provider-specific dot/plus transformations.
`signInWithOtp` requests Auth-managed, expiring, single-use email links. Returning
access uses `shouldCreateUser: false`. The response does not disclose whether an
email exists. Supabase's email cooldown/rate limits remain authoritative; review
the hosted Auth limits before rollout. Do not disable verification for convenience.

Before verification, the registration is an unconfirmed Auth user, with optional
alias/X and a validated canonical location reference in private Auth metadata.
It is not an active Atom or part of the graph and receives no public number.
After `verifyOtp`, the server revalidates the current Auth user and registration
details, calls existing `begin_atom`, then `activate_atom`. The sequence allocates
a number only after verification. An existing owner keeps the original number.
Metadata can never establish ownership or verification: the database uses trusted
Auth columns, not editable metadata flags. If activation is interrupted, a verified
user can complete/retry the same registration through `/auth`.

Unverified Auth registrations can request another email after the provider cooldown.
They do not reserve an Atom number. No automatic deletion, number recycling or
dormancy schedule is introduced. Email changes/account recovery beyond passwordless
access remain deferred; mismatched identity email fails closed.

## Sessions and callbacks

`@supabase/ssr` stores cookie sessions; `src/proxy.ts` refreshes them and forwards
updated cookies. Cookies are HttpOnly, SameSite=Lax and Secure in production.
Every owner operation verifies the user with Auth `getUser`, and database RPCs
independently enforce ownership. Protected responses are private/no-store.
Public exploration requires no session and receives no private identity payload.
Sign out clears the local device session; it is not a global session-revocation UI.

The signed email hook creates an `/auth/confirm` link with the token hash in its
fragment, keeping it out of HTTP request URLs and referrers. The callback removes
the fragment from browser history immediately and requires explicit confirmation
before POSTing to a Server Action. This avoids passive email scanners consuming
the link. No tokens are logged or rendered as text. Invalid, expired and reused
links show a generic retry message. Server Actions enforce same-origin requests.

Only `/explore` and `/bond/<64 lowercase hex characters>` are accepted continuation
paths. Hook destinations must match an exact configured origin; arbitrary URLs,
protocol-relative paths and broad Vercel wildcard origins are rejected. The email
contains the continuation, so another device can finish the flow. Auth completion
never confirms a Bond: the recipient must explicitly select CONFIRM BOND. Database
expiry/cancellation/single-use rules still apply even if verification took too long.

## Notification and Resend boundary

Supabase Auth generates and verifies tokens. Its supported **Send Email Hook**
POSTs to `/api/auth/email-hook`. Standard Webhooks verifies the raw payload's
signature and timestamp before delivery. Only signup/magic-link operations are
supported. Resend receives minimal plain-text verification/access emails through
`ResendNotificationService` and a server-only transport. Webhook IDs provide
Resend idempotency keys. API/provider payloads and failures are not logged.

Approved sender: **Atomic Bond <connect@atomicbond.ideaordie.com>**.
The user has confirmed that `atomicbond.ideaordie.com` is verified in Resend.
No Squarespace DNS changes are part of this task. Disable open/click tracking on
auth mail to avoid wrapping sensitive links. No service-role key is used.

MockNotificationService and all mock participation flows remain available in
explicit mock mode. The production service has a preference-gated summary-delivery
capability but no job, public send endpoint or recurring schedule. Bond/Pulse
notification delivery and dormancy warnings are not enabled. A later scheduler
must load owner preferences and validated recipients before sending summaries.

## Owner UI and canonical places

The existing Living Atom and controls remain. Authenticated owners can create a
real invitation, send their own Pulse, and manage alias/X and notification
preferences at `/owner`. Pulse animation starts only after persistence succeeds;
errors keep the composer available for retry. All eight states, 24-hour expiration,
15-second outgoing animation, manual Feel toggle, and results-panel behavior remain.
Connected-network Pulse retrieval stays separate from unrestricted public graph data.

The additive migration `202609270001_owner_access.sql` adds `my_atom()` and five
curated real places for initial signup. Location coverage is explicitly limited:
Boynton Beach, Miami, New York, Toronto and London. No synthetic people or network
are seeded. A production location provider remains deferred. The prior hosted
verification-only location is excluded from the signup search.

## Configuration and release checklist

All example values in `.env.example` are blank. Secrets belong in ignored local
environment files and the hosting provider's secret environment settings.

| Variable                        | Boundary / purpose                                                   |
| ------------------------------- | -------------------------------------------------------------------- |
| `ATOMIC_BOND_DATA_MODE`         | `supabase` for real ownership; `mock` preserves demos                |
| `NEXT_PUBLIC_SUPABASE_URL`      | Browser-safe project URL                                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-safe publishable/anon key, never service role                |
| `RESEND_API_KEY`                | Server-secret, sending-only access restricted to the verified domain |
| `RESEND_FROM_EMAIL`             | Approved From identity above                                         |
| `SUPABASE_AUTH_HOOK_SECRET`     | Server-secret shared with Supabase's signed Send Email Hook          |
| `APP_ORIGIN`                    | Exact application origin, no trailing slash                          |
| `AUTH_ALLOWED_ORIGINS`          | Comma-separated exact extra callback origins accepted by the hook    |
| `AUTH_ALLOW_LOCALHOST`          | Explicit local test-server opt-in; leave unset on Vercel             |

Production APP_ORIGIN is `https://atomic-bond.vercel.app`. Local development uses
`http://127.0.0.1:3000`. Preview deployments use their exact HTTPS origin and must
also be allowed by the hook and Supabase's redirect configuration. Do not grant
all `*.vercel.app` projects access.

For local callbacks delivered through the hosted hook, explicitly add
`http://127.0.0.1:3000` to `AUTH_ALLOWED_ORIGINS` on the hook host as well as the
Supabase redirect allowlist. This permits only that configured loopback origin;
it does not enable HTTP callbacks to arbitrary hosts.

Before enabling production registration:

1. Review/apply the new migration through the version-controlled CLI workflow.
2. Deploy the reviewed application and configure server variables in Vercel.
3. In Supabase Auth, enable email sign-in/confirmations and configure Site URL and
   exact `/auth/confirm` redirect destinations (including the continuation query).
4. Configure the HTTPS Send Email Hook URL and matching signing secret. Auth hook
   delivery replaces SMTP delivery. Do not enable it before its endpoint is live.
5. Verify Resend sender/domain, tracking settings and delivery using an authorized
   recipient. Test expired/reused links and a separate browser/device.

Hosted values for this release:

- Vercel: `ATOMIC_BOND_DATA_MODE=supabase`, `APP_ORIGIN=https://atomic-bond.vercel.app`.
- Vercel: configure the existing project URL/anon key, `RESEND_API_KEY`,
  `RESEND_FROM_EMAIL=Atomic Bond <connect@atomicbond.ideaordie.com>`, and the matching
  `SUPABASE_AUTH_HOOK_SECRET` through environment settings; redeploy afterward.
- Supabase Auth Site URL: `https://atomic-bond.vercel.app`.
- Auth redirect destinations: `https://atomic-bond.vercel.app/auth/confirm` and
  `https://atomic-bond.vercel.app/auth/confirm?next=*`. Add corresponding exact-host
  entries for `http://127.0.0.1:3000` only when local live-Auth testing is needed.
  The query wildcard accommodates an invitation continuation; application policy
  still restricts it to `/explore` or a valid `/bond/<secret>` path.
- Send Email Hook endpoint: `https://atomic-bond.vercel.app/api/auth/email-hook`.
  Enable signature verification using the matching secret, not a public endpoint
  without signing. Retain email confirmations and Auth expiry/rate limits.
- A controlled acceptance-test inbox can be supplied as `RESEND_TEST_TO` in ignored
  `.env.local`. This is an operator test setting, not an application recipient list.
  Never commit the address or print secrets during testing.

The hook secret may be generated by Supabase's hook configuration and entered
securely in Vercel/local configuration. Never place keys or token hashes in Git,
chat, command arguments, deployment output or analytics. Keep Supabase-managed
email templates/SMTP disabled for delivery only once the hook is tested.

## Tests and current verification boundary

Unit tests cover origin/continuation allowlists, normalization, signed-hook
tampering/age, delivery idempotency, and disabled summaries. Database tests verify
the owner projection and protected Task #6 invariants. The browser Auth test
mechanism runs only on loopback with fake email delivery, simulated Auth sessions,
and real migrated PostgreSQL. It covers new-user invitation verification, activation,
Bond confirmation, Pulse, profile/preferences, logout, link replay and new-device
restoration of the same Atom. It does not claim to validate hosted Supabase Auth
or inbox delivery. Existing deterministic regressions remain mandatory.

Local verification on 2026-09-27: formatting, lint, TypeScript, 142 unit/graph/
service/security/database tests, native PostgreSQL concurrency checks, production
build, 66 existing browser regressions, 3 public-persistence browser checks, and
9 Auth browser checks passed. Auth checks include expired access rejection without
Atom allocation and returning-owner invitation continuation. Registration, owner
network and preferences were inspected at 390×844, 768×1024 and 1440×900.
The built browser JavaScript was checked against the configured Resend/hook secrets;
neither was present. Master Spec v0.2 remains byte-for-byte unchanged.

Hosted activation of this release and real inbox acceptance are separate from
local automated verification and must be reported explicitly. Task #8 camera QR
scanning should encode the existing expiring `/bond/<secret>` URL; it must not
introduce another identity or confirmation mechanism.

References: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client),
[passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless),
[Send Email Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook).
