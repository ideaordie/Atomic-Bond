# Living Atom Spatial Experience v0.2

Task #3 introduced application version 0.3.0; Task #3.1 patches it as 0.3.1.
This is a Canvas 2D presentation extension
within the approved blueprint. The Master Specification, blueprint, foundation
baseline and v0.1 engine report remain historical, unchanged documents.

## Preserved foundation

### Atom identity context — Task #5.1 / v0.5.1

Selection opens a public context panel without changing the camera or centered
Atom. **View their network** remains the explicit recenter action. The panel
always shows `ATOM #<publicId>` and displays a prominent trimmed alias only when
provided. Missing alias and X values create no empty rows or placeholder text.

The validated X handle and **VIEW ON X** share one keyboard-accessible external
link, with a 44px minimum target and visible focus. The URL is constructed from
the normalized handle; no stored URLs are used. Opening X leaves the current
network state intact and continues to state that ownership is not verified.

Relationship distance and the deterministic shortest path now originate from
`originalId` (the user's Atom), even when another Atom is the camera center.
Direct Bonds are distinguished from indirect connections. Compact paths show
YOU, intermediate dots (or a count for long paths), and the destination alias or
public number. The accessible path names each public participant. A path
describes connectivity only, never inherited trust.

Network size includes the selected Atom and all reachable people. Reach retains
regions/countries and adds known cities, deduplicated by country/region/city;
city coverage is partial. Home region remains coarse. Only explicitly selected
GraphNode public fields are rendered; private identity records are not inputs.

The panel is capped at 45% of the small viewport height, scrolls vertically when
needed, wraps long names, and keeps the recenter action sticky. The Living Atom
remains visible around it. Existing motion, scene layout and fixtures are intact.

Unit tests cover all four alias/X combinations, public-only rendering, invalid
URLs, direct and indirect paths, and user-relative context after recentering.
Browser tests cover long aliases, maximum-length handles, external keyboard
navigation, selection without recentering, explicit recentering, and screenshots
for each optional-field combination at all three reference viewports. Existing
indirect-context captures remain part of the regression suite.

Task #5.1 verification (2026-09-23): formatting, lint, TypeScript, production
build, all 102 unit/graph/service/rendering tests and all 45 Chromium browser
tests passed. The 96 prior unit tests and 33 prior browser tests remain intact.
Eighteen captures were visually reviewed at 390 × 844, 768 × 1024 and 1440 × 900:
all four optional-field combinations, plus direct and four-Bond indirect
connections. A 60-character unbroken alias and 15-character handle wrap without
horizontal overflow; the longest mobile panel scrolls to reveal lower details
while its action stays accessible. Captures are preserved locally under ignored
`artifacts/references/atom-identity-v0.1/`. No physical-device or hosted deployment
verification was performed. Master Specification, Blueprint and mock fixture
hashes match the v0.5.0 baseline.

## Original spatial foundation

The fixture, shared graph types, BFS perspective, base scene budget, camera
helpers and graph-distance Pulse traversal are unchanged. The original 1,000
Atoms and 4,062 Bonds still produce 640 reachable people from the starting Atom,
including that Atom, with 12 direct Bonds. The eight-Bond horizon represents 221
people; 419 reachable people remain outside the view and 360 are disconnected.

The renderer still consumes public graph-derived presentation data. No database,
authentication, communication, authoritative Bond creation or geography service
is introduced. The route supplies synthetic data; the Living Atom does not import
the mock generator. Indirect connection never implies trust.

## Module flow

```text
GraphData → unchanged getPerspective / createScene
  → layout/spatial.ts → SpatialScene
    → LivingAtom state and accessible controls
      → AtomCanvas lifecycle, gestures and scheduling
        → projection.ts + spatial-motion.ts + Canvas 2D renderer
```

`types/spatial.ts` adds conceptual x/y/z, orbit parameters, regional summaries
and precomputed cloud particles. `interaction/atom-context.ts` follows descending
BFS distances to explain the selected relationship; it does not replace BFS.
`pulse/presentation.ts` separates timing and direction from traversal.

## Spatial model and projection

The central Atom stays at (0, 0, 0). Direct neighbors receive irregular radii,
angular offsets, elliptical placement and positive/negative depth. Nearby
connections occupy local structures around their deterministic first direct
ancestor on a shortest path. This arrangement describes relationships, not
physical locations, orbital mechanics or inferred trust.

Projection uses `900 / (900 + z)`, with a near-plane clamp at -450. Camera zoom
and pan apply in CSS pixels. Wide viewports expand horizontal composition by at
most 1.35 to use the available space. Depth changes apparent size, light,
opacity and Bond strength. Nodes and curved Bond commands share a stable
far-to-near paint order; a Bond uses mean endpoint depth. This permits foreground
and background layers but is not per-pixel 3D occlusion.

The gold center uses layered gradients, bloom, depth shading, a glint and
precomputed internal particles. Individual neighbors use small human silhouettes;
direct Bonds have stronger gold lines and subtle local orbital traces. Degree
rings and numbered aggregate bubbles are absent. The center says YOU only for
the original Atom; another perspective displays that Atom's identifier.

## Orbital behavior

Each direct Atom follows an independent ellipse around the selected center.
The ellipse is fitted through its approved initial x/y position, with an
independent inclination and axis ratio (0.72–0.90). Its deterministic speed is
0.000016–0.000025 radians/ms: approximately one orbit every 4.2–6.5 minutes.
This produces perceptible motion over a ten-second observation without changing
the initial layout or rotating the entire network as one rigid wheel.

Direct depth oscillation has a 45–70 world-unit amplitude and an independent
phase. Projection changes apparent size, light and Bond strength continuously.
Nearby individual systems follow the displacement of their actual direct-parent
Atom and retain their own local elliptical motion. Region clouds drift
locally on 12–18 by 8–12 world-unit ellipses, with restrained particle shimmer.
The center remains positionally fixed while its illumination, internal particles
and dimensional shading change slowly. No per-frame randomness is used.

`animation/ambient-clock.ts` accumulates active animation time outside React
state. Pause, reduced motion and hidden-tab suspension freeze the last drawn
arrangement, including cloud shimmer and core illumination. Resume excludes the
inactive interval and continues from that exact time; only choosing a different
center starts a new arrangement. Camera changes do not reset ambient time.
Reduced-motion detection continues to use the live browser media query and the
UI accurately displays its disabled Motion reduced control.

`spatialPositions` computes the current world positions once per frame. Nodes,
Bond endpoints, depth ordering and hit targets all use the same projected map,
so lines and interactions follow the moving Atoms without stale coordinates.
Motion never changes topology, shortest distances or Pulse traversal.

### Task #3.1 root cause

The animation loop was alive, not stalled: a local normal-viewing check recorded
301 redraws in ten seconds, with reduced motion false, the page visible and the
UI in gentle-motion state. Elapsed time reached the renderer, which recalculated
orbital coordinates and projection every frame. React lifecycle and scene/map
caching did not suppress position updates.

The defect was perceptual and structural. Version 0.3.0 used only a 10 × 7
world-unit offset around each fixed direct position, not an orbit around the
selected Atom. After mobile projection, direct Atoms moved only 0.73–1.70 CSS
pixels over ten seconds (median 1.33px). Five-unit depth and tiny particle offsets
were similarly difficult to perceive, and local systems ignored parent motion.
The earlier tests checked nonzero motion and frame cadence, which could pass
despite this effectively static experience.

Investigation also exposed a pause defect: `elapsedMs` was forced to zero and
manual pause was conflated with reduced motion. That restored the initial
positions rather than freezing the current ones; resume reused absolute browser
time and jumped ahead. The active-time clock corrects both discontinuities and
keeps manual ambient pause independent of Pulse.

## Clusters, regions and progressive zoom

The unchanged base scene determines represented membership and nearby individual
budgets. The spatial adapter replaces shell geometry and regroups distant members
by **exact BFS distance and coarse region**, so Pulse still reaches a cloud's
entire membership at the correct step. Only real graph edges are summarized;
edges internal to a cloud are omitted from drawing. No decorative Bond is added.

| Scale    | Zoom            | Representation                                                                          |
| -------- | --------------- | --------------------------------------------------------------------------------------- |
| People   | 1.4–4           | Nearby individuals emphasized; distant clouds subdued; region labels hidden             |
| Networks | 0.86–below 1.4  | Nearby branch structures plus distant luminous clouds and region labels                 |
| Regions  | 0.65–below 0.86 | Only center/direct individuals remain; other represented members become regional clouds |

Zoom does not increase the eight-Bond horizon. A future global scale must use
real data and aggregation; decorative background stars are not additional Atoms.
The People/Networks modes share membership but change visual emphasis, while
Regions changes actual representations. Cloud particles express density, not a
one-particle-per-person count. Counts remain available as text.

The existing optional `GraphNode.metadata.region` and `countryCode` provide the
geographic contract. Regional keys combine both fields, so identically named
regions in different countries stay separate. Real coarse metadata can replace
fixture values without changing the renderer. At most six named regions plus
Other regions are shown. Missing geography is Unspecified region and is excluded
from known-region/country totals. No precise coordinates are collected.

The starting network genuinely spans Ontario, Scotland and Kanto: three regions
and three countries. Region labels count all reachable members; clouds summarize
only represented members. Miles, cities and weekly growth are unavailable and
are not invented. Bond dates in the context panel are explicitly fixture dates.

## Selection and controls

Clicking/tapping an individual or selecting an accessible list entry inspects
that person without moving the camera, changing the center or cancelling Pulse.
The compact context panel provides relationship, network reach, geographic reach,
a direct Bond date when available and a simplified shortest path for indirect
connections. Full path text is exposed to assistive technology.

Only **View their network** changes to that person's perspective. It resets the
camera and cancels the previous Pulse. **My Atom** immediately restores the
original perspective; **Recenter** (accessible label Fit) resets only the camera.
Drag, wheel, two-finger pinch and canvas keyboard controls retain their existing
behavior. The Explore Atoms drawer offers native selectors, paged grouped members,
motion controls and secondary network details. Selecting via these controls uses
the same inspect-then-view flow. Context headings receive focus when selected.

The mobile layout places metrics above the network and primary actions in a
bottom dock. The context panel occupies less than one-third of each tested
viewport and leaves the central system visible. Dense node selection can still
benefit from zoom or the native selectors; minimum canvas hit radius is 14px.

## Pulse presentation and future return compatibility

The unchanged traversal visits distance 0 through the displayed horizon, one
step every 600ms. During a step, light travels along actual outward Bond curves;
their destination Atoms/clouds illuminate in the latter part of that step.
Same-distance Bonds brighten without implying an additional outward step.
Reduced motion uses static sequential highlights. Manual ambient pause freezes
the spatial arrangement but leaves Pulse energy moving on its separate clock.
Text announces people reached
and completion without prominently displaying degree numbers. The total is
represented reach, not the whole connected component or real message delivery.

Presentation state includes origin ID, outgoing/returning direction, distance,
step timestamp and completion. Only outgoing is initiated or animated now.
The returning value reserves a future intent; it does not implement return
communication. A future approved system could invite recipients to Return the
Pulse, then animate responses toward the origin and report Atoms reached,
returns, cities/countries and return percentage. Delivery, consent, persistence,
email and denominators must be designed separately under the product authority.

## Performance

Traversal, branch placement, grouping and cloud particle generation happen on
scene changes, never per frame. Regional membership is accumulated linearly.
The starting fixture is bounded to nearby individuals and distance/region clouds;
at most 129 glyphs are possible with the current 24-nearby-per-distance budget,
seven region buckets and eight-distance horizon. Each cloud has at most 48
particles. Scene maps, static starfield and core particle seeds are cached.

The existing renderer interface, approximately 30fps scheduling, pixel ratio cap
of 2, ResizeObserver, hidden-tab suspension and unmount cleanup remain. Each
frame projects the bounded scene and depth-sorts paint commands; React does not
render individual particles. Full graph delivery and synchronous scene generation
remain prototype constraints, not a claim of production-scale performance.

## Task #3.1 verification

Verified on Windows, 2026-09-21, with the existing toolchain and no dependency
changes. `pnpm check` passed formatting, lint, TypeScript, all **37 unit/graph
tests**, the production build and all **21 Chromium browser tests**. All 18
existing browser checks are unchanged and still pass. The old local-offset bound
test was updated for full ellipses; new tests verify the ellipse equation and a
minimum perceptible displacement after projection, rather than merely nonzero
world-coordinate changes.

The regression suite proves active time advances, pause freezes exact current
positions/pixels, resume excludes paused time, parent/child displacement is
coherent, moving Bonds and hit targets share current coordinates, live reduced
motion freezes the arrangement, and Pulse works both during ambient motion and
while ambient motion is paused. Selection at a moving Atom's drawn position,
View their network and My Atom also pass at every viewport size.

Real-time viewing sessions were captured for at least ten seconds each at
390 × 844, 768 × 1024 and 1440 × 900. Frame sequences at 0/2/4/6/8/10 seconds and
WebM recordings are retained in `artifacts/references/living-atom-v0.2-motion/`.
Review of the sequences shows visible independent orbits, coherent local systems,
restrained cloud changes and an exactly positionally stable center. These are
normal-motion recordings, not accelerated or reduced-motion screenshots. They
come from the development server and include its development indicator.

The starting fixture's direct Atoms now move 9.18–22.60 mobile CSS pixels over
ten seconds (median 16.82px), compared with 0.73–1.70px before the fix. A separate
four-second paint-cadence check without recording overhead remains approximately
30 paints/second. Measurements and interval-frame coordinates are saved alongside
the recordings. These are local host checks, not physical-device benchmarks.

Review against the pre-task snapshot confirms the frozen Master Specification,
Build Blueprint, AGENTS.md, fixture, graph algorithms, base scene, camera helpers,
Pulse traversal, UI layout/styles and existing browser tests remain unchanged.
Application version is 0.3.1. No Task #4 work was performed.

## Original Task #3 verification record

Verified on Windows on 2026-09-21 using the unchanged foundation toolchain:

- `pnpm check` passed formatting, lint, strict TypeScript, all 31 unit/graph
  tests, production build and all 18 Chromium browser tests.
- The original 23 unit/graph tests and three landing viewport checks still pass.
  Browser coverage retains tap/click, drag, pinch, camera/keyboard controls,
  native/grouped selection, home, Pulse cancellation and live motion preferences.
- New checks cover inspect without recenter, explicit View their network,
  selection during Pulse, deterministic depth/projection, regional membership,
  zoom representation, bounded orbits, truthful paths and missing geography.
- Reduced-motion canvas pixels remain stable. A clock installed before page
  initialization verifies moving Pulse frames within one traversal step; the
  original distance-by-distance checks still verify all eight propagation steps.
- SHA-256 checks confirm unchanged governing documents, historical baseline and
  v0.1 report, mock fixture source, BFS, base scene, camera and Pulse traversal.
  The fixture digest test continues to pass. Git whitespace review passed.
- The local development `/explore` route returned HTTP 200. A four-second
  Chromium paint-cadence smoke check recorded 120 paints at both 390 × 844 and
  1440 × 900, median intervals 33.4/33.3ms and p95 intervals 34.6/34.2ms. This is
  one local desktop-host measurement, not a physical mobile-device benchmark.

Browser captures cover initial view, direct and distant context,
Pulse, medium zoom, People and Regions at 390 × 844, 768 × 1024 and 1440 × 900.
Fresh captures are produced under `test-results/`; reviewed references are kept
under `artifacts/references/living-atom-v0.2/`. They are human-reviewed artifacts,
not cross-platform pixel-diff assertions or a claim of matching the concept art.

All 21 state/viewport captures were reviewed. Direct Bonds remain distinct, the
gold center stays visible with a compact context panel, and the regional scale
removes extended individual nodes in favor of luminous clouds. The result moves
away from concentric graph shells toward irregular connected systems, using the
artwork's light, depth and human emphasis without copying its layout or invented
metrics. It is deliberately calmer and sparser than the artwork. Zoomed views
can crop distant content; panning and Recenter provide recovery.

## Known limitations

- The 2.5D painter uses approximate Bond depth; there is no WebGL occlusion.
- Regional placement is conceptual, not a map. Background stars are decorative.
- The horizon remains eight Bonds; zoom does not fetch or reveal additional data.
- Dense screen-space nodes can overlap; zoom and keyboard selectors remain useful.
- Physical devices, Safari and Firefox are not covered by Chromium emulation.
- Remote CI has not been run here. Existing ESLint 9 compatibility constraints
  remain; no dependencies were changed.
- No backend, Supabase, authentication, email, real Return Pulse or production
  geography was added. Task #4 has not begun.
