# Foundation architecture

This document records minor implementation decisions within Build Blueprint
v0.1. It does not replace or revise either governing specification.

## Module boundaries

| Directory                                                             | Responsibility                                             |
| --------------------------------------------------------------------- | ---------------------------------------------------------- |
| `src/app`                                                             | Next.js App Router, layout and minimal landing page        |
| `src/components`                                                      | Reusable presentation components                           |
| `src/living-atom/{renderer,layout,animation,interaction,pulse,types}` | Reserved visualization subsystem                           |
| `src/graph/{traversal,degrees,propagation,bridges,metrics}`           | Reserved deterministic graph algorithms                    |
| `src/services/{atoms,bonds,invitations,locations,notifications}`      | Reserved application services                              |
| `src/data/mock`                                                       | Synthetic public graph fixture                             |
| `src/data/supabase`                                                   | Reserved future data adapter                               |
| `src/types`                                                           | Shared framework-independent graph contract                |
| `src/utils`                                                           | Reserved shared utilities                                  |
| `supabase/{migrations,functions,policies,seed,tests}`                 | Directory placeholders only; no infrastructure initialized |
| `tests/{unit,integration,graph,security,e2e}`                         | Separated test categories                                  |
| `public/{assets,icons,references}`                                    | Reserved static assets                                     |

Empty directories use `.gitkeep`. The blueprint's `app/page` is implemented as
the standard Next.js `app/page.tsx`. The `atom`, `bond`, `explore`, and `share`
folders are placeholders, not active routes. Future public Atom routing must
follow the blueprint's `/a/[publicId]` contract when that work is approved.
No Supabase package, credentials, migrations, policies, or runtime calls exist.

## Tooling

Next.js App Router, React and strict TypeScript form the application shell.
ESLint uses Next.js rules and Prettier compatibility; Prettier handles formatting.
Vitest runs pure graph tests in Node. Playwright checks the production application
in Chromium at the three required viewport sizes. GitHub Actions repeats the
local checks with a frozen dependency lockfile. No CSS framework or external font
service is needed for the minimal landing page.

TypeScript 6.0.3 and ESLint 9.39.5 are pinned to the compatibility range of
Next.js's current lint plugins. ESLint 10 failed with the bundled React plugin;
TypeScript 7 exceeded the TypeScript ESLint peer range. ESLint 9 is deprecated
upstream and should be upgraded when the Next.js plugin set supports ESLint 10.
Only `unrs-resolver`'s native binding setup is allowed to run an installation
script through `pnpm-workspace.yaml`.

Next.js's automatic agent-rule generation is disabled with `agentRules: false`
so starting the development server cannot append framework instructions to the
owner-maintained `AGENTS.md`.

## Shared graph contract

`GraphNode` and `GraphEdge` live in `src/types/graph.ts`. Edges represent undirected,
confirmed connections in a public projection, not authoritative Bond records.
`degree` means incident edge count; distance from a selected Atom is a separate
future traversal result. This resolves an unspecified field meaning without
changing the blueprint's contract. Metadata has explicit public fields rather
than an arbitrary object that could silently carry private identity information.

Mock IDs are explicitly prefixed `mock-`. Every mock node and edge is marked
synthetic. This data must never become authoritative production relationships.
The renderer and graph algorithms should consume `GraphData`, not mock-specific
types or backend records.

## Permanent mock fixture v1

`generateMockGraph()` returns a fresh graph each time. No random source, clock,
environment setting, or external service affects output. Topology, IDs, ordering,
and timestamps are fixed. The fixture is intentionally not configurable; changing
its contract requires an explicit fixture version and regression update.

All indices below are zero-based; `mockAtomId(index)` produces the corresponding
node ID. Public IDs are one-based, padded to eight digits.

| Indices | Structure                                                        |
| ------- | ---------------------------------------------------------------- |
| 0–179   | Dense ring lattice, five forward neighbors per node              |
| 180–359 | Dense ring lattice, five forward neighbors per node              |
| 360–539 | Dense ring lattice, five forward neighbors per node              |
| 540–719 | Disconnected dense ring lattice                                  |
| 720–899 | Disconnected sparse ring lattice, two forward neighbors per node |
| 900–999 | Linear tail attached to node 0                                   |

- Total: 1,000 nodes and 4,062 undirected edges.
- Components: 640, 180, and 180 nodes.
- Intercluster Bridges: 0–180 and 180–360.
- Tail Bridges: 0–900 and every consecutive pair through 999.
- Known shortest distances: 0→360 = 2; 0→999 = 100; 900→999 = 99.
- Nodes 540 and 720 are unreachable from node 0.
- Five coarse regions/countries: Ontario/CA, Scotland/GB, Kanto/JP,
  Gauteng/ZA, and Victoria/AU. No precise coordinates or private data exist.

Tests independently calculate adjacency, component sizes, shortest distances,
and reachability after edge removal. A SHA-256 regression snapshot locks all
serialized fixture fields and ordering. These traversal helpers remain test-only;
production graph services are outside Foundation Task #1.
