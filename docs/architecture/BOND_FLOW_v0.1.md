# Bond Flow v0.1 — Task #4

Version 0.4.0 adds a complete in-memory participation loop. It does not change
the frozen Master Specification or Build Blueprint and does not begin Task #5.

## State machine and integrity

The initiating verified Atom creates a five-minute invitation. That action
expresses the inviter's intent; the recipient must separately confirm. A
deterministic development code identifies the invitation. Codes are not security
tokens. The QR-style illustration is explicitly non-scannable. The mock link
opens the recipient flow inside the current session; it is not a shareable or
durable invitation. Refreshing or opening another tab starts a new session.

| Action                             | Resulting state                                  |
| ---------------------------------- | ------------------------------------------------ |
| Create invitation                  | INVITE_CREATED                                   |
| Open as recipient                  | INVITE_OPENED                                    |
| Choose new Atom                    | NEW_ATOM_REQUIRED                                |
| Submit validated details           | ATOM_DETAILS_ENTERED, EMAIL_VERIFICATION_PENDING |
| Simulate verification              | EMAIL_VERIFIED, BOND_CONFIRMATION_PENDING        |
| Identify verified existing Atom    | BOND_CONFIRMATION_PENDING                        |
| Explicitly confirm                 | RECIPIENT_CONFIRMED, BOND_CONFIRMED              |
| Decline                            | DECLINED                                         |
| Deadline reached before completion | EXPIRED                                          |

Every transition is stored in immutable invitation history. Intermediate states
within one synchronous service operation remain recorded even when the screen
advances directly to the next actionable state. Terminal states cannot be
replayed. A controllable service clock enforces expiration on reads and actions;
the browser countdown is informational, not the authority. Closing the dialog
does not confirm anything; a pending pair reservation lasts until decline or
expiry. A freshly created invitation can be used after expiry.

Before confirmation, the original graph object remains unchanged. Confirmation
checks the state, deadline, verified recipient, non-self pair, existing edges,
and other active pair reservations (including reverse ordering). Only then does
it record recipient affirmation and confirmed state and publish a new immutable
graph snapshot. A new recipient is added at that point; an existing recipient's
whole connected component becomes reachable through the new edge. Endpoint
degrees increase by one. Source fixture objects are not mutated. Duplicate
confirmed pairs display **YOU ARE ALREADY BONDED**; active reservations display
a pending-confirmation message. Decline changes only private invitation state:
no public marker, score, edge, or penalty is created.

The mock models mutual intent but is not secure authentication. Production
requires server-side authorization, durable transactions, a unique unordered
pair constraint, invitation token/expiry checks, and delivery error handling.
Those integrations remain out of scope.

## Deterministic impact

`networkReach` computes before and after sets from actual graph snapshots.
Counts include the selected Atom, matching existing Living Atom behavior.

| Scenario from original Atom #00000001  | Direct Bonds | Reachable people | Known cities | Countries |
| -------------------------------------- | ------------ | ---------------- | ------------ | --------- |
| New Boynton Beach Atom                 | 12 → 13      | 640 → 641        | 0 → 1        | 3 → 4     |
| Existing Atom #00000541 (South Africa) | 12 → 13      | 640 → 820        | 0 → 0        | 3 → 4     |

The success view shows exact changes and only supported geographic expansion.
The graph is committed on confirmation; **See your network** publishes that
snapshot to the still-mounted Living Atom and returns to the initiating
perspective. Closing the success dialog performs the same presentation update.

## Living Atom integration

The existing renderer, orbital clock, camera, scene membership, Pulse traversal,
and inspection model are retained. A generic optional arrival ID triggers a
2.8-second presentation sequence: the connected Atom approaches, its edge
appears, center and recipient illuminate, newly represented nearby members
emerge, then distant members appear. Existing represented members stay visible.
Reduced motion shows the final state immediately. Statistics reflect the
committed graph immediately; animation never delays or invents graph validity.
There is no confetti and no business logic in the renderer.

Create Bond is exposed only from My Atom. Contextual inspection still precedes
View their network; My Atom restores the original perspective. Context shows
recent Bond time, public home region when known, and derived reach. The graph
contract adds only optional public coarse location metadata. Pulse and ambient
motion continue through existing controls. All service state lives outside the
visualization.

## Validation and limitations

Known-good Task #4 baseline, verified September 22, 2026:

| Check                                               | Result                                                |
| --------------------------------------------------- | ----------------------------------------------------- |
| Formatting, ESLint, strict TypeScript               | Passed                                                |
| Unit/graph/service tests                            | 56 passed                                             |
| Chromium browser regressions                        | 27 passed across all three viewport projects          |
| Next.js production build                            | Passed                                                |
| Responsive review                                   | 36 flow screenshots inspected; no horizontal overflow |
| Governing documents and stable graph/motion modules | Hashes unchanged                                      |

The complete `pnpm check` passed, followed by a final formatting/type check and
successful production build. The repository has no new dependencies. The current reference images are retained in
[`artifacts/references/participation-v0.1`](../../artifacts/references/participation-v0.1).
Screenshots use a synthetic `example.com` email, never a real private address.

The live arrival sequence was also reviewed on the production server at all
three viewport sizes with a controlled browser clock. Twelve additional frames
show 50, 600, 1600, and 3000ms after connection: existing members stay visible,
the new direct Atom approaches, its Bond forms, both endpoints illuminate, and
the South African component emerges. Ambient motion, selection, View their
network, and My Atom were rechecked after arrival. Observations are recorded in
[`arrival-review.json`](../../artifacts/references/participation-v0.1/arrival-review.json).

Unit/integration tests cover onboarding, private/public boundaries, deterministic
locations/reach, transitions, verification, expiry, active/reverse/confirmed
duplicates, decline, no premature graph mutation, immutable commits, and scene
selection after growth. Browser tests cover both recipient paths, form errors,
keyboard autocomplete, editing invalidation, masked verification, exact impact,
new-Atom inspection, View their network, My Atom, Pulse, and reduced/ambient motion.
Existing regressions are retained.

Screenshots cover Create Bond, invitation, form, open autocomplete, selected
canonical location, verification, confirmation, success, updated network,
new-Atom context, regional reach, and existing-network impact at 390 × 844,
768 × 1024, and 1440 × 900. See Task #4 reference captures and test results.

Intentional limitations: session-only storage, simulated identity and verification,
development codes/QR illustration, partial city coverage, no real email or
geocoding, no production accounts/database, and no recurring delivery. The
original 1,000-Atom fixture remains unchanged; confirmed local changes are layered
onto it only in the current browser session.
