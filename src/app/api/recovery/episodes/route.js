import { startEpisode } from '@/lib/server/learning';
import { learningHttp } from '@/lib/server/learningHttp';
export const POST = request => learningHttp(request, startEpisode, true);
