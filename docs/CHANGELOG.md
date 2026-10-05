# Changelog

## v0.10.1 — Beta UI Polish

- Product-reviewed graphical follow-up to approved v0.10.0 commit `8fe3e6678c78085000fb3e27e7c0cb91b34042f9`, retained unchanged in Git history. This final beta release designation preserves earlier historical version entries.
- No changes to product mechanics, Auth, database, Bonds, Pulse, Signal persistence/publication, growth scheduling, lifecycle, PWA, authorization or Master Spec.

- Removed the Overview expand/collapse glyph and matched its expanded responsive width to Network Signal (480px maximum with 16px page margins).
- Unified expanded Network Overview and Network Signal headings, close controls, body typography and panel styling without changing content, persistence or publication behavior.
- Release audit: the baseline delta is limited to these presentation files, browser regression assertions and release documentation. All ten hosted migrations and Tuesday growth scheduling are unchanged. Master Spec is unchanged.
- Verification: formatting, lint, TypeScript/build, 235 unit/integration/security cases, native PostgreSQL concurrency/restart checks and server-only client-boundary checks passed. The main browser suite passed 80 cases initially; one desktop Pulse timing timeout passed an unchanged targeted rerun. All three persistence cases passed. Secret scans found no repository or browser credential leakage.
- All 54 authenticated browser cases passed. Visual review at 390×844, 768×1024 and 1440×900 confirmed the approved side-by-side information row, matched pop-up widths, readable scrolling content and primary-control/navigation alignment. Beta feature freeze remains in effect.

## v0.10.0 — Approved Network Signal beta baseline

- Final beta designation explicitly approved after the v0.10.1 mobile refinement and v0.10.2 canonical maintenance. Earlier release entries and commits remain historical and unchanged; this designation includes their accepted changes.
- Network Signal remains global and persistent, with no participant dismissal. The approved mobile information row remains side by side. Sponsorship remains disabled.
- Current founding administrator is Atom #1 through unchanged verified Auth membership. Retired #3 remains unavailable, without a redirect. The one-time maintenance acceptance is documented separately.
- Beta feature freeze: further work requires approval and is limited to bugs, security, serious usability issues, or small approved UI corrections unless a new product task is authorized.

## 0.10.2 — Canonical Atom maintenance support

- Added a generic unavailable public Atom page without identity disclosure or redirects.
- Added the approved, guarded one-time pre-beta #3 → #1 data maintenance operation and local preservation/abort tests. Production execution and fresh owner acceptance are recorded separately in the maintenance document; normal permanent-number rules remain unchanged.

## 0.10.1 — Mobile information row

- Kept Your Network Overview and Network Signal side by side on mobile with equal compact widths and padding. Expanded panels and Signal persistence remain unchanged.

## 0.10.0 — Task #10 / Persistent Network Signal

- Removed participant dismissal and browser-local suppression. Closing the expanded view now leaves the current Signal visible across reloads and visits; only the administrative publication lifecycle changes its visibility.
- Updated persistence browser coverage. Existing Signal records, administrator authorization and publication rules remain unchanged.
- Retired obsolete Signal-only dismissal keys without changing other browser preferences. The owner-published welcome Signal remains the controlled live-verification target; no additional publication or migration is required.

## 0.10.0-rc.1 — Task #10 / Network Signal candidate

- Added global Signal authoring, private administrator membership, verified ACTIVE-owner authorization, draft preview and database-time publication windows.
- Added a compact Living Atom Signal panel, HTTPS CTA validation and per-browser dismissal. Sponsorship remains disabled; no targeting, email or push.
- Production publication remains gated on explicit approval. No initial Signal is automatically published.
- Applied the additive Signal migration with existing participant/network data unchanged and provisioned verified Atom #3 membership. No new server credential, scheduling change or Master Spec revision.
- Regression/security/build checks passed, including 234 unit/integration cases, PostgreSQL concurrency, 81 main browser cases, 3 persistence cases and 51 Auth/browser cases; timing/offline-navigation failures passed isolated reruns. Live first-publication acceptance remains pending.
- Production candidate deployment and Atom #3 admin access passed. The welcome draft was saved/previewed and remains hidden from the normal Signal panel; zero Signals are published. Awaiting explicit first-publication approval.

