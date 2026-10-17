# Web pages sweep, 17 Oct (nav, dock and global design)

Owner ledger: `docs/brain/WEB-OWNER-LEDGER-2026-10-17.md`, items W-067 to W-092. Research rules: `docs/research/premium-ux-ui-2026-10/AGENT_RULES.md` (rule numbers below), with the evidence IDs those rules cite. Companion notes in this folder: NAV, GLASS, START, TODAY, RESULT, LEARN-REVIEW (all 17 Oct).

This note covers the pages that had no note of their own: Colleges, Account, Rival, Ask Mobi, Help, Your standing, the public Features and About pages, and the global pieces (theme switch, sidebar foot, page transitions).

## Decisions per page

| Page | What changed | Why (rule, evidence) | Ledger |
|---|---|---|---|
| Colleges (`/admission-compass`) | One name everywhere: dock, sidebar ("Colleges, DU cutoffs"), topbar, page heading, tab title, the Account line and its key ("Open Colleges"), My colleges' empty key. The question it answers moved into the lede. | Navigation labels stay consistent with the selected state (11, S016). | W-067, W-090 |
| Account (`/profile`) | Heading "Your account." instead of "Your corner of the Arena."; "See Pro" marked as the page primary so the sidebar Start steps back; privacy radios and checkboxes are 44 px targets; the seven study days never shrink under 44 px. | Plain words a new student understands (8); one main action (7); touch targets (30). | W-070, W-075, W-079 |
| Rival (`/rival`) | Rivals are one list to pick from (radio rows) instead of a grid of icon tiles with pills; the day's benchmark is the first row, so its second Start button folds into the one Start; Night and Day tokens instead of a dark panel in Daylight; the wallet is one plain line. | One main action (7); scan-friendly values with units (9); cards only for meaningful groups (33); distinct art direction over dashboard defaults (26). | W-072, W-075, W-076, W-078 |
| Ask Mobi (`/mentor`) | No console box inside the page and no glowing orb on the page; the time chips mark the choice with the selection ring, not a lime fill, so the plan's button is the only lime. | Cards only for meaningful groups (33); motion and light only with a purpose (31); one main action (7). | W-075, W-076 |
| Help (`/help`) | A search field over the questions, with a live count and a no-match line pointing at the write-to-us row. | Do not hide frequent controls to look minimal (10, S014); clarify what happens next (18). | W-083 |
| Your standing (`/leaderboard`) | The real-marks trend of the student's last papers under the place (draws nothing under three papers). | Rank content by what helps the next decision (8); no invented data (5). | W-083 |
| Features, About | One product picture beside the heading (subject objects; the campus) instead of a text-only page. | Real product or place imagery over unrelated illustration (27). | W-072 |
| Theme switch (all pages) | The thumb carries a plain sun by day and a crescent by night; the cloud bar and the halo are gone, so the Day glyph no longer reads as a sun on a line. | Clear selected state (11). | W-068, W-069 |
| Desktop sidebar | The appearance foot is a compact row at the end of the list, not a sticky panel, so it never covers a row at 1440 x 900. | Navigation consistency (11). | W-069 |
| Page transitions | Colleges joins the place order (Today, Practice, Review, Colleges, Account), so moving to and from it slides toward its side like the other places. | Motion for continuity (31). | W-073 |
| Public nav and landing dock | The nav's "Start free" is the quiet button; the landing's phone bar steps aside while a section's own lime button is on screen and carries no Mobi. | One lime per viewport (7); Mobi once per screen (owner rule). | W-074, W-075 |

## Kept on purpose

- Practice keeps the blur on the subjects that are not picked. The owner asked for it on 17 Oct (F7, "Keep the blur on unselected subjects, and blur them more"). The verifier suggested removing it (W-069, W-082); the owner's words win.
- The phone Start key stays lime on every page (NAV-1017, A1, which the owner chose). On a page with its own lime button the phone shows two lime fills. This is the one open conflict with the one-lime rule (W-075), for the owner to decide.

## Evidence

Captures at 390 x 844 and 1440 x 900, Night and Day, with metrics (lime fills, targets under 44 px, horizontal scroll): `mockmob-next/tmp/resume-1017e/fx-nav/` (`metrics-a.json`, `metrics-b.json`, `metrics-c.json`, `click-*.png`).
