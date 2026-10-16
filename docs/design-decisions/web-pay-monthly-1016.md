# DESIGN_DECISIONS: Rs 99 monthly plan gate (web/pay-monthly-1016), 16 Oct 2026

Scope: /pricing, the Pro checkout button, Account > Plan (renewing, renewal off, payment failed, lapsed, fixed date, cancel flow) and /refunds.

Gate: dev server on port 3160 (webpack), real pointer clicks through CDP, 390x844 and 1440x900, Night and Day, in both modes: env unset (today's one-time offer) and `RAZORPAY_PLAN_ID_PRO_MONTHLY_99` set to a fake id in the process environment only (no .env file, nothing committed). No Razorpay or other external call: checkout states were driven by stubbing `fetch` and `window.Razorpay` in the page.

## User task
A student decides whether to pay, pays once, and later checks what they are paying and how to stop it. They must be able to read the real rupees a month, when it is charged, what is included and how to cancel before they click, and see the same facts in Account afterwards.

## Evidence used
- T005 (loss framing): no countdown, no "you will lose" lines. The cancel copy says what stays (history, saved questions, Pro to the paid date), never what is lost.
- T006 (contrast effect in pricing): monthly and one-time amounts are not set side by side. Before monthly opens, /pricing no longer prints the monthly price next to the one-time payment, and "Pay once now" is gone.
- T007 (a trial that explains rather than pressures): the card states the charge on the start date, the same date each month, and the cancel path, above the button.
- T009 (specific, not invented): no crossed-out price, no discount badge, no invented urgency. The referral field says it does not change the price.
- AGENT_RULES 19, 21, 22 (real fees and renewal terms, no invented reference prices, no coercive prompts), 17 (progress only for completed steps: a payment still being confirmed is not shown as Pro), 35 (states: error, retry, pending), 36 (focus, contrast, WCAG 2.2 AA via S016).
- ui-ux-standards section 10 slop list: no eyebrow, no gradient or glow, no nested card, no ALL-CAPS label, no arrow on a button we own.

## What the gate found and what changed
| # | Finding | Severity | Fix |
| --- | --- | --- | --- |
| 1 | After the first monthly payment verified, the checkout block was replaced by "Pro is already active on this account" and the success line (renews monthly, cancel in Account) was never shown. | Blocker (honest money) | The active box now keeps the confirmation: renews every month until you cancel in Account, where the date of your next payment is shown. |
| 2 | A payment that was still being confirmed re-showed "Start Pro" and invited a second payment. | Blocker | Status `confirming`: the button is closed and reads "Confirming your payment". |
| 3 | The renewal terms sat in a small line under the button and never said that the first charge happens at start. | Major | Card description (above the button): Rs 99 is charged when you start, then every month on the same date until you cancel. The FAQ says the same. The footnote carries the cancel path. |
| 4 | Account (renewing) did not say the rupees or that the paid-through date is the next payment date. | Major | "Pro renews every month at Rs 99. Paid through <date>. The next payment is due then." |
| 5 | Payment failed with Pro already off: copy said "or start Pro again" while a primary "See Pro" button led to a refusal (409 `subscription_open`). | Major | One action only: Cancel renewal. Copy: cancel first, then start Pro again. |
| 6 | A failed cancel left no way to retry without a reload. | Major | The error state offers "Try cancelling again". |
| 7 | After a cancel was accepted, the lead still said "renews every month" until the session refreshed. | Major | The card switches at once (renewal off, or lapsed when Pro was already off). |
| 8 | No lapsed state: a student whose monthly Pro ended saw plain Free. | Major | "Your monthly Pro has ended and no further payment will be taken." plus credits and See Pro. |
| 9 | Refusals ("Pro is already active", "earlier plan still open") ended with "Nothing has been charged. You can try again.", and some server errors had no full stop. | Major | No retry line after those two codes; a full stop is added before the follow-up sentence. |
| 10 | "Referral or discount code" on the monthly plan, where no code changes the price. | Major | Label "Referral code" and "A referral code does not change the price." |
| 11 | Before monthly opens, /refunds described monthly cancelling as if it were on sale. | Major | The page reads the plan setting and, while monthly is closed, says it is not on sale yet and what will apply when it opens. The failed-renewal section shows only when monthly is open. |
| 12 | /pricing used PrepOS, Radar and XP (page, metadata, FAQ and JSON-LD). | Major (owner rule) | Ask Mobi, "your record", points. Zero matches in text, metadata and JSON-LD in both modes. |
| 13 | ALL-CAPS tracked labels and a mono "FREE/PRO" cell label in the comparison table, a 3px coloured edge on one row. | Minor | Sentence case, display font, no edge. |
| 14 | About 220px dead band between the lead and the plan cards at 1440. | Minor | Plans start under the lead; the Pro card is higher on the first screen. |
| 15 | The cancel confirmation was a card inside the plan card. | Minor | A hairline and spacing instead of a second box. |
| 16 | The disabled checkout button was dark text on dark olive in Night. | Minor | Readable disabled style. |
| 17 | The monthly-mode hero said "Cancel any month". | Minor | "Cancel any time in Account." |

Also changed in dev tooling only: `/preview/arena?view=profile&plan=monthly | monthly-off | monthly-failed | monthly-failed-free | monthly-lapsed` and a stubbed `/api/billing/cancel` (`&cancel=fail` for the error state), so every Plan state can be looked at without a hosted sign-in. The preview route is a 404 in production.

## Alternatives considered
- Put the charge terms in a modal before checkout: rejected, the card already holds them and a modal adds a step before the student can read.
- Show the next payment as a calendar date computed on the page: rejected, only Razorpay knows it; Account shows the paid-through date, which is the date the next charge is due.
- Remove the one-time offer copy entirely before monthly opens: rejected, it is today's behaviour; only the price comparison and the pressure line were removed.

## Trade-offs and open assumptions
- "The next payment is due then" assumes Razorpay charges at the end of the paid period, which is how the plan is set up. Confirm it in the Razorpay TEST run in the runbook (Part 2, steps 3 and 4).
- Checkout was driven with a stubbed Razorpay window, so the real Razorpay modal, UPI and card flows are not covered here. The runbook's TEST pass covers them.
- The shared mobile dock on /pricing still shows an arrow on its "Start free" button and a price note beside a free action. It is a shared component also used by the landing, which another agent owns, so it was not changed.
- The Account wallet strip still says "Open PrepOS" (outside /pricing).
- Terms and Privacy keep the "// Legal" eyebrow template. Not touched.
- After a successful one-time payment the success line now also survives (same component), a small change to today's behaviour that only shows after a real payment.

## Verification (what was actually exercised)
- Real pointer clicks (`Input.dispatchMouseEvent`) with a hit-test before each click: Start Pro (signed out goes to /login; the other states through stubbed fetch), Cancel renewal, Yes stop renewing, Keep Pro, Try cancelling again. Every hit landed on the intended control.
- 390x844 and 1440x900, Night and Day, both modes, no horizontal overflow, no console errors on the pages captured.
- States seen: pricing (monthly, one-time), checkout (signed out, refused with an open plan, dismissed, confirming, post-payment verify failure, success, already Pro), Account (Free, renewing, renewal off, payment failed with Pro, payment failed with Pro off, lapsed, fixed-date Pro), cancel (confirm, working, done, failure), /refunds in both modes.
- Not exercised: reduced motion, screen reader announcements (roles `status` and `alert` are in place), real devices, real Razorpay.
- Suites: lint clean; test:app 268, test:auth 52, test:recovery 182, test:learning 277, test:billing 87 (76 existing, 11 added in `data/tests/billing_pay_gate_copy.test.mjs`), all pass. `next build --webpack` passes; the default Turbopack build fails only on the node_modules junction in this worktree.

## 12-part anti-slop check and rubric (0/1/2, internal)
Identity without logo 1 (existing system), one primary action 2, true content 2, hierarchy 2, composition 2, type by role 2, every state 2, accessible interaction 1 (not screen-reader tested), no pseudo-evidence 2, motion with a reason 2 (none added), leading metric plus guardrail 1 (not defined here), what would be better without this 2.

Rubric: task fit 2, information architecture 2, content truth 2, readable hierarchy 2, visual specificity 1, accessibility 1, functional states 2, trust 2, intentional motion 2, performance 1 (not measured), responsive integrity 2, instrumentation 0 (none added). The owner signs off.
