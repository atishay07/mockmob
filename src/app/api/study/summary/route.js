import {learningHttp} from '@/lib/server/learningHttp';
import {studyChapterSummary} from '@/lib/server/study';
export const GET=request=>{
  const params=new URL(request.url).searchParams;
  return learningHttp(request,userId=>studyChapterSummary(userId,params.get('subject'),params.get('chapter')));
};