## 0.9.3 — Task #9.3 / Account Deactivation & Reactivation

- Added a separate reversible DEACTIVATED lifecycle with owner confirmation, explicit verified reactivation and preserved number, private profile, preferences and confirmed Bonds. Permanent DELETE remains irreversible.
- Hidden optional public identity/location, cleared Pulse, cancelled invitations and suppressed weekly delivery while deactivated. Reactivation preserves weekly intent and establishes the current network as the growth baseline.
- Added session-cutoff protection, migrations, privacy copy and lifecycle/security/concurrency/browser coverage. Both migrations are applied with existing production data unchanged. Controlled Atom #5 completed ACTIVE → DEACTIVATED → ACTIVE with the same number and Bond, cleared Pulse, preserved weekly OFF preference and current growth baseline. The owner confirmed product and remaining live functionality acceptance; Atom #3 and deleted Atom #8 were protected.
- Master Spec received only the approved account-lifecycle clarification. No scheduling change or deleted-account recovery mechanism.
- Recorded the completed Task #9.2 Atom #8 deletion acceptance: anonymized DELETED, number and two structural Bonds retained, private identity/owner access removed. Same-email live re-registration was cancelled before execution.

- Final release checks passed: 224 unit/integration/security tests, PostgreSQL concurrency/restart, client boundary, production build, 81 main browser cases (one unchanged isolated retry), 3 persistence cases, 48 Auth/QR/PWA cases, formatting/lint/TypeScript and secret scans.

## 0.9.2 candidate — Task #9.2 account deletion

- Added two-stage DELETE ACCOUNT confirmation and recent passwordless authentication, with owner-derived database authorization and recoverable server-only Auth cleanup.
- Anonymized numbered tombstones retain confirmed Bonds and traversal. Deleted accounts lose private identity, alias/X, home region, Pulse, invitations and engagement delivery state; numbers are never recycled. Connected Atoms describes structural reach; emotional coverage excludes deleted participants.
- Added version-controlled deletion migration, concurrency/security/browser tests, beta privacy copy and operator documentation. No inactivity deletion or automatic dormancy. The separate server secret is configured and migration 202610040001 is applied without changing existing participants, Bonds or numbers. Controlled live acceptance remains pending. The user approved Atom #8 for acceptance; Atom #3 is protected from destructive testing.

## Unreleased — Overview action placement

- Moved YOUR NETWORK OVERVIEW to the bottom center, just above the CREATE BOND/PULSE dock. The expanded panel remains centered in the viewport.

## Unreleased — Centered network overview

- Centered the expanded YOUR NETWORK OVERVIEW panel in the viewport on mobile, tablet and desktop. The trigger remains below regional reach; scrolling and close behavior are preserved.

## Unreleased — Six-second Pulse propagation

- Scaled the outgoing Pulse animation and degree timing proportionally from 15 seconds to six seconds. Complete network reach, BFS sequencing, emotional colors, reduced motion and the independent 24-hour state are preserved.

## Unreleased — Beta About & privacy summary

- Added the public `/about` page with the approved explanation of Atoms, mutual Bonds, voluntary 24-hour Pulse, privacy, weekly growth email, participant choices and beta status. This is an informational/privacy summary, not a formal legal Privacy Policy.
- Added ABOUT immediately before Profile & preferences in network navigation, including after Bond confirmation, and made it available from the anonymous entry/public network views. Return navigation uses the existing home route to resolve the owner or anonymous entry appropriately.
- Audited the copy against public allowlist serialization, canonical country/subdivision signup, optional identity fields, authorized connected Pulse retrieval/expiry, activation preference defaults, purpose-limited unsubscribe and independent transactional email. No product mechanics, database, scheduling or Master Spec changes.

## Unreleased — Pulse status visibility

- Hid the owner Pulse status line visually while retaining its screen-reader announcement and unchanged 24-hour lifecycle.
- Positioned YOUR NETWORK OVERVIEW immediately below the regional reach information, with responsive expanded results.

## Unreleased — Contextual My Atom action

