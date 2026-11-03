import { learningHttp } from '@/lib/server/learningHttp';
import { studyCatalog } from '@/lib/server/study';
export const GET = request => learningHttp(request,userId=>studyCatalog(userId,{subject:new URL(request.url).searchParams.get('subject') || undefined}));
