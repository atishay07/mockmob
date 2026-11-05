# Round 4, packet A1 + A2: Learn search, Show answers, de-clutter, the Accountancy cross-check, swipe to rate (6 Nov 2026)

Spec `docs/brain/night-1105/SPEC-R4.md`, items A1 and A2 (owner LK136, LK137, LK139, LK140; his ~11:40 pm look on 5 Nov).
Branch `web/r4-learn` from main ce24dc682 + the spec commit. Not pushed, not deployed. Frames are in `tmp/r4/` of the worktree
(not committed). Evidence IDs are the research brain's (`docs/research/premium-ux-ui-2026-10/`).

## The user task

A 16- or 17-year-old in Learn wants three things fast: find a chapter (or a term) and go there; read a list of Key cards with or
without the answers; and rate the card in front of them. The owner's words: "the search functionality is cluttered", "Show
Answer: this toggle is broken. It is very weird", "It is showing chapters and cards instead of what it should show if someone
wants to search a chapter", "the Learn section ... is a bit clunky", and "Maybe some swipe functionality, like Got It to the
right, Easy down, and Missed left".

## A1.1 Accountancy Part 1 / Part 2: the cross-check (report)

Sources: `data/CUET 2026/accountancy.pdf` (CUET UG 2026, subject 301), `data/cuet_syllabus.js`, `src/lib/server/learn.js`
(`subjectBody`, `PART_TITLES`), the Learn roadmap as drawn.

| CUET 2026 | NCERT book | MockMob chapters (stored name) | Option |
|---|---|---|---|
| Unit I Accounting for Partnership | Accountancy Part 1, ch 1 | Partnership Fundamentals; Profit and Loss Appropriation Account | common |
| Unit II Reconstitution | Part 1, ch 2 and 3 | Change in Profit Sharing Ratio; Goodwill Valuation; Admission of Partner; Retirement and Death of Partner | common |
| Unit III Dissolution | Part 1, ch 4 | Dissolution of Partnership Firm | common |
| Unit IV Company Accounts | Part 2, ch 1 and 2 | Share Capital; Debentures | common |
| Unit V Analysis of Financial Statements | Part 2, ch 3 to 6 | Financial Statements of Company; Analysis of FS; Comparative and Common Size; Accounting Ratios; Cash Flow Statement | AFS |
| "Optional to Unit V": Computerised Accounting System | the separate CAS book | Computerised Accounting System | CAS |

Verdict: **the approach is right.** The choice (AFS default, CAS kept, owner LK115) filters only Unit V; Units I to IV are every
student's; the data names three books (`Accountancy Part 1`, `Accountancy Part 2`, `Computerised Accounting System`). The owner
is right that it "mainly affects the last" chapters: it swaps Part 2's chapters 3 to 6 (our five rows) for the one CAS chapter.
The test `learn_r4_1105.test.mjs` pins all of this against `unitsFor`.

What was not quite right, and what changed:
- The roadmap put the choice under Part 2's heading ("Part 2 has two options. Pick the one your school teaches."), above Share
  Capital and Debentures, which read as if the whole of Part 2 depended on it. **Fixed:** when a part opens with common chapters
  and ends with its options, the choice sits right above the units it changes and says "The rest of Part 2 has two options."
  (`optionAtTail`, `optionLine`; ChapterMap). Maths and Computer Science keep the old placement unless their parts have the same
  shape. The two option chips are now 44 px tall (they were 36).
- Not changed (outside this packet, for the owner or the server owner): Part 2's title is the NCERT book's, "Part 2, Company
  Accounts and Analysis of Financial Statements", and it also holds the CAS unit, whose chapter comes from the third book. A
  student who picked CAS still reads "...and Analysis of Financial Statements" in the heading. A server-side title such as "Part 2,
  Company Accounts and your Unit V" or showing the CAS book's name on its unit would be cleaner (`PART_TITLES` in
  `src/lib/server/learn.js`). The CAS chapter's NCERT file code is still `null` in the syllabus (known, commented there).

