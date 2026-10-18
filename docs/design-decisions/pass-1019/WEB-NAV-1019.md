# G24: web navigation, three options (mock-up, 19 Oct 2026)

**Status:** MOCK-UP FOR THE OWNER'S PICK (D107, R8). Nothing is built into the site and nothing is committed. The build waits for his pick (Wave C).
**Designer:** B1 (web navigation), 19 Oct.
**Base:** main 23a7c090 (release 10, live), `src/lib/arenaNavigation.js` and `src/app/(app)/AppLayoutClient.jsx`.
**Method:** every image is the live release 10 shell on the preview fixture (`/preview/arena?view=today&study=on`, Mob on), rendered in headless Chrome (playwright-core, own temp profile). The sidebar, dock and More sheet were rebuilt in the page with the shell's own class names (`arena-nav-link`, `arena-bottomnav`, `arena-sheet`, `stk--bar`). The colours, fonts (Bricolage Grotesque and Hanken Grotesk), radii, icons, glass and the Today page behind them are therefore the real ones, in Night and Day. The fixture banner is hidden. Mobi is the real mascot art (`/brand/mascot/greeting.webp`).

## His words
> G24: "Your mob is placed inside Study only, and everything is inside Study, and Planning is in Marks Trends. That is also a bit weird. Everything just feels very weird on the website."

