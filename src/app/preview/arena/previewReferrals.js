// Development-only fixture for friend invites (U15, 15 Nov 2026): GET /api/referrals answered in the shape the live route builds
// (src/lib/server/referrals.js referralBody), so the "Bring a friend" card on You and Wallet can be seen as production answers it.
//   ?referrals=fresh      a new code, nobody on the link yet (the default: a brand-new account's state)
//   ?referrals=some       two friends joined, one practised and paid, 100 credits earned
//   ?referrals=cap        this month's cap reached        ?referrals=paused   rewards on a short break
//   ?referrals=invited    this student came in on a friend's link and has not practised yet
//   ?referrals=off        the switch is off (live: false): the card is not shown
//   ?referrals=down       the read fails (the card's own "did not load" line)
import { DEFAULT_MONTHLY_CAP, DEFAULT_REWARD, referralLink } from '@/lib/referrals/friendInvite.mjs';

// A code in the route's alphabet (REFERRAL_CODE_RE: 7 of 0-9 and A-Z without I, L, O, U). Illustrative, never a real code.
const CODE = 'K7M2Q9X';

export function previewReferrals(url, method, fixture, json) {
  if (url.pathname !== '/api/referrals' || method !== 'GET') return null;
  const kind = fixture.get('referrals') || 'fresh';
  if (kind === 'down') return json({ error: 'unavailable', message: 'Your invites could not be loaded.' }, 503);
  if (kind === 'off') return json({ ok: true, live: false });
  const some = kind === 'some' || kind === 'cap';
  return json({
    ok: true,
    live: true,
    code: CODE,
    link: referralLink(CODE),
    reward: DEFAULT_REWARD,
    monthlyCap: DEFAULT_MONTHLY_CAP,
    paused: kind === 'paused',
    joined: kind === 'cap' ? DEFAULT_MONTHLY_CAP : some ? 2 : 0,
    practised: kind === 'cap' ? DEFAULT_MONTHLY_CAP : some ? 1 : 0,
    rewarded: kind === 'cap' ? DEFAULT_MONTHLY_CAP : some ? 1 : 0,
    notCounted: 0,
    earned: kind === 'cap' ? DEFAULT_MONTHLY_CAP * DEFAULT_REWARD : some ? DEFAULT_REWARD : 0,
    rewardedThisMonth: kind === 'cap' ? DEFAULT_MONTHLY_CAP : some ? 1 : 0,
    capReached: kind === 'cap',
    invited: kind === 'invited' ? { state: 'joined', rewarded: false } : null,
  });
}
