# Task 20.1 - Eight-color Global Doodle local review

Status: LOCAL ONLY. No commit, hosted migration, deployment or specification freeze.

## Baseline and scope

Repository HEAD and recorded origin/main: 3cb465a1f3f43ead80058f7929a5a770b8beb64f,
package v0.19.1. Working tree was clean before implementation. Production /about
returned HTTP 200 during this task; that response does not expose a release version,
so this task did not independently attest the currently deployed Vercel commit.
The previously accepted production baseline remains v0.19.1. Frozen Master Spec
v0.9, AGENTS.md and all historical migrations remain unchanged.

## Review

Local URL: http://127.0.0.1:3140/review/doodle/color

This development-only route uses synthetic drawings and the actual composer,
shared WORLD/MY NETWORK/Hall renderer, and moderator replay component. SEND updates
local state only. Reload resets this demonstration. Database behavior is verified
separately against isolated PGlite/native PostgreSQL fixtures, not hosted data.

Screenshots: artifacts/doodle-color/{mobile,tablet,desktop}-{LIGHT,DARK}-all-views.png.
Before/after legacy pairs use the same prefix plus -legacy-before.png and
-legacy-after.png. Automated pixel comparison against the renderer retrieved from
commit 3cb465a is exact in both themes at all three viewport sizes.

## Encoding and payload

Version 1 remains 512 bytes, 684 base64 characters, and theme-adaptive ink.
Version 2 is 2048 bytes, 2732 base64 characters: low nibble is the earlier pixel,
0 is erased, 1-8 follow the palette order below, 9-15 are rejected. Existing
monochrome payloads are never rewritten. No arbitrary RGB values or palettes enter
the protocol. Overwrite, erase, undo and moderation replay retain color indices.

Increment per bitmap: 1536 binary bytes and 2048 base64 characters. Twenty color
items add 40 KiB of uncompressed bitmap transport relative to twenty monochrome
items. Maximum replay is 17152 bytes versus 16896 (a one-byte color index added to
each of at most 256 stroke headers); at most 8192 points remain allowed. The maximum
valid tested JSON replay fits the existing 65536-byte SQL and 70000-byte HTTP caps.
No limits were raised except the version-specific packed-replay byte constraint.
Physical PostgreSQL/TOAST size and compressed network traffic are not measured.

## Fixed palette and visibility

Fill contrast uses current canvas surfaces #FFFFFF and #171717:

| Index | Name   | Hex     | Light   | Dark    |
| ----- | ------ | ------- | ------- | ------- |
| 1     | Black  | #000000 | 21.00:1 | 1.17:1  |
| 2     | White  | #FFFFFF | 1.00:1  | 17.93:1 |
| 3     | Red    | #CF5A53 | 4.01:1  | 4.47:1  |
| 4     | Orange | #B86B00 | 4.08:1  | 4.39:1  |
| 5     | Yellow | #E3C32E | 1.73:1  | 10.34:1 |
| 6     | Green  | #438B52 | 4.16:1  | 4.31:1  |
| 7     | Blue   | #4A7FC1 | 4.12:1  | 4.35:1  |
| 8     | Purple | #9A66CC | 4.08:1  | 4.39:1  |

Literal black, white and yellow cannot all provide strong fill contrast on both
surfaces. Where fill contrast is below 3:1, an inset theme-text-colored edge makes
the dot distinguishable without changing its outside radius or stored color.
Legacy dots never receive this treatment. Swatches use named buttons, visible
selection outlines/underlines and normal theme text, not color alone. This is not
a claim that arbitrary neighboring colors or artwork satisfy every WCAG criterion.
The edge treatment awaits product review with the palette.

## Candidate database migration

supabase/candidates/202610220001_doodle_indexed_color.sql

Adds immutable encoding_version (default 1) and private color_submissions (default
false). Replaces length validation with version-specific constraints and rejects
invalid nibbles. Version 2 replay is independently reconstructed in PostgreSQL and
must equal the submitted bitmap. Existing version-1 validator remains its original
branch. New versioned fingerprints prefix only v2 content; legacy hashes and
pending moderation fingerprints are preserved. The default v1 serializer changes
only by including its explicit version. Public replay remains still-only.

Existing authenticated owner checks, RLS, RPC ACLs, lifecycle locking, hourly
cooldown, seven-day deadline, reporting, appreciations, Hall selection and bounded
cleanup are retained. New private helpers are revoked from client/service roles.
No new public RPCs or credentials. Retries of already-accepted v2 submissions stay
idempotent even if color submissions are subsequently disabled.

