# Account deactivation and reactivation — Task #9.3

Status: controlled-acceptance candidate; both reviewed migrations are applied.
Controlled live acceptance remains pending. Do not describe v0.9.3
as accepted before the live cycle.

Hosted migration checkpoint: history matches all nine repository migrations through 202610050002. Before/after Atom, Bond, preference and number-ledger integrity hashes
match. Six ACTIVE Atoms, eight confirmed Bonds and sequence value nine are unchanged;
Atom #5 remains ACTIVE and Atom #8 remains DELETED. No live lifecycle transition
has been performed.

Local verification: 224 unit/integration/security tests, native PostgreSQL
concurrency/restart checks, client security boundary, formatting/lint/TypeScript,
production build, 81 main browser cases (two animation timing cases passed an
isolated rerun), 3 persistence cases and 48 Auth/QR/PWA cases passed. The final
session-timing and presentation fixes also passed six targeted lifecycle browser
cases at all three viewports. Secret scan passed. Physical PWA/live acceptance
remains pending. Atom #5 is explicitly approved; its initial weekly preference is
OFF, with one confirmed Bond and no active Pulse/invitation. Preserve that intent.

## Product and retained data

DEACTIVATED is explicit reversible owner choice. DORMANT remains a distinct future
system lifecycle concept. DELETED remains terminal under Task #9.2; no fingerprint,
email-recovery linkage or restoration of deleted accounts is introduced.

Deactivation retains the private verified identity/Auth relationship, profile,
Home Region, number, preferences and existing confirmed Bonds. The public
projection exposes only permanent number, lifecycle, creation time and structure;
alias, X and geographic metadata are omitted. Pulse is deleted permanently. Active
invitations are cancelled and their encrypted recovery secrets erased. Reactivation
does not resurrect Pulse or invitation tokens. No automatic inactivity policy runs.

Profile & Preferences places reversible deactivation before the more destructive
permanent deletion action. Deactivation requires an explanation and confirmation.
Deletion retains typed confirmation and ten-minute recent passwordless verification.

## Authority and sessions

Two owner-only RPCs, `deactivate_my_account()` and `reactivate_my_account()`, take no
Atom identifier. They resolve ownership through the authenticated, verified private
identity. Anonymous clients and the growth database role cannot execute them.
Existing owner network writes still require ACTIVE/DORMANT. A separate private
account-owner helper permits authenticated DEACTIVATED account management/deletion.

Deactivation establishes a private per-Atom authentication cutoff, retained across
reactivation. Previously issued JWTs cannot regain authority by waiting for the
account to reactivate or by refreshing a JWT. A subsequent trusted OTP/magic-link
authentication event and matching live Auth session are required. This uses the
existing passwordless architecture, not a second authentication mechanism.
The cutoff has no public serialization or direct client table grants.

