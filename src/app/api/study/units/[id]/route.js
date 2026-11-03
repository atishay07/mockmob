import { learningHttp } from '@/lib/server/learningHttp';
import { studyUnit } from '@/lib/server/study';
export async function GET(request,{params}) { const {id}=await params;return learningHttp(request,userId=>studyUnit(userId,id)); }
