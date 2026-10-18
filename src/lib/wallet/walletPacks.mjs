// The wallet's flag and the way a pack is shown. The packs themselves, their prices and their sizes are in
// src/services/credits/creditPacks.mjs (one set, usable for everything); this file adds the WALLET_COMMERCE_OPEN switch and the
// view the page and GET /api/wallet send. Pure: no React, no server-only import.
//
// Purchases are open only while the WALLET_COMMERCE_OPEN env var is exactly "true". Closed, the packs still show with their
// prices and no order is created.
import { CREDIT_PACKS, LEGACY_PACKS, getCreditPack, getCreditPackByPlanId } from '../../services/credits/creditPacks.mjs';

export const WALLET_COMMERCE_ENV = 'WALLET_COMMERCE_OPEN';
export const WALLET_COMMERCE_CLOSED_MESSAGE = 'Top-ups open soon.';

/** Open only for an env value of exactly "true" (any case, spaces ignored). Anything else, or no value, is closed. */
export function walletCommerceOpen(env = typeof process !== 'undefined' ? process.env : {}) {
  return String(env?.[WALLET_COMMERCE_ENV] ?? '').trim().toLowerCase() === 'true';
}

export { CREDIT_PACKS, LEGACY_PACKS, getCreditPack, getCreditPackByPlanId };

/** Rupees a credit costs, to two decimals: "0.20". */
export function perCreditInr(pack) {
  return (pack.amountInr / pack.credits).toFixed(2);
}

/** What the page and GET /api/wallet say about a pack. Field names are the app contract: add, never rename. */
export function packView(pack) {
  return {
    packId: pack.packId,
    label: pack.label,
    credits: pack.credits,
    priceInr: pack.amountInr,
    pricePaise: pack.amountPaise,
    perCreditInr: perCreditInr(pack),
    featured: pack.featured,
  };
}

export function packViews() {
  return CREDIT_PACKS.map(packView);
}
