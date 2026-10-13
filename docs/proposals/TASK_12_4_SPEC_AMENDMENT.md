# Task #12.4 — proposed Section 48A amendment

Status: Approved for v0.12.4 publication on October 12, 2026. Applied surgically
to Section 48A of v0.4. Frozen v0.3 remains unchanged.

Only these three changes to `MASTER_SPEC_v0.4.md` Section 48A are proposed:

1. Replace:

   > Publication lasts exactly 24 hours from successful publication using database
   > time, unless removed earlier for moderation or account lifecycle reasons.

   With:

   > Newly published drawings remain public for exactly 7 days (168 hours) from
   > successful publication using database time, unless removed earlier for
   > moderation or account lifecycle reasons.

2. Replace:

   > No votes are accepted outside its original publication window (24 hours for newly published drawings).

   With:

   > No votes are accepted outside its original publication window (7 days / 168 hours for newly published drawings).

3. Immediately before “Global Doodle has a standalone authenticated ACTIVE-owner
   page”, add:

   > The Global Doodle page displays “Draw something. Make someone's day.” directly
   > below its GLOBAL DOODLE heading, using the existing monochrome typography.

The existing sentence “Existing published drawings retain their original
deadlines.” remains unchanged. The 60-minute submission cooldown, multiple live
drawings, immediate publication, no global daily quota, expiration enforcement,
appreciation uniqueness, frozen scores, Top 10 rules, minimum five appreciations,
explicit administrator promotion, seven-day private candidate review **after
expiration**, cleanup deadlines, moderation, lifecycle, authorization, feed
scopes and controls remain unchanged. In particular, “deleted within 24 hours”
continues to describe ordinary expired-payload cleanup, not public lifetime.
