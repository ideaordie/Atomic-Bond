# Task #12.3 — proposed specification amendment

Status: Approved for Task #12.3 publication on October 12, 2026. Applied only to Section 48A of v0.4; frozen v0.3 is unchanged.

Replace only the paragraph in Section 48A beginning “A compact global live feed
appears on the authenticated owner's main Living Atom page” with:

> Global Doodle has a standalone authenticated ACTIVE-owner page, separate from
> the Living Atom and drawing editor. Shared application navigation presents
> MY ATOM, GLOBAL DOODLE, ABOUT and SETTINGS in a single horizontally scrollable
> row, with an active-page indicator. The Living Atom has no Doodle feed/sidebar.
> The LIVE feed defaults to WORLD. MY NETWORK includes the verified owner's own
> drawings and those of ACTIVE authors reachable through confirmed direct or
> indirect Bonds, using server-authoritative ownership and graph relationships.
> Structural inactive nodes may connect the graph but contribute no drawings.
> Viewing another Atom never changes this owner-rooted scope. HALL OF FAME remains
> global and separate from live-feed ordering. Feed entries show static bitmaps,
> permitted public Atom numbers, publication age, APPRECIATE and REPORT. Bounded
> cursor pagination and approximately 30-second visibility-aware refresh preserve
> scroll position and exclude expired or removed content. Changing scope resets
> pagination and clears the old results. CREATE DOODLE opens the existing editor,
> which contains no feed or public replay. After server-confirmed publication,
> DOODLE PUBLISHED provides RETURN TO MY ATOM and DRAW ANOTHER, disabled until
> the authoritative 60-minute submission cooldown ends. Failed submissions preserve
> the unsent drawing; retries are idempotent. No additional tracking or private/offline
> content cache is introduced.

No changes to publication lifetime, cooldown, appreciation, moderation, retention,
Hall qualification, lifecycle cleanup or authorization are proposed.
