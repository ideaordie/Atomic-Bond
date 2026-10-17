# Proposed Master Spec v0.8 — Universal Bond invitation validity

Status: APPROVED in Task #16.2 final publication authorization. This historical
proposal is implemented in frozen `docs/MASTER_SPEC_v0.8.md`; v0.7 remains unchanged.

## Exact surgical amendment

Replace Section 31 with the following text in a future v0.8 copy only:

> ## 31. CREATE BOND
>
> The primary structural action remains **CREATE BOND**, initiated through
> QR, temporary code, secure invitation link, or future proximity
> mechanism. Both participants must confirm.
>
> Newly created Bond invitations have one universal validity period of
> 24 hours (86,400 seconds), beginning at server-authoritative creation time.
> This applies equally to in-person QR and remote invitations. Opening
> CREATE BOND alone does not create an invitation. Reopening, copying or
> resharing an invitation never extends its stored expiration timestamp.
> Existing invitations retain their original expiration timestamps.
>
> At or after expiration, an invitation cannot create a Bond. Cancellation,
> explicit recipient confirmation, single-use acceptance, owner authorization,
> replay protection and concurrent-confirmation safeguards remain required.
> Invitation tokens remain private capabilities and must not enter analytics
> properties or application logs. Both invitation paths display accurate
> remaining validity; an expired invitation requires a fresh authorized invitation.

No other product section changes. Upon separate approval, update only the new
copy's version/supersession metadata in addition to Section 31. Preserve every
historical frozen file. Section 32's email-verification and mutual-confirmation
flow remains unchanged. The five-minute reservations in Section 48B refer to
PARTICIPUZZLE and are unaffected. v0.7 does not explicitly prescribe a five-minute
Bond lifetime; this amendment makes the new policy explicit.
