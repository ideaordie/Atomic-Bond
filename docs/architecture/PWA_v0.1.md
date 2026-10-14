# Installable PWA v0.1 — Task #9.0

Release 0.9.0 builds on the approved 0.8.3 frontend. Installation is
optional; authentication, identity, graph, Bond, Pulse and database contracts do
not change. The caption cleanup was committed separately before this work.

## Permanent-origin release gate

The approved permanent application origin is `https://atomicbond.ideaordie.com`.
The domain is connected and its authentication/Bond flow passed user verification.
Physical installed-device acceptance is still required before final completion.
The explicit Vercel, Squarespace, environment
and Supabase checklist is recorded in [deployment documentation](DEPLOYMENT_v0.1.md#task-90-permanent-origin-configuration-checkpoint).
No DNS or hosted configuration changes are performed automatically.

Manifest and worker paths remain origin-relative. Auth callbacks/email return
links and secure invitation URLs use the validated configured `APP_ORIGIN`.
There is no old deployment hostname in runtime source or public assets. Origin
changes create separate browser storage/install identities; test installation
on the permanent domain and use existing-owner access if a new session is needed.

## Manifest and visual identity

`src/app/manifest.ts` publishes `/manifest.webmanifest`. Stable origin-relative
`id`, scope and start URL are `/`; display is standalone. Launching `/` resolves
the existing owner server-side, or presents normal entry when signed out. No
deployment hostname, owner number or invitation secret is embedded in metadata.
The scientific light theme/background is `#f3f6f8`. Apple metadata and a 180px
touch icon supplement 192px/512px PNG icons and a full-bleed maskable icon.
The original molecular mark has no text; its core fits the maskable safe zone.
`scripts/generate-app-icons.mjs` reproduces it using Next's installed Sharp.
Only the resulting public PNGs ship, not a screenshot or private source artwork.

## Install experience

`PwaProvider` captures `beforeinstallprompt` globally without invoking it automatically.
The shared navigation includes INSTALL APP in browser mode, including when no native
prompt is available. Settings retains its explicit install option. Both disappear
in standalone mode and after an accepted native installation in the current page.

Successful new-Atom activation and returning-owner email-link confirmation trigger
the existing inline TAKE YOUR ATOM WITH YOU invitation only after verified ownership
is resolved. Account deletion/reactivation continuations do not trigger it. A
non-identifying sessionStorage pending flag carries it through Bond redirects to
the owner view. Authentication errors, unresolved links and token refreshes do not
trigger an invitation. NOT NOW clears the pending flag and uses the existing 30-day browser dismissal
preference; the navigation option remains available. No identity, token or account
information is stored. Storage failure leaves the application functional and suppresses
automatic promotion conservatively. There is no automatic 30-second pop-up.

Task #14.3 keeps the Auth panel's generic primary-button rule away from nested
installation controls. Previously its inverse text color could combine with the
dismiss control's transparent background. Installation controls retain their own
shared surface/text, hover/pressed and focus tokens; NOT NOW is always enabled.
No session or lifecycle policy changes are required.

The captured Chromium event is single-use and invoked only by a user click.
Dismissal never hides INSTALL APP. Without a native event, the action opens a native
HTML dialog with keyboard focus containment, Escape/Close, and platform instructions:
iPhone/iPad Safari Share → Add to Home Screen (Open as Web App where shown),
Android browser installation menu, Chrome/Edge desktop installation menu, Safari
Add to Dock, or a general supported-browser fallback. Instructions do not claim
installation has completed. Platform detection is for presentation only.

Installed detection outside standalone is not universal: a separate browser/profile
may not know an app is installed. The instructions acknowledge this and advise opening
the existing icon. No persistent installed flag is used that could conceal the entry
after uninstall. Installation does not promise permanent login; existing passwordless
ACCESS MY ATOM restores ownership if the installed browser context needs authentication.

Physical iPhone/iPad Safari, Android Chrome and desktop Chrome/Edge installation still
require device acceptance. Automated browser tests simulate prompt and display-mode
events, verify returning-owner behavior, and inspect offline public-only caches.

## Worker, cache and offline policy

`/sw.js` registers only in production builds on a secure context (localhost is
permitted by browsers). Its HTTP response disables caching. The only CacheStorage
entries are a fixed generic `/offline.html` and four icons, fetched without
credentials. No arbitrary runtime URL is ever written to CacheStorage.

Navigation uses the network; transport failure returns the generic offline page.
All POSTs, APIs, Server Actions, RSC payloads, cross-origin requests and query-bearing
asset requests bypass caching. Auth pages, token-bearing fragments, invitation
paths, private identities, Pulse data and graph responses are never cache keys or
stored responses. No request logging, background sync, mutation replay or synthetic
offline network exists. Dynamic HTTP cache policy remains with the existing app.
Even versioned JS/CSS use normal framework delivery, not worker caching.

When connectivity disappears in an open page, a client offline screen hides and
makes the mounted app inert. Existing state is not persisted; it cannot be mistaken
for current data. TRY AGAIN reloads from the server. It does not perform an owner
action or resend a form. Offline navigation preserves the requested URL for retry,
but never displays its secrets. A first-ever offline visit cannot use a worker
that was never installed; that remains the browser's native offline state.

## Updates and recovery

Registration uses `updateViaCache: none`, checks on load/focus and hourly while open.
The worker precaches only its public assets, calls skipWaiting then clients.claim,
and removes older `atomic-bond-public-` caches, leaving unrelated caches alone.
Worker replacement does not forcibly reload a form or QR flow. Running React code
updates on the next normal navigation/reload that loads a new document. No app
bundle is pinned offline; installed launch reaches the current server release.
Increment the public cache version when changing the offline assets/policy.

For a critical release, preserve server authorization enforcement, deploy the fix
and ask active users to reload; PWA v0.1 deliberately has no forced remote reload.
Rollback must retain a safe `/sw.js` endpoint: serve a cleanup worker if retiring
PWA support rather than only deleting the worker file. A rollback to pre-PWA code
does not unregister an already-installed worker automatically.

## Authentication and deep links

Supabase cookie sessions, getUser checks, my_atom resolution and RLS remain the
authority. Installation neither creates an Atom nor stores a new credential.
Cookie availability between Safari/browser and standalone varies by OS/version;
if signed out, use ACCESS MY ATOM with the existing verified identity. Never use
CREATE MY ATOM merely to recover an installed session.

Email callbacks retain explicit confirmation and remove token fragments as before.
HTTPS public and Bond links keep their existing routes and consent checks. OS/browser
policy determines whether external links open in a browser or installed window;
the app cannot guarantee universal link capture. Email verification may complete in
the browser; a separately isolated installed cookie store may need its own access
flow. No cross-container token copying is introduced. QR carries the same secure
HTTPS invitation, regardless of the creator's display mode.

## Security and future capabilities

PWA mechanics require no new permissions, cookies, database changes or provider
keys. The separately approved permanent-origin move requires the external
configuration checkpoint above. Installation requests no camera, contacts, GPS, microphone or
notification permission. No analytics system is added. Future privacy-reviewed
metrics may count offer shown/initiated/accepted/dismissed without storing identity
or URLs. Future Web Push would require separate explicit opt-in, scoped server-side
subscriptions, VAPID management and abuse controls; this worker can be extended then.
Badging is deferred. Installation does not promise notifications.

## Verification and physical acceptance

Local verification on 2026-09-29: production build/TypeScript, formatting, lint,
178 unit/graph/service/security/database tests and native PostgreSQL concurrency
checks passed. All 114 browser cases passed: 75 visualization/offline, 36
Auth/QR/install and 3 public-persistence cases. The initial stateful wrapper around
streamed server content caused duplicate transient route nodes; the final runtime
is a sibling of that content and publishes only install state through a client
external store. Existing regression assertions remain intact. The final local
four-worker browser run hit one existing tablet Pulse test's 30-second timeout;
the complete mock-browser suite passed with three workers, without changing
assertions or time limits.

Install offer, iOS guidance, offline fallback and preferences screenshots were
reviewed at the three reference viewports. No horizontal overflow was found.
Source/browser-bundle secret scans passed. Master Spec and migrations are unchanged.
The user subsequently verified real passwordless email delivery, custom-domain
callback completion, existing ownership resolution, canonical invitation URLs and
Bond flow on `https://atomicbond.ideaordie.com`. This clears the production-origin
checkpoint and authorizes publication of 0.9.0 for installed-device acceptance.
No additional real email is required by the automated PWA checks. Physical
installed-device acceptance remains separate from this browser authentication
verification.

Automated tests distinguish simulated browser install events from an actual OS
installation. They verify metadata/icons, real Chromium worker registration and
offline launch/cache contents, dismissal and native-event invocation, iOS guidance,
owner-session restoration with standalone detection emulated, and all existing
authentication/Bond/QR/Pulse/security regressions. Reference viewports: 390×844,
768×1024 and 1440×900. Test identities and mail are disposable loopback fixtures.

Physical iOS/iPadOS and Android installation has **not been performed by the agent**.
Before production acceptance, record device, OS/browser, installed version, result
and issues for each step. Never record live QR secrets, email links or private data.

- Open the approved HTTPS release, authenticate an existing Atom, confirm its number.
- Inspect the contextual offer; dismiss and confirm it stays quiet after reopening.
- Use preferences to reopen guidance/install. On iOS use Share and Add to Home Screen;
  on Android invoke the browser-native dialog. Confirm icon/name and standalone launch.
- Confirm owner resolves to the same Atom; if the OS isolates cookies, use returning
  access. Test callback completion and reopening without duplicate identity.
- Exercise Living Atom, zoom, selection, YOUR NETWORK OVERVIEW, profile, Pulse and QR.
- Scan the installed device's QR on a second device and confirm with explicit consent;
  test the reverse, expiry/reuse and public links. Confirm reciprocal graph updates.
- Close/reopen, rotate, use large text and test notch/gesture-area controls.
- Disconnect, relaunch and confirm the honest offline screen with no stale network;
  reconnect and retry. Test an approved subsequent deployment/relaunch for updates.

References: [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps),
[WebKit Home Screen behavior](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/),
[WebKit cookie behavior](https://webkit.org/blog/14787/webkit-features-in-safari-17-2/).

## Appearance (v0.11.4)

The shared [Design System](DESIGN_SYSTEM_v0.1.md) adds explicit browser-local
Light/Dark appearance. The offline document uses the same public token stylesheet
and safe initializer. The worker's fixed asset list includes these two files;
private navigation/data caching remains prohibited. Manifest identity, install
behavior and launch routing are unchanged. OS-controlled splash artwork may
remain light while the application uses the saved appearance.

## Persistent invitation acceptance (v0.13.5)

Baseline: v0.13.4 / `66329e4`. No manifest, worker, database, frozen specification,
production configuration or authentication policy changes. The registration action
adds only a successful-creation presentation flag; it grants no authority.

Verified locally: 327 unit/graph/security tests; registration and cross-device owner
regressions; native accepted/dismissed event simulation; iOS/iPad guidance; Android
fallback; standalone owner return; keyboard dialog close/focus restoration;
invitation reload/dismissal; appinstalled suppression; public-only offline cache;
all navigation items reachable at 390×844, 768×1024 and 1440×900. Light/Dark screenshots
checked at all three sizes. TypeScript, production build, lint, changed-file formatting,
server-only client boundary and secret scans passed. The broad database integration
run was stopped for resource contention; database code and migrations are unchanged.

Review: `/review/pwa` is development-only and returns not-found in production.
Native installation UI was simulated, not physically installed. Remaining device checks:
check Safari Add to Home Screen, Android Chrome installation and Chrome/Edge desktop
installation on real devices; reopen the installed app, verify the same Atom, and
verify secure existing-owner access if browser storage is not shared. No permanent
login guarantee is made. Publication was approved after local product review.

Platform references: [browser installation events](https://web.dev/learn/pwa/installation-prompt)
and [Apple's Safari installation instructions](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios).

## Returning-owner invitation verification (Task #14.3, v0.14.2)

Baseline: v0.14.1 / `9607a2f`. Returning ACCESS MY ATOM verification now requests
an invitation only after successful owner resolution. Account lifecycle redirects
remain excluded. Existing browser-local dismissal and installed-context suppression
apply to both returning owners and newly activated Atoms.

Local verification passed: 451 unit/integration/security tests, client-boundary
checks, PostgreSQL concurrency/restart checks, production build, formatting, lint,
and TypeScript. All 111 general browser cases passed with one unchanged tablet
Pulse timeout passing on targeted retry; three persistence cases passed. The 87
owner-browser cases passed across the initial run and targeted reruns after fixing
new test setup (keyboard focus and signed-out entry). The final PWA subset passed
18/18. Source and built-browser secret scans passed.

Returning-owner invitation screenshots were inspected in Light/Dark at 390×844,
768×1024 and 1440×900. Tests check dismissal contrast, hover, pressed and keyboard
focus, pending/error authentication suppression, dismissal persistence, standalone
suppression, and preservation of new-owner installation. NOT NOW remains enabled.

Four additional mobile WebKit tests passed against the development server. The
production-build HTTP-loopback WebKit run could not preserve its Secure owner
cookie on navigation; production cookie security was not changed. These tests do
not replace physical iPhone Safari/Android/desktop native installation or HTTPS
installed-app checks. Native prompts and standalone context are simulated locally.
CI configuration, authentication services, service-worker rules, database migrations
and frozen Master Spec v0.6 are unchanged. Product review passed and publication is approved.
