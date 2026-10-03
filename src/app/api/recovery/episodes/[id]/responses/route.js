import { respondEpisode } from '@/lib/server/learning';
import { learningHttp } from '@/lib/server/learningHttp';
export async function POST(request, { params }) {
  const { id } = await params;
  return learningHttp(request, (userId, body) => respondEpisode(userId, id, body), true);
}
