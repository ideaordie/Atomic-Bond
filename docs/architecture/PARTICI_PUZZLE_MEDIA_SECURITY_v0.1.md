# PARTICI-PUZZLE — media authority audit

Audit date: October 12, 2026. Status: conditional architecture recommendation,
NOT approval to provision or deploy. Gameplay and SQL candidates are unchanged.
Only local tests and this documentation were extended. No puzzle-media credential
was created or inspected, no application hosted DDL/data mutation was performed, and no commit or
deployment occurred. Read-only catalog queries used the existing authenticated
Supabase CLI; its ordinary temporary management-login initialization is separate
from creating an application media identity.

## Recommendation

Retain the dedicated read-only Supabase media role as the preferred design,
subject to download-only policy hardening and a separately approved token issuer.
Do not use a service key or project signing key in the application. Do not call
the current candidate production-verified: the role and bucket do not yet exist
in production and no signed custom-role HTTP request was made.

## Exact current candidate authority

The version-controlled candidate creates `atomic_bond_puzzle_media` as NOLOGIN,
NOINHERIT, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS. A
trusted database operator applies it only after approval. Membership is granted
to `authenticator`; no ordinary owner can enroll or mint this identity.

The server presents a Supabase-valid signed JWT with that role in the Storage
Authorization header, plus the project's publishable API key. PostgreSQL NOLOGIN
does not stop this API role-switching mechanism; it prevents password login as
the role. The app's decoded-token role/expiry check is only defense against
misconfiguration. Supabase signature verification, SQL grants and RLS are the
actual access controls.

| Operation/resource                | Current candidate boundary                                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Bucket                            | Exactly `puzzle-sources`; it must be private                                                                     |
| Objects                           | Name exactly `private.puzzles.source_key::text                                                                   |     | '.png'`, with scheduled end plus 30 days still in the future |
| Future scheduled sources          | Allowed currently; no start-time condition exists                                                                |
| Read/download                     | Allowed for qualifying source objects, including full hidden source image                                        |
| List                              | Allowed by the current SELECT policy; this is not download-only                                                  |
| Metadata                          | SELECT includes Storage object metadata, not just bytes; uploader metadata must not contain participant identity |
| Upload/overwrite/copy/move/delete | No INSERT/UPDATE/DELETE grants; denied, not merely omitted by app code                                           |
| Bucket administration             | No bucket table privileges                                                                                       |
| Other private buckets             | No matching RLS policy; denied                                                                                   |
| Application/Auth tables           | No table privileges, including identities, Bonds, Pulse, Doodle and administrator membership                     |
| Application functions             | Only `public.puzzle_media_resolve` and `private.puzzle_source_available` are executable in the tested candidate  |
| Built-in/Storage helpers          | PUBLIC execution can remain available; these are not equivalent to application-data privileges                   |

There is no grant of anon/authenticated membership. Supabase's example inherits
anon; this candidate deliberately avoids inheriting unrelated public API rights.
If actual Storage requires additional permissions, inspect and add only the
specific managed helper/grant after review. Do not silently grant anon or a broad
role to make it work.

The source-availability helper discloses only whether an opaque registered name
qualifies. Ticket resolution exposes source name/crop index only to the media
server after rechecking session, lifecycle and piece authorization. A stolen
media token can bypass the application ticket path and read/list all qualifying
source images directly. Ticket validation does NOT narrow the token itself to
one crop. Unrelated private application records remain outside its SQL authority.
Already public buckets are publicly accessible regardless of this identity;
no credential design can make public content inaccessible to its holder.

## Findings and proposed hardening (not applied)

1. Restrict Storage SELECT to the authenticated-download operation with
   `storage.allow_only_operation('object.get_authenticated')`, plus the existing
   bucket/object predicate. This should deny listing, signed-link creation and
   transformation operations; verify each actual HTTP endpoint before acceptance.
2. Add a source start-time condition for media reads. Administrator source
   preview/upload should use a separately reviewed authoring path, not widen the
   runtime reader to future images.
3. Keep source names opaque and all stored metadata free of private participant
   information. A human-owned upload can carry uploader identifiers in Storage
   metadata; review that during upload design rather than assume stripped PNG
   metadata also strips Storage metadata.
