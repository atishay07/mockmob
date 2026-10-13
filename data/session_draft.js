export const SUBMISSION_GRACE_MS = 120000;
export function resumableDraft(saved, {generationKey, sessionId, now=Date.now()}={}) {
  if(!saved?.selectionMeta?.sessionId || !Array.isArray(saved.questions) || !saved.questions.length || saved.questions.length>50 || !Number.isFinite(saved.endsAt))return false;
  if(sessionId ? saved.selectionMeta.sessionId!==sessionId : saved.generationKey!==generationKey)return false;
  return saved.endsAt>now || (saved.pendingSubmission===true && saved.endsAt+SUBMISSION_GRACE_MS>now);
}
export function clearStudyDrafts(storage, userId) {
  if(!userId)return;
  const prefix=`mm:test:${userId}:`;
  for(let i=storage.length-1;i>=0;i--){const key=storage.key(i);if(key?.startsWith(prefix))storage.removeItem(key);}
}
/**
 * What a session's saved events say the student did: the answers they hold now, the questions they
 * have marked for review (the latest mark event per question wins) and every question they visited,
 * answered or marked. A session resumed from the server (new device, cleared storage) rebuilds the
 * runner from this, so a mark for review survives exactly as an answer does.
 */
export function progressFromEvents(events = [], questions = []) {
  const ids = new Set(questions.map(question => question.id));
  const answers = {}; const marked = {}; const touched = new Set();
  for (const event of Array.isArray(events) ? events : []) {
    if (!event || !ids.has(event.qid)) continue;
    touched.add(event.qid);
    if (event.type === 'answer') { if (event.answer === null || event.answer === undefined) delete answers[event.qid]; else answers[event.qid] = event.answer; }
    else if (event.type === 'mark') { if (event.marked === true) marked[event.qid] = true; else delete marked[event.qid]; }
  }
  return { answers, marked, touched: [...touched] };
}
