import { learnHttp } from '@/lib/server/learnHttp';
// GET /api/learn/home?subject=: Learn home in one answer, the /subject body plus `shelves`, from one snapshot (speed.md item 3).
// The shell's due badge reads the same answer (src/components/learn2/api.js). /subject and /shelves stay for the app.
export const dynamic = 'force-dynamic';
export async function GET(request) {
  return learnHttp(request, (learn, userId, _body, url) => learn.home(userId, url.searchParams), { pure: true });
}
