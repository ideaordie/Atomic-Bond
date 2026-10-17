# Emergency recovery to v0.16.2

Authorized application recovery from v0.16.3.1 (`a0c890255a9273c50358d40ee8d11faf12b21b65`)
to the exact application behavior of v0.16.2 (`2a5651bca639b825c0b199bd6349458b2c42f0e9`).

## Preflight and method

Vercel confirmed the source deployment Ready/current. Local main and origin/main
matched with a clean working tree. The target commit is the original Universal
24-Hour Bond Invitations release. Neither later release changed schema/migrations,
dependencies, CI workflow, or frozen Master Spec v0.8.

Read-only hosted verification: 30 migrations, latest `202610200001`; the creation
function uses 86400 seconds, default is 24 hours, and the invitation CHECK bounds
expires_at to created_at plus 24 hours. The database is compatible with the target.
No production records, policies, schedules, environment settings or secrets are changed.

Apply `git revert --no-commit a0c8902 e98cbe7`, preserve historical incident/proposal
and release records, add this recovery record, and commit the rollback on main.
No reset, force-push, history rewrite or database rollback. Production application,
fixtures, tests and package metadata must have an empty diff against 2a5651b.
The existing encryption secret remains provisioned but is unused by restored code.

## Compatibility and participant guidance

The restored email hook issues the original v0.16.2 authentication-link format.
Already issued encrypted v0.16.3/16.3.1 authentication emails are incompatible:
request a fresh ACCESS MY ATOM email after deployment. Existing owner sessions,
Atoms, Bonds and invitation deadlines are preserved.

v0.16.2 may lose pending Bond invitation context during passwordless authentication.
Sign in first, then reopen the original, still-valid Bond invitation. ACCEPT BOND
remains explicit. This rollback does not claim to fix the whole mobile workflow.
Old open browser/PWA tabs should be refreshed before requesting a new email.
Physical-device verification and actual email delivery require manual acceptance;
automated production verification must not create accounts, emails, invitations or Bonds.

## Verification and failure handling

Verify exact target-code equivalence, format, secret scan and production build.
Push the recovery commit, verify Vercel Ready/custom-domain health and the GitHub
Foundation checks result. Verify main equals origin/main and the working tree is clean.
No automatic database rollback or secret rotation is permitted on failure. Stop
and report a deployment/CI discrepancy without unrelated implementation changes.
Final deployment and workflow evidence is reported with the recovery commit.
