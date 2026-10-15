# Connect. Create. Play. Together. — Task #16.0

Initial creative-review checkpoint against v0.15.0 (`783cd3a`). At that checkpoint, no production
application modules, data, schema, configuration or frozen specifications change.
The product owner subsequently approved export and publication as v0.16.0; see the release record below.

## Review

Open `http://127.0.0.1:3140/review/promotion` with the development server running.
The route uses the same development-only guard as the original introduction and
is absent from application navigation. Production renders the not-found boundary.
PLAY, PAUSE, RESTART, keyboard timeline, scene selection and a reduced-motion
checkbox are available. System reduced motion always takes precedence. Playback
starts paused, ends at 30 seconds and suspends its clock in hidden tabs.
An accessible transcript describes all five scenes, including the closing CTA.

| Time  | Scene          | Treatment and copy                                                                                                                                                       |
| ----- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 00–05 | Connection     | Single luminous Atom, second Atom, branching network. EVERY CONNECTION STARTS SOMEWHERE.                                                                                 |
| 05–10 | Your world     | Nodes move to invented geographic positions over outlined continental silhouettes. TOGETHER, WE BRING THE WORLD CLOSER.                                                  |
| 10–16 | Global Doodle  | 64×64 heart fills in, scales into a gently scrolling three-drawing feed. SHARE A LITTLE CREATIVITY.                                                                      |
| 16–23 | Partici-Puzzle | 5×5 board, revealed piece, snap and lock, simulated cooperative completion. SOLVE SOMETHING TOGETHER.                                                                    |
| 23–30 | Invitation     | Network returns; ATOMIC BOND / CONNECT. CREATE. PLAY. TOGETHER. / ONE WORLD. MORE WAYS TO CONNECT. / ATOMICBOND.IDEAORDIE.COM / JOIN FREE. Fully visible from second 24. |

The requested campaign spelling PARTICI-PUZZLE is used inside the artwork only;
the application's current PARTICIPUZZLE identity is unchanged. Accelerated
cooperative placement illustrates multiple simulated participants, not bypassed
individual cooldowns. The advertisement does not make new gameplay claims.

## Rendering and content provenance

`src/prototypes/promotion/paint.ts` paints complete deterministic frames from
seconds, with no mutable simulation, random clock, fetch or production adapter.
The preview quantizes normal playback to 30 fps. The export uses the same painter
through the review timeline. Reduced motion uses five representative stills.

The existing Living Atom `paintCore`, palette, synthetic introduction graph and
original continental illustration are imported read-only. Geographic positions
are invented, not participant locations. Dot drawings and the landscape are
original geometric illustrations generated in code. The landscape is not the
production Connected Landscape artwork. There are no aliases, Atom numbers,
identities, genuine Bonds, submissions or private assets.

The unchanged root layout may request Vercel's static development SDK. This route
is excluded by the existing analytics allowlist; no analytics events or production
data requests are allowed by the browser acceptance test. The export blocks every
non-loopback request. No analytics or service-worker behavior has been changed.

## Export preparation — approval required

After product approval only, set `PROMOTION_EXPORT_APPROVED=true`, `FFMPEG_BIN`
to the trusted local executable and optionally `PROMOTION_REVIEW_ORIGIN` to a
loopback development origin (default `http://127.0.0.1:3140`). Run
`node scripts/export-promotion.mjs`.

The script refuses export without the explicit approval flag. It seeks frames
0–899 at frame/30 seconds, captures 1920×1080 PNGs and pipes them to FFmpeg:
H.264, yuv420p, BT.709, 30 fps, 900 frames, exactly 30 seconds, no audio, fast-start.
Output is under ignored `artifacts/promotion-export/`; no public poster or deployed
asset is overwritten. Existing output is not silently replaced. No new dependency
or external media provider is used.

Final encoding/ffprobe validation, compression quality, file size, physical-device
playback and X upload-preview remain post-approval checks; they are not claimed
from browser verification alone. Determinism is verified within Chromium on this
host; font rasterization can differ across operating systems.

## Verification

- 461 unit/integration/security tests passed.
- Six responsive review cases passed at 390×844, 768×1024 and 1440×900:
  all scenes, aspect ratio, overflow, identical seek pixels, play/pause/restart,
  exact endpoint, reduced-motion stills and keyboard timeline.
- Full-resolution paint sampling: 40 frames, median 1.5 ms, p95 5.2 ms on local
  desktop Chromium. This is painter CPU time, not a physical-phone GPU benchmark.
- Production build and TypeScript passed in the isolated no-local-env copy.
- Changed-file lint/format and repository/compiled-browser secret scan passed.
- Scene screenshots and responsive captures: ignored `artifacts/task160/`.

Full playback reached the exact 30-second timeline endpoint in 30.374 seconds
including test click/poll overhead; no analytics events or production-data requests
were observed. Seven browser tests passed (the complete-duration check runs only
on desktop; its two redundant viewport variants are explicitly skipped). Two
production-mode isolation tests passed for the new and existing review routes.
The export approval guard was exercised and correctly refused to create a video.
The initial local checkpoint stopped before export, commit or deployment.

## v0.16.0 publication

The product owner approved export and welcome-page publication. The welcome page
now imports the campaign painter and timeline, retains its existing accessible
Canvas playback controller and secure registration CTA, and uses the same-renderer
closing frame as a no-JavaScript poster. The downloadable MP4 is a separate local
advertising deliverable; the website does not require a video download to play.

FFprobe verified H.264/yuv420p, 1920×1080, 30 fps, 900 frames, exactly 30.000 seconds,
no audio and 5,158,594 bytes. Complete FFmpeg decoding succeeded without errors.
The original 25-second renderer/export and historical documentation remain intact.
No specification, database, gameplay, production schedule or authentication change.

Release verification: 461 unit/integration/security tests, full formatting/lint,
TypeScript/production build and client-boundary/secret checks passed. General
browser run: 113 passed, one unchanged tablet Pulse case hit the 30-second timeout;
its isolated rerun passed unchanged in 9.8 seconds. All six welcome browser cases
and three authenticated welcome/returning-owner cases passed. Light/Dark and
390×844, 768×1024 and 1440×900 presentation were covered. No CI assertions or
configuration were weakened.
