import { keycardsHttp } from '@/lib/server/keycardsHttp';
// POST /api/keycards/report { cardId, reason }: three distinct reports suspend a card for everyone until it is reviewed.
export const dynamic = 'force-dynamic';
export const POST = (request) => keycardsHttp(request, (kc, userId, body) => kc.report(userId, body), { write: true });
