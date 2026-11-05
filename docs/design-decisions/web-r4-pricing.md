# Pricing on the home page and /pricing (round 4, 5-6 Nov 2026)

Round 4 packet H7 + /pricing, branch `web/r4-pricing` (from `400d647a8`, the R4 spec on main `ce24dc682`). Owner items LK130
(the plan card covers too much of the big "Pro"; in Day the word is hard to see), LK131 (the pace control: 2 a week is too low;
start at 5-7 so even the lowest makes students feel they practise too little, under ₹10 a mock, and a cool catch at the top
end), LK132 (remove "What each costs to May 2027" completely: bad copy, weak UI, naming other platforms is a legal risk) and
LK134 (/pricing: the bottom plan card refined like the home page's; the final slide as "Free or Pro" or similar). His words:
`docs/brain/OWNER-FEEDBACK-2026-10-31-LEARN.md`, section "5 Nov 2026, about 11:40 pm". Spec: `docs/brain/night-1105/SPEC-R4.md`
H7 and "/pricing". LK133 (the nav's Pricing pill to /pricing) is H9 in the spec and lives in `NavBar.jsx`, outside this
packet's files; it is not changed here.

## User task

A 16-17-year-old who has scrolled the whole home page reaches pricing and wants three answers fast: what Pro costs, whether
it is worth it for how much they practise, and how to get in (Get Pro, or start free). On /pricing, after seeing what Pro
unlocks and the side-by-side table, they make one choice: Free or Pro. Success test: the price, the per-mock figure at their
pace and the per-question catch are each one glance; every figure can be checked on a calculator from the page's own sum; the
lowest pace honestly reads as little (one a week in each paper); nothing names or prices another platform; Free stays plainly
there on both pages; the checkout is one key on the one Pro card.

States: the bank count loading / loaded / failed (PlanCounts, unchanged: the local dev server has no database, so the captures
show the failed state, the lines without a number); monthly or one-time offer (separate sentences; the month sheet draws only
for the monthly offer); new offer released (no per-mock maths); guest or signed in (Start free for guests; on /pricing a Pro
student sees "You are on Pro" on the same glass card); invites on or off; Night or Day; reduced motion; reduced transparency.

## What changed

1. **The plan card sits lower (LK130).** The stage, the big word, the glass card, its seal strip and the grouped lines moved
   into one shared component, `src/components/pricing/PlanStage.jsx` with `plan-stage.css`, used by both pages. The card now
   starts at 64% of the word's size (round 3: about 47%), so about three quarters of "Pro" shows and the card's glass meets
   only its last quarter. In Day the word is ink at 66% (5.3:1 on the Day paper; round 3's 55% was 3.8:1) and the Day glass is
   a little clearer (0.7-0.76 alpha, was 0.8), so the tucked part of the word reads through the blur; Night is unchanged
   (4.8:1). The word stays ink, never volt.
2. **The pace control (LK131).** "Full mocks a week: 5 / 7 / 14 / 21", each key with what it means under the number: 1 per
   paper, 1 a day, 2 a day, 3 a day. One a day is selected first. The read-out is the figure ("about ₹3.30 a mock", rounded
   up), the catch ("Under 7 paise a question."), the month as an answer sheet (one ring per Full mock the top pace gives in a
   30-day month, 90 rings, filled to the pace), what the pace comes to ("At one a day: 30 Full mocks in a 30-day month, 1,500
   questions.") and the sum ("₹99 ÷ 30 = ₹3.30."). On the live ₹99 monthly offer the four paces are ₹4.80, ₹3.30, ₹1.70 and
   ₹1.10 a mock, and under 10, 7, 4 and 3 paise a question. The lowest pace is said plainly: "At one a week in each of five CUET
   papers: 21 Full mocks in a 30-day month, 1,050 questions." Everything is computed from the offer in
   `src/lib/payments/value.mjs` (`perMockTable`, the new `perQuestion` with the Full mock's own size from
   `data/test_modes.js`, and `asLowAs`, the top pace's row, for the hero's "as low as ₹X a mock" hook in H2).
3. **The rival comparison is gone (LK132).** `PriceCompare.jsx`, `data/price_comparison_1105.mjs` (the three rival rows and
   their sources), `COMPARE_COPY`, `proToExam` / `monthsThrough` and the `.lp-cmp` CSS are deleted. Tests now hold that no
   rendered source names another platform, that no pricing surface says "vs", compares with "other prep" or carries a
   sources block, and that /pricing types no rupee amount but Free's ₹0 (fix stage, below).
4. **/pricing ends on "Free or Pro" (LK134).** The table "Free and Pro, side by side" now stands beside its heading and one
   line ("On Free, credits decide how often you practise, never what you can see. Pro takes the limits off practice.", from
   the page's own Free notes). The last section is the choice: "Free or Pro / Start on Free, no card needed. Go Pro for
   unlimited mocks." (the line follows the offer on sale: `planOffer.mjs choiceLine`), Free's card under a quiet "Free" and the home page's glass Pro card under "Pro" (seal strip, title, ₹99
   a month, the grouped lines with the live counts, and the one Razorpay checkout). `#plans` is Pro's stage, so the hero key,
   the dock and the Upgrade sheet still land on the checkout. "How Free works" folds under Free's card at every width (it no
   longer has its own column). The old "Or start free." section folded into the choice; the Ask Mobi credits and FAQ
   sections follow unchanged.

## Decisions, with evidence

- **Honest money (T006, T008, T009; UI standards digest 11).** Every "about" figure is the division to the paisa rounded up to
  10 paise; the catch is "under N paise" only when the exact figure is below the next whole paisa (6.6 is "under 7"; an exact
  5 would print "5 paise"); questions count whole mocks only. Monthly and one-time keep separate sentences (tested sentence by
  sentence over every row of both offers). No struck price, no saving, no countdown, no "cheapest".
- **Why these words for the paces.** The owner wants the lowest pace to feel low without a false claim. "1 per paper" says
  what 5 a week is (CUET UG allows up to five subjects), and the read-out spells it out; no line says anyone "should" sit more.
- **Why the month sheet.** Data decides the form (digest 2): the number of mocks is the thing that changes, so the page draws
  it, in the brand's own answer-sheet rings, filled with `--brand-word` (a progress mark, R3-D2), not volt literals. It is
  decoration for assistive technology (the count line says the same) and does not draw for the one-time offer, whose periods
  run to hundreds of mocks.
- **One stage, two pages (reuse over rebuild).** The owner called the home card the one thing done "perfectly" and asked for
  /pricing's to match it, so both now render the same `PlanStage` + `PlanCard` with one stylesheet. Glass stays on that card
  only (LK112), with the solid fallback under `prefers-reduced-transparency`; the page sheets (`home-pricing.css`,
  `pro-page.css`) carry no blur.
- **Free beside Pro, not under it.** A choice reads as two plans side by side (S014: the Free notes stay one tap away in a
  fold, not hidden). The "Free" word is the same type at half the ink, so Pro stays the one to look at; Free's card is solid
  paper, only Pro is glass. Reading order and focus order are the same (Free, then Pro) at every width.
- **Layout per size.** Phones: card, then the value. From 720 px the value sits beside the card and stays in view (sticky)
  while the long card scrolls past, which removes the empty band beside the card on tablets and desktops. From 1400 px the
  word, card and read-out scale up (LK117: "massive, clearly visible" on desktop).
- **Accessibility (S016).** The pace control is native radios in a fieldset (arrows, Tab, screen readers); each key is 60 px
  tall (68 px from 1400 px); the figure and the catch are in one polite live region; the figure's tween and the rings' fill
  stop under reduced motion. The section headings step h2 > h3 on both pages.

## Tests changed by these owner decisions (rule updated, never deleted)

- `data/tests/pricing_value_1105.test.mjs` (rewritten, 16 tests): the paces 5/7/14/21 with one a day first; every pace under
  ₹10 a mock and 5 a week under ₹5 (LK131); the catch computed from mocks x the Full mock's size; the pace words; the maths;
  one-time sentences; monthly and one-time never in one sentence; the comparison gone and no rival named on any pricing
  surface (LK132); the shared stage on both pages with the card lower and Day's word at 66% or more (LK130, LK134); the
  control's accessibility; the month sheet. The round 3 comparison tests (dated rows, sources, same-period totals) were
  replaced by the removal test, by the owner's decision.
- `money_v13_1020`: the checkout's anchor is now Pro's stage (`<PlanStage ... id="plans" className="pro-plan">`) and the card
  is the glass `PlanCard` (an h3); `pro-page.css` still has no blur (the glass lives in the shared sheet).
- `pricing_copy_1017` W-097: the same card pin, and `PlanValue.jsx` replaces the deleted `PriceCompare.jsx` in the
  no-struck-price check.
- `web_landing_health_1020`: /pricing headings step down: the choice's h2 "Free or Pro", then Free's h3 and Pro's h3.
- `night_calm_1104`: `src/components/pricing/plan-stage.css` joins the checked sheets; the two named exceptions (the plan card's
  glass, the seal strip's volt art) apply to it as they did to `home-pricing.css`.

## Anti-slop test and rubric (internal checklist; the owner signs off)

| Check | Result |
| --- | --- |
| 1 Identity without the logo | The answer-sheet seal strip and rings, the big ink "Pro", volt only as the key and selected pace: MockMob's own marks. |
| 2 One primary action | Home: Get Pro (Start free is a quiet text link). /pricing choice: Get Pro on Pro's card; Free's key is secondary. |
| 3 True content | Every rupee and paise figure from the offer; the count line and the sum let a reader check it; no rival names. |
| 4 Hierarchy at first scan | Price on the card; figure, then the catch, then the sheet, then the words, then the sum. |
| 5 Intentional composition | Card and value side by side from 720 px, the value held in view; Free beside Pro on /pricing. |
| 6 Type by role | Display (word, figure), title (card, panel), body (lines), data (tabular numerals in keys, figure, sum). |
| 7 Every state | Counts loading / failed / loaded; monthly / one-time / new offer; guest / Pro student; reduced motion and transparency. |
| 8 Accessible interaction | Native radios, 60-68 px keys, focus ring, one polite live region, decorative word and sheet hidden from AT. |
| 9 No pseudo-evidence | No rival prices, no "students save", no struck price; "about" and "under" are bounds, said as such. |
| 10 Motion with a reason | Only on a change: the figure (300 ms) and the rings (160 ms, 2 ms apart); none under reduced motion. |
| 11 Leading metric and guardrail | Metric: Get Pro taps from #pricing and #plans checkouts started (existing funnel). Guardrail: refund requests and "price unclear" support mail; not instrumented here. |
| 12 What would be better without this? | The month sheet was the one candidate to cut; kept small (12-16 px rings) because it is the only picture of "more mocks". |

Rubric (0/1/2): task fit 2, information architecture 2, content truth 2, readable hierarchy 2, visual specificity 2,
accessibility 2, functional states 1 (the live count's loaded state was not seen locally: no database), trust 2, intentional
motion 2, performance 2 (no new script; 90 small elements), responsive integrity 2, instrumentation 1 (no new events).

## Verification

Real Chrome (playwright-core, headless, the shared browser lock), dev server on port 3594 with a placeholder monthly plan id
in the environment so the page renders the offer production sells (₹99 a month). Screens in `tmp/r4/` (git-ignored):

- Home #pricing, before (v0) and after (v1-v4): 390x844 and 1440x900 Night and Day; 360x640 and 1280x800 Night and Day with
  the 5 and 21 keys clicked (v2: "about ₹4.80 a mock", "Under 10 paise a question.", 21 rings; then "about ₹1.10", "Under 3
  paise", 90 rings; each key 60 px tall); 768x1024 and 1920x1080 Night and Day (v3 before the tablet fix, v4 after).
- /pricing, before (p0, p0b) and after (p1, p1c, p2): the table section and the choice at 390x844 and 1440x900 Night and Day,
  and the choice at 360x640, 768x1024 and 1920x1080 Night and Day.
- Fixes from the looks: the sheet's rings were too heavy at 16-18 px (now 12-14 px, 16 px from 1400 px); "1 per paper" touched
  the selected rim at 360 px (now 12 px there); at 768 px the stacked column floated under a left-aligned head (now two
  columns from 720 px); on a 360 px phone Free's long Credits term was a narrow column (now label over words); the choice's
  line wrapped on desktop (now one line).
- Keyboard (k1, 390x844 Night): focus on the selected key (7), ArrowLeft selects 5 ("₹4.80", "Under 10 paise a question.",
  the count line for five papers) with the focus ring drawn; three ArrowRight presses reach 21 ("₹1.10", 90 rings).
- /pricing as a Pro student (`?pro=1`, dev only) at 390x844 Day (k2): "You are on Pro" on the same glass card under "Pro", with
  Manage your plan. `/pricing#plans` at 1280x800 Night (k3): the Pro stage lands 64 px from the top, just under the 60 px bar.
- No horizontal overflow at any captured size (the capture script measures scrollWidth). The only console errors are the
  local `/api/stats` 503s (no database on this dev server), which is the counts' failed state.

## Open for the owner

- H9 / LK133 (the nav's Pricing pill to /pricing) is in `NavBar.jsx`, not in this packet's files.
- The hero's "as low as ₹X a mock" hook (H2) can read `asLowAs(offer)` from `value.mjs` (₹1.10 on the live offer) so the hook
  and the control never disagree.

Tests: `node --test src/components/landing/*.test.mjs data/tests/*_1104.test.mjs data/tests/*_1105.test.mjs
data/tests/web_landing_health_1020.test.mjs`: 388 pass, 0 fail, 11 skipped (the Chrome bench tests that need their own server).
Every suite that reads a touched file (35 files: pricing, money, billing copy, first-free-mock, referrals, app view, credits,
release 9/10, landing copy and others): 520 pass, 0 fail, 3 skipped. `npm run test:billing`: 453 pass. `npm run test:app`:
1,000 of 1,005 in one run, the 3 failures (practice_pick_parity, release9b_mob_merge_1018, sample_import) touch no pricing file
and each passes when run alone (8/8, 7/7, 8/8); that run coincided with the C: drive reaching 0 bytes free. `npx eslint` on
every changed JS file: clean.

## Fix stage (6 Nov 2026, after the read-only review)

The review found no high-severity defect; it raised two medium and five low findings. What changed, and why:

- **Medium, the rival guard was a short denylist (fixed).** `pricing_value_1105` now walks every rendered source (`src/`
  and `data/`'s modules, 1,200+ files, tests and comments aside) for the CUET-prep names, so a rival cannot return through a new
  file (checked by a probe file naming one: the test failed, the probe was removed). On the pricing surfaces (the home page's
  pricing files, `/pricing`, `/pricing/ai-credits`, `PricingCard`, `ProShowcase` and the three pricing sheets) it also fails
  on "vs" or "versus", "other prep / apps / platforms", "elsewhere", a "Sources:" block or "prices as listed", and the old
  comparison's names and class. `/pricing` may type one rupee amount, Free's ₹0; every other figure comes from the offer.
  The names stay as a floor. (`about`, `terms`, `cuet-2027` and `cuet-practice-tests-online` are covered by the source walk.)
- **Medium, "unlimited mocks" beside the paces (fixed where this packet wrote it).** The new "Free or Pro" line now comes from
  `choiceLine({ newOffer })` in `planOffer.mjs`: "Go Pro for unlimited mocks." on the current offer, where Pro's list and the
  side-by-side table say Full mocks are unlimited, and "Go Pro for unlimited practice and reattempts." on the new recovery
  offer, which is that offer's own promise (`proPlan({ newOffer: true })`). A test holds both branches and that the page reads
  the switch. The per-mock maths and its month sheet already show only for the current offer (`HomePricing`).
  The sheet: the count line under it now starts "At ..." ("At one a day: 30 Full mocks in a 30-day month, 1,500
  questions."), so it reads as this pace's month. "Up to" was rejected: on the offer the sheet is drawn for, Pro's Full mocks
  are unlimited, so "up to 90" would invent a cap that does not exist.
  Not changed (older than this packet): `/pricing`'s hero lede and first moment ("Unlimited mocks") and the home head ("Start
  free. Go Pro for unlimited mocks.", pinned by `landingCopy.test.mjs`) are not switched on the new offer. Whoever releases
  the new offer should give those lines its words; open for the owner below.
- **Low, the quiet "Free" read nearly as heavy as "Pro" in Day (fixed).** Day's Free word is ink at 0.2 (was 0.3; Pro is
  0.66), held by a test at a third of Pro's or less; Night stays 0.24 against Pro's 0.5. The choice's cards start 20 px under
  the line (was 8 px), so the big "Free" no longer touches it on a phone.
- **Low, the dock covered Free's card on a 360 px phone (fixed).** `MobileDock` already steps aside while the page's own volt
  key is on screen; a section marked `data-dock-yield` now counts too, and `/pricing`'s choice carries it. While Free or Pro
  is on screen, the choice's own keys are the only ones; the dock returns above and below it.
- **Low, Free's card repeats the Credits row in its list (not changed).** The Credits term and the list's Quick practice and
  Full mock rows are each pinned by earlier owner money rules (`free_ai_wallet_50`, `practice_credit_per_question`) and
  predate this packet; trimming them is the owner's call. Open below.
- **Low, "1 per paper" is ambiguous (not changed).** The legend right above the keys is "Full mocks a week", so the key reads
  "5 Full mocks a week, 1 per paper", the same pattern as "7, 1 a day"; the read-out spells it out. The suggested "1 a week
  each" is 13 characters and breaks the 360 px fit (12 at most).
- **Low, the 503 (named).** It is `GET /api/stats` answering 503 `{"state":"unavailable","reason":"snapshot_missing"}`: this
  dev server has no database or inventory snapshot. It is the plan card's counts' failed state, which draws the lines without
  numbers; nothing in pricing reads anything else that failed (the capture logs every 4xx/5xx response).

Open for the owner (added): the hero lede, first moment and home head on the new offer; Free's card length on `/pricing`.

Fix-stage verification. Tests: `pricing_value_1105` now 18 (was 16): the source-wide rival walk with the "vs" / sources /
typed-rupee rules, and the choice line by offer; the dock yield and Day's quiet word are added to the existing stage tests;
the count-line strings follow the "At ..." wording (this packet's own pins). The landing suites: 390 pass, 0 fail, 11 skipped,
12 todo. Every suite that reads a touched file (27 files, with `web_nav_a_1019` and `web_fixb_1019` for the dock): 375 pass,
0 fail. `npm run test:app` 1,018 pass, 0 fail, 2 skipped; `test:dock` 63 pass; `test:billing` 453 pass. `npx eslint` on the
changed JS: clean. Looks (real Chrome, headless, the shared lock; dev server 3594 with a placeholder monthly plan id; files
in `tmp/r4/`, git-ignored): `/pricing`'s choice at 360x640, 390x844, 768x1024, 1440x900 and 1920x1080, Night and Day (f1):
the line and the "Free" word clear of each other, the Day "Free" plainly lighter than "Pro", no dock over Free's card, no
horizontal overflow. The dock at 360x640 Day (f2), read from the page: shown on the side-by-side table, hidden from 200 px
before the choice through Free's list and Pro's checkout, shown again at Ask Mobi and the FAQ. Home `#pricing` at 390x844
and 1440x900, Night and Day (f3): "At one a day: 30 Full mocks in a 30-day month, 1,500 questions." under the sheet. The only
failing request in every capture is `GET /api/stats` 503.
