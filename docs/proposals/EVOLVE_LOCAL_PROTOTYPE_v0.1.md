# EVOLVE — local concept, Task #19.0

Status: proposed product rules; not approved for production. Frozen Master Spec
v0.8 is unchanged. Baseline verified: v0.16.4.6, `6df0a19`, Vercel Ready.

Preview: http://127.0.0.1:3140/review/evolve using the existing development server.
The page returns notFound outside development. No production navigation entry,
API, database, authentication integration, notification or tracking is added.
All six seed ideas and all decisions are synthetic. React memory resets on reload;
only the existing browser-local appearance preference persists.

## Review

- Submit up to 250 characters. Whitespace-only ideas are rejected. A simulated
  24-hour submission limit applies until elapsed or the prototype is reloaded.
- Support multiple ideas once each and withdraw support. There are no support
  totals, popularity ordering, personal rankings or weighted votes.
- Filter by status or personal contributions. Expand WHY THIS STATUS for the
  decision explanation and possible progression, without a delivery promise.
- MOCK ADMIN VIEW reveals status and required explanation controls on each card.
  Change a contributed idea to LIVE to preview optional private acknowledgment.
- All six statuses are represented, including explained DEFERRED and DECLINED.
- LIGHT/DARK uses the existing shared design tokens. No animation is required.

## Future requirements — separate approval, not implemented

EVOLVE introduces community suggestions and support outside the current product
specification. Approve a surgical specification addition before production work.
Support is issue-specific input, not a personal reputation score or guaranteed
implementation threshold. Decide whether idea-level totals should ever be shown.

A future service would require verified ACTIVE-owner checks on every write,
database-authoritative 24-hour limits, transaction-safe uniqueness on owner/idea
support, idempotent submission and withdrawal, narrow RPCs, private identities,
RLS and no direct client writes. React state here is not a security boundary.
Only existing authorized administrators may change statuses, with an auditable
reason, timestamp and revision checks. Contributors must not edit decisions.

Define suggestion content review, reporting, length normalization, abuse throttles,
duplicate handling and safe plain-text rendering before accepting real content.
Define deactivation/deletion behavior, support removal, attribution consent,
bounded retention and minimal audit retention. Do not expose emails, auth IDs,
private activity, weighted influence or voter lists. Acknowledgment should remain
optional and private; no email notifications are proposed here.

Production requires independent authorization/concurrency/lifecycle testing and
physical-device accessibility review. This local prototype is not a backend or
security implementation. No new credentials or dependencies are required for it.

## Targeted validation

Run `node_modules/.bin/playwright test --config tests/review/evolve.config.ts`
against the local development server. Six cases cover Light/Dark at 390×844,
768×1024 and 1440×900: submission, length bound, simulated cooldown, support and
withdrawal, all status decisions, LIVE recognition, preference suppression,
reload reset, keyboard focus and horizontal overflow. Screenshots are generated
under ignored `artifacts/evolve-*.png`. These tests are separate from the unchanged
production Foundation suite because this route is development-only.
