# Round 3, packet R3-brand: the Day palette, the brand back by role, the Accountancy note (5 Nov 2026)

Spec `docs/brain/night-1105/SPEC-R3.md`, decisions R3-D1, R3-D2 and R3-D11 (owner LK101, LK102, LK108, LK114, his ~10 am
look). Research: `tmp-night/r3-research/ALL.md`, daygreen DG1-DG8 and brandloss B1-B10. Branch `web/r3-brand` from main
83925b982. Not pushed, not deployed. Frames are in `tmp/r3/brand/shots/` of the worktree (not committed).

## The user task

A 16- or 17-year-old opens www.mockmob.in, often on a phone and often in Day. The owner saw two things: in Day "the green is
everywhere, extremely light, and a very different colour than how it used to be and than the brand colour is", and in both
themes "in many places branding has been removed and everything has become a lot plainer" (the creator cards named). The
student should see one brand, the same as the app's: the volt key to act, one Day green for the brand's words, and the brand's
own marks where the product speaks.

## R3-D1: the Day palette (LK101; DG1-DG8)

**Cause (daygreen).** The 4 Nov calm-Night pass removed Day's olive layer and made selected states raw `#D2F000` slabs on cream
in both themes (`compass-ladder.css`, `du.css`); then the 5 Nov early-morning brand words went to a greyer `#3F5200`. Day had two
unrelated greens: a near-paper lime (L* 90, 1.13:1 on the cream) and a khaki (L* 32).

**After.** Day only; Night unchanged.

- One Day text green, `#526700`, the app's `accentText`: `--brand-word`, `--accent-text`, `--focus-ring`, the statement accent,
  the hero's "CUET 2027." and the motion-kit fallback. 5.55:1 on the paper, 6.26:1 on raised, 5.12:1 on raised-2.
- The key keeps its volt fill and `#0B1000` ink (14.89:1). Its Day lip is `#8BA000` (2.57:1 to the paper, was 2.04) with an
  inset 1px `rgba(82, 103, 0, .28)` hairline (`--volt-edge`, `--key-hairline`), as the app shell's Day key already does. Night
  keeps `#9DB400` and no hairline; so do the dark surfaces inside a Day page (footer, product stills).
- A selected chip (DU subjects, languages), segment (category), Compass group (programme, category, round) or Lab rail item in Day
  is raised paper `#FFFDF8`, a 1.5px `#526700` rim (1px border plus a 0.5px inset ring, so nothing shifts), ink words, and a small
  volt tick with a 1px `rgba(82, 103, 0, .55)` rim and a dark check: the app's `selection_style.dart`. The chip keeps its own tick
  bubble; segments, groups and the rail tile carry the tick on their corner (absolute, no layout shift; it pops in once, 180 ms
  ease-out from 0.6; reduced motion shows it at rest). Day hover on these controls is the state wash `rgba(210, 240, 0, .22)`.
- Warm ink shadows `rgba(27, 25, 20, x)` replace the green-black ones on the Day nav, the dock, the tour screen and the public
  pack fallbacks.
- Recorded in `DESIGN.md` ("November 5") and `shared/tokens.css`.

Alternatives considered: olive outline plus a pale olive wash for selected states (B9's first option) reads closer to the old
web, but the app is the reference the owner points at, and a wash on every selected chip puts pale lime back on the page, which
is what he called "extremely light". A darker volt fill was rejected: the brand volt is fixed.

## R3-D2: the brand back, by role (LK102, LK108, LK114; B1-B10)

**Cause (brandloss).** On 4 Nov `--accent-text` went to ink in Night, the copy rule "no kickers above an h2" removed the five
product-name kickers, and the creator cards, tour screens and Lab screen lost every volt mark. Only "CUET 2027." and the
statement's three words came back on 5 Nov.

**After.** Volt is a role, never decoration: no glow, no halo, no wash, no glass on content.

- `--brand-word` (volt in Night, `#526700` in Day) colours brand words, product names, hero numbers and progress and selected
  marks on the page: the Compass score, the creator summary numbers, the product names on the Compass Pro and Combo Planner
  cards, the tour's tab underline (a 2px bar that scales in, 200 ms) and story progress, the Lab's story meter, the Recovery
  Lab's active step number and progress. Links and labels stay ink.
- The statement: "MockMob" is a green word too (`*MockMob`), with where, tonight and shortlist. It lights with its clause.
- Brand stamps above the h2s (`BrandStamp.jsx`, `brand-stamp.css`, `homeCopy BRAND_STAMPS`): the section's desk object (28 px,
  from the 96 px file, fixed box) and the product name in the brand-word colour, Hanken 700 15 px, sentence case, no caps, no
  dots, no pill: Mistake Lab (the taped paper), Score Recovery Lab (the banded stack), DU Compass (the compass), MockMob on
  Instagram (the fanned cards), Wall of love (the three pawns). `keycards` is ready for the Key cards section (another packet).
  This replaces the 4 Nov "no kickers above an h2" rule for product names only; a generic kicker or eyebrow is still banned.
- The tour's and the Lab's product screens (dark in both themes) use the app's volt again: the timer, the picked answer (volt
  edge and tint), its tick, the progress, Saved, the check line, the marks, your own Ask Mobi bubble (volt with dark ink), the
  ladder's "you"; the Lab's pace line and label, the clock sweep edge, the rule and opportunity legend dots; the Recovery marks;
  cleared Compass ladder bars.
