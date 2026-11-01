# Round 4 notes (append only)

Cross-packet requests: write the packet, the file, the change and why. The orchestrator merges them.

## R4-run requests (1 Nov 2026)

1. **R4-server, `src/lib/server/learn.js` runEnd (`chapterProgress`), for first-timer#4.** On Free, add `open` to the end payload's `progress` (the cards Free opens in this chapter, `info.counts.open`): `{ of, seen, before, open }`. Leave it out on Pro. Why: the run and feed ends now label the bar "5 of 45 cards seen · the rest open with Pro" once `seen >= open` and `open < of` (`progressLabel` in `src/components/learn2/stage/endModel.mjs`, pinned in `run/runView.test.mjs`). Without `open` the bar keeps reading "5 of 45 cards seen" (no regression, but the finding stays open).
2. **R4-server, ruling N, the run and feed payloads.** The run's session panel and the feed's desktop panel read `run.chapter.place` (`{ n, of }`) from the start payload and from `GET /api/learn/runs/:id` (`runBody`'s `chapter`). With no `place` they draw no chapter label at all (the old "Part 1, Ch 1" / "Ch 2, Part 1" lines are gone). So `place` is needed on `runBody`'s chapter object, for the start, the resume and the reload.
