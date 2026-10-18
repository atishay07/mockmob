// The wallet's flag and the way a pack is shown. The packs themselves, their prices and their sizes are in
// src/services/credits/creditPacks.mjs (one set, usable for everything); this file adds the WALLET_COMMERCE_OPEN switch and the
// view the page and GET /api/wallet send. Pure: no React, no server-only import.
//
// Purchases are open only while the WALLET_COMMERCE_OPEN env var is exactly "true". Closed, the packs still show with their
// prices and no order is created.
import { CREDIT_PACKS, LEGACY_AI_PACKS, findCreditPack, findBuyableCreditPack } from '../../services/credits/creditPacks.mjs';

import { TEST_MODES, practiceCreditCost } from '../../../data/test_modes.js';

export const WALLET_COMMERCE_ENV = 'WALLET_COMMERCE_OPEN';
export const WALLET_COMMERCE_CLOSED_MESSAGE = 'Top-ups open soon.';

/** Open only for an env value of exactly "true" (any case, spaces ignored). Anything else, or no value, is closed. */
export function walletCommerceOpen(env = typeof process !== 'undefined' ? process.env : {}) {
  return String(env?.[WALLET_COMMERCE_ENV] ?? '').trim().toLowerCase() === 'true';
}

// The catalog is the credits core's (src/services/credits/creditPacks.mjs): a pack is { key, planId, label, amountInr, amountPaise,
// credits, featured }. Everything the wallet adds on top (the "N credits" title, the per-credit value, the wire view) is here, so
// the core's file can replace this branch's copy with no change to the wallet.
export { CREDIT_PACKS, LEGACY_AI_PACKS, findCreditPack, findBuyableCreditPack };

/** "150 credits": what a pack is called on the page and on the wire. */
export function creditsLabel(pack) {
  return `${pack.credits} credits`;
}

/** Rupees a credit costs, to two decimals: "0.20". */
export function perCreditInr(pack) {
  return (pack.amountInr / pack.credits).toFixed(2);
}

/** Whole full mocks a pack pays for, from the practice price list (a full mock is its fixed question count in credits). */
export function fullMocksIn(pack) {
  const cost = practiceCreditCost('full', TEST_MODES.full.fixedCount);
  return Number.isFinite(cost) && cost > 0 ? Math.floor(pack.credits / cost) : 0;
}

/** What the page and GET /api/wallet say about a pack. Field names are the app contract: add, never rename. */
export function packView(pack) {
  return {
    packId: pack.key,
    label: creditsLabel(pack),
    credits: pack.credits,
    priceInr: pack.amountInr,
    pricePaise: pack.amountPaise,
    perCreditInr: perCreditInr(pack),
    fullMocks: fullMocksIn(pack),
    featured: Boolean(pack.featured),
  };
}

export function packViews() {
  return CREDIT_PACKS.map(packView);
}
