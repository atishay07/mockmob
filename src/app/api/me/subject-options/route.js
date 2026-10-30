import { keycardsHttp } from '@/lib/server/keycardsHttp';
// PUT /api/me/subject-options { subject, option }: the student's section or part for Mathematics, Computer Science, Accountancy.
export const dynamic = 'force-dynamic';
export const PUT = (request) => keycardsHttp(request, (kc, userId, body) => kc.putOption(userId, body), { write: true });