4. Verify inherited PUBLIC/default privileges at each rollout. NOINHERIT does
   not remove PUBLIC privileges. Do not claim the token can execute literally
   only two functions across all PostgreSQL schemas.
5. Consider an issuer-controlled token ID allowlist checked by both the Storage
   policy and resolver for individual early revocation. This is an additional
   proposed boundary, not present in the candidate. Otherwise revocation is
   role-wide or requires waiting for expiry.

Current SELECT authorization may permit server-generated signed download links
through Storage endpoints. Such links can survive the custom-role token's expiry.
The app never requests them, but that is insufficient against token compromise.
Download-only operation enforcement and negative signed-link tests are therefore
production gates, not optional app conventions.

## Hosted compatibility evidence

Safe read-only queries against the linked production project confirmed:

- `storage.objects` has RLS enabled.
- `storage.allow_only_operation` and `storage.allow_any_operation` exist.
- The hosted `storage.operation` reads the Storage operation context; the helper
  matches normalized exact operation names and denies an unset operation.
- No existing public/private application function grants EXECUTE to PUBLIC, and
  no public/private/auth/storage tables grant table access to PUBLIC.
- No Storage policy targeted PUBLIC in this inspection.
- Existing publicly executable Storage helpers inspected are invoker functions;
  listing/size helpers remain subject to the calling role's table rights/RLS.
- The proposed media role, puzzle tables and puzzle bucket do not exist.

Supabase officially supports custom-role JWTs for Storage and RLS-based access.
The proposed mechanism is supported in principle. A real end-to-end success test
cannot be honestly claimed without provisioning the role/policy, a private test
object and a valid signed token. Creating a temporary role and rolling it back
would still be hosted DDL, outside this checkpoint. No such workaround was used.

The hosted inspection verifies compatibility prerequisites beyond local mocks;
it does not certify the uncreated role's effective runtime privileges. Recheck
catalog grants and private-bucket configuration during an approved staged test.

## Credential lifecycle

- **Provision:** approved migration creates the role/policy; a trusted external
  issuer signs short-lived role JWTs. Current adapter permits at most one hour
  remaining. Never give the application the project JWT signing secret, service
  key, or permission to choose arbitrary role claims.
- **Store:** server-only secret delivery with environment separation, no NEXT_PUBLIC
  setting, browser bundle, repository, URL, build output or logs. Runtime secret
  retrieval/refresh is preferable to hourly manual Vercel redeploys. The issuer
  and secret-delivery mechanism are not yet selected or provisioned.
- **Rotate:** issue a fresh restricted token before expiry, validate it using a
  synthetic known object and negative access checks, replace atomically, and let
  the old token expire. Fail closed if refresh fails. Reloading environment
  configuration alone does not revoke a previously issued bearer token.
- **Revoke:** close the tile endpoint, revoke media SELECT/resolver grants and
  role membership as a reviewed emergency operation. Disabling authenticator
  membership alone may not cover every managed Storage connection path; verify
  actual denied Storage requests. Already downloaded data cannot be recalled.
  Avoid global signing-key rotation for an isolated media-token incident.
- **Recover:** provision a replacement restricted token only after identifying
  the compromise, checking grants and testing denial boundaries. Reconcile
  restored RLS/roles and retention queues before reopening. A restored old policy
  must not unintentionally reauthorize an unexpired compromised token.
- **Deploy:** keep intake/route unconnected until issuer, Storage tests, upload
  readiness and cleanup authority are approved. Read-only media credentials must
  never double as upload/deletion credentials.
- **Monitor:** aggregate authorized/denied tile counts, latency, bytes, ticket
  replay, throttle events and token-expiry failures. Scrub Authorization, cookies,
  ticket/request bodies, source paths, signed URLs and image bytes from app/APM
  logs. Inspect provider logging configuration in the staged test. No participant
  identity or contribution-history analytics are needed.

The issuer is a material unresolved operational requirement. Supabase's documented
example uses project signing authority; moving that authority to the tile server
is rejected. If a suitably isolated issuer is impractical, use an alternative
rather than a broad key disguised as a dedicated variable.

