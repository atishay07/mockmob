// One set of credit packs (owner, 18 Oct 2026, D78: one credits balance). A pack's credits are usable for everything: a practice
// question, a full mock, an Ask Mobi reply. They are granted into ai_credit_wallets.bonus_credits through the existing
// purchase grant RPC (mm_ai_grant_bonus_credits) and spent after the month's free credits (public.mm_wallet_take).
// This file is the one catalog: the wallet page, the order/verify/webhook routes (through aiCreditWallet.js) and the Play
// product map import it. Pure data, no I/O, so the app, the site and the tests read the same values.
import { ONE_CREDIT_LINE } from '../../lib/creditCopy.mjs';

export const CREDIT_PACKS = Object.freeze([
  { key: 'credits_10_50', planId: 'credits_10_50', playProductId: 'credits_10_50', label: '₹10 for 50 credits', shortLabel: 'Starter', amountInr: 10, amountPaise: 1000, credits: 50 },
  { key: 'credits_29_150', planId: 'credits_29_150', playProductId: 'credits_29_150', label: '₹29 for 150 credits', shortLabel: 'Focus', amountInr: 29, amountPaise: 2900, credits: 150 },
  { key: 'credits_49_300', planId: 'credits_49_300', playProductId: 'credits_49_300', label: '₹49 for 300 credits', shortLabel: 'Best value', amountInr: 49, amountPaise: 4900, credits: 300, featured: true },
].map((pack) => Object.freeze({ ...pack, legacy: false, description: `${pack.credits} credits that do not expire. ${ONE_CREDIT_LINE}` })));

// Packs sold before 18 Oct 2026. Never offered again, but a past order, a late verify or a webhook for one of these ids
// must still grant exactly what was sold.
export const LEGACY_AI_PACKS = Object.freeze([
  { key: 'prepos_10_50', planId: 'ai_credits_prepos_10_50', label: '₹10 PrepOS top-up', shortLabel: 'Starter', amountInr: 10, amountPaise: 1000, credits: 50 },
  { key: 'prepos_20_150', planId: 'ai_credits_prepos_20_150', label: '₹20 PrepOS top-up', shortLabel: 'Focus', amountInr: 20, amountPaise: 2000, credits: 150 },
  { key: 'prepos_50_400', planId: 'ai_credits_prepos_50_400', label: '₹50 PrepOS top-up', shortLabel: 'Sprint', amountInr: 50, amountPaise: 5000, credits: 400 },
].map((pack) => Object.freeze({ ...pack, legacy: true, description: `${pack.credits} credits that do not expire.` })));

/** Google Play product id -> pack (for the app's Play Billing map). */
export const PLAY_PRODUCT_IDS = Object.freeze(Object.fromEntries(CREDIT_PACKS.map((pack) => [pack.playProductId, pack.key])));

/** Any pack, current or legacy, by key, plan id or Play product id. */
export function findCreditPack(id) {
  const key = String(id || '').trim();
  if (!key) return null;
  return [...CREDIT_PACKS, ...LEGACY_AI_PACKS].find((pack) => pack.key === key || pack.planId === key || pack.playProductId === key) || null;
}

/** Only current packs can be bought. */
export function findBuyableCreditPack(id) {
  const pack = findCreditPack(id);
  return pack && !pack.legacy ? pack : null;
}
