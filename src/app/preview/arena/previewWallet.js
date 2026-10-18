// Development-only fixture for the Wallet page (/preview/arena?view=wallet). Builds the GET /api/wallet body from the real
// pack catalog with illustrative balances, so the page, the pack rows and the closed/open key can be seen with no real read.
//   ?commerce=open        the keys say "Add for" (the checkout itself is a preview-only 418, nothing is ordered)
//   ?wallet=down          the whole read fails (Try again)    ?wallet=zero      the balance is 0
//   ?wallet=unknown       the balance could not be read       ?history=down|empty
//   ?plan=pro             Pro: one line says practice is included, no Pro row
import { packViews } from '@/lib/wallet/walletPacks.mjs';

const at = (daysAgo, h, m) => new Date(Date.UTC(2026, 9, 18 - daysAgo, h, m)).toISOString();

export function previewWallet(url, method, init, fixture, json) {
  if (url.pathname === '/api/wallet/order' || url.pathname === '/api/wallet/verify') {
    if (method === 'POST') return json({ error: 'Preview only: no order was created and nothing was charged.' }, 418);
  }
  if (url.pathname !== '/api/wallet' || method !== 'GET') return null;
  if (fixture.get('wallet') === 'down') return json({ error: 'unavailable', message: 'Your wallet could not be loaded. Try again shortly.' }, 503);
  const pro = fixture.get('plan') === 'pro';
  const zero = fixture.get('wallet') === 'zero';
  const unknown = fixture.get('wallet') === 'unknown';
  const open = fixture.get('commerce') === 'open';
  const total = zero ? 0 : 108;
  const credits = unknown
    ? { total: null, freeLeft: null, freeAllowance: null, held: null, resetAt: null, renewsOn: null, parts: { included: null, bonus: null, balance: null }, label: 'Credits', buys: '1 credit = 1 question or 1 Ask Mobi reply. A full mock is 50.' }
    : zero
      ? { total: 0, freeLeft: 0, freeAllowance: 50, held: 0, resetAt: '2026-10-31T18:30:00.000Z', renewsOn: '2026-11-01', parts: { included: 0, bonus: 0, balance: 0 }, label: 'Credits', buys: '1 credit = 1 question or 1 Ask Mobi reply. A full mock is 50.' }
      : { total: 108, freeLeft: 38, freeAllowance: 50, held: 70, resetAt: '2026-10-31T18:30:00.000Z', renewsOn: '2026-11-01', parts: { included: 38, bonus: 30, balance: 40 }, label: 'Credits', buys: '1 credit = 1 question or 1 Ask Mobi reply. A full mock is 50.' };
  const fullRows = [
    { at: at(0, 9, 40), pool: 'practice', what: 'Practice set', delta: -10 },
    { at: at(0, 7, 5), pool: 'ai', what: 'Repair, Q2 Accountancy', delta: -1 },
    { at: at(1, 14, 30), pool: 'ai', what: 'Ask Mobi', delta: -1 },
    { at: at(2, 11, 15), pool: 'practice', what: 'Full mock', delta: -50 },
    { at: at(3, 18, 0), pool: 'ai', what: 'Credits added', delta: 150 },
    { at: at(9, 0, 0), pool: 'ai', what: 'Free credits for the month', delta: 50 },
  ];
  // A balance of 0 reads back to a believable start: the free credits came in and a full mock spent them.
  const rows = zero ? [{ at: at(0, 9, 40), pool: 'practice', what: 'Full mock', delta: -50 }, { at: at(9, 0, 0), pool: 'ai', what: 'Free credits for the month', delta: 50 }] : fullRows;
  let running = total;
  const history = fixture.get('history') === 'down' ? null : fixture.get('history') === 'empty' ? [] : rows.map((r) => { const line = { ...r, balanceAfter: unknown ? null : running }; running -= r.delta; return line; });
  return json({
    ok: true,
    credits,
    plan: { name: pro ? 'Pro' : 'Free', until: pro ? '2027-07-31' : null },
    proOffer: pro ? null : { rupees: 99, expires: '31 July 2027', planId: 'pro_cuet_2027' },
    packs: packViews(),
    commerce: { open, message: open ? null : 'Top-ups open soon.' },
    history,
    historyState: history ? 'ready' : 'unavailable',
  });
}
