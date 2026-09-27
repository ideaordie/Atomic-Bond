# Atomic Bond v0.8.0 — First functional MVP baseline

Frozen: 2026-09-27, by explicit project-owner approval.

The owner reported that the application was working and requested that v0.8.0
be frozen after the NETWORK EMOTION RESULTS scrolling fix. This release records
that acceptance without changing application functionality. The application
source is the tested implementation at `16da07c998ec025fc17c6dc75df03e28e54357b3`.
The annotated Git tag `v0.8.0` identifies the version/documentation freeze commit.
Do not move or overwrite that tag; future work belongs in subsequent versions.

## Included functionality

- Supabase persistence and verified private email ownership with passwordless
  access, canonical coarse locations, optional public alias/X and permanent
  database-assigned Atom numbers.
- Secure, expiring, single-use QR Bond invitations with active invitation reuse,
  Auth continuation, separate recipient confirmation and database pair integrity.
- Real small-network graph retrieval, reciprocal Bond views and owner polling.
- Scientific light Living Atom, structural layer colors, accessible responsive
  controls and public identity context.
- All eight Emotional Pulse states, 24-hour lifecycle and connected-network
  visibility. FEEL YOUR NETWORK stays enabled until toggled off. Its results
  report measures on opening, refreshes once per minute and preserves scrolling.
- Deterministic mock services and fixtures isolated from production participants.

## Verification evidence

The Task #8 candidate passed formatting, lint, TypeScript, 150 unit/integration
tests, native PostgreSQL concurrency/restart checks, 69 mock browser tests,
3 persistence browser tests, 18 Auth/QR browser tests and a production build.

The subsequent results-panel correction passed 150 unit/integration tests,
18 Pulse browser tests and 18 Auth/QR browser tests, formatting, lint, TypeScript
and production build. Browser coverage includes 390×844, 768×1024 and 1440×900.
Its production Vercel deployment was Ready at commit `16da07c`.

Both hosted migrations were confirmed applied during candidate publication:
`202609260001_atomic_bond.sql` and `202609270001_owner_access.sql`. This freeze
adds no migration and performs no database writes or sequence resets.

The owner supplied a successful-use report and explicit MVP acceptance. The
device-by-device checklist, public participant numbers, exact production counts
and hosted first-Bond record have not been supplied as a detailed verification
record. Do not invent these results or equate automated browsers with physical
camera testing. Preserve and complete the [QR Bond procedure](QR_BOND_v0.1.md)
when recording that evidence; no new participant or Bond is created by this freeze.

## Boundaries and known limitations

Master Product Specification v0.2 remains the authoritative frozen specification;
v0.1 remains historical. Freezing this software release does not revise either
specification or declare every planned product capability implemented.

Owner network updates use ten-second visible-page polling and focus refresh,
not realtime subscriptions. The results report may lag live Pulse changes by
up to one minute. Invitations expire after five minutes, including during email
onboarding. Email delivery can be affected by provider limits and spam filtering.
Production location-provider integration, expanded abuse controls and other
deferred features remain outside this baseline.

No secrets, private inboxes, verification links or invitation payloads belong in
release records. Genuine Atoms and Bonds must not be deleted merely to clean up a
milestone test. Public Atom numbers are never reused.

## Release preservation and rollback

Keep `v0.8.0` immutable in GitHub. Subsequent changes require a new version and
changelog entry. Vercel deployments remain sourced from GitHub main. For an
application rollback, redeploy the tagged revision or promote its retained
deployment; database rollback is a separate reviewed migration operation and
must never reset permanent Atom numbers. Task #9 is not started by this freeze.
