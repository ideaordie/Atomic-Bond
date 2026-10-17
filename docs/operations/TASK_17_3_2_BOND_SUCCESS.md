# Task #17.3.2 — Bond confirmation success presentation

Status: approved for publication as v0.16.4.4; deployment and CI acceptance must be verified after push. Baseline: v0.16.4.3,
`c3cac142cf35ab77e629827e6317493dab5524a3`. Master Spec v0.8 is unchanged.

## Cause and correction

The registration acceptance Server Action confirmed the Bond and removed the
registration receipt cookie. Cookie mutation revalidated the invitation page,
which redirected to `/explore` because the receipt was gone. This raced with the
client's authoritative success result and removed its 2,800 ms banner early.
The local Task #17.3.1 network-delay probe measured 192–224 ms of visibility.

The registration UI now POSTs to `/auth/register/invitation/confirm`. This thin
route calls the same `confirmRegistrationInvitation` service, retaining its origin,
verified owner, session-bound encrypted receipt and database confirmation checks.
The invitation is consumed by authoritative confirmation and the receipt cookie
is cleared in the HTTP response, before the success view is rendered. Unlike a
Server Action response, this response does not revalidate the currently displayed
page. It is private/no-store and accepts no client identity or invitation token.

The successful result renders the existing owner/network view. A shared 2,800 ms
presentation duration drives its banner and automatic navigation to `/explore`.
Unmounting clears the navigation timer. A synchronous click guard prevents a
second submission before React renders the disabled state. Existing-owner
acceptance continues to use its existing Server Action and navigation behavior.

The installation invitation is deferred only for this transient registration
success view so it cannot push the banner below the mobile viewport. The normal
MY ATOM page presents the existing installation invitation afterward, retaining
all suppression and dismissal preferences. No PWA provider, prompt, or storage
policy changes are included.

## Security and interruption behavior

- Receipt lifetime/encryption, verified session binding, invitation deadline,
  authorization, explicit consent and database single-use confirmation are unchanged.
- A captured old synthetic receipt cannot confirm again after acceptance; the
  authoritative invitation has already been consumed, even if a response is lost.
- Reload during success goes to the normal owner view; it does not revive the
  receipt or create another Bond.
- A lost HTTP response can leave a generic retry error even though the server
  committed the Bond. Opening MY ATOM safely shows the confirmed connection;
  replay cannot add another Bond. No speculative retry or duplicate creation occurs.
- Missing session, foreign origin, expired/cancelled invitations and NOT NOW do
  not produce success. No migration, secret, environment or frozen-spec change.

## Verification design

The existing ownership assertion is unchanged. New browser coverage at 390×844,
768×1024 and 1440×900 holds the response after authoritative acceptance, verifies
busy state and a single request under rapid double clicks, checks cookie deletion
and old-cookie replay, asserts banner visibility/in-viewport at 2,799 ms, then
advances one millisecond and observes automatic navigation and the confirmed
owner/network. It also verifies the installation invitation returns afterward.

Other cases cover reload, lost response, expiry, cancellation, missing session,
foreign origin and NOT NOW. Existing suites retain ordinary registration,
existing-owner acceptance, receipt cryptography and lifecycle coverage.

Final-build real-clock measurements: mobile 2,965 ms, tablet 2,943 ms, desktop
2,947 ms; navigation started after approximately 3,118–3,180 ms under concurrent local test load. Browser/React
scheduling adds small timing variation. Background-tab timer throttling can delay
presentation/navigation, but cannot restore a consumed invitation or receipt.
Physical iPhone Safari has not been exercised for this local repair.

## Publication and recovery proposal

After product approval, publish only the six files listed for this task as the
smallest patch release (suggested v0.16.4.4), with release metadata updated then.
No hosted migration, secret rotation or environment adjustment is needed. Verify
Foundation checks, Vercel Ready and ordinary route health without production
registrations/invitations/Bonds. Roll back through a history-preserving revert of
this patch if required; do not roll back database records, receipt keys, invitation
deadlines or Master Spec. Reverting would restore the known banner race.

## Final changed-file inventory

- `src/app/auth/register/invitation/confirm/route.ts`: private/no-store POST facade
  over the existing authorized confirmation service; no credential input.
- `src/components/auth/BondConfirmation.tsx`: registration-only POST transport,
  synchronous duplicate-click guard, success-window navigation and deferred offer.
- `src/components/auth/OwnerExperience.tsx`: shared notice duration and optional
  installation-offer display; defaults preserve other owner views.
- `src/living-atom/animation/first-bond.ts`: shared 2,800 ms presentation constant.
- `tests/auth-browser/bond-success.spec.ts`: six regression scenarios per viewport.
- `docs/operations/TASK_17_3_2_BOND_SUCCESS.md`: this review and recovery evidence.

## Regression results

| Check                                         | Result                                                        |
| --------------------------------------------- | ------------------------------------------------------------- |
| Unit/integration/security                     | 483 passed, 83 files                                          |
| Complete authenticated browser                | 153 passed (8.2 minutes)                                      |
| General browser                               | 114 passed                                                    |
| Persistence browser                           | 3 passed                                                      |
| PostgreSQL concurrency                        | Passed                                                        |
| Client-boundary security                      | Passed                                                        |
| Production build                              | Passed                                                        |
| Formatting, lint, TypeScript                  | Passed again on final inventory                               |
| Secret scan                                   | 630 repository files and 53 client bundles; no detected leaks |
| Focused original ownership plus new cases     | 27 passed                                                     |
| Final viewport/cookie/replay/transition cases | 18 passed                                                     |
| Final-build real-clock measurements           | 3 passed                                                      |

The first new-test run identified test-harness issues: frozen timers also paused
initialization after navigation, and an unscoped alert locator matched Next.js's
route announcer. The tests now resume time only after observing the navigation
request at 2,800 ms and scope the alert to the confirmation panel. No timeout was
increased, existing assertion removed, or security condition relaxed.

Screenshots checked the success banner in view at 2,799 ms at all three reference
sizes. Light and Dark appearance use existing design tokens. Browser clock tests
are deterministic; real-time observations are measurements, not upper-bound
performance promises. No physical iPhone or production participant tests were run.

Saved-preference Dark Mode verification also passed (3/3), with the Canvas
reporting the actual dark appearance. Final formatting, lint, TypeScript and
secret checks passed after the complete source/test inventory was finalized.
The working tree contains only the six listed review files. HEAD and origin/main
remain at the approved c3cac142 baseline; no commit or deployment was performed.
