# Task 20.2 - Global Doodle color production preflight

Status: Prepared for publication approval, NOT applied or deployed. Color remains OFF.
Inspection date: 2026-10-19. Frozen Master Spec v0.9 remains unchanged.

## Verified baseline and hosted inspection

- HEAD, origin/main and a fresh remote main lookup agree on
  3cb465a1f3f43ead80058f7929a5a770b8beb64f (v0.19.1).
- Vercel production overview shows Ready, main, that exact commit and release title.
  Deployment: https://vercel.com/ideaordie/atomic-bond/2N2EPjJWSuaVunCfV3YMiNNrpqHm
- Working tree contains the approved local color implementation and this preflight;
  it is deliberately uncommitted, not described as clean.
- Supabase dashboard lists the same 31 migration versions as the repository,
  through 202610210001_evolve. This verifies version/name synchronization; it is not
  a byte-for-byte audit of all historical stored migration statements.
- Daily physical backup available: 2026-10-19 12:24:56 UTC. Dashboard also lists the
  preceding seven daily backups. No restore was attempted. Backup restoration can
  lose subsequent writes and does not recover deleted Storage objects. Doodle
  bytea content resides in PostgreSQL. No zero-data-loss/PITR claim is made.
- Aggregate read-only SQL at 18:50:46 UTC found 17 Doodles, all 512-byte bitmaps,
  no encoding_version column, RLS enabled, and authenticated direct table SELECT
  denied. Public Doodle access remains true; submissions_paused remains false.
- The eight existing functions replaced by the candidate have definition hashes
  identical to the local baseline fixture. The unchanged request gateway also
  matches. Direct submission/replay/moderation functions remain postgres-only;
  the verified gateway permits authenticated execution and denies anonymous execution.
- Existing atomic-bond-doodle-cleanup job remains active on */5 * * * *.
  Its three most recent executions at 18:40, 18:45 and 18:50 UTC succeeded
  in approximately 25-31 ms. No unrelated schedule was changed.

Only aggregate counts, schema/function metadata and backup/schedule metadata were
inspected. No participant identity, artwork bytes, invitations or secrets were
retrieved. No production drawings were created and no cleanup was manually run.

## Migration correction and risk

Candidate identifier: **202610220001_doodle_indexed_color**.

The previous local candidate number 202610200001 collided with the already applied
bond_invitation_24_hours migration. It has been renamed and test/document references
updated. Historical migration files are untouched. Candidate remains outside the
hosted migration chain in supabase/candidates until publication is authorized.

The only SQL change during this preflight adds transaction-local lock_timeout=5s
and statement_timeout=30s. An unavailable lock or failed validation rolls back the
transaction; do not bypass a timeout by force during publication.

Risk: moderate, because database validation, immutable drawing format and moderation
fingerprints change. No ownership, RLS, public RPC signature, lifecycle, cooldown,
expiration, appreciation, reporting, cleanup or scheduling rule changes. Existing
records are not UPDATEd or DELETEd; existing artwork/replay bytes and deadlines are
preserved. DDL validates the current table and briefly needs an exclusive lock.

The migration adds default version 1 and a false color_submissions setting. It
replaces eight existing functions using CREATE OR REPLACE, preserves their ACLs,
and creates four revoked private helpers. Version 2 validates exactly 2048 bytes,
indices 0-8, bounded replay, and exact reconstruction. Version 1 fingerprints stay
identical; version 2 fingerprints include an encoding prefix. The encoding version
is immutable. Existing v2 retry receipts remain valid if new color writes are disabled.

## Exact publication and activation sequence

All steps below require the next authorization; none were performed here.

1. Recheck HEAD/deployed commit, hosted migration history, backup availability and
   function hashes immediately before publication. Stop on unexpected differences.
   Capture pre-change aggregate constraints/grants, artwork/replay/deadline checksums
   and cleanup definitions through trusted operator tooling. Concurrent legitimate
   submissions or cleanup must be distinguished from migration-induced changes.
2. Promote the reviewed candidate to supabase/migrations/202610220001_doodle_indexed_color.sql
   without changing its approved SQL. Freeze the Section 48A amendment only if the
   publication authorization explicitly includes that freeze. Prepare the approved
   release commit and retain the default-off configuration.
3. Publish dual-format application readers FIRST with GLOBAL_DOODLE_COLOR_ENABLED
   absent or false. This application remains compatible with the old database:
   absent drawing versions default to 1. Verify Vercel Ready, production domain,
   Foundation checks, old drawings and authorized moderator views before continuing.
4. Apply exactly the approved migration in one transaction. color_submissions stays
   false. Verify version 1 assignments, unchanged artwork/replay bytes and deadlines,
   grants/RLS, helper revocations, gateway authorization, legacy fingerprints and
   cleanup definitions. Do not issue public test drawings.
5. Verify read-only hosted legacy WORLD/MY NETWORK/Hall/moderation operations under
   existing authorized sessions. Reconfirm live domain routes to the new deployment.
   Test a stale client without the capability header against the new endpoint using
   an explicitly authorized controlled color fixture only when one is approved.
6. Color activation is a separate gate: obtain explicit permission for the specific
   production drawing/owner needed for an end-to-end publication check. Never invent
   an owner, bypass their hourly cooldown, fabricate appreciations or force a Hall
   promotion. Until those acceptance operations are authorized, keep both color
   controls OFF. Local controlled-time tests provide the existing Hall evidence;
   hosted color Hall acceptance is not yet claimed.
