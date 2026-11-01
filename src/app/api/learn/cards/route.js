import { learnHttp } from '@/lib/server/learnHttp';
// GET /api/learn/cards?chapter=&filter= (one chapter) or ?subject=&filter= (Find's shelf in one request).
export const dynamic = 'force-dynamic';
export async function GET(request) {
  return learnHttp(request, (learn, userId, _body, url) => learn.cards(userId, url.searchParams), { pure: true });
}
