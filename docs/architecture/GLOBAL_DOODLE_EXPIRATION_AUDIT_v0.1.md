# Global Doodle expiration audit — Task #12.5

Production audit: October 13, 2026. Patch v0.13.1.

## Finding

The hosted `submit_doodle` already matches migration
`202610130001_doodle_seven_day_lifetime.sql`: database publication time plus
168 hours for both expiration and initial cleanup eligibility. Four retained
PUBLISHED drawings had that lifetime. One retained PUBLISHED drawing had a legacy
24-hour deadline. Task #12.4 deliberately preserved preexisting timestamps.
This legacy deadline is the verified explanation for the shorter-lived record;
the audit found no current 24-hour limit on new submissions.

There were no expired records remaining in PostgreSQL, no retained finalized
candidates, and no missing last-submission records in the retained account summary.
That summary is not a complete historical submission ledger: the number or cause
of earlier physically deleted drawings cannot be reconstructed from it. No backup
restoration, guessed content recreation or frozen-score reopening is attempted.

## Exact audit coverage

- Submission and the `publish_doodle` request wrapper use the same 168-hour RPC.
- WORLD pagination and refreshed items use stored `expires_at`; MY NETWORK uses
  that same time condition plus the owner's authorized connected component.
- Frontend filtering and expiration timers use server-returned deadlines, with
  no hard-coded 24-hour live limit. The completion label is now LIVE FOR 7 DAYS.
- Appreciation requires PUBLISHED, ACTIVE author, unexpired deadline, no self-vote
  and unique voter/drawing. Hall scores finalize only at that stored deadline.
- Five-vote candidates retain their separate seven-day private review period;
  administrator approval, Top 10 replacement and active Hall retention are unchanged.
- Actual Cron command calls `private.cleanup_doodles(500)` every five minutes.
  It finalizes expired publications before purging eligible non-PUBLISHED/non-HALL
  rows. Its 24-hour clause removes request-throttle bookkeeping, not drawings.
- Moderation and account lifecycle removal remain independent of normal expiry.
- Frozen Master Spec v0.5 already specifies 168 hours. No amendment is needed.

## Approved historical correction

The product owner explicitly approved extension of exactly one intact,
unfinalized, unrestricted ACTIVE-owner drawing. Migration
`202610170003_doodle_legacy_deadline.sql` targets its exact UUID and original
publication timestamp, takes the existing lifecycle/Doodle lock, and aborts if
eligibility changed. Only expiration and initial purge deadline change:

- Published: October 12, 2026, 23:47:12.649486 UTC.
- Previous expiration: October 13, 2026, 23:47:12.649486 UTC.
- Corrected expiration: October 19, 2026, 23:47:12.649486 UTC.

The migration verifies all other row fields and appreciations are unchanged.
At audit it had one appreciation. There is no broad historical update, data deletion,
new role, credential, policy or change to the submission cooldown/global limits.
Ordinary content becomes cleanup-eligible after expiration; qualifying candidates
retain the existing additional seven days. Removed/rejected content retains its
separate cleanup policy. Puzzle cleanup and Tuesday Weekly Growth are untouched.

## Verification

Database tests cover 24 hours, 72 hours, immediately before 168 hours and the exact
168-hour exclusion, both feed scopes, appreciation, candidate freezing/review,
active Hall retention, multiple drawings, hourly cooldown and lifecycle/moderation.
The one-record migration has preservation, removed-content and finalized-score
abort tests. Existing security, concurrency, browser and production build checks
are rerun for the patch; operational results are reported with the release.

Hosted verification confirms all five retained published drawings have 168-hour
lifetimes. The corrected record remains PUBLISHED with its one appreciation and
October 19 deadline. Both production feed scopes load successfully. Hosted migration
synchronization and successful five-minute Doodle/Puzzle cleanup runs were checked.

Regression evidence: 410 passing unit/integration cases plus 29 passing rerun cases
in three corrected fixture suites. Generic fixture loaders now exclude the two
production-specific data corrections; dedicated tests exercise their guards.
Native PostgreSQL concurrency/restart checks, the production owner-session browser
suite at all three reference sizes, TypeScript, lint, formatting, production build,
secret scans and privileged-client boundary checks pass. Local review database
servers were restarted to load the updated fixture migration exclusions.
The complete Doodle browser suite passes 54/54, including Light/Dark at
390×844, 768×1024 and 1440×900; the owner-session suite adds 3/3 passing cases.
