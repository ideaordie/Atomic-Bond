# Task #17.2 — Registration geography loading

Status: product approved; publication authorized as v0.16.4.2. Hosted acceptance requires Foundation checks success and Vercel Ready.

## Baseline and scope

Local main and remote main matched `afc84908cca4a19b4b9112be5dc556b87ff510c2`,
application v0.16.4.1, with a clean working tree before implementation. Vercel
showed that commit Ready/current on the custom domain.
[Foundation run #95](https://github.com/ideaordie/Atomic-Bond/actions/runs/39049156869)
passed in 15 minutes (verify job 14m57s). Frozen Master Spec v0.8 is unchanged.

## Cause and smallest correction

AccessForm statically imports HomeRegion even in existing-owner access mode.
HomeRegion previously imported canonical-regions, which eagerly imports the
entire country/subdivision catalog and constructs the authoritative valid-ID set.
Consequently, a 331,974-byte JavaScript chunk (97,885 bytes gzip) loaded even when
the participant never needed geography.

HomeRegion now loads the existing catalog on first Country focus/input. Search
logic remains small and synchronous. Lookup logic and canonical ID construction
are moved verbatim to region-lookup; canonical-regions retains its existing public
exports and authoritative validation set. Authentication actions continue calling
the same server validation. There are no new endpoints, dependencies, generated
geography copies or external geography providers.

One shared in-flight promise and successful module cache avoid repeated requests.
Failure resets that promise and offers TRY AGAIN. The existing dropdown displays
loading/error feedback without moving surrounding form controls. Typed input
survives loading; no geographic fallback is accepted. Completion after unmount
does not set component state. Country changes retain the existing selection-reset
rules. Settings uses the same HomeRegion component and receives the same benefit.

This deliberately defers one complete public lookup catalog rather than adding
249 country files or a new lookup API. Subdivisions are available without another
request after the first country lookup. It reduces initial work, not total data
required by a participant who completes registration.

## Reproducible measurements

Windows, Node 24.21.0, production Next build served on loopback port 3149, synthetic
Supabase configuration, no production identities or operations. Playwright
Chromium, 390 × 844, DPR 1, new browser context for each sample, browser cache
disabled and service workers blocked. Three samples per mode/profile; timing
figures below are medians. Slow profile: 4× CPU throttle, 150 ms latency,
200,000 bytes/s download and 93,750 bytes/s upload. These are desktop simulations,
not physical iPhone measurements or production telemetry.

Interaction time is navigation start through a successful React-handled tab switch
and switch back. Selector readiness measures filling Country with Canada through
the matching option becoming visible. Neither operation submits registration.

| Measurement                                               |             Before |     After |         Difference |
| --------------------------------------------------------- | -----------------: | --------: | -----------------: |
| Initial fetched Next JavaScript, raw                      |          818,193 B | 490,193 B | −328,000 B (40.1%) |
| Same JavaScript, computed gzip                            |          245,111 B | 148,699 B |  −96,412 B (39.3%) |
| All nonempty external JavaScript, raw                     |          818,730 B | 490,730 B |         −328,000 B |
| All nonempty external JavaScript, computed gzip           |          245,460 B | 149,048 B |          −96,412 B |
| Initial geography chunk, raw / gzip                       | 331,974 / 97,885 B |   0 / 0 B |           Deferred |
| Initial Next JavaScript requests                          |                 10 |         9 |                 −1 |
| Completed initial subresource requests, unthrottled       |                 16 |        15 |                 −1 |
| Completed initial subresource requests, slow registration |                 15 |        14 |                 −1 |
| Subresource encoded body bytes                            |          249,959 B | 153,547 B |          −96,412 B |
| Subresource transferSize, unthrottled                     |          254,759 B | 158,047 B |          −96,712 B |
| Registration interaction, unthrottled                     |             264 ms |    223 ms |             −41 ms |
| Access interaction, unthrottled                           |             267 ms |    245 ms |             −22 ms |
| Registration interaction, slow                            |           2,444 ms |  2,010 ms |            −434 ms |
| Access interaction, slow                                  |           2,258 ms |  1,962 ms |            −296 ms |
| Country results after first input, unthrottled            |              32 ms |     46 ms |             +14 ms |
| Country results after first input, slow                   |             182 ms |    897 ms |            +715 ms |
| Registration first contentful paint, unthrottled          |              68 ms |     68 ms |               0 ms |
| Registration first contentful paint, slow                 |             536 ms |    564 ms |             +28 ms |

Raw/gzip values are response bodies and local gzip calculations for actually
requested Next JavaScript, not a sum of every HTML-referenced asset. The legacy
nomodule bundle is not downloaded by this modern browser. Resource Timing
encodedBodySize and transferSize are reported separately; transferSize includes
browser-estimated header overhead and excludes the main HTML document in this
subresource table. The unchanged local Analytics script request has an empty
response and finishes later under throttling, accounting for the one-request
difference between throttled and unthrottled totals at the measurement cutoff.
These request counts are completed Resource Timing entries at interaction time,
not every request eventually issued by the page. The separate appearance script
adds 537 raw / 349 computed-gzip bytes to both external JavaScript totals (the
local server actually sends that small file uncompressed). Shared framework code is unchanged;
the largest remaining chunks are 229,156 B raw / 71,629 B gzip and
129,352 B raw / 34,777 B gzip.

The payload reduction is material. Timing estimates are noisy with three samples;
there is no demonstrated first-paint improvement. The tradeoff is an approximately
0.9-second first Country lookup on the simulated slow connection. Subsequent
queries and country changes use the loaded catalog. Overall registration duration
is not claimed to improve: this favors initial form interaction and ordinary
login, while delaying geography work until needed.
If Country is used immediately after the interaction probe, the sums of the slow
profile medians are approximately 2.63 seconds before and 2.91 seconds after.
That is a roughly 0.28-second tradeoff, not an end-to-end registration speedup;
participants can enter other fields first. No speculative prefetch behavior has
been added to hide that tradeoff.

Measurement scripts and raw samples are retained locally in ignored
`artifacts/task172-measure.mjs` and `artifacts/task172/{before,after}.json`.
Responsive captures are in `artifacts/task172/{390,768,1440}-{light,dark}.png`.

## Verification

All required local suites passed: 475 unit/integration/security tests, 114 general
browser tests, three persistence tests and 135 authenticated browser tests, plus
PostgreSQL concurrency, client-boundary security, build, TypeScript, lint and
formatting. After the supplemental WebKit correction described below, the final
production build and all 54 affected Chromium geography/settings/invitation
registration cases passed again across three viewports. All five focused WebKit
tests passed. Targeted real-build browser tests
verify no initial catalog request, a single deferred load, country changes,
cache reuse after tab switching, slow loading, stable form geometry, unmounting,
failed chunk retrieval and successful retry without accepting a fallback region.

A comparison against HEAD, normalizing line endings only, confirms the moved
lookup functions, search helper and retained validation block are identical.
The configured-secret scan passed across 624 repository files and 53 browser
bundles, without printing secret values. Authentication and registration source
files have no diff.

The complete sequential run took approximately 19m43s locally: formatting 9.09s,
lint 21.73s, TypeScript 12.50s, unit/integration/security 257.41s, client-boundary
6.22s, PostgreSQL 31.10s, build 17.82s, general browser 282.58s, persistence
12.63s and authenticated browser 532.04s. No test was skipped or assertion
relaxed. Unit tests used one fork worker and an 8 GiB heap; browser worker
settings remained unchanged. These are Windows timings, not hosted CI timings.

Supplemental WebKit testing found a retry-button focus issue: WebKit can blur
the Country input without focusing the clicked button, closing the dropdown
before its click handler runs. The retry now uses the existing option-button
mousedown prevention and returns focus to Country. All five WebKit cases then
passed (13.4s), including pointer retry, keyboard selection and touch selection.
The 54-case final Chromium retest passed in 1.2 minutes. Normal render screenshots
remain applicable because this correction only affects retry focus.

The fault-injection tests explicitly block service workers so interception covers
the actual chunk request, and prove React handlers are attached by switching tabs
before injecting delay/failure. Without that precondition, WebKit's immediate
programmatic fill could run before hydration and lose the typed value. Assertions
for retained input, stable layout, recovery and canonical validation remain intact.
Existing PWA tests run separately with their original settings. An initial ignored
WebKit harness had a working-directory/type-annotation setup error, corrected
without changing the repository's CI configuration.

Light/Dark screenshots at 390 × 844, 768 × 1024 and 1440 × 900 show the existing
form and dropdown styling. No horizontal overflow or page errors were observed.
Opening the dropdown overlays following fields as it did before; deferred loading
does not insert a new panel or change the form geometry.

## Exact intended file inventory

- `src/components/auth/HomeRegion.tsx`: deferred catalog, cache and recoverable UI.
- `src/services/locations/canonical-regions.ts`: existing validation and compatible exports.
- `src/services/locations/region-lookup.ts`: unchanged catalog lookup/ID functions moved out.
- `src/services/locations/region-search.ts`: unchanged small search helper and type moved out.
- `tests/auth-browser/geography-loading.spec.ts`: targeted deferred-loading coverage.
- `docs/operations/TASK_17_2_GEOGRAPHY_LOADING.md`: evidence and release checkpoint.
- `package.json` and `docs/CHANGELOG.md`: release version and history only.

AccessForm, registration actions/callbacks, email hook, encrypted receipts, explicit
Bond confirmation, invitation deadlines, catalog contents and database migrations
are unchanged. CI configuration retains its 25-minute limit. No welcome videos,
renderer, sub-application, PWA, analytics, dependencies or frozen spec are changed.

## Review, publication and recovery

Product review and publication are approved, including the first-use loading delay. A
physical iPhone Safari check remains required; desktop browser simulation is not
equivalent to real Safari/email/PWA validation. No production registration,
invitation, email or Bond was generated.

Publish only this narrow application/test/documentation change,
require Foundation success and Vercel Ready, and verify the actual deployed
registration/access network waterfall without submitting production forms. No
migration, environment change or new secret is required. If necessary, a
history-preserving revert of this task restores eager loading without affecting
accounts, invitations or stored regions.
