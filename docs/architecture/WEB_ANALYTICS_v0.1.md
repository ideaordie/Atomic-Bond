# Vercel Web Analytics — integration audit

## Pre-publication audit: October 9, 2026

Production and local/remote main remain v0.11.0, commit `7563936`.
Vercel Agent created commit `fc5e84c` on
`vercel/install-vercel-web-analytics-i-ld0n7h` and
[PR #1](https://github.com/ideaordie/Atomic-Bond/pull/1), not on main.
The generated change adds `@vercel/analytics` 2.0.1 and a root Analytics component.
The dashboard reports zero visitors/page views and still shows setup instructions.
A fresh anonymous production visit returned HTTP 200, but no Analytics SDK script
or `/view` request appeared during 35 seconds. Production collection is not yet
integrated; an enabled dashboard alone is insufficient.

## Approved v0.11.1 integration

Uses the generated dependency/lockfile and the official `@vercel/analytics/next`
component inside a small client wrapper in the root layout. It renders no UI and
does not control Auth, PWA, graph rendering, database access or notifications.
No custom events, identity properties, second provider or secret are added.
Admin Network Analytics and Connected Groups remain separate and unchanged.

The supported `beforeSend` hook allows only `/`, `/about`, `/explore` page views.
It rejects parameterized/fragment URLs, account/Auth/admin routes, individual Atom
paths and Bond/unsubscribe capabilities. It also rejects custom events. A current
browser URL guard covers SDK URL normalization. Because the SDK separately reads
document.referrer, events with external or non-allowlisted/parameterized referrers
are dropped rather than risk transmitting sensitive information.

This is intentionally incomplete traffic coverage: visits from external sites or
sensitive account flows may be omitted. No referral/UTM attribution is promised.
The ABOUT summary discloses aggregate page, device/browser and approximate
geographic statistics. Vercel describes request-derived visitor hashes with a
24-hour lifetime, without tracking cookies; this is not zero data collection and
does not mean no IP processing at the provider. No hash is linked to an Atom by
the application. These are provider traffic estimates, not registered-user counts
or participant Home Regions.

The service worker remains unchanged: it caches only the existing offline assets,
not analytics requests, private data or Auth/invitation capabilities.

## Approval and deployment verification

Do not merge the unfiltered generated PR independently of this privacy review.
Publication is approved. Reconciliation confirmed the generated dependency and
lockfile changes are included exactly once, with the root component replaced by
the privacy wrapper. PR #1 is not merged; no unrelated changes were found.
No settings, migrations, live participants or production Signals were modified by the audit.
After approved deployment, verify the production commit is Ready, visit a clean
general URL directly, and use browser Network Fetch/XHR to confirm a successful
page-view request to the SDK's configured `/<unique-path>/view` endpoint (legacy
`/_vercel/insights/view` may apply). Do not hard-code intake paths: Vercel v2 may
generate them at build time. Check the dashboard after at least 30 seconds.
Inspect only aggregate results; never print sensitive payloads. Test excluded
routes locally with synthetic tokens, not live capabilities.

References: [Quickstart](https://vercel.com/docs/analytics/quickstart),
[redaction](https://vercel.com/docs/analytics/redacting-sensitive-data),
[privacy](https://vercel.com/docs/analytics/privacy-policy).

## Local verification

Task #11.2 adds `/welcome` to the static general-page allowlist. All existing
parameter, sensitive-route, referrer and custom-event exclusions still apply.
External advertisement referrals are not exempted from the privacy filter.

283 unit/integration/security tests passed. Thirty browser cases passed across
390×844, 768×1024 and 1440×900, covering the SDK callback, sensitive URL suppression,
blocked script behavior, Auth/owner restoration, PWA, Living Atom/Pulse, persistent
Network Signal and Admin Hub. Three new-test assertions initially expected an
anonymous graph instead of the existing secure entry redirect; the corrected
test passed at all sizes without application behavior changes. ABOUT screenshots
were visually reviewed. Formatting, lint, production build/TypeScript and the
repository/browser secret scan passed. Browser Analytics tests use a local script
stub to inspect the official SDK callback queue, not fabricated provider acceptance.
Real collection acceptance must be checked after deployment using the procedure above.
