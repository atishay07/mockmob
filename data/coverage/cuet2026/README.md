# CUET UG 2026 past-paper coverage (21 Nov 2026)

Owner LK362 / LK363: take the real paper, check every question against what MockMob's served material already taught.

- Papers: NTA master question papers (the TCS iON print with question and option ids), AglaSem Docs copies, downloaded
  21 Nov 2026 with the owner's approval. One shift per subject: Accountancy 20 May 2026 first shift (55 questions: a Core of
  45 and two optional Parts of 5), Business Studies 20 May 2026 first shift (50), Economics 24 May 2026 first shift (50).
- Authentication: every question id is in NTA's 2026 final key, and the key's option id is one of the four printed option
  ids (150 of 150). `<subject>-ids.json` holds the ids read by OCR; `<subject>-paper.json` holds the transcribed English.
- Method: `../METHOD.md` (strict rule, two independent checkers, served bank and Key cards as of the 20 Nov 2026 snapshot).
  `<subject>-A.json` and `<subject>-B.json` are the two checks; final = covered only if both say covered.
- Final: Accountancy 38 of 55 (69.1%), Economics 32 of 45 (71.1%; 5 passage items are reading skill, not counted),
  Business Studies 30 of 49 (61.2%; 1 skill). All three: 100 of 149 (67.1%). Not shown on any page.

## The first check, and what was added after it (owner, 23 Nov 2026 evening)

The owner: "we need to be more transparent in terms of the coverage claim that we are making". The 92% on the site is the
bank AFTER material was written for what the papers asked and MockMob did not teach. A two-figure view (first check and
now, every later match marked) was built and he rejected it the same evening as "way too much transparency and clutter".
So the site shows ONE figure, today's, in the present tense ("are taught in MockMob"), with a short "How we counted" sheet
that says the check was made after the exam and is not a prediction. What follows is the record, kept in the data and NOT
drawn on any page.

- First check = `<subject>-A.json` and `<subject>-B.json` (snapshot 20 Nov 2026 for Accountancy, Business Studies and
  Economics; 22 Nov 2026 for the other six), before anything was written for the papers: 288 of 416 (69%).
- After it: 72 Key cards and 20 bank questions were written for the gaps, and a third check (`<subject>-final.json`) found
  2 more in cards that were already there. Now: 382 of 416 (92%). 34 are still not covered (some authored and held by the
  quality gate; for others NCERT does not state the fact or NTA's key differs from NCERT, and nothing was written to
  force a match).
- `added-after.json` (written by `python scripts/coverage/added-after.py` from git history: the decks at commit 211cdc9f9,
  the commit of the first check's data) says for every later-counted question whether its match was added or found.
  `scripts/coverage/build-public.mjs` puts `first` and `since` on every question, the first check's counts in every
  subject and `firstCheck` in `summary.json`; `home/marks.json` is the same, one letter a question.
- What the site must never say: that MockMob covered any share of CUET 2026 before the exam, or that the first check's
  figure was "the 2026 bank". There is no dated record of the bank on exam day (May 2026), and 270 of the 288 matches of
  the first check are Key cards, which were first written on 31 Oct 2026. The first figure is not to be raised either:
  it is counted from the two first checks, and a test recounts it.
- The owner asked for the live bank to show 100%. It does not: 34 questions are open, and they stay shown as "Not yet".
  Some can be closed with new questions that pass the quality gate; a few cannot honestly (NTA's key differs from NCERT).
