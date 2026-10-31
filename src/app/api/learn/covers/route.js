import { learnHttp } from '@/lib/server/learnHttp';
// GET /api/learn/covers?subject=: the Explore covers row (every playable chapter, For you first).
export const dynamic = 'force-dynamic';
export async function GET(request) {
  return learnHttp(request, (learn, userId, _body, url) => learn.covers(userId, url.searchParams));
}
