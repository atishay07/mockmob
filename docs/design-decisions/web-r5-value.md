# The value plan beside the Pro card, and Pro first on /pricing (round 5, second take, 6 Nov 2026)

Branch `web/r5-feedback`. Owner's words (6 Nov, dictated): the slider receipt was "a good direction, but it's a bit weird ... Full
marks, 190, mistake lab 190, all but key cards ... How many key cards will you practice? ... think of something and improvise this
also"; on desktop "both should be equally visible ... Maybe you bring it up"; on /pricing "on the phone, Pro is below Free. That
should not be the case ... Pro should be the first option. People can slide up to Free and do the create account thing."
Not committed, not deployed.

## Research: what works (sources)

1. Ask in the buyer's own unit and answer in it. Mailchimp's pricing takes one input, contacts, as preset tiers, and states what each
   plan sends as a multiple of contacts ([mailchimp.com/pricing/marketing](https://mailchimp.com/pricing/marketing/)).
2. Sliders suit approximate amounts; keep the current value beside or above the thumb, avoid fine steps, and give a tap or key path
   when the exact value matters (NN/g, Aurora Harley, "Slider Design: Rules of Thumb", 2015,
   [nngroup.com](https://www.nngroup.com/articles/gui-slider-controls/)).
3. State one unit price plainly and list extras as "plus", not priced: Intercom shows "$0.99 per outcome" and "Every Essential
   feature, plus ..." ([intercom.com/pricing](https://www.intercom.com/pricing)).
4. Estimate from the buyer's own volume, not a claimed average: Intercom links a cost estimator and an ROI calculator fed by the
   buyer's team size and support volume (same page).
5. Memberships sell value in the member's own repeated action: Swiggy One Lite at Rs 99 for three months, "6x return", break-even
   after a few orders ([Business Today, 9 Oct 2023](https://www.businesstoday.in/technology/story/swiggy-launches-cheaper-membership-plan-one-lite-with-free-delivery-extra-benefits-price-set-under-rs-100-401212-2023-10-09)).
   Their rupee "savings" are claims we cannot make truthfully (no feature has a true rupee value), so we count actions instead.
6. Indian test-prep passes are bought as a period plus what it holds: Testbook's Pass Pro Max lists 150,000+ mock tests with
   unlimited re-attempts, valid for the plan's period ([testbook.com](https://testbook.com/blog/testbook-pass-pro-max)). Students
   already think "a pass for a period"; we show the period and what the student will do in it, never inventory.
7. A price restated per day is compared with small daily spends; it works at small amounts and reverses at large ones (Gourville,
   "Pennies-a-Day", Journal of Consumer Research 24(4), 1998, [EconPapers](https://econpapers.repec.org/RePEc:oup:jconrs:v:24:y:1998:i:4:p:395-408);
   follow-up in [Marketing Letters](https://link.springer.com/article/10.1023/A:1025467002310)). ₹99 over 267 days is a true, small
   daily figure, so it leads.
8. Put the sum beside the result, as transfer pricing does when it itemises the fee next to what arrives (Wise, as described in
   [third-party guides](https://exiap.ca/guides/wise-fees)): every figure on the card carries its division.

## What changed

**Home #pricing, the value card** (`PlanValue.jsx`, `receipt.mjs planValue`, `homeCopy.mjs VALUE_COPY`, `home-pricing.css`):

- One leading figure, the same at every pace and true for every visitor: "About ₹0.40 a day", under it "₹99 ÷ 267 days, to 31 July
  2027" (monthly: "₹3.30 a day", "₹99 ÷ 30 days, one month of Pro").
- Two questions in the student's own units, each a native range answered in words beside it: "How many full mocks will you sit?"
  (5 a week to 3 a day, ticks at 1 and 2 a day; starts at 5 a week) and, while Key cards are live, "How many Key cards will you
  turn?" (10 to 60 a day in fives, ticks every ten; starts at 20).
- "If you keep that pace", then one line per question, so no two lines can share a number (mocks are at most 3 a day, Key cards at
  least 10): "Full mocks 190 / About ₹0.60 a mock, under 2 paise a question / 9,500 questions, with a Mistake Lab read and chapter
  review after every mock" and "Key cards turned 5,340 / About 5 minutes a day / From all 16,458 cards in 14 subjects".
- "Also in Pro: Unlimited Quick practice, Smart practice, NTA mode, Compass Pro and unlimited saved questions. Mistake Repair and Ask
  Mobi run on your monthly credits."
- Desktop: two equal columns; the value card is a solid card with the plan card's 28 px corners, its top level with the plan card's
  top, and (with both questions) stretched to its foot, the room spread evenly between its four parts. With one question (Key cards
  off, dev and preview) it keeps its own height instead of opening empty bands. Phones: the plan card, then the value card.
- The removed receipt: the three equal counts (mocks, Lab reads, chapter reviews), the fixed Key cards bank as a count, the
  "Included" column, the tear line and the long close.

**Truth fixes found on the way.** The home page is prerendered once per release, so a day count taken at build goes stale; the
card now counts the days from the reader's own day once it is on screen (same pure module), so it never overstates the mocks left
or understates a day. "About" is now the true division rounded up everywhere (`value.mjs aboutTenPaise`): perMock had rounded to the
paisa first, which at 247 days left would have printed a day at ₹0.50 and a mock at one a day at ₹0.40.

**Why 5 a week first.** At one a day a mock costs what a day does and the mocks equal the days (₹0.40 and ₹0.40, 267 and 267): the
repetition the owner called out. At 5 a week every figure on the card is different, the slider starts at the owner's own floor
(LK131) and moves up from there; the hero's "as low as ₹0.20 a mock at 3 full mocks a day" is the card's top end (tested).

**/pricing on phones** (`PlanChoice.jsx`, `page.js`, `pro-page.css`): Pro now comes first in the page. Below 760 px the two plans
are one horizontal scroll-snap rail, card edge to the gutter, the next card peeking about 50 px, under a Pro | Free switch: Pro on
arrival, the switch follows the swipe and brings either card in, the arrow keys move between them, 44 px keys, the page's focus
ring; Night selects with the volt fill and dark ink, Day with raised paper, the ink rim and the small volt tick; 220 ms ease-out,
none under reduced motion. Free's card keeps "Create a free account". From 760 px nothing changes: Free above Pro on tablets, Free
beside Pro (left) from 960 px.

## How each figure is computed (all in `src/lib/payments/receipt.mjs` and `value.mjs`, pinned by `pricing_value_1105.test.mjs`)

- days: calendar days from the reader's day to the one-time expiry (or a 30-day month); per day = aboutTenPaise(price, days).
- full mocks = floor(pace × days / 7); questions = mocks × 50 (`TEST_MODES.full.fixedCount`); per mock = aboutTenPaise(price,
  mocks); per question = "under N paise", N the next whole paisa above price / questions.
- Key cards turned = cards a day × days (Pro has no daily Key cards cap: reviews uncapped, new cards only counted,
  `src/lib/server/keycards.js`); minutes a day = ceil(cards × 0.25), the app's own 15 s a card (`KEYCARD_RULES.minutesPerCard`,
  passed in by the server); the bank is `keyCardsDemo().bank`, only while `KEY_CARDS_ENABLED`.

## Verification

Shots in `tmp/r5-feedback/pricing2/`: `final/` (home section, the reader's view, value card default, low and high at 390, 1440 and
1366, Night and Day, Key cards on through a temporary local fallback since removed), `final2/` (equal heights rechecked with the
final CSS), `final-nokc2/` and `final-nokc/` (Key cards off), `pricing-v2/` (/pricing at 1440, both themes, whole page), `pricing-v3/`
(/pricing at 390, both themes: whole page in parts, switch, swipe, taps, arrow keys, Free's create-account key hit test). Geometry
logs show the plan card and the value card with the same top and foot at 1440 and 1366; every slider hit-tests as itself.

## Open points

- The hero's own hook still counts its one-time days from the build day (hero markup is another packet's); it reads ₹0.20 until
  about 165 days are left (mid-February 2027), so a release before then keeps it true.
- On the monthly branch (not live) the section sub and the card would both say ₹3.30 a day.
- On desktop /pricing the reading and focus order is now Pro, then Free, while Free still sits on the left.

## Third take (6 Nov 2026, after the owner's preview review)

The owner saw the preview's one-time fallback ("about ₹0.40 a day ... 99/267 days") and a card that "just counts mocks and all, and
it doesn't add all the other features". Production sells monthly; the card is now built and checked on the monthly offer (dev server
run with `RAZORPAY_PLAN_ID_PRO_MONTHLY_99` set; one-time still works). One card: the two sliders (full mocks a week; Key cards a day,
now 12 to 60 in sixes so the Key cards turned can never equal the questions), then every Pro feature as its own line with its own
brand object and its own measure, never the same number twice: Full mocks (21 this month, about ₹4.80 a mock), Mistake Lab (1,050
answers traced), Chapter review (after every mock), Mistake Repair and Ask Mobi (50 credits a month, Pro's real grant,
`AI_PRO_INCLUDED_MONTHLY_CREDITS`; one credit = one Mobi job), Key cards (720 cards turned, about 6 minutes a day); then NTA exam mode,
Quick and Smart practice, Compass Pro and saved questions as included tiles; then the payoff "All of it for ₹99 a month / ₹3.30 a day,
under 10 paise a question." Shots: `tmp/r5-feedback/pricing2/monthly-final/`.
