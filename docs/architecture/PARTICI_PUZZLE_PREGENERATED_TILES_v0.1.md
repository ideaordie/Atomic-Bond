# PARTICI-PUZZLE — pre-generated private tile comparison

Decision adopted: authorized direct reads are now explicitly accepted. See the
[owner-session integration checkpoint](PARTICI_PUZZLE_OWNER_INTEGRATION_v0.1.md).
The strict-direct-access comparison below records the earlier decision context.

October 12, 2026. Investigation only. This direction supersedes runtime source
cropping as the preferred media proposal. Existing gameplay code, SQL candidates,
frozen Master Spec v0.4 and production are unchanged. No bucket, credential,
migration, commit or deployment was created. Local experiments are disposable
synthetic fixtures under ignored artifacts, not a new production implementation.

## Decision and the direct-access constraint

Pre-generated tiles remove runtime access to the master image and avoid repeated
decoding. Existing owner-session RLS is the simplest authorization mechanism if
direct access to the SAME authorized tile is acceptable. It cannot satisfy an
absolute rule that direct Storage requests must fail while an identical owner
JWT forwarded by the application succeeds. Storage sees the same identity and
operation in both requests. Hidden filenames, CORS, Referer and server-only code
are not an enforceable distinction.

For the requirements literally as written, recommend **pre-generated tiles with
a dedicated restricted runtime reader**, keeping owner authorization at the app
and tile visibility restrictions in Storage RLS. Ordinary authenticated users
would have no runtime-bucket SELECT policy, so direct owner-token downloads fail.
This requires a separately approved restricted-token issuer; no token is
provisioned here. If the product accepts direct requests for only the owner's
already authorized content, choose owner-session RLS instead and avoid a new
media credential entirely. Do not quietly relax the direct-access requirement.

## Private administrator preparation

The proposed server upload route verifies the existing ACTIVE Signal administrator
session. Ordinary participants cannot upload. Bound encoded size (proposed 5 MB),
decoded pixels (proposed 16 megapixels) and dimensions before expensive work;
reject animated/multipage formats, SVG and malformed data. Accept a deliberately
small JPEG/PNG format set after decoder verification. Apply EXIF orientation,
strip metadata, convert to sRGB, and resize/crop to the approved 500 × 500 square
using an explicit admin preview. Re-encode, then cut 25 100 × 100 tiles with
independently random identifiers. Do not encode coordinates/order into names or
return the private filename-to-solution map.

Orientation, resizing and JPEG processing are a proposed pipeline, not verified
features of the current PNG-only prototype. A maintained server image library
and malformed/decompression-bomb/orientation fixtures must be approved and tested
before authoring implementation. No dependency was installed for this audit.

Use a private master bucket (`puzzle-originals`) separate from a private delivery
bucket (`puzzle-tiles`). Discard raw upload bytes after preparation unless a
specific retention need is approved. Keep one normalized private master, 25
opaque tiles and, if serving a single completed image, one separately named
optimized display derivative in the delivery bucket: **27 objects total**.
The display derivative may have identical pixels to the master, but is a distinct
object authorized only after completion or scheduled expiry. The runtime role
never reads the master bucket. Do not claim 25 objects if also retaining master
and completed-image derivative.

Prepare in an unpublished batch; validate hashes/dimensions and exact 25-member
mapping before a database READY transition. Storage uploads and SQL are not one
transaction: failed uploads leave an unpublished batch for bounded orphan cleanup.
Scheduling must accept only READY batches. No overwrite of a scheduled batch;
edits create a new batch. Keep solution mapping private and out of upload errors,
metadata, browser URLs, logs and object names.

Admin upload authority is separate from the runtime reader. Existing admin-session
RLS can scope inserts to owned staging batches; never grant ordinary owners this
right. Do not grant source reads to the runtime identity, even if it also belongs
to an administrator. Source preview is supplied from the current upload process,
not by widening runtime access. Physical cleanup requires a separately reviewed
delete path; read credentials cannot double as cleanup credentials.

## Option 1 — owner-session delivery

