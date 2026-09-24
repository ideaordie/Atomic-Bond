# Atom Onboarding v0.1 — Task #4

## Public identity context — Task #5.1

The public profile contract remains unchanged: `PublicAtom.alias` maps to
`GraphNode.displayName`, `publicId` remains the permanent visible number, and
`socialProfiles` holds optional validated public handles. The context panel
renders only these public identity fields and coarse geography, never the
PrivateIdentity record or arbitrary metadata. Future Supabase adapters must
produce this same public projection; no backend integration is added here.

Aliases are prominent when present and omitted when absent. The X handle itself
is now part of the accessible **VIEW ON X** link. It uses normalized handle-based
URL construction, opens externally, and continues to state unverified ownership.
No email, authentication fields, notification preferences, private identifiers
or precise coordinates are required or rendered by the panel.

## Original implementation

Implementation decision:

> Creating an Atom requires a verified email address and a validated coarse home region. A conventional username/password login is not required.

The form creates a pending Atom record; verification is required before it can
participate in a confirmed Bond. This is a local development simulation, not
production ownership or authentication. No email, magic link, GPS request,
external lookup, or database operation is performed.

## Boundaries and data

`src/services/participation/contracts.ts` defines replaceable AtomService,
BondService, LocationService, and NotificationService interfaces. Their mock
implementations are composed once per mounted participation experience. UI
components use those interfaces; the composition root chooses mock providers.
Graph traversal and the Living Atom remain independent of these services.

Implementations live in the blueprint's `services/atoms`, `services/bonds`,
`services/locations`, and `services/notifications` modules; `services/participation`
holds their shared contracts and composition. The location catalog stays in
`data/mock`, and reach calculations live in `graph/metrics` with public types
in `types/graph`. No service dependency is introduced into graph algorithms.

PublicAtom contains internal/public IDs, optional alias, and canonical coarse
home region. Network statistics are derived separately from the public graph by
`networkReach`, rather than cached on identity records. PrivateIdentity contains
email, verification status, and notification preferences, stored in a separate
private map. Public objects, graph snapshots, impact results, and URLs contain
no identity payloads. The verification UI receives only a masked email label.
Nothing is written to browser storage, cookies, or logs; refresh clears the
session. Existing fixture Atoms simulate verified identities without inventing
private email addresses.

Client and AtomService both validate email structure. Service validation is
independent of form validation. Email is normalized for duplicate detection in
the current session. Alias is optional, limited to 60 characters, and rendered
as text. The form never asks for passwords, phone numbers, birth dates, or exact
addresses. Structural email validation does not claim deliverability.

## Canonical location contract

Location contains `id`, `city`, `region`, `country`, `countryCode`, `displayName`,
and optional `centroidLatitude`/`centroidLongitude`. Coordinates, if a future
provider supplies them, mean approximate public city centroids, never personal
coordinates. The current catalog deliberately omits all coordinates.

MockLocationService searches a fixed 46-city catalog in deterministic order,
case-insensitively, with at least two input characters and at most eight results.
It includes Boynton Beach, other Florida cities, multiple US states, Canada,
Mexico, South America, Europe, Africa, Asia, and Oceania. Portland, Oregon and
Portland, Maine exercise ambiguity. This is a curated test catalog, not a claim
of comprehensive coverage.

The accessible combobox supports arrows, Enter, Escape, pointer selection, and
announces the selected city/region/country. Editing its text immediately clears
the selected canonical ID. The service accepts only IDs resolved by the provider;
free text and fabricated IDs are rejected. A production location provider should
implement search/resolve with stable IDs and validate the selected result on the
server. UI presentation can remain the same; an asynchronous production adapter
will need loading/cancellation/error handling. No external provider is selected.

## Verification and notification boundary

Pending Atom creation records `ATOM_DETAILS_ENTERED`, then
`EMAIL_VERIFICATION_PENDING`. The development verification action marks the private
identity verified, records `EMAIL_VERIFIED`, and advances to
`BOND_CONFIRMATION_PENDING`. Pending Atoms remain outside the public graph.

