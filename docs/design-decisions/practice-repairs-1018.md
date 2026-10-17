# Practice: Repairs and Ask Mobi on the page (owner D5, 18 Oct 2026)

**His words (D5):** "Repo S [Repairs] or Mobi, everything is missing from the Practice section. The way you have placed it, no one will be able to see it ever. The placement is really bad." The CTO took "Repo S" to mean Repairs, the saved-repair queue.
**Kept as it was (D4, D14):** the subject shelf and its loop, the four mode tiles, Questions, Fine-tune, the session card and the phone bar. None of them changed.

## What changed
- There is one ruled line under the subject shelf, between the shelf and Mode (`PracticeRepairs.jsx`, with its counting logic in `repairsLine.mjs`). It is about the subject the shelf has chosen and changes when the shelf does. On a 390 px phone it sits on the first screen, above the dock.
- **Repairs:** "N questions to repair in {subject}", meaning how many from that subject's sessions still wait. The line adds how many more wait in other subjects, so the two numbers add up to Review's total. **Review and repair** opens Review, where the repairs happen. "N saved repairs to revisit" links to the newest saved repair, which reopens free on its result (F17).
- **Ask Mobi:** opens the Ask Mobi panel in place (N9, `openAskMobi`). If this subject has a saved repair, the button reads "Ask Mobi about Q5" and opens on that repair. Otherwise it opens on the student's record. The cost is stated before anything is sent: opening is free, and a written reply costs 1 AI credit.
- The Recent sessions link changed from "Review mistakes" to "Review and repair", so both ways into Review carry one label (D15: one label, counts that agree).

## Decisions
- **Placement.** The line sits under the shelf, not in the lower panels. A frequent, important action must stay visible and not be folded away (S014). Tying the line to the chosen subject gives it a reason to be there on every visit.
- **No new card.** The line is ruled with whitespace, so the mode tiles stay the page's only cards. Its keys match the tiles' action keys: 44 px, outlined, with the same press sink.
- **Counts agree with Review.** A question counts if it was missed or left blank, minus the misses that already hold a saved repair (the `openOf` and `repairedCounts` rules). While repairs are loading, the line says "Checking" rather than showing a number that would then change. If the read fails, the line says some of the questions may already be repaired and offers Check again (T002, S015: progress must be truthful).
- **Ask Mobi only names a repaired question.** The panel's question header reads "About the mistake you repaired". A miss that still waits goes to Repair through Review, never to a reply.
- **Every state is designed:** loading, no sessions, waiting, all repaired, other subjects still waiting, and failed read. With reduced motion the line only fades (120 ms). Focus is visible on every key (S016).

## Evidence
Captures (preview fixture, headless Chrome) are in `docs/design-decisions/captures-practice-repairs-1018/`: 390x844 and 1440x900 in Night and Day, first-screen views without the preview banner, the clear, empty and error states, and the Ask Mobi panel open from the real pointer. The test is `data/tests/practice_repairs.test.mjs`.

## Open for the Ask Mobi owner (D6)
`MockMobAIHub.jsx` QuestionContext always says "About the mistake you repaired". That is why Practice only passes a saved repair to the panel. If D6 rewords that header for misses that are not yet repaired, Practice could also ask about the newest miss still waiting.
