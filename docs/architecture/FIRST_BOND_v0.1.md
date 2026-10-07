# First Bond Invitation State — Task #10.3

Approved for v0.10.3 publication. No migration required. Master Spec remains unchanged.

## Eligibility and data separation

Only the authenticated owner's ACTIVE, authoritative confirmed graph with zero
incident Bonds enables the presentation. `OwnerExperience` derives this on every
existing reconciliation. Public views, inactive lifecycle states and established
owners do not opt in. There is no persisted onboarding flag or additional query,
polling, event tracking, graph entity or analytics contribution.

Four open dotted rings are drawn by the existing Canvas renderer around the real
central Atom. They have no identifiers, labels, profiles, hit targets or selector
options. They are neutral dashed affordances, distinct from filled real Atoms and
emotion-colored Pulse particles. They never enter scene nodes/edges, reach,
regional metrics, Pulse, Connected Groups or Supabase.

## Presentation and confirmation

YOUR ATOM IS READY and the contextual CREATE YOUR FIRST BOND button explain the
next action. The existing authoritative invitation action, reuse, expiration,
consent and secure QR implementation are unchanged. The QR asks someone else to
scan, create/access their own Atom and explicitly confirm. It does not promise
that scanning alone creates a Bond. Waiting ends on expiry/cancel/confirmation.

On the observed zero-to-confirmed transition, rings fade over 350ms; the existing
2.8-second arrival animation introduces the real network. YOUR NETWORK HAS BEGUN
lasts 2.8 seconds without a modal. The receiver's existing pre-confirmation graph
also determines first-Bond acknowledgement, without a new read or changed Bond
operation. Reloading an established owner does not replay the acknowledgement.
Existing users retain their ordinary CREATE BOND label and experience.

## Motion and accessibility

One incomplete neutral stroke moves outward every five seconds, rotating among
the four rings. It stops short and fades; it never becomes a real Bond. The
renderer uses its existing ambient clock and visibility/pause behavior. Reduced
motion leaves static rings and instructions with no traveling gesture. Decorative
canvas marks have no individual accessibility entries. Semantic guidance explains
zero confirmed Bonds and potential connections. Existing keyboard, focus and Pulse
controls remain available.

## Analytics audit only

Existing `atom_identities.email_verified_at` and retained `bonds.confirmed_at`
support a limited verified-identity-to-earliest-retained-Bond calculation. They do
not establish a complete immutable activation/conversion history: identity rows
are removed on deletion, reactivation is separate, old Bonds may not provide full
historical events, and Atom `created_at` can precede verification. Number-ledger
reservation timestamps are not an all-purpose activation event either. No new
conversion metric, event infrastructure, tracking or Admin report is added here.
A future aggregate proposal should define cohort and missing-history semantics.

## Local review

Review the isolated local fixture, never a production participant, at 390×844,
768×1024 and 1440×900. Check zero state, QR/waiting, cancellation/expiry, confirmed
transition, established view and reduced motion. Fixture email verification and
Bonds use the existing local Auth test server; no real email is sent. Changes
were held uncommitted until product approval; publication is now approved.

Verification: 238 unit/integration tests, 60 authenticated browser tests, 81 public
browser tests and 3 persistence browser tests passed. Native PostgreSQL
concurrency/restart checks, client security boundary, secret scans, formatting,
lint, TypeScript and production build passed. Screenshots were reviewed at all
three reference sizes, including zero state, QR instructions and first-confirmed
transition. No hosted migration or production deployment was performed.
