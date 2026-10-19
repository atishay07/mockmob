import { randomUUID } from 'node:crypto';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { supabaseAdmin } from '@/lib/supabase';
import { publicInventory } from '@/lib/server/inventory';
import { durableLearningEnabled } from '@/lib/server/learning';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { allowancePeriod } from '@/../data/learning_engine';
import { allowanceKindFor, buildPracticeQuote } from '@/../data/practice_quote';
import { resolveSubject } from '@/../data/subject_registry';
import { publicOffer } from '@/lib/payments/offer';
import { actionFromHref } from '@/lib/server/actionFields';
import { TEST_MODES, resolveCount } from '@/../data/test_modes';
import { getUnifiedWallet } from '@/services/credits/unifiedWallet';
import { normalizeSubjectSelection } from '@/../data/cuet_controls';
import { firstFullMockFor } from '@/lib/server/firstFullMock';
import { firstFullMockEnabled } from '@/../data/first_full_mock';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Read-only launch quote: never charges, reserves or creates a session.
export async function GET(request) {
  const headers = { 'Cache-Control': 'no-store' };
  const session = await auth(request);
  if (!session?.user?.id) return Response.json({ state: 'unavailable', reasonCode: 'unauthenticated', reason: 'Sign in to start practice.' }, { status: 401, headers });
  if (!(await checkPersistentRateLimit(request, { route: '/api/practice/quote', limit: 120, keyParts: [session.user.id] })).allowed) {
    return Response.json({ state: 'unavailable', reasonCode: 'rate_limited', reason: 'Too many checks. Wait a moment and try again.' }, { status: 429, headers });
  }

  const url = new URL(request.url);
  const subject = url.searchParams.get('subject') || '';
  const modeId = url.searchParams.get('mode') || 'quick';
  const purpose = ['baseline', 'full_sample'].includes(url.searchParams.get('purpose')) ? url.searchParams.get('purpose') : 'ordinary';
  const requested = Number(url.searchParams.get('count')) || 10;

  const user = await Database.getUserById(session.user.id).catch(() => null);
  if (!user) return Response.json({ state: 'unavailable', reasonCode: 'user_unavailable', reason: 'Your account could not be read. Nothing was charged. Try again.' }, { status: 503, headers });

  let inventory;
  try { inventory = await publicInventory(); } catch { inventory = { state: 'unavailable' }; }

  const allowance = { enabled: durableLearningEnabled(), used: null };
  const mode = TEST_MODES[modeId];
  const resolved = resolveSubject(subject);
  if (allowance.enabled && mode && resolved.launch) {
    const count = resolveCount(mode, Math.max(5, Math.min(50, requested)));
    const kind = allowanceKindFor({ isPremium: user.isPremium === true, modeId, count, purpose, subjectId: resolved.id });
    if (kind) {
      const { data, error } = await supabaseAdmin().from('learning_allowances').select('kind')
        .eq('user_id', user.id).eq('kind', kind).eq('period', allowancePeriod(kind, Date.now())).maybeSingle();
      allowance.used = error ? null : Boolean(data);
    }
  }

  // The first full mock in each subject is free (data/first_full_mock.js): read for every Free quote in a launch subject, so the
  // Practice screen can say so on the Full mock tile whichever mode is chosen. The start route reads the same facts the same
  // way (src/lib/server/practiceSessions.js), so the quote and the start agree. A failed read is 'unknown': priced as before.
  const internalSubject = normalizeSubjectSelection({ subject }).internalSubject;
  // The kill switch (FIRST_FULL_MOCK_ENABLED=false): nothing is read and the quote carries no rule field, so every client prices
  // a Full mock as before the rule.
  const firstFullMock = firstFullMockEnabled() && user.isPremium !== true && resolved.launch && internalSubject
    ? firstFullMockFor(supabaseAdmin(), { userId: user.id, subject: internalSubject }).catch(() => 'unknown')
    : null;

  // One credits balance (18 Oct 2026): "can afford" is this month's free credits + bought/held credits, the same total
  // spend_credits takes from. If the wallet cannot be read, users.credit_balance alone is a safe lower bound.
  const [credits, firstFullMockState] = await Promise.all([getUnifiedWallet(user).catch(() => null), firstFullMock]);
  const creditBalance = credits?.known ? credits.total : user.creditBalance;
  const quote = buildPracticeQuote({
    user: { id: user.id, isPremium: user.isPremium === true, premiumUntil: user.premiumUntil, creditBalance },
    subject, mode: modeId, count: requested, purpose, inventory, allowance, firstFullMock: firstFullMockState, token: randomUUID(),
  });
  const upgrade = typeof quote.upgradeHref === 'string' ? { upgradeAction: actionFromHref(quote.upgradeHref) } : {};
  return Response.json({ ...quote, ...upgrade, offer: publicOffer() }, { headers });
}
