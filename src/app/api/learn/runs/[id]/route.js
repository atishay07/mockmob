import { learnHttp } from '@/lib/server/learnHttp';
// GET /api/learn/runs/:id: a reload or the app reopening a run (only the items not done). Ended: 409 RUN_ENDED.
export const dynamic = 'force-dynamic';
export async function GET(request, { params }) {
  const { id } = await params;
  return learnHttp(request, (learn, userId) => learn.getRun(userId, id));
}
