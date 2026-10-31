import { learnHttp } from '@/lib/server/learnHttp';
// GET /api/learn/runs/:id/end: the end screen; ends the run once (a second read gives the same numbers).
export const dynamic = 'force-dynamic';
export async function GET(request, { params }) {
  const { id } = await params;
  return learnHttp(request, (learn, userId) => learn.end(userId, id));
}
