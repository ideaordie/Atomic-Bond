# Living Atom Engine v0.1

Foundation Task #2; application version 0.2.0. This extends the approved blueprint
without revising it. The v0.1.0 foundation report and permanent mock fixture remain
unchanged. Visual refinement is a later, separately approved task.

## Architecture

```text
Next.js /explore (composition root; supplies the synthetic GraphData)
  → LivingAtom (React state, controls, accessible information)
    → getPerspective (independent graph BFS)
    → createScene (deterministic aggregation and orbital layout)
    → AtomCanvas (lifecycle, input, scheduling)
      → AtomRenderer interface
        → Canvas 2D adapter
```

| Module                                        | Responsibility                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/graph/degrees/perspective.ts`            | Undirected adjacency and shortest graph distances                                           |
| `src/living-atom/types/scene.ts`              | Renderer-independent visual scene and adapter contract                                      |
| `src/living-atom/layout/scene.ts`             | Stable node ordering, degree shells, aggregation, edge summaries                            |
| `src/living-atom/renderer/AtomCanvas.tsx`     | Canvas lifetime, resize, frame scheduling and pointer/keyboard input                        |
| `src/living-atom/renderer/canvas-renderer.ts` | Drawing, screen projection and hit-testing                                                  |
| `src/living-atom/interaction`                 | Camera transforms, selection helpers, reduced-motion subscription, grouped-member selection |
| `src/living-atom/animation/motion.ts`         | Restrained deterministic drift and transition progress                                      |
| `src/living-atom/pulse/traversal.ts`          | Ordered, exact-distance Pulse steps                                                         |
| `src/living-atom/LivingAtom.tsx`              | Selection, Pulse timer, controls and textual metrics                                        |

There are no backend imports, authentication assumptions or mock-generator imports
inside the Living Atom subsystem. The application route supplies `GraphData` and
`originalAtomId`. The original Atom here is a demonstration starting point, not
an authenticated account. Input is an immutable public graph of confirmed edges;
the renderer does not decide Bond validity. Duplicate node IDs, invalid edge
endpoints, self-edges and missing selected IDs fail explicitly during traversal.

## Graph-to-visualization interface

The canonical `GraphNode` and `GraphEdge` remain unchanged. Their `degree` field
means incident edge count. A perspective computes a separate `distance` using
BFS; it never treats node degree as separation from the selected Atom.

`AtomScene` contains the selected public node, positioned visual nodes, summarized
real edges, counts and a fitting extent. A visual node is either an individual
Atom or an aggregate with member IDs and one exact graph distance. Visual edge
counts describe actual undirected Bonds between representations; internal group
edges are not drawn. No inferred or decorative connections are added.

Scene generation sorts IDs and edge pairs, so input ordering does not affect its
output. It has no random or time-dependent values. Only the rendering frame adds
motion. Identical scene, camera, time and motion settings produce the same view.

## Degree representation and counts

- Distance 0: selected Atom at world position `(0, 0)`, brightest luminous core.
- Distance 1: mint nodes and stronger direct Bond lines.
- Distance 2: blue nodes with an outer ring.
- Distance 3: violet nodes with a square outline.
- Farther nodes: numbered group markers at their true distance shell.
- At most 24 individual Atoms per layer for distances 1–3. Overflow and all
  farther nodes use up to four stable buckets per distance, based on public
  cluster metadata (or ID when absent). Buckets may combine clusters but never
  combine distances. These are display groups, not inferred communities.
- The initial horizon is eight graph edges from the selected Atom. Farther
  reachable nodes are counted but not drawn. Recenter to explore further.

The initial mock perspective shows 221 of 640 reachable Atoms, with 12 direct
Bonds and maximum displayed distance 8. Another 419 reachable Atoms are outside
that horizon; 360 nodes are in disconnected components. Counts include the center.
Disconnected nodes never enter the scene or Pulse. An isolated selected Atom
renders as a lone center with zero direct Bonds and maximum distance 0.

## Recenter and view behavior

Selecting a drawn Atom, a keyboard-selector entry or a grouped member makes that
Atom the center, rebuilds its BFS perspective and scene, resets pan/zoom and
cancels any previous Pulse. The new center is fixed at the viewport center while
the new scene fades in over 420 ms. There is no force simulation or animated
crossing of nodes between old and new layouts. Returning home restores the
original supplied Atom, not merely the camera.

Wheel zoom is anchored under the pointer. Buttons zoom about the view center.
Zoom is clamped to 0.65–4×. Drag pans; two-pointer pinch combines midpoint pan
with anchored zoom. A six-pixel movement threshold separates selection from
dragging, and a pinch cannot accidentally select an Atom. Fit resets the camera
without changing the selected Atom. Canvas arrow keys pan; + / − zoom.

The scene uses CSS-pixel hit targets with a minimum radius of 14 pixels and
chooses the nearest individual Atom. Dense small-screen nodes can still be
easier to select after zooming or through the native selector. Aggregate markers
are summaries; their members can be selected in the expandable grouped explorer.
That explorer pages 40 members at a time to avoid unbounded DOM growth.

## Pulse

Pulse activates distance 0, then 1, 2, and so on through the displayed horizon,
at 600 ms per degree. A visual edge activates at the greater endpoint distance,
including same-layer edges. Aggregates activate with their entire member count
because all members have the same distance. Only actual graph-derived nodes and
edges brighten; the orbital guides are never used as an expanding decorative wave.

Text reports the current distance, count at that distance, and completion total.
Pulse can be stopped, restarted, or cancelled by recentering. Timer cleanup occurs
on unmount. Counts are deterministic; animation timing is a presentation choice.

## Motion and accessibility

Continuous motion is at most three world units of local drift; it never changes
graph relationships and never moves the central Atom. Ambient dust is decorative,
deterministic and separate from graph nodes. No essential metric exists only in
the canvas. Visible metrics, a legend, instructions and native selection controls
provide text and keyboard alternatives. Selected-Atom and Pulse updates are
announced politely.

`prefers-reduced-motion` updates are observed live. Reduced-motion and manual
pause disable drift, ambient movement and recenter fades. A still frame is drawn
only when input, size or Pulse state changes; there is no continuous frame loop.
Pulse remains a sequence of discrete static highlights and text, without spatial
motion. Controls have visible focus and a minimum 44-pixel height. When Canvas 2D
cannot initialize, a message appears and the native exploration controls remain.

## Performance and renderer replacement

- BFS is O(V + E); scene construction also sorts identifiers for determinism.
- Graph traversal and aggregation occur on selection/input changes, not per frame.
- There are at most 105 visual glyphs: center, 72 individual nearby nodes, and
  at most 32 aggregates. Actual edge summaries are deduplicated by glyph pair.
- Canvas uses device-pixel ratio capped at 2 and draws at roughly 30 fps.
- Hidden tabs stop the continuous render loop. ResizeObserver adapts to layout
  changes. Frames, timers, listeners, observers and renderer resources are cleaned
  up on unmount; React strict-mode setup/cleanup is supported.
- A stress test proves 5,000 direct neighbors collapse to no more than 29 glyphs
  and 28 summarized lines. This is not a production-scale performance claim.

`AtomRenderer` exposes `resize`, `draw`, `hitTest` and `dispose`. `AtomCanvas`
accepts a renderer factory. A future adapter can consume the same scene/frame
without importing graph services or changing UI, layout or Pulse calculations.
Replacing the surface with WebGL would involve the adapter and canvas lifecycle;
no WebGL dependency or migration is part of this task.

## Verification

Verified on Windows, 2026-09-21, using the foundation's unchanged toolchain:

- `pnpm check`: passed formatting, lint, TypeScript, tests, production build and browser checks.
- 23 unit/graph tests passed, including all eight original fixture tests.
- 15 Chromium browser tests passed, including all three original landing checks.
- Touch tap/drag/pinch, canvas selection, native/grouped selectors, recenter/return,
  camera controls, live motion preference changes and reduced-motion pixel
  stability passed at all three required viewport sizes.
- Pulse timing was checked with a paused browser clock; degree 1 and degree 2
  produced different canvas frames, in addition to ordered text/status updates.
- `/explore` returned HTTP 200 from the local development server.
- AGENTS.md, Master Specification, Build Blueprint and the v0.1.0 baseline record
  retain their pre-task SHA-256 hashes. The original fixture digest test passes.

Tests cover shortest distances, cycles, disconnected/isolated components, exact center
placement, recenter/return, deterministic scenes, real-edge aggregation, draw
budgets, camera bounds, Pulse ordering and reduced-motion positions. Browser
checks exercise canvas clicks, keyboard/native selectors, touch tap/drag/pinch,
motion settings, reduced-motion pixel stability and distance-by-distance Pulse.

Reference captures use reduced motion at 390 × 844, 768 × 1024 and 1440 × 900.
They are recorded under `artifacts/references/living-atom-v0.1/` for future visual
comparison; full-page captures may exceed the viewport height. Fresh runs write
`test-results/` images and the Playwright HTML report. The references are reviewed
captures, not cross-platform pixel-diff assertions or a final design approval.

## Known limitations

- Eight-degree horizon and deterministic radial grouping are deliberate first
  engine constraints. Camera zoom does not expand groups automatically.
- Disconnected components are supported when passed as the selected perspective
  and tested in pure graph/scene tests. This demonstration starts in component 0
  and does not provide a component-switching product flow.
- The complete synthetic graph is delivered to the browser; progressive fetching,
  worker-based traversal and production-scale benchmarking are future work.
- Canvas supports mouse, Chromium touch emulation and keyboard alternatives;
  physical devices, Safari and Firefox have not been verified in this task.
- The visual language follows the supplied textual direction. Final visual polish
  and approved-artwork matching remain deferred.
- Existing ESLint 9 compatibility/deprecation and unverified remote CI limitations
  from the foundation remain. No dependencies were changed.
- No specification revision, authentication, Supabase, production Bond creation,
  registration, sharing, QR, email, location collection or Task #3 work occurred.