- MY ATOM replaces CREATE BOND in the same primary-action position and styling only while viewing another Atom's network. Selecting an Atom alone leaves CREATE BOND unchanged; returning home restores it.

## 0.9.1 — Weekly Atom Growth production scheduling

- Controlled Atom #3 email receipt, same-owner return, unsubscribe, transactional access after unsubscribe and explicit owner re-enable passed. Current preference provenance preserves current intent; append-only preference history is deferred.
- Enabled the approved Tuesday 16:00 UTC production schedule with a 10-attempt pilot cap, bounded sequential delivery, authorization, no-growth suppression and persistent period/concurrency safeguards. No immediate campaign is triggered.
- Removed only the Email preferences footer link from HTML/plain text; the secure Unsubscribe link remains. A separately approved revised test copy did not alter the accepted digest or its baseline.
- Atom #3 retains one accepted period and its 5-connected-Atom / 2-direct-Bond baseline. Existing preferences and database migrations are unchanged.
- First routine scheduled run remains pending operational observation.

## 0.9.1-rc.1 — Task #9.1 controlled acceptance candidate

- Candidate deployment only: controlled real-email acceptance and recurring scheduling remain pending. Sending stays disabled. Atom #3 has one prepared reservation for +1 connected Atom and +1 direct Bond; its baseline has not advanced and no send attempt has started.
- Stabilized the existing keyboard-focus browser test by waiting for client renderer initialization before tabbing; retained its focus assertion and changed no product interaction.

- Applied RPC migration `202610030002` after preview; hosted grants/privacy and unchanged preferences verified. The configured worker passed a non-sending hosted scheduler evaluation. Established Atom #3's initial baseline and confirmed no-growth suppression; no growth email, delivery reservation or recurring schedule created. Production application publication and controlled live acceptance remain pending.

- Approved pilot simplification: isolated sessionless server-only Supabase adapter and seven service-role-only RPC wrappers. The broader credential authority is explicitly accepted; the dedicated database role remains preserved and unconfigured. Credential setup and live acceptance remain gated; no recurring email enabled.

- Added the approved dedicated growth PostgreSQL login with seven explicit operations and no table grants, plus real-login denial/concurrency/restart tests.
- Added growth baselines, immutable weekly reservations, retry safeguards, protected bounded dry-run worker, responsive digest content and purpose-limited unsubscribe. Production sending/scheduling remains disabled pending configuration and live acceptance.
- Added immediate weekly ON/OFF preferences and new-Atom disclosure; existing legacy preferences remain unchanged.

- Added a version-controlled private growth-preference provenance migration; preserves all legacy values without inferring consent.
- New first activations default to weekly only when unset; explicit OFF and unsubscribe survive returning access and unrelated profile saves.
- Added a restricted unsubscribe primitive and database/service regressions. Transactional email is independent; no growth schedule enabled yet.
- Applied reviewed migrations `202610010001` and `202610030001` on 2026-10-03. Hosted permission audit confirmed exactly seven worker functions, no direct table privileges or administrative flags, and unchanged values for all five existing preference records. Secure worker connection configuration and live acceptance remain pending.

## 0.9.0 - Task #9.0 / Installable PWA

- Custom-domain configuration follow-up: added the required Supabase callback query pattern and redeployed the existing 0.8.3 commit with updated APP_ORIGIN. No email was sent during that diagnostic; the user subsequently verified real custom-domain authentication, existing ownership and Bond flow and approved PWA publication.
- Uses `https://atomicbond.ideaordie.com` as the configured permanent production origin, with relative manifest/worker paths and no old deployment hostname in runtime source.
- Added origin-relative standalone manifest, scientific light app icons and Apple metadata.
- Added optional verified-owner install offer, 30-day dismissal suppression, native Chromium prompt and manual iOS guidance; preferences retains a quiet install entry.
- Added a conservative service worker caching only generic offline HTML/icons, with network-only application requests and explicit offline presentation.
- Preserved ownership, authentication, QR/Bond consent, Pulse behavior and public/private boundaries; no notifications, analytics, database or Master Spec changes.
- Physical iOS/Android acceptance is pending; automated platform simulations are not physical installation evidence.

