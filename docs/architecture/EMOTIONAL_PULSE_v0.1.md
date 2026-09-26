# Emotional Pulse & Feel Your Network v0.1

Task #5.2, application version 0.5.2. Master Product Specification v0.2
remains authoritative. This implementation is a local simulation.
Task #5.4 (0.5.4) adds the approved Curious vocabulary and green definition;
the vocabulary-driven fixture now includes active Curious submissions.

## Model and lifecycle

`src/types/emotional-pulse.ts` defines `EmotionalPulse`: `id`, `atomId`,
`emotion`, `createdAt`, `expiresAt`. Timestamps are epoch milliseconds.
An active record satisfies `createdAt <= now < expiresAt`, with expiration
exactly 24 hours after creation. `MockPulseService` keeps only the latest
record per Atom; a new submission replaces the previous one without retaining
an emotional history. Sending changes only the session owner's state.

The composer requires an explicit selection before sending. It collects no
explanation, diagnosis, inferred cause, prediction or interpretation. All eight
states have equal interaction and lifecycle rules; there are no scores or ranks.
The centralized `emotions.ts` configuration defines names, accessible labels,
colors and visual parameters: Joy/gold, Calm/teal, Excited/orange, Curious/green, Sad/blue,
Anxious/pink, Angry/red, Afraid/purple.

The injectable service clock supports deterministic tests. The UI schedules the
next expiration deadline and refreshes age labels each minute, with focus and
visibility checks after suspension. Expired states disappear from context,
palettes and summary calculations. In Feel mode inactive Atoms are neutral;
structural mode restores the existing non-emotional network styling.

## Service and privacy boundary

`ParticipationExperience` composes the Pulse service and supplies already
filtered active records to Living Atom. Emotional state is not added to
`PublicAtom`, `GraphNode`, or unrestricted public Atom serialization.
`PulseService.visible` binds this mock viewer to its session owner and filters
records through actual connected graph membership and expiry. The selected
Atom context consumes that same filtered collection. Email, authentication
identity, preferences and precise location are not needed by the Pulse system.

This client-side mock gate is not production authorization. Fixture records
are synthetic and shipped in the client bundle. There is no production storage,
authentication, API or notification delivery. Refreshing resets local changes.

`data/mock/emotional-pulses.ts` authors synthetic submissions separately from
the unchanged graph fixture. Given the same graph and epoch, the records and
distribution are identical: some active, some expired, others absent. Index-based
fixture construction is not inference about a person's real emotional state.
The starting connected component contains 640 Atoms and 128 active submissions.

## Propagation and feedback

PULSE opens the native emotion dialog. SEND PULSE stores the selected state,
returns to the sender's perspective if necessary, and starts outgoing traversal.
The existing breadth-first distances and Bond edges determine illumination;
the selected color travels along actual paths. Recipients briefly illuminate
and then return to their own representation without any state mutation.

Pulse and Feel mode use the complete reachable component rather than the normal
eight-degree structural horizon. Distant layers remain aggregates; this does
not create a DOM component per Atom. Completion reports actual connected reach
(explicitly including the sender), known cities, regions and countries from
graph metadata. Unknown cities are not invented. Disconnected components are
excluded until a simulated confirmed Bond connects them.

Pulse presentation stops 15 seconds after sending. Graph-degree steps use at most
600 ms and shorten for deeper networks to fit full traversal within that window.
Feel Your Network stays on until the user clicks its button again, independently
of Pulse. Toggling the view does not clear the 24-hour emotional state.
Traversal time is measured from its start, so delayed
timers catch up. Ambient motion, Pause/Resume and reduced-motion preferences
remain independent of graph propagation. Changing perspective cancels traversal
but preserves the sender's active state.

## Feel Your Network and aggregation

The toggle emphasizes current visible states within the viewer's component.
Nearby people retain individual colors; medium and far representations use the
existing particle clouds and regional constellations. Precomputed member palettes
mix emotional colors with neutral particles. The renderer samples those palettes
without graph traversal or per-frame React state updates.

The compact summary shows active submissions and total connected coverage.
Results percentages use active visible submissions only, never all connected
Atoms. Empty distributions display zero rather than invalid percentages.
Regional totals use coarse graph metadata and describe participating connected
people, not the population of a geographic region. Regional clouds display
active counts. No happiness ranking or regional emotional judgment is made.

## Accessibility and mobile

Native labelled radio controls, visible focus, a modal dialog, Escape/Cancel,
and an initially disabled Send button support keyboard and screen-reader use.
Text labels accompany color in the composer, summary, owner state and selected
context; Explore Atoms also exposes active state text in Feel mode. The toggle
announces its pressed state. Reduced motion preserves degree-based information
without requiring animated particle travel. Network emotion results open automatically
in a bounded, scrollable panel with a persistent close button. The network and
primary actions remain accessible on mobile; the existing context retains its
bounded height and accessible View their network action.

## Future integration boundaries (not implemented)

Supabase persistence should enforce authenticated ownership, allowed emotion
values, server timestamps, a unique current record per Atom, and replacement
atomically. RLS or an authorized server query must enforce connected-network
visibility; expiry must be enforced on reads, independently of eventual cleanup.
Do not move Pulse state into unrestricted public Atom responses. Minimize history
retention and re-evaluate visibility when graph membership changes.

The existing `PulsePresentation.direction` distinguishes `outgoing` and
`returning` as presentation intents. A future event envelope can reference the
canonical Pulse ID, originating Atom and optional received-Pulse correlation.
A Return Pulse requires the recipient to select their own emotion and create
their own record. It must never copy the sender's emotion automatically.
No Return Pulse action or communication is implemented here.

Future NotificationService methods may include `sendPulseReachedNotification()`
and `sendPulseActivitySummary()`. These must consume authorized events, honor
private preferences and deduplication/rate limits, and keep delivery identity
outside graph/render data. Possible neutral copy: “A Pulse reached your Atom.”
or “Your network is active right now.” No messages or emails are sent.

## Verification

Unit tests cover all eight states, exact expiry, replacement, deterministic
fixtures, visibility, active-only percentages, regional totals, graph traversal,
neutral/mixed palettes and public serialization. Browser coverage exercises the
selector, every emotional color, full reach, Feel zoom modes, context omissions
and mounted expiry with controlled time, alongside existing regressions.
Captures are generated at 390 × 844, 768 × 1024 and 1440 × 900 under ignored
`test-results/`. Physical-device and hosted-preview acceptance remain separate.

FEEL YOUR NETWORK automatically opens NETWORK EMOTION RESULTS. An indeterminate measuring indicator precedes the local connected-network calculation; results refresh when visible Pulse data changes. The scrollable results panel remains open when Feel Your Network is toggled off until its close button is pressed. Closing returns keyboard focus to FEEL YOUR NETWORK.
