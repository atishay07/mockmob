# The home hero, round 3: calmer, and the second beat shown properly (5 Nov 2026)

Round 3 packet R3-hero, branch `web/r3-hero` (from main 83925b982). Owner items LK99 ("the hero section needs a bit more
refinement ... Preparoo ... is a bit cleaner") and LK100 ("'5 versions free' and '73 TV programs' ... should be shown
properly, removed, or utilized better"), decision R3-D3 of `docs/brain/night-1105/SPEC-R3.md`. Research: preparoo B9-B11,
brandloss B4, B5, B7 (`tmp-night/r3-research/ALL.md`). Stage 1 of 2: both variants of the second beat are built behind one
constant, `HERO_BEAT_VARIANT` in `src/components/landing/homeCopy.mjs`, committed as `'A'`, for the judges to pick.

## User task

A 16-17-year-old, often new to CBT, lands on mockmob.in on a phone. In one glance: what MockMob is, that it is free to start
and what Pro costs, one obvious way in, and the few facts that make it worth a try (five free questions right here, the 73
DU programmes, the two exam screens, the full 60-minute clock). Success test: the first screen reads in fewer, calmer
pieces than before (preparoo B11 counted 11 pieces against Preparoo's ~5-7); the lead is two lines; the facts are one line;
the second beat is seen (variant A: in the first screen at 390x844) and every fact still links to where it lives.

Real data only: the bank count is /api/stats `bankSize` (never typed; without it the count is simply absent), the DU
programme count is `duIndexFacts().programmes` (the beat drops that fact without it), the price is `priceLine(OFFER)`.
States: no JS (variant A shows the first fact, links work), no count (money words alone), no DU index (three facts),
reduce motion (A stacked), one-time offer (the money clause reads "Pro ₹99 once, through 31 July 2027" and may wrap).

## What changed for both variants

| Piece | Before (live 88ff026cc) | Now | Why |
|---|---|---|---|
| Lead | 94 characters, 3 lines at 17 px ("... with a review that finds the chapter behind every mark you lose.") | 72 characters, **2 lines** at 17 px (360-1440): "MockMob is CUET UG mock tests that trace every lost mark to its chapter." | LK99 / spec: 2 lines at 16-17 px; LK70 kept (it says what MockMob is; the claim is the radar slide's "traces every miss to its chapter") |
| Fact lines | Two: "Free to start. Pro ₹99 a month, cancel anytime." and "One bank of 5,765 questions. No cap on Pro." | **One**: "**5,765 questions.** Free to start, Pro ₹99 a month." (the count in ink 650, the money from `priceLine(OFFER)`) | Spec: "the two fact lines become one line"; preparoo B11. One line at 360 (measured 297 px). Without a count the same money words show alone, so nothing read changes when it arrives |
| Rhythm | 16 / 22 / 8 / 14 / 20 px | 16 (h1 to lead) / 24 (lead to keys) / 8 (keys to login) / 16 (to the fact) / 24 (to the desk); desktop 24 / 28 / 12 / 24 | Spec: a 16-24 px rhythm (S010 whitespace separates concepts) |
| Mobi's first bubble | "Your first question. Go." | "Hi, I'm Mobi. Your first question. Go." (two lines, same bubble box) | Spec / brandloss B5: his name back. Decision 13 holds: lines change with the sample's state, never a tap |
| CTAs | Sign up free / Try 5 questions first / Have an account? Log in | unchanged | approved (LK83/LK88) |

Kept: the h1 and its typed line, "CUET 2027." (its Day colour belongs to R3-D1), the desk (room, rigged Mobi, sample card),
the two hero links, no ambient pattern, no glass, no loops.

## The second beat: two variants

The same four facts in both (`heroBeat`, heroTaps.mjs): Five questions free (#try-practice), 73 DU programmes
(#du-eligibility), Two exam screens (#exam-experience), 60 minutes, 50 questions (#your-prep). Each fact now carries a
`mark` (the words set in the brand word colour), a `figure` and `unit` (B's number) and a desk object `icon`
(questions, compass, papers, today). Both read `--brand-word` (volt in Night, the Day green in Day), so R3-D1's Day colour
change flows through without touching this packet's CSS.

### A: one rotating line inside the Mobi hero card (preparoo B9) — `HeroBeatLine.jsx`

- Where: the top of the desk card, so the card reads paper (the beat), painting (Mobi in his room), paper (the sample).
  Not between the room and the sample: Mobi's "Your first question. Go." hands you the question directly below him.
- A quiet label "Why MockMob" (14 px, sentence case, no caps, no mono) and four segment keys (44 x 44 targets, a 3 px bar).
- One fact at a time: Bricolage 700, 22 px phone / 28 px desktop, its mark in the brand word colour, a 14-15 px line under.
- Clock: the segment fills over the 3 s dwell; the fact slides up and out in 600 ms `cubic-bezier(.25,.1,.25,1)` as the next
  rises in. One pass, then it slides back to the first fact and rests with every segment full.
- WCAG 2.2.2: it pauses while a fine pointer is over it, while anything in it has focus, while a finger is on it, while it is
  off screen and while the tab is hidden; it stops by itself after one pass (about 14.4 s); any segment shows its fact and
  stops the clock for good; tabbing reaches each fact's link in order and shows it.
- Screen readers get the four links as a list in order; nothing is announced as it turns (no live region).
- Nothing below moves: all four facts share one grid cell, so the window is the tallest fact's height (measured: the room
  did not move by a pixel through the whole pass).
- Reduce motion (device or the student's own switch): no clock, no slide, the four facts stacked two by two.

### B: a branded number strip under the hero (brandloss B4) — `HeroBeatStrip.jsx`

- Where: under the hero, where decision 14's hairline row was.
- Raised paper, hairline cells: 2 x 2 on phones, 4 across from 960 px. Each cell is one link: its desk object (BrandIcon,
  36 px), its figure in Bricolage 700 tabular in the brand word colour (34 px phone, 44 px desktop), what it counts (5
  questions free, 73 DU programmes, 2 exam screens, 60 minutes, 50 questions), one quiet line.
- No glass, no glow (the owner asked for glass on the pricing and Key cards; brandloss B4 allows glass only where something
  sits under it). Warm shadow in Day, dark in Night. Hover: a faint tint and an underline; focus: the 2 px focus ring.
- Server-drawn; nothing moves.

### Trade-offs for the judges

| | A rotating line | B number strip |
|---|---|---|
| Seen in the first screen (390x844) | Yes, at the top of the desk card | No, under the sample card (as the old row was) |
| First-screen calm (preparoo B11) | One more block in the first screen, but it replaces the separate beat section | Adds nothing to the first screen |
| Number weight | One fact at a time, 22-28 px | All four at once, 34-44 px figures and desk objects |
| Desktop | The desk card grows by its band (126 px), so the sample card ends below 900 px | The hero keeps its height; the strip sits below the fold |
| Motion | One 14 s pass, then rests (pausable) | None |

## Evidence IDs

- S010 / rule 28: whitespace separates concepts (the 16/24 rhythm, one fact line instead of two).
- Rule 7: one main action (Sign up free) kept; the beat's links are secondary text links, not keys.
- Rule 9 / 29: value before label with units ("73 DU programmes", "5,765 questions").
- Rule 31: motion only to show state (which fact, how long it stays), with reduced-motion behaviour; no essential
  information only in motion (all four facts are links in the DOM).
- S016 / rule 36: WCAG 2.2 (2.2.2 pause/stop, 2.4.7 visible focus, 44 px targets), keyboard order, screen-reader list.
- T006 / T009 / rule 19, 21: the money is the live offer, never compared, no struck price or urgency.
- T003 / rule 15: the five free questions stay in the hero, before any account wall.

## Captures

Variant A: `tmp/r3/hero/variant-A/` (git-ignored). Variant B: `tmp/r3/hero/variant-B/`. Each holds
`{390,1440,360,1024}-{night,day}-first.png` (the first screen) and `-beat.png` (the beat centred); A also has
`-beat-2.png` and `-beat-3.png` (later facts), `390-night-reduced.png` (stacked), `1440-night-focus.png` (keyboard focus)
and `interact.json` (the clock, pause, focus, segment and reduced-motion checks). `report.json` in each folder has the
measured boxes (lead lines, fact lines, positions).

## Verified

- Real Chrome 151 headless, shared lock, dev server (`next dev --webpack`), /api/stats answered locally with the live
  count 5,765 (the dev server has no database), the monthly offer env set for display only.
- Lead 2 lines and fact line 1 line at 360x640, 390x844, 1024x768 and 1440x900, Night and Day; no sideways scroll; no page
  errors.
- Variant A clock: start at 1.28 s after load (on screen), ticks at +3.01 s, +3.61 s, +3.61 s, +3.61 s, then rests on fact 1
  (`done`); the room below did not move. Hover pauses it (after a fix: the pause now outranks the animation shorthand);
  focus shows the focused fact inside the window; a segment click shows its fact and stops; reduced motion never starts
  and stacks all four.

## Not done here

- Stage 2 (the judges' pick, removing the losing variant).
- "CUET 2027." in Day (#3F5200 to #526700) is R3-D1's; untouched.
- The tap lines and the squash-in on return visits from brandloss B5 were not part of R3-D3.
