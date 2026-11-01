# Round 4 notes (append only)

Cross-packet requests: write the packet, the file, the change and why. The orchestrator merges them.

## R4-home (1 Nov 2026)
- To R4-server: `data/learn/roadmap.js` `coverageLine(row, { isPro })` still says "free card" when `isPro` is false. The home page no longer passes `isPro` (rows read the chapter's real `row.cards`, see `roadmapRow` in homeModel.mjs), so nothing on Learn home draws it now; if no other page uses that branch, it can go. Not blocking.
- To R4-server (confirming the contract R4-home renders): a roadmap row sends `needsWorkFrom: 'papers' | 'learn'` next to `verdict`; the row reads "Needs work · from your papers" only for `'papers'`. A missing field reads plainly "Needs work".
- To R4-server: the roadmap row must keep `cards` (the chapter's real card total) and `progress.of` (the open count; 5 on Free). The header's "5 Key cards free in each chapter" reads the largest `progress.of`; each row's total reads `cards`.
