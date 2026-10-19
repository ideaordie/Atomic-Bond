# Changelog

## v0.20.0 — GLOBAL DOODLE color compatibility (Stage 1)

- Publish version-aware editor, feed, Hall of Fame and moderation readers while keeping color submissions disabled. Preserve existing monochrome appearance and all Doodle lifecycle rules.
- Promote the reviewed `202610220001_doodle_indexed_color.sql` migration: immutable format identification, bounded indexed-color/replay validation and version-aware fingerprints; deploy compatible readers before applying it.
- Keep `GLOBAL_DOODLE_COLOR_ENABLED` absent/false and the new database `color_submissions` gate false. No public color test drawings or Stage 2 activation are authorized by this release.
- Preserve frozen Master Spec v0.9; v0.10 remains a proposal. Preflight and recovery details: `docs/reviews/TASK_20_2_DOODLE_COLOR_PREFLIGHT.md`.

## v0.19.1 — EVOLVE UI cleanup

- Remove EVOLVE’s redundant theme toggle and SHARE AN IDEA link; retain the global Settings theme and existing submission form.
- Place EVOLVE immediately after MY ATOM in primary navigation, preserving routes and horizontal scrolling.

## v0.19.0 — EVOLVE

- Add moderated community ideas, equal support/withdrawal, private author acknowledgments and independent development history through existing verified ACTIVE-owner authorization.
- Integrate EVOLVE navigation and secured Admin Hub review, preserving the approved Light/Dark interface and all unrelated application behavior.
- Apply `202610210001_evolve.sql`: private RLS tables, transactional cooldown/support/lifecycle enforcement, bounded five-minute cleanup and administrator-only health monitoring. No new credential.
- Freeze the approved EVOLVE-only Master Spec v0.9 amendment; preserve all earlier frozen specifications. Update only authority version references in AGENTS.md and the Build Blueprint.
- Local unit/security, concurrency, persistence and EVOLVE browser checks passed. Three existing Pulse timeouts during concurrent suites passed unchanged on isolated reruns; no checks were weakened. Hosted acceptance and release evidence: `docs/proposals/EVOLVE_PRODUCTION_READINESS_v0.1.md`.

## v0.16.4.6 — 16× Map Zoom

- Increase the map-only maximum zoom from 8× to 16×; preserve the 1× minimum/default and existing orbital zoom limits.
- Update targeted button, keyboard, wheel and pinch coverage. Six responsive Light/Dark browser tests and 16 camera/geography unit tests passed, along with lint, formatting and production build. No geographic, privacy, database or frozen specification changes.

## v0.16.4.5 — SHOW MAP Zoom Range

- Adjust map-only zoom bounds from 0.65–4 to 1–8, keeping the fitted default/recenter view and orbital camera limits unchanged.
- Apply consistent limits to buttons, wheel, pinch and keyboard zoom without changing geographic data, map styling, pan or cluster selection.
- Verify 16 camera/geography unit tests and 15 targeted browser tests across mobile, tablet and desktop in Light/Dark, plus TypeScript, lint, formatting, build and secret checks. Physical-device pinch verification remains pending. Frozen Master Spec v0.8 and production data are unchanged.

## v0.16.4.4 — Bond Confirmation Presentation Repair