7. Once reader compatibility and authorized hosted acceptance arrangements pass,
   enable private.doodle_settings.color_submissions via the existing trusted
   operator workflow; then set GLOBAL_DOODLE_COLOR_ENABLED=true and deploy that
   configuration. No new credentials or public administration RPC are required.
   Retain all existing GLOBAL_DOODLE_ENABLED/CONTROLLED_ACCESS values and other gates.
8. Verify the specifically authorized publication returns version 2, its still view
   and moderator replay agree, feeds remain mixed-format compatible, and the
   original publication deadline/cooldown are authoritative. Stop new color writes
   on any discrepancy. Hall promotion continues to follow its normal policy.

## Overlap and stale clients

During migration/deployment overlap all new color writes remain database-disabled,
so old instances see only v1 payloads. New readers accept explicit v1/v2; old v1
responses without a version are still supported. New clients advertise
X-Doodle-Formats: 1,2. New API instances reject color-containing responses to old
clients with HTTP 409 and a reload instruction, before returning bitmap content.
The header is capability negotiation, not an authorization grant.

A truly old backend does not contain that guard. Therefore enabling color before
production routing has switched and old in-flight responses have drained is not
approved. Old deployment URLs must not be treated as supported color readers.
Even there, the original strict 684-character/512-byte decoder rejects v2 rather
than reinterpreting it; the resulting unavailable/error view is a compatibility
limitation, not a valid rendering. Do not roll back to those old deployments once
color drawings exist. A stale feed tab may display its generic retry message until
reloaded. The rollout does not promise automatic hot-upgrading of every open tab.

## Recovery preserving all drawings

- If migration fails, transaction rollback leaves old schema/data intact and the
  dual-reader application still operates with v1. Investigate before retrying.
- If application publication fails before migration, leave the migration unapplied
  and color disabled. Existing production v0.19.1 remains the baseline.
- After any v2 publication, disable only new color writes and the color composer;
  retain the compatible reader release, version columns, palette, replay and all
  drawings. Existing successful requests may still be retried idempotently.
- Use a forward correction or the known dual-reader disabled release, not schema
  deletion, payload conversion or whole-database restoration. Current lifecycle,
  seven-day expiry, moderation and cleanup continue normally.
- A physical restore is a last-resort operator decision with accepted data-loss
  implications; it was not tested or authorized here.

## Acceptance evidence and limitations

Task 20.1 evidence is retained: 48 targeted tests, six mixed-format responsive
browser checks, nine existing monochrome browser regressions, exact legacy pixel
comparisons in both themes at all three sizes, build, TypeScript, lint, formatting,
client-boundary and secret checks. Application source did not change in Task 20.2,
so its successful production build is reused rather than rebuilding identical code.

Final Task 20.2 runs recheck the renamed/bounded candidate, codecs and ingress,
responsive browser tests, native PostgreSQL concurrency, static checks and secrets.
Results: 16 codec/database/ingress tests passed; 23 color, legacy production and
seven-day integration tests passed; all six responsive Light/Dark browser checks
passed. TypeScript and targeted ESLint passed. Secret scanning found no leaks in
675 repository files and 57 browser bundles.

Historical database fixtures now explicitly exclude the color migration until
requested. Color tests and the concurrency runner load the same SQL from either
its candidate or eventual migration location. This preserves historical assertions
while permitting release promotion; no assertions or security tests were removed.
The same 23 integration tests also passed with the candidate temporarily placed in
its future local migration location (33.60 seconds), then restored to candidates.
An initial sandbox run was blocked by Windows child-process EPERM before tests
started; the authorized rerun passed without changing assertions.
Native concurrency uses the documented ignored Windows fixture copy with pg_ctl
waiting shutdown; all assertions, including restart persistence, remain enabled.
The normal harness force-kill restart issue is not fixed by this feature.

Hosted v2 constraints and behavior cannot be accepted before the authorized migration.
Physical-device touch/color appearance, real post-release color publication, and
Foundation checks on the eventual commit remain future acceptance steps. No
production artwork was created merely to fill those gaps. Backup availability is
verified; restore success and zero-loss recovery are not asserted.

## Specification and configuration

Exact Section 48A-only proposal: docs/proposals/MASTER_SPEC_v0.10_DOODLE_COLOR.md.
It replaces only the opening paragraph and required future version metadata;
Master Spec v0.9 and authority references stay unchanged in this task.

Required controls: private.doodle_settings.color_submissions=false (migration
initial value) and GLOBAL_DOODLE_COLOR_ENABLED absent/false (application default).
No production configuration was changed. This is separate from existing Doodle
participation/submission-pause controls.

## Exact changed-file inventory

- `docs/proposals/MASTER_SPEC_v0.10_DOODLE_COLOR.md`
- `docs/reviews/TASK_20_1_DOODLE_COLOR.md`
- `docs/reviews/TASK_20_2_DOODLE_COLOR_PREFLIGHT.md`
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
- `tests/helpers/doodle-fixture.mjs`
- `tests/integration/doodle-color.test.ts`
- `tests/security/doodle-ingress.test.ts`
- `tests/unit/doodle-color.test.ts`

Candidate SHA-256: `c8c79475951c8414817df0ed9e103603f4dc1063463fb13bef6269f69b18215f`.
