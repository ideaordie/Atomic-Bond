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

`PwaProvider` captures `beforeinstallprompt` globally, without automatically
invoking it. `InstallOffer` is mounted only in verified owner experience and
preferences. It waits at least 30 seconds of the owner view before offering,
checks visibility and avoids an open product dialog. This is a quiet nonmodal
card, not a prerequisite. NOT NOW suppresses automatic offers for 30 days on
that browser. Only a dismissal deadline is stored; no identity or analytics.
Unavailable storage suppresses automatic promotion conservatively. Preferences
provides an explicit option even during the suppression period when supported.

Chromium's captured event is single-use and invoked only by a user click.
Acceptance/appinstalled hides promotion; browser dismissal starts suppression.
No event means no native-install button. `display-mode: standalone` and iOS
`navigator.standalone` suppress promotion. Installed detection outside standalone
is not universal: another browser/profile may not know an app is installed.

iPhone/iPad guidance uses the manual Share → Add to Home Screen → Add flow,
including Open as Web App where shown. iPad desktop UA is recognized by MacIntel
plus touch capability. This narrow platform detection is necessary because iOS
has no equivalent native install event. If the menu is absent, guidance directs
the participant to Safari. The site never claims to complete iOS installation.
Unsupported desktops receive no broken action; browser menus remain available.

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
