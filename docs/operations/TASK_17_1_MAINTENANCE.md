# Task #17.1 — Safe maintenance and CI reliability

Status: controlled publication authorized; final hosted CI acceptance required.

## Baseline and scope

On October 17, 2026, local main, origin/main and the remote branch matched
`f945cf53bdcd7b1c957cfec50ddd0bc423991b0f` (v0.16.4.1). The working tree was clean
before implementation. Vercel showed that commit Ready/current. Existing
[Foundation run #94](https://github.com/ideaordie/Atomic-Bond/actions/runs/39016865279)
succeeded. Frozen Master Spec v0.8 remains unchanged.

The Task #17.0 audit identified a four-second job-timeout margin and an unused
puzzle-media re-export wrapper. This maintenance changes only the job timeout
from 15 to 25 minutes, removes that wrapper, and labels historical authentication
documents. It does not optimize welcome/introduction videos or change application
behavior, dependencies, database infrastructure, schedules or authentication.

## Removal evidence

`src/services/puzzle/tile-server.ts` contained only a server-only marker, an old
credential-review comment and exports from `tile-core.ts`. A tracked repository
search found no imports or filename references. A TypeScript syntax scan of 413
tracked code/configuration files found no wrapper references and no nonliteral
dynamic imports. It was not a Next.js entry point or an RPC/Cron operation.

The underlying `tile-core.ts`, legacy media helpers, exporter assets and their
tests remain present. Current PostgreSQL media delivery is unchanged.

## CI configuration and timing

The workflow diff changes only `timeout-minutes`. The existing `pnpm check`
sequence, serial failure propagation, browser workers, security checks and
always-run artifact upload remain unchanged. GitHub supports this timeout on its
hosted runner; see [workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idtimeout-minutes).
No repository setting change is needed by this workflow edit.

Baseline hosted job: 14m56s; workflow total: 14m59s. Visible step durations:

| Stage                                   |  Hosted duration |
| --------------------------------------- | ---------------: |
| Job setup                               |               1s |
| Checkout                                |               1s |
| pnpm setup                              |               1s |
| Node/cache setup                        |               4s |
| Frozen dependency installation          |               5s |
| Chromium/system dependency installation |              21s |
| `pnpm check`                            |           14m15s |
| Artifact upload                         |               5s |
| Post-job steps                          | approximately 1s |

Durations are rounded by GitHub. The expanded command log returned an error and
the raw-log view was unavailable, so finer hosted substage times were not inferred.
Local per-stage timings are recorded separately; they are not Linux CI timings.

## Specification and remaining warnings

Frozen v0.8 Section 62 still says "This v0.7 document is the authoritative frozen
product specification." This inherited version-reference inconsistency is
reported for a separately approved erratum; this task does not edit the spec.

The baseline GitHub run reports Node 20-targeting actions being executed under
Node 24 and an upcoming ubuntu-latest image transition. Action versions and runner
selection remain unchanged within this task's scope.

## Local verification

Local verification completed on Windows, Node 24.21.0 and pnpm 11.25.0. The full
unit/integration/security suite used one fork worker and an 8 GiB Node heap limit;
no tests were filtered. Browser worker settings were unchanged. The general
repeat used the existing CI retry policy, but passed without retries.

| Stage                                   |            Local wall time | Result                                                      |
| --------------------------------------- | -------------------------: | ----------------------------------------------------------- |
| Formatting                              |                     16.01s | Passed                                                      |
| Lint                                    |                     89.94s | Passed                                                      |
| TypeScript                              |                     15.58s | Passed                                                      |
| Unit/integration/security               |                    275.10s | 475 tests, 82 files passed                                  |
| Privileged client-import negative build |                     15.09s | Passed                                                      |
| PostgreSQL concurrency/restart          |                     32.68s | Passed                                                      |
| Production build                        |                     30.53s | Passed                                                      |
| General browser, initial                |                    309.39s | 113 passed; one tablet Pulse timeout                        |
| General browser, full repeat            |                    296.29s | 114 passed, no retries needed                               |
| Persistence browser                     |                     12.91s | 3 passed                                                    |
| Authenticated browser, fresh fixture    |                    491.96s | 125 passed; one mobile ownership banner assertion failed    |
| Ownership file, fresh-fixture repeat    | 30.9s test-runner duration | All 9 cases passed across three viewports                   |
| Configured-secret and private-key scan  |                  Not timed | 620 repository files and 52 browser bundles; no leaks found |

Authenticated browser, general browser and unit/integration/security stages are
the principal local time consumers. These Windows timings are not estimates of
GitHub's Linux substage durations.

The original general run exceeded the existing 30-second test deadline at
`tests/e2e/living-atom.spec.ts:134` (tablet). Its unchanged repeat passed in 28.6s.
The authenticated failure was `tests/auth-browser/ownership.spec.ts:43` (mobile):
`YOUR NETWORK HAS BEGUN` was not visible within five seconds. The failure snapshot
already displayed the authenticated Atom and one confirmed Bond. The unchanged
ownership file then passed in a new fixture at all three viewports. These are
non-reproduced reliability warnings, not proof that the initial runs passed or
that the underlying timing sensitivity is resolved. No assertion, timeout or
application behavior was changed to obtain the repeat results.

An initial authenticated startup was blocked by an old local
`scripts/test-auth-server.mjs` listener on port 54330. Its identity was verified,
then only that stale fixture was stopped; the suite used a fresh fixture rather
than weakening `reuseExistingServer: false`. An initial ignored PowerShell
logging harness also mistook pnpm's stderr banner for a terminating error; the
harness was corrected to check command exit codes. Neither was a product change.

Ignored logs and the initial Pulse trace are retained under `artifacts/task171-*`.
No production accounts, invitations or Bonds were created. Frozen specification,
application dependencies, authentication, rendering and migrations were checked
unchanged. The only source deletion is the unused wrapper.

## Publication preflight

The product owner authorized publication of these five maintenance files only.
Production was rechecked Ready at f945cf5, with local/remote main synchronized.
Application version remains v0.16.4.1; this is a maintenance commit, not a new
functional release. No version/dependency or frozen-specification edit is included.

The ownership assertion still tests intended first-Bond feedback after explicit
acceptance. `OwnerExperience` intentionally clears the notice after 2,800 ms;
`LivingAtom` displays it only for the owner's perspective. The failed snapshot
showed the authenticated Atom and one confirmed Bond, establishing successful
access and acceptance despite missing transient feedback. This is consistent with
an observation/render timing issue, but the original evidence cannot prove whether
the notice appeared before capture. It is not evidence of failed authentication.

Before committing, the unchanged mobile ownership scenario passed again with
tracing on a fresh synthetic fixture (1/1, 16.7s), in addition to the earlier 9/9
ownership rerun. No reproducible functional blocker was identified. The assertion,
five-second expectation, authentication code and 2.8-second display remain intact.
The intermittent banner and Pulse timing warnings remain disclosed.

Publication must obtain a successful Foundation run under the new timeout,
including every browser suite, plus Ready Vercel and production health. Local
repeats do not replace that gate. Stop and report if hosted CI fails; do not make
unrelated corrections. No production test accounts, invitations or Bonds are
authorized by this verification.
