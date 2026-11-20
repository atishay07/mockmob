# Past-paper coverage: the method (20 Nov 2026, owner LK362)

Goal: for each real CUET question, say truthfully whether MockMob's served material already taught what is needed to
answer it, with ids a sceptical student can check. A doubtful match counts as NOT covered.

Decided by the orchestrator: the STRICT rule; Key cards count as teaching material and are labelled as such; the first
figure is CUET 2024 (four whole papers are in hand, authenticated); 2026 follows when its question text has a source.

## Inputs
- Real papers: `data/source_registry.json`, `sources["cuet2024-<subject>-bookA-paper"].authentication.questions[]`
  (English 101, Economics 309, Accountancy 301, Business Studies 305; 50 questions each; NTA final key included).
- The served bank: `public.questions` read-only (SELECT only; `.env.local` is PRODUCTION). Served = not deleted, live or
  verified-and-active, and passing the repo's `readablePracticeQuestions`. Check every cited id is served: rows whose id
  has no dashes (factory rows) are NOT served. The pilot's read scripts show how: scratchpad `read_bank.mjs`,
  `check_eligible.mjs`, `search.mjs`, `kc.mjs`, `check_cards.mjs` under
  `C:\Users\atish\AppData\Local\Temp\claude\dc2af5953cc5fcb1\777be139-a000-4c98-9286-70590b597225\scratchpad\`.
- Key cards: `data/keycards/decks/` (published, not suspended).
- The pilot (20 Accountancy questions, worked examples of every verdict): `tmp/1120-speed/coverage/pilot.md`.

## Per question
1. Record provenance: year, subject code, date, booklet, question number, the NTA key.
2. Map to the 2026 syllabus chapter (`data/canonical_syllabus.js`), or mark OFF SYLLABUS (shown, not counted).
   NTA-dropped questions are excluded.
3. Classify: theory or numerical. Write the facts or steps needed to reach the key BEFORE searching.
4. Candidates: served bank rows and Key cards of that chapter and unit, by keyword on a local copy, then read stem,
   options, key and explanation in full.
5. Theory = covered only if EVERY Class 12 syllabus fact the item tests is stated by served material (a bank question's key
   or explanation, or a Key card's answer side). Match and multi-statement items need every part.
6. Numerical = covered only if a served BANK question uses the same formula and the same steps (same unknown, same direction
   of adjustment). A Key card formula alone does not cover a numerical. A bank item with a wrong key or working never counts.
7. Store: provenance, chapter, type, the fact list, verdict, for each fact the ids that teach it (bank id or card id),
   the one best match id, a one-line reason in plain words.

## Two checks
- Checker A does steps 1 to 7 for every question of a paper.
- Checker B, a different agent with fresh context, writes its own fact list, verifies every id A cited (is it served, does
  it really state the fact), and for every A "not covered" searches on its own. Final = covered only if both say covered.

## Output (one JSON file per paper and checker): `tmp/1120-speed/coverage/cuet2024-<subject>-<A|B>.json`
`{ paper, subject, snapshotDate, checker, questions: [{ n, chapter, offSyllabus, type, facts: [..], verdict:
"covered"|"not_covered"|"off_syllabus"|"dropped", matches: [{ kind: "bank"|"card", id, teaches }], best, reason }] }`
No question text is copied into this file (the registry holds it); ids and numbers only.

## Decision, 20 Nov late: English gets NO published figure
Checker A, English 2024: 8 covered of 28 countable items (21 are passage skill, 1 dropped). 28 items is too few and the
word-level items only show whether a given word happens to be in an open-ended deck. Preparoo leaves English and GAT out
of its figure for the same reason. The English result is kept as a list of missing words, idioms and rules to author
(`cuet2024-english-A.json`); no Checker B run for it. The published figure covers Accountancy, Economics and Business
Studies only, and says so.

## Decisions after Checker A, Economics (31 covered, 18 not, 1 off syllabus)
- A question whose answer can be read off a passage printed in the paper tests reading, not stored material: verdict
  "skill", shown and not counted (the same rule as English comprehension). Checker B applies this to every paper and
  re-labels A's verdicts on such items.
- A doubtful syllabus call stays ON the syllabus (the stricter reading), as A did for Q9, Q11, Q24, Q49.
- The chapter is where NCERT teaches the fact, even where the registry's tag differs.
