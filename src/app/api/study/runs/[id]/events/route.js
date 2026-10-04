import { learningHttp } from '@/lib/server/learningHttp';
import { studyEvent } from '@/lib/server/study';
export async function POST(request,{params}) { const {id}=await params;return learningHttp(request,(userId,input)=>studyEvent(userId,id,input),true); }
