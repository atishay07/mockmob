# Round 4 notes (append only)

Cross-packet requests: write the packet, the file, the change and why. The orchestrator merges them.

## R4-today (web/1101-r4-today), 1 Nov 2026
- **Test outside my files, edited minimally (merge note):** `data/tests/practice_parity_1020.test.mjs` line 57 pinned `<TodayCollegesStrip ... />` inside Today's `<header>`. With one strip built once (`const strip`, client-code#2) the header now holds `{strip}`; the test checks the one element in the page and `{strip}` in the header. Today owns `src/app/(app)/today/page.jsx`, so no other packet is affected.
- **For R4-home / the shell (not blocking):** on a brand-new student's 390x844 first screen the start card's swap row ("Or start with one of these", "A full mock", "Start with...") peeks half under the floating dock. TodayCue now stays away from it (it is in KEEP_CLEAR), so nothing is drawn over it, but first-timer#3's second half ("keep the alternatives row clear of the dock") is a clip by the dock, not by Today. If the shell's bottom padding or the dock height is touched in R4-home, check that row at 390x844. Today did not change its card height for it (refine, not rebuild).
