// Development-only fixture for the Wallet page (/preview/arena?view=wallet). Builds the GET /api/wallet body from the real
// pack catalog with illustrative balances, so the page, the pack rows and the closed/open key can be seen with no real read.
//   ?commerce=open        the keys say "Add for" (the checkout itself is a preview-only 418, nothing is ordered)
//   ?wallet=down          the whole read fails (Try again)    ?wallet=zero      both balances 0
//   ?wallet=unknown       the AI wallet could not be read     ?history=down|empty
//   ?plan=pro             Pro: practice is included, no practice packs
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
  const practice = zero ? 0 : 40;
  const history = fixture.get('history') === 'down' ? null : fixture.get('history') === 'empty' ? [] : [
    { at: at(0, 9, 40), pool: 'practice', what: 'Practice set', delta: -10, balanceAfter: practice },
    { at: at(0, 7, 5), pool: 'ai', what: 'Repair, Q2 Accountancy', delta: -1, balanceAfter: zero ? 0 : 68 },
    { at: at(1, 14, 30), pool: 'ai', what: 'Ask Mobi', delta: -1, balanceAfter: zero ? 1 : 69 },
    { at: at(2, 11, 15), pool: 'practice', what: 'Full mock', delta: -50, balanceAfter: practice + 10 },
    { at: at(3, 18, 0), pool: 'practice', what: 'Practice credits added', delta: 100, balanceAfter: practice + 60 },
    { at: at(5, 4, 30), pool: 'ai', what: 'AI credits added', delta: 150, balanceAfter: zero ? 2 : 70 },
    { at: at(9, 0, 0), pool: 'ai', what: 'Monthly AI credits', delta: 50, balanceAfter: zero ? 0 : 38 },
  ];
  return json({
    ok: true,
    practice: { balance: practice, unlimited: pro, approxQuestions: practice, perQuestion: 1, fullMock: 50, label: 'Practice credits', renewsOn: null },
    ai: unknown
      ? { balance: null, includedRemaining: null, includedMonthly: null, boughtBalance: null, renewsOn: null, resetAt: null, state: 'error', label: 'AI credits' }
      : zero
        ? { balance: 0, includedRemaining: 0, includedMonthly: 50, boughtBalance: 0, renewsOn: '2026-11-01', resetAt: '2026-10-31T18:30:00.000Z', state: 'empty', label: 'AI credits' }
        : { balance: 68, includedRemaining: 38, includedMonthly: 50, boughtBalance: 30, renewsOn: '2026-11-01', resetAt: '2026-10-31T18:30:00.000Z', state: 'available', label: 'AI credits' },
    plan: { name: pro ? 'Pro' : 'Free', until: pro ? '2027-07-31' : null },
    proOffer: pro ? null : { rupees: 99, expires: '31 July 2027', planId: 'pro_cuet_2027' },
    packs: packViews(),
    commerce: { open, message: open ? null : 'Top-ups open soon.' },
    history,
    historyState: history ? 'ready' : 'unavailable',
  });
}
