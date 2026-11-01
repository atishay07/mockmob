import { learnHttp } from '@/lib/server/learnHttp';
// GET /api/learn/search?subject=&q=: chapters, lessons and cards; a locked card is a stub, never its words.
export const dynamic = 'force-dynamic';
export async function GET(request) {
  return learnHttp(request, (learn, userId, _body, url) => learn.search(userId, url.searchParams), { pure: true });
}
