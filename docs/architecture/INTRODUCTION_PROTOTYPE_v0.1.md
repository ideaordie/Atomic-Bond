# Animated introduction — Task #11.1 local prototype

Original Task #11.1 status: creative review only against v0.11.2, commit
`1deadccaeb44f3cd002dcc5af81e6de7dd59e56b`. The verification record below describes
that checkpoint. Task #11.2 subsequently approved the unchanged animation for
[Animated Welcome](ANIMATED_WELCOME_v0.1.md) and local advertisement export in v0.11.3.

## Review

Run the existing Next development server and open `/review/introduction`.
The dedicated browser configuration uses `http://127.0.0.1:3131`.
The route renders Next's not-found view outside development (the existing root
loading boundary can stream this with HTTP 200). It is not linked from application
navigation. PLAY, PAUSE, RESTART, scene buttons, a time display and a keyboard
operable timeline sit outside the capture area. Playback starts paused, stops
at 25 seconds and does not loop automatically. CTA text is capture artwork only.

## Single animation source

`src/prototypes/introduction/timeline.ts` defines immutable synthetic nodes,
their existing-parent relationships, scene windows and pure time sampling.
`paint.ts` paints a complete frame from a seconds value onto a 1920×1080 canvas.
It has no simulation state, random clock, network request or production data.
Seeking backwards therefore produces the same frame as seeking forwards.
The React review shell owns only playback and scrubbing.

The painter reuses the existing Living Atom core/glow functions and reads the
24 current Pulse colors without changing them. In this illustrative story,
color is a creative metaphor for human connection, not a claim that creating
a Bond sets someone's emotional state. No real identity, public Atom number,
location or network metric is included. Every connection belongs to a fixed
connected tree; new branches connect through existing nodes rather than a
repeated central fan-out. Seventy-two synthetic Atoms are an artistic choice,
not a displayed reach statistic.

## Storyboard

| Seconds | Scene                   | Treatment                                                         |
| ------- | ----------------------- | ----------------------------------------------------------------- |
| 0–4     | The isolated Atom       | Neutral luminous sphere and fine orbits, white field              |
| 4–8     | The first Bond          | Second sphere emerges, connecting line, color and traveling light |
| 8–15    | The network comes alive | Staggered parent-first growth and gradual pullback                |
| 15–21   | Global connection       | Same nodes and edges morph to stylized continental geography      |
| 21–25   | The invitation          | Network recedes behind brand, invitation and prominent CTA        |

The approved script is embedded in the frame and available as accessible text
below it. The global illustration carries a visible "ILLUSTRATIVE NETWORK / NOT
LIVE PARTICIPANT DATA" caption. Continental silhouettes in `world.ts` are original
simplified illustration paths, not a map dataset or a representation of political
borders. No external map service or new dependency is used.

## Accessibility and rendering

Reduced-motion users see five still key compositions; PLAY advances the story
without continuous movement, and all scenes can be selected manually. Canvas
descriptions and the complete transcript provide text equivalents. Controls
have visible focus and at least 44px button targets. The frame scales at 16:9;
the typography is drawn at source resolution to match eventual video output.

The renderer bounds work to 72 nodes and 71 connections. The browser test records
frame paint cost at full 1920×1080 backing resolution. Measurements are local
desktop Chromium observations, not a physical mobile or X playback benchmark.
The renderer reuses existing dimensional materials, with no WebGL or video library.

## Verification and export path

Unit tests cover scene boundaries, exact duration, connected sequential growth,
palette reuse, privacy of fixture fields and seek-order determinism. Dedicated
browser tests cover all five compositions at 390×844, 768×1024 and 1440×900,
pixel-identical repeated seeks, play/pause/restart, stopping at 25, aspect ratio,
overflow, reduced motion, keyboard seeking and 1080p paint cost. Captures are
ignored test artifacts. Production build verification must confirm the review
route renders only the not-found view and the existing application continues to work.

Future export can call `paintIntroduction(context, frame / fps)` for frames
0 through `25 * fps - 1`, then encode them at fixed frame rate to 1920×1080 MP4.
`paintIntroduction(context, 25)` is the settled thumbnail. No encoder, soundtrack,
MP4 or X upload is added here. Future landing-page integration must use this same
renderer and separately review CTA behavior, autoplay and delivery format.

## Product review decisions and limitations

Review the pacing, first color moment, restrained orbital spheres, amount of
branching, simplified map and final CTA. The stylized map is intentionally
approximate. Small-display legal/detail copy is secondary to the large story
headlines; inspect the supplied mobile capture at its actual size. No physical
device or in-X playback acceptance is claimed. This is the first complete local
prototype, not a finished advertising asset. Existing PWA, analytics, Auth,
database and production controls are unchanged.

## First prototype verification — 2026-10-09

- 289 unit/integration/security tests passed, including four introduction tests.
- Six prototype browser cases passed across the three reference viewports;
  screenshots cover every scene and the settled 1080p source frame.
- Existing landing, PWA and scientific-light browser checks passed (nine cases).
  Three production-build isolation checks passed.
- Formatting, ESLint, TypeScript/production build and secret scanning passed.
- Forty local 1920×1080 paint samples measured 6.8ms median and 12.8ms p95.
  This measures CPU canvas submission, not GPU completion or physical-device FPS.
- Headlines and enlarged final CTA were inspected at actual mobile width.
  The small brand/disclaimer remains secondary detail, with full descriptions
  and transcript outside the capture frame for the web review.
- No existing tracked application file, schema, configuration, version or frozen
  specification changed. No commit or publication was performed.
