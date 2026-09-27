# Scientific Light Visual System — Task #7.2

The default presentation uses a pale cool-gray environment, navy text, restrained
blue Bonds, and dimensional silver/blue-gray particles. CSS surface, text, border,
action and focus tokens live in `src/app/globals.css`. Canvas material colors live
in `src/living-atom/renderer/scientific-palette.ts`; spatial scenes consume the
neutral regional palette without changing positions or graph membership.

## Materials and hierarchy

Following visual review, neutral-view materials distinguish graph distance from
the centered Atom: silver-blue center, muted brass direct Bonds, blue second
layer, lavender third, sage fourth, and stone for five or more Bonds. This is
structural context only, never an assigned emotion. The centralized `layerTint`
mapping applies consistently across regions. Feel Your Network continues to
replace structural colors with explicit emotional colors or its neutral material.

The central sphere retains its layered material, internal particles and breathing
illumination. Neighbors use directional white highlights, shaded blue-gray rims
and small offset shadows. Direct neighbors retain their larger sizes and stronger
Bond lines. Distant clouds retain deterministic particles and depth-dependent
opacity. The cached backdrop is a subtle blue-gray atmosphere, replacing the
decorative starfield. Default gold materials, lens flare and neon line bloom are
removed. No geometry, camera, Z ordering, orbit, hit target or animation timing
has changed.

Panels use soft translucent white with restrained borders/shadows. The existing
responsive action hierarchy and placement remain intact: CREATE BOND is filled
blue, PULSE and FEEL YOUR NETWORK share a quieter pale-blue treatment, and
secondary/utility controls remain outlined. Pressed states have a border/inset
indicator as well as a background change.

## Emotional color and accessibility

All eight existing `EmotionDefinition` colors are unchanged. Active spheres keep
dimensional shading while adopting emotional material tint. Propagation still
uses actual graph distance. Feel Your Network retains its authorized visibility,
regional distribution, manual toggle, and independently closable results panel.

Light emotion colors are used as markers beside dark text rather than as the
text itself. Radio selection, labels, visible blue keyboard focus, and the text
distribution ensure color is not the sole cue. Reduced-motion behavior is
unchanged. Primary/secondary action text contrast is browser-tested at 4.5:1 or
better. All three target sizes retain existing overflow and touch-target checks.

## Verification and scope

Browser captures cover 390 × 844, 768 × 1024 and 1440 × 900: neutral network,
selection/context, distant regions, selector, all eight outgoing/active emotions,
Feel Your Network/results, Create Bond, and isolated entry/registration screens.
Captures are local ignored test artifacts. Existing motion, identity, ownership,
Bond, Pulse, privacy and service regression tests remain in place.

The brief's written scientific/textbook direction was used; the referenced atom
illustration was not present in the supplied attachments. No authentication,
email, Supabase, graph algorithm, lifecycle, privacy or frozen specification
changes are part of this task. No production configuration or deployment is
required for local visual review.

Local verification: 146 unit/graph/service/security tests, 69 mock-network browser
tests, 15 Auth browser tests and 3 persistence browser tests passed. Native
PostgreSQL concurrency/restart tests passed; bounded cleanup retries handle
Windows releasing temporary database directory handles after shutdown. Formatting,
lint, TypeScript and production build are included in the final checks.
