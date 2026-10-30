import { keycardsHttp } from '@/lib/server/keycardsHttp';
// POST /api/keycards/add { chapter } | { cardIds, from? }: adds cards to the student's Revise schedule.
export const dynamic = 'force-dynamic';
export const POST = (request) => keycardsHttp(request, (kc, userId, body) => kc.add(userId, body), { write: true });
