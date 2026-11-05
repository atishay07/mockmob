# Pricing, value, comparison and the final card on the home page (round 3, 5 Nov 2026)

Round 3 packet R3-pricing, branch `web/r3-pricing` (from main `83925b982`). Owner items LK107 (the numbers band "relevance is
less"), LK109 (the pricing section "a bit cleaner ... the separate pricing page that you have made is really good ... just the
one plan, everything in it"), LK110 (the final card; "a toggle ... how many mocks you will do ... ₹1 per mock, ₹2 per mock"),
LK111 ("on platform X you pay 5,500 for this, meanwhile on our platform you pay this much") and LK112 (glass on the pricing
card). Decisions R3-D7, R3-D8 and R3-D9 of `docs/brain/night-1105/SPEC-R3.md`. Research: `tmp-night/r3-research/ALL.md`
(pricingmap P1-P8, prices P1-P10, preparoo B4-B6 and B13, brandloss B6).

## User task

A 16-17-year-old who has scrolled the whole page, often new to paid apps, reaches pricing and wants three answers fast: what
Pro costs, whether it is worth it for how much they will practise, and how it compares with what their friends are buying.
Then one obvious way in (Get Pro, or start free). Success test: the price, the per-day figure and the per-mock figure at their
own pace are each one glance; every figure can be checked on a calculator; every rival price shows its date and source; no
figure flatters; Free is still plainly there.

States: the bank count loading (a still placeholder in the number's place), loaded (counts up once at 40% in view), failed
(the line without a number); monthly or one-time offer (separate sentences); new offer released (no per-mock maths or
comparison, because "unlimited Full mocks" is not that offer's promise); guest or signed in (Start free and the invite line
for guests only); invites on or off; Night or Day; reduced motion; reduced transparency.

## What changed

1. **The numbers band is gone (R3-D7).** `LiveStatsBand` and its `lp-sec--tight` section left the page. Its two true counts
   (the public bank size and the public subjects with questions, from `/api/stats`) are now lines of the plan card
   (`PlanCounts.jsx`) in the brand word colour, counting up once at 40% in view (`useCountUp.js`). The ₹99 it showed is the
   plan's own price. The fetch is the hero's (`bankStats.js loadPublicStats`), so the page asks `/api/stats` once.
2. **#pricing is the /pricing page's one plan (R3-D8).** Extracted into shared pieces and used by both pages:
   `src/components/pricing/planOffer.mjs` (`PLAN_COPY`, `planTerms`, `compareRows`, `priceTag`) and
   `src/components/pricing/PlanCard.jsx` (title, price, terms, a head slot and a body slot). `/pricing` renders the same
   markup as before (checked: the `#plans` card's HTML on this branch against the live page, below). On the home page the card
   is glass over a big "Pro", carries the /pricing art as a strip (`ProSealStrip`: the answer sheet with its volt rule and
   marked answers, the foil seal, the "MockMob Pro" label), its lines in three sentence-case groups (Practise, Review, Plan),
   Get Pro (to the one checkout on /pricing), "See everything in Pro", and Free as one quiet line with Start free.
3. **Value at your own pace (R3-D8, LK110).** The section's sub is "₹99 a month is about ₹3.30 a day." Beside the card (under
   it on phones) a segmented control, "Full mocks a week: 2 / 4 / 7 / 14", prints "about ₹X a mock" with the maths under it
   ("4 a week is 17.1 Full mocks in a 30-day month. ₹99 ÷ 17.1 = ₹5.79, rounded up to ₹5.80."). All figures come from
   `src/lib/payments/value.mjs` on the server; the control is native radios in a fieldset (arrow keys, Tab, screen readers),
   and the figure moves in 300 ms (instantly under reduced motion) while a polite live region says the final value once.
4. **The dated comparison (R3-D8, LK111).** "What each costs to May 2027": MockMob Pro ₹693 (7 months × ₹99, from November;
   computed from the offer and the build month), an all-access CUET course ₹5,499 once (notes, flashcards and 100+ full mocks,
   access until May 2027), a science mock series ₹1,168 once (23 full mocks among 298 tests, valid 9 months), per-subject mock
   packs ₹99 a subject (3 full mocks each, validity not stated). Under it: "Prices as listed on each platform’s page, 5 Nov
   2026." and a Sources disclosure naming each platform, product, price, page and read date
   (`data/price_comparison_1105.mjs`). Never "cheapest", no MRP, no struck price.
5. **The final card (R3-D9).** Sign up free / Log in unchanged; Mobi stays; the generic hairline grid and dot matrix became the
   brand's own answer sheet (`CloseSheet`: rings, four options a question, one pencil mark a row, neutral; it lives in
   the side columns, rising from the bottom, and in a strip inside the band's bottom padding, so no ring sits under a letter of
   the heading, the keys, the free line or the invite line; on phones only the strip shows). While invites are on (`referralsLive()`, the switch /signup reads) a guest also gets one line: "Have a friend’s invite
   code? Add it when you sign up. You both get 100 credits once you finish one practice." The link goes to
   `/signup#invite-code`, which now opens the invite field. Never a code on the page.

## Decisions, with evidence

- **One glass surface, by owner request.** Glass is slop by default (UI standards digest 5 and 12); LK112 asks for it on the
  pricing card, so it is on that card only: an 8 px blur on phones and 15 px from 960 px, a warm 0.8-alpha fill in Day and a
  0.075 cream fill in Night, radius 28, a soft warm shadow with an inset highlight, solid paper under
  `prefers-reduced-transparency` (preparoo B4, measured on Preparoo's own cards). The night-calm test now names this one
  exception (`GLASS_OK`). The word behind it is ink at 50% (Night) / 55% (Day), never volt, so the blur reads as glass and
  never as a volt glow (L-019).
- **Money is honest (UI standards 11, S-series money rules).** Every "about" figure is the division to the paisa rounded up
  to 10 paise; a monthly price and a one-time price never share a sentence (tested sentence by sentence); totals are compared
  over one period (to May 2027); the one-time branch counts days to its own expiry and says so. The owner's "₹1 / ₹2 a mock"
  holds only for the one-time ₹99 (prices P8); on the live monthly ₹99 the honest range is ₹1.70 to ₹11.60 across 14 to 2
  mocks a week, and that is what prints.
- **Rival rows are the spec's three.** Testbook's yearly pass (₹749 for 365 days, 142 full tests on its CUET page, prices P1)
  is cheaper per full mock than Pro at 1-2 mocks a week; it is not in the spec's rows. No line claims cheapest, and every row
  says what it includes, so the table compares totals, not a per-mock superiority. Flagged for the owner below.
- **Brand by role (R3-D2).** Volt appears as the Get Pro key, the selected pace (Night: a volt fill carrying dark ink; Day,
  R3-D1: paper `#FFFDF8` with a 1.5 px `#526700` rim, ink text and a small volt tick) and the seal strip's own art. Numbers
  that matter (the counts, the per-mock figure, MockMob's row) read `--brand-word`, which the Day palette packet sets.
- **Reuse over rebuild.** /pricing's look is unchanged: its CSS (`pro-page.css`) is untouched; the home card is styled by its
  own sheet (`src/app/home-pricing.css`), so a home change can never move the checkout page.

Contrast (WCAG 2.2 AA), computed: volt `#D2F000` on Night paper 14.6:1 and on the Night card 13.2:1; `#526700` on the Day card
6.2:1 (`#3F5200`, today's token, 8.4:1); ink-3 labels 5.7:1 (Day card) and 6.2:1 (Night card); `#0B1000` on volt 14.9:1.
Targets: every segment, Start free, See everything in Pro, Sources and the invite link are at least 44 px tall (measured).

## Tests changed by these owner decisions (rule updated, never deleted)

- `landing_checklist_1104` L-004 and L-005: the numbers band is no longer required; the plan (`HomePricing`) with its counts
  (`PlanCounts`, `useCountUp`) is (R3-D7). L-013: the close band may take props.
- `night_calm_1104`: `home-pricing.css` joins the checked sheets; two named exceptions, the plan card's glass (R3-D8, LK112)
  and the seal strip's volt art (R3-D8, LK109). The Day tick is drawn on shared tokens, so C12 holds unchanged.
- `release9_public_1018`: the home close band draws the answer sheet instead of the grid and dots (R3-D9, R3-D2); the grid
  rules stay for the tool pages.
- Pins that followed the extraction to its new files, same assertions: `pricing_copy_1017` W-097, `money_v13_1020`,
  `web_landing_health_1020`, `billing_pay_gate_copy`, `copy_pass_1019`, `practice_credit_per_question`, `first_full_mock_1019`
  (the free-first-mock sentence now reaches Free's line from `FIRST_FULL_MOCK_COPY.plan`, only while the switch is on),
  `app_view_1020`, `landingCopy.test`.
- New: `data/tests/pricing_value_1105.test.mjs` (14 tests): per-mock figures computed from the offer and moving with it; no
  typed rupee amount or rival price in any pricing source; the maths checks out; monthly and one-time never share a
  sentence; same-period totals; every rival row dated and sourced and printed with its date and sources; no "cheapest";
  the band gone and the counts in the card; the glass only on the card with its fallback; the control's a11y; the close
  band's invite line gated and code-free.

## Verification

Screens (git-ignored, `tmp/r3/pricing/`): v1-v3 Night and Day at 390x844 and 1440x900 while building; v4 the pace control
tapped (14) and driven by the keyboard (ArrowLeft to 7), and the Sources disclosure opened (390, Night); v5 Night and Day at
360x640, 390x844 and 1440x900 with no horizontal overflow and no console errors; v6 after the two fixes below, 360x640 and
1440x900, Night and Day.

Fixes from the v5 look: (1) at 1440 the close band's rings ran under the invite line, and on phones under its last line, so
the sheet's mask became side columns plus a bottom-padding strip (above); (2) at 360 the maths broke after "₹99", so the sum
("₹99 ÷ 17.1 = ₹5.79") keeps together with no-break spaces.

/pricing unchanged: the server-rendered body of `/pricing` on this branch was diffed against www.mockmob.in/pricing (5 Nov
2026). The `#plans` card is identical line for line; the only other differences are the two env switches that are off on the
local dev server and on in production (the free first Full mock wording, and the Mob's tile and rows), driven by the same code
as main `83925b982`.

Tests: `node --test src/components/landing/*.test.mjs` with the landing, health, night-calm, theme-token, pricing-value,
release9, css-split and the billing/copy suites listed above: 392 + 122 tests, 0 failing. `npx eslint` on every changed file:
clean.

## Open for the owner

- Whether to add Testbook's yearly pass to the comparison (more complete, and it is cheaper per mock at low use).
- Prices change: re-read the three pages before the next price review and bump `readOn` with them.
- Day brand word: this packet reads `--brand-word`; the Day palette packet (R3-D1) moves it from `#3F5200` to `#526700`.
