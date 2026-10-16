# Design decisions: deploy gate fixes for deploy/batch-1016b

Branch `deploy/batch-1016b` (worktree `wt-batch2`, cut from `09421b29`), 16 Oct 2026. One fixer pass over the batch-2 gate: 2 blockers, 4 majors and 13 minors on Ask Mobi with a handed-over question, the post-attempt Pro modal, /pricing checkout, Account Plan, the Mistake Lab "Check it held" step, the marked-for-review SWOT line, /pricing/ai-credits, Practice and the preview fixture. Format follows `docs/research/premium-ux-ui-2026-10/AGENT_RULES.md` rule 39. Evidence IDs (T001-T009, S010-S018) are from the research brain. No feature was removed. Where a control moved or was hidden, its job is still available (listed below).

## User tasks

- A student arrives on Ask from a repair with one question, and needs to know exactly what Mobi sees and what the reply costs before paying.
- A free student who has just finished an attempt sees an honest Pro offer and can dismiss it.
- A buyer on /pricing reads whether money moved, and is never invited to pay a second time.
- A student on Account sees their plan, its dates and their balances once, with the cancel path near the top on a phone.
- A student repairing a mistake answers the check question, then moves to the next mistake.

## What changed and why

### Blockers
- **Pro modal under the app chrome (T005, rules 22 and 32).** `CreditsRemainingModal` now renders through `createPortal` into `<body>` and the scrim sits at `z-index: 1000`. That puts it above `.arena-topbar` and the bottom nav, which a page-level stacking context had previously placed over it. Hit-test (elementFromPoint at the centre and both corners) passes for Close, the heading, See Pro and Continue on free at 390x844, 360x740 and 1440x900, in Night and Day. A real pointer click on "Continue on free" closes the modal and leaves the URL on `view=dashboard`. At 360x740 the sheet scrolls inside itself (max-height 92dvh), and the button is reachable.
- **Checkout error contrast (S016, rule 36).** `.mm-checkout__msg[data-tone="bad"]` uses the marketing theme's `--bad-text` (Night `#ff9d92`, Day `#b0291f`) and falls back to `--flag`. The measured contrast on the card is Night 8.84:1 and Day 6.6:1, against 2.99:1 before. The icon stays.

### Majors
- **Ask with a handed-over question (rule 24 and the MockMob overlay).** The "Your record is the context" panel and the Focus select are no longer shown beside a handed-over question. The cost and limits now sit in the question card's footer: "One written reply uses 1 AI credit. You have N. The reply is guidance on this question, not a verified answer key." The reply-source switch is hidden there too, because its free side cannot discuss a question; "Ask something else" still returns to it. The record wording and Focus stay unchanged for ordinary Written guidance. A test pins this behaviour.
- **Phone dock after checkout (rules 17 and 19).** A new `src/lib/payments/checkoutStatus.js` store (read with useSyncExternalStore) is written by `RazorpayPaymentButton`. On /pricing (`checkoutAware`) the dock behaves as follows. While confirming, it reads "Confirming your payment. Do not pay again." with no button. After an error once the checkout has taken a payment, it reads "Payment not confirmed yet. Do not pay again; see the message on the plan." Once Pro is active (from the server or after success), it reads "Pro is active on this account." with Go to Practice. This was verified with a stubbed checkout (refused, verify failed, success) at 390 and 1440.
- **Pro modal copy (T005, rules 19 and 22).** The title is "What Pro adds" and the lead is neutral: results, explanations, DU eligibility and the top three chapters stay open on Free. The list contains only items that are Pro-only on /pricing: full chapter review, Compass Pro, Smart practice and NTA mode. "Radar", the PRO badges and the ALL-CAPS labels are gone, and labels are sentence case. The price line always names the real rupees: "₹99 a month ... Renews monthly. Cancel anytime in Account." or "₹99 once, through 31 July 2027 ... No renewal." When the quote could not be read, the line says the price could not be read and that See Pro shows it before any payment, without inventing a figure. The preview quote stub now carries `offer` (`?offer=monthly` for the monthly variant).
- **"Radar" in the sidebar.** The nav item is "Weak chapters". The same word is gone from the result link ("Open weak chapters"), the analytics suggestions ("Ask Mobi: ..."), the assistant page help, the subject-hub FAQs and the rival profile description.