- "Featured by CUET creators": volt reach numbers (tabular), the monogram in Bricolage 800 with a volt ring and dashed orbit, the
  volt play key with its `#9DB400` lip that presses 2px, the volt heart, the volt "Load preview", the volt hover edge; the summary
  a raised strip (sh-2) with the three numbers in the brand-word colour; the texture is the brand's answer sheet: rows of four OMR
  bubbles, one marked volt per row, faint (rings at 10%, marks at 30%), masked to the top-right corner so it fades out before the
  words. Wall of love avatars are the volt disc with dark ink (with the olive rim in Day); the section is hidden while no consented
  voices exist (`VOICES = []`).
- Voice: "Fix it once. Check it holds." (Recovery h2), "Practise. Replay. Repair. Then one plan ties it together." (tour sub),
  "Fix why you missed it." (the tour slide and the Lab scene).

Trade-off: the owner's UI standards ban kickers above headings; his round 3 words ("everything should be branded properly") and
the spec win for product names only. The standards' "one soft accent" still holds: the green words are the one accent, by role.

## R3-D11: the Accountancy line (content research C8)

`optionChoices.mjs` accountancy gets `note: 'The 2025 CUET paper asked Analysis of Financial Statements only.'`; OptionPicker
prints it under "Pick the one your school teaches." in ink, weight 650 (set apart by weight, not colour). AFS stays the default.
**Open for the owner:** should Computerised Accounting stay a choice at all? A CAS pick drops AFS from practice and mocks, the CAS
pool is mostly one repeated template, and the 2025 paper asked none.

## Tests

- Updated to the owner's new rules (each says so in the test): `night_calm_1104` C1 and C2 (volt text and edges allowed inside the
  dark product screens only), C9 (the app's own marks in those screens; the Day tick), C12 rewritten as "Day never lays a volt slab
  on cream" (a Day-only rule may carry volt only as the tick, with its olive rim); `marketing_theme_tokens_1104` (Day brand word
  `#526700`, focus ring, the new fallback tokens); `statement_accent_1105` ("MockMob" accent, Day `#526700`);
  `landing_checklist_1104` L-017 and `homeHero.test` (hero Day `#526700`); `landingCopy.test` (the voice lines, four accents).
- New: `data/tests/brand_r3_1105.test.mjs` (15 tests) pins the Day tokens and contrast, no `#3F5200`, the key lip and hairline,
  the Day selected-state rule for all four controls, warm shadows, DESIGN.md and tokens, the statement, the stamps, the
  brand-word roles, the screens' volt, the creator cards and their OMR texture, the voice, and the Accountancy note.
- Also fixed: the onboarding radio dot grew from `scale(0)` (failing `motion-pass-1016e`, pre-existing); it now comes in from 0.6.

## Verification (what was actually exercised)

- Dev server (`next dev --webpack`, port 3571, no Supabase env: `/api/stats` answers 503, so live counts were not exercised), real
  Chrome headless under the shared lock. Frames in `tmp/r3/brand/shots/` (v1 before the OMR fix, v2, v3, v3wall, click-*):
  390x844 and 1440x900 Night and Day for the hero, statement, Lab, tour, Recovery, Compass, DU, Instagram and close; 360x640 and
  1024x768 for the stamped heads and controls; `/preview/wall` for the volt avatars (the home section is hidden: no consented voices).
- A real touch tap on a Compass group at 390: Day computes raised `rgb(255, 253, 248)`, rim `rgb(82, 103, 0)`, ink, tick
  `rgb(210, 240, 0)`; Night computes the volt fill with dark ink; `elementFromPoint` returns the button (nothing covers it).
- The phone statement lights "MockMob" with its clause in both themes; Day computes `#526700`.
- The daygreen scan (`tmp-night/r3-research/daygreen/scan-daygreen.cjs` + `analyze.py`, copied to `tmp/r3/brand/daygreen/`, plus
  `summarize.py`) against this dev server, Day forced, before (main 83925b982) and after:

| | 390 before | 390 after | 1440 before | 1440 after |
|---|---|---|---|---|
| --brand-word / --focus-ring | #3f5200 / #4f6400 | #526700 / #526700 | same | same |
| #3F5200 text, px² | 37,707 | 0 | 79,225 | 0 |
| #526700 text and marks, px² | 14,248 | 113,310 | 36,790 | 191,384 |
| green-black shadow area, px² | 448,746 | 0 | 1,043,683 | 0 |
| key lip #9DB400 / #8BA000, px² | 30,599 / 0 | 1,190 / 28,258 | 14,452 / 0 | 3,223 / 12,679 |
| volt slabs on cream (viewports) | 25 (24/41) | 17 (19/41) | 47 (35/35) | 41 (35/35) |
| of which selected states | 8 (rail 4, groups 3, chip 1) | 0 | 8 | 0 |
| green pixels, share of shot | 2.55% | 2.91% | 1.10% | 1.36% |
| olive (mid + deep) share of green | 18% | 27% | 25% | 32% |

  The volt objects left on cream are the action keys (allowed: the fill), the small selection tick, the exam screen's submit
  (`xs-submit`, the exam packet's), the nav's "New" pill (`src/components/new-tag.css`, not this packet's; 33 viewports at 1440)
  and two false positives on dark surfaces (a tour reply chip, the footer's IG mark).
- Tests: the landing suites (296: 274 pass, 10 skipped bench tests that need a running browser bench, 0 fail), the
  brand_r3 suite (15 pass), and the other suites that read the touched files (199 pass). ESLint clean on the changed JS.
- Not verified: a real phone; Lighthouse or performance; the onboarding screen itself in a browser (it needs a signed-in session;
  the note is pinned by test only); the Key cards stamp (that section is another packet's).
