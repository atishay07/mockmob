# Fresh judge pass, 24 Nov 2026: four rows, three batches

This file changes only WHERE you read and write, and (for fit judges h1, h2, h3) adds one input. Everything else follows your
instruction file exactly.

FRESH = `C:\Users\atish\Desktop\mockmob copy\wt-1110-convert\tmp\1123-close\integrate\fresh-fit`

| BATCH | rows | instruction file for this subject (rubric, subject profile, syllabus) | pack files | your result file |
|---|---|---|---|---|
| `accountancy__w6f` | 1 | `...\integrate\scoring\QUALITY.md` (j1, j2) or `...\integrate\scoring\FIT.md` (h1-h3) | `FRESH\accountancy\accountancy__w6f.json`, `FRESH\accountancy\accountancy__w6f-fitaids.json` | `FRESH\accountancy\verify\accountancy__w6f__<ROLE>.json` |
| `computer_science__w6f` | 2 | `...\integrate\scoring3\QUALITY.md` or `...\integrate\scoring3\FIT.md` | `FRESH\computer_science\computer_science__w6f.json`, `-fitaids.json` | `FRESH\computer_science\verify\computer_science__w6f__<ROLE>.json` |
| `mathematics__w6f` | 1 | `...\integrate\scoring3\QUALITY.md` or `...\integrate\scoring3\FIT.md` | `FRESH\mathematics\mathematics__w6f.json`, `-fitaids.json` | `FRESH\mathematics\verify\mathematics__w6f__<ROLE>.json` |

(`...` = `C:\Users\atish\Desktop\mockmob copy\wt-1110-convert\tmp\1123-close`.) Use the instruction file's rubric, procedure, stance
for your ROLE, subject profile and result-file format; ignore its own batch table and folder (those are the old batches). The
"what you may read" rule applies with FRESH in place of its FOLDER: read only your instruction files, this file and the pack files
named here. Never open another judge's file or anything in a `verify` folder.

## Fit judges only (h1, h2, h3): the CUET 2026 anchor

Each fit batch also has `FRESH\<subject>\<BATCH>-anchors.json`: for every row, the real CUET 2026 question (stem, options, NTA's
answer position) that the row was written to teach. It is an authenticated item from the real CUET UG 2026 paper of this subject.
Quality judges (j1, j2) do not read it.

With the anchor, step 4 of FIT.md changes:
- `pyq_anchor` = the anchor string (for example "CUET 2026 accountancy paper, question 23"); `pyq_closeness` 0 to 3: 3 = same idea,
  same item type and the same steps with different values or wording; 2 = same idea and steps, different type or framing; 1 = same
  chapter idea only; 0 = unrelated.
- `ten_route` may be `"pyq"` when `pyq_closeness` is 3, the row raises no flag and every other condition for a 10 holds.
- Level and time are calibrated to real CUET items, and the anchor is one. Compute the row's `reasoning_steps` and `est_seconds` as
  usual, and the anchor's the same way (read_seconds for the anchor = 8 + its words / 3.3). If the row needs no more steps than the
  anchor and its est_seconds is at most 15% above the anchor's, then `level_calibration` is 3 and `time_suitability` is 3 unless the
  row's est_seconds is over 240, and do not raise `too_slow` or `level_above_cbt` for demand the real paper itself sets. Otherwise
  score level and time with the usual bands. Say in `note` how the row compares with the anchor.
- Everything else (syllabus, format, discrimination, the other flags, the ladder) is judged exactly as FIT.md says, on the row as
  written. The anchor does not excuse a row that is wordier, harder, off-format or weaker in its options than the real item.

The anchor shows what CUET asked. It is not a reason to be generous: score the row, not the anchor.
