# Animated Welcome v0.1

Task #11.2 / v0.11.3 publishes the approved introduction at `/welcome`.
The existing entry route and authenticated experience are unchanged.

## Playback and accessibility

One deterministic 1920×1080 Canvas painter supplies the development review,
public page and MP4. Five scenes retain the approved script, choreography,
colors and 25-second duration. The page autoplays silently once, then stops;
PAUSE, PLAY and REPLAY remain available. Leaving the visible tab pauses playback.
Reduced-motion visitors initially see the final composition; explicit replay
advances through five still scenes. A same-renderer PNG supplies the no-JavaScript
fallback. A transcript and independent semantic CTA remain usable without motion.
The responsive canvas remains 16:9.

CREATE YOUR ATOM links to `/auth?mode=register`. Existing verified-owner handling
prevents duplicate registration and handles deactivated owners without changes.
No identity, invitation, database or service-worker logic is changed.

## Privacy and analytics

The 72-node graph and stylized map are synthetic and visibly identified as not
live participant data. No production identities, metrics or locations are loaded.
`/welcome` is the sole additional analytics allowlist entry. Queries, fragments,
sensitive routes, unsafe/external referrers and custom events remain excluded.
Some advertisement referrals are deliberately not counted; privacy filtering is
not relaxed for attribution.

## Reproducible export

Run the development review server, set `FFMPEG_BIN` to a trusted local FFmpeg
executable, then run `node scripts/export-introduction.mjs`. Optional
`INTRODUCTION_REVIEW_ORIGIN` accepts only a loopback development origin.
The script seeks all 750 timeline frames and pipes PNGs into H.264 encoding.
It also produces the small committed poster. No live API or secret is used.

Output: `artifacts/introduction-export/Atomic_Bond_Introduction_1080p.mp4`.
Video and portable tools remain ignored, outside deployment.
Encoding: 1920×1080, 30 fps, 750 frames, exactly 25 seconds, H.264,
yuv420p, BT.709, MP4 fast-start, no audio. Size: 4,630,795 bytes.
Full decoding completed without errors. Representative source/decoded frames
remain local for review. No X Ads upload is performed by this task.

Windows export used the portable Gyan build linked from
[FFmpeg's download page](https://ffmpeg.org/download.html), with archive checksum
verified before use. No system installation or application dependency was added.

## Verification and limits

Browser coverage uses 390×844, 768×1024 and 1440×900: playback completion,
pause/replay, reduced motion, static fallback, focus, aspect ratio, overflow,
secure registration and returning-owner recognition. The review route remains
development-only. Existing Auth, PWA and Living Atom regression coverage remains.
Physical-device and in-X playback are not claimed; manual X upload/preview remains
the advertiser's final check.

Release verification: 292 unit/integration/security tests; 90 public browser
cases (the initial focus assertion was corrected to use real Tab navigation,
then all six welcome cases passed); 69 authenticated cases; three persistence
cases; six deterministic prototype cases. PostgreSQL concurrency/restart and
client-boundary checks passed, as did formatting, lint, TypeScript, production
build and repository/browser secret scans. All three responsive screenshots were
reviewed for overflow, readable hierarchy and unobstructed controls. Chromium's
HTML5 player completed the 750-frame MP4 without media errors; six frames were
dropped during concurrent regression workload. Full offline decoding retained
all frames and black-frame detection found none.
