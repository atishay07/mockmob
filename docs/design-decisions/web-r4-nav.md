# Round 4, signed-in web: navigation, Ask Mobi, Today and Practice (packet A3 + A4 + A5, 6 Nov 2026)

Owner rows LK141, LK142, LK143 and LK146 (his feedback of 5 Nov 2026, about 11:40 pm, in
`docs/brain/OWNER-FEEDBACK-2026-10-31-LEARN.md`). Spec: `docs/brain/night-1105/SPEC-R4.md`, sections A3, A4 and A5. Branch `web/r4-nav`.

His words, short: the dock's You "is not opening the entire You section", while the top avatar "is opening the entire You
section ... the opposite of what I think a UI should do". Ask Mobi "is completely gone from the UI ... one of our main features ...
the entire AI layer of the system". Today and Practice "still feel a bit too limited ... not as easy to use as I want". The
sidebar needs "UI refinement".

## User tasks and success tests

- A student on a phone taps You and lands on the You page with every You place on it; taps the person in the top bar and gets
  the quick account sheet (appearance, account rows, the tour, sign out) without leaving the page. Test: one tap each, both ways.
- A student anywhere can reach Ask Mobi in one tap, and knows what an answer costs before pressing. Test: a visible door on
  every screen at every width from 360 px.
- On Today and Practice the main job (Start Revise, Start 10 questions) is on the first screen at 360 x 640, 390 x 844 and
  1366 x 768, one tap. Test: measured key boxes against the window and the dock (below).
- At 1366 x 768 the desktop rail shows every row with nothing cut off. Test: the places list's scroll height equals its height.

## A3, navigation

**Phone dock You opens the You page** (`/profile`). It is a link like the other four places (`YOU_DOCK` in
`src/lib/arenaNavigation.js`); it is current on the You page (the dock's lens rests under it) and marked within on the pages under
You (Progress, Marks trend, Colleges, Wallet, Guide, Ask Mobi). The You sheet is retired; nothing in it was lost:

| Was in the You sheet | Now |
| --- | --- |
| Name row to Account | The You page itself; the account sheet's "Name, sign-in and plan" |
| Sign out | The You page's signed-in line; the account sheet; the top bar from 1024 px |
| Show me around, Guide | The You page's places (Help group); the account sheet (both) |
| Ask Mobi row | The You page's first place; the top bar key (below) |
| Progress, Marks trend, Colleges, Wallet (Your standing with the Mob off) | The You page's places, same groups and order |
| Night, Daylight, Match device | The account sheet's Appearance; the top bar's Night and Day switch from 640 px; Account's Look and feel |
| Moderation, Contribute groups | The You page's places, when the student has them |

The You page's places (`src/components/nav/YouPlaces.jsx`) sit under the page's heading and signed-in line: Ask Mobi with his face,
then two columns of 48 px rows split by hairlines (the look the sheet had, D114), Guide and Show me around last. On a tablet the
groups stand side by side. From 1024 px the block is not drawn: the rail lists the same pages under You. The shell hands its lists,
links and the tour down through a context, so the development preview's addresses and the tour hold.

**The top bar's person opens the account sheet on a phone**: the same panel as the desktop pop-over (D8, LK97), drawn under the
top bar across the screen with 12 px at each side, over a scrim that also covers the dock; it scrolls inside itself on a short
phone and the page does not scroll under it. It is a dialog: focus is held inside, Escape and the scrim close it, focus returns to
the person. A press on the scrim closes on its own click, so a tap never falls through to the page. The sheet gained Show me around.
Desktop and tablet keep the pop-over as it was (avatar = pop-over, sidebar You = You page), now with Show me around too.

**The rail (desktop) refined** (LK146): the logo, Start a session and Mobi's door head it and never scroll; the places are one list
under them. On a mouse window the rows are 44 px from 980 px tall, 38 px under 880 (as before), 34 px under 820 and 32 px under 740,
and a place's pages sit flush, so Learn and the Mob together (15 rows) fit whole at 1366 x 768 (measured: 585 px of room, 585 px of
rows) and at 1280 x 800 (617 of 617). A touch screen keeps 44 px rows; then only the places list scrolls, never the head. Night and
Day left the rail: it was the third copy of the same switch (the top bar's switch and the account pop-over's Appearance are one press
away on every page), and its row of about 60 px was what pushed Guide and Show me around under the fold. Active state, grouping and spacing are
the approved ones (bold place rows, indented pages, the volt bar for the current page only); the places are 12 px apart (10 before).

## A4, Ask Mobi back as a first-class door: where it went, and the plan

Where it went: nothing was removed. `/mentor` (Ask now and Ask your record) is whole; the doors were what faded. The rail's door was
the last thing in a 15-row rail, under the fold at 1366 x 768; on a phone the only door was a row inside the You sheet behind the
dock's You, which is why he could not find it. The per-item asks were quiet underlined text.

The plan, built here:

1. **Rail (from 1024 px)**: Mobi's door moves from the foot to right under Start a session. The two things a student comes to do,
   practise and ask, head the rail; it is always in view.
2. **Top bar (below 1024 px)**: a 44 px capsule with Mobi's face, his name beside it from 640 px, beside the account; on every page
   of a phone and a tablet. Under 350 px (a 320 px phone) it steps out of the bar so the bar never overflows; the You page carries it.
   It is not repeated in the top bar from 1024 px, where the rail's door is in the same view (no duplicate door on one screen).