The app validates the owner and forwards that owner's existing JWT to Storage.
An operation-specific RLS policy allows only authenticated download of a named
asset after verifying live session, verified ACTIVE Atom, started puzzle, retention
window and either its own unexpired reservation or a placed board piece.
The display derivative is permitted after completion OR scheduled expiry, as
specified in this revision. No listing, signing, transform, upload or deletion
policy is given to ordinary owners. The master bucket has no owner SELECT policy.

This is enforcement by Supabase/PostgreSQL, not just an application filter.
The public API key grants no special authority. No source URL or media secret is
sent to the browser, but the owner can still use their own Auth session outside
the app. A direct authorized read is therefore possible. Unauthorized piece
enumeration remains denied even if an attacker guesses a valid opaque filename.

An app proxy may return private/no-store bytes and mask object paths, but cannot
make bypass impossible or prevent bypass of app-only throttling. Admission limits
must also apply at the authoritative boundary. Single-use app tickets do not
solve this: a Storage policy authorizing the owner directly can be called without
the app ticket. Safe direct-read behavior and provider cache headers must be part
of this option's acceptance criteria.

## Option 2 — restricted reader plus tiles (recommended for strict proxy-only)

The app accepts an owner request, performs session/ACTIVE/game checks and consumes
a short-lived session-bound ticket, resolving only an opaque asset key. It fetches
that object using a restricted server token and returns the bytes without URLs.
Ordinary owner and anonymous roles cannot read the delivery bucket directly.

Proposed media grants: no login/superuser/BYPASSRLS or role inheritance; only
necessary schema USAGE, Storage SELECT under an operation-specific policy, and
the named ticket-resolution function. RLS additionally requires `puzzle-tiles`,
a registered started puzzle within retention, and a tile currently placed or
reserved by an eligible ACTIVE owner. Full-image derivative requires completion
or expiry. Listing, signing, transforms and all mutations are denied. No source
bucket, future puzzle, unrelated table or administrative membership access.

The global media token does not represent a particular participant. Storage can
limit it to the union of currently visible/reserved tiles; the server resolver
still enforces WHICH owner may receive a reserved tile. A stolen token could read
another owner's currently reserved tile if its opaque asset name were known, plus
visible board tiles and authorized ended images. It must not retrieve unrevealed
pieces or the master even with known filenames. This is less exposure than the
original source-reader design but is not a per-owner credential. A per-request
asset-bound JWT could narrow it further at additional issuance complexity.

Use a trusted issuer outside the application, short-lived restricted tokens,
server-only secret delivery and expiry-aware refresh. No project signing secret
or service key in the app. Rotate before expiry and fail closed on refresh
failure. Revoke effective Storage SELECT/resolver grants to stop the reader and
verify denied HTTP requests; token rotation alone does not revoke the old token.
Consider an issuer-controlled revocation identifier in both policy and resolver.
Keep auth headers, tickets and paths out of logs. The exact issuer remains an
approval gate, so this option is not yet operationally complete.

## Comparison

| Design                          | Enforceable boundary                                                                                                | Complexity and performance                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Owner-session private tiles     | Per-owner reservation/board rules in RLS; source/future denied; direct authorized reads cannot be prohibited        | Lowest secret/rotation complexity; one prepared-object fetch; app-only rate limits bypassable                              |
| Restricted reader private tiles | Ordinary direct reads denied; media RLS denies master, future and unrevealed tiles; server checks reservation owner | Adds issuer/rotation; no runtime decoding; compromise limited to eligible tiles/ended derivative                           |
| Original dynamic cropping       | Runtime reader can retrieve complete source; app enforces crops                                                     | One source object but repeated decode/crop; largest source exposure on reader compromise; custom credential still required |

Do not implement the original source-reader candidate alongside the revised
delivery bucket: retaining its source grant would defeat source isolation.
Current candidates are unchanged historical local work, not approved deployment
SQL for this revision.

## Measurements and cost model

Synthetic gradient, 500 × 500 RGBA PNG, same content as prior crop benchmark:

