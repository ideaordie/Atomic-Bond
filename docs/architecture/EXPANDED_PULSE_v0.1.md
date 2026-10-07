# Expanded Pulse — Task #10.4 / v0.11.0

Implementation under approved Master Spec v0.3. Frozen v0.2 is unchanged.
Publication approved after local product review; use the staged rollout below.

## Model and UI

HOW ARE YOU RIGHT NOW? presents FEELING, ENERGY and VIBE, eight choices per tab.
Exactly one current state exists across categories. Stable lowercase snake_case
identifiers live in `src/types/emotional-pulse.ts`; display labels, colors and
derived categories live in `src/living-atom/pulse/emotions.ts`. Category is never
independently persisted or submitted. No free text, clinical inference, targeting,
scores, notifications, combinations or emotional history is introduced.

Tabs support arrows/Home/End and keyboard radio choices. The unsent preview uses
the existing Living Atom paintCore material with no animation loop. Selection and
category changes never affect persistence, graph or aggregates. SEND PULSE uses
the existing owner service; Cancel discards selection. Overview omits zero rows;
selected Atom details show text and age, optionally category. Text stays dark and
selection outlines remain independent of color. The palette is recorded in Master
Spec v0.3 section 16. No state-specific motion is added: existing ambient motion,
six-second graph propagation and reduced motion remain unchanged.

## Legacy compatibility

JOY storage and its `joy` wire value explicitly map to `joyful` / Joyful. CALM,
EXCITED, CURIOUS, SAD and ANXIOUS preserve meaning. ANGRY and AFRAID retain their
original labels/colors as read-only legacy states until natural expiry or owner
replacement. They are not selectable or newly writable after cutover. No row or
timestamp is rewritten, no lifetime extended, and no history is displayed.
The wire field remains `emotion`; the application distinguishes readable values
from the 24 selectable states. Categories are catalog metadata, not another Pulse.

## Migrations and security

`202610080001_expanded_pulse_values.sql` adds 18 enum values and guards the existing
inner writer to accept only the original eight states. Commit it before the next
migration. `202610080002_expanded_pulse_writes.sql` changes that allowlist to the
24 approved storage values. Storage has 26 compatible values, including two retired
states; the UI has exactly 24 choices. No enum rebuild or row rewrite is needed.

The public RPC signature, lifecycle lock, owner authorization, SECURITY DEFINER
search_path, ownership/grants, upsert, unique atom_id, exact 24-hour CHECK, RLS and
connected-network visibility are unchanged. No new table, credential, category
column or direct grant is added. Deactivated/deleted/expired/inaccessible Pulses
stay excluded. Preview is never an authoritative state. No PWA private caching.

## Hosted rollout gate

Repeat aggregate audit before deployment. The 2026-10-07 snapshot found 16 stored
Pulses and four unexpired (JOY 1, EXCITED 1, CURIOUS 2); ANGRY/AFRAID were expired.
This snapshot must not be assumed current during cutover.

Apply only the compatibility migration first; deploy compatible application reads
before enabling expanded writes. Do not blindly push both pending migrations
before a compatible build is healthy. During staged deployment new sends fail
safely without replacing an existing Pulse until the second migration is applied.
Use a controlled short window. Old open clients require refresh; do not mistake
stale eight-state client behavior for data loss. Verify a fresh owner session,
legacy active reads, six retained states and cross-category replacement before
declaring release acceptance. No legacy Pulse may be discarded for convenience.

## Verification / remaining gates

Tests cover exact catalog, category mapping, legacy read/write separation,
replacement, expiry, migration row/timestamp preservation, RLS and grants.
Existing PostgreSQL lifecycle/concurrency tests preserve Pulse race coverage.
Browser tests cover all 24 actual Canvas previews at three reference sizes,
keyboard navigation, cancel without persistence, owner RPC/reload, nonzero-only
overview, propagation and reduced motion. Standalone/PWA uses the same composer.

Local product review and publication are approved. Unique hex values are not
proof of color-vision distinguishability.
Physical PWA review and color-vision simulation are not claimed by automated
browser results. No production participants or real emails are used locally.
