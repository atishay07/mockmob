
## P4 Speed (web/1101-r2-speed), 1 Nov 2026

**Done:** speed.md items 1 (auth chain), 4 (`GET /api/today`), 7 (feed, part), 8 (CSS, part), 11 (`/api/stats`), 16 (summary user read in parallel), 17 (`published()` memo); ruling 12's Today check.

**Cross-packet edits (one line each; please keep on merge):**
- `src/app/page.js` (P5 owns the hero section): first line `import '@/app/marketing.css';`. The `.mm` system left `globals.css` and must load before `landing.css`.
- `src/app/preview/arena/ArenaPreviewClient.jsx` (P3 removes the `/api/learning/summary` fake there): adds a `/api/today` fixture and a brand-new-student Today fixture (`newOnToday`). `previewMob.js` also gets the new-student line.
- Any new public page or component that draws `.mm` or an `mm-*` class must `import '@/app/marketing.css'`. `data/tests/css_split.test.mjs` (in `test:app`) fails if one does not.

**Left for others or later:**
- Items 2 and 12 (`DiscoveryFeed.jsx`) belong to P3. Items 3, 5, 6 and 10 (`learn.js`, `learnHttp.js`, `learn2/api.js`) belong to P1.
- Item 7: `select('*')` stays. `readablePracticeQuestions` checks the signed `evidence` record of every row, so the wide columns are needed. A cheaper read needs a verdict index (`evidence_verdicts`), which is a separate packet.
- Item 8: app pages are now 400 to 516 KB of decoded CSS (from 468 to 557 KB), not 150 KB. What remains is Tailwind utilities from the whole tree (121 KB), `arena.css` (96 KB) and the page sheets. Getting lower needs a second Tailwind entry for the app, or splitting `arena.css` by page.
- Not started: item 9 (static app shell), item 13 (phone glass is a visual change and needs the owner's call), item 14 (lazy Mobi rig), item 15 (home main thread, with P5), item 18.
- Item 6c is an owner action: turn on Fluid compute in Vercel.
