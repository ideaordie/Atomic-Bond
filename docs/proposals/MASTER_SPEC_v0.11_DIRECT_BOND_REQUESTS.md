# Proposed Master Spec v0.11 — Direct Bond requests

Status: PROPOSED ONLY. Preserve frozen v0.10 and all previous specifications. The policies below are approved for local implementation in Task #21.1; specification freezing still requires publication approval. Do not freeze or publish this document as an authoritative specification.

## Exact Section 12 addition

Append to the existing network-exploration paragraph:

> In an authenticated ACTIVE owner's network view, an individually selected ACTIVE Atom that is indirectly reachable through the owner's current ACTIVE network may offer REQUEST DIRECT BOND. Self, directly Bonded, inactive, deleted and inaccessible Atoms are ineligible. Public visibility alone does not confer request permission. The server revalidates eligibility; indirect connectivity never implies trust.

## Exact Section 31 clarification

Replace only “Newly created Bond invitations have one universal validity period of” with “Newly created external QR/share Bond invitations have one universal validity period of”. Preserve the existing 24-hour policy and every remaining external-invitation requirement unchanged.

## New Section 31A — DIRECT BOND REQUESTS

> An authenticated ACTIVE participant may explicitly request a direct Bond with another eligible ACTIVE participant in their authorized active network. Direct requests are private, recipient-bound pending actions, not transferable external invitation links. They carry no message text, public popularity signal or private contact information. They introduce no chat, email campaign or new authentication flow.
>
> The sender sees REQUEST PENDING after server-authoritative creation. The recipient may see DIRECT BOND REQUEST and “Atom #[number] would like to form a direct Bond with you.” ACCEPT BOND explicitly confirms the connection. NOT NOW dismisses the notification while retaining the request for later review from MY ATOM. DECLINE closes it without a Bond. A compact BOND REQUESTS entry permits later review and sender cancellation. Automatic notices are claimed server-side at most once per request, with at most one modal per visit; interruptions may suppress a notice but never remove the pending entry.
>
> Only one pending request exists per ordered sender/recipient pair. Each request expires exactly seven days (168 hours) after database-authoritative creation. Retries never extend it. Opposite-direction requests never imply automatic consent; one explicit acceptance creates at most one confirmed Bond and supersedes redundant requests.
>
> Limits are five new requests per sender per rolling 24 hours and ten pending outgoing requests. A decline prevents another request from that sender for thirty days. NOT NOW does not initiate this cooldown. There is no additional incoming-request cap or pair-specific daily restriction. Cancellation and reactivation do not reset the rolling sender allowance or decline deadline. All owners have equal limits. Endpoint throttling also applies.
>
> Recipients may opt out of receiving direct requests in Settings; opt-out cancels pending incoming requests and prevents new ones. Re-enabling does not restore cancelled requests. Preferences remain private. Sender cancellation, recipient decline and acceptance are transactional terminal transitions. No dismissal or automatic process creates a Bond.
>
> Creation and acceptance require verified live owner sessions and ACTIVE eligibility. Acceptance must come from the named recipient, before expiration, with both endpoints still eligible, opt-in still valid and current active-network reachability revalidated. Public-view selection and client-supplied identity are never authority. Existing canonical Bond uniqueness, mutual consent, lifecycle locking, replay protection and graph invariants remain enforced. External invitation behavior and deadlines remain unchanged.
>
> Pending requests involving an Atom that becomes non-ACTIVE are invalidated and do not resurrect on reactivation. Account deletion erases applicable private request, notice and preference data immediately while preserving existing anonymized confirmed Bonds under the account policy. Closed request metadata is retained no longer than thirty days after closure; retry-control metadata lasts only until its required deadline. Bounded cleanup enforces physical retention without becoming a prerequisite for expiration or authorization. Requests and preferences have no direct client-table access.

## Future freeze metadata

Only after explicit approval, copy v0.10 into v0.11, apply the changes above, update the title/supersedes and Section 62 version history, and adjust authority references. Do not change unrelated requirements or edit any previously frozen specification.
