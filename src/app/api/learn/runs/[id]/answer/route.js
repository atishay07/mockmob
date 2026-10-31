import { learnHttp } from '@/lib/server/learnHttp';
// POST /api/learn/runs/:id/answer { itemId, choice }: graded on the server; a replay answers the first answer.
export const dynamic = 'force-dynamic';
export async function POST(request, { params }) {
  const { id } = await params;
  return learnHttp(request, (learn, userId, body) => learn.answer(userId, id, body), { write: true });
}
