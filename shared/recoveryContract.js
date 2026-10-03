export const LAUNCH_SUBJECTS = [
  { id:'english', label:'English' }, {id:'accountancy',label:'Accountancy'},
  {id:'business_studies',label:'Business Studies'}, {id:'economics',label:'Economics'},
];
export function publicSessionView(row) {
  return { id:row.id, expiresAt:row.expires_at, startedAt:row.created_at, serverNow:Date.now(), state:row.state,
    questions:row.questions.map(q=>({id:q.id,subject:q.subject,chapter:q.chapter,
      question:q.question || q.body || q.text,body:q.body || q.question || q.text,
      options:q.options.map((o,i)=>({key:o?.key || 'ABCD'[i],text:typeof o==='string'?o:o.text})),
      passageText:q.passageText,passageGroupId:q.passageGroupId,difficulty:q.difficulty})),
    meta:{sessionId:row.id,mode:row.mode,requestedCount:row.questions.length,
      learningPurpose:row.selection_meta?.learningPurpose || 'ordinary_practice',
      contentEvidence:row.selection_meta?.contentEvidence || 'unclassified',
      ...(row.selection_meta?.episodeId ? {episodeId:row.selection_meta.episodeId} : {}),
      ...(row.selection_meta?.recoveryFrom ? {recoveryFrom:row.selection_meta.recoveryFrom,freshQuestionFamilies:row.selection_meta.freshQuestionFamilies===true} : {})} };
}
export function createRecoveryApi({baseUrl='',getToken=async()=>null,fetcher=globalThis.fetch}) {
  return async function request(path,{method='GET',body}={}) {
    const token=await getToken();
    const response=await fetcher(`${baseUrl}${path}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const data=await response.json();
    if(!response.ok) { const error=new Error(data.error || data.message || 'REQUEST_FAILED');error.status=response.status;throw error; }
    return data;
  };
}