## 0.8.3 - targeted UI cleanup follow-up

- Removed the redundant header MY ATOM link and made the profile return action clearly visible.
- Renamed Growth digest to Growth Notification Frequency and removed the Pulse notifications preference control while preserving stored preferences.
- Renamed YOUR NETWORK NOW to YOUR NETWORK OVERVIEW.
- Removed the Explore Atoms button and exploration drawer. Canvas inspection and navigation remain intact; motion controls move to the utility dock and a focus-only native selector preserves keyboard access to represented Atoms.
- No Master Specification, authentication, Bond, Pulse lifecycle or database changes.

## 0.8.3 - Global coarse Home Region

- Replaced the five-place production signup selector with bundled searchable country/subdivision choices based on ISO 3166 identifiers.
- No Geoapify, external geocoder, location key, city, address or GPS dependency. Country-only selection is available where subdivisions do not apply.
- Added an additive canonical-location migration, preserving existing real Atom locations and private/public boundaries.
- Regional grouping and public network reach use regions/countries; new registrations never fabricate city information.
- Added catalog, migration, registration and responsive accessibility coverage. Migration and publication approved. Hosted migration 202609280001 applied and verified; existing Atom locations and privacy boundaries preserved.

## 0.8.2 — Task #8.2 / UI clarity and fit-and-finish

- Began the feature freeze from approved v0.8.1; no product mechanics, authentication services, database migrations or Master Specification changes.
- Clarified QR handoff/consent/expiry, recipient choices, required and optional registration fields, canonical location selection and email continuation; retained non-disclosing email responses.
- Added specific pending button labels, immediate Pulse-sent feedback, empty-network guidance and human-readable route failure/recovery surfaces.
- Refined shared form spacing, mobile input sizing, panel typography, identity hierarchy, long-content wrapping, responsive QR layout and safe-area padding within the scientific/light theme.
- Added breakpoint/orientation/short-viewport and long-content browser checks, field-error association and a manual physical-device checklist in `architecture/UI_UX_v0.8.2.md`.

## 0.8.1 — Task #8.1 / Living Emotional Network

- Made authorized connected Emotional Pulses visible by default in MY ATOM; removed the separate FEEL YOUR NETWORK control.
- Added compact YOUR NETWORK NOW with eight-state distribution, honest coverage/geography, update age and persistent expanded scrolling.
- Preserved dimensional spheres, graph-aware temporary propagation and all eight colors; inactive owner Atoms use neutral blue-gray with reduced-motion-aware material transitions.
- Separated bounded Pulse/topology reconciliation, exact local expiry, resume recovery and unavailable/offline handling without changing RLS or public serialization.
- Applied only the approved Master Spec interaction revision; v0.8.0 remains the immutable first functional MVP baseline.

## 0.8.0 — First functional Atomic Bond MVP baseline

- Frozen on 2026-09-27 at the project owner's explicit request, following their report that the application was working and the results-panel scrolling correction.
- Release scope and verification evidence are preserved in `docs/architecture/BASELINE_v0.8.0.md`. No application behavior, schema or product specification changed in the freeze.

- Fixed NETWORK EMOTION RESULTS refreshing on every owner clock tick: measure immediately on opening, then once per minute, retaining the report DOM and scroll position during background updates. Pulse lifecycle and network polling remain unchanged.

- Added server-generated standards-compliant QR invitations using the configured application origin, active invitation reuse, countdown, copy and cancellation controls.
- Preserved initiator CREATE BOND consent and required separate recipient CONFIRM BOND; added decline, self-invitation and already-Bonded states.
- New and returning recipients automatically return to their invitation after verified Auth access. No identity, RLS, sequence or database constraints changed.
- Added BOND CREATED feedback and the existing arrival animation using persistent graph data, with visible-owner polling every ten seconds and refresh on focus.
- Added independent QR decoding and isolated-session browser coverage for consent, reciprocal small networks, Pulse and invitation lifecycle protections.
- Owner acceptance establishes this MVP baseline. Detailed physical-device results, participant public numbers and production counts have not been recorded in the repository; do not represent them as independently verified.

