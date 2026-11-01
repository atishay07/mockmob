# Round 3 notes (append only)

Cross-packet requests: write the packet, the file, the change and why. The orchestrator merges them.

## R3-today (1 Nov 2026, evening)
- To R3-explore (preview arena fixtures, `src/app/preview/arena/previewFirstWeek.js` line 28): the insight chapters use names that are not stored syllabus names ('Goodwill', 'Ratios'). Real data stores 'Goodwill Valuation'. Today now names a chapter by `chapterTitle(subject, name)` (`src/lib/today/chapterTitle.mjs`, canonical title from `data/cuet_syllabus.js`, plus a unique first-words fallback so 'Goodwill' reads "Goodwill: Nature and Valuation" in the fixture). Please switch the fixture to stored names so the preview shows what production shows.
- To R3-home (shell, ruling Z and S2): Today shows no due number and no dot of its own. The sidebar "Learn 27 due" and "Your papers 8 due" badges and the dock "8 due" are yours, as are the aria-labels on every dot including the Papers tab dot.
- To the orchestrator: `data/learn/words.js` was read-only for me. Today now imports `WORDS.continue` and `reviseQuestions` from it. No change needed.
