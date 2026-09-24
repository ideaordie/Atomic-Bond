# Changelog

## Documentation migration — Master Product Specification v0.2

- Master Product Specification v0.2 approved as the authoritative frozen product
  specification; v0.2 supersedes v0.1, which remains preserved as historical only.
- Emotional Pulse added as a core Atomic Bond mechanic, and Feel the Network
  added as a core network experience.
- Active emotional states expire after 24 hours. Emotional state is explicitly
  user-selected and never inferred; it is not an emotional ranking or reputation
  system.
- Updated governing references in AGENTS, README and the Build Blueprint, and
  protected the exact supplied v0.2 file from formatting and line-ending changes.
  No application code changed; Task #5.2 has not begun.

## 0.5.1 — Task #5.1 / Atom Identity Context

- Added prominent optional aliases beside the permanent public Atom identifier;
  absent alias/X data produces no placeholder rows.
- Made the validated X handle itself part of the accessible external profile
  link, preserving unverified ownership and the current network state.
- Anchored relationship context to the user's Atom after perspective changes,
  with direct/indirect labels and concise accessible relationship paths.
- Retained network/coarse region information and added partial known-city reach.
  Bounded panel height, wrapping, and a sticky recenter action support mobile.
- Added public identity/privacy and browser regression coverage. No backend,
  frozen specification change, fixture change or Task #6 work was introduced.
- Verified formatting, lint, TypeScript, production build, 102 unit/graph/service
  tests and 45 browser tests. Reviewed 18 captures across mobile, tablet and
  desktop, including all optional identity combinations and relationship types.

## 0.5.0 — Task #5 / Deployment Foundation

- Audited the valid local Git repository and publication boundaries; no real
  credentials or private contact data found in publishable source.
- Preserved review captures outside the public web root in ignored
  `artifacts/references/`, with updated documentation paths.
- Added empty future environment placeholders and expanded local/generated
  file exclusions. Disabled persisted GitHub checkout credentials.
- Added production route/asset and private-file exclusion checks, retaining
  all existing tests. Documented GitHub/Vercel setup, environment boundaries,
  preview acceptance, Squarespace's future DNS role and rollback.
- Product source, deterministic fixtures, dependencies, frozen specification
  and Build Blueprint remain unchanged. No remote, deployment, domain, backend
  integration or Task #6 work was introduced.
- Verified frozen installation, formatting, lint, TypeScript, 96 unit/graph/service/
  security tests, production build and 33 Chromium browser tests. Production
  dependency audit reported no known vulnerabilities.

## 0.4.1 — Task #4.1 / Optional X Profile

- Added optional public X handles to onboarding; email and canonical home region
  remain the only required fields.
- Normalize an optional leading `@` and validate handle syntax independently
  in the form and Atom service. Reject URLs and invalid characters.
- Added a shared public social-profile model with unverified ownership metadata
  and a reserved future verified form, separate from private email identity.
- Selected Atoms with handles display **𝕏 @username** and **VIEW ON X**. Links
  are constructed from validated handles and open externally with opener and
  referrer protection. Atoms without handles show no X UI.
- Added unit/rendering/browser coverage and updated onboarding architecture.
  No ownership verification, X integration, dependencies, or specification
  changes were introduced. No subsequent task has begun.

## 0.4.0 — Task #4 / Atom Onboarding & Simulated Bond Creation

- Added a development-only Create Bond flow with five-minute invitations,
  explicit new/existing recipient paths, verified-email gating, confirmation,
  decline, expiration, and active/confirmed pair duplicate prevention.
- Added replaceable Atom, Bond, Location, and Notification service contracts
  and local mock implementations with separated public/private records.
- Added a deterministic 46-city canonical location catalog, accessible
  autocomplete, and independent service validation. Email remains private.
- Confirmed Bonds publish immutable graph snapshots with exact network and
  geographic impact. Added a restrained arrival presentation and coarse home
  region/recent Bond information in the existing Atom context.
- Added onboarding/Bond architecture documents and unit/browser regression
  coverage across mobile, tablet, and desktop.

The starting mock fixture, BFS, base scene, camera, orbital motion, and Pulse
traversal remain intact. No dependencies, production services, specification
revision, or Task #5 implementation were introduced.

## 0.3.1 — Task #3.1 / Restore Living Atom Motion

### Fixed

