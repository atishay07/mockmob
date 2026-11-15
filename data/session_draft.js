export const SUBMISSION_GRACE_MS = 120000;
/** Is this saved draft the paper the address names (by its session id, else its generation key)? */
export function draftMatches(saved, {generationKey, sessionId}={}) {
  if(!saved?.selectionMeta?.sessionId || !Array.isArray(saved.questions) || !saved.questions.length || saved.questions.length>50 || !Number.isFinite(saved.endsAt))return false;
  return sessionId ? saved.selectionMeta.sessionId===sessionId : !!generationKey && saved.generationKey===generationKey;
}
/**
 * A draft reopens while its paper can still be sent: before the deadline and through the server's upload grace after it,
 * whether or not a submit was already tried (15 Nov B1). Reopened past the deadline, the runner's time-up submits these
 * answers; before this rule a reload just after time-up threw them away and the paper was submitted empty.
 */
export function resumableDraft(saved, {generationKey, sessionId, now=Date.now()}={}) {
  if(!draftMatches(saved,{generationKey,sessionId}))return false;
  return saved.endsAt+SUBMISSION_GRACE_MS>now;
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