> D107: web navigation: "Mock-up 2-3 options" (the app's Today, Practice, Start, Mob, You as one option).

**Related decisions:**
- **D105 (app):** the bar becomes Today, Practice, Start, Mob, You, and Review moves inside Practice.
- **D106:** Review opens on "Your papers".
- **G17:** the Mob must be easy to find.
- **D20:** Learn needs a clear place.
- **D6:** Ask Mobi never sits below the theme control.
- **N17:** "Show me around" stays visible.
- **W-079:** rail rows are 44 px.
- **W-075:** one volt key per viewport.
- **G29:** a plain Sign out.
- **15 Oct (memory: web-restructure-rejected):** he rejected "the navigation merged into 5 places with denser pages". That is a hard constraint on option A. A may regroup links, but it must never merge pages.

## What is wrong today (release 10, measured)
- **Study holds nine rows:** Today, Practice, Learn, Review, Explore, Saved, Progress, Your standing and Your Mob. The Mob is the ninth, below "Your standing". This is FORENSICS G24: `f05fdffc` dropped the Community header on 18 Oct.
- **The header "Planning" sits directly over "Marks trend".** He reads Planning as belonging to Marks trend.
- **On a phone the Mob is only in More.** It is the last row of the first view, under Learn, Explore, Saved, Progress and Your standing. Colleges takes a dock slot.
- **The live More sheet scrolls** (847 px of content in a 683 px sheet). Marks trend, Colleges' group and Wallet sit below the fold.
- **The live rail needs 911 px at 44 px rows.** It compacts to 38 px rows in a 1440 x 900 mouse window.

## What all three options share
1. **Every page stays reachable (R3).** On desktop every page keeps its own named link in the rail, one click away. On a phone every page is one or two taps away, as today. No route changes. Review keeps `/review` even where its label becomes "Your papers".
2. **Start a session stays the first thing in the rail.** On phones the Start key stays on the dock.
3. **Ask Mobi becomes Mobi's own door at the foot of the rail,** above Night and Day (D6). It is a raised row with the mascot, "Ask Mobi" and "He knows your record." On a phone, Mobi's face replaces the sparkle icon on the sheet's Ask Mobi row, with the line "Ask about a question, a result or your plan." This is where Mobi belongs in navigation: the one place a student can talk to him. The page's own Mobi stays one per screen (ArenaCompanion's OneMobi rule). The rail door is static art, like the logo's Mobi.
4. **The phone sheet** (More in B and C, You in A):
   - The appearance control moves to the end of the sheet, so the places come first. It still sits below Ask Mobi (D6).
   - The sign-out icon in the sheet's head gains the word "Sign out" (G29).
5. **Unchanged in every option:**
   - The Moderation group (moderators only, at the top).
   - The Contribute group (only when CONTRIBUTE_ENABLED).
   - The credits chip (to Wallet), the theme toggle and the avatar in the top bar.
   - Pages reached from inside other pages: result, test, `/study/<id>` under Learn, `/review/rules`, `/review/revise`, recovery and rival.

## The images (all in `tmp/design-1019/web-nav/`, every one opened and checked: 24 option frames and 2 boards)
- **Comparison boards:**
  - `BOARD-night.png` and `BOARD-day.png`.
  - Four columns: Now (release 10), A, B, C.
  - Each column shows the desktop rail at full size (the left half of 1440 x 900), three phone frames at 390 x 844, and the option's map.
- **Per option, Night and Day** (`night` / `day`):
  - `X-1440-<theme>.png`: the desktop rail over Today.
  - `X-390-<theme>-dock.png`: the phone dock over Today.
  - `X-390-<theme>-sheet.png`: the open sheet (You in A, More in B and C).
  - `A-390-<theme>-practice.png`: option A's Practice page with its pages as a row of tabs.
  - `B-` and `C-390-<theme>-sheet-end.png`: their sheets scrolled to the end, so every row is seen.
- **Today's shell for reference:**
  - `work/base-1440-<dark|light>.png`;
  - `work/base-390-<dark|light>.png`, `-more.png` and `-more-end.png`.
- **The generators,** so the main session can re-run them:
  - `work/inject.js` (page-side rebuild);
  - `work/mm.css` (mock-only styles);
  - `work/render.mjs` (all frames plus the rail measurement);
  - `work/board.mjs`.

## The full map: where every current page lives
Click and tap counts are from the page the student is on. On a phone, "sheet" means the dock's More (B, C) or You (A).

| Page (route) | Now: desktop / phone | A: desktop / phone | B: desktop / phone | C: desktop / phone |
|---|---|---|---|---|
| Today (/today) | Study / dock | **Today** / dock | Study / dock | top, no header / dock |
| Practice (/dashboard) | Study / dock | **Practice** / dock | Study / dock | Practise / dock |
| Review (/review) | Study "Review" / dock | under Practice, "Your papers" / Practice, then the "Your papers" tab (2 taps) | Study "Review" / dock | Your results, "Your papers" / dock "Papers" |
| Learn (/learn) | Study / More (2) | under Practice / Practice tab (2) | Study / More lead row (2) | Practise / More lead row (2) |
| Explore (/explore) | Study / More (2) | under Practice / Practice tab (2, the row scrolls) | Study / More (2) | Practise / More (2) |
| Saved (/saved) | Study / More (2) | under Practice / Practice tab (2, the row scrolls) | Study / More (2) | Practise / More (2) |
| Your Mob (/mob) | Study, 9th row / More (2) | **Mob**, "with friends" / dock "Mob" (1) | Together / dock "Mob" (1) | top, "Your Mob, with friends" / dock "Mob" (1) |
| Your standing (/leaderboard) | under Progress / More (2) | under Mob / Mob page, "Your standing" tab (2) | Together / More (2) | Aim for a college / More (2) |
| Progress (/progress) | Study / More (2) | under You / You sheet (2) | Your goal / More (2, after a scroll) | Your results / More (2) |
| Marks trend (/analytics) | Planning / More (2, after a scroll) | under You / You sheet (2) | Your goal / More (2) | Your results / More (2) |
| Colleges (/admission-compass) | Planning / dock | under You / You sheet (2), plus Today's top-3 card (D104) | Your goal / More (2), plus Today's card | Aim for a college / More (2), plus Today's card |
| Ask Mobi (/mentor) | Planning row / More lead row (2) | Mobi door at the rail foot / sheet row with Mobi (2) | same as A | same as A |
| Account (/profile) | Account / top-bar avatar (1) or sheet head (2) | **You** / top-bar avatar (1) or You sheet head (2) | Account / avatar (1) or More head (2) | Help and account / avatar (1) or More head (2) |
| Wallet (/wallet) | Account / credits chip (1) or More (2) | under You / credits chip (1) or You sheet (2) | Account / chip (1) or More (2, after a scroll) | Help and account / chip (1) or More (2) |
| Guide (/help) | Account / More head (2) | under You / You sheet head (2) | Account / More head (2) | Help and account / More head (2) |
| Show me around (tour) | Account / More head (2) | under You / You sheet head (2) | Account / More head (2) | Help and account / More head (2) |
| Start a session (sheet) | rail key / dock key | rail key / dock key in the centre | rail key / dock key beside | rail key / dock key beside |
| Night and Day | rail foot / More | rail foot / end of the You sheet | rail foot / end of More | rail foot / end of More |

## Fit (measured in headless Chrome on the preview fixture)
| | Now | A | B | C |
|---|---|---|---|---|
| Rail height at 44 px rows (touch, W-079) | 911 px | **976 px** | 1044 px | 1048 px |
| Rail rows used in the 1440 x 900 images | 38 px (live rule) | 36 px | 34 px | 34 px |
| Group headers to read | 3 | **0** (four bold places) | 4 | 4 |
| Phone sheet: content / visible height | 847 / 683 (scrolls) | **555 / 555 (no scroll)** | 886 / 683 (scrolls) | 838 / 683 (scrolls) |

**Notes:**
- Every option needs more height than today at touch size, because the Mobi door replaces a 37 px row with a 50 px one.
- A needs the least, because it has no group headers.
- B and C need 34 px rows to fit 1440 x 900 without a scroll. In a real browser window (about 780 px tall on a 900 px screen) all of them compact and the rail scrolls, as today.

**Option A's phone checks** (390 x 844):
- No horizontal page overflow.
- The Practice tab row scrolls 126 px sideways, and the "Explore" tab is cut at the edge as the cue (G27).
- Tabs are 44 px tall.
- Dock slots are 70 x 64 px, and the centre Start key is 56 x 56 px.

---

## Option A: Same five as the app (D105 on the web)
**Images:** `A-1440-night.png`, `A-1440-day.png`, `A-390-*-dock.png`, `A-390-*-sheet.png`, `A-390-*-practice.png`.

**Desktop rail, top to bottom:**
- Start a session
- **Today**
- **Practice**
  - Your papers (8)
  - Learn
  - Explore
  - Saved
- **Mob**, with friends
  - Your standing
- **You**
  - Progress
  - Marks trend
  - Colleges, DU cutoffs
  - (a hairline)
  - Wallet
  - Guide
  - Show me around
- The Mobi door (Ask Mobi)
- Night and Day

The four places are bold rows. Their pages are indented rows under them, using the live `arena-nav-link--sub` style that "Your standing" uses today. Nothing collapses, so every page is visible and one click away.

**Phone:**
- **Dock:** Today, Practice, ●Start, Mob, You. Start is a 56 px key in the centre of the capsule; it is quiet while the page's own volt key is on screen (W-075) and volt otherwise. There is no More.
- **You opens the sheet:**
  - head: the name (to Account), Sign out, Show me around, Guide;
  - Ask Mobi with Mobi;
  - "Your progress": Progress and Marks trend;
  - "Your plan": Colleges and Wallet;
  - Night and Day.

  It fits without a scroll.
- **Practice's own pages sit in a row of tabs under the top bar:** Practise, Your papers (8), Learn, Explore, Saved. The same row repeats on each of those pages, with the current one marked by the rail's volt bar. The Mob page gets the same row: Your Mob, Your standing.
- **The Review badge** (due in Revise) moves to Practice on the dock, and to "Your papers" in the rail.

**R2: what does a first-time student think each screen wants?**
- **Desktop rail:** "Four places and a Start button. Today tells me what to do, Practice is where I practise and find my papers, Mob is me with my friends, and You is me." This is obvious in 3 seconds. The coined word "Mob" is carried by "with friends".
- **Phone dock:** "Five buttons; the round one in the middle starts a session." Obvious.
- **You sheet:** "Everything about me: my progress, my colleges, my credits, my account and help." Obvious.
- **Practice tabs:** "These are the parts of Practice, and the cut-off tab means there is more to the right." Obvious, as long as the first-view nudge from G27 is built in.

**For a first-time student:**
- **Pros:**
  - The fewest choices: four places and Start (Hick).
  - The same map as the app they install.
  - The Mob is one tap away.
  - Start sits in the middle of the bar, where thumbs land.
  - "You" is a word they know from Instagram and YouTube.
  - The sheet is short and needs no scroll.
- **Cons:**
  - Colleges is no longer a place of its own. It sits under You; Today's top-3 card (D104) is the main door.
  - Learn, Explore and Saved move from More into a sideways row inside Practice. Explore and Saved start off-screen at 390 px, so the row must show its cue.

**For a heavy user:**
- **Pros:**
  - On desktop nothing gets further away; every page is still one click.
  - The rail is the calmest of the three: no headers, and the shortest at touch size.
- **Cons:**
  - On a phone, Your papers goes from one tap (Review on the dock) to two (Practice, then Your papers). Today's "Repair your last paper" move still deep-links in one tap.
  - The badge on Practice keeps the count visible.
  - "Review" is relabelled "Your papers", which is D106's word anyway.

**Risk:** the 15 Oct rejection. A does not merge pages. Every page keeps its route, its own content and its rail link. The only new interface is the row of tabs on Practice's pages on a phone, which adds one 44 px row and takes nothing out of the page.

## Option B: Today's rail, regrouped (the fewest moves)
**Images:** `B-1440-*.png`, `B-390-*-dock.png`, `B-390-*-sheet.png`, `B-390-*-sheet-end.png`.

**Desktop rail:**
- Start a session
- **Study:** Today, Practice, Review (8), Learn, Explore, Saved
- **Together:** Your Mob, Your standing
- **Your goal:** Colleges, DU cutoffs; Marks trend; Progress
- **Account:** Account, Wallet, Guide, Show me around
- The Mobi door
- Night and Day

**Phone:**
- **Dock:** Today, Practice, Review (8), Mob, More, with Start beside the capsule as now. The Mob takes Colleges' slot, as in the app (D105).
- **More:**
  - head: Sign out, Show me around, Guide;
  - Ask Mobi with Mobi;
  - Learn lead row (D20);
  - Study: Explore, Saved;
  - Together: Your standing;
  - Your goal: Colleges, Marks trend, Progress;
  - Account: Wallet;
  - Night and Day.

  It scrolls: Progress, Wallet and the appearance control are below the first view.

**R2:**
- **Desktop rail:** "Study is where I work, Together is my Mob, and Your goal is my colleges." Mostly obvious. "Review" (review what?) and "Together" are vague words for a newcomer.
- **Phone dock:** "Today, Practice, Review, Mob, More." Obvious, except Review.
- **More:** "A list of everything else." Colleges is at the bottom edge of the first view, and Progress needs a scroll. That is a finding: a first-time student will not scroll to find Progress.

**For a first-time student:**
- **Pros:** the three things he named are fixed. The Mob has its own group and dock slot, Study shrinks from nine rows to six, and "Planning" becomes "Your goal", led by Colleges.
- **Cons:**
  - The website's bar and the app's bar differ (Review and More against Start, Mob and You), so a student learns two maps.
  - The words "Review" and "Together" need decoding.

**For a heavy user:**
- **Pros:** almost nothing to relearn, and Review stays one tap.
- **Cons:** the rail is the tallest after C (1044 px at touch size), so more laptops compact it.

## Option C: Named for what you came to do (task groups)
**Images:** `C-1440-*.png`, `C-390-*-dock.png`, `C-390-*-sheet.png`, `C-390-*-sheet-end.png`.

**Desktop rail:**
- Start a session
- Today
- Your Mob, with friends
- **Practise:** Practice, Learn, Explore, Saved
- **Your results:** Your papers (8), Marks trend, Progress
- **Aim for a college:** Colleges, DU cutoffs; Your standing
- **Help and account:** Account, Wallet, Guide, Show me around
- The Mobi door
- Night and Day

**Phone:**
- **Dock:** Today, Practice, Papers (8), Mob, More, with Start beside the capsule.
- **More:**
  - head: Sign out, Show me around, Guide;
  - Ask Mobi with Mobi;
  - Learn lead row;
  - Practise: Explore, Saved;
  - Your results: Marks trend, Progress;
  - Aim for a college: Colleges, Your standing;
  - Help and account: Wallet;
  - Night and Day.

  It scrolls: "Help and account" is below the first view.

**R2:**
- **Desktop rail:** "Each heading says what I can do here: practise, see my results, aim for a college, get help." Obvious, but there are more words to read than in A.
- **Phone dock:** "Papers are my past papers." Obvious.
- **More:** "Everything else, sorted by what I want to do." Obvious. Colleges is in the first view.

**For a first-time student:**
- **Pros:**
  - The headings explain the groups.
  - "Your Mob, with friends" explains the coined word.
  - "Your papers" (D106) says what Review holds.
- **Cons:**
  - Four headers plus 15 rows is the most text in the rail.
  - Its words ("Practise", "Your results") differ from the app's places, so this is two maps again.

**For a heavy user:**
- **Pros:** Papers stays one tap.
- **Cons:** the most renaming (Review and every group), and the tallest rail (1048 px at touch size).

---

## Recommendation: A (Same five as the app)
**Why:**
1. **One map for app and web.** He has already picked this structure for the app (D105) and the "Your papers" name (D106). A student uses both with the same hands, so the website's phone bar should be the app's bar. This is the consistency research rule: S016 (WCAG 2.2, consistent navigation and identification) and AGENT_RULES 11. It is also his taste checklist item 10: one label per action.
2. **It answers all three parts of G24 literally:**
   - the Mob is a place of its own (top level in the rail, one tap on a phone);
   - nothing is "inside Study" (the Study header is gone);
   - "Planning" is gone, with Marks trend and Colleges sitting under You, next to Progress.
3. **It is the calmest rail:**
   - no group headers to decode, just four bold places with their pages indented under them;
   - the shortest rail at touch size (976 px, against 1044 and 1048);
   - the only phone sheet that needs no scroll.

   This rests on AGENT_RULES 7 and 8 (one clear action, ranked by what helps the student decide) and his checklist item 7 (calm structure through grouping, not deletion).
4. **Nothing is hidden (R3) and no page gets denser.** Every page keeps its link on desktop and stays within two taps on a phone. This keeps clear of the 15 Oct failure. S014 (progressive disclosure for secondary pages, never for frequent ones) is met: the frequent places (Today, Practice, Start, Mob) are on the bar.

**Conditions for the build:**
- **The Practice tab row:**
  - It appears on Practice, Your papers, Learn, Explore and Saved, and the Mob page gets "Your Mob, Your standing".
  - It needs the G27 cue: the last visible tab cut at the edge, a one-time 24 px nudge on first view (reduced motion: none), and a right-edge fade.
- **Today keeps its colleges card** with "See all N" (D104), because Colleges leaves the dock.
- **The badge moves:** the Review badge moves to Practice on the dock and to "Your papers" in the rail.
- **"You" opens the Account page** (`/profile`) on desktop. On a phone it opens the You sheet. A full You hub page like the app's can follow later.
- **Labels change, routes do not.** `/review` stays `/review`, so the tests that pin routes keep working, and only the label tests change.
- **Code shape:** `arenaNavigation.js` returns four place groups whose first item is the place and whose remaining items are `sub()` items. `MOBILE_STUDY_NAV` becomes Today, Practice, Mob and You, with the Start key rendered as the third child of the capsule. The sheet's groups are "Your progress" and "Your plan".

**Fallback:** B, if he wants the smallest change for release 11. It fixes the three things he named, but leaves the website and app on two different maps.

## New copy (R6, read aloud)
- **Rail:**
  - "Ask Mobi"
  - "He knows your record." (true: Ask Mobi answers from the student's saved sessions, `MentorRecordPage`)
  - "Mob, with friends" (A)
  - "Your Mob, with friends" (C)
- **Phone sheet:**
  - "Ask about a question, a result or your plan." (the live note, made a full sentence)
  - "Sign out"
- **Group names:**
  - A: "Your progress", "Your plan" (phone sheet only)
  - B: "Study", "Together", "Your goal", "Account"
  - C: "Practise", "Your results", "Aim for a college", "Help and account"
- **Tab labels** (A): "Practise", "Your papers", "Learn", "Explore", "Saved"
- **Dock label** (C): "Papers"

## Questions only he can answer
1. Which option: A, B or C? The boards mark A as recommended.
2. If A: the place is called "Mob", as in the app, with "with friends" beside it in the rail. Is that the right word for the website too?

## Verification and limits
- **What I exercised:** the release 10 shell on the preview fixture (illustrative data), at 1440 x 900 and 390 x 844, in Night and Day, in headless Chrome with reduced motion. I measured the rail and sheet heights, the page overflow, and the tab and dock target sizes. I opened all 24 option images and both boards.
- **What these images are:** compositions, not a build. The new links are not wired, there is no motion, no real account was used and nothing is deployed.
- **The mock is on preview data:** "Your papers 8" is the preview's Revise count, and the Today page is the preview fixture.
- **What the build must still check (R1, R5):**
  - a fresh account, and the heavy account;
  - a real-pointer click on every rail and dock link, with a hit test;
  - keyboard order and the 44 px rule on touch;
  - the tab row's nudge and the dock lens as frame sequences.
- **Clean-up:** the scratch worktree `wt-b1-webnav` (detached at 23a7c090, used only to run the preview server on port 3219) was removed after the renders.
