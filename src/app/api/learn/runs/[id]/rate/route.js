import { learnHttp } from '@/lib/server/learnHttp';
// POST /api/learn/runs/:id/rate { itemId, rating: 1|3|4 } or { itemId, keep: true } (the feed's Keep).
export const dynamic = 'force-dynamic';
export async function POST(request, { params }) {
  const { id } = await params;
  return learnHttp(request, (learn, userId, body) => learn.rate(userId, id, body), { write: true });
}