## A1.2 Search answers what was asked (FindView, findModel.mjs)

**Cause.** The results drew the "Show answers" switch, Pick and a volt "Study these 10" first, then chapter rows, then the cards;
and a chapter whose cards also matched was *removed* from the chapter rows (`inGroups`). So "goodwill" never showed the chapter
"Goodwill: Nature and Valuation" as a chapter, only its cards. Free also saw two lines for the same locked matches ("40 more
matching cards are part of Pro" and "31 more cards match").

**After.**
- Order: **Chapters**, **Lessons**, then **Key cards**, each under one small sentence-case heading with its count (the question
  asked is answered first; hierarchy by order, not boxes; S017). Every chapter whose name matches is listed, best match first,
  its name with the searched words underlined as the cards are, and its size ("48 cards").
- While a chapter or lesson matched, the cards are the second answer (progressive disclosure, S014): a preview of three, then
  "Show all 10 cards"; the chapter
  rail and the volt Study key stay away until the whole list is open. When only cards matched, the cards are the answer: the full
  list, the rail on desktop, and "Study these N" as the page's one volt key.
- The cards' tools (Show answers, Chapters jump on a phone, Pick) sit on the cards' own head, not above the chapters.
- Free's locked matches are one line with one number (the search sorts open cards first, so every match past the limit is locked
  when any is); Pro sees "12 more cards match. Type another word to narrow it." only when the limit really cut open cards.
- A search whose every match is a Pro card now shows the locked line (before, it drew nothing under the head).
- The head line counts what was found: "1 chapter, 10 cards".
- A chapter row says its size ("48 cards"), not how many of its cards match: on Free that number counts Pro cards the list below
  does not show.

## A1.3 Show answers (AnswersKey.jsx)

**Cause.** In Learn's card lists the shared switch was restyled ink-on-ink: on, it was a white pill with a dark knob and a dark
tick drawn at its left; off, a dark knob in a dark track (Day: a grey blob). It worked, but read as broken and never said which
state meant what.

**After.** A plain key that says what it will do: an eye and "Show answers", then the eye shut and "Hide answers", filled with
the ink while answers are shown (the same fill as a chosen filter chip), 44 px, focus ring, `aria-controls` the list. The same
key in Find, the sets and the Cards view (consistent identification, S016). No
`aria-pressed` (the label already says the action). Used in Find, the sets and the chapter's Cards view. A row's own "Show" still
opens one line.

## A1.4 De-clutter Learn home

- Find's sets (Due today, Missed lately, In Revise, Must-know) were four boxed keys, two rows on a phone, under the field. Now one
  quiet row of chips, the Cards view's own chip: the name, then the count in the quieter ink ("Due today 8"); on a phone the row
  scrolls sideways with an edge fade, from 560 px it wraps. The minutes and chapters stay in each chip's spoken name. Nothing cut.
- The part choice moved next to what it changes (A1.1).
- The roadmap ("the chapter lists ... are all right") is otherwise unchanged.

## A2 Swipe to rate (rateSwipe.mjs, useRateSwipe.js, SwipeLabels.jsx)

