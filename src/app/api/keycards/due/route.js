import { keycardsHttp } from '@/lib/server/keycardsHttp';
// GET /api/keycards/due?limit=20: today's cards (due first, Must-know first, then new cards in book order).
export const dynamic = 'force-dynamic';
export const GET = (request) => keycardsHttp(request, (kc, userId, _body, url) => kc.due(userId, { limit: url.searchParams.get('limit') || 20 }));
