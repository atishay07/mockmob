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
  const options = Array.isArray(question.options) ? question.options : [];
  const correct = question.correct_answer == null ? null : options.find((option) => option.key != null && String(option.key) === String(question.correct_answer));
  if (!correct) return { state: 'unavailable', correctKey: null };
  if (selectedKey == null) return { state: 'revealed', correctKey: correct.key };
  return { state: String(selectedKey) === String(correct.key) ? 'correct' : 'incorrect', correctKey: correct.key };
}
