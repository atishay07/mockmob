// Untimed discovery helpers. These never score an exam session or qualify recovery.
export function feedWindow(rawLimit, rawOffset) {
  const integer = (value, fallback) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
  return { limit: Math.min(50, Math.max(1, integer(rawLimit ?? 20, 20))), offset: Math.max(0, integer(rawOffset ?? 0, 0)) };
}

export function advanceFeedPage(offset, limit, rawCount) {
  return { nextOffset: offset + rawCount, hasMore: rawCount === limit };
}

export function appendUniqueQuestions(previous, incoming) {
  const ids = new Set(previous.map((q) => q.id));
  return [...previous, ...incoming.filter((q) => q?.id && !ids.has(q.id) && ids.add(q.id))];
}

export function chapterGroups(data) {
  if (data?.grouped) return (data.units || []).map((unit) => ({ name: unit.name, chapters: unit.chapters || [] }));
  return [{ name: 'Chapters', chapters: Array.isArray(data) ? data : data?.chapters || [] }];
}

export function questionFeedback(question, selectedKey) {
  const options = feedOptions(question.options);
  const correct = question.correct_answer == null ? null : options.find((option) => option.key != null && String(option.key) === String(question.correct_answer));
  if (!correct) return { state: 'unavailable', correctKey: null };
  if (selectedKey == null) return { state: 'revealed', correctKey: correct.key };
  return { state: String(selectedKey) === String(correct.key) ? 'correct' : 'incorrect', correctKey: correct.key };
}

// What the answer endpoint sends once a student has answered: the verdict, the key and the explanation. selectedKey null is
// "show me the answer". Built on questionFeedback so the server and a client holding the key can never disagree.
export function gradeFeedAnswer(question, selectedKey) {
  const options = feedOptions(question?.options);
  if (selectedKey != null && !options.some((option) => option.key != null && String(option.key) === String(selectedKey))) return { state: 'invalid', correctKey: null, explanation: null };
  const feedback = questionFeedback(question || {}, selectedKey);
  if (feedback.state === 'unavailable') return { state: 'unavailable', correctKey: null, explanation: null };
  const raw = question.explanation;
  const explanation = typeof raw === 'string' ? raw : typeof raw?.text === 'string' ? raw.text : null;
  return { state: feedback.state, correctKey: feedback.correctKey, explanation: explanation && explanation.trim() ? explanation : null };
}

// The feed's public shape of an option: the key and the text, nothing else a stored option might carry.
export function feedPublicOptions(raw) {
  return feedOptions(raw).map((option) => ({ key: option.key, text: option.text }));
}

export function feedOptions(raw) {
  const rows=Array.isArray(raw)?raw:Object.entries(raw||{}).map(([key,text])=>({key,text}));
  return rows.map((option,index)=>typeof option==='string'?{key:'ABCD'[index],text:option}:{...option,key:option?.key??'ABCD'[index],text:String(option?.text??option?.label??option?.value??'')});
}
