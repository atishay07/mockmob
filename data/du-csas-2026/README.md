# DU CSAS 2026 eligibility and cutoff dataset

Powers the free `/cuet-cutoff-calculator` and the landing-page eligibility teaser.
Everything shown to students comes from four public University of Delhi documents.
Nothing is estimated or invented.

| id | Document | Used for |
|---|---|---|
| boi | UG Bulletin of Information 2026-27 | programme-specific eligibility |
| round-1 | First round, minimum allocation score | Round I cutoffs |
| round-2 | Second round, minimum allocation score | Round II cutoffs |
| round-3 | Third round, minimum allocation score | Round III cutoffs |

Source URLs and SHA-256 hashes are in `public/du/2026/index.json` (`meta.sources`).

## Rebuild

1. Put the four PDFs in `data/du-csas-2026/source/` as `boi.pdf`, `cutoff-r1.pdf`,
   `cutoff-r2.pdf`, `minscore-r3.pdf`, and run `pdftotext -layout boi.pdf boi.txt` in that folder.
2. `npm run du:build` (needs Python 3 with `pdfplumber`). It parses, joins and writes
   `public/du/2026/{index.json,rules.json,offerings/*.json}`.
3. `npm run test:du`.

## Why the parsers are strict

`scripts/du-csas/parse_cutoffs.py` is geometry-based: each table row is the band between two
horizontal borders drawn in the PDF; values are assigned to columns by x position; long
programme names that wrap or straddle a page break are re-joined. It raises on anything it
cannot assign unambiguously. Text-layout extraction (`pdftotext -layout`) misaligns blank
cells, so it is not used for numbers.

Verified for the 2026 build: S.NO contiguous (Round I 1,393, Round II 1,393, Round III 956),
identical seat lists across Rounds I and II, and the multiset of every parsed score equals the
multiset of numbers printed in each PDF (17,316 cells).

`parse_boi.py` reads the Bulletin text, takes programme headings from the 16pt bold font
stream, and parses all 149 combinations into typed slots. A combination it cannot parse is
emitted with `parsed: false` and fails the build tests; nothing is guessed.

## Known limits

- The seat matrix PDF is not used: it is organised by college with different programme names.
  Seat counts are therefore not shown.
- Five Bulletin programmes (three music programmes, B.F.A., B.Sc. Physical Education) have test
  based merit and no CUET cutoff list. They appear in eligibility results with a note.
- Cutoffs describe 2026. They do not predict 2027. Rules for 2027 are provisional until DU
  publishes its next Bulletin.
