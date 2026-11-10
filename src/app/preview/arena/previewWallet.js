// Development-only fixture for the Wallet page (/preview/arena?view=wallet). Builds the GET /api/wallet body from the real
// pack catalog with illustrative balances, so the page, the pack rows and the closed/open key can be seen with no real read.
//   ?commerce=open        the keys say "Add for" (the checkout itself is a preview-only 418, nothing is ordered)
//   ?wallet=down          the whole read fails (Try again)    ?wallet=zero      the balance is 0
//   ?wallet=unknown|low|loading                               ?history=down|empty
//   ?wallet=after&commerce=open                              in-memory checkout and verification only
//   ?plan=pro             Pro: one line says practice is included, no Pro row
//   ?offer=monthly        the bridge to Pro names the monthly price (pro_monthly_99), as the live site sells it
import { packViews } from '@/lib/wallet/walletPacks.mjs';
import { ONE_CREDIT_LINE } from '@/lib/creditCopy.mjs';

const at = (daysAgo, h, m) => new Date(Date.UTC(2026, 9, 18 - daysAgo, h, m)).toISOString();

export const previewWalletCheckout = {
  loadCheckout: async () => {},
  openCheckout(config) {
    window.setTimeout(() => {
      config.handler({ razorpay_order_id: config.order_id, razorpay_payment_id: 'fixture-payment', razorpay_signature: 'fixture-signature' });
      config.modal.ondismiss();
    }, 350);
  },
};

export function previewWalletAdded(fixture) {
  return fixture.get('wallet') === 'after' ? window.__previewWalletAdded || 0 : 0;
}

export function previewWallet(url, method, init, fixture, json) {
  if (!['/api/wallet', '/api/wallet/order', '/api/wallet/verify'].includes(url.pathname)) return null;
  const open = fixture.get('commerce') === 'open';
  const packs = packViews();
  if (url.pathname === '/api/wallet/order' || url.pathname === '/api/wallet/verify') {
    if (method !== 'POST') return null;
    if (fixture.get('wallet') !== 'after' || !open) return json({ error: 'Preview only: no order was created and nothing was charged.' }, 418);
    if (url.pathname === '/api/wallet/order') {
      const pack = packs.find((item) => item.packId === JSON.parse(init.body || '{}').packId);
      if (!pack) return json({ ok: false }, 400);
      window.__previewWalletOrder = pack;
      return json({ keyId: 'fixture', order: { id: 'fixture-order', amount: pack.pricePaise }, pack });
    }
    const pack = window.__previewWalletOrder;
    if (!pack) return json({ ok: false }, 400);
    window.__previewWalletOrder = null;
    window.__previewWalletAdded = (window.__previewWalletAdded || 0) + pack.credits;
    return json({ ok: true, granted: pack.credits });
  }
  if (url.pathname !== '/api/wallet' || method !== 'GET') return null;
  if (fixture.get('wallet') === 'down') return json({ error: 'unavailable', message: 'Your wallet could not be loaded. Try again shortly.' }, 503);
  if (fixture.get('wallet') === 'loading') return new Promise(() => {});
  const pro = fixture.get('plan') === 'pro';
  const zero = fixture.get('wallet') === 'zero';
  const low = fixture.get('wallet') === 'low';
  const unknown = fixture.get('wallet') === 'unknown';
  const added = previewWalletAdded(fixture);
  const freeLeft = zero ? 0 : low ? 8 : 38;
  const balance = zero || low || pro ? 0 : 40;
  const bonus = zero || low ? 0 : 30 + added;
  const held = balance + bonus;
  const total = freeLeft + held;
  const credits = unknown
    ? { total: null, freeLeft: null, freeAllowance: null, held: null, resetAt: null, renewsOn: null, parts: { included: null, bonus: null, balance: null }, label: 'Credits', buys: ONE_CREDIT_LINE }
    : { total, freeLeft, freeAllowance: 50, held, resetAt: '2026-10-31T18:30:00.000Z', renewsOn: '2026-11-01', parts: { included: freeLeft, bonus, balance }, label: 'Credits', buys: ONE_CREDIT_LINE };
  const fullRows = [
    ...(added ? [{ at: at(0, 10, 30), pool: 'ai', what: 'Credits added', delta: added }] : []),
    { at: at(0, 9, 40), pool: 'practice', what: 'Practice set', delta: -10 },
    { at: at(0, 7, 5), pool: 'ai', what: 'Repair, Q2 Accountancy', delta: -1 },
    { at: at(1, 14, 30), pool: 'ai', what: 'Ask Mobi', delta: -1 },
    { at: at(2, 11, 15), pool: 'practice', what: 'Full mock', delta: -50 },
    { at: at(3, 18, 0), pool: 'ai', what: 'Credits added', delta: 50 },
    { at: at(9, 0, 0), pool: 'ai', what: 'Free credits for the month', delta: 50 },
  ];
  // A balance of 0 reads back to a believable start: the free credits came in and a full mock spent them.
  const rows = zero || low
    ? [{ at: at(0, 9, 40), pool: 'practice', what: zero ? 'Full mock' : 'Practice sets', delta: freeLeft - 50 }, { at: at(9, 0, 0), pool: 'ai', what: 'Free credits for the month', delta: 50 }]
    : fullRows;
  let running = total;
  const history = fixture.get('history') === 'down' ? null : fixture.get('history') === 'empty' ? [] : rows.map((r) => { const line = { ...r, balanceAfter: unknown ? null : running }; running -= r.delta; return line; });
  return json({
    ok: true,
    credits,
    plan: { name: pro ? 'Pro' : 'Free', until: pro ? '2027-07-31' : null },
    proOffer: pro ? null : fixture.get('offer') === 'monthly' ? { rupees: 99, expires: null, planId: 'pro_monthly_99' } : { rupees: 99, expires: '31 July 2027', planId: 'pro_cuet_2027' },
    packs,
    commerce: { open, message: open ? null : 'Top-ups open soon.' },
    history,
    historyState: history ? 'ready' : 'unavailable',
  });
}
