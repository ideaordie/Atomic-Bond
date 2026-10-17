# First Bond invitation experience — Task #16.1 local review

Baseline: v0.16.0, `761afaf`. The accepted local candidate was subsequently authorized for publication as v0.16.1; no hosted database changes are required.
Frozen Master Spec v0.7, consent, lifecycle, Auth, RPCs, RLS and five-minute expiry remain unchanged.

## Flow and clock

CREATE BOND now opens a local chooser; opening/closing it creates no invitation.
TOGETHER IN PERSON deliberately prepares the existing invitation and shows its QR.
SEND TO SOMEONE deliberately prepares the same kind of invitation and presents SEND INVITATION and COPY LINK without a QR above them.
The chooser explains consent and timing before either action.

The existing PostgreSQL `create_bond_invitation` operation assigns `created_at` and
`expires_at` (five minutes later) on creation. Server/network/QR preparation time
uses part of that interval. An existing active invitation is reused with its
original deadline. Neither changing paths, sharing, copying nor reopening renews it.
The displayed countdown is informational; the recipient RPC remains authoritative.
No request is prefetched when opening the chooser.

A separate SEND tap invokes native sharing synchronously from a user gesture,
without first awaiting an RPC. Safari may otherwise lose transient activation.
This is the smallest safe change using the current server-action/owner architecture.
The clock begins at preparation, not share-sheet launch or delivery. A share sheet
can remain open past expiry; a previously shared link still expires server-side.

## Delivery, privacy and recovery

Native sharing includes a friendly generic message and the trusted server-built
Atomic Bond invitation URL. No private identity, email or Atom number is included
in the message. The intended recipient receives a capability; users are told to
share privately. Sharing completion never claims delivery or Bond confirmation.
Cancellation/errors leave COPY LINK available. Clipboard denial offers an explicitly
labelled selectable private link. Link display is removed on local expiry or path
switch. No capability is persisted to local/session storage or sent to analytics.

Closing preserves the server invitation; explicit cancellation uses the unchanged
owner-authorized action. Expiry removes QR/share/copy controls and returns to the
chooser for deliberate fresh creation. Repeated actions are guarded while pending.
Existing recipient onboarding/verification continuation and explicit CONFIRM BOND
remain unchanged. The existing first-Bond rings, instruction and success animation
are preserved. Actual authorized confirmation still closes the invitation through
the existing network reconciler.

## Local demonstration

`http://127.0.0.1:3140/review/invitation` reuses the production dialog with synthetic
preparation and cancellation callbacks. Its QR/link opens a clearly labelled local
recipient simulation. It performs no production RPCs or email delivery and renders only the Next.js not-found page
in production builds (streamed responses may have HTTP 200). Native OS sharing requires physical-device review; automated
coverage stubs the browser API and does not claim that a message was delivered.

## Separate remote-lifetime recommendation (not implemented)

Investigate a bounded 30-minute remote-invitation pilot after measuring recipient
opens and completion time. Five minutes is a poor fit for asynchronous messaging,
but expired records alone cannot prove the recipient needed longer. Keep in-person
invitations at five minutes. No lifetime change is part of this candidate.

A separate lifetime needs explicit product/security approval and a migration:
invitation channel/lifetime must be validated server-side; the existing five-minute
database constraint, RPC construction, tests and copy must be updated together.
Do not extend existing records or reuse an invitation with a silently changed deadline.
Decide explicitly how the one-active-invitation rule handles switching channels.
Longer bearer-capability exposure increases forwarding/leak/replay-attempt windows
and keeps invitations/secrets live longer; retain single-use, cancellation,
verified ACTIVE owners, unique pairs, bounded creation and authoritative expiry.
No auto-confirmation, transferred trust or invitation to arbitrary email addresses.

## Measurement proposal — inactive

No new tracking calls, events, analytics permissions or database writes are added.

| Signal                      | Authority and counting                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| Invitation flow opened      | Client, once per deliberate opening, not rerenders                                         |
| QR path chosen              | Client, once per deliberate selection; bounded per flow                                    |
| Remote path chosen          | Client, once per deliberate selection; bounded per flow                                    |
| Share sheet invoked         | Client attempt only; never evidence of delivery                                            |
| Link copied                 | Successful Clipboard promise; manual copy cannot be proven                                 |
| Recipient invitation opened | Server validation, separated from scanners/prefetch and invalid/expired links; not consent |
| Invitation created          | Distinct committed database invitation, not reuse/retries                                  |
| Bond confirmed              | Distinct committed confirmed Bond, not clicks or page loads                                |

