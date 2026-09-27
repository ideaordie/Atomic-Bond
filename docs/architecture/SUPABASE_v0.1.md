# Supabase Persistence & Identity v0.1

Task #6, application 0.6.0. Master Specification v0.2 remains authoritative.
The approved frontend baseline is commit `6d78f5e`: Feel Your Network is a manual
toggle, results open only on activation and remain independently closable, and
outgoing Pulse presentation lasts 15 seconds. This task does not change those
interactions or implement Task #7 authentication/email delivery.

## Runtime and service boundaries

`ATOMIC_BOND_DATA_MODE=mock` explicitly selects the unchanged in-memory
participation services, 1,000-Atom graph and deterministic Pulse fixtures.
`supabase` selects asynchronous application adapters in `services/supabase`.
Only the data composition root selects providers; components never query tables.
The existing synchronous mock contracts remain compatible. The persistent
adapters use promises and omit mock-only methods such as `simulateVerification`
and `existingChoices`; these cannot be valid production ownership mechanisms.

SupabaseAtomService, SupabaseBondService, SupabasePulseService,
SupabaseLocationService and SupabasePreferenceService call named PostgreSQL RPCs.
DeferredNotificationService implements the notification boundary but throws
explicitly instead of pretending to send email. No Resend delivery occurs.

`/explore` is request-rendered. In Supabase mode it loads a real public component
by `?atom=<decimal public number>` or the first activated Atom. Empty databases
display an empty-network state. Anonymous exploration cannot send Pulse, create
Bonds or claim an Atom as "you". Task #7 will supply verified access tokens to
the existing adapters and connect the existing ownership UI. These mutations
are implemented and database-tested now, but no production sign-in or simulated
verification action is exposed in Supabase mode.

Development (`next dev`) defaults to the explicit development mock context.
Outside development the mode must be supplied. Missing/invalid mode, missing
Supabase URL/key, database errors and oversized graph reads fail clearly;
there is no fallback to fixtures. Hosted synthetic previews can explicitly use
`mock`, but they are not real production networks. CI's browser server explicitly
selects mock; deterministic tests never require a hosted project.

## Configuration

`.env.example` contains blank names only. Local values belong in ignored
`.env.local`; configure Vercel Development/Preview/Production separately:

- `ATOMIC_BOND_DATA_MODE`: `supabase` for real data; `mock` for synthetic demos.
- `NEXT_PUBLIC_SUPABASE_URL`: HTTPS project URL (loopback HTTP allowed for local tests).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: anon JWT or publishable key. Service-role JWTs
  and secret keys are rejected. The SDK additionally relies on Supabase to
  validate real credentials; decoding the role is not authentication.
- Resend and external location-provider placeholders remain unused.

No service-role key is used by the app, browser or tests. The dedicated Supabase
project's GitHub connection does not configure these environment variables or
prove migrations have deployed. No hosted configuration/schema change was made
as part of implementing this repository foundation.

## Schema

| Relation                                        | Purpose and integrity                                                                                            |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `public.atoms`                                  | Internal UUID, nullable unique bigint public number, alias/X, canonical location, lifecycle, timestamps/activity |
| `private.atom_numbers`                          | Append-only number ledger backed by `private.atom_number_seq` (bigint, NO CYCLE)                                 |
| `private.atom_identities`                       | Unique normalized email and Auth user UUID; verification metadata; one identity per Atom                         |
| `public.locations`                              | Unique canonical key, city/region/country/code, display name, optional bounded place centroids                   |
| `public.bonds`                                  | Canonically ordered UUID endpoints, unique unordered pair, no self-Bond, status and invitation provenance        |
| `public.bond_invitations`                       | Creator, unique SHA-256 token hash, status, five-minute expiration, acceptance metadata                          |
| `private.invitation_secrets` / `invitation_key` | Encrypted temporary token recovery for the inviting owner; not in the exposed API schema                         |
| `public.emotional_pulses`                       | One current record per Atom, eight-state enum, exactly 24-hour lifetime                                          |
| `private.notification_preferences`              | Required transactional access; weekly/monthly/disabled digest; optional Pulse notifications                      |

No migration seeds Atoms, Bonds, Pulses, fake identities or synthetic locations.
Canonical places must be supplied by reviewed data migrations or a later trusted
provider import. Location mutations are not granted to clients. Their centroids
are places, never user GPS, and neither centroids nor city are in the public
Atom graph projection. The canonical location search is a separate selection
path and can include city names. External provider integration remains deferred.

## Identity, numbers and lifecycle

