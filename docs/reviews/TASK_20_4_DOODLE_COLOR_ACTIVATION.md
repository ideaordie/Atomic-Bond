# Task 20.4 — GLOBAL DOODLE color activation

Release: v0.20.1. Authorized Stage 2 activation; no application source or migration changes.

## Baseline and pre-activation evidence

- Production and remote main: 73dab4ac1fe8538843524f6d83733ed89099dd15 (v0.20.0); clean local tree before release preparation. Vercel Ready.
- Foundation checks #103 passed: 517 tests / 89 files; verify job 15m18s. General, persistence and authenticated browser suites are required by the unchanged workflow.
- All 32 hosted migration versions match the repository, through 202610220001_doodle_indexed_color.
- Read-only hosted checks on 2026-10-19 at 19:42 UTC: color_submissions=false; public_access=true; submissions_paused=false. Vercel color flag absent in project and shared configuration.
- All 17 drawings remain version 1. Aggregate artwork/record and cooldown digests match the Stage 1 snapshots. Legacy fingerprints remain unchanged.
- Hosted version 2 validation accepts valid 2048-byte data and rejects wrong sizes and invalid high/low palette nibbles. All 13 inspected function definitions match Stage 1; private helper execution remains denied to client roles.
- All nine private Doodle tables retain RLS and postgres-only table grants. Five-minute Doodle cleanup is active; latest inspected run succeeded at 19:40 UTC. No other schedule is modified.

## Activation and recovery operations

Use the existing trusted operator workflow, bounded by lock_timeout=5s and statement_timeout=10s. Assert exactly one singleton settings row has color disabled, public access enabled and submissions unpaused, then update only color_submissions=true. Save Vercel Production GLOBAL_DOODLE_COLOR_ENABLED=true and deploy this release. Other feature settings remain unchanged.

Recovery: set color_submissions=false and GLOBAL_DOODLE_COLOR_ENABLED=false, redeploy compatible readers if necessary. Preserve all version 2 drawings, schema, moderation fingerprints, replay and lifecycle records. Do not revert to a monochrome-only reader or destructively roll back the migration. Successful request retries remain idempotent when new color writes are disabled.

## Specification

Freeze docs/MASTER_SPEC_v0.10.md with exactly the reviewed Section 48A opening paragraph and necessary version metadata. Preserve v0.9 and every earlier specification byte-for-byte. AGENTS.md and Build Blueprint change authority references only. No EVOLVE requirement changes.

## Validation and limitations

- Focused codec, color integration, ingress and route security: 19/19 passed. TypeScript passed. Secret scan: 676 repository files and 57 browser bundles, no leaks.
- Reuse accepted Stage 1 mixed-format, responsive Light/Dark, replay/moderation, legacy pixel-comparison and PostgreSQL concurrency evidence because application/database definitions are unchanged. The publication commit must also pass the unchanged full Foundation workflow.
- No public production test drawing, fabricated appreciation or forced Hall promotion is authorized or performed. Actual participant publication and physical-device color appearance remain manual follow-up checks. Hosted read-only validation and local synthetic end-to-end tests are not described as a real public color submission.
- Old open tabs may require reload. Obsolete deployment URLs are not supported readers after activation. Recovery must retain dual-format readers.
- CI has upstream Node-action deprecation and runner-image transition notices; no workflow changes are included.

## Release inventory

- AGENTS.md
- docs/BUILD_BLUEPRINT_v0.1.md
- docs/CHANGELOG.md
- docs/MASTER_SPEC_v0.10.md
- docs/reviews/TASK_20_4_DOODLE_COLOR_ACTIVATION.md
- package.json

Deployment, final CI status and post-activation verification are reported at publication completion; they are not asserted by this pre-publication record.
