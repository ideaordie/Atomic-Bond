# Atomic Bond

**See how connected we already are.**

Version 0.5.3 groups Create Bond, Pulse and Feel Your Network in a responsive
action dock. Local Emotional Pulse, public identity context, optional X profiles,
Atom onboarding and simulated Bond creation are available in the
Living Atom Spatial Experience v0.2 at `/explore`: a
Canvas 2D human network with perspective depth, irregular local orbits, regional
particle clouds and graph-aware Pulse. Select someone to inspect their connection,
then choose View their network. It uses the unchanged deterministic synthetic
fixture as its starting point. Create Bond opens the development participation
loop: canonical home region, private email, simulated verification, explicit
confirmation, and deterministic network growth. No production accounts, Bonds,
email delivery, or database exist. Participation data resets on refresh.

## Authority

Read [AGENTS.md](AGENTS.md), the frozen
[Master Product Specification v0.2](docs/MASTER_SPEC_v0.2.md), and the
[Build Blueprint](docs/BUILD_BLUEPRINT_v0.1.md) before substantial changes.
Specification revisions require explicit approval. Material blueprint changes
must be proposed before implementation.

## Local setup

Install Node.js 24 LTS and pnpm 11.25.0. The exact package manager version is
recorded in `package.json`; dependency versions are locked in `pnpm-lock.yaml`.

```sh
pnpm install --frozen-lockfile
pnpm test:e2e:install
pnpm dev
```

Open http://127.0.0.1:3000. No environment variables or service credentials are
needed. On Linux, install browser system dependencies with
`pnpm exec playwright install --with-deps chromium`.

Open `/explore` or follow the landing page's Living Atom link. Select an Atom
on the canvas or through **Explore Atoms**, then choose **View their network**
to change perspective. **My Atom** restores your starting perspective. Drag to
pan; use the wheel, pinch or zoom buttons to change scale. **Recenter** resets
the camera. People, Networks and Regions emphasize different levels of detail.
**PULSE** asks how you feel; select one of eight states and **Send Pulse** to
propagate through your connected network. Your latest state lasts 24 hours or
until replaced. **FEEL YOUR NETWORK** shows active voluntary states, neutral
inactive Atoms and a compact coverage summary. Both actions stop automatically
after 15 seconds; the selected emotion still lasts 24 hours. Pulse data resets on refresh.
Motion controls are in Explore Atoms and respect the system's reduced-motion
preference. All data and geography in this demonstration are synthetic.

From My Atom, choose **CREATE BOND**, then **Simulate recipient**. Create an
Atom with a valid email and a selected city result (try Boynton Beach), simulate
verification, and confirm. Alternatively, identify an existing fixture Atom:
#00000541 connects a disconnected South African component, #00000721 connects
an Australian component, and #00000002 demonstrates duplicate prevention.
No email is sent. Invitation links and identity simulation are development only,
local to the current tab/session, and expire after five minutes.

## Commands

| Command             | Purpose                                                   |
| ------------------- | --------------------------------------------------------- |
| `pnpm dev`          | Local development server                                  |
| `pnpm build`        | Production build                                          |
| `pnpm start`        | Serve the completed production build                      |
| `pnpm lint`         | ESLint, with warnings treated as failures                 |
| `pnpm format`       | Format editable source and documentation                  |
| `pnpm format:check` | Check formatting without writing                          |
| `pnpm typecheck`    | Generate route types and check strict TypeScript          |
| `pnpm test`         | Run Vitest unit/graph tests                               |
| `pnpm test:watch`   | Watch unit/graph tests                                    |
| `pnpm test:e2e`     | Test production server on port 3100; build first          |
| `pnpm check`        | Formatting, lint, types, unit tests, build, browser tests |

The formatter excludes the governing documents to preserve their approved
contents. Playwright captures screenshots at 390 × 844, 768 × 1024, and
1440 × 900 under `test-results/`; its HTML report is in `playwright-report/`.
CI runs the same checks and uploads browser results.

## Deployment

Run `pnpm build` then `pnpm start` to serve a local production build. Run
`pnpm check` before pushing. GitHub Actions runs the same complete suite.

Follow the [deployment guide](docs/architecture/DEPLOYMENT_v0.1.md) to create the
initial GitHub commit/remote and connect Vercel using Next.js, Node 24 and pinned
pnpm 11.25.0. Branch previews support HTTPS device testing; reviewed merges to
`main` deploy the production target. No hosted deployment has been created yet.
No environment values are required; `.env.example` documents future public and
server-only boundaries. Squarespace will remain the DNS manager; domain setup
is deferred. Review captures are local-only under ignored `artifacts/references/`.

## Architecture and fixtures

See [module boundaries](docs/architecture/FOUNDATION.md) for the source layout,
graph contract, and mock fixture topology. The shared graph types contain public
data only. The mock generator has no framework or backend dependencies and is
not imported into the landing page.

The [changelog](docs/CHANGELOG.md) records milestones. Verification results and
limitations are recorded in the [foundation baseline](docs/architecture/BASELINE_v0.1.0.md).

See [Living Atom Spatial Experience v0.2](docs/architecture/LIVING_ATOM_v0.2.md)
for the current spatial model, interactions, regional contract and limitations.
The [v0.1 engine report](docs/architecture/LIVING_ATOM_v0.1.md) and original
foundation baseline preserve historical findings; capture paths now point to
the local artifact directory.

See [Atom onboarding](docs/architecture/ATOM_ONBOARDING_v0.1.md) and
[Bond flow](docs/architecture/BOND_FLOW_v0.1.md) for service boundaries,
privacy rules, state transitions, and Task #4 verification.

See [Emotional Pulse v0.1](docs/architecture/EMOTIONAL_PULSE_v0.1.md) for the
lifecycle, connected-network visibility boundary, aggregation and future integration plans.

FEEL YOUR NETWORK automatically opens NETWORK EMOTION RESULTS. An indeterminate measuring indicator precedes the local connected-network calculation; results refresh when visible Pulse data changes. The scrollable results panel remains open after the 15-second view ends until its close button is pressed. Closing returns keyboard focus to FEEL YOUR NETWORK.
