# Round 4 notes (append only)

Cross-packet requests: write the packet, the file, the change and why. The orchestrator merges them.

## From R4-server (web/1101-r4-server), 1 Nov 2026

The contract fields are live in `src/lib/server/learn.js` and `data/learn/*.js`; route tests in `data/tests/learn_r3_home.test.mjs`, `learn_routes.test.mjs`, `learn_preview.test.mjs` pin them.

1. **R4-run, R4-explore, R4-home: where `place: { n, of }` is (ruling N).** Render it only through `chapterPlace(place)` / `chapterShort(place)`; `ref` is still there, for source lines only. `place` is null for a chapter that is not playable for the student (no cards, outside their part, retired): draw no label then.
   - Run and feed start, resume and GET /runs/:id: `body.chapter.place`.
   - Ends (run and feed): `body.chapter.place`; the feed end's `feed.next.place`; an end option of kind `next` carries `place`.
   - Chapter page (POST /runs/preview): `chapter.place`; `added.place` and `shrink.addNext.place`.
   - Explore covers: `covers[i].place`.
   - Learn home: every roadmap row (`parts[].units[].chapters[i].place`) and `roadmap.chapter.place` (the offer's chapter).
   - GET /api/learn/cards: `chapter.place` (one chapter) and `chapters[i].place` (the subject shelf).
2. **R4-home: `needsWorkFrom` (ruling V)** is on every roadmap row, always `'papers'` or `'learn'` ('learn' when the chapter has any Learn activity: a card state, a card moved past in a feed, an unfinished run). Draw "Needs work · from your papers" only when `verdict` is set and `needsWorkFrom === 'papers'`.
3. **R4-home: copy and rows that changed on the server (no client change needed beyond tests that pin the old words):**
   - The feed Or row's `line` is now "Scroll through the chapter, stop any time" (`FEED_ROW_LINE` in data/learn/roadmap.js). Any home test pinning "One card or question at a time" for the Or row needs the new line.
   - In `today` mode, when the offer's `sub` leads with due cards, there is no `revise` Or row (owner-eye#9). The Revise row's count always equals its `run.cardIds.length`.
   - The fix row's `run` (and the suggestions' fix `action.run`) now carries `fresh: true`. Pass `run` through whole when starting it (R4-run's `links.run` `fresh` option).
4. **R4-run: a Free stopped end can now come back with `stopped: false`.** When another run holds today's Free session, a stopped mix or feed that serves questions gets no Continue (the server would refuse its first question): the end answers `stopped: false` with the Free-done keys. A stopped level check is now ended (`stopped: false`, no Continue). A stopped Free mix or feed has no fix key on its end (server-security#1). Body `stopped` and the keys come from one expression.
5. **Orchestrator (keycards.js, no R4 packet owns it): `playable()` in `src/lib/server/keycards.js` keeps cards of retired chapters** (a retired `chapterByKey` result has no section, so `sectionAllowed` passes). Learn's due count now drops retired chapters (server-security#2), so `kc.dueCount` can be higher than Learn's `due.all` for a student who still holds states in a retired chapter. Request: in `playable()`, drop a card whose `syllabus.chapterByKey(card.chapterKey)?.retired` is true, so the Revise dot, R15 and Learn agree. The equality test (`due.all === kc.dueCount`) uses a fixture without retired states until then.
