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
import { TEST_MODES, resolveCount } from '@/../data/test_modes';

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

  const quote = buildPracticeQuote({
    user: { id: user.id, isPremium: user.isPremium === true, premiumUntil: user.premiumUntil, creditBalance: user.creditBalance },
    subject, mode: modeId, count: requested, purpose, inventory, allowance, token: randomUUID(),
  });
  return Response.json({ ...quote, offer: publicOffer() }, { headers });
}
