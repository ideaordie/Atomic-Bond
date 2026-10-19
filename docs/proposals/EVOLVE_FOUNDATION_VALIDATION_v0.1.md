# Task #19.1 — local foundation validation

Date: October 18, 2026. Baseline v0.16.4.6 / `6df0a19`.
No hosted SQL, production records, credentials, schedules, application routes or
feature gates were changed. No commit, deployment or specification freeze.

## Results

| Check                                                                         | Result                                                                                                                                                    |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full Vitest unit/integration/security suite, 2 workers, 6 GiB Node heap limit | 84 files / 490 tests passed; 260.54 seconds                                                                                                               |
| Final EVOLVE isolated database tests                                          | 7 passed; 6.37 seconds                                                                                                                                    |
| Real local PostgreSQL EVOLVE concurrency                                      | Passed eight simultaneous submissions and votes, equal weighting, support/withdrawal races, lifecycle races, stale admin decisions and concurrent cleanup |
| Existing PostgreSQL concurrency script                                        | Passed Bond, deletion, deactivation, Pulse, Signal, growth and Home Region invariants                                                                     |
| Existing server/client boundary security build                                | Passed; privileged adapters rejected in client components                                                                                                 |
| Production build                                                              | Passed; no production EVOLVE connection added                                                                                                             |
| TypeScript                                                                    | Passed                                                                                                                                                    |
| ESLint on new source/fixture/test/script                                      | Passed, zero warnings                                                                                                                                     |
| Prettier on new TypeScript/JavaScript/docs                                    | Passed                                                                                                                                                    |
| Synthetic EVOLVE browser checks                                               | 6 passed, 37.8 seconds; Light/Dark at 390×844, 768×1024, 1440×900                                                                                         |
| Secret scan                                                                   | Passed repository plus 54 freshly built client bundles; no known managed secret or receipt implementation leakage                                         |

Initial local failures exposed ambiguous SQL history-column qualification and
synthetic reauthentication timing; both were corrected before the passing runs.
The Windows sandbox initially prevented the test runner spawning a child process;
the same test command ran with permission to execute local tooling. No test or
security assertion was disabled. The final targeted rerun covers SQL refinements
made after the complete suite: hidden ideas cannot qualify for acknowledgment,
and malformed data exceptions preserve the request-throttling counter.

One final native PostgreSQL rerun left an orphaned Windows I/O worker after all
assertions passed, the server exited and its disposable directory was removed.
The exact test worker was verified and stopped; the runner then exited zero.
No unrelated process was stopped or test-infrastructure refactor introduced.

The test clock exists only in the isolated fixture, outside the candidate
migration. Real PostgreSQL concurrency uses independent connections on a disposable
loopback server with generated temporary credentials; it never reads a hosted
database URL. The retained prototype browser tests use only synthetic React state.

## Security cases exercised

- Default-OFF gate; anonymous, unverified, revoked-session and inactive rejection.
- Private table access denied; helper execution denied; RLS enabled on all tables.
- Pending author visibility; no participant visibility before admin publication.
- 250-character/empty/malformed payloads; client owner-field injection rejected.
- Exact rolling 24-hour boundary; stale repeated submissions and duplicate text.
- One equally weighted support per owner; withdrawal; replayed revision rejection.
- Administrator-only decisions/history, mandatory explanation and revision races.
- Safe participant projections without private owner/auth IDs or public vote totals.
- LIVE acknowledgment from actual contribution, subject to current visibility.
- Deactivation hides authored ideas/removes support; reactivation does not restore
  visibility/support or reset submission cooldown; deletion removes content/owner.
- Paginated review reaches more than 25 pending ideas without duplicates.
- Rejected requests consume throttle budget; one-minute recovery.
- Bounded, repeatable cleanup removes eligible content/history and preserves
  published ideas; lifecycle and cleanup races use the same lock order.

## Exact new foundation files

1. `supabase/candidates/202610210001_evolve.sql`
2. `src/services/evolve/contracts.ts`
3. `tests/helpers/evolve-fixture.mjs`
4. `tests/integration/evolve-foundation.test.ts`
5. `scripts/test-evolve-concurrency.mjs`
6. `docs/proposals/EVOLVE_FOUNDATION_v0.1.md`
7. `docs/proposals/MASTER_SPEC_v0.9_EVOLVE.md`
8. `docs/proposals/EVOLVE_FOUNDATION_VALIDATION_v0.1.md`

The six pre-existing uncommitted #19.0 files are preserved:
`src/app/review/evolve/{page.tsx,view.tsx,view.module.css}`,
`tests/review/{evolve.config.ts,evolve.spec.ts}` and
`docs/proposals/EVOLVE_LOCAL_PROTOTYPE_v0.1.md`.
No tracked baseline file, package version, dependency, CI configuration or frozen
specification changed. Browser screenshots remain ignored artifacts, not releases.

## Reproduction

Use the installed package binaries (the machine's fallback pnpm shim did not
resolve local executables):

```powershell
$env:NODE_OPTIONS='--max-old-space-size=6144'
.\node_modules\.bin\vitest.cmd run --maxWorkers=2
.\node_modules\.bin\vitest.cmd run tests/integration/evolve-foundation.test.ts --maxWorkers=1
node scripts/test-evolve-concurrency.mjs
node scripts/test-db-concurrency.mjs
node scripts/test-growth-client-boundary.mjs
.\node_modules\.bin\tsc.cmd --noEmit
.\node_modules\.bin\next.cmd build
.\node_modules\.bin\playwright.cmd test --config tests/review/evolve.config.ts
```

Existing local review server: http://127.0.0.1:3140/review/evolve.
Evidence logs/screenshots are under ignored `artifacts/evolve-*`.
The secret scan compares local managed-secret values internally without printing
them, checks tracked/untracked source and built browser JavaScript, and checks
private-key markers. It is not a claim to detect every possible unknown secret.

## Remaining limitations / approvals

This is a database foundation, not an integrated production feature. No hosted
authorization, ingress enforcement, scheduler execution, moderation staffing or
physical-device integration is asserted. Existing authenticated/general/persistence
browser suites were not repeated because no existing UI or runtime service was
modified; the full existing unit/security/concurrency checks and targeted prototype
browser checks were run. Foundation CI remains unchanged and must pass on any
future authorized publication.

Approve retention and the exact v0.9 wording before integration. Separately approve
hosted migration, session-bound adapter/admin wiring, ingress rules, cleanup
scheduling/monitoring and activation. No Task #19.2 work has begun.
