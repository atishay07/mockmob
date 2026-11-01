import { learnHttp } from '@/lib/server/learnHttp';
// GET /api/learn/runs/:id/end: the end screen; ends the run once (a second read gives the same numbers), unless ?stop=1.
export const dynamic = 'force-dynamic';
export async function GET(request, { params }) {
  const { id } = await params;
  // ?stop=1: the student stopped part way; the run stays open to pick up today (R2 ruling 6).
  const stop = new URL(request.url).searchParams.get('stop') === '1';
  return learnHttp(request, (learn, userId) => learn.end(userId, id, { stop }));
}