## Tile authorization results

18 targeted integration/unit tests passed, plus native PostgreSQL concurrency and
restart checks. The tests cover:

| Case                                | Local result                                                                                               |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Anonymous/invalid session           | Denied; removed session invalidates outstanding ticket                                                     |
| Inactive owner                      | New requests denied; outstanding ticket unusable after deactivation                                        |
| No reservation/arbitrary UUID       | Denied for unplaced piece                                                                                  |
| Expired reservation                 | Denied                                                                                                     |
| Other owner's reservation           | Denied                                                                                                     |
| Arbitrary crop coordinates          | Ignored as authority; resolved region comes from private piece mapping; invalid region/path fails closed   |
| Full image before completion        | Denied, including incomplete expired puzzle                                                                |
| Completed image                     | Authorized for eligible owner within retention                                                             |
| Placed tiles                        | Available to eligible shared-puzzle viewers, including retained closed board                               |
| End plus 30 days                    | Unavailable regardless of cleanup timing                                                                   |
| Repeated requests                   | Single-use tickets; maximum 32 outstanding and 120 requests/minute                                         |
| Eight concurrent ticket redemptions | Exactly one succeeds on native PostgreSQL                                                                  |
| Role privileges                     | No table access except RLS-limited Storage SELECT; no application RPC access except two approved functions |
| Image pipeline                      | Bounded raster, exact crop, no-store and generic non-secret errors                                         |

Authorization linearizes at ticket redemption. A response already authorized
and in flight cannot be recalled by a later deactivation/expiry; no design can
erase bytes already received. The pipeline has bounded fetch time and no cache.
No production HTTP tile route exists yet, so ingress, unknown-parameter rejection,
service-worker behavior and provider cache/logging require actual endpoint tests
before launch. No hosted participant/session manipulation was used in this audit.

## Alternatives

| Design                                          | Security                                                                                                                                             | Operations/cost/performance                                                                                                                                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dedicated Supabase read role                    | RLS restricts bucket/objects; compromised reader exposes retained sources, not general account data                                                  | One source/week, crop CPU and source-download overhead; custom JWT issuer/rotation adds complexity                                                                          |
| Pre-generated private pieces with owner RLS     | Each owner accesses only granted pieces; source kept outside participant-accessible bucket                                                           | Avoids per-request crop CPU; 25 objects/puzzle plus source, more upload/cleanup and policy work; changes approved one-source/no-piece-files direction and requires approval |
| Isolated media object store/service             | Provider IAM can scope read to one bucket/prefix; compromise isolated from Atomic Bond database                                                      | Separate deployment/credential/monitoring, possible minimum infrastructure cost; still needs owner authorization and crop compute                                           |
| Private database source bytes behind ticket RPC | No Storage credential; SECURITY DEFINER returns only authorized source to an isolated crop service, or performs safe cropping with supported tooling | Larger DB/backup footprint and bandwidth, no established safe SQL image decoder; material architectural change, not preferred                                               |

No new provider price commitment is made. At one optimized weekly image, issuer
operations and request CPU/egress are more consequential than object-count
storage cost. Compare measured deployment costs only after selecting a viable
credential issuer. Prefer the restricted Supabase design if it passes the staged
HTTP matrix; otherwise an isolated media service provides the clearer compromise
boundary. Pre-generated pieces are a viable separately approved tradeoff.

## Remaining production requirements

Approve the download-only/future-source hardening and token issuance design;
then separately authorize an isolated hosted compatibility test with synthetic
artwork. Test download, list, signing, transform, upload, overwrite, move, delete,
other buckets, unrelated RPCs, token expiry and emergency revocation. Audit
effective grants after application. Complete source ingestion, cleanup and
runtime integration only after that evidence passes. This audit does not approve
a broad credential or production deployment.

Sources: [Supabase custom roles](https://supabase.com/docs/guides/storage/schema/custom-roles),
[Storage access control](https://supabase.com/docs/guides/storage/security/access-control),
[operation helpers](https://supabase.com/docs/guides/storage/schema/helper-functions),
[Storage schema](https://supabase.com/docs/guides/storage/schema/design).
