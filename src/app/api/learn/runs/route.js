import { learnHttp } from '@/lib/server/learnHttp';
// POST /api/learn/runs { chapterKey?, cardIds?, minutes, leaveOut, kind, requestKey, resume?, fresh? }: start, feed start or resume.
export const dynamic = 'force-dynamic';
export async function POST(request) {
  return learnHttp(request, (learn, userId, body) => learn.start(userId, body), { write: true });
}
