# Round 3 notes (append only)

Cross-packet requests: write the packet, the file, the change and why. The orchestrator merges them.

## R3-explore (web/1101-r3-explore), 1 Nov 2026

**Requests to the orchestrator (one line each, please keep on merge):**
- `src/lib/server/learn.js` (preview function, not in any packet's list): one added line in the dry run's response, `cardsSeen: info.coverage.seen` after `firstVisit`. The chapter page's Quick recap (X6) shows only when `cardsSeen > 0` (an older server without the field falls back to "not a first visit").
- R3-run (`src/components/learn2/feed/**`): Explore's own files in that folder are R3-explore's by the packet table ("its covers"): `ExploreCovers.jsx`, `coverModel.js`, `coverModel.test.mjs`, `covers.css`. R3-run keeps `ChapterFeed.jsx`, `feedModel.mjs` and the rest. If R3-run touched `ExploreCovers.jsx` or `coverModel.js`, the merge needs a look.
- `data/learn/feed.js` and `src/lib/server/learn.js` (~L1417) still build the feed lines "N old mistakes to fix" ("old"). Explore's covers rewrite "old" to "open" on the client (`coverModel.js` `openWords`), so the page is right now; the server text should say "open mistakes" too (ruling W) so the covers' lead line and the feed's own lines agree at the source.
- `data/practice_quote.js` L117 still sends "Included with your Pro access (valid until ...)" as `reason`; Practice no longer draws it for Pro (X5), but the mobile app and any other reader of the quote still gets it.
- `src/app/preview/arena/ArenaPreviewClient.jsx` (shared with R3-today, who adds a `/api/today` fixture): R3-explore changed only the `/api/bookmarks` GET line (a brand-new student, `student=new`, has 0 saved; the others see 2 that are in the syllabus) and added a comment line above it.
- `data/tests/web_fixa_1019.test.mjs`: the Practice-heading assertion now pins "What are we practising?" with no greeting name (X5, "the hero is one line"). Name dropped on purpose; if the owner wants the name back it needs a design for a one-line heading at 390.

**Left or decided (see the packet return for the full list):**
- X5 "P3's Practice change survived": the commit named in the spec (739687993) is only P3's notes commit; the change is 40323de94 (and a8c43474e). `git diff 40323de94 HEAD` on the dashboard, Explore, Saved and chapter files is empty before this packet (only ChapterFeed/feedModel/ChapterPage 3 lines/chapter.css moved), so no Practice code was lost in the merge. What still showed "Included" came from three places P3 had not removed: the server quote's reason line, the bar's price, and the "Your access" panel.

**X7, the hydration error with `&l2=off` (needs R3-home's file):** reproduced on `/preview/arena?view=explore&l2=off`: one hydration error, and it is in the app shell, not in Explore. `src/app/(app)/AppLayoutClient.jsx` ~L97 reads the address inside `useState(() => ... typeof window === 'undefined' ? false : ...)`, so the server draws the Learn nav row (`data-tour="nav-learn"`, `/preview/study`) and the client's first render draws Your papers (`nav-review`). R3-explore changed `src/components/learn2/flag.js` (new `useL2Off()`, a `useSyncExternalStore` whose server snapshot is "not off"; `useLearn2On()` uses it, no `useSearchParams`) and made `DiscoveryFeed.jsx` and `ExploreCovers.jsx` read the flag through it. flag.js is in no packet's list, so R3-home please keep that file as it is here. The shell needs this change (applied here, run on :3483 and the console was clean, then reverted because the file is R3-home's; `navAlt` just below it has the same shape and should get the same treatment):
```diff
-import { LEARN2_ENV_ON } from '@/components/learn2/flag';
+import { LEARN2_ENV_ON, useL2Off } from '@/components/learn2/flag';
@@
-  const [l2Off] = useState(() => {
-    if (!previewRoute || typeof window === 'undefined') return false;
-    try { return new URLSearchParams(window.location.search).get('l2') === 'off'; } catch { return false; }
-  });
+  const l2OffAddress = useL2Off();
+  const l2Off = Boolean(previewRoute) && l2OffAddress;
```
Until that lands, the l2=off page still logs that one shell hydration error. Console texts: tmp/learn-1101/r3-after/explore/explore-l2off-1440-console-before-shell-fix.txt (the error) and explore-l2off-390-console-with-shell-fix.txt (clean: only HMR and a not-found.css preload warning).