## Deployment sequence (not authorized or executed)

1. Approve visual treatment, candidate SQL and proposed specification paragraph.
2. Perform the normal hosted migration/recovery preflight. Apply the candidate only
   after separate authorization; color_submissions remains false.
3. Deploy dual-format readers and capability-aware API with the application color
   flag absent/false. Verify production legacy rendering and moderator replay.
4. After reader acceptance, separately authorize enabling the database
   color_submissions setting and GLOBAL_DOODLE_COLOR_ENABLED=true for the composer.
   Enable database acceptance before exposing the new composer. Ordinary v1
   submissions remain accepted.
5. Existing open tabs without X-Doodle-Formats: 1,2 receive HTTP 409 rather than a
   v2 payload when a response contains color content. A reload upgrades the client;
   stale feed UI may show its existing generic unavailable/retry message. No old
   decoder is asked to interpret v2 data. The header grants no authorization.

Recovery: turn the application color composer flag off and disable new database
color submissions. Retain dual-format readers, schema, stored drawings and replay.
Do not deploy a pre-color-only reader or downgrade any published color records.
Use existing emergency publication controls if broader containment is necessary.
No destructive schema rollback is required or proposed.

## Validation

- Targeted codec, SQL, ingress, authorization and lifecycle coverage: 48 distinct
  passing tests across nine files after the two added acceptance cases.
- Six color browser tests pass at 390x844, 768x1024 and 1440x900 in Light/Dark.
  Covers named palette controls, keyboard/touch/mouse, overwrite, erase, undo,
  local SEND, mixed scopes, Hall, exact legacy pixels and moderator replay.
- All nine existing monochrome editor browser regressions pass, including
  captured gestures, cancellation, undo, clear, preview, local submission and
  reduced motion at the three reference sizes.
- Native PostgreSQL color run preserves the existing concurrency assertions:
  duplicate submissions/votes, cooldown races, Hall replacement, cleanup,
  deactivation/publication races, expiration under lock and restart idempotency.
  The stock Windows embedded-postgres forced shutdown failed twice at restart
  (shared memory still in use). All assertions passed with an ignored local copy
  using pg_ctl fast, waiting shutdown on the newly created fixture only. No tests
  were skipped; the shared harness shutdown behavior was not changed.
- Production build, TypeScript, targeted ESLint and formatting pass.
- Existing secret scan reports no repository/client-bundle secret exposure.
- Existing privileged-client-boundary checks pass.
- GitHub Foundation workflow is unchanged; it has not run for these uncommitted
  changes. Hosted migration and real-device touch testing remain future gates.

## Specification

Exact proposed replacement paragraph:
docs/proposals/MASTER_SPEC_v0.10_DOODLE_COLOR.md. This is a proposal, not a new frozen
specification. The remainder of Section 48A and unrelated requirements are intact.

## Changed-file inventory

- `docs/proposals/MASTER_SPEC_v0.10_DOODLE_COLOR.md`
- `docs/reviews/TASK_20_1_DOODLE_COLOR.md`
- `scripts/test-doodle-concurrency.mjs`
- `src/app/doodle/page.tsx`
- `src/app/review/doodle/color/page.tsx`
- `src/components/doodle/DoodleBitmap.tsx`
- `src/components/doodle/DoodleFeedPanel.tsx`
- `src/components/doodle/DoodlePublishing.tsx`
- `src/prototypes/doodle/ColorReview.tsx`
- `src/prototypes/doodle/DoodleCanvas.tsx`
- `src/prototypes/doodle/DoodleComposer.tsx`
- `src/prototypes/doodle/DoodleProductionReview.tsx`
- `src/prototypes/doodle/doodle.css`
- `src/prototypes/doodle/model.ts`
- `src/prototypes/doodle/paint.ts`
- `src/prototypes/doodle/palette.ts`
- `src/prototypes/doodle/review-frame.ts`
- `src/services/doodle/client.ts`
- `src/services/doodle/ingress.ts`
- `supabase/candidates/202610220001_doodle_indexed_color.sql`
- `tests/doodle-browser/color.spec.ts`
- `tests/integration/doodle-color.test.ts`
- `tests/security/doodle-ingress.test.ts`
- `tests/unit/doodle-color.test.ts`
