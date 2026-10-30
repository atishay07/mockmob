import { keycardsHttp } from '@/lib/server/keycardsHttp';
// GET /api/keycards/line?questionId=: "The line you needed" for a question the student answered.
export const dynamic = 'force-dynamic';
export const GET = (request) => keycardsHttp(request, (kc, userId, _body, url) => kc.line(userId, url.searchParams.get('questionId')));
