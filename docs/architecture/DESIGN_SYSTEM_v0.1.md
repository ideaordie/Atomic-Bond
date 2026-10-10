# Design System v0.1 — Light / Dark Appearance

Status: v0.11.4 — product review passed and publication approved.

## Presentation boundary

`public/design-tokens.css` is the shared source for page/surface/text/control colors, outlines, shadows, focus, spacing, typography, radii and minimum control heights. Application CSS consumes these tokens; the standalone offline document loads the same file. No database, authentication, ownership, graph, lifecycle, notification or analytics rules change.

Light is the default, even when the operating system prefers dark. Dark is explicitly selected in Profile & Preferences → APPEARANCE. Both palettes are monochrome; semantic Pulse colors remain separate and unchanged.

## Component conventions

- Primary: accent fill and on-accent text; near-black/white in light, white/near-black in dark.
- Secondary: surface fill, readable text and control border. Informational panels remain quieter than primary actions.
- Tertiary: restrained text navigation with visible keyboard focus.
- Destructive: explicit permanent-action wording, outlined treatment and existing confirmation ceremony; never color alone.
- Disabled: shared opacity and native disabled semantics.
- Inputs: 44px minimum, 8px radius; controls 12px radius; panels/modals 20px radius. Pills are reserved for existing compact navigation. Existing larger primary/touch targets remain larger.
- Body/helper/heading tokens establish a common type hierarchy. Existing responsive display headings retain their intentional scale.
- Subtle panel dividers differ from stronger control edges. Shared focus indicators have at least 3:1 contrast; text pairs meet 4.5:1 in both themes.

QR codes deliberately retain a white scan surface. The approved welcome animation/poster/export retain their own original material choreography; surrounding welcome controls and page chrome follow appearance.

## Persistence and initialization

The existing account preference schema contains notification preferences only. Appearance uses the brief's browser-local option rather than introducing a database migration.

`atomic-bond-appearance` stores only `light` or `dark` in localStorage. A small same-origin initializer applies a validated value before body paint. Invalid/missing/inaccessible storage falls back to Light. In-session switching works even when storage is blocked, with an explanatory status message. Other tabs synchronize through the browser storage event.

Selection survives navigation, reload and normal sign-out/sign-in on that browser. It is not tied to an email, Atom or account. Deactivation does not clear it. Account deletion still removes account preferences according to existing rules; this non-identifying browser display choice remains until changed or browser storage is cleared. Devices and browser profiles choose independently; there is no cross-device synchronization or server cookie.

The root hydration warning exception is limited to the pre-paint root appearance attribute. Rendered content remains the same during server rendering and hydration; the external-store hook reconciles the selected appearance.

## Living Atom

A frame carries optional light/dark appearance. The existing Canvas renderer keeps its scene, camera, hit targets and animation clocks. It swaps stable neutral palette objects and rebuilds only the cached background when necessary. Neutral Bond lines, inactive layers and labels follow the palette. All 24 emotional definitions, propagation sequencing, timing, state expiration and semantic colors remain unchanged.

Shared sphere painting accepts an optional neutral palette; its default remains the original light palette so the introduction/export artwork stays unchanged. Theme changes do not recreate the renderer or restart Pulse.

## Offline / PWA

The service worker's fixed public allowlist adds only the shared token stylesheet and static initializer; its cache revision changes to v3. No runtime/account/Auth/invitation/Pulse data is cached. Offline navigation uses the same local choice. Manifest identity, scope, start URL, icons and installation behavior are unchanged. OS-controlled launch artwork/splash may remain light; in-app chrome and theme-color follow the saved choice.

## Accessibility and verification

Both themes use semantic controls, pressed-state appearance buttons, keyboard focus and accessible status text. Reduced-motion and existing modal focus behavior are unchanged. Pulse labels and category names remain available, so emotion is never communicated by color alone.

Coverage includes initialization with missing/invalid/blocked storage, neutral palette contrast, all 24 unchanged emotional colors, immediate switching, cross-tab Canvas continuity, reload/navigation, owner/admin pages, welcome and offline appearance at 390×844, 768×1024 and 1440×900. Existing authentication, Bond/QR, lifecycle, growth, security/database and browser regression suites remain required before review.

## Local review verification

- Unit/integration/security suite: 295 tests passed; the additional blocked-storage selection test passed in the focused four-test appearance suite (296 current cases in total).
- Core responsive browser suites: 99 public and 72 authenticated cases passed, including one isolated rerun after a concurrent-run timeout.
- Dark-mode owner/admin, QR, Pulse and lifecycle coverage: 21 cases passed. All 24 emotional states retained their colors and reached the complete network in the dark-mode visual suite.
- Final light/dark/default/offline checks: nine cases passed. Theme-switch-during-Pulse continuity: three cases passed after aligning the test sample with the existing 30ms paint throttle; application timing was unchanged.
- Persistence: three cases passed. Introduction/reduced-motion: six cases passed.
- PostgreSQL concurrency/restart, privileged-client boundary, formatting, lint, TypeScript, production build and repository/browser secret checks passed.
- Light and dark reviewed at 390×844, 768×1024 and 1440×900. No horizontal overflow or control collisions found in the covered screens. Long content remains scrollable within existing dialogs.

Performance impact is limited to a local external-store update and cached Canvas background repaint on appearance changes. No new graph traversal or network request is required. This is not a physical-device performance benchmark. Physical OS splash behavior was not newly tested; the manifest/install contract is unchanged.

v0.11.3 remains the previous approved baseline in Git history. The v0.11.4 release contains presentation-only changes and browser-local appearance persistence.