After the transaction, the server signs out globally, clears local Auth cookies
and replaces the page with the deactivation completion screen. If external Auth
sign-out fails, the database cutoff already denies old sessions; local cookies are
still cleared. No private identity is erased. A fresh verified login recovers the
deactivated account safely. JWT timestamps have second precision; a matching live
session created after the cutoff also permits same-second verified return. Old
sessions and refreshes do not gain authority from JWT issuance time.
See [Supabase session revocation](https://supabase.com/docs/guides/auth/sessions).

ACCESS MY ATOM and registration with an already owned email resolve the existing
DEACTIVATED identity without allocating a number. Authentication alone does not
activate it. The explicit reactivation page allows REACTIVATE MY ATOM or permanent
deletion without reactivation. Ordinary owner controls remain unavailable until
reactivation. Invitation continuation is preserved through the allowlisted return
path. Repeated transitions are safe; an old revoked session may receive denial
rather than success, without changing the resulting state.

## Graph, metrics and Pulse

Confirmed Bonds retain their IDs and timestamps. Traversal continues through
DEACTIVATED and DELETED structural nodes. Connected Atoms and direct Bond counts
retain their structural meaning; neither is an active-user count. Emotional
coverage excludes DEACTIVATED and DELETED nodes. Public graph projection and growth
regional metrics omit the retained private region of a deactivated participant.
Other participants' topology remains connected even when active regional reach
declines. Profile/location resume normal visibility after explicit reactivation.
The graph is retrieved anew; an old cached network is not restored.

## Weekly email and baseline

Stored weekly ON/OFF and provenance are unchanged. Existing ACTIVE-only eligibility
suppresses deactivated delivery while transactional authentication remains possible.
Unsent reservations are cancelled when deactivating, retaining their unique period
keys even when a previous provider outcome was uncertain. Cancelled jobs cannot
be claimed or sent and do not block future periods. Accepted deliveries and their
unsubscribe actions remain authoritative. Accepted-period history is preserved.
On the DEACTIVATED-to-ACTIVE transition only, the comparison baseline is set to the
current authoritative graph, while sent-period metadata remains intact. An already
ACTIVE reactivation retry does not move the baseline again. Future digests require
ordinary preference, lifecycle and meaningful-growth eligibility. No backlog,
reactivation email, schedule change or automatic resubscription is introduced.

## Concurrency and failure recovery

Both transitions use the existing transaction advisory lock shared by owner writes,
deletion and growth operations. Pulse/Bond/invitation races either commit before
deactivation or are rejected afterward; final deactivation contains no Pulse or
active invitation. A provider-authorized send with a live lease must settle before
deactivation; the operation reports delivery in progress without changing state.
An external email already handed to the provider cannot be recalled. Prepared but
unauthorized sends become invalid. No database lock spans external HTTP.

Deactivation cleanup and state transition are one transaction. Reactivation/profile
visibility/baseline are one transaction. Failure cannot turn DEACTIVATED into
DELETED. Deletion removes the cutoff as part of its existing identity cleanup and
retains its separate recoverable Auth-admin cleanup. DELETED cannot reactivate.

## Migration preview

`202610050001_deactivated_state.sql` adds the enum value in its own commit, before
`202610050002_account_deactivation.sql` uses it. The latter adds an RLS-protected
private account_lifecycle table, updates the Atom lifecycle constraint, adds the
session/account-owner helpers and two owner RPCs, and replaces activation,
my-Atom, deletion, graph traversal/public projection and growth-metrics functions.
The growth delivery status constraint gains cancelled; the existing private
evaluate/reserve/claim helpers skip cancelled work while retaining period keys.
All new functions have fixed empty search paths and no caller-controlled SQL.
The new public functions are owned by postgres with explicit authenticated-only
execution. There are no new secrets, tables exposed to clients, broad table grants,
Auth administration privileges or scheduler changes.

Migration application does not update participant rows, Bonds, numbers, preferences
or growth baselines. Cleanup DELETE statements exist only inside the authorized
transition functions. Preview local/hosted history and compare read-only production
integrity before and after application. Atom #8 must remain DELETED. Stop for any
unexpected mutation or migration. Never reset sequences.

## Acceptance procedure and limitations

Use an explicitly designated disposable ACTIVE participant, never Atom #3, deleted
Atom #8 or another genuine beta participant. Record non-private baseline counts;
verify optional profile, Pulse, preference and any controlled Bond/invitation.
Complete ACTIVE → DEACTIVATED → verified access (still DEACTIVATED) → explicit
ACTIVE. Verify same owner/number/profile/Bond IDs, private public projection,
neutral Pulse, cancelled old QR, preserved preference and current baseline.
Then test a new Pulse/invitation without leaving unintended test state. Compare
unrelated production integrity and existing Tuesday schedule unchanged.

Permanent deletion while deactivated is covered locally; no further destructive
live test is authorized by this task. Browser tests cover 390×844, 768×1024 and
1440×900. Installed physical PWA closure/reopening remains manual acceptance;
installation itself is unchanged and private routes remain network-only. Do not
claim physical-device or real-email success from local fixtures.
