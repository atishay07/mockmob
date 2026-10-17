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

export function feedOptions(raw) {
  const rows=Array.isArray(raw)?raw:Object.entries(raw||{}).map(([key,text])=>({key,text}));
  return rows.map((option,index)=>typeof option==='string'?{key:'ABCD'[index],text:option}:{...option,key:option?.key??'ABCD'[index],text:String(option?.text??option?.label??option?.value??'')});
}

// GET /api/questions/explore needs no sign-in, so each row leaves the server in this public shape only.
// Never the answer key or the explanation (nothing has been attempted yet), never contributor ids,
// provenance, evidence, moderation or AI scores, content hashes, exposure counters or ranking internals.
export function publicExploreOptions(raw) {
  return feedOptions(raw).map((option) => ({ key: option.key == null ? null : String(option.key), text: option.text }));
}

export function exploreRowOut(row, userVote = null) {
  const q = row?.questions || {};
  return {
    question_id: row?.question_id ?? q.id ?? null,
    rank_score: row?.rank_score ?? null,
    exploration_lane: row?.exploration_lane ?? null,
    questions: {
      id: q.id ?? row?.question_id ?? null,
      subject: q.subject ?? null,
      chapter: q.chapter ?? null,
      difficulty: q.difficulty ?? null,
      body: q.question ?? q.body ?? '',
      options: publicExploreOptions(q.options),
      passage_text: q.passage_text || null,
      passage_group_id: q.passage_group_id || q.passage_id || null,
      order_index: q.order_index ?? null,
      tags: Array.isArray(q.tags) ? q.tags : [],
      upvotes: Number(q.upvotes) || 0,
      downvotes: Number(q.downvotes) || 0,
      score: Number(q.score) || 0,
      userVote: userVote || null,
    },
  };
}
