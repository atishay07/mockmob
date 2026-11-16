// What a bring-a-mistake ask costs, in credits. Its own module, with no imports and no model prompt, so the home page can show
// the prices without carrying the prompt's text (data/tests/landing_checklist_1104.test.mjs reads every file the home page
// imports for banned promises). src/services/mobi/bringMistake.mjs re-exports all three; change a price here only.
export const MISTAKE_CREDITS = 1;
// A photo ask: 2 credits (owner's brief, 16 Nov 2026). Prices against the caps, re-checked on 16 Nov 2026 at night when the owner
// raised Free's monthly AI cap from Rs 2.50 to Rs 3.50 ("just fit everything within our budget and price things according to
// it"). The guard's price row for gpt-6-luna is USD 0.10 in, 0.50 out per million tokens
// (supabase/migrations/20261005090000_runtime_ai_price_gpt6_luna.sql). The per-student caps are rows of runtime_ai_budget, at
// the Rs 88 to the dollar the cap rows use: Free USD 0.0398 = Rs 3.50 (supabase/migrations/20261117090000_free_ai_cap_350.sql,
// run by the owner; the row holds USD 0.0284 = Rs 2.50 until then), Pro USD 0.0568 = Rs 5. Both plans include 50 AI credits a
// month, so one credit is worth Free Rs 3.50 / 50 = Rs 0.07 (USD 0.000795) and Pro Rs 5 / 50 = Rs 0.10 (USD 0.001136).
//   receipts (production runtime_ai_requests, read on 16 Nov 2026): written Ask Mobi answers average USD 0.00047 (4 since
//     20 Oct, at most 0.000502); repairs USD 0.000305 (12, at most 0.000479); the first two real photo asks (two random photos,
//     10:25 and 10:26 pm IST, both answered "not a test question") 2,362 prompt tokens each with the image, 13 and 32
//     completion tokens, USD 0.000243 and 0.000252 actual against a reservation of USD 0.0020246 (about an eighth of it).
//   so, per action, against a Free credit's Rs 0.07: a doubt with its follow-up about Rs 0.062, a repair about Rs 0.027, Study
//     and question help about Rs 0.04, all at 1 credit; a photo ask about Rs 0.09 to 0.11 at 2 credits (Rs 0.14); a typed ask
//     estimated at Rs 0.04 to 0.08 at 1 credit (none has run for real: about 990 input and 1,600 output tokens for a
//     400-character paste is USD 0.00090); an ask Mobi read but cannot use about Rs 0.02 (the two photo receipts above) at
//     MISTAKE_UNUSABLE_CREDITS (1). Every price fits, so none changes.
//   worst case the guard can reserve (data/tests/bring_mistake_1116.test.mjs computes both with the real reserveRuntime):
//     typed: input bound 11,407 (bytes as tokens: economics' chapter list, every character of the longest paste and both
//            answers a quote, escaped twice) x 0.10 + 2,100 output x 0.50 = USD 0.00219 (Rs 0.19);
//     photo: input bound 7,302 (a 300-character note) + 6,250 image tokens (1,600 x 1,600 px = 2,500 patches x 2.5) = 13,552
//            x 0.10 + 2,600 output x 0.50 = USD 0.00266 (Rs 0.23); a photo ask's worst case is 1.21 typed asks'.
//   Each ask is let through only while this month's spend plus its own reservation fits under the cap, so the last asks of a
//   month need that headroom: Rs 3.50 holds 18 worst-case typed or 14 worst-case photo reservations on their own.
export const MISTAKE_PHOTO_CREDITS = 2;
// An ask Mobi had to read but cannot use (owner, 16 Nov 2026, 10:25 pm: "if someone keeps spamming random photos ... It must
// cost something"): the model's own "not a test question" (typed or photo) or "unreadable" (photo) takes this many credits,
// once, through the one-step consume (src/services/mobi/mistakeAsk.js). Refusals before the model, the support reply and our
// own failures stay free.
export const MISTAKE_UNUSABLE_CREDITS = 1;