`begin_atom` binds to `auth.uid()` and reads email from the trusted `auth.users`
record, not browser-supplied email, ownership UUIDs, verification flags or
editable user metadata. It creates PENDING, unnumbered records. Repeated calls
by the same identity return the same Atom, including when opening a new Bond
invitation. Conflicting Auth users with the same normalized email fail closed;
they are not silently linked. Task #7 must recover the existing verified account.

Canonical identity email policy trims surrounding ASCII whitespace and lowercases
the complete address. Atomic Bond intentionally treats email identity as case
insensitive; local-part case-sensitive
mailboxes cannot establish distinct Atomic Bond identities. Dots and plus tags
are retained. No Gmail/provider alias rules, DNS guesses or Unicode provider
transformations are applied. The unique database constraint is authoritative,
including pending identities, preventing duplicate reservations under concurrency.
JavaScript normalization is a convenience; database normalization is independent.

`activate_atom` checks the trusted Auth email confirmation timestamp and matching
normalized email. It locks the identity/Atom, records verification, then draws
the public number from the sequence only for the first activation. Repeated or
concurrent activation retains the number. Numbers are sent to JavaScript as
decimal strings, including values beyond Number.MAX_SAFE_INTEGER. Sequence gaps
are normal. There is no MAX+1, client-selected number, renumbering or reuse.
The number ledger rejects update/delete and Atom deletion is blocked while
retention policy is deferred. DELETED Atoms cannot reactivate or lose their number.

PENDING cannot participate. ACTIVE participates normally. DORMANT retains Bonds
and graph presence and may reactivate after verified owner activity. DELETED
is reserved, hidden from graph/Pulse access and cannot be selected by client
mutations. No automatic dormancy threshold, deletion or warning email exists.

Activation, owner profile/preference updates, invitation creation/retrieval,
recipient Bond confirmation and sending Pulse update `last_active_at` and
reactivate DORMANT owners. Anonymous graph/profile/location/invitation reads do
not update it. No browser heartbeat/public visit is treated as owner activity.

## Invitations and Bond confirmation

Create Bond represents creator consent. The database locks that creator's Atom,
retires any expired ACTIVE invitation, then returns the existing unexpired
general invitation or creates one with 32 cryptographically random bytes.
A partial unique index on creator where status is ACTIVE provides an additional
race barrier. Time is checked during every resolve/accept; it is not placed in
an invalid time-dependent index predicate.

The 64-character hex secret forms `/bond/<secret>`. A future QR encodes that URL;
neither UUIDs nor public Atom numbers are secrets. Lookup uses SHA-256. Returning
the same invitation after a reload requires recovering the same secret, so an
encrypted copy is kept in a private table under a database-generated private key.
Only the authenticated creator's controlled RPC returns the raw token. Ciphertext
is removed on acceptance/cancellation and on expiry retirement during the next
creation. Unused expired ciphertext may persist until that cleanup; the expired
secret is unusable. No raw token is stored in invitation rows, public graph data,
profiles or logs. This protects against an invitation-table leak, not compromise
of a database administrator who can access both key and ciphertext. Future key
rotation must preserve live invitations or explicitly invalidate them.

An invitee resolves only creator public number and expiration. A verified owner
must explicitly confirm. Acceptance locks the invitation, checks current expiry,
status, eligible creator and non-self recipient, inserts the canonical Bond and
marks the invitation accepted in one transaction. Unique ordered endpoint keys
prevent duplicate/reversed pairs, including competing invitations. Reuse and
concurrent acceptance have one winner. A failed duplicate confirmation does not
consume an otherwise valid invitation. Cancellation requires creator ownership.
All pending/revoked Bonds are excluded from graph calculations.

New recipients retain invitation context through Task #7 verification:
onboarding → PENDING identity → trusted verification → activation/number →
explicit confirmation. Existing verified users resolve their existing account
and Atom; they never need another Atom for another invitation. Task #6 does not
send a verification message or bypass this gate in production.

## Pulse and public/private security

All eight states (including CURIOUS) are database enum values. `send_emotional_pulse`
derives the owner, timestamps on the database, and atomically replaces the single
record. No emotional history is accumulated. Reads require created_at ≤ now <
expires_at, independently of cleanup or a client's clock. Connected retrieval
uses confirmed graph reach from the verified caller, never an arbitrary viewer
UUID supplied by the browser. Disconnected, pending and deleted Atoms are excluded.

Every application/private table has RLS enabled with default deny and no client
table grants. Public profiles/graphs, canonical location selection and limited
invitation resolution are exposed only through allowlisted RPCs. All other RPCs
require the authenticated role and recheck trusted ownership. No client may insert
confirmed Bonds, edit another Atom, set lifecycle/verification or write another
Atom's Pulse directly. Each SECURITY DEFINER function pins an empty search_path,
qualifies relation/function names, and has explicit execute grants; private
helpers have no PUBLIC/anon/authenticated grants.

