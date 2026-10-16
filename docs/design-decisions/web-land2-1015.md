# Design decisions: landing, branch web/land2-1015

One file per branch (owner research brain, AGENT_RULES rule 39). Evidence IDs come from
docs/research/premium-ux-ui-2026-10/source-ledger/EVIDENCE_INDEX.csv.

## Round 2 fixer (16 Oct 2026), answering the land:critic-2 review (scored 82)

User task: a CUET 2027 student lands on mockmob.in, tries five questions with no account, understands what the
Mistake Lab and the rest of the product do, and decides whether to start free or pay once for Pro.

### What changed and why

| Defect (severity) | Decision | Evidence | Trade-off |
| --- | --- | --- | --- |
| Pricing intro set a monthly price against the one-time price (high) | The intro now says only what can be bought today: "Free keeps practice and your progress open. Pro is one payment of ₹99, not a subscription." The Pro card already gives the end date and the no-renew line. The FAQ answer no longer names a future monthly price. | T006, AGENT_RULES 19 and 21 | The upcoming monthly plan is not mentioned on the page until it exists |
| "Radar", "PrepOS" and "XP" in visible copy (owner rule; the critic missed it) | Tour tabs and copy now read "Weak chapters" and "Ask MockMob". The Pro list reads "Every chapter ranked, with pace and changed answers", leaderboard points replace XP, and the sample result says "A full mock shows which chapters to fix first." | S017 (names that mean something to a visitor) | App screens keep their internal names. Only the landing changed. |
| Mobi's feet under the bar on the phone sample result (medium) | No Mobi inside the sample card's result at any width. On desktop the card-top Mobi fades out (150 ms) whenever any of him is under the bar. | Slop list 1 (nothing floating over content) | The result loses a second, static Mobi. The phone dock and the card seat still react. |
| Desktop flyer parked over the FAQ (medium) | The flyer shows only once 60% of a seat is in the window. It rides the seat exactly (no clamped point between seats, no eased lag), so he is only ever standing on the close's seat. | Slop list 1 | He no longer drifts in ahead of the close. He appears already on the seat. |
| Content column off centre at 1280 to 1440 (medium) | Removed the dead right-hand "Mobi lane" padding. Nav, every section and the footer now share one centred 75rem column (80/80 at 1280, 123/123 at 1366, 160/160 at 1440, 325/325 at 1920). The nav key ends at the content's right edge. | S011 (one hierarchy, one grid) | none |
| Lab wheel trap on a continuous spin (medium) | ScrollStory still moves one step per gesture. Once a single unbroken wheel stream has pushed 1.5 screens past its step, the story lets go, as Escape does, and the beats show the remaining scenes as the page passes them. On phones, a contained inner screen (Repair) that reaches its end hands the stream to the story instead of swallowing it. | AGENT_RULES 31 (motion must not trap), slop list 17 | A very hard trackpad fling can now pass a scene unread. That is the reader's intent. |
| 1440 hero: empty band under the card, facts below the fold (medium) | Hero grid areas: copy and card share row 1 with their feet level (the card's foot meets the keys' edge). The small print runs on in row 2. The facts row is 1.75rem under it, across the full column, and peeks above the fold at 1440x900. Each fact is one line ("Two exam screens: MockMob or NTA style."). | S011 | On desktop the card grows upward when a subject is picked, because its foot is pinned. Answering never moves the question: the reason's room stays reserved on desktop. |
| Skeleton bars before an answer (medium) | Removed. One plain line: "Tap an answer to see why the key is right." The reason still rises in place on answer (mm-rise). Phones no longer reserve an empty band, so the card grows downward. | AGENT_RULES 17 (no fake progress), slop list 13 | none |
| Near-duplicate chapter rows on the result (low) | Missed chapters are grouped: "Partnership", with the topics in grey under it. Two sample labels were corrected to share the "Partnership:" prefix. | AGENT_RULES 9 | none |
| Unlit statement words about 1.5:1 on Day (low) | The unlit opacity is 0.42 on Night and 0.52 on Day, so the whole sentence stays readable mid-scroll. | S016 (WCAG 2.2) | The scrub's lit-against-unlit contrast is smaller, but still visible |
| Mock keys looked pressable (low) | Keys drawn inside product screens ("Set up", "Practise 5 on this chapter", "Start the 10") are accent outlines, never filled volt keys. | AGENT_RULES 27 and 30 | none |
| Instagram "690+ likes and comments" against "695 likes" (low) | The summary keeps only the follower and view floors. The likes stay on the creator's own row. MockMob's posts are named by day ("26 April", "28 April (1)", "28 April (2)"), and each has a distinct accessible name. | AGENT_RULES 5 (no invented counts) | none |
| 10 to 11 px legends and captions (low) | 12 px floor for legends, captions, the exam replica's note, legend and keys, and the Lab's pace and time labels. Letters inside dots and palette cell numbers stay small, by design. | S016 | Fluid heading sizes (66.78 px hero at 1440) are kept: they fit the lines and were not snapped |
| Nav key cramped at the top (low) | Compact 40 px face on a 2 px edge, centred on the bar (8 to 50 px in a 61 px bar). An invisible ::after keeps the 44 px target. Hover and focus no longer glow: a 1 px lift over a neutral shadow, and a focus outline. The dock's one-time glow pulse was removed. | Owner slop list (glow) | none |
| Phone lineup read as a 2 by 2 icon grid (low) | Below 960 px each paper is a hairline row: object, name, and the count set right in tabular figures. The held scene's rise still plays. | AGENT_RULES 12 (vertical rhythm for dense mobile content) | Smaller objects (72 px) on phones |
| Faint grid behind the hero (low) | Removed (type first, nothing ambient). | S017, S018 | none |

### Verification (16 Oct 2026, my own headless Chrome over CDP on dev server :3122, real CDP pointer events, hit-tested)

- Sample drill at 390 Night, 390 Day and 1440 Day: Try 5 questions, then Accountancy, 5 answers, 5 Next presses and See your result. Every target was hit-tested. Result rows are grouped. No Mobi sits inside the card, and none shows under the bar.
- A continuous wheel spin (30 ticks of 1/30 page) passes the Lab and the tour at both widths. A gentle flick still moves one Lab step at a time (0 to 1 to 2 to 3).
- Flyer trace from the FAQ to the close at 1440, Night and Day: hidden until the seat is 60% in view, then exactly on the seat (flyer top equals seat top).
- Column gutters measured at 1280, 1366, 1440 and 1920: nav, main and footer are identical and symmetric.
- A rendered text scan at 390 and 1440 finds no PrepOS, Radar or XP in text, aria-label, title or alt.
- Captures are in mockmob-next/tmp/landing-1016/fix-2/: hero, drill, statement, pricing, Instagram, Lab SWOT, tour, the flyer, Compass at 1280, and full sweeps with contact sheets (sweep/night-390, sweep/day-1440).
- npm run test:app passed 256 of 256. The landing tests plus landing_content and sample_import passed 58 of 58. ESLint is clean on the touched JS.

Not run: a production build, a real device, and reduced motion (the changes keep the existing reduced-motion paths).
