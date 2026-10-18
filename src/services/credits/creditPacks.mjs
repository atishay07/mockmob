// The credit packs: ONE set, usable for everything (owner D78, 18 Oct 2026: "one credits option that can do multiple things").
// Pure, so the page, the routes, the webhook and the tests read the same list. The server always prices an order from here,
// never from the client. A purchase is granted through the AI purchase grant path (mm_ai_grant_bonus_credits) into the held balance.
//
// LEGACY_PACKS are the three AI top-up packs that existed before; they can no longer be ordered but a payment already taken for one
// must still verify and settle, so they stay recognised by plan id.

const make = (d) => Object.freeze({
  ...d,
  key: d.packId,
  planId: d.packId,
  amountPaise: d.amountInr * 100,
  label: `${d.credits} credits`,
  featured: Boolean(d.featured),
});

export const CREDIT_PACKS = Object.freeze([
  make({ packId: 'credits_10_50', amountInr: 10, credits: 50 }),
  make({ packId: 'credits_29_150', amountInr: 29, credits: 150 }),
  make({ packId: 'credits_49_300', amountInr: 49, credits: 300, featured: true }),
]);

export const LEGACY_PACKS = Object.freeze([
  Object.freeze({ packId: 'ai_credits_prepos_10_50', key: 'prepos_10_50', planId: 'ai_credits_prepos_10_50', amountInr: 10, amountPaise: 1000, credits: 50, label: '50 credits', featured: false, legacy: true }),
  Object.freeze({ packId: 'ai_credits_prepos_20_150', key: 'prepos_20_150', planId: 'ai_credits_prepos_20_150', amountInr: 20, amountPaise: 2000, credits: 150, label: '150 credits', featured: false, legacy: true }),
  Object.freeze({ packId: 'ai_credits_prepos_50_400', key: 'prepos_50_400', planId: 'ai_credits_prepos_50_400', amountInr: 50, amountPaise: 5000, credits: 400, label: '400 credits', featured: false, legacy: true }),
]);

/** A pack that can be ordered now, by its id. Null for anything else (including a retired pack). */
export function getCreditPack(id) {
  const v = String(id ?? '').trim();
  return v ? CREDIT_PACKS.find((p) => p.packId === v) || null : null;
}

/** The pack behind a stored payment's plan id, current or retired (verify and the webhook). Null when it is not a credit pack. */
export function getCreditPackByPlanId(planId) {
  const v = String(planId ?? '').trim();
  return v ? [...CREDIT_PACKS, ...LEGACY_PACKS].find((p) => p.planId === v || p.key === v) || null : null;
}
