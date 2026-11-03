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
