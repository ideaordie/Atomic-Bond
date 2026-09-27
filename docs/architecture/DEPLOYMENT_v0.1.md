# Deployment foundation v0.1

The frozen v0.8.0 MVP uses the existing HTTPS APP_ORIGIN and both existing
migrations; it needs no new secret or schema change. See the
[baseline report](BASELINE_v0.8.0.md) and [QR Bond procedure](QR_BOND_v0.1.md),
which distinguish owner acceptance from recorded physical test evidence. Never capture
live QR codes, authentication links or private identity values in release evidence.

Application milestone: 0.5.0 / Task #5, 2026-09-22.

## Current Task #6 deployment requirements

The following Task #5 record is historical. Version 0.6.0 introduces the persistent
service boundary documented in [Supabase v0.1](SUPABASE_v0.1.md). Production runtime
must explicitly set `ATOMIC_BOND_DATA_MODE=mock` for the existing synthetic preview
or `supabase` for the real database. Supabase mode also needs the public project
URL and anon/publishable key, with repository migrations applied to that project.
Do not configure a service-role key. The `/explore` route is now dynamic; missing
configuration fails instead of falling back to mock data. The build itself does
not need credentials because it does not read production data at build time.

CI remains credential-free and selects mock mode for browser regressions. It now
runs PostgreSQL migration/RLS and native concurrency tests before the build.
Apply reviewed migrations through one chosen deployment authority (CLI or the
Supabase GitHub integration); inspect migration state rather than assuming the
GitHub connection applied SQL. The dedicated hosted project exists, but no live
schema or environment was changed in this task. Configure Vercel variables
manually for each environment and redeploy. Test real empty-network and public
read behavior after migration. Auth/email verification and owner UI activation
remain deferred to Task #7. Database rollback requires a forward migration and
backup plan; Vercel rollback alone does not undo database state. Preserve the
public-number sequence and retired-number ledger across restores.

## Scope and baseline

This is a deployable synthetic demonstration, with no production backend,
authentication, email delivery or persistent database. `/` and `/explore` are
the application routes. Onboarding and Bond simulation are dialogs inside
`/explore`, not separate `/atom` or `/bond` pages. Invitations and participation
state belong to the current tab and reset on refresh; copying an invitation
to another device does not create a shared invitation or identity.

The standard Next.js App Router build uses Node 24 and requires no environment
values. There is no custom server, filesystem persistence, or Vercel-specific
runtime architecture. GitHub-hosted CI and an actual HTTPS deployment still need
to be exercised after repository creation; local compatibility is not a claim
that a cloud deployment has already run.

## GitHub workflow

The local Git repository uses `main`; at the Task #5 audit it has no commits or
remote. Before the first commit, inspect `git status --short`, stage intended
source/configuration/documentation/fixtures, and review `git diff --cached`.
Do not force-add ignored files. Create the initial commit, create the intended
GitHub repository, connect its remote, and push `main`. No account or remote URL
is embedded here. Review the Git author identity before publishing history.

Use branches and pull requests for subsequent changes. The existing **Foundation
checks / verify** job installs the frozen lockfile, Chromium and Linux browser
dependencies, then runs `pnpm check`. It has read-only repository permissions and
does not retain checkout credentials. Configure branch protection to require
this job and review before merging. Browser failure traces/screenshots are
intentional CI artifacts retained for 14 days; use synthetic input only.
Vercel's build is not a replacement for this full suite.

## Connect Vercel