## 0.7.3 - Task #7.2 / Scientific Light Visual System

- Visual review refinement: distinguish structural connection layers with muted brass, blue, lavender, sage and distant stone materials, retaining the silver-blue center. Emotional Pulse colors still override structural tones.

- Replaced dark space surfaces with a pale scientific palette, navy text, soft white panels and restrained blue controls while preserving the responsive action layout.
- Added centralized neutral Canvas materials, dimensional silver/blue-gray spheres, soft shadows and clean blue Bonds; preserved spatial depth, orbital motion and graph-aware propagation.
- Preserved all eight Emotional Pulse colors. Results and current-state labels now use dark text with colored markers for light-surface readability.
- Added browser checks for action contrast, light surfaces, dimensional rendering, focus and entry/auth overflow at all three reference sizes. Existing behavioral and security regressions remain intact.
- Documented the visual system in `docs/architecture/VISUAL_SYSTEM_v0.1.md`. No hosted changes or Master Specification edits.
- Added bounded temporary-directory cleanup retries for Windows PostgreSQL test handles; concurrency assertions remain unchanged.

## 0.7.2 - Passwordless access email correction

- Accept Supabase's supported PKCE-prefixed token hashes in signed email-hook link construction and callback validation, preserving the full hash for Supabase verification.
- Added prefixed/unprefixed signed-hook and malformed-hash tests. Local Auth browser fixtures now model PKCE hashes when the SSR client supplies a code challenge.
- No credentials, RLS, expiry, single-use rules or signature checks were changed.

## 0.7.1 - Task #7.1 / Production Entry & Owner Resolution

- Replaced anonymous production entry with CREATE MY ATOM and ACCESS MY ATOM; authenticated root entry resolves the verified session's owned Atom.
- Removed the production first-Atom graph fallback. Anonymous `/explore` returns to entry; explicit `/a/<number>` and legacy `/explore?atom=<number>` remain clearly labeled public views without owner actions.
- Preserved invitation context with separate registration and returning-access entry actions, and return to confirmation after verification.
- Sign-out returns to anonymous entry. Added separate-browser session isolation, empty-owner network, explicit public-view and fallback-prevention regression coverage. Mock mode and server/database authorization remain intact.

## 0.7.0 - Task #7 / Verified Email Identity

- Added Supabase passwordless registration/access, cookie-session refresh, verified activation, owner lookup and explicit invitation continuation across devices.
- Added signed Auth email-hook delivery through ResendNotificationService with the approved From identity, safe callback allowlists and token hashes kept out of request URLs.
- Connected owner Bond/Pulse/profile/preference controls while retaining mock services and established Living Atom behavior.
- Added an owner-access migration and a limited curated real-place catalog; preserved all Task #6 constraints and frozen Master Specification.
- Added auth/security/database and cross-device browser regression coverage. No recurring jobs, DNS changes, automatic deletion or Task #8 work.
- Completed production email delivery and user-confirmed callback acceptance. Atom #3 is ACTIVE with verified Auth-linked private identity and canonical home region; retired numbers #1 and #2 remain preserved.
- Verified hosted returning-identity reuse, owner RPC resolution, authorized profile access, denied anonymous/cross-Atom writes, and safe public projection in rolled-back checks. Production contains one ACTIVE Atom and zero confirmed Bonds. Fresh returning-email/device flows remain covered by local automated tests rather than a second live email attempt.

## 0.6.0 - Task #6 / Supabase Persistence & Identity

- Added reproducible schema, default-deny RLS and controlled identity, graph, Bond, invitation, Pulse and preference operations.
- Enforced unique normalized identity, activation-only permanent bigint Atom numbers, reusable single active invitation, and unique unordered Bonds.
- Added explicit mock/Supabase configuration, safe public projections and asynchronous adapters; production owner access remains restrictive pending Task #7.
- Preserved deterministic mocks and current frontend behavior; added real SQL security and native concurrent-connection/restart tests.
- Documented migration/deployment workflow, lifecycle, privacy, token encryption/hash boundaries and Task #7 handoff. No hosted schema changes or email delivery.

## Network results activation fix

