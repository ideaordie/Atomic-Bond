# PARTICI-PUZZLE — local prototype

Task 13.0 starts from v0.12.4, commit `956e353`. No release bump, hosted
migration, production account, schedule or navigation change. Frozen
specifications remain unchanged. For the subsequent database checkpoint see
[PARTICI_PUZZLE_SERVICE_v0.1.md](PARTICI_PUZZLE_SERVICE_v0.1.md).

## Review

Use the existing loopback development server at
`http://127.0.0.1:3140/review/puzzle`. Production renders the not-found page, with
no puzzle UI (Next streaming may retain HTTP 200). Refresh resets the synthetic
board. No real account or database is connected to this review.

- REVEAL MY PIECE reserves one available tile for five simulated minutes.
- Select an empty square, then PLACE MY PIECE. Correct placements lock;
  incorrect placements remain movable. Cancel/expiry return the reservation
  and trigger five minutes of reveal cooldown.
- MOVE A PIECE selects an unlocked source and destination. Confirm moves into
  an empty square or swaps two unlocked tiles; both positions are checked.
- PLACE and MOVE have independent rolling hourly cooldowns that survive weekly
  rollover. Failed actions consume neither gameplay allowance.
- Switch among six synthetic participants. Stale revisions are rejected.
- SHOW CORRECT DESTINATION is a review helper, separate from ordinary play.
- DEMO FINAL SWAP seeds 23 locks and two reversed pieces for completion review.
- END WEEK freezes the period. Only completion displays the full image; an
  incomplete ended board does not disclose the solution. NEXT WEEK starts the
  next simulated period with existing cooldowns preserved. The rollover checkbox
  permits inspection of the ended state.
- Keyboard, click and touch share the same interaction. Light/Dark reuse existing
  appearance settings; reduced motion removes reveal animation. Selection and
  locked status do not depend only on color.

## Prototype limits

This is a single-browser simulation, not secure multi-device play. Pure transitions
simulate a serialized service; its seeded random assignment is deterministic for
tests. The synthetic SVG source is inspectable in the development bundle. That
is explicitly not production image secrecy. State is not saved in browser storage.

The approved next-stage database/media candidate is tested independently. It
supersedes earlier planning suggestions to reset cooldowns weekly or disclose
the full source at expiration. Neither behavior is now proposed for production.

## Verification

Updated unit tests cover locks, swaps, reservations, reveal cooldown, independent
allowances, stale actions, completion, rollover and development-only routing.
Twelve browser cases cover keyboard operation, Light/Dark, 44px board targets,
overflow and reduced motion at 390×844, 768×1024 and 1440×900. The checkpoint
service document records current database, security, build and benchmark results.
