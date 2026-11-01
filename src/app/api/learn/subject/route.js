import { learnHttp } from '@/lib/server/learnHttp';
// GET /api/learn/subject?subject=: Learn home (docs/brain/learn-1031/API-CONTRACT.md).
export const dynamic = 'force-dynamic';
export async function GET(request) {
  return learnHttp(request, (learn, userId, _body, url) => learn.subject(userId, url.searchParams), { pure: true });
}
