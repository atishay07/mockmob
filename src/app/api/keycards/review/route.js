import { keycardsHttp } from '@/lib/server/keycardsHttp';
// POST /api/keycards/review { cardId, rating: 1|3|4, mode, clientReviewedAt? }: one review; a replay is idempotent.
export const dynamic = 'force-dynamic';
export const POST = (request) => keycardsHttp(request, (kc, userId, body) => kc.review(userId, body), { write: true });
