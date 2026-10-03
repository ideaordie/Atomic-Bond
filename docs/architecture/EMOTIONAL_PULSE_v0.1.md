# Living Emotional Network — Task #8.1 / v0.8.1

Master Specification v0.2 remains authoritative, with the explicitly approved
interaction revision. The v0.8.0 tag and baseline report remain historical.

## Default experience and model

Authenticated MY ATOM automatically displays the latest authorized non-expired
Emotional Pulse for its connected network. There is no Feel Your Network toggle.
The eight centralized EmotionDefinitions remain Joy/gold, Calm/teal,
Excited/orange, Curious/green, Sad/blue, Anxious/pink, Angry/red and Afraid/purple.
Absent or expired states use scientific blue-gray. Dimensional sphere shading,
lighting, depth and motion remain; emotional materials crossfade over 450ms.
Reduced motion applies changes immediately.

Pulse is explicitly selected, never inferred, scored or ranked. One current
state replaces the prior state and expires after 24 hours. The server timestamps
and enforces persistent expiry; the client schedules exact expiry deadlines,
minute age updates, and focus/visibility reconciliation. There is no emotional
history or new database schema. MockPulseService and deterministic eight-state
fixtures remain available only in explicit development/test mode.

PULSE opens the existing composer. Successful persistence immediately updates
own state and starts graph-distance propagation lasting approximately six seconds.
The presentation window and degree-step timing are both scaled to 40% of the
former 15-second animation (600ms base steps become 240ms). Deep networks retain
adaptive steps so the final BFS layer finishes within the window, rather than
cutting off the previous traversal. Reduced-motion presentation and the separate
24-hour persisted state are unchanged. Temporary
propagation can illuminate recipients but never changes their stored emotions.
Stopping propagation, changing perspective, or collapsing information does not
clear the sender's 24-hour state. Selected context shows authorized active state
and age, omitting the row for absent/expired state.

## Your Network Now

A compact informational disclosure is collapsed initially. It shows active
Pulses and connected Atoms (including the viewer). Expanded details show all
eight counts/percentages, known city/region/country reach, active regional counts
and last-refresh age. Percentages divide by active visible submissions only.
Zero yields zero percentages and a neutral message. One-Atom networks are valid;
unknown geography is not invented. These are voluntary submissions within the
connected network, never population sentiment or an emotional ranking.

The same authorized snapshot drives colors, context and statistics. Local sends
and expiration update immediately. Background refreshes retain the results DOM
and scroll position. Expansion does not trigger an independent graph request.
The disclosure exposes aria-expanded/aria-controls; close and Escape restore
focus. The bounded scroll area leaves the graph and primary actions accessible.
Text labels accompany colors throughout.

## Privacy and authorization

PublicAtom and GraphNode remain emotion-free. Explicit public views, including
an owner's own public URL, receive no Pulse query/results. LivingAtom additionally
ignores emotional inputs when ownerMode is false. Production retrieval uses
visibleOwnerPulses / refreshOwnerNetwork and existing requireOwner gates. The
Supabase RPC derives the viewer from verified ownership, never the visual center.
Recenter does not change the authorization context. Confirmed reach is intersected
again locally; disconnected and expired submissions are removed. No global
emotional-state feed, table grants, RLS weakening or browser Auth token is added.

## Bounded reconciliation instead of browser Realtime

Current application tables are default-deny, and Auth sessions are HttpOnly.
A browser Postgres Changes subscription cannot read private Pulse tables with
the existing grants/session boundary. Task #8.1 expressly permits a safe bounded
refresh fallback. This implementation keeps existing owner-authorized server
operations rather than introducing a global subscription or exposing tokens.

Visible/online owners refresh Pulse state every 30 seconds and topology every
60 seconds. A known pending invitation temporarily checks topology every ten
seconds until its expiration or a new direct Bond arrives. Reloading loses this
optimization and returns to the normal minute cadence. Focus, visibility return
and connectivity restoration request full reconciliation, with a five-second
burst guard and one request in flight. Failures follow the same bounded retry
cadence; hidden/offline tabs do not poll. This is eventual reconciliation, not
instant delivery: another participant's Pulse may take roughly 30 seconds,
and new topology roughly one minute, plus request time, to appear.

A full reconciliation replaces graph and authorized state together. Pulse-only
responses replace visible state (not append), removing lost authorization.
A send completed while a refresh was in flight wins over that older response.
On failure/offline, emotional data is cleared and explicitly marked unavailable;
the last confirmed structural graph remains. Reconnection restores authorized
state. No synthetic fallback is possible. Existing server/database ownership and
expiry checks apply to every request.

## Performance and limits

Topology and state are separate: unchanged graph snapshots retain object identity;
sending/updating Pulse does not rebuild layout, move the camera or reset ambient
motion. Full owner scene membership is stable during both active state and
outgoing propagation. Distant Atoms retain the existing progressive aggregates.
Color interpolation runs only during the short transition, outside React state.
There is no per-second React graph recomputation or full-network request.

The early-stage RPC still returns at most 5,000 graph nodes; the server fails
clearly above that cap. Pulse retrieval still computes authorized reach in SQL.
This bounded fallback is not a claim of unlimited scale. A future authorized
invalidation channel could replace polling after a separately reviewed RLS/session
design; periodic reconciliation would still be needed for missed events/expiry.

## Verification

The local suites cover all eight states, deterministic fixtures, exact expiry,
replacement, public exclusion, connected membership changes, recenter authorization,
neutral palettes, material transition, request cadence/coalescing, persistent
Auth/QR/Bond flow, and the disclosure's responsive scrolling/focus behavior.
Local verification requires no live email, production data mutation or migration.
The owner approved v0.8.1 product review and publication separately; deployment
uses the existing GitHub/Vercel workflow without hosted schema changes.

### Task #8.1 local verification record

Verified on Windows on 2026-09-27: production build, formatting, lint,
TypeScript, 157 unit/graph/service/security/integration tests, native PostgreSQL
concurrency/restart checks, and 90 browser cases (69 mock, 18 Auth/QR, 3 public
persistence). Additional targeted runs refreshed visual captures and exercised
asynchronous reconciliation and settled canvas expiry without weakening checks.

The 1,000-Atom deterministic fixture represents its 640 connected Atoms using
191 glyphs at network scale. Sixty state-only calculation/paint-map updates
measured 1.71ms median and 3.14ms p95 locally. These are host microbenchmarks,
not physical-device or hosted latency claims. Scene creation is outside that
measurement because state-only updates retain the existing scene.

Reference viewports: 390 × 844, 768 × 1024 and 1440 × 900. Captures cover neutral,
active, owner/selected state, disclosure, propagation, expiry, and isolated
persistent small-network/public views. Local review captures are in ignored
`test-results/` and `artifacts/task81-review/`. Initial checks found an inherited
section-padding hit area and a reconnect burst-guard edge case; both were fixed.
Paused-clock browser tests install the clock before application timers are
created, then explicitly wait for real server work and scheduled canvas paints. No physical-device or hosted Task #8.1 acceptance is claimed.
