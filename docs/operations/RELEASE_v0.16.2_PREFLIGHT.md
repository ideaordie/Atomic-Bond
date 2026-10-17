# v0.16.2 publication preflight — historical approval checkpoint

Production rechecked 2026-10-16: v0.16.1, commit
`821f435491adbab87b1b842f5b088e545d0a36f3`. Local HEAD, origin/main and live
remote main match. Vercel's current Production Deployment is Ready:
https://vercel.com/ideaordie/atomic-bond/HeHYp5cPq76xZdpd8QbkhGerBTrb
The custom-domain About page returned HTTP 200. The working tree contains the
unpublished Task #16.2 candidate, not an already-published release.

## Preflight conclusions

The ordered migration chain contains three duration authorities: the table default,
its maximum-duration CHECK, and the private creation function called by the public
lifecycle-lock wrapper. The candidate changes all three to 86,400 seconds. The
CHECK remains an upper bound to allow existing five-minute rows; authorized new
issuance explicitly sets exactly 86,400 seconds. Participants have no direct
insert/update access and cannot choose a duration. Historical migrations remain
unchanged. Resolution and acceptance already use stored deadlines, not a separate
300-second calculation. Acceptance denies at or after the stored deadline.

The migration performs DDL only; the UPDATE/DELETE statements inside the function
body are existing behavior executed only on a later authorized invocation. It
neither invokes that function nor changes existing invitation timestamps. Reuse
returns the original token/deadline. Existing cancellation, owner and lifecycle
checks, 256-bit random tokens, private hash/encrypted recovery storage, single-use
consumption, mutual confirmation and concurrent acceptance locks are preserved.

Compensating rollback changes future issuance to five minutes and preserves the
24-hour CHECK. It does not rewrite existing invitations. Local tests additionally
prove an issued 24-hour token still resolves and confirms at 23:59:59.999 after
rollback and is rejected exactly at 24:00:00, without cleanup. Rows and ACLs remain
unchanged through forward migration; legacy reuse does not extend deadlines.

## Exact execution sequence after final authorization

1. Recheck production/remote HEAD, migration synchronization and recovery readiness.
   Compare hosted function/default/constraint/ACL definitions against the audited
   baseline. Capture non-secret comparison evidence for existing invitation
   deadlines and unrelated record counts. Stop on drift or inadequate recovery.
2. Finalize the proposed Section 31 in a new Master Spec v0.8 copy only after explicit
   specification approval. Preserve v0.7 byte-for-byte and every unrelated product
   section. Update authority/version references as required, without altering rules.
   Complete final candidate checks and locally commit the approved v0.16.2 release.
   Do not push yet: main pushes automatically trigger production deployment.
3. Apply only `202610200001_bond_invitation_24_hours.sql` through the normal
   version-controlled Supabase workflow. Use a short low-traffic window with a
   bounded session lock/statement timeout; abort rather than wait indefinitely.
   This transaction briefly locks/validates the invitation table. Verify effective
   function/default/CHECK/ACL state and unchanged existing deadlines read-only.
   Account for genuine concurrent traffic rather than treating all count movement
   as a migration write. Never output tokens, ciphertext or private identities.
4. Promptly push the already-checked release to main, triggering Vercel deployment.
   Verify the exact release commit reaches Ready and owns the custom domain.
5. Verify Foundation checks, production public-page health, response/privacy headers,
   main == origin/main, and a clean tree. Perform no production registrations,
   invitation creation, acceptance or Bond generation; functional evidence comes
   from isolated synthetic databases and browser sessions.
6. Record the deployment/migration result and newly approved baseline. If migration
   succeeds but deployment fails, stop and report. The database remains compatible
   with v0.16.1; do not automatically truncate deadlines to undo issuance. Apply the
   reviewed compensating rollback only as an explicit recovery decision.

## Mixed-version and rollback risks

Database-first is functionally backward-compatible: v0.16.1 ignores additive
createdAt metadata and uses returned expiresAt. During the gap, its chooser/share
copy still says five minutes, even though newly issued invitations live 24 hours;
its old minute-based counter can show roughly 1440 minutes. Existing open tabs may
retain that old wording until refreshed. This does not extend or invalidate a
record, but is a real temporary presentation mismatch. Prebuild/check the candidate
before applying SQL and minimize the migration-to-Ready interval.

Application-first is not recommended: its chooser would promise a 24-hour newly
created invitation while the old database still issues five minutes. Optional
createdAt parsing prevents a crash but does not cure that wording mismatch.

A database-only rollback similarly leaves the new chooser promising 24 hours for
future five-minute issuance; pair application recovery with the rollback plan.
Older clients still use each stored deadline, but can inaccurately describe an
already-issued 24-hour invitation as five minutes. Neither rollback nor deployment
can revoke content already copied. Do not restore the old five-minute CHECK over
24-hour history or reset existing deadlines. No zero-gap messaging guarantee is
made without a separately approved coordinated traffic hold.

Longer capability exposure, upstream URL/history retention, absence of a dedicated
invitation creation rate limiter and deferred expired-record cleanup remain the
previously documented limitations. No new analytics events or logging are added.
Physical iPhone native share-sheet behavior remains unverified.

## Release preparation and verification

Local package metadata is 0.16.2 and the changelog marks it prepared/unpublished.
The exact proposed v0.8 amendment remains in
`docs/proposals/MASTER_SPEC_v0.8_BOND_INVITATIONS.md`; only Section 31 and future
version metadata are affected. Puzzle reservation lifetimes and other sections
are unchanged. No frozen v0.8 file has been created.

The previously recorded full local suite remains applicable: 465 unit/integration/
security tests; 90 authenticated and three persistence browser tests; PostgreSQL
concurrency/restart; build, TypeScript, lint, formatting and secret checks.
The initial general suite had three animation timeouts; all affected cases passed
sequentially without code/assertion/timeout changes. This preflight reran four
focused lifetime/rollback/presentation tests successfully, including the stronger
post-rollback acceptance boundary. Only test, documentation and release metadata
changed during preflight; production code and migration are unchanged.

STOP: hosted migration, specification freeze, commit, push and deployment have not
been performed. Final publication/specification authorization is still required.

## Publication authorization

The product owner subsequently authorized publication, hosted migration and the exact
v0.8 freeze. Production was rechecked at 821f435; only migration 202610200001 was
pending. Supabase daily physical backup dated 2026-10-16 12:31:02 UTC was available.
A full restore can lose subsequent writes; use the tested compensating function/default
rollback for this change, preserving issued deadlines. Storage objects are not covered
by that backup and are not changed here. Function bodies, baseline default/CHECK and
RLS matched the version-controlled chain. Non-secret comparison evidence for 102
existing invitation deadlines is held in ignored local release artifacts.
Migration and compensation have bounded five-second lock and sixty-second statement
timeouts; failure rolls back their transaction. No production test records are created.
