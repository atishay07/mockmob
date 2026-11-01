
## P2 (run, feed, ends), 1 Nov 2026 evening
- Touched outside the P2 list, one line each, for ruling 6 (a stopped run stays open to pick up today):
  - `src/components/learn2/api.js` `runEnd(id, { stop })` adds `?stop=1`.
  - `src/app/api/learn/runs/[id]/end/route.js` passes `stop` to `learn.end`.
  - `src/lib/server/learnPreview.js` line 193 passes `stop` in the preview router (P1 may add `/api/learn/home` next to it: merge by hand).
- `learn.end()` now returns `stopped`, `progress { of, seen, before }` (the chapter's cards seen, for the end's growing bar) and `chapter { key, title }`; Pro `options` is capped at 1 (an open mistake in this chapter first, "Fix 1 open mistake"). Free `options` unchanged.
- "Revise later" is the feed card's key. A question's key stays "Save": it bookmarks into Saved, not into Revise, so calling it "Revise later" would be untrue. Orchestrator: decide whether saved questions should join Revise (then rename), or keep Save.
- Deferred: the 1440 feed rail "Up next" stack (screens 19, last bullet); the two-part "Difference" line ordering (screens 6); the stem collapse to 2 lines (screens 6); the 40 px track lift after the first turn (screens 3; ruling 7 only asks for the peek and the chip).
