import { learningHttp } from '@/lib/server/learningHttp';
import { getStudyRun } from '@/lib/server/study';
export async function GET(request,{params}) { const {id}=await params;return learningHttp(request,userId=>getStudyRun(userId,id)); }