### Minors
- **Check it held skeleton (no layout shift).** The skeleton has two tie lines plus a 5-line stem on phones and a 3-line stem from 481 px. Measured loading to ready: 587 to 600 px at 390 (was 469 to 600) and 513 to 507 px at 1440 (was 443 to 507).
- **One main action (rule 7).** While the check is loading, ready or sending, "Next mistake" takes the outlined style (CSS `:has()` on `.mr-chk[data-phase]`) and returns to lime after the answer.
- **Revise line.** It now reads "**Revise** will bring both back tomorrow: this mistake and the question you just missed." Only "Revise" is the link, with 10 px vertical padding (44 px tall on phones). The Missed verdict uses a minus mark instead of the retry arrow.
- **Ask cost line on the repair.** It is set at 13 px in ink-2. The check's option column now fills the card (788 px at 1440), and text blocks keep their ch caps.
- **Ask arrival layout.** The separate service panel is merged into the card. The empty transcript no longer reserves 200 px. On arrival the page scrolls the question card under the top bar once (instantly under reduced motion). The composer then sits at y 574-753 at 390x844 and y 698-850 at 1440x900. In the blocked state the console collapses to its content (640 to 495 px at 390, 640 to 420 px at 1440).
- **Marked-for-review SWOT.** The detail is now the counts only. The break-even is a quieter second line (optional item field `note`, additive to the contract): "Under +5 for right and −1 for wrong, an answer beats a blank when it is right more than 1 time in 6." Groups with findings come first, and an empty group is one full-width line after them, so there is no tall empty Strengths cell.
- **Account Plan.** Dates are formatted in Asia/Kolkata and say "(IST)" once in the lead. /refunds now says "before the paid-through date shown in Account, under Plan", the same term Account uses. Each balance is shown once: the Plan card says what things cost ("Your balance is under Credits"), and Credits holds both balances and the ledger. The AI wallet line in Plan was removed because the Credits tile shows the same number. The failed-payment Free state now shows the Free costs, and Cancel renewal stays its only money action. On phones the order is sheet, Plan, Credits, colleges, name: Plan moved from about 1900 px to 1058 px.
- **/pricing.** The Free column carries a "How Free works" note at 860 px and up, built from facts already in the table. This cuts the Free/Pro height gap from about 500 px to about 150 px. The single tinted Compass row is now untinted. "Pro is already active" is a hairline status box with no fill.
- **/pricing/ai-credits.** The "Pricing" kicker above the H1 is gone (the nav has Pricing). While top-ups are paused, the rules speak only about credits already bought.
- **Practice.** The numbered 1, 2, 3 steps stay, because Subject, Mode and Questions are a real sequence, not decoration. Below 1024 px the session summary and Start now come before Fine-tune. Start is still about 1,570 px down at 390, because the four mode descriptions are content and were kept.
- **Preview fixture.** `/api/me/credits` is served from `data/tests/fixtures/credits/contract_credits_v1.json`, with the plan name and date set from `?plan=`. `?credits=down` shows the failed state.

## Not changed
- The modal sheet stays dark in Day mode, as the original file intended ("in-app, stays dark").
- The "Set up Quick practice" Mobi block on Practice was not changed in this pass.
- The preview's AI balance differs between the top bar (68) and the Credits fixture (9). This is dev-only fixture data.

## Verification
- Real headless Chrome (own profile, CDP), against the dev server on port 3151. Screens are at 390 and 1440 in Night and Day, saved in `mockmob-next/tmp/1016b-gate/after/`: modal, pricing and checkout states, ask live and paused, repair check loading, ready, picked and answered, SWOT, account plan, dashboard.
- Pointer clicks were real `Input.dispatchMouseEvent` events at element centres, with elementFromPoint checked.
- `npm run lint` is clean. These suites pass: test:app 335, test:recovery 306, test:learning 302, test:nta 180, test:du 19, test:auth 52, test:answer-integrity 11, test:billing 87, test:factory 332.

## Anti-slop check
There are no new gradients, glow, glass or cards inside cards. The modal's per-item boxes became a plain list (rule 33). There are no ALL-CAPS labels, no arrows on buttons, no exclamation marks, and no invented prices, urgency or loss framing (T005, T009). Every money line names its real amount and terms (rule 19).