`PublicAtomProfile` and the GraphData adapter explicitly copy safe fields only:
public number, optional alias/validated X, creation date, coarse region/country,
and calculated structural fields. Database UUIDs, email, Auth IDs, verification,
activity timestamps, preferences, tokens, centroids and emotions are omitted.
X URL construction/ownership language remains unchanged. Pulse is a separate
authorized service result; it is never attached to an unrestricted public profile.

Real graph retrieval returns the full confirmed component up to an explicit
5,000-node initial limit, preserving truthful BFS/reach. Larger components fail
clearly rather than silently presenting partial counts as complete. Existing
visualization aggregation remains responsible for display scale.

## Reproducible migrations and checks

Schema source: `supabase/migrations/202609260001_atomic_bond.sql`. Apply migration
files in chronological order; never paste schema edits into production separately.

Local Supabase stack, with Docker and the Supabase CLI installed:

```sh
supabase start
supabase db reset --local
supabase migration list --local
```

The checked-in config disables seeding. Reset is for a disposable local project;
do not use `--linked` reset against the hosted project. The required Supabase
Auth schema/roles are provided by the stack, and pgcrypto is installed into
extensions by the migration. No undocumented schema prerequisite exists.

For a brand-new hosted Atomic Bond project, after reviewing the exact target:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --dry-run
supabase db push
supabase migration list --linked
```

Use one migration deployment authority: either a reviewed CLI release or the
configured Supabase GitHub integration. Confirm its behavior/environment before
assuming a Git push applies migrations. Never repair migration history merely
to hide schema drift. Add future changes as new migration files. Use forward
corrective migrations and backups for persistent-data rollback; a Vercel rollback
does not roll back PostgreSQL. Never reset the public-number sequence or ledger.

No hosted Supabase credentials are required for normal verification:

```sh
pnpm test:db
pnpm test:db:concurrency
pnpm check
```

Database tests execute unchanged migrations in PGlite PostgreSQL with pgcrypto,
and controlled Auth-role fixtures outside production migrations. Native embedded
PostgreSQL tests use separate loopback connections for true races: identity
creation, public numbering, invitation reuse, single-use acceptance, reverse
Bond uniqueness and restart persistence. Both create disposable databases and
never read a remote DB URL. CI runs both. Native tooling is tested on Windows
x64 and configured for Linux x64 CI; package install scripts only restore bundled
PostgreSQL symlinks. The lightweight suite serializes calls and is not described
as a concurrency proof. Additional browser tests run Supabase-mode public and empty-network views through
a test-only PostgREST-shaped transport backed by the migrated database.
Hosted Auth/PostgREST integration is a separate acceptance
check after project configuration; local tests cannot validate hosted settings.

## Task #6 verification record

Verified locally on Windows x64: formatting, lint, TypeScript, 130 unit/graph/service/security/database tests, native PostgreSQL concurrency and restart checks, production build, 66 existing browser regressions, and 3 Supabase-mode browser checks. Reviewed captures at 390 x 844, 768 x 1024 and 1440 x 900. A final public-mode geography-label correction was rebuilt and all 3 affected browser checks passed again. Frozen-lockfile installation also succeeded. The Master Specification and deterministic graph fixture are unchanged.

Hosted Supabase migrations, environment configuration, Auth and PostgREST acceptance remain unverified; this record covers repository/local verification only.

## Task #7 handoff

Implement secure signup/passwordless sessions, verification delivery and callbacks,
invite context across verification, account recovery and email-change rules. Bind
adapter access tokens to verified sessions; never accept arbitrary owner IDs or
activate from client flags. Enable Supabase email confirmations, review redirects,
rate limits, abuse/CAPTCHA controls and session handling before exposing signup.
No anonymous Atom creation, account enumeration or development verification RPC
exists here. Add authorized UI loading/error states when connecting mutations.

Before broad production use, review hosted grants/security advice, token-bearing
URL referrer/log redaction, canonical location import provenance, retention/key
rotation and limits under real workloads. Dormancy schedules, deletion/retention,
Return Pulse, QR scanning, external location provider, custom DNS and real Resend
delivery remain outside this task.

Official references:
[Supabase functions](https://supabase.com/docs/guides/database/functions),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[migration workflow](https://supabase.com/docs/guides/deployment/database-migrations),
[PGlite extensions](https://pglite.dev/extensions/).
