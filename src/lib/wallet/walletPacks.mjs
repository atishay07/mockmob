// The wallet's reload packs, the one place the owner changes a price, a size or the flag (owner D76, 18 Oct 2026).
// Pure: no React, no server-only import, so the page, the routes, the webhook and the tests all read the same list.
//
//   AI reload packs: the three that already exist. Their plan ids are what old orders and the webhook look up, so they
//   never change; only the labels are plain now ("50 AI credits").
//   Practice reload packs (new): practice_credits_19_100 = Rs 19 for 100, practice_credits_49_300 = Rs 49 for 300 (featured).
//
// The price a student pays is always read from this file on the server, never from the client.
// Purchases are open only while the WALLET_COMMERCE_OPEN env var is exactly "true". Closed, the packs still show with their
// prices and no order is created.

export const WALLET_COMMERCE_ENV = 'WALLET_COMMERCE_OPEN';
export const WALLET_COMMERCE_CLOSED_MESSAGE = 'Top-ups open soon.';

export const POOLS = Object.freeze(['practice', 'ai']);

/** Open only for an env value of exactly "true" (any case, spaces ignored). Anything else, or no value, is closed. */
export function walletCommerceOpen(env = typeof process !== 'undefined' ? process.env : {}) {
  return String(env?.[WALLET_COMMERCE_ENV] ?? '').trim().toLowerCase() === 'true';
}

// key: the older AI pack key some callers still send. packId: the id the wallet uses everywhere, equal to the payment plan id.
const DEFS = [
  { pool: 'ai', key: 'prepos_10_50', packId: 'ai_credits_prepos_10_50', amountInr: 10, credits: 50, shortLabel: 'Starter' },
  { pool: 'ai', key: 'prepos_20_150', packId: 'ai_credits_prepos_20_150', amountInr: 20, credits: 150, shortLabel: 'Focus' },
  { pool: 'ai', key: 'prepos_50_400', packId: 'ai_credits_prepos_50_400', amountInr: 50, credits: 400, shortLabel: 'Sprint', featured: true },
  { pool: 'practice', key: 'practice_19_100', packId: 'practice_credits_19_100', amountInr: 19, credits: 100 },
  { pool: 'practice', key: 'practice_49_300', packId: 'practice_credits_49_300', amountInr: 49, credits: 300, featured: true },
];

const noun = (pool) => (pool === 'practice' ? 'practice credits' : 'AI credits');

export const WALLET_PACKS = Object.freeze(DEFS.map((d) => Object.freeze({
  ...d,
  planId: d.packId,
  amountPaise: d.amountInr * 100,
  label: `${d.credits} ${noun(d.pool)}`,
  featured: Boolean(d.featured),
})));

export const AI_PACK_DEFS = Object.freeze(WALLET_PACKS.filter((p) => p.pool === 'ai'));
export const PRACTICE_PACK_DEFS = Object.freeze(WALLET_PACKS.filter((p) => p.pool === 'practice'));

/** A pack by its wallet id, its plan id (the same string) or an older AI key. Null for anything else. */
export function getWalletPack(idOrKey) {
  const id = String(idOrKey ?? '').trim();
  if (!id) return null;
  return WALLET_PACKS.find((p) => p.packId === id || p.key === id) || null;
}

/** The pack behind a stored payment's plan id (the webhook and verify), or null when it is not a credit pack. */
export function getWalletPackByPlanId(planId) {
  const id = String(planId ?? '').trim();
  return WALLET_PACKS.find((p) => p.planId === id) || null;
}

/** Rupees a credit costs, to two decimals: "0.19". */
export function perCreditInr(pack) {
  return (pack.amountInr / pack.credits).toFixed(2);
}

/** What the page and GET /api/wallet say about a pack. Field names are the app contract: do not rename them. */
export function packView(pack) {
  return {
    packId: pack.packId,
    pool: pack.pool,
    label: pack.label,
    credits: pack.credits,
    priceInr: pack.amountInr,
    pricePaise: pack.amountPaise,
    perCreditInr: perCreditInr(pack),
    featured: pack.featured,
  };
}

export function packViews(pool = null) {
  return WALLET_PACKS.filter((p) => !pool || p.pool === pool).map(packView);
}
