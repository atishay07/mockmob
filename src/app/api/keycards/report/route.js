import { keycardsHttp } from '@/lib/server/keycardsHttp';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
// POST /api/keycards/report { cardId, reason }: every report is stored; a card leaves the decks for everyone only when enough
// established reporters count for it (src/lib/server/keycards.js, L2).
export const dynamic = 'force-dynamic';

// L2 (15 Nov 2026): one student sends at most REPORTS_A_DAY reports a day. The database limiter in production whatever
// PERSISTENT_LIMITS_ENABLED says (it is unset there), the in-memory one if the database cannot answer.
const REPORTS_A_DAY = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

export const POST = (request) => keycardsHttp(request, (kc, userId, body) => kc.report(userId, body, {
  take: async () => (await checkPersistentRateLimit(request, {
    route: '/api/keycards/report:day', limit: REPORTS_A_DAY, windowMs: DAY_MS, identityOnly: true, keyParts: [userId],
    persistent: process.env.NODE_ENV === 'production', fallback: 'memory',
  })).allowed,
}), { write: true });
