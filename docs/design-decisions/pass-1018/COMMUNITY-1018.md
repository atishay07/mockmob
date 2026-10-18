# Community: what exists, what would go, and a better social side (D21 and D22), 18 Oct 2026

Design only. Nothing was changed in product code. Nothing here is deleted or hidden until the owner decides D21. No mock was made for this topic; section 7 is a plain diagram.

Sources read: `OWNER-FEEDBACK-2026-10-18-DAWN.md` (D21, D22, "Pattern to stop"), `OWNER-MASTER-LEDGER.md`, `FEATURE-ADOPTION-2026-10-17.md`, the Mob spec (`pass-1016e/SOCIAL-SPEC.md`), `web-mob-1016.md` and `MOB-APP-DECISIONS.md`. Code read on website `origin/main` 9578ee66 (release 4) and the app in `wt-v15` (76ee2e90, read only). Usage numbers are select-only counts on production (Supabase `isrxrxzjocewrdureyhp`, 18 Oct, no rows of anyone's data read).

## 1. The decision in short

1. **Suspend the writing side, keep the rest.** Contribute, My uploads and the vote arrows are hidden. Their data and routes stay. "Your standing", Explore, the error flag, the Mob and the badges all stay.
2. **Retire the word "community".** The social side is **the Mob** (group of up to 5) plus **Your standing** (you against everyone, anonymous). Nothing is called a community any more.
3. **Make the social side work at tiny numbers.** Only 4 students attempted a paper in the last 30 days, so every mechanic below works with 2 people, or with no people at all, and is also a way to bring a friend in.
4. **Nothing is built for D22 until he sees it.** Section 5 is the concept, in words. He picks the name and the mechanics; a mock-up of the chosen ones comes before any build.

## 2. What the data says (production, 18 Oct)

| Signal | Count | Reading |
|---|---|---|
| Questions written by a student | **0 of 11,118** | The only user-linked author is the admin account (666 questions, 7 Oct). The rest are imports, the pipeline, Claude-authored waves and past papers. Matches his words: "no one uploaded anything". |
| Accounts | 1,541 (1,537 students, 3 creators, 1 admin) | |
| Students with at least one recorded paper | 794 of 1,541 (52%) | These make up the standing board. |
| ...with 2 or more / 3 or more / 10 or more papers | 343 / 193 / 20 | The top 10 ladder only shows on boards of 20 or more, so it shows today. |
| Students who attempted a paper in the last 30 days / 7 days | **4 / 3** (10 attempts in 30 days) | The board is mostly last season's cohort. New accounts in 30 days: 8. |
| Question votes | 292 by 169 students | 284 of them in May 2026. **0 in the last 30 days.** |
| Error flags ("report" on a question) | 101 | All in May 2026. The one community-ish act students really did. |
| Answer-key disputes / AI reply reports | 4 / 0 | |
| Moderators | 0 users flagged as moderator | Nobody exists to review uploads; routine human review is not promised (AGENTS.md). |
| Mob tables | **none on production** | The Mob migration was never applied. |
| Page visits | not measurable | `usage_events` has 0 rows, so usage of /leaderboard, /upload and the rest is unknown. |

Two lessons the design uses:

- Asking a student to **write a question** got zero. Asking a student to **flag an error** got 101. The ask that is small, immediate and about their own work is the one that works.
- A global board of 794 mostly dormant students is a ghost town. Anything social that needs many active people will feel empty until CUET 2027 season brings them in.

## 3. Inventory: everything "community" today

### Website

| # | Thing | Where | What it does | Signal | If suspended |
|---|---|---|---|---|---|
| W1 | Sidebar group "Community" | `arenaNavigation.js` | Header over Your Mob (hidden, flag off), Your standing, Contribute, My uploads | n/a | Drop the header. Standing moves under Progress. Contribute and My uploads are hidden. |
| W2 | Account, "Community" rows | `/profile#community`, `accountModel.mjs` `COMMUNITY_ROWS` | The same three rows, so a phone reaches them without the menu | n/a | Keep the Your standing row; hide the other two; heading renamed. |
| W3 | Contribute | `/upload`, `/api/questions/upload` | Single question form and a Bulk JSON import tab; 30 a minute, 200 a day; lands as pending moderation | **0 student questions ever** | Hidden. The route answers a calm "paused" page, never a 404; the API answers `contributions_paused`. |
| W4 | My uploads | `/my-uploads`, `/api/questions/mine` | Your latest 20 with Awaiting checks, Live, Held | empty for every student | Hidden with W3. |
| W5 | "Add a question" panel on Practice | `DashboardPageClient.jsx` | "Upload a question. If it passes moderation, you earn practice credits" plus My submissions | 0 credits earned (`contribution_points_90d` is 0 for all) | Panel hidden. Also a promise nobody has ever collected on. |
| W6 | Question votes (up/down) | `VoteControls` on Explore cards and in the runner; `/api/questions/[id]/vote` | A quality score that helps rank the feed | 292 votes, 0 in 30 days | Arrows hidden, API and table kept. |
| W7 | Explore | `/explore`, `DiscoveryFeed` | Untimed question feed with answer, reasoning, Save | about 2,900 question views Apr to Jun, 18 in Oct | **Stays.** It is practice, not community. Only its vote row goes. |
| W8 | Flag a problem | Explore cards, result "report a key" | Sends a question or key for a recheck | 101 flags, 4 key disputes | **Stays and grows** (see M5). |
| W9 | Your standing | `/leaderboard`, `standing.js`, `/api/leaderboard` | Your place among ranked students, points to the next place, the anonymous top 10 and the spread, your papers over time. No name, id or image of anyone else ever leaves the server. | 794 ranked, 4 active in 30 days | **Stays.** Also reached from Practice's stats row ("Your standing #N of M"), Features, Pricing (a plan row and a FAQ answer) and the landing Benchmarks scene. |
| W10 | The Mob | `/mob`, `/join/<code>`, Today card, Practice chip, 12 API routes | A private group of 2 to 5 sits one 10-question paper a week; shared ring; shared trap; no ranks, no list of non-sitters | not live: flag off, tables not on production, staging gate NO-GO (8 of 10, five defects in NOW.md) | Stays built and off. Switch-on is a separate decision (section 6). |
| W11 | Moderation | `/moderation`, `/api/questions/moderate`, internal process and recover routes, `/api/mob/reports` | A queue for moderators | 0 moderators | Stays, invisible. Becomes unused if W3 is paused. |
| W12 | Badges | `/api/me/badges`, `StudyBadges` on Progress | 16 personal milestones with dates and counts | personal, not social | Not community. Listed because he named badges as part of what he finds cringe elsewhere; D19 already asks for their redesign. |
| W13 | Creator area | `/creator`, `/api/creator/me`, admin creators | A referral and payout dashboard for 8 creator rows | partner programme | **Not community.** Must not be swept up in any rename. Likewise the landing `CreatorReels` (three Instagram reels as social proof). |
| W14 | Copy that says "community" | `seoPages.js` ("focuses on community-driven questions"), `seo.js` and Terms description ("community questions"), Terms "Community submissions", Privacy "Community content" | | | The SEO line is not true today (0 student questions) and is reworded whatever he decides. Terms and Privacy keep their clauses while the upload API exists; they are revisited when it is closed. |
| W15 | The word "leaderboard" | landing Benchmarks scene ("Every mock earns points ... on the leaderboard", button "See the leaderboard"), route `/leaderboard` | | | Reword to "Your standing". The page shows no list of people, so "leaderboard" over-promises and is the word he finds cringe. The URL stays so links work. |

### App (Flutter, wt-v15)

| # | Thing | What it does | If suspended |
|---|---|---|---|
| A1 | Contribute, My uploads, leaderboard, standing screen | **None of these exist in the app.** | Nothing to remove. The app is already free of the community idea. |
| A2 | Question stream (`/practice/stream`, the Explore twin) | Untimed questions with a quality vote up and down, "Flag a problem", Save | Hide the vote row; keep Flag a problem and Save. |
| A3 | Result "report a key" (`report_key.dart`) | Flags an answer key | Stays. |
| A4 | The Mob (`features/social`, `mob_routes.dart`) | Full screens built (Mob, join, compare, history), off behind the server flag; no entry drawn while off | Stays off until switch-on. |
| A5 | Badges row (Rhythm/You) | Personal milestones | Not community. D19. |

Result: the website carries the whole community surface; the app carries only the Mob (off), two vote arrows and the error flag.

## 4. What D21 costs, and what it frees

If he suspends:

- **Hidden, not deleted:** W3, W4, W5, W6 (and A2's votes). All tables, routes, files and the 666 + imported rows stay. A single flag, `CONTRIBUTE_ENABLED` (default off), switches the writing side back on.
- **Folded:** the sidebar "Community" header disappears; Your standing sits under Progress (a row on the Progress page and a sidebar sub-link), which he called good.
- **Reworded:** W14 and W15, which are truth fixes anyway.
- **Stays:** Explore, the error flag, Your standing, the Mob, badges, the creator programme.
- **Frees:** one nav group, three account rows, one Practice panel, one unfulfilled credit promise, a bulk JSON form that looks like exactly the "basic form" he rejects (D3).
- **Does not touch:** Today, Practice, Result, Review. This is a nav and copy change, so it does not repeat the "rebuilt what he wanted refined" pattern.

Recommendation: yes, suspend the writing side. It has produced nothing in a year, has no reviewer behind it, and its one promise (credits) has never been paid.

## 5. D22: the concept brief

### 5.1 Name (five options)

| Option | Line | Risk |
|---|---|---|
| **Mob** (recommended) | The brand's own word (mock plus mob, and Mobi). Already in the built screens and copy: "Your Mob". The explainer is one line: "up to four friends, one paper a week". | "Mob" can read as a crowd; the cap of 5 and the copy answer that. |
| Circle | His own phrase, "social circle". Clear in a second. | Generic; no personality. |
| Crew | Casual and friendly. | Close to the squad slang of the apps he finds cringe. |
| Batch | Indian coaching word ("my batch"); everyone gets it. | Suggests a paid class and a teacher. |
| Benchmates | Bench plus mates, the school word; a wink at our Benchmarks. | Cute, long, and easily confused with the Benchmarks feature. |

Pick: **Mob** for the group and for the nav item. "Community" is dropped as a word everywhere. "Your standing" keeps its name; he said it is good.

### 5.2 Rules that keep it out of the cringe

- No invented currency or status words (aura, farmers, moggers), no titles, no ranks among friends, no public profiles, no avatars beyond an initial.
- No chat, comments or free text between students (the Mob's existing rule, and minors' safety).
- No shame: never a list of who has not sat, no streak that can be lost for someone else (T005, rule 22).
- Badges stay personal receipts with dates, not status symbols.
- Real numbers with denominators; a count under 5 or a pool under 30 is not shown.
- Cooperative by default: the ring only fills.

### 5.3 Mechanics (six)

| # | Mechanic | What the student sees | Why it is useful | Why it is not cringe | Build |
|---|---|---|---|---|---|
| M1 | **The weekly Mob paper** (built) | Same 10 questions for up to 5 friends; one ring that fills; "Your Mob's trap: 3 of 4 picked B on question 6", opening the repair | Turns the unlimited-mocks advantage into a reason to return each week | Nobody ranked, nobody named | Done. Needs the gate's five fixes and the migration. |
| M2 | **Send this paper** | After a result: "Send these 10 to a friend". They open a link, sit the same paper, and both see **where you differ**: the questions one got right and the other did not, each with its repair | Learning from a friend's right answers is the useful part of comparing; it is also the lightest possible invite (T003, value before the account wall) | Not a win or a loss; no totals compared, only questions | Medium. Reuses the Mob's frozen paper and compare view as a one-off pair. About 2 hours with parallel agents. |
| M3 | **Trap of the week** | One question, anonymous: "61% of 340 students picked B." Opens the reason and the repair; shareable card | Works with no friends at all, and with tiny numbers because it counts everyone | No people appear, only a count with its denominator | Small. `question_option_stats` already exists; add a threshold of 30 answers. About 1 hour. |
| M4 | **Your Mob and the baseline** | On the Mob page: "Your Mob averaged 31 of 50 this week. Students on this subject averaged 24 of 50." Shown only when 30 or more sittings exist | Gives the group something to measure against that is not each other | Team against the field, never member against member | Small, after M1 ships. Thin today: 4 active students, so it stays hidden until the pool is real. |
| M5 | **Caught it** (replaces Contribute) | You flag an error. When it is fixed you get a private line: "The key on this question was wrong. Fixed on 12 Oct, after 3 flags. Thank you." Also counts toward a personal badge | Building on what students did (101 flags), not on what they did not (0 questions); closes the loop and improves the bank | A private receipt, no public names or points | Medium. Needs the flag linked to the fix and a notice. About 2 hours. |
| M6 | **Your climb** (standing, sharpened) | Your place and band, then the one thing that moves it: "6 more marks in Accountancy moves you up 9 places"; a season window instead of "all time" | Makes the board a plan, not a number; reuses the record trend already built for it | Anonymous, and about you | Small to medium. Season filter on `mm_leaderboard` plus one line. About 1 hour. |

Not proposed: leagues, a public list, friend-invite credits, a chat, a contacts permission. These were rejected on 16 Oct (SOCIAL-SPEC section 12) and the reasons still hold.

### 5.4 How it ties together

- **Your standing** is you against everyone, anonymous and private. **The Mob** is you with friends, cooperative and never ranked. They stay apart by rule: the Mob never sorts people, and standing never shows a name.
- The only bridges are aggregates: M4 (the Mob against the platform) and, if he wants it later, an optional "show my band to my Mob" that shows a band like "top 20%" and never an exact rank.
- **Adoption (F18):** the Mob appears after a 7-day run, M2 appears at the result, M3 on Today, M5 on the flag. Each feature arrives at the moment it is useful, never as a tour.

## 6. Cheap to build, in order

1. **Copy and nav (D21, no new feature):** drop the "Community" header, hide W3 to W6, reword W14 and W15. Under an hour.
2. **M6 season window and M3 trap of the week.** About 2 hours together.
3. **Finish the Mob (M1):** fix the five gate defects, apply the migration to production only after the gate passes, then switch on at 10 of 10 (the steps are in NOW.md). Already costed; blocked only on D21.
4. **M2 send this paper.** About 2 hours; the best growth lever, since each share is an invite.
5. **M5 caught it.** About 2 hours.
6. **M4** once real traffic exists.

Everything is measured the way the Mob spec already says: Mob papers sat per active Mob, with groups under 5 hidden.

## 7. Diagram: the circles

```
 The whole field (no people, only counts)
 trap of the week, the baseline, the standing band
 +--------------------------------------------------------------+
 |  Your Mob: up to 5 friends, one paper a week, one ring       |
 |  +--------------------------------------------------------+  |
 |  |  A pair: send one paper, see where you differ          |  |
 |  |  +--------------------------------------------------+  |  |
 |  |  |  You: your standing and your climb (private)     |  |  |
 |  |  +--------------------------------------------------+  |  |
 |  +--------------------------------------------------------+  |
 +--------------------------------------------------------------+
 Rule at every ring: no ranks among friends, no names of non-sitters,
 no free text, and a count under 5 is never shown.
```

## 8. Owner questions

1. **D21:** suspend Contribute, My uploads, the Practice "Add a question" panel and the vote arrows (hidden, all data kept, one flag to bring them back)? Recommended: yes.
2. **Name:** is "Mob" the name for the social side, with "community" retired? Or do you prefer Circle, Crew, Batch or Benchmates?
3. **Mechanics:** which of M2 to M6 do you want mocked up first? Recommended: M2 and M6, since they are the most visible.
4. **Standing window:** change it from "all time" to the CUET 2027 season, so you are not ranked against last year's students? Recommended: yes.
5. **Caught it:** is a private thank-you after a fixed error enough, or do you want a visible mark on the profile?
6. **Mob switch-on:** after the gate passes, may the Mob go live as the social side (no new data on production until then)?
7. **Transcription check:** the app he named "RPM" was heard, not confirmed. Does it change anything above if the name is different?