| Measurement                                                | Result                            |
| ---------------------------------------------------------- | --------------------------------- |
| Optimized master/display image                             | 157,485 bytes each                |
| All 25 PNG tiles                                           | 160,576 bytes                     |
| One tile                                                   | 6,418–6,434 bytes; median 6,424   |
| Master + tiles + display derivative                        | 475,546 bytes, 27 objects         |
| Decode/cut/encode 25 tiles, 10 runs                        | 44.79 ms median; 53.10 ms maximum |
| Local prepared-file HTTP delivery, 30 requests             | 2.10 ms median; 4.18 ms p95       |
| Local dynamic crop HTTP delivery, same source, 30 requests | 63.76 ms median; 133.00 ms p95    |
| Local deletion of 26 temporary source/tile files           | 8.53 ms                           |

Preparation measurement begins with a validated 500px PNG: it excludes upload,
orientation, resizing and hosted Storage writes. HTTP measurements use loopback
and synthetic file reads: they exclude database authorization and hosted network
latency. They are not end-to-end production latency claims. Cleanup file timing
does not measure Storage API deletion latency or monetary cost.

One reveal transfers approximately 6.4 KB to the user. A cold full-board image
load transfers approximately 160.6 KB plus the roughly 2.3 KB board snapshot.
Metadata-only refresh transfers no image bytes if the client retains currently
authorized decoded tiles in volatile page memory. Reload refetches them; 25
separate requests add protocol overhead. No persistent browser/service-worker/CDN
cache is proposed. Clear reservation image memory when it expires or is cancelled
and all private image state at sign-out/lifecycle change.

Without a source cache the original design fetched ~157.5 KB internally for each
~6.4 KB output tile: ~3.94 MB for 25 crops. Prepared delivery fetches ~160.6 KB
internally for the whole board. Client image bandwidth is similar; backend CPU
and source-fetch bandwidth improve. Real artwork compression varies substantially.

Cleanup is bounded to a manifest's 27 opaque names using Storage API deletion,
retrying partial failure before acknowledging; never delete Storage rows by SQL.
Retain the existing scheduled-period plus 30-day rule. One puzzle/week implies
roughly six retained batches (~2.9 MB at this synthetic size), plus future staged
artwork and backups. API request/egress/compute costs depend on plan and traffic;
no dollar figure or hosted latency is claimed without measurement. Do not change
the Tuesday growth schedule; activation still needs no Cron.

## Verification evidence and gaps

A disposable isolated database experiment applied a prototype owner-session
Storage policy, not a migration. Twelve assertions verified anonymous, foreign
reservation, missing/random tile, source-bucket, listing, incomplete full-image,
future puzzle, expired reservation, deactivated/deleted owner denial, authorized
own tile access and ended-image access. It also explicitly demonstrated direct
authorized access with identical claims. That is an identified requirement gap,
not a passing direct-access test.

The previous local ticket tests proved expiry, single use and eight concurrent
redemptions with one success; they do not prove those properties in a revised
Storage pipeline that has not been built. The synthetic HTTP benchmark verified
no-store headers, not actual browser/Storage cache behavior. No new hosted test
was performed. Prior read-only inspection confirmed hosted RLS and operation
helpers exist, but it cannot establish permissions for uncreated assets/policies.

Before acceptance, test the selected design over real Storage HTTP: invalid and
revoked sessions; missing/expired/foreign reservations; known unrevealed IDs;
listing/signing/transform attempts; original source and future images; direct
owner requests; stale/replayed tickets; deactivation/deletion races; completion
and expiry boundaries; cache headers; rate limits; credential revocation if used.
For the restricted reader, explicitly test a compromised-reader token against a
known unrevealed filename and the source bucket. Stop if either succeeds.

## Checkpoint

Choose whether direct access to an otherwise authorized tile is acceptable.
Under the current strict prohibition, proceed only with the restricted-reader
proposal after issuer and effective grants are approved. No broadly privileged
credential is an acceptable shortcut.

This revision authorizes the completed display image after completion OR expiry;
older local candidates and the unfinalized Section 48B draft say completion only.
They were deliberately not edited during this architecture investigation. Align
them at the next approved implementation/specification checkpoint; preserve
frozen v0.4. Gameplay, cooldowns and collective state remain unchanged.

References: [Storage RLS](https://supabase.com/docs/guides/storage/security/access-control)
and [operation restrictions](https://supabase.com/docs/guides/storage/schema/helper-functions).
