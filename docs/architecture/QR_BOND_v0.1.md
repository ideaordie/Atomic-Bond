# First Real QR Bond v0.1 — Task #8 candidate

Status: implementation candidate. Physical production verification is pending.
Do not describe this milestone as verified or release v0.8.0 until the two-device
procedure below has succeeded. Master Specification v0.2 remains authoritative.

Candidate verification (2026-09-27): formatting, lint, TypeScript, 150 unit/
integration tests, native PostgreSQL concurrency/restart checks, 69 mock browser
tests, 3 persistence browser tests, 18 Auth/QR browser tests and production build
passed. Redacted QR layouts were reviewed at all three reference sizes. Configured
server secrets were absent from project files/browser bundles; the visible recent
Vercel log sample contained no invitation/auth-token or private-email patterns.
Both existing hosted migrations are applied. This evidence does not substitute
for the pending physical production test.

## Architecture and consent

Authenticated CREATE BOND calls a same-origin server action, resolves ownership
through Supabase Auth/private identity, and invokes the existing controlled
`create_bond_invitation` RPC. Selecting CREATE BOND is the initiator's explicit
consent to connect with the person to whom they give the invitation. The modal
explains this. The recipient must separately select CONFIRM BOND. Scanning,
viewing, registering and authenticating never confirm a Bond.

Only `accept_bond_invitation` creates the CONFIRMED relationship, atomically with
invitation acceptance, after ownership, expiry, self/pair and lifecycle checks.
Its database locking, unordered-pair uniqueness and RLS boundaries remain
unchanged. No Task #8 migration is needed. DORMANT owners retain the existing
verified-owner return/reactivation behavior; deleted/unverified owners cannot
confirm. Decline simply leaves the invitation without any write, notification or
penalty; the general invitation remains available until used, cancelled or expired.

## Secure invitation and QR

Existing RPCs allocate 32 random bytes (64 hexadecimal characters). The database
stores a SHA-256 digest and privately encrypted recovery value so repeated owner
requests can return the same active secret. The creator lock and unique active
index enforce one active general invitation concurrently. Expiration is five
minutes, never extended by reopening. Accepted/cancelled invitations cannot be
used again; expired invitations require a new CREATE BOND action.

The server constructs `APP_ORIGIN` + `/bond/<secret>` using the trusted-origin and
token validators. `qrcode` produces a PNG data image with medium error correction,
a four-module white quiet zone and black modules. No external QR service, browser
encoder, remote image optimizer, personal data or internal UUID is involved.
The independent test decoder verifies the image's exact payload. The modal
provides a live countdown, copy action, cancellation and a keyboard-accessible
close action. Expiration removes the QR and copy action. Closing alone preserves
the invitation for reopening. The QR is not animated or decorated.

## Recipient and authentication continuation

The route resolves the secret before showing allowlisted public graph fields:
public number, optional alias/X and coarse region. X links are constructed from
the validated handle and do not claim verification. Anonymous visitors receive
CREATE MY ATOM and I ALREADY HAVE AN ATOM. No inviter session is transferred.

Both paths use Task #7's real email/auth flow. The allowlisted invitation path
travels in the authenticated email callback fragment, not localStorage. After
the recipient explicitly verifies the access link, successful activation or
existing identity restoration automatically returns to the original invitation.
The database assigns new numbers; returning owners retain theirs. Opening the
email in another browser is supported. Expired invitations remain expired after
verification and instruct the recipient to request a new invitation.

Self invitations and already-confirmed pairs have explicit non-actionable states.
Authoritative confirmation repeats checks, even when the initial route was valid.
Network/session errors remain generic and retryable. Reloading a consumed URL
cannot confirm again. Closing registration does not consume the invitation;
the email link or original QR can restore context while valid.

## Graph, animation and Pulse

Successful confirmation displays BOND CREATED and passes freshly retrieved real
GraphData to the existing arrival animation. Both participants retain their own
MY ATOM perspective. The owner view polls every ten seconds while visible and
refreshes on focus. Newly observed direct edges trigger arrival and close the
old invitation modal. Manual refresh remains a recovery option. This is polling,
not realtime subscriptions. One-Atom and two-Atom networks use the same graph
metrics; no fixture, synthetic density or invented reach is introduced.

Connected Pulse data is retrieved through the existing authorized service path,
separately from public graph data. All eight states, explicit selection, 24-hour
expiry and replacement remain unchanged. Public graph retrieval contains no
unrestricted emotion or private identity. Existing reduced-motion behavior applies
to the arrival animation; BOND CREATED provides nonvisual feedback.

## Logging, deployment and limits

No invitation/auth secret or email is intentionally logged by the application.
Error responses contain no provider payload. No analytics SDK receives the QR.
No-store and no-referrer headers apply to invitation/auth routes; external X
links use noreferrer. Infrastructure may retain requested URL paths, so restrict
access/retention for hosting and upstream Auth logs. A path-carried secret cannot
be guaranteed absent from infrastructure request logs. Do not export those paths
or capture live QR screenshots. Automated layout captures mask the QR.

Use the already configured HTTPS APP_ORIGIN in production. Future domain changes
require coordinated APP_ORIGIN, Auth redirect allowlists and email configuration;
QR/Bond logic is unchanged. No Squarespace DNS changes belong to this task.
No new environment variable, key, schema grant or RLS exception is introduced.
One active invitation limits issuance; owner/IP rate limits and abuse reporting
can be added at the service boundary later. Physical scan reliability and real
email latency still require the procedure below. A five-minute invitation may
expire during onboarding; never bypass or silently renew it.

## Mandatory physical production procedure

1. Device A signs in as a genuine owner and checks MY ATOM, then selects CREATE
   BOND. Close/reopen before use and confirm the same invitation/expiry remains.
2. A separate physical phone B, in a fresh browser session, scans with its normal
   camera. Confirm HTTPS, correct public inviter and separate ownership.
3. B uses a genuine new email, validated canonical home region and optional
   alias/X. Open the real email, verify and confirm automatic invitation return.
   Record only the database-assigned public Atom number, never the private inbox.
4. Check no Bond exists before recipient confirmation. DECLINE creates none.
   Then explicitly CONFIRM BOND with the participants' consent.
5. Verify exactly one confirmed unordered pair, confirmed timestamp and accepted
   originating invitation. Both devices see reciprocal direct context and actual
   counts after polling/focus/manual refresh.
6. A explicitly sends an emotion; B enables FEEL YOUR NETWORK and observes that
   persistent connected Pulse. Reverse if useful; never infer a participant's mood.
7. Rescan the consumed QR: no new Atom/Bond. Open a later invitation as the same
   recipient: YOU ARE ALREADY BONDED. Keep genuine participants and their Bond.
8. Record deployment commit, device results, public numbers, active/confirmed
   counts and remaining limitations. Do not reset sequences or reuse retired
   numbers. Only then finalize v0.8.0. Do not begin Task #9.

Automated checks cover QR decoding, reuse, isolated sessions, new/existing Auth
continuation, decline, authoritative confirmation, reciprocal two-Atom reach,
connected Pulse, consumed/cancelled/expired invitations and duplicate states at
390×844, 768×1024 and 1440×900. Existing database security/concurrency tests remain
required. Automated browsers are not a substitute for the physical procedure.