NotificationService reserves `sendVerificationEmail`, `sendMagicAccessLink`,
`sendBondNotification`, and `sendGrowthDigest`. MockNotificationService is a no-op:
no payload logging, delivery, subscriptions, or scheduling. Future Resend delivery
belongs behind this private boundary and must pair with server authorization,
expiring verification tokens, and retry/error handling. None is implemented now.
Current service methods are synchronous because local operations are synchronous;
production adapters will require asynchronous application orchestration.

Preferences model transactional verification/access plus a growth digest of
weekly, monthly, or disabled (default). No settings UI or scheduler exists.
Production recurring digests must be configurable and unsubscribable.

## Geographic accounting

New Atoms contribute their selected city, region, and country. Existing fixture
Atoms contribute only their known regions and countries. City counts are labeled
**known cities** and explicitly described as partial. Reach uses deterministic
BFS and unique canonical city/region/country identifiers. No unknown cities are
inferred from regional metadata. New-city/country highlights require a genuine
set difference between before and after snapshots.

Tests cover provider determinism, ambiguous names, canonical validation, lack of
coordinate collection, email validation, private delivery payload versus public
objects, verification guards, and browser selection invalidation.

## Optional public X profile — Task #4.1 / v0.4.1

Onboarding accepts an optional **X handle**. Email and a selected canonical home
region remain the only required fields; alias and X handle may both be omitted.
The field explicitly states that it is public and does not verify X ownership.

`normalizeXHandle` in `utils/x-profile.ts` trims outer whitespace, removes one
leading `@`, preserves case, and accepts 1–15 ASCII letters, digits, or
underscores. Empty/whitespace-only input is omitted. An isolated `@`, repeated
`@`, internal whitespace, punctuation, Unicode lookalikes, email addresses,
and URLs are rejected. Client and AtomService independently invoke this shared
validation before accepting details; invalid input creates no Atom or identity.

This is validation of an existing profile reference, not account registration,
availability, account existence, or ownership. Short existing handles are allowed;
the character set and maximum length follow
[X's username guidance](https://help.x.com/en/managing-your-account/x-username-rules).
No X API request or provider authentication is performed.

PublicAtom and GraphNode share the optional `socialProfiles` model from
`types/public-profile.ts`. Its `x` entry contains only a normalized `handle` and
public verification metadata. Current creation always writes
`verification: { status: "unverified" }`. The type reserves a future trusted
`verified` variant requiring `verifiedAt`; no onboarding input can set that
variant, and email verification never changes social verification. A future
verification service can attach public attestations without changing the base
Atom shape. Tokens, credentials, and verification evidence must stay private.

PrivateIdentity is unchanged. Email is neither used to derive the X handle nor
included in public profile objects, graph projections, or outbound links.

The selected Atom's context displays **𝕏 @username**, **Ownership not verified**,
and **VIEW ON X** only when a valid handle is present. The public-profile UI is
outside the renderer. `xProfileUrl` revalidates the handle and constructs
`https://x.com/{handle}` from a fixed origin; user-supplied URLs are never stored.
Malformed public projections fail closed and render no X UI. External links use
a new tab, `noopener noreferrer`, and a no-referrer policy, with an accessible
new-tab label. No embedding, account lookup, or ownership badge is implemented.

Tests cover omitted handles, both entry forms, normalization, valid/invalid
formats, URL rejection, public serialization/privacy, safe URL construction,
absent/present profile rendering, and keyboard-triggered external navigation
with the destination intercepted so tests do not contact X.

Task #4.1 verification: 94 unit/graph/service/rendering tests and 30 Chromium
browser tests passed, including all previous regressions. Strict TypeScript,
ESLint, formatting, and the production build passed. Onboarding and selected
profile screenshots were inspected at 390 × 844, 768 × 1024, and 1440 × 900;
the mobile dialog scrolls vertically as needed, and no horizontal overflow was
found. Six screenshots using synthetic example data are retained in
[`artifacts/references/x-profile-v0.1`](../../artifacts/references/x-profile-v0.1).
The frozen Master Specification and Build Blueprint remain unchanged.
