import { learnHttp } from '@/lib/server/learnHttp';
// GET /api/learn/shelves?subject=: Find's shelves and the all-subject due count.
export const dynamic = 'force-dynamic';
export async function GET(request) {
  return learnHttp(request, (learn, userId, _body, url) => learn.shelves(userId, url.searchParams), { pure: true });
}
