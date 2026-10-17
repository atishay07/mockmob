# Badges: refine, never remove (D19, the owner's answer of 18 Oct about 3:50 am)

**His words:** "What I meant here was that badges are not incorporated properly but they look cool so keep them don't remove just refine the UI and functionality around them."

So **option A in BADGES-ICONS-1018 (removing the badges) is rejected.**

This pass keeps:
- every badge;
- the four paths;
- the Medal art on the web;
- the brass coins in the app.

What changes is **where the badges live**, **what a tap tells you**, **how earning one feels** and **how a badge leads to the next thing**.

## What exists (read before building)

**Web:**
- Definitions: `src/lib/studyBadges.js`.
  - 16 badges on 4 paths: Papers, Repairs, Weeks at your goal, Your best work.
  - Each badge has an `id`, `name` and `condition`, and a `source` of server or derived.
  - Each path has its own link.
- API: `src/app/api/me/badges/route.js`.
- Component: `src/components/StudyBadges.jsx` (with `Medal`), styled by `study-badges.css`.
- Where it renders: inside `RhythmCard.jsx`, behind its "more" expansion (`moreArmed`), on Progress. **This is the "not incorporated properly" part: the badges are buried.**
- The `pr-badge` pills on Progress rows ("2 delayed checks", "Awaiting repeated evidence", "12 to review", "All correct") are **status labels, not badges**. They look like stickers and use one shape for both praise and warning.

**App:**
- You → Milestones (`/you/milestones`).
- Brass coins: `medal.dart`, `token_shelf.dart`, `earned_token.dart`, `locked_coin.dart`.
- Data from rhythm milestones.

## The refinement

### 1. A real home for badges
- **Web Progress:** a "Badges" section of its own, placed right after the study record. Take it out of RhythmCard's "more".
  - **Phones:** a horizontal shelf of earned medals, newest first, then **the next badge to earn** as a ghost medal. The ghost has a thin progress ring and one line, e.g. "Repairs: 7 of 10. 3 more repairs."
  - **Desktop:** the same shelf, then the four paths inline, using the existing StudyBadges layout.
  - The section's head reads "Badges, 6 of 16". Its link reads "All badges" on phones; it opens the full four-path view as a sheet.
- **App You:** the same structure, with the brass coins kept. The shelf of earned coins comes first, then the next coin as a ghost with a ring and the count left. "All badges" opens the existing token shelf and paths.

### 2. A tap explains the badge and leads somewhere
Tapping any medal or coin opens a small detail sheet: a popover on desktop, a bottom sheet on phones and in the app. It holds:
- the medal, large;
- the name;
- the condition (the existing `condition` text);
- **when it was earned** (date, 12-hour time);
- **the paper it came from** ("From Accountancy full mock, Sat 17 Oct, 9:12 PM", with "Open that paper", where an `attemptId` exists);
- **the next badge on the same path**, with the exact count left and the path's action key (Choose practice, Open your mistakes, and so on).

An unearned badge shows its condition, the count so far ("3 of 5 full mocks") and the action key.

### 3. Earning one feels like something, once
- When a scored set earns a badge, the **result page** shows one compact "Badge earned" row near the top of the analysis: the medal, its name, and "See your badges".
- The medal reveals once: scale 0.85 to 1 with a single light sweep across the metal, 600 ms ease-out. Under reduced motion, a 150 ms fade.
- In the app, the same moment appears on the result, followed by one haptic tick.
- Never a modal. Never repeated: a per-badge "seen" key plus the server's `achievedAt`.
- Two badges at once show as one row: "2 badges earned".

### 4. Status labels stop pretending to be badges
On Progress rows, the `pr-badge` pills become quiet meta text in the row's meta column:
- warnings ("12 to review", "2 delayed checks") in warn text;
- praise ("All correct") in ink 2.

The shape and the words carry the meaning together, so colour is never the only signal, and the real badges are the only badge-shaped things on the page.

### 5. Truth rules
- A badge counts as earned only with a real `achievedAt` from data.
- Unknown is never zero: if the reads fail, the section says so in one line, with Try again.
- Counts always have their denominator.
- No ranks, names of other students, streak flames or locks. The `locked_coin` ghost stays a ghost (a dashed coin), never a padlock.

### 6. Parity
- The web (`studyBadges.js`) is the source of truth for the 16 ids, names and conditions.
- The app matches them. If an id exists on only one side, list it in the report; don't invent one.

## Acceptance
- Badges are visible on Progress (web) and You (app) without opening any "more".
- A tap on any badge explains it and offers the next step.
- The earned moment shows exactly once, on the result.
- The `pr-badge` pills are text now.
- Checked at 390 and 1440 (web) and 412 (app), Night and Day, in these states: no badges yet, some earned, all earned, read failed.
- Night stays subtle: no glow on the medals beyond the existing lamp light.