3. **You page**: the first place, with his face and his one line ("He explains any answer.").
4. **Today**: one row right under the lead card, the whole surface the door (F5, like Road to CUET): "Ask Mobi. Any CUET doubt, or
   what your papers say. Answers from your record are free; a written reply is 1 credit." No volt (D7: the lead key is the screen's
   one). The cost is said before the press (standards 11; S015).
5. **On results and reviews**: the existing "Ask Mobi about Q7" and "Ask Mobi about this session" lines (ASK-MOBI-1018), and every
   other text entry made through `AskMobiLink`, now carry Mobi's small face, so his doors read as his across the app. Practice's
   "Ask Mobi what to practise", Mistake Repair's "Ask Mobi about Q3", Marks trend's Ask Mobi and Today's "Why this?" stay as they are.
6. The tour's Ask Mobi stop points at the rail door on a desktop and the top bar key on a phone.

Next steps for him to decide (not built): an "Ask Mobi" command from any question in Learn and Key cards (the learn packet owns those
screens); a first-run line on Today naming what Mobi does for a new student; whether the rail door and the top bar key should both
show on a tablet in landscape (1024 to 1100 px, today only the rail's).

## A5, Today and Practice: the main job one tap and in sight

- **Today, phones**: under 800 px of height (360 x 640, 360 x 740, a 412 px phone with the browser's bars) the lead card's start key
  fell under the dock. The type and the air give a little (greeting 24 px, figure 60 px, title 20.5 px, tighter gaps); nothing leaves,
  the colleges strip stays on the first screen (H9). Measured: 360 x 640 key 505 to 557, dock top 564 (before: 579 to 635, under the
  dock); 360 x 740 key 525 to 577, dock 664; 412 x 800 key 610 to 666, dock 724; 390 x 844 unchanged and clear.
- **Today, every width**: Ask Mobi one tap under the lead card (A4.4).
- **Practice, laptops**: at 1366 x 768 the card's Start key arrived 76 px under the fold until the card reached its sticky top. Now the
  key's row rides the window's foot inside the card, on the card's own ground, until the card's end is in view, then lands in its
  place: the rule of the phone's session bar (F12), on the desktop card (S010). Under 860 px of height the card is also a little
  tighter. Measured at 1366 x 768: key 699 to 751 on arrival. Phones and tablets keep their own session bar unchanged.

## Evidence and standards

- S016 (WCAG 2.2 consistent navigation and identification): the dock's five slots now behave alike, each opening its place's page;
  the account is the person, in the same place at every width.
- S014 (progressive disclosure): quick account toggles in the sheet, the whole You section on its page.
- S010 (sticky primary action): Practice's key in sight on a laptop. S015 (honest cost before the action): Today's Ask Mobi line.
- S017 (slop is missing intent): no new cards for their own sake; Today's row is the one door, and the old sheet's rows moved, not
  multiplied.

Anti-slop check (12 parts, AGENT_RULES): one accent (no new volt anywhere; the rail's door and the top key use the hairline and the
selected wash), no glow, no gradient added, no nested card (the You places sit on the page's ground; Today's row is outlined because
the whole surface is the button), sentence-case labels, no exclamation marks or arrows in copy, 44 px targets (the top key 44, rows
48; the rail's 34 and 32 px rows are mouse-only, WCAG 2.2 asks 24), focus rings on every new control, reduced motion respected (the
places' rise and the sheet's slide stop), Night and Day both captured, real data only (the cost line is the product's own price).

Rubric (0/1/2, for his sign-off): hierarchy 2, navigation clarity 2, consistency 2, copy 2, accessibility 2, motion 1 (the account
sheet's slide is plain; no spring), density at 1366 x 768 2, Night/Day parity 2, honesty 2, delight 1 (Mobi's face on his doors is the
only new character), performance 2 (no new reads; the art is the static mascot already loaded), states 2.

## Pinned tests updated to these decisions (owner LK141, LK143, LK146)

Review follow-up. The account sheet makes the background inert while open and restores focus to the avatar. The
compact mouse-only rail is an explicit 44 px exception. Touch rows keep 44 px. The short-phone Today layout moves the
date beside the greeting and removes the repeated duration. Narrow top bars put the Pro label inside the account sheet
when space is tight. The browser check measures dock clearance, top-bar fit, the laptop rail and the sheet's focus and scrim.

`account_popover_1105` (phones open the sheet; was "the door goes to Account"), `ask_mobi_doors_1019`, `ask_mobi_entries` (no theme
switch in the rail; Mobi's door under Start), `community_1018` (dock You is a link), `dock_alignment` (static and the browser walk:
You opens the You page, the person opens the account sheet), `help_faq` (Appearance in the account panel), `release9_nav_1018`,
`topbar_account_1102`, `web_fixa_1019`, `web_fixb_1019`, `web_nav_a_1019`, `you_account`. New: `web_r4_nav_1105`.

## Screens (tmp/r4/ in the worktree)

`c1-you-390-dark`, `c1-acctsheet-390-dark`, `c4-acct-360-light`, `c4-you-768-light`, `c3-side-1366-dark`, `c4-mentor-1280-light`,
`c4-today-1920-dark`, `c3-practice-1366-light`, `c3-today-390-dark-ask`, `c3-result-390-dark`, `c5-today-360x640-dark` and the
`before-*` shots of the same screens.