- Open NETWORK EMOTION RESULTS only when turning Feel Your Network on. Turning it off no longer reopens a dismissed panel; an already open panel remains independently closable.
- Added regression coverage for dismissal, deactivation and reactivation.

## Feel Your Network manual toggle

- Removed the Feel Your Network timeout; the view stays active until its button is clicked again.
- Preserved the 15-second Pulse animation, 24-hour emotional state, and independently closable results panel.
- Updated browser regression coverage for sustained activation, manual stop and reactivation.

## Network emotion results refinement

- FEEL YOUR NETWORK automatically opens NETWORK EMOTION RESULTS with a measuring indicator and automatically refreshed distribution and regional coverage.
- Results remain open after the 15-second view until explicitly closed, with responsive scrolling and keyboard focus restoration.
- Browser coverage checks measurement, refresh, expiration, close and reopening at all three reference sizes.

## Pulse action timing refinement

- Pulse animation and Feel Your Network each stop automatically after 15 seconds.
  Graph-distance traversal fits within that window; full reach remains accurate.
- Each activation has an independent timer. Manual stops cancel pending timers.
  The selected emotion retains its existing 24-hour lifetime.
- Verified formatting, lint, TypeScript, 116 unit tests, production build and
  63 browser tests, including exact deadlines and view reactivation at all
  three reference viewport sizes.

## 0.5.4 — Task #5.4 / Curious Emotional Pulse

- Added Curious as the eighth explicitly selected emotion, with a centralized
  green identity distinct from Calm and Joy. Updated the approved vocabulary
  and color entries only in Master Specification v0.2.
- Existing vocabulary-driven fixtures, selector, propagation, context and regional
  distributions now include Curious. Lifecycle and privacy boundaries are unchanged.
- Added Curious fixture, distribution, regional, replacement, context and expiry
  checks; expanded all-state visual/propagation coverage to eight states.
- Passed the complete regression suite: formatting, lint, TypeScript, 116 unit
  tests, production build and 60 browser tests. Reviewed Curious captures at
  390 × 844, 768 × 1024 and 1440 × 900. No Task #6 work was started.

## 0.5.3 — Task #5.3 / Primary Action UI Refinement

- Renamed the active interface to FEEL YOUR NETWORK, preserving internal APIs.
- Grouped Create Bond, Pulse and Feel Your Network in a responsive primary dock;
  grouped Explore Atoms and My Atom as secondary actions, with quieter view utilities.
- Preserved graph rendering, Pulse lifecycle, participation and selection behavior.
  Share remains deferred; no new sharing behavior or Task #6 work was introduced.
- Added responsive control geometry, keyboard and toggle regression coverage;
  restored focus to the invoking control after the Pulse selector closes.
- Verified formatting, lint, TypeScript, 114 unit tests, production build and all
  57 browser tests. Reviewed normal/Feel controls at 390 × 844, 768 × 1024 and
  1440 × 900; checked alignment, reachability, focus and horizontal overflow.

## 0.5.2 — Task #5.2 / Emotional Pulse & Feel the Network

- Added explicit selection of seven approved emotions, latest-state replacement
  and exact 24-hour expiry using a controllable local service clock.
- Added emotional graph propagation across the full connected component, accurate
  reach feedback, persistent sender color and unchanged recipient states.
- Added Feel the Network with mixed particle clouds, neutral inactive Atoms,
  active-only percentages, connected coverage and contextual regional counts.
- Added active Pulse context while preserving public identity, X links and
  explicit View their network behavior. Pulse visibility stays separate from
  unrestricted public Atom serialization.
- Added deterministic Pulse fixtures, lifecycle/privacy/graph and browser tests,
  responsive captures and architecture documentation. Existing regression
  assertions remain, adapted to explicit selection and full traversal.
- Verified formatting, lint, TypeScript, 114 unit/graph/service tests, production
  build and all 54 browser regressions. Rebuilt and reran the nine Emotional Pulse
  browser checks after the final mobile legend stacking fix. Captured all seven
  emotions and reviewed representative views at all three required viewport sizes.
- No backend, notifications, Return Pulse, production persistence, frozen
  specification changes or Task #6 work.

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
