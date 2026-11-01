# Round 2 notes between packets (append only)

## P3 (chapter page, Explore, tabs), 1 Nov 2026
- **Shared files P3 touched (merge with care):**
  - `src/lib/server/learn.js`: only `preview()` (adds `firstUp`, 5 lines before `return ok({`, and one field). No P1 or P2 function.
  - `src/lib/arenaNavigation.js`, `src/components/nav/PlaceTabs.jsx`, `src/app/(app)/nav-places.css`: the four-tab phone row.
  - `src/app/api/bookmarks/route.js`: a `?count=1` branch for Explore's "Saved 2".
  - `src/components/feed/QuestionCard.jsx`: a `closed` prop (stem first, "Answer it" opens the options).
  - `src/app/(app)/dashboard/DashboardPageClient.jsx`: Pro loses the "Included" tile badges and the head pill/sentence; the old
    lessons card (ConceptsPanel) is hidden while Learn v2 is on.
  - `src/app/(app)/saved/*`: "‹ Explore" back link, the one-time swipe cue in place of the swipe sentence.
  - Tests: `exploreModel.test.mjs` runs inside `test:learn` through an import at the end of `coverModel.test.mjs` (package.json
    left alone so three packets do not edit its one test line). The orchestrator may move it into `test:learn` directly.
- **Request to P1 (Learn home):** the old lessons card left Practice (a second Learn door). When a lesson is due, offer it as one
  of Learn's "Or" rows (for example "Revaluation of assets and liabilities, 7 min"). Until then lessons stay reachable from each
  chapter page's shelf ("Everything in this chapter").
- **Request to P1:** the chapter page shows only "Needs work" as a verdict (chapterModel `chapterVerdict`); the roadmap should
  use the same rule so the words agree.
- **Request to the orchestrator (dock badge, `AppLayoutClient.jsx`):** phone-clarity item 13 wants the dock's Practice badge
  ("8 due") as a dot too. P3 did not touch the dock (not in its list); the tab row's Papers count is now a dot.
- **Not done (left on purpose):** Fine-tune is drawn twice on Practice (the block and the strip above Start). phone-clarity 14
  says drop the strip, but the owner asked for it right above Start (F8), so it stays until he says otherwise.
- **Preview fixture (not P3's file):** `ArenaPreviewClient.jsx` answers GET `/api/bookmarks` with 2 saved questions for every
  student, so a brand-new student's Explore head reads "Saved 2" in the preview (90-explore-first-visit shots). Real accounts
  read their own count. A fix would return 0 for `student=new`.
- **Content call seen in "First up":** "What is partnership?" and "Define partnership." open the same run side by side (the
  near-duplicate pair still open in the owner's 1 Nov notes).
- **Shots:** `tmp/learn-1101/r2-after/p3/` (index.json lists each with its URL); script `scripts/design-audit/learn-1101-r2-p3-capture.mjs`.
