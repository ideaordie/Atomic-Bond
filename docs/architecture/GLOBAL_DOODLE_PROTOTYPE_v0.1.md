# Global Doodle — local interactive prototype

Task #12.0 starts from approved v0.11.5 (`cb495aa`). This is an isolated concept review, not a production feature or an amendment to Master Spec v0.3. Any future global publishing surface needs explicit product/specification and privacy approval. It is not an endless social timeline.

## Local preview and isolation

Run the existing Next development server and open `/review/doodle`. The route returns the existing not-found boundary whenever `NODE_ENV` is not `development`. It is absent from application navigation. No Supabase client, authenticated identity, server action, drawing upload, RPC, migration, provider or new credential is used.

Drawings and synthetic examples exist only in component memory. Refresh/navigation discards them. SEND adds to this browser's simulated feed and clears the drawing surface; undo can restore the submitted drawing locally. No participant elsewhere can see it. The feed retains at most 24 items. Expired records may remain in bounded in-memory state until reset, submission eviction or page exit; they never appear in the visible feed. The existing appearance preference alone persists using the existing browser-local theme system. Existing analytics filtering excludes this review route; no custom events or instrumentation are added.

## Bitmap, strokes and undo

The logical grid is always 64 × 64. Row-major index is `y * 64 + x`. Bit `index & 7` in byte `index >> 3` stores the final dot. Encoding version 1 stores exactly 512 raw bitmap bytes as 684 base64 characters, plus metadata. There is no image storage or upload.

Pointer Events, pointer capture, integer Bresenham interpolation and coalesced-event handling support taps and continuous strokes. Only integer grid addresses are retained; pressure, exact screen coordinates and timing are not stored. A stroke records changed points once for its draw/erase operation. Cancellation restores the pre-stroke bitmap. Secondary pointers are ignored. The canvas uses `touch-action: none`; page scrolling remains available elsewhere. A keyboard cursor uses arrows and Space/Enter. One keypress is one undoable mark.

Undo retains at most 32 stroke/clear snapshots. Recorded replay history is bounded to 256 strokes and 8,192 changed point operations. Exceeding either limit preserves the final bitmap and drops replay history; the viewer shows the final still. Clearing starts a new history and can itself be undone. Replay records include erasure, so the reconstructed result is faithful. A deep copied snapshot prevents subsequent edits changing a submitted drawing.

## Rendering and replay

Separate Canvas drawing and playback components consume the model. No Living Atom renderer or graph module is changed. Pointer moves mutate a 512-byte buffer and request at most one scheduled paint; React updates at completed stroke boundaries, not per dot. Canvas resolution scales to the CSS surface with device pixel ratio capped at two. No large drawing library is added.

Playback runs for at most 2.4 seconds, applying an increasing prefix of recorded operations. The final frame always uses the authoritative bitmap. Missing history and reduced motion immediately show the final image. Changing to reduced motion or hiding the tab settles playback. No continuous animation loop runs after completion. Resize and theme changes repaint; a theme change can restart the short replay. Replay never changes drawing data or expiry.

## Simulated lifetime

Synthetic heart, face, waves and diamond drawings have fixed relative ages (3, 14, 36 and 59 minutes) at initialization. A local clock advances naturally; +15 MIN and +60 MIN demonstrate expiration. Visibility is `createdAt <= now < expiresAt`, with `expiresAt = createdAt + 60 minutes`. Selection falls back to an active item when the selected item expires. Reset examples replaces the simulated feed but does not change the canvas or reset the time offset. No backdated submission or server time is involved.

## Proposed production architecture — NOT implemented

For later approval, use a private Supabase drawing table with stable record ID, owner Atom foreign key, versioned bounded bitmap/stroke payload, server-created timestamp, server expiration and publication/moderation state. Avoid copying email, Auth identifiers, location or profile data into drawings. A minimal display projection may expose approved public Atom attribution, drawing and lifetime only.

An owner-authenticated server/database operation should derive the ACTIVE verified owner from the session, validate encoding and bounded replay consistency, enforce one active drawing and one submission per 60 minutes, and use transactional locks/constraints for concurrent requests. A client-supplied Atom ID or timestamp cannot authorize publication. Public display eligibility and expiration must be checked by database time on every read, even if cleanup is delayed. Lifecycle transitions and administrator removal must immediately suppress eligibility.

Scheduled deletion can remove expired active-table records with bounded batches. Rate-limit metadata may need a minimal last-submission timestamp separate from deleted content; retention must be explicitly reviewed. Removing active-table rows does not immediately remove database backups, point-in-time recovery copies, logs or caches. Define and disclose a realistic retention policy before launch. Do not log drawing bodies or private identities. No bucket or image-file storage is needed.

## Publication safety and moderation — future gates

A dot grid can contain explicit images, offensive symbols, harassment, threats or identifying information. It does not eliminate moderation risk. Before global publication, review pre-publication moderation, reporting, prompt administrator removal, appeals/false positives, age-appropriate policy, repeat-abuse posting restrictions, spam/automation defenses, per-account and service-wide rate limits, payload validation and emergency disable controls. Ordinary users must not remove another user's drawing; privileged operations require independently enforced server authorization and appropriately minimal operational audit data.

Decide whether content awaits human review, automated screening or a combined process, and assess its limits rather than implying guaranteed safety. Plan behavior when moderation is unavailable; do not silently bypass it. Decide how reports and necessary evidence interact with the one-hour visibility and retention promises. Do not add likes, replies, reposts, comments, followers, engagement ranking, push or email notifications as an incidental extension.

## Verification and limitations

Unit tests cover packed encoding, interpolation, stroke undo/cancellation, erase replay, bounded history/feed and exact expiration. Browser tests cover tools, local submission, sequential browsing, clock advancement, themes, reduced motion, keyboard input, touch/pen event handlers and production-route isolation at 390×844, 768×1024 and 1440×900. Test output and final review report distinguish browser emulation from physical-device verification. Physical trackpad, touchscreen and stylus hardware require manual product review; no hardware compatibility claim is made from synthetic events alone.

The 64-dot resolution is intentionally low and a one-dot brush can feel precise on small screens. There is no pressure-sensitive brush, zoom, image export, cross-tab synchronization or durable draft storage. Feed navigation is manual rather than automatically interrupting the current view. The prototype permits repeated local submissions to support review; proposed production cooldown and moderation are not presented as implemented security controls.

### Local verification — 2026-10-11

- Formatting, lint, TypeScript, production build and repository/browser secret scans passed.
- All 310 unit/integration/security tests passed, including six prototype model tests.
- Nine prototype browser checks passed across the three reference viewports. These cover both themes, mouse capture outside the canvas, Chromium touch transport, synthetic pen/cancellation handlers, keyboard focus, minimum 44px controls and reduced motion. An initial focus assertion used programmatic focus after pointer input; the corrected test verifies actual Tab navigation.
- All 42 selected existing appearance, map, Pulse and production-isolation browser checks passed. Production builds do not render the prototype.
- Light/Dark full-page screenshots were reviewed at all reference sizes without overlap or horizontal clipping. On mobile, the feed follows the editor and uses normal page scrolling.
- A 256-event burst took about 16–34 ms in mounted drawing handlers and 40–93 ms through two animation frames on the development desktop, depending on concurrent test load. These are short Chromium measurements, not physical-mobile benchmarks. No drawing submission requests were observed.

Local review: `http://127.0.0.1:3140/review/doodle`. Run `pnpm exec playwright test --config playwright.doodle.config.ts` for prototype checks. This task does not change the package release version or publish a milestone. Stop for product review before any commit or deployment.
