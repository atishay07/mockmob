# DU and CSAS data check (M-007), 18 Oct 2026

What the Compass in the app (and the website's cutoff calculator) shows comes from `public/du/2026/*.json`, served at `https://www.mockmob.in/du/2026/*` and read by `flutter_app/lib/features/tools/data/du_source.dart`. Those files are built by `scripts/du-csas/build_dataset.py` from four University of Delhi PDFs.

## Sources (recorded in `public/du/2026/index.json`, `meta.sources`, with SHA-256)
| id | Document |
|---|---|
| boi | UG Bulletin of Information 2026-27, https://www.du.ac.in/uploads/2026/06012026_BOI_UG_2026_27_compressed.pdf |
| round-1 | First round, minimum allocation score, https://admission.uod.ac.in/userfiles/17072026-CutOff_UG_Round_One_compressed.pdf |
| round-2 | Second round, https://admission.uod.ac.in/userfiles/downloads/2026/25072026_CutOff_UG_Round_Two_compressed.pdf |
| round-3 | Third round, https://admission.uod.ac.in/userfiles/downloads/2026/09082026_Minimum_Allocation_Score_RoundThree.pdf |

## What was checked on 18 Oct 2026
Command: `python scripts/du-csas/verify_published.py` (new; needs no network and no PDF).

- All 17,316 parsed cutoff cells appear exactly once in the published offering files, and nothing extra is published.
- 1,393 offerings, 67 colleges, 73 programme groups; 73 Bulletin blocks, one group each; no unparsed Bulletin combination; every group with cutoffs has its file and no file is orphaned.

## Already on record (from the 12 Oct build, `data/du-csas-2026/README.md`)
- S.NO is contiguous in each PDF (Round I 1,393, Round II 1,393, Round III 956).
- The multiset of parsed scores equals the multiset of numbers printed in each PDF (17,316 cells).

## Not done in this pass, and why
- The four PDFs are not on this machine and downloading them needs the owner's yes, so the script's `--pdfs DIR` hash check (each PDF against the recorded SHA-256) has not been run. To run it: put the PDFs in `data/du-csas-2026/source/` as `boi.pdf`, `cutoff-r1.pdf`, `cutoff-r2.pdf`, `minscore-r3.pdf` and run `python scripts/du-csas/verify_published.py --pdfs data/du-csas-2026/source`.
- The app's own parsing of the files (counts and cutoffs shown in the Compass) was not compared by running it. The app takes the website's JSON unchanged.
- DU may have re-issued a PDF since 12 Oct; only a fresh download and the hash check can say.
