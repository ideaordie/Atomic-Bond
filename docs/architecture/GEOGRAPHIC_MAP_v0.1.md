# Geographic Network Map v0.1

Task #11.5 adds an optional geographic layout to the existing Canvas renderer. It does not change authoritative Atoms, Bonds, Pulse, reach, account lifecycle or registration geography. Approved for publication as v0.11.5 after local product review.

## Authority and privacy

`ownerGeographicNetwork()` accepts no Atom/root argument. `requireOwner()` resolves a verified ACTIVE/DORMANT owner through the existing authenticated Supabase session and `my_atom`, then requests that owner's confirmed connected component. Public exploration does not receive the map action. The existing 5,000-member limit remains unchanged. No migration, privileged credential or additional polling is introduced.

Opening the map revalidates ownership and refreshes the owner graph. Client layout also restricts membership to the owner component; changing the visual center never changes authorization. Failed owner refresh/offline state removes the map layout. Navigation/sign-out unmounts owner state. No map graph, identity, location association or Pulse data is written to browser storage or service-worker caches.

Only already-authorized country/subdivision codes determine positioning. DELETED/DEACTIVATED nodes never use geography, even if an invalid input includes it. They remain structural endpoints in LOCATION NOT AVAILABLE. No inference from neighbors, city, IP, GPS or private retained profile is permitted.

## Static geography

See `src/data/geography/README.md` and `coverage.json`. Geometry is lazy-loaded from the same origin. Country/subdivision representative points are static regional label points, not participant coordinates. Resolution: canonical subdivision → country → unlocated. Registration's catalog and location records are untouched.

Equirectangular projection intentionally favors a small deterministic implementation over a navigational map. It distorts area toward the poles. Small territories may be too small to see at world scale. Context panels retain existing authorized place labels; no blanket country label layer crowds mobile screens. Dataset boundaries are illustrative and do not establish a political position.

All represented Atoms sharing a canonical anchor consolidate into one compact marker located exactly at that point. Marker counts report actual members; mixed Pulse colors retain member contributions. Confirmed edges between anchors are summarized into one display line per pair, with an exact edge count. Internal Bonds remain in the underlying graph and individual context, without drawing self-loop clutter.

Selecting a marker or the keyboard geographic selector expands a member inspector with its count and coarse location label. Members open the existing Atom context with their actual relationships. Collapsing the inspector leaves the anchor unchanged. This deliberately uses a member list instead of spatially spreading Atoms or inventing residence positions. There is no automatic geographic spreading at higher zoom. Membership/layout are memoized on data changes, outside the paint loop.

The initial preview's circles were caused by two presentation decisions: retaining separate orbital visual groups within each geographic anchor, then applying golden-angle offsets capped at 70 map units. Synthetic fixtures contain country codes but no subdivision codes, so their authorized 640-member component resolves to three country anchors (280/180/180 members). Subdivision matching was not failing. The fixture data and geographic dataset remain unchanged; the offsets were removed.

## Interaction, motion and rendering

SHOW MAP/HIDE MAP replaces the toolbar pause control. ATOM MOTION ON/OFF lives in Profile & Preferences and uses browser-local storage, like Appearance. It survives sign-out; other devices are independent. Device reduced motion takes precedence. Ordinary selection/pan/zoom are unaffected.

Map and orbital cameras are independent. A 750 ms reversible blend moves existing graph representations; reduced motion switches directly. Orbital time is held while the map is open. Pulse traversal/lifetime clocks remain independent and all 24 colors are unchanged. Geographic Bonds cross the dateline in split segments. No synthetic first-Bond decorations are mapped.

Country paths are constructed once per loaded dataset and transformed at paint time. Geographic anchors/groups are memoized. Settled maps request frames only for input, updates or transient Pulse/arrival effects. Both themes reuse existing neutral materials. Network Signal and Network Overview remain in their existing dock.

## Verification and limitations

Acceptance covers canonical mapping, privacy/lifecycle hiding, disconnected components, dateline splitting, IDs/Bonds, camera preservation, rapid toggling, motion preference, reduced motion, theme changes, zero-Bond owners, authentication/sign-out, Pulse continuity, responsive layouts and PWA regression. Desktop browser timings are not physical-mobile certification. Final test/visual evidence is recorded in the review report.

Local verification on 2026-10-09: 303 unit/integration/security tests passed; PostgreSQL concurrency/restart and client-boundary checks passed. The 108-case browser regression had two mobile toolbar collisions, corrected and verified by rerunning all 36 mobile cases. All 75 authenticated browser cases and three persistence cases passed. Final targeted runs passed nine map cases plus three authenticated map cases (both themes at each viewport). Formatting, lint, TypeScript, production build and secret checks passed.

Isolated Chromium measurements of the 640-member synthetic connected component gave approximate median paint rates of 29.9 fps at 390×844, 27.9 fps at 768×1024 and 25.0 fps at 1440×900. These short sampled measurements include layout-entry rendering, are not a sustained hardware benchmark, and do not establish the 30 fps target across devices. Parallel browser load was slower. A settled map produced no extra paints during the 700 ms idle assertion. Physical mobile/PWA performance and the maximum 5,000-member case remain unverified. Same-region groups use counted anchor markers and a keyboard-accessible member inspector.

## Proposed Master Spec amendment — awaiting approval

Do not edit frozen v0.3 during local review. Proposed addition after §11:

> Geographic Map is an optional alternative presentation of the authenticated owner's authorized connected network. It positions Atoms using approved coarse Home Regions while preserving structural Bonds and privacy boundaries. The normal Living Atom remains orbital. Motion is optional and independently controllable in either presentation, with reduced-motion preferences respected.

This clarifies geographic layout as an exception to the centered orbital presentation in §10. No other specification change is proposed.

## Geographic positioning correction review

The full browser regression passed 102 cases initially; six new hit-test checks had incorrectly clicked the US anchor for the Canadian fixture cluster. After correcting that test coordinate, all nine map cases passed, including those six checks. Three authenticated map cases also passed. Separate isolated renderer fixtures were visually reviewed in both themes at all three sizes for Florida/California, Bavaria, Tokyo, country-only Canada and hidden-location handling. No existing mock fixtures were modified.

The correction passes 304 unit/integration/security tests, including exact subdivision/country positioning, hidden-location isolation, consolidation and preserved graph edges. Browser checks cover marker hit-testing, member inspection/collapse, camera transitions, Pulse continuity and idle painting at all three sizes in Light/Dark. An isolated nine-case run measured approximately 30.4/29.6/29.7 fps (mobile/tablet/desktop viewport), versus the prior 29.9/27.9/25.0. These are short desktop Chromium samples, not physical-device certification. Only three markers and two inter-anchor lines are needed for the unchanged 640-member synthetic component. The 700 ms idle check still records no extra paints. Physical-device and maximum-size benchmarks remain pending.

## v0.11.5 publication verification

Final release checks passed: formatting, lint, TypeScript/production build, 304 unit/integration/security tests, PostgreSQL concurrency/restart, privileged-client boundary and secret scans. All 108 main browser cases passed. The authenticated suite passed 72 cases initially; three shared-count QR assertions were affected by an incorrect two-worker invocation. All six QR cases then passed with the configured single-worker isolation. Three persistence cases passed. Master Spec, migrations, service-worker policy and production schedule remain unchanged.
