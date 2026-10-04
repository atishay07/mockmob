import { learningHttp } from '@/lib/server/learningHttp';
import { startStudyRun } from '@/lib/server/study';
export const POST = request => learningHttp(request,(userId,input)=>startStudyRun(userId,input),true);
