import { keycardsHttp } from '@/lib/server/keycardsHttp';
// GET /api/keycards/deck?chapter=<key>: one chapter's deck in book order (Free: taste cards whole, the rest as locked stubs).
export const dynamic = 'force-dynamic';
export const GET = (request) => keycardsHttp(request, (kc, userId, _body, url) => kc.deck(userId, url.searchParams.get('chapter')));
