# Round 2 notes (append only): requests across packets, deferred items, owner actions

## P1 Learn home and roadmap (web/1101-r2-home), 1 Nov 2026

Requests to other packets / the orchestrator (P1 did not edit these files):
- **P2 (learn.js end()):** pass `unseen: info.coverage.unseen` to `endOptions(...)` (around the `let opts = endOptions({` call). `data/learn/suggest.js` endOptions now takes `unseen`; with 3 or more the lead is `30 new cards left here` / key `Next 10 minutes here` and the next chapter follows as `Next chapter: <title>` (ruling 3). Without the field the old order stays, so nothing breaks before the merge.
- **P2 (run end):** a "Today's 10 minutes" run carries `start_state.today = { due }`; the end can say `Accountancy done for today.` from it (usefulness.md item 5).
- **P2 (end() level branch, usefulness.md item 11):** store the level pick as `start_state.levelPick = { subject, chapterKey, at }`; `data/learn/roadmap.js` already takes `levelPick` (the new student's position). P1 reads it once it is stored (one line in `subjectBody`: the newest ended level run's pick).
- **P3 or orchestrator:** `src/app/api/learn/covers/route.js` may pass `{ pure: true }` to `learnHttp` (a pure read: the rate limit then runs alongside, speed.md item 5a). Not done by P1 (Explore covers are P3's).
- **Dock badge (phone-clarity.md item 13, AppLayoutClient.jsx):** the badge already reads the shared `/api/learn/home` through `useLearnDue` (no change to AppLayoutClient was needed). Turning "8 due" into a dot is the shell's call (P3/P4).

Deferred / not done:
- **speed.md item 6a** (a `learn_question_index` table built by the 21:30 UTC cron) needs a migration: skipped per the packet. 6b is done (the pool pages are read in parallel once the count is known; the two managed-id columns together).
- **speed.md item 6c, owner action:** turn on Fluid compute for the Vercel project (instance reuse cuts cold starts). Not changed from an agent.
- **Final-weeks mode** (usefulness.md item 6): deferred by ruling 3 (CUET is in May 2027). Backlog.
- **Explore cover coverage line** (usefulness.md item 7, "12 of 53 cards seen" on each cover): P3's covers; the data is in `/api/learn/subject` rows (`progress`).
- `suggestions` stays in the /subject body for the app; Learn home no longer draws it (`home/Suggestions.jsx` removed).

## P2 (run, feed, ends), 1 Nov 2026 evening
- Touched outside the P2 list, one line each, for ruling 6 (a stopped run stays open to pick up today):
  - `src/components/learn2/api.js` `runEnd(id, { stop })` adds `?stop=1`.
  - `src/app/api/learn/runs/[id]/end/route.js` passes `stop` to `learn.end`.
  - `src/lib/server/learnPreview.js` line 193 passes `stop` in the preview router (P1 may add `/api/learn/home` next to it: merge by hand).
- `learn.end()` now returns `stopped`, `progress { of, seen, before }` (the chapter's cards seen, for the end's growing bar) and `chapter { key, title }`; Pro `options` is capped at 1 (an open mistake in this chapter first, "Fix 1 open mistake"). Free `options` unchanged.
- "Revise later" is the feed card's key. A question's key stays "Save": it bookmarks into Saved, not into Revise, so calling it "Revise later" would be untrue. Orchestrator: decide whether saved questions should join Revise (then rename), or keep Save.
- Deferred: the 1440 feed rail "Up next" stack (screens 19, last bullet); the two-part "Difference" line ordering (screens 6); the stem collapse to 2 lines (screens 6); the 40 px track lift after the first turn (screens 3; ruling 7 only asks for the peek and the chip).
