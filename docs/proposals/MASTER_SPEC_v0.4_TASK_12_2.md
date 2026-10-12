# Task #12.2 — proposed surgical amendment to Master Spec v0.4

Status: Approved for publication on October 12, 2026. Applied surgically to Section 48A; v0.3 remains unchanged.

Only Section 48A changes. All other sections remain verbatim.

1. Replace its first paragraph with:

Global Doodle lets authenticated ACTIVE Atoms share temporary 64 × 64 monochrome
dot drawings. Drawing, erasing, undo, clear, accessible controls and Light/Dark
presentation are supported. The canvas is the preview; SEND is the final publication
action. Complete bounded replay remains available to authorized moderators, not
ordinary user-facing interfaces. The final bitmap is 512 bytes. No confirmed Bond
is required to create, view, appreciate or report a drawing. Anonymous access is
not part of this feature.

2. Replace “An Atom may have at most one live drawing.” with:

An Atom may have multiple live drawings, each with its own immutable identifier,
publication deadline, appreciations and reports. Publishing another drawing does
not replace earlier drawings.

3. Replace “Publication lasts exactly 60 minutes” with “Publication lasts exactly
   24 hours”. Existing published drawings retain their original deadlines.

4. Replace “Per-Atom cooldown, one live slot,” with “Per-Atom cooldown,”.

5. Replace “original 60-minute publication window” with “original publication
   window (24 hours for newly published drawings)”.

6. Add after the publication paragraph:

A compact global live feed appears on the authenticated owner's main Living Atom
page, in a narrow right column on desktop and below the graph and primary controls
on mobile. It shows static bitmaps, permitted public Atom numbers, publication age,
APPRECIATE and REPORT. It uses bounded cursor pagination and approximately 30-second
visibility-aware refresh, preserves scroll position, and excludes expired or removed
content. Hall of Fame remains separate from live-feed ordering. CREATE DOODLE opens
the existing editor. After server-confirmed publication, DOODLE PUBLISHED provides
RETURN TO MY ATOM and DRAW ANOTHER, disabled until the authoritative 60-minute
submission cooldown ends. Failed submissions preserve the unsent drawing; retries
are idempotent. No additional tracking or private/offline content cache is introduced.

All existing moderation, authorization, Hall threshold/approval/frozen scores,
retention, lifecycle cleanup and no-daily-quota clauses remain unchanged.