- Replaced effectively imperceptible local offsets with independent elliptical
  direct-Atom orbits and depth motion. Preserved the approved initial layout.
- Made nearby systems follow their direct parent while retaining local motion;
  added restrained cloud shimmer and core shading movement.
- Added an active-time clock: Pause freezes the current arrangement and Resume
  continues smoothly, excluding paused/hidden time. Ambient animation stays
  outside React state and uses the existing approximately 30fps render loop.
- Separated manual ambient pause from reduced-motion accessibility behavior,
  allowing Pulse to remain animated while ambient positions are paused.
- Added regression coverage for perceptible projected motion, pause continuity,
  parent coherence, current Bond endpoints/hit targets and moving selection.

The root cause and verification are documented in
[Living Atom v0.2](architecture/LIVING_ATOM_v0.2.md#task-31-root-cause).
Graph algorithms, fixture, visual layout, controls and frozen specifications
remain unchanged. No dependencies or backend functionality added. No Task #4.

## 0.3.0 — Task #3 / Living Atom Spatial Experience v0.2

### Changed

- Replaced radial shells and numbered aggregate bubbles with Canvas 2D perspective
  depth, irregular local orbits, a dimensional gold center and regional clouds.
- Made selection inspect first; View their network explicitly changes perspective,
  while My Atom restores the original Atom. Added relationship paths and reach.
- Added progressive People/Networks/Regions scales and human-centered fixture metrics.
- Refined graph-aware Pulse with energy traveling through Bonds and cloud lighting.
  Reserved outgoing/returning presentation intent without return communication.
- Added spatial regression tests and responsive review captures. Updated current
  documentation in [Spatial Experience v0.2](architecture/LIVING_ATOM_v0.2.md).

### Preserved

- Deterministic fixture, shared graph contract, BFS, base scene, camera helpers,
  Pulse traversal, existing unit/graph tests and landing tests remain unchanged.
- Existing browser interactions remain covered, with selection expectations
  updated for the explicitly requested inspect-then-view behavior.
- No governing specification, blueprint, historical release record, dependencies
  or backend infrastructure changed. Task #4 has not begun.

## 0.2.0 — Foundation Task #2 / Living Atom Engine v0.1

### Added

- `/explore` with a modular Canvas 2D Living Atom consuming shared graph data.
- Deterministic BFS perspectives and degree shells, a luminous center, distinct
  near layers, and exact-distance aggregate groups through eight degrees.
- Mouse/touch selection, recentering, original-Atom return, bounded zoom,
  cursor-anchored wheel zoom, pointer pan, pinch, keyboard controls and Fit.
- Graph-aware Pulse with ordered node/edge activation and text progress.
- Gentle motion, pause/resume, reduced-motion rendering, resize handling and
  renderer cleanup. Accessible selectors include paged aggregate members.
- Network readouts that distinguish represented, reachable, and disconnected
  Atoms. No inferred trust or authoritative Bond creation.
- Unit/graph/browser regression tests and reference screenshots at all three
  required viewport sizes.

### Preserved

- The original mock fixture, canonical graph types, frozen Master Specification,
  Build Blueprint, AGENTS.md, and v0.1.0 baseline record are unchanged.
- All Foundation Task #1 tests remain intact. The landing page gains an explorer link.
- No new dependencies or backend services. No Task #3 work.

### Verification

See [Living Atom architecture and verification](architecture/LIVING_ATOM_v0.1.md).

## 0.1.0 — Foundation Task #1

### Added

- Next.js, React and strict TypeScript application shell with a minimal,
  responsive Atomic Bond landing page.
- ESLint, Prettier, Vitest, Playwright, package scripts and GitHub Actions CI.
- Blueprint module directories with explicit placeholders for future work.
- Public `GraphNode`, `GraphEdge`, and `GraphData` contracts.
- Deterministic mock fixture v1: 1,000 Atoms, 4,062 Bonds, three components,
  dense and sparse clusters, known Bridges, long paths, and five coarse regions.
- Regression tests and developer setup/architecture documentation.

### Scope

The Master Product Specification, Build Blueprint, and AGENTS.md remain unchanged.
Supabase, authentication, email, production Atom/Bond creation, QR codes, sharing,
Pulse and the Living Atom visualization remain unimplemented.

### Verification

See [baseline verification](architecture/BASELINE_v0.1.0.md) for executed checks
and any environment limitations. Foundation Task #2 has not begun.
