import { learningRecord } from '@/lib/server/learning';
import { learningHttp } from '@/lib/server/learningHttp';
export const GET = request => learningHttp(request, userId => {
  const url = new URL(request.url);
  return learningRecord(userId, { subject: url.searchParams.get('subject'), minutes: Number(url.searchParams.get('minutes')) });
});