Import the GitHub repository with access limited to the intended repository.
Choose the **Next.js** framework preset, repository root `.`, Node **24.x**,
and leave the output directory at its framework default. Set the production
branch to `main`. Vercel supports Node 24 and honors the package engine range.
See [Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

Pin the install command to `npx --yes pnpm@11.25.0 install --frozen-lockfile`
and the build command to `npx --yes pnpm@11.25.0 build`. This explicitly selects
the existing package manager without relying on Vercel's lockfile detection
choosing pnpm 11. Confirm the version in the first deployment's build log.
Do not override with an unversioned `pnpm install`; Vercel's available defaults
can differ from this repository's pin. No `vercel.json` is necessary.
See [package manager selection](https://vercel.com/docs/package-managers).

Branch pushes generate Preview deployments; `main` pushes generate Production
deployments. Inspect the preview associated with the pull request before merge.
The Production label describes Vercel's deployment target, not production-ready
Atom/Bond services. See [Git integration](https://vercel.com/docs/git).

For the requested public real-device preview, review Deployment Protection and
make that preview accessible to the intended testers. Verify its HTTPS URL in
a signed-out browser on a second device. No protection settings are changed by
this task. See [Deployment Protection](https://vercel.com/docs/deployment-protection).

## Environment boundaries

`.env.example` contains names and empty values only. No variables are consumed
by the current mock application; do not populate them for this deployment.
Future local values belong in ignored `.env.local`. Configure future hosted
values separately for Development, Preview and Production, with independent
service projects and least-privilege keys. Environment changes require a new
deployment. See [Vercel environment variables](https://vercel.com/docs/environment-variables).

| Reserved name                   | Intended boundary                                                     |
| ------------------------------- | --------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Public future project URL                                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anonymous client key; never an administrative/service-role key |
| `RESEND_API_KEY`                | Server-only future notification adapter                               |

These names reserve boundaries, not integrations. Future Supabase work must
choose the supported key model and enforce RLS before exposing data. Never put
private keys, emails, authentication tokens or provider secrets in
`NEXT_PUBLIC_*`, `next.config`'s `env`, client imports, graph data, props, logs,
or serialized responses. Public variables are embedded at build time; private
variables must stay in server-only modules when those modules are introduced.
See [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables).

## Publication security

The audit found no real credentials, private contact details, or machine-specific
paths in publishable project files. Test email addresses use reserved
`example.com` fixtures. User-entered email stays in the local mock service's
private records and is excluded from public Atom serialization and graph data.
Use fictitious input during demos and automated tests; this is not real identity
verification. The optional X link is public and ownership remains unverified.

Review screenshots and videos were moved intact from `public/references/` to
ignored `artifacts/references/`. Updated historical document paths point to
local-only captures, unavailable in a fresh clone. Deterministic test fixtures
and project documentation remain in source control. Generated Next.js types,
builds, dependencies, local env files, local Vercel metadata, logs, temporary
files and key files are ignored. Next.js regenerates `next-env.d.ts`.

Everything placed under `public/` must be safe for anonymous download. Regression
tests prohibit review captures there and verify that environment/artifact URLs
are unavailable. Ignore rules are not secret detection: review staged changes
before every push. If a credential is accidentally published, revoke/rotate it
before cleaning history; deleting a current file cannot revoke a leaked secret.
Enable repository secret scanning where available. No credentials are needed
in CI for the existing verification job.

## Verification and real-device acceptance

Run `pnpm install --frozen-lockfile`, install Chromium, then `pnpm check`.
The suite checks formatting, lint, strict types, deterministic graph/service/
privacy tests, production build and Chromium at 390 × 844, 768 × 1024 and
1440 × 900. Deployment browser coverage directly opens/reloads both routes,
checks generated JS/CSS assets, and rejects private artifact/environment URLs.
Existing browser tests cover onboarding, confirmation, duplicate prevention,
X profile behavior and the Living Atom.

After the first hosted build, repeat direct navigation and refresh on `/` and
`/explore`, inspect JS/CSS loading, and exercise Create Bond with synthetic input,
simulated verification and confirmation. Test new and existing recipients,
touch/pinch, reduced motion and external X links on real devices. Verify resets
after refresh and no email in public Atom data. Safari/Firefox and hosted HTTPS
behavior require actual device checks; Chromium emulation does not establish them.

## Task #5 verification record

- Frozen install: passed with pnpm 11.25.0; dependencies unchanged.
- Formatting, lint (zero warnings), TypeScript: passed.
- Vitest: 96 tests passed, including the 94 existing tests.
- Production build: passed; `/` and `/explore` statically prerendered.
- Playwright: 33 Chromium tests passed across all three documented viewports,
  including all 30 existing browser cases and three deployment smoke cases.
- `pnpm audit --prod`: no known vulnerabilities reported on the audit date.
- Publication candidates and generated browser assets were inspected for
  credential patterns, private paths and test email leakage; none found.
- Git ignore checks and `git diff --check`: passed. No ignored files remain in
  the index; `.env.example` remains eligible for source control.
- Master Specification, Build Blueprint, AGENTS and the mock graph source retain
  their prior SHA-256 identities. No product source was changed.
- No hosted CI run, Vercel deployment, real-device HTTPS test, commit, tag, remote
  push or DNS change was performed. Those are follow-up publishing actions.

## Squarespace and future domains

Squarespace remains the intended domain/DNS manager. Use Vercel's generated HTTPS
address now; no domain or DNS changes are part of Task #5. In a separately approved
domain task, add the chosen domain to Vercel, then enter only the verification
and routing records Vercel supplies in Squarespace. Preserve unrelated MX/TXT
records and confirm certificate issuance and redirects before announcing the
domain. Do not transfer nameservers merely to connect hosting.
See [Squarespace DNS records](https://support.squarespace.com/hc/en-us/articles/360002101888-Edit-your-domain-s-DNS-records).

## Rollback

Keep the last verified production deployment and its Git commit identifiable.
If a release fails, restore the previous ready deployment through Vercel's
rollback controls, confirm both routes, and revert the offending Git change
through a tested pull request so the next push does not reintroduce it. Avoid
force-pushing shared history. This mock has no database migrations to reverse;
future persistent services will require a separate data rollback plan.
See [Instant Rollback](https://vercel.com/docs/instant-rollback).

## Task #7 auth/email release

Follow [AUTH_EMAIL_v0.1.md](AUTH_EMAIL_v0.1.md) before enabling real signup. Apply the additive owner-access migration through the CLI, deploy the reviewed application, configure the server-only Resend and signed-hook secrets, and then enable the Supabase Send Email Hook. Use `https://atomic-bond.vercel.app` as the production APP_ORIGIN and exact preview callback allowlists. Never enable a hook pointing to an undeployed endpoint. No keys belong in GitHub or public environment variables. Supabase Auth remains the token authority. Local automated email simulation is not proof of inbox delivery; complete real verification/access acceptance before declaring Task #7 done.

## Task #8.3 geography deployment

Apply reviewed migration `202609280001_coarse_regions.sql` before deploying v0.8.3. It seeds canonical country/subdivision choices while preserving historical location associations. No external location provider or location API key is required. See [Home Region](LOCATION_v0.1.md) for snapshot maintenance and compatibility.