Where: the Learn run (RunPlayer: a turned card, not a recap card, not a look past Free's ratings) and Key cards Study
(ChapterDeck's KeyCardPlayer). Not the feed: the Explore/Learn feed has no Got it / Missed / Easy (its cards are turned and kept
with "Revise later"), and its vertical drag already pages, so a down-for-Easy there would fight the feed; nothing was invented for
it. Not Revise (another packet's file); the player takes `swipe` as an opt-in prop, so Revise is unchanged.

- Right = Got it, left = Missed it, down = Easy, as he asked. The first 8 px (6 with a mouse) lock the axis; up is the page's.
- The card follows the pointer 1:1 on its axis (a quarter on the other), leans up to 10 degrees sideways; a pill at the card's
  head says what letting go does ("Got it" volt with a check, "Missed it" ink with the turn-back arrow, "Easy" volt with the
  double check), fading in with the distance; it pops once and the phone ticks (haptics) when a release there would rate. The
  matching rating key lights at the same time, so the gesture and the keys read as one control.
- Commit: past 30% of the card's width (72 to 120 px) or 96 px down, or a fling of 650 px/s after 32 px. Short of it the card
  springs home in 300 ms. Past it the card holds where it was let go until the server has the rating ("the card leaves only after
  the server has the rating" stays true), then leaves the way it was going; a failed save springs it home with the error line.
- Touch and scrolling: a touch keeps the page's vertical scroll (`touch-action: pan-y`) and rates left and right; down for Easy
  is offered to a touch only while the whole card is in view (then the card owns the touch, `touch-action: none`). A mouse or pen
  always has all three. The hint says only the ways that work there.
- The hint before a first drag: the run's one-time coach line ("Drag the card: right for Got it, left for Missed it, down for
  Easy."), on the next rateable card after the ratings' own line, so a first run teaches both; in Study a quiet line under the keys on the first three turned cards on the device, gone
  once a swipe has rated.
- Kept: the three keys, 1 / 2 / 3, Space, the existing Study badge and leave motion for key presses, the run's flight into the
  Revise pile for key presses.
- Reduced motion (the OS setting or MockMob's own switch): no gesture, no hint, keys only.
- The card moves through the `translate` and `rotate` properties, never `transform`: Study's card enters with an animation that
  fills `transform`, which would have pinned an inline transform in place.
- Found and fixed in real Chrome with CDP touch at 390 px (a mouse drag worked from the start): the run's card face is its own
  scroll box, so the browser read `touch-action` only up to the face and panned (the drag was cancelled); every element inside a
  swipe card now takes the card's value. And taking the touch's capture from the word it landed on to the card fired a
  `lostpointercapture` on that word, which bubbled to the card and sprang it home; only the card's own loss ends a drag now.
- From 768 px the run's stage column is a scroll box; a swiped card is no longer cut at its edge, and the status line under the
  keys steps aside while a card is dragged (on a laptop a card dragged down passes over it).

## Checks (6 Nov 2026)

- Tests: `data/tests/learn_r4_1105.test.mjs` (15, new: the Find order and preview, the counts, the Answers key, the chip row, the
  Accountancy cross-check against `unitsFor`, the part line, the swipe arithmetic, the wiring and the two touch fixes);
  `npm run test:learn` 434, `test:keycards-ui` 40, `test:keycards` 125, `test:dock` 63; the landing gate (landing, *_1104,
  *_1105, web_landing_health) 386 pass, 11 opt-in browser tests skipped. No pinned test needed changing: the old option-line
  tests use parts without units, which keep the old line.
- Pre-existing and not this packet's: `inventory_fingerprint.test.mjs` "the pin" fails on the base too (no `data/` file changed
  here); `test:app` showed 8 file-level failures under load that all pass when run again on their own.
- Real Chrome (headless, the shared lock), `decks=real`: Find for "goodwill", "revaluation" and "share capital" at 390, 768, 1280
  and 1920, Night and Day, Show answers on and off; Learn home at 360, 390 and 1440; the chapter's Cards view at 390 Night; the
  run at 390 Night (CDP touch: right half-way springs home, right and left past the line rate, down rates Easy) and 1280 Day and
  Night (mouse: right, left, down); Key cards Study at 390 Day (touch left and down); reduced motion at 390 (no gesture: the
  card is not swipeable and does not move). Frames in `tmp/r4/` (not committed).
- Rubric notes: one volt key per view kept (Find's volt key only when cards are the answer); no new colour (the pills reuse the
  volt and ink of the keys); motion is translate, rotate and opacity, answering the hand, 300 ms home; 44 px targets; Night and
  Day both looked at.
