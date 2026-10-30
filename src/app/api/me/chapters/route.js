import { keycardsHttp } from '@/lib/server/keycardsHttp';
// GET /api/me/chapters?subject=: chapter state for each chapter of the student's units (data/chapter_state.js).
export const dynamic = 'force-dynamic';
export const GET = (request) => keycardsHttp(request, (kc, userId, _body, url) => kc.chapters(userId, url.searchParams.get('subject')));
