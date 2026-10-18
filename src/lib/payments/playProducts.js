// Google Play product map: what each Play in-app product id grants. Owner decision, 18 Oct 2026: the Android app sells Pro
// and credit packs through Google Play Billing, at the Play Console price (never in code), and a purchase there must grant
// exactly what the matching web purchase grants, in the same tables.
//
// Ids are the website's own ids wherever the web sells the thing: Pro is the one-time CUET 2027 pass (pro_cuet_2027, Pro
// until its accessUntil, read from the web plan so the two cannot drift), and each PrepOS AI credit pack uses its web plan
// id. Nothing here carries a price: a price is set in Play Console and the server never trusts one from a client.
//
// Not mapped on purpose (the web does not sell them as a one-off, or not at all):
//   pro_monthly_99   the web's Rs 99 auto-renewing Razorpay subscription. A Play subscription would need
//                    purchases.subscriptionsv2 and its own renewal and cancel handling; add it when the owner wants it.
//   pro_cuet_2027_v2 not released on the web.
//   pro_cuet_2026    legacy.
import { PAYMENT_PLANS } from './plans.js';
import { CREDIT_PACKS, LEGACY_AI_PACKS } from '../../services/credits/creditPacks.mjs';

/** One-time Pro: acknowledged, never consumed (it must not be buyable twice). */
const pro = (webPlanId) => ({
  productId: webPlanId,
  kind: 'pro',
  webPlanId,
  accessUntil: PAYMENT_PLANS[webPlanId].accessUntil,
  finish: 'acknowledge',
});

/**
 * A credit pack: consumed after the grant, so the student can buy it again. There is ONE credits balance (owner D78, 18 Oct
 * 2026): every pack goes into the held credits as bonus credits through the AI credit purchase grant path
 * (mm_ai_grant_bonus_credits), idempotent on the purchase token. kind 'ai_credits' names that path.
 */
const pack = (productId, credits, legacy = false) => ({ productId, kind: 'ai_credits', webPlanId: productId, credits, finish: 'consume', ...(legacy ? { legacy: true } : {}) });

export const PLAY_PRODUCTS = Object.freeze(Object.fromEntries([
  pro('pro_cuet_2027'),
  // The credit packs, read from the one web catalogue (src/services/credits/creditPacks.mjs), so ids and credits cannot drift
  // (release 10 integration). Today: credits_10_50 / credits_29_150 / credits_49_300 (50 / 150 / 300 credits).
  ...CREDIT_PACKS.map((p) => pack(p.playProductId, p.credits)),
  // The earlier AI top-up packs (ai_credits_prepos_*, LEGACY_AI_PACKS): no longer sold, still accepted for safety.
  ...LEGACY_AI_PACKS.map((p) => pack(p.planId, p.credits, true)),
].map((p) => [p.productId, Object.freeze(p)])));

export function getPlayProduct(productId) {
  return typeof productId === 'string' && Object.hasOwn(PLAY_PRODUCTS, productId) ? PLAY_PRODUCTS[productId] : null;
}

/** Product ids that exist only as a gap list, for the doc and the test. */
export const PLAY_GAPS = Object.freeze(['pro_monthly_99', 'pro_cuet_2027_v2', 'pro_cuet_2026']);