- Confirm registration-originated Bonds through the existing authorized service via a POST route, clearing the receipt immediately without premature page revalidation.
- Preserve the 2.8-second YOUR NETWORK HAS BEGUN presentation, then navigate to MY ATOM and show the optional installation invitation.
- Preserve explicit consent, verified-owner authorization, single-use confirmation and replay protection. No database, secret, email-template or frozen Master Spec changes.
- Add deterministic timing, duplicate-request, replay, interrupted-response and dismissal coverage across mobile, tablet and desktop. See [Task #17.3.2 evidence](operations/TASK_17_3_2_BOND_SUCCESS.md). Physical iPhone acceptance remains pending.

## v0.16.4.3 — Verification Email UI Cleanup

- Present ordinary verification/access and invitation-registration emails with mobile-friendly HTML buttons and an explicit plain-text alternative.
- Preserve exact verification destinations, encrypted receipts, callback behavior, subjects, recipients and delivery authorization. No authentication, database, secret or frozen Master Spec v0.8 changes.
- Verify URL escaping, signed-hook destination equivalence, responsive rendering and authentication regressions. Real inbox/client rendering remains a follow-up; see [Task #17.3 acceptance](operations/TASK_17_3_EMAIL_PRESENTATION.md).

## v0.16.4.2 — Deferred Home Region Loading

- Load the canonical country/region catalog only when the participant opens the Country selector; retain shared caching, canonical validation and recoverable loading feedback.
- Reduce measured initial authentication-route JavaScript by 96,412 gzip bytes (39.3%) while preserving registration, existing-owner authentication and invitation continuity.
- Add slow-load, retry, unmount and cache regression coverage at mobile, tablet and desktop sizes. Master Spec v0.8, database, CI and production configuration remain unchanged.
- See [Task #17.2 evidence](operations/TASK_17_2_GEOGRAPHY_LOADING.md), including first-use latency and physical-device limitations.

## v0.16.4.1 — Single-click verification navigation

- Keep invitation-registration verification pending through navigation and guard duplicate presses; read the current email fragment at the deliberate click.
- Remove the unnecessary intermediate history transition. Preserve all server authentication, encrypted receipts, explicit Bond consent, database state and frozen Master Spec v0.8.
- Add delayed-navigation and replacement-email regression coverage. Physical iPhone confirmation of the one-click correction remains pending; see [acceptance evidence](operations/TASK_16_4_1_LOCAL_ACCEPTANCE.md).

## v0.16.4 — New-Atom Bond Invitation Continuity

- Restore invitation context only for invitation-originated new-Atom registration, using a dedicated verification callback and an encrypted receipt bound to the verified registration attempt and owner session.
- Complete authentication and activation independently of optional invitation context; reuse explicit ACCEPT BOND / NOT NOW confirmation and preserve original 24-hour deadlines.
- Preserve existing-owner authentication, ordinary registration, account lifecycle, migrations and frozen Master Spec v0.8. Reuse the existing managed server-only key.
- Controlled publication for real email and physical-device acceptance; simulated browser tests do not establish iPhone/PWA compatibility. See [acceptance and recovery](operations/TASK_16_4_LOCAL_ACCEPTANCE.md).

## Emergency recovery — restore v0.16.2

- Restore application, email hook, fixtures and tests exactly to release `2a5651b` through a history-preserving revert of v0.16.3 and v0.16.3.1.
- Preserve all hosted data, migrations, RLS, production secrets and frozen Master Spec v0.8.
- Existing encrypted authentication emails require a fresh login email. Sign in first, then reopen the original valid Bond invitation; pending invitation context may still be lost during authentication.
- See [recovery procedure and evidence](operations/ROLLBACK_TO_v0.16.2.md).

## v0.16.3.1 — Authentication Flow Repair

- Keep provider authentication independent of optional invitation context; retain
  recipient/OTP binding and explicit Bond consent.
- Recover verified account access after callback reload/error; make callback NOT NOW
  skip only the invitation rather than discard authentication.
- Reset stale callback state when another authentication link opens. See [incident evidence and limitations](operations/AUTH_RECOVERY_v0.16.3.1.md); the reported physical-device failure is not yet confirmed resolved.

## v0.16.3 — Bond Invitation Authentication Continuity

- Bind invitation email continuation to the verified recipient and Auth attempt;
  preserve it across fresh-browser email entry and callback reload.
- Reuse explicit ACCEPT BOND / NOT NOW confirmation; no automatic Bond creation.
- Add a dedicated managed server-only continuation key and fail-closed Production
  build/cold-start configuration check; no database or frozen-specification change.
- See [continuation architecture](architecture/INVITATION_AUTH_CONTINUATION_v0.1.md)
  for recovery, legacy-link compatibility and physical-device limitations.

## v0.16.2 — Universal 24-hour Bond invitations

- Universal 24-hour validity for newly created QR and remote Bond invitations; retain existing deadlines and invitation reuse without extension.
- Hours/minutes/seconds sender countdown, actual recipient/share deadline, and truthful legacy invitation labeling.
- Apply the version-controlled future-issuance migration and freeze the approved Section 31 amendment as Master Spec v0.8; preserve v0.7 and all existing invitation deadlines.

## v0.16.1 — First Bond invitation paths

- Separate in-person QR and remote sharing paths; opening CREATE BOND alone no longer prepares an invitation.
- Native sharing, copy/manual-copy recovery and precise delivery/expiry messaging reuse the existing owner-authorized five-minute invitation and recipient confirmation.
- Preserve first-Bond animation, authentication, database rules and analytics exclusions. Measurement and longer remote-lifetime recommendations remain proposals only.

## v0.16.0 — Connect. Create. Play. Together.

- Publish the approved 30-second synthetic campaign on `/welcome`, preserving playback controls, reduced-motion stills, no-JavaScript fallback and secure registration links.
- Introduce an isolated creative review and deterministic 900-frame silent 1080p MP4 export for X advertising.
- Reuse the Living Atom renderer and synthetic geography; all Doodle and puzzle artwork is original illustration. No production participant content, schema, gameplay, authentication, scheduling or frozen-specification changes.

## v0.15.0 — Automatic puzzle queue

- Queue lifecycle with one-hour completion celebration, serialized automatic advancement, preserved rolling gameplay allowances and lifecycle-aware private media cleanup.
- Simplified administrator upload/preview/queue workflow, ordering, pause/resume and confirmed reasoned retirement; local synthetic Studio/player preview.
- Approved Section 48B incorporated into Master Spec v0.7, preserving frozen v0.6. Guarded transition preserves completed puzzle history, private media and participant allowances; no unused artwork is automatically queued.

## v0.14.2 — Returning-owner installation invitation

- Reuse the optional installation invitation after successful returning-owner email-link confirmation, respecting standalone detection and existing 30-day browser dismissal.
- Use NOT NOW and shorter supporting copy; isolate installation button styling from Auth primary-button colors and retain shared Light/Dark hover, pressed and focus tokens.
- Preserve authentication, lifecycle, session, service-worker and persistent INSTALL APP behavior. Product-reviewed and approved for publication; no database, service-worker or authentication-policy changes.

## v0.14.1 — Editable Home Region & ACTIVE-only network

- Production acceptance passed; designated the approved production baseline at release commit `e66fc02`. Verified Home Region persistence, map positioning and regional metrics on Atom #4; the product owner also confirmed a successful location change on another Atom.
- Separate canonical Home Region editor for verified ACTIVE owners; legacy profile saves cannot overwrite location.
- ACTIVE-only graph, Pulse reach, Doodle MY NETWORK, Connected Groups and growth metrics; historical Bond records and permanent numbers remain intact.
- Bounded 5,000-node traversal, inactive-selection refresh recovery, and a guarded growth-baseline transition.
- Freeze approved Master Spec v0.6 amendments; preserve v0.5 unchanged. Hosted migration applied after recovery and delivery-lease checks; production record fingerprints, sequences and schedules preserved.

## v0.13.5 — Persistent PWA installation invitation

- Add INSTALL APP to shared navigation, with native installation when available and
  accessible platform-specific instructions otherwise.
- Offer TAKE YOUR ATOM WITH YOU after successful new registration; dismissal keeps
  the persistent entry available. Remove delayed contextual promotion.
- Preserve manifest, service-worker cache policy, passwordless access and account behavior.
- Product-reviewed publication. Local browser/security checks passed; physical-device installation and session handoff remain manual acceptance items.

## v0.13.4 — Persistent MOVE instruction

- Replace the six-second notice with authoritative MOVE eligibility guidance in the existing countdown area. Preserve it through refresh/reload, and restore the countdown when MOVE is used or no movable pieces remain.

## v0.13.3 — Post-placement MOVE guidance

- Show a dismissible six-second inline hint after successful PLACE only when a fresh server snapshot permits MOVE and contains an unlocked piece. Gameplay rules remain unchanged.

## v0.13.2 — PARTICIPUZZLE simplified player

- Rename the game heading, navigation label and browser title to PARTICIPUZZLE; preserve existing routes.
- Automatically resume/reserve an eligible piece; replace reveal/mode controls with direct board selection, preview and one PLACE HERE or MOVE HERE confirmation.
- Preserve reservations when cancelling a selection; refresh visible boards every 60 seconds with backoff, conflict detection and same-request recovery.
- Preserve all authoritative gameplay/media rules and frozen specifications; no database or production configuration changes.

## v0.13.1 — Global Doodle legacy expiration correction

- Audit hosted publication, both feed scopes, appreciation, Hall finalization and actual Cron cleanup: new drawings already receive 168 hours. Identify one intact legacy 24-hour drawing preserved by Task #12.4.
- With explicit approval, extend only that eligible unfinalized drawing to its original publication time plus 168 hours; preserve all artwork, publication data and appreciations. Do not recover deleted content or reopen finalized scores.
- Use the exact LIVE FOR 7 DAYS publication label and strengthen 72-hour/both-scope and guarded historical-correction tests.
- Preserve moderation, lifecycle, Hall rules, submission limits, pagination, all schedules, PARTICI-PUZZLE and frozen Master Spec v0.5.

## v0.13.0 — PARTICI-PUZZLE public launch

- Immediate-launch approval supersedes the original October 27 window: existing Connected Landscape puzzle starts October 13, 2026, 17:16:50.300673 UTC and ends October 20 at the same time. Retire only the two audited disposable test windows; retain all IDs, pieces, artwork and cooldowns. No application release/version change is required for the schedule-only operation.

- Activate the authenticated ACTIVE-owner player and navigation, with controlled access OFF.
- Anchor participant gameplay/media to the approved first official puzzle. Earlier disposable windows remain intact but inaccessible; before launch, return only database timing for the October 27 countdown.
- Preserve Connected Landscape's October 27, 2026, 04:00 UTC through November 3, 04:00 UTC window. Gameplay opens automatically using database time; no artwork or gameplay is exposed early.
- Preserve existing gameplay, private PostgreSQL media, lifecycle authorization, throttling, cooldowns, cleanup and frozen Master Spec v0.5.
- Verification: 434 unit/integration tests, 30 responsive browser tests, native PostgreSQL concurrency/restart tests, production build, formatting, lint, TypeScript and secret/client-boundary checks passed. Hosted rollback-only checks proved the waiting response and early/historical gameplay/media denial for both approved test owners.

## v0.13.0-rc.6 — First official puzzle preparation (gameplay disabled)

- Add the standalone, activation-gated `/partici-puzzle` player and navigation entry using existing owner-session gameplay/media operations; no database or gameplay changes.
- Include shared progress, weekly time, independent PLACE/MOVE allowances, reservation feedback, deliberate placement/move/swap controls and completed artwork.
- Prepare Connected Landscape privately through production Puzzle Studio: READY, 27 PostgreSQL assets, unscheduled. Add development-only artwork/player review with all 25 tiles and representative states; artwork remains outside Git and public assets.
- Artwork and player passed product review. Re-prepare the identical approved artwork through Studio with normal 24-hour retention (through October 14, 2026, 16:27:16 UTC); preserve the private local original for later preparation.
- Keep Master Spec v0.5 unchanged, both database participation gates OFF and the proposed October 27–November 3 window unscheduled. Scheduling and public activation require separate approval.

## v0.13.0-rc.5 — Puzzle Studio (gameplay disabled)

- Add protected `/admin/puzzles` through Admin Hub, reusing verified preparation, scheduling and cleanup services. Include private 25-piece preview, READY status, paginated windows, progress and cleanup health.
- Freeze approved Master Spec v0.5 with exact Section 48B; preserve all v0.4 sections and the historical frozen file.
- Retire obsolete Storage upload authority and physically remove the 55 disposable legacy artwork objects through Storage, preserving manifest/hash evidence and PostgreSQL replacements. Only provider-created empty-folder placeholders remain. Historical CDN invalidation is not claimed.
- Prepare original Connected Landscape artwork for private product review. Do not schedule official artwork or enable participation; both database gates remain OFF.

## v0.13.0-rc.4 — Bounded puzzle cleanup (gameplay disabled)

- Reuse hosted pg_cron for bounded five-minute reservation, receipt and retained-media cleanup, with private health counts and SQLSTATE-only failure monitoring. Active/future media and rolling allowances remain protected.
- Store new normalized source artwork privately in PostgreSQL alongside tiles; participants still cannot retrieve source records. No new credential or external scheduler.
- Add bounded administrator-session Storage deletion/acknowledgment for eligible legacy manifests, with safe retries. Existing Storage-backed batches remain supported during rollout.
- Preserve frozen Master Spec v0.4, Global Doodle cleanup and Tuesday growth scheduling. Both puzzle database participation gates and public gameplay remain OFF; specification and launch approval remain pending.

## v0.13.0-rc.3 — PostgreSQL puzzle media (controlled acceptance)

Replaces runtime tile Storage downloads with atomic owner-authorized PostgreSQL byte delivery. Public gameplay remains disabled. Adds immutable private media preparation and a verified 52-asset migration. Hosted valid/cancelled/expired HTTP checks and foreign-owner RPC checks pass. Retires participant Storage reads and temporary copy/probe actions; sampled legacy URLs deny. Both database gates are closed. Worldwide historical cache containment, final operational acceptance and public launch approval remain separate gates. Frozen Master Spec v0.4 is unchanged.

## v0.13.0-rc.2 — PARTICI-PUZZLE disabled security checkpoint

- Verify foreign-reservation denial and legitimate own/placed tile access through actual owner-session Storage downloads.
- Isolate the controlled Storage probe from gameplay cleanup, retaining verified sessions, independent Storage RLS, same-origin checks and the existing fail-closed Vercel rate limiter.
- Block launch: an expired reservation's tile remained downloadable through Storage HTTP despite the hosted SQL predicate denying it. The expired row was retained before and after the check. Cancellation HTTP acceptance remains incomplete.
- Close both public and controlled database access gates without changing participants, board pieces, cooldowns or private buckets. Add the repeatable operator shutdown script.
- Preserve frozen Master Spec v0.4 and all unrelated production features/schedules. This is a disabled candidate, not a completed public release.

## v0.13.0-rc.1 — PARTICI-PUZZLE controlled infrastructure candidate

- Correct hosted tile downloads by authorizing Supabase's prerequisite authenticated object-info operation under the existing per-tile RLS predicate. Remove the unsuccessful URL rewrite; retain the normal owner-session SDK path and disabled public gate.
- Apply the approved additive hosted migration with private gameplay tables, existing-session Storage RLS, private pre-generated tiles, and default-OFF public/controlled database gates. No new privileged credential.
- Add expiring operator-provisioned test membership and a separate controlled acceptance page; general beta participation remains disabled. Preserve the existing prototype and all gameplay rules.
- Add puzzle-specific ingress protection and retain database throttling. Limit encoded preparation uploads to 3 MB for hosted request limits.
- Frozen Master Spec v0.4 remains unchanged. Hosted media/gameplay acceptance and general launch are separate gates; this candidate is not a completed public puzzle release.

### Earlier local checkpoint

- Integrate the approved existing-session private-tile architecture locally: Sharp administrator preparation, immutable 27-object batches, independent Storage RLS, default-disabled Next.js gameplay/media route and bounded administrator cleanup. Authorized direct reads are intentional; no custom media credential or runtime cropping is used. Hosted Storage acceptance remains pending and frozen v0.4 is unchanged.

- Add a development-only 5 × 5 collaborative puzzle review with synthetic participants, expiring reservations, independent hourly placement/move allowances, swaps, permanent correct-piece locks, and weekly-cycle simulation.
- Add keyboard/touch and Light/Dark review, deterministic state tests, and a proposed production image-security/storage architecture. No hosted changes, production navigation, release bump or frozen specification changes.
- Add local-only PostgreSQL gameplay and restricted media-role SQL candidates, cross-week cooldowns, reveal throttling, lifecycle cleanup, bounded retention/worker contracts, isolated security/concurrency/restart tests and tile benchmarks. Image-token issuance and production cleanup wiring remain approval gates; no credential or hosted change was introduced.

## v0.12.4 — Seven-Day Global Doodle

- Use seven-day (168-hour) lifetime for newly published Doodles; preserve existing deadlines, hourly cooldown, multiple live drawings and all Hall rules.
- Add “Draw something. Make someone's day.” below the Global Doodle feed heading and update editor lifetime guidance.
- Add isolated expiration, voting, cleanup, migration-preservation and responsive checks. Approved the function-only migration and surgical Section 48A amendment for publication.

## v0.12.3 — Standalone Global Doodle & navigation

- Separate Global Doodle from the Living Atom into `/global-doodle`; retain `/doodle` as the editor.
- Centralize scrollable MY ATOM / GLOBAL DOODLE / ABOUT / SETTINGS navigation.
- Add WORLD / owner-authorized MY NETWORK live scopes with reset pagination; Hall of Fame remains global.
- Apply the approved private network-feed function migration and surgical Section 48A amendment; frozen v0.3 remains unchanged.
- Keep LIVE / HALL OF FAME / WORLD / MY NETWORK on one row at mobile, tablet and desktop sizes.

## v0.12.2 — Global Doodle 24-hour feed

- Prepared 24-hour future Doodle publication with multiple live drawings and the unchanged hourly per-Atom cooldown; existing deadlines remain intact.
- Added the authenticated Living Atom static feed with bounded cursor loading, visible-only refresh, appreciation/reporting and a separate Hall view.
- Simplified the editor to SEND with safe retries, server-based cooldown and return navigation; complete administrator replay remains available.
- Approved the surgical Section 48A amendment and version-controlled function migration for publication; existing drawings retain their deadlines.

## v0.12.1-rc.1 — Global Doodle controlled rollout candidate

- Approved Master Spec v0.4 with only the reviewed Global Doodle sections and version metadata; frozen v0.3 remains unchanged.
- Added approved expiring, operator-managed controlled membership for staged acceptance, enforced by the database without granting administrator access or bypassing emergency pause. Public database access defaults closed.
- Configured Doodle-only Vercel SDK and endpoint rate limits at 120/IP/minute; verified allowed requests followed by 429 responses. Existing public routes remain healthy.

- Added a separate development-only database-backed review for immediate publication, reactive moderation, appreciation, expiry and a maximum-ten Hall of Fame. The approved editor remains unchanged.
- Prepared the unapplied version-controlled Supabase migration, with session-derived ownership, private tables, cooldowns, immutable payloads/scores, atomic Hall replacement, bounded cleanup, reports and administrator controls.
- Added the approved removal of artwork on deactivation/deletion, isolated database/concurrency tests, responsive review coverage and an exact proposed Master Spec v0.4 delta. Frozen v0.3 remains unchanged.
- Replaced the fixed moderation queue with stable 25-record cursor pages. Added a single session-authorized, rate-accounted Doodle RPC boundary and failed-attempt accounting without any global daily admission quota.
- Revised ordinary submission to publish immediately after validation. Added active/reported review filters, private paginated moderation decisions, posting restrictions and global submission pause/resume. Hall promotion remains explicitly administrator-approved with a minimum of five appreciations.
- Read-only hosted audit confirmed pg_cron is available but not installed. Added a review-only five-minute cleanup schedule proposal; no hosted job or extension was installed.
- Added default-off production owner-session routes and official Vercel Firewall ingress protection alongside database throttling. Intake starts paused; seven-day candidate review and retention cleanup are documented with rollout/recovery procedures.
- Applied the approved additive migration with database public access initially closed and intake paused; all existing-data comparison hashes matched. Installed and verified the isolated five-minute cleanup job.
- October 12: the owner explicitly approved immediate public activation before completing controlled live acceptance. Opened access for verified ACTIVE owners and resumed submissions without changing limits or administrator authorization. Remaining live acceptance is documented; v0.12.1-rc.1 is not declared fully accepted.

## Unreleased — Task #12.0 Global Doodle local prototype

- Added a development-only `/review/doodle` drawing and simulated one-hour feed review, isolated from production services and navigation.
- Includes a 64 × 64 packed dot bitmap, interpolated pointer strokes, draw/erase, stroke undo, confirmed clear, preview, bounded deterministic replay and local-only send.
- Uses existing monochrome Light/Dark tokens, keyboard controls and reduced-motion behavior. Production publication, moderation and storage remain proposals only; no schema, credentials, production feature or Master Spec changes.

## v0.11.5 — Geographic Network Map

- Corrected geographic placement: one counted marker per canonical anchor, summarized inter-anchor Bonds and expandable member inspection; removed map separation rings without changing fixtures or topology.
- Added owner-authorized SHOW MAP/HIDE MAP within the existing Canvas renderer, with independent cameras and coarse representative geography from bundled Natural Earth data.
- Renamed the top-right account navigation link to Settings without changing its destination.
- Moved continuous orbital-motion control to Profile & Preferences; browser-local ON/OFF respects device reduced motion.
- Preserved structural graph/Pulse state, hidden lifecycle geography, Network Signal and existing production infrastructure. No schema or hosted changes.
- Dataset coverage, explicit fallbacks and the proposed (unapplied) Master Spec clarification are documented in `architecture/GEOGRAPHIC_MAP_v0.1.md`. Publication approved after local product review. Master Spec remains unchanged.

## v0.11.4 — Design System & Dark Mode

- Consolidated shared monochrome appearance, typography, radius and control tokens across public, owner and admin screens.
- Added opt-in Light/Dark appearance in Profile & Preferences, saved per browser without a migration or account-data change.
- Theme-aware neutral Canvas materials preserve camera, graph and Pulse continuity; all 24 Pulse colors and the welcome animation remain unchanged.
- Applied the same appearance to the offline screen using only fixed public assets. Existing PWA caching boundaries, Master Spec and production configuration remain unchanged.
- Product review passed; publication approved. No changes to authentication, database business rules, notification scheduling or analytics privacy filtering.

## v0.11.3 — Animated Welcome

- Published the approved five-scene, 25-second synthetic introduction at public `/welcome`, sharing the deterministic Canvas renderer with the development-only review and advertising export.
- Added silent one-time autoplay, pause/replay, reduced-motion still scenes, a static fallback and readable transcript. CREATE YOUR ATOM uses existing registration and returning-owner recognition.
- Added only `/welcome` to the existing privacy-filtered page-view allowlist; parameterized URLs, unsafe referrers, sensitive routes and custom events remain excluded.
- Exported a separate local 1080p H.264 advertising MP4 without adding the video to the application repository. Existing product behavior, PWA, production configuration, migrations and Master Spec v0.3 remain unchanged.

## v0.11.2 — Monochrome UI

- Replaced blue/chromatic interface materials with white surfaces, near-black text/actions, neutral outlines and gray overlays across shared public, owner and administrative UI.
- Neutralized structural graph materials and inactive Atoms while preserving all 24 Pulse colors, state previews, motion, timing, topology and existing layouts.
- Retained explicit destructive-action copy/confirmation and visible neutral keyboard focus. Added palette-preservation and browser neutral-control checks.
- Matched standalone/offline presentation colors and refreshed the public asset cache revision without changing caching policy. Local browser asset checks stub the deployment-only Vercel SDK; analytics implementation is unchanged.
- Product review passed; publication approved as the new production baseline. Master Spec v0.3, migrations, production configuration and product mechanics remain unchanged.

## v0.11.1 — Privacy-filtered Vercel Web Analytics

- Added the official Next.js Analytics component and dependency from Vercel's generated integration branch, with privacy filtering for static general-page totals only.
- Excluded capability/account/individual-Atom routes, parameterized URLs, custom events and unsafe referrers; added beta privacy disclosure. No changes to Admin Network Analytics, Connected Groups, Master Spec, database or product mechanics.
- Publication approved after local review and reconciliation with Vercel PR #1; the generated unfiltered component is superseded by the single privacy-filtered integration.

## v0.11.0 — Expanded Pulse: Feeling, Energy & Vibe

- Added Feeling / Energy / Vibe, 24 selectable states, vibrant colors and unsent Canvas preview.
- Preserved legacy Angry/Afraid meanings and JOY storage mapping, single state, six-second propagation and 24-hour expiry through staged additive migrations.
- Added approved Master Spec v0.3; frozen v0.2 remains unchanged. Publication approved after local review.
- Verified persistent Network Signal visibility alongside expanded Pulse at mobile, tablet and desktop sizes; existing authorization and publication behavior remain unchanged.

## v0.10.3 — First Bond Invitation State

- Added ACTIVE zero-Bond owner guidance, contextual CTA and clearer first-invitation QR/waiting copy.
- Added four non-interactive decorative potential-connection rings to the existing renderer, with calm motion, pause/reduced-motion support and a brief first-confirmation acknowledgement.
- Placeholders are never graph/data entities. Established/public experiences, Bond security, Pulse, statistics, Signal, database and Master Spec remain unchanged. Publication approved after local review.

## v0.10.2 — Admin Hub and Connected Groups

- Added a private admin navigation hub and read-only current connected-component report using existing verified ACTIVE administrator membership.
- Report separates structural groups, founding/organic components and isolated ACTIVE Atoms; history limitations are explicit and no formation/merge events are invented.
- Added Admin Home navigation to Signal administration. No public mechanics, Signal content, scheduler, credentials or Master Spec changes.

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
