# Web round 3, packet R3-cards: Key cards on the home page, and the loading kit (5 Nov 2026)

Owner: LK112, his words on 5 Nov at about 10 am: add something for the flashcard section "in the same way the pricing card and
other things have a glassmorphism effect", and "the loading animation everywhere". Spec: docs/brain/night-1105/SPEC-R3.md R3-D10
(and R3-D2 for the stamp). Research: tmp-night/r3-research/ALL.md, preparoo B7 (the flip) and B8 (the loading kit).

## What shipped

- A Key cards section right after the Score Recovery Lab (`#key-cards`, page.js), shown only while `KEY_CARDS_ENABLED` is
  `true` (the switch every Key cards route reads). Head: the stamp (the Key cards desk object at 28 px and "Key cards" in
  `--brand-word`), h2 "Turn the card. Keep the line.", one sub of 19 words.
- Five real cards, read at build from the decks the app serves (`loadDecks`: sha256-checked, tiers applied):
  Accountancy debenture (Part 2, Ch 2, p. 75), English "concise" (WordNet), Accountancy "Cash" as per AS-3 (Part 2, Ch 6,
  p. 243, Analysis of Financial Statements, so Part B safe), English principal / principle (a ruled blank, as the app draws
  it), Accountancy the sacrifice by a partner (Part 1, Ch 2, p. 52). Every one is a Free taste card, so "Sign up free to keep
  going" is literal. No card text is typed in any source file (tested).
- The card turns in 3D: 600 ms on cubic-bezier(.4,0,.2,1), perspective 1000 px, both faces backface-hidden, no tap flash.
  Front: glass (blur 14 px, saturate 1.4, hairline, inset highlight; Day uses the cream glass from the pricing research) over
  the card's own subject object (the lamp-lit calculator and ledger, the newspaper and pen) in its subject light field. Back:
  plain paper, the question small, the answer in Literata, the app's "In short" line and book line, Must-know.
- "1 / 5" with a 4 px bar (brand word) above, dots below (current dot in the brand word), the app's rating keys after the
  turn (Missed it / Got it / Easy, fading in 200 ms after 300 ms), each with when the card comes back, worked out at build by
  the scheduler the app rates with (FSRS): back tomorrow, back in 3 days, back in 8 days. Got it is the app's volt key.
- After the fifth: an end card that sorts the ratings into rows ("3 cards back in 3 days", staggered in), "Go through the five
  again", and the one key under the demo turns from secondary to volt. Guest: "Sign up free to keep going" plus "Free gives you
  5 Must-know cards in every chapter, Pro every card." Signed in: "Open Key cards" (/cards), no Free/Pro line.
- The bank line: "16,020 Key cards across 14 subjects." counted from the served decks, counting up once.
- The loading kit (src/components/landing/LoadingKit.jsx, loadingRules.mjs, loading-kit.css): `CountUp` (a true number
  climbs from 0 once, when 40% of it is in view, 1,900 ms ease-out quart; the server and first paint print the real value;
  one already in view at load stays; reduced motion prints it), `Shimmer` (a neutral skeleton, one band sweeping by transform
  4 times at 1.2 s, then still), and `.lk-stagger` + `staggerStyle(i)` (rows rise 6 px and fade over 160 ms, 70 ms apart).
  The section uses CountUp and the stagger; Shimmer is ready for the async blocks other packets own (pricing's bank counts,
  Ask Mobi's "Reading your record" line); this packet has no async block of its own to put it on.

## Decisions and why

- Glass on content is allowed here only because the owner asked for it (LK112). night_calm C7 now names `.kc-demo__glass` in
  key-cards.css as the one exception; the glass sits over the card's own brand object, so the blur has something to show.
- The object sits in the card's top area and its lower third goes under the glass (measured at 390: about 50 px of overlap), so
  the frosted ledger reads as glass, not a grey box.
- The end card is plain paper, not glass: its words are read, so nothing sits behind them (the first capture put the Key cards
  object behind the text and it was unreadable).
- The stamp draws the desk object at 28 px through BrandIcon's style override (`size={32}` keeps the object file; the 32 px
  floor exists for photo objects, and the spec asks for 24-28 px).
- The section's words live in keyCardsCopy.mjs, not homeCopy.mjs, so this packet does not collide with the hero, brand and
  pricing packets editing homeCopy tonight; the sub is held to the same 20-word budget by keyCards.test.mjs.
- Case-blind names: `KeyCardsDemo.jsx` beside a `keyCardsDemo.mjs` resolved to the wrong file on Windows (and would differ on
  Vercel's Linux). The server reader is keyCardsPicks.mjs and the kit's rules loadingRules.mjs; a test now fails on any two
  landing modules whose names differ only by case.
- Nothing is saved: the demo never says a card was scheduled; the end card says "With an account, each card you rate goes into
  Revise".

## Tests changed by an owner decision (said so, not deleted)

- data/tests/landing_checklist_1104.test.mjs L-019: `lk-shimmer` joins `du-shimmer` as an allowed loading skeleton (R3-D10).
- data/tests/night_calm_1104.test.mjs: key-cards.css and loading-kit.css join the default file set; C7 names the Key cards
  front glass as the owner's exception.

New: src/components/landing/keyCards.test.mjs (17 tests), src/components/landing/loadingKit.test.mjs (7 tests).

## Verified (real Chrome 151 headless, dev server with KEY_CARDS_ENABLED=true)

- 360x640, 390x844, 1024x768, 1440x900, Night and Day; front, mid-turn, turned, card 4 turned, end; reduced motion at 390.
  Captures and report.json in tmp/r3/cards/v2 (not committed). Real pointer presses (touch taps on phones, mouse clicks on
  desktop) on Turn over and each rating key; the Turn over key is the element at its own centre (hit test true); no
  horizontal overflow; the glass has `blur(14px) saturate(1.4)` computed; the art decodes; the count rolls (caught mid-roll
  at 16,009) and lands on 16,020.
- Reserved height: the section is 942 px at 390x844 and 704 px at 1440x900 both before it is drawn and after (830 + 112 px
  padding, 480 + 224 px).
- Landing suites + Key cards suites: 464 tests, 442 pass, 0 fail, 10 opt-in skipped, 12 todo; NIGHT_CALM_ALL=1 passes; eslint
  clean on every changed file.

## Not verified

- Not on a real phone, not on the live site, not signed in (no auth on the local dev server: the signed-in branch is source-
  checked only). Two 503s in the console come from the local server's API routes without env (the page's own fetches), not
  from this section.
- The oneGesture opt-in bench (MM_ONE_GESTURE=1) was not re-run; the page height match above is the part this packet changes.

## Rubric notes (0/1/2, the owner signs off)

Product fit 2 (the app's own cards, keys and words); action clarity 2 (one volt key at a time in the demo); data truth 2 (real
cards, scheduler words, served counts); feedback 2 (progress, keys say when cards return); accessibility 2 (44 px+ keys, "Card 1
of 5" for screen readers, focus follows the card for keyboard users, reduced motion fades); visual craft 1-2 (owner to judge the
glass); performance 2 (no scroll listener, one observer per number, reserved height exact).
