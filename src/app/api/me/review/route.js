import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { isPaidUser } from '@/services/credits/aiCreditWallet';
import { getUnifiedWallet } from '@/services/credits/unifiedWallet';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { getReview } from '@/lib/server/review';
import { studyRecord } from '@/lib/server/study';
import { istDate } from '@/lib/server/credits';
import { capFrom } from '@/../data/revise';
import { keyCardsEnabled } from '@/lib/server/keycards';
import { keycardsService } from '@/lib/server/keycardsHttp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const NO_STORE = { 'Cache-Control': 'no-store' };

// Review in one read (LEARN-REVIEW-1017, packet P-LR0; src/lib/server/review.js): the student's papers, every mistake across
// them with its paper, its time and its saved repair, the receipt (found, repaired, retested, still right), what Revise has
// due today and the chapters priced in marks. READ-ONLY: it seeds no Revise cards, writes no ledger row and spends nothing.
// It never carries an answer key, an option or an explanation. `?cap=5` sets Revise's daily cap to 5 (default 10).
// A failed read of the papers or of the saved repairs answers 503 { state: 'unavailable' }, never the empty state.
export async function GET(request) {
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized', message: 'Please sign in.' }, { status: 401, headers: NO_STORE });
  if (!(await checkPersistentRateLimit(request, { route: '/api/me/review', limit: 60, keyParts: [session.user.id], fallback: 'memory' })).allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { ...NO_STORE, 'Retry-After': '30' } });
  }
  const userId = session.user.id;
  try {
    const cap = capFrom(new URL(request.url).searchParams.get('cap'));
    // The wallet and the lesson cards are best effort: unknown is null, never zero.
    const wallet = await Database.getUserById(userId).then(async (user) => {
      if (!user) return null;
      // One credits balance (18 Oct 2026, D78): AI and practice prices read the same one total.
      const credits = await getUnifiedWallet(user);
      const known = Boolean(credits?.known) && Number.isFinite(Number(credits.total));
      // A database without the one credits balance migration keeps the two old figures (AI wallet, users.credit_balance).
      const legacy = !known && credits?.wallet?.known && credits.wallet.oneBalance === false;
      if (legacy) {
        const held = Number(user.creditBalance);
        return {
          aiCredits: Math.trunc(Number(credits.wallet.total) || 0),
          aiRenews: credits.wallet.resetAt ? istDate(credits.wallet.resetAt) : null,
          practiceCredits: Number.isFinite(held) ? Math.trunc(held) : null,
          isPremium: isPaidUser(user),
        };
      }
      return {
        aiCredits: known ? Math.trunc(Number(credits.total)) : null,
        aiRenews: known && credits.resetAt ? istDate(credits.resetAt) : null,
        practiceCredits: known ? Math.trunc(Number(credits.total)) : null,
        isPremium: isPaidUser(user),
      };
    }).catch(() => null);
    const out = await getReview(userId, {
      cap, wallet,
      // Lesson cards due today (Revise source 4): none when Concepts is off, unknown (null) when the read fails.
      readDueCards: async () => {
        const record = await studyRecord(userId, { allSubjects: true });
        return record?.state === 'disabled' ? 0 : Number.isFinite(record?.progress?.dueCards) ? record.progress.dueCards : null;
      },
      // Key cards Revise will play today (KEYCARDS-BUILD-SPEC.md 2e): only while KEY_CARDS_ENABLED is on.
      ...(keyCardsEnabled() ? { readKeyCards: async () => (await (await keycardsService()).reviseSource(userId)).items.length } : {}),
    });
    return NextResponse.json(out.body, { status: out.http, headers: NO_STORE });
  } catch (e) {
    console.warn('[api/me/review] GET failed:', e?.code || e?.message);
    return NextResponse.json({ version: 1, state: 'unavailable', message: 'Your mistakes did not load.' }, { status: 503, headers: NO_STORE });
  }
}
