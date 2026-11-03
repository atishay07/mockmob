import { learningHttp } from '@/lib/server/learningHttp';
import { getStudyPreferences, saveStudyPreferences } from '@/lib/server/study';
export const GET = request => learningHttp(request,userId=>getStudyPreferences(userId));
export const PUT = request => learningHttp(request,(userId,input)=>saveStudyPreferences(userId,input),true);
