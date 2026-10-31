import { learnHttp } from '@/lib/server/learnHttp';
// POST /api/learn/runs/preview { chapterKey, minutes, leaveOut, addNext? }: the chapter page's dry run. Writes nothing.
export const dynamic = 'force-dynamic';
export async function POST(request) {
  return learnHttp(request, (learn, userId, body) => learn.preview(userId, body), { write: true });
}
