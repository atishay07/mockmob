# Credits wallet: what the owner wires for Razorpay (D76 and D78, 18 Oct 2026)

ONE credits balance. The wallet is built and closed: packs show their prices; no order is created until you turn the flag on. Everything below is what is left for you.

## 1. Keys and the flag (Vercel env)

| Variable | Value | Notes |
| --- | --- | --- |
| `RAZORPAY_KEY_ID` | your key id | already used by Pro checkout; the wallet reuses it |
| `RAZORPAY_KEY_SECRET` | your key secret | signs and verifies `order_id|payment_id` |
| `RAZORPAY_WEBHOOK_SECRET` | the webhook secret | required by the existing `/webhook` route |
| `WALLET_COMMERCE_OPEN` | `true` | the only switch. Anything else (or unset) = closed: no order, no payment row, keys say "Top-ups open soon" |

`WALLET_COMMERCE_OPEN` governs the wallet's own order route. The older `/api/ai/credits/order` route still honours `RELEASE_GATES.aiCommerce`.

## 2. Webhook

Endpoint: `POST https://<your domain>/webhook` (already live for Pro). Credit packs use `payment.captured` and `payment.failed`; nothing new to subscribe to if Pro already uses `payment.captured`. The webhook finds a credit pack from the stored order's plan id (`credits_10_50`, `credits_29_150`, `credits_49_300`, and the retired `ai_credits_prepos_*` ids for old orders). Verify and the webhook share the grant key `ai_topup:<order id>:<payment id>`, so a payment adds credits once even when both arrive.

## 3. Packs and the database

One set, usable for everything, in one file: `src/services/credits/creditPacks.mjs` (Rs 10 -> 50, Rs 29 -> 150, Rs 49 -> 300 featured). The server prices every order from it. A purchase is granted through the existing AI purchase grant (`mm_ai_grant_bonus_credits`) into the held balance. This branch adds no migration; the unified balance math and any database change belong to the core credits work.

## 4. Routes

| Route | Purpose |
| --- | --- |
| `GET /api/wallet` | one read for the page and the Android app (cookie or bearer) |
| `POST /api/wallet/order` `{ packId }` | validates the pack id server-side, creates the Razorpay order; 503 `WALLET_COMMERCE_CLOSED` while the flag is off. Cookie only |
| `POST /api/wallet/verify` `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }` | checks the signature and Razorpay's own record of the payment, then grants once. Not gated by the flag: a payment already taken is always settled. Cookie only |

The app does not sell credits in v1 (Play billing rules), so order and verify take no bearer token; the app reads `GET /api/wallet`.

## 5. GET /api/wallet (field names are stable: add, never rename)

```
{ ok: true,
  credits: { total, freeLeft, freeAllowance, held, resetAt, renewsOn, parts: { included, bonus, balance }, label: "Credits", buys },
  plan: { name: "Free" | "Pro", until },           // until = "YYYY-MM-DD" India time or null
  proOffer: { rupees, expires, planId } | null,     // null for Pro
  packs: [ { packId, label, credits, priceInr, pricePaise, perCreditInr, featured } ],
  commerce: { open, message },                      // message "Top-ups open soon." while closed
  history: [ { at, pool, what, delta, balanceAfter } ] | null,   // newest first, 20 lines
  historyState: "ready" | "unavailable" }
```

`total = freeLeft + held`; `held = parts.bonus + parts.balance`; `parts.included = freeLeft`. `buys` is the one sentence on what a credit buys. An unreadable balance is `null`, never 0. `history[].balanceAfter` is the running total of this one balance, counted back from today's total (null when the total is unknown); `pool` ("practice" or "ai") only names the ledger a line came from. A failed history read leaves the balance intact. 401 `{ error: "Unauthorized" }` when signed out; 503 `{ error: "unavailable", message }` when the student cannot be read.

`src/services/credits/unifiedWallet.js` (`getUnifiedWallet(user)`) is a read-only sum of the AI wallet's included-left, its bought credits and `users.credit_balance`. If the core credits work ships its own, take theirs: the route only needs the same return shape.

## 6. Test before opening

1. Set test keys and `WALLET_COMMERCE_OPEN=true` on a preview deployment.
2. Buy `credits_29_150` with a Razorpay test card: the balance rises by 150 and one "Credits added" line appears; replay the verify call: nothing is added.
3. Turn the flag off: the keys read "Top-ups open soon" and `POST /api/wallet/order` answers 503.