Prefer existing aggregate database records for creation/confirmation. Future
client counts should be capped per flow/session and use only bounded enums such as
path=person/remote or outcome=invoked/cancelled/unavailable/copied. No identifiers,
email, alias, Atom number, token, URL, invitation ID or Auth details in third-party
properties. Avoid cross-device identity joining. Keep internal deduplication private
and minimally retained; decide retention and scanner handling before implementation.

The Vercel wrapper currently rejects all custom events and restricts page views to
four general routes. The SDK can attach current URL/referrer independently of event
properties. Merely allowing `track()` on `/bond/<secret>` or Auth routes is unsafe.
Review the complete SDK payload, URL/referrer handling and first-party aggregation
boundary before activating any measurement. Preserve sensitive-route exclusions;
prefer aggregate server reporting for recipient and confirmation outcomes.

Evaluate: first genuine Bond within 24h/7d of activation with mature cohorts;
creation-to-confirmation, valid-open-to-confirmation and expired-after-open rates;
share/copy attempts as diagnostics only. Exclude documented fixtures and account
lifecycle states consistently. Do not infer delivery from a share/copy event.

## Local verification

- 461 unit/integration/security tests passed; PostgreSQL concurrency and restart
  checks passed, including Bond, lifecycle and growth protections.
- 30 targeted authenticated browser cases passed across 390×844, 768×1024 and
  1440×900. The final sharing cases were rerun at all three sizes after copy/focus
  refinements. Native sharing and clipboard responses use controlled test doubles.
- General browser suite: 111 cases passed initially; three new preview-isolation
  assertions initially assumed HTTP 404. After correcting only that assumption
  for Next.js streamed not-found responses, all three passed on rerun. Existing
  private-artifact exclusion assertions remain unchanged. Three persistence
  browser cases also passed.
- Formatting, lint, TypeScript, production build, client/server boundary checks,
  diff whitespace checks and configured-secret scan passed. Light/Dark captures
  and keyboard interaction were checked. No hosted invitations or Bonds were used.
- Physical iPhone Safari share-sheet handoff, recipient app delivery and real
  cross-device clipboard behavior remain product/device checks, not verified by
  browser mocks. The local recipient screen is explicitly a simulation; existing
  authenticated recipient confirmation is covered by the isolated database tests.

No commit, deployment, schema migration, analytics activation or specification
amendment is part of this local checkpoint.

## Publication-readiness acceptance — proposed v0.16.1

The final acceptance adds synthetic-database ID/timestamp comparisons to the
browser suite. Opening CREATE BOND has no timer or invitation write. Selecting
the remote path creates one record with an exact 300,000 ms lifetime. Cancelling
the simulated share sheet, closing/reopening the dialog and switching paths
preserve that record and deadline. COPY LINK has its own success/failure path.
Expiry recovery requires deliberate preparation of a different authorized record;
the in-person path also produces an exact 300,000 ms lifetime. Recipient tests
reject expired capabilities and require explicit authenticated confirmation.

The proposed patch is **v0.16.1 — First Bond invitation paths**. Publication is
not authorized by this acceptance checkpoint. v0.16.0 remains the production
baseline until a separate commit/deployment approval. No new lifetime, analytics,
database or Master Spec change is proposed for this patch.

**Device limitation:** native iPhone Safari share-sheet invocation, cancellation
and handoff have not been physically verified. Browser mocks establish application
handling only; they do not establish native iOS compatibility or message delivery.
COPY LINK/manual selection remains independently available.

Final targeted acceptance: all nine QR/sharing/recipient browser cases passed at
390×844, 768×1024 and 1440×900; 84 targeted unit/database/security cases passed.
The countdown is also asserted to intersect the viewport in both paths. The
PostgreSQL concurrency/restart suite passed on retry; its first invocation exited
without a diagnostic before reporting any test result. No database or application
change was needed for the retry. Candidate production build/TypeScript, targeted
lint, formatting, diff checks and the configured-secret scan passed (661 files,
zero matches). Earlier full regression results above remain applicable because
this acceptance stage changed only tests, test-fixture inspection and release
metadata/documentation, not application behavior.

## Publication authorization

The product owner approved publication of v0.16.1 after the final acceptance
report. The local-checkpoint statements above record the earlier approval gates.
This release changes invitation presentation and deliberate preparation timing
only. Five-minute expiry, mutual confirmation, first-Bond guidance, existing
analytics exclusions and frozen Master Spec v0.7 are preserved. Physical native
iPhone share-sheet verification remains a follow-up; production verification must
not create registrations, invitation records or Bonds.
