# DU CSAS 2026 cutoffs: check against DU's own PDFs, 15 November 2026

**Verdict: round 1 PASS, round 2 PASS, round 3 PASS.** Every row and every printed score in DU's three
minimum allocation score lists equals what MockMob serves in `public/du/2026/`. Nothing in the served data was
changed by this check.

| Round | Rows (S.NO) | Printed scores | Two PDF engines agree | Same reading order | PDF vs parsed | PDF vs served | Result |
|---|---|---|---|---|---|---|---|
| 1 | 1,393 (1 to 1,393) | 8,209 | yes (after the two cells below were settled) | 1,393 of 1,393 rows | 0 mismatches | 0 mismatches | PASS |
| 2 | 1,393 (1 to 1,393) | 6,953 | yes | 1,393 of 1,393 rows | 0 mismatches | 0 mismatches | PASS |
| 3 | 956 (1 to 956) | 2,154 | yes | 956 of 956 rows | 0 mismatches | 0 mismatches | PASS |

All three rounds: 17,316 printed scores, 41,162 cells compared (rows x 11 categories, blanks included), 0 mismatches
(`mismatches.csv` holds the header only). Raw figures: `results.json`.

## The documents

The four files read are byte-identical to the ones the data was built from: each SHA-256 equals
`public/du/2026/index.json` `meta.sources` (the script stops if one differs).

| Document | Pages | Released (date in DU's file name; the PDF creation date agrees) | SHA-256 (first 12) |
|---|---|---|---|
| UG Bulletin of Information 2026-27 | 71 | 6 Jan 2026 | 75cf271b3fbc |
| First round of allocation, minimum allocation score | 58 | 17 Jul 2026 | 72cda4997ed6 |
| Second round of allocation, minimum allocation score | 48 | 25 Jul 2026 | d92443d8d1a1 |
| Third round of allocation, minimum allocation score | 38 | 9 Aug 2026 | 7e8b9964b62e |

The URLs are in `src/lib/du/sources.js` (`DU_SOURCES`). No page of any of the four prints a date.

## Method

`verify.py` does not use the build's parser (`scripts/du-csas/parse_cutoffs.py`). It reads each cutoff PDF twice,
with two different PDF engines, and needs them to agree before comparing anything with our data.

- **Method A, pdfplumber table finder.** The grid comes from the ruled lines DU drew. Each cell's text is whatever
  falls inside that cell; column labels are the header words inside each column's x-range, so a blank cell stays
  blank and a score cannot slide into the next category. Names that wrap over a page break are re-joined.
- **Method B, pypdf (a separate engine).** Every printed number with its own position on the page, placed into a
  row and column by that position on Method A's grid. Then, row by row, pypdf's reading order must give the same
  numbers in the same order as the grid.
- **Against our data.** Method A's reading is compared with `data/du-csas-2026/parsed/round-*.json` by S.NO, and
  with the served `public/du/2026/offerings/*.json` by college and programme name, cell by cell: every row, every
  category, every round, blanks included. Served rows that a round does not print are reported too.

- **Printed form.** Every one of the 17,316 printed scores is the shortest decimal for its number (570, not
  570.0; 426.45, not 426.4500), so a page that prints the served value as JavaScript's `String(n)` shows DU's
  exact text. `results.json` `pdf_cells_not_in_shortest_form` is empty in all three rounds.

Three further checks sit on top of the full comparison:

1. **Five named colleges** (`five-colleges.csv`): Shri Ram College of Commerce, Hindu, Miranda House, Hansraj and
   Lady Shri Ram, each with B.Com. (Hons.), Economics, English, Political Science and Mathematics. 20 of the 25 pairs
   are offered; 539 cells, 327 with a score, 0 mismatches. Not offered (and not served): SRCC English, Political
   Science and Mathematics; Miranda House B.Com. (Hons.); Hansraj Political Science.
2. **Seeded random sample** (`sample-cells.csv`, seed 20261115): per round 100 filled and 20 blank served cells
   outside the five colleges, 360 cells, PDF value beside served value, 0 mismatches. A re-run draws the same cells.
3. **Plausibility flags** (`flags.csv`): no served score is zero, and none is above the most a course's papers can
   add up to (250 a CUET paper, times the course's paper count from the Bulletin; the highest score served is
   958.7147, Hindu College, B.A. (Hons.) Political Science, round 1, UR). 1,288 cells rise from one round to the
   next: 272 round 2 above round 1, 920 round 3 above round 2, 96 round 3 above round 1 with no round 2 score. Each is
   exactly as DU printed it (the full comparison covers them). DU's round 3 list says why its numbers can be higher:
   "The minimum allocation scores for Round III are independent of the minimum allocation scores of earlier rounds",
   and round 3 allocated candidates who became eligible after the mid-entry. The pages show these rises as printed.

## Every mismatch, and how it was settled

Only one kind of disagreement appeared, in the first run (before this report): Method A read a score in two round 1
cells where Method B had none.

| Round | Page | S.NO | College, programme | Category | Method A | Method B (first run) |
|---|---|---|---|---|---|---|
| 1 | 46 | 1120 | Shyama Prasad Mukherji College For Women (W), B.A. Program (Computer Applications + Economics) | UR | 570 | blank |
| 1 | 49 | 1191 | Sri Aurobindo College (Evening), B.Com. | OBC-NCL | 448 | blank |

**Settled from the page.** These are the only two scores in all three lists that DU printed as whole numbers, without
decimals (the lists drop trailing zeros, as in 426.45). The first run's Method B kept only numbers with a decimal
point, so it skipped them; pypdf itself reads both. On the pages:

- Page 46, S.NO 1120: pypdf places `570` at x = 333.1, inside the UR column (318 to 361), and its reading order for
  the row is `570 338.9697 87.8977 393.3227 543.3441`, the grid's own order. The rendered row
  (`evidence/round-1-p46-sno-1120.png`, column header in `...-header.png`) shows 570 under UR.
- Page 49, S.NO 1191: pypdf places `448` at x = 375.8, inside the OBC-NCL column, reading order
  `616.0655 448 342.3809 266.9668 514.3405 615.8551`. The rendered row (`evidence/round-1-p49-sno-1191.png`) shows
  448 under OBC-NCL.

Method B now accepts whole numbers in a category column. On the re-run both engines agree on all 17,316 scores, and
the served data already held 570 and 448 in those cells (locked in `data/tests/du_verified_cutoffs.test.mjs`).
No correction was needed anywhere.

## What this check does not cover

- **Eligibility rules.** The Bulletin's file was matched by its hash and every programme in the three lists maps to a
  Bulletin programme, but the eligibility text and combinations were not re-read here (`du_eligibility.test.mjs`
  covers the parse).
- **Seats.** DU's seat matrix is not used, so no seat counts are served.
- **2027.** These are 2026 admission numbers. They do not predict 2027.

## Re-run

```
python data/du-csas-2026/verification/verify.py
node --test data/tests/du_verified_cutoffs.test.mjs
```

Needs Python 3 with pdfplumber (0.11.9 used) and pypdf (6.20.1 used), and the four PDFs in
`data/du-csas-2026/source/` (not in Git). Exit code 0 only when there are no mismatches. If DU publishes a corrected
list: replace the PDF, rebuild (`npm run du:build`), re-run the script, and update this report, the test and
`DU_CHECKED_ON` in `src/lib/du/sources.js` together.
