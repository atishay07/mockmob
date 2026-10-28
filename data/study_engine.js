// Shared deterministic study contracts. No answer keys from assessment banks belong here.
export const STUDY_SUBJECTS = ['english', 'accountancy', 'business_studies', 'economics'];
export const SCHEDULER_VERSION = 'fsrs-5.4.2-retention-090-v1';
export const DEFAULT_PREFERENCES = { subjects: STUDY_SUBJECTS, minutes: 20, newCardsPerDay: 5, weeklyPlan: null, revision: 0 };
export const istDay = at => new Date(+new Date(at) + 19800000).toISOString().slice(0, 10);
export function preferences(input, previous = DEFAULT_PREFERENCES, premium = false) {
  const subjects = input.subjects ?? previous.subjects;
  if (!Array.isArray(subjects) || !subjects.length || subjects.some(s => !STUDY_SUBJECTS.includes(s))) throw new Error('INVALID_SUBJECTS');
  const minutes = input.minutes ?? previous.minutes;
  if (![10, 20, 30].includes(minutes)) throw new Error('INVALID_MINUTES');
  const weeklyPlan = input.weeklyPlan === undefined ? previous.weeklyPlan : input.weeklyPlan;
  if (input.weeklyPlan != null && !premium) throw new Error('PREMIUM_REQUIRED');
  if (weeklyPlan != null && (!Array.isArray(weeklyPlan) || weeklyPlan.length !== 7 || weeklyPlan.some(d => !d || !STUDY_SUBJECTS.includes(d.subject) || ![10, 20, 30].includes(d.minutes)))) throw new Error('INVALID_WEEKLY_PLAN');
  return { subjects: [...new Set(subjects)], minutes, newCardsPerDay: 5, weeklyPlan, revision: (previous.revision || 0) + 1 };
}
export function recallQueue(cards, states = [], at = Date.now(), introducedToday = 0, limit = 10, reviewCards = cards) {
  const byId = new Map(states.map(s => [s.card_id, s]));
  const current = cards.map(card => { const previous=byId.get(card.id);return { card, stored:previous?.content_version===card.version ? previous : null }; });
  const due = current.filter(x => x.stored && +new Date(x.stored.schedule.due) <= at).sort((a,b) => +new Date(a.stored.schedule.due) - +new Date(b.stored.schedule.due));
  const overdue = states.filter(state=>reviewCards.some(card=>card.id===state.card_id && card.version===state.content_version) && +new Date(state.schedule.due)<at-86400000).length;
  const allowance = overdue > 20 ? 0 : Math.max(0, 5 - introducedToday);
  const unseen = current.filter(x => !x.stored).slice(0, allowance);
  return { items: [...due, ...unseen].slice(0, limit), dueCount: due.length, overdueCount: overdue, newAllowance: allowance, pausedNew: overdue > 20 };
}
export function createStudyRun({ id, mode, unitIds, cardIds = [], at = Date.now() }) {
  if (!['learn', 'recall'].includes(mode) || !unitIds.length || (mode === 'recall' && !cardIds.length)) throw new Error('STUDY_CONTENT_UNAVAILABLE');
  return { id, mode, unitIds, cardIds, revision: 0, cursor: 0, revealed: false, feedback: null, state: 'active', completedBlocks: [], startedAt: new Date(at).toISOString() };
}
export const requestKeyValid = key => typeof key === 'string' && /^[a-zA-Z0-9_-]{12,100}$/.test(key);
export function studyTransition(run, item, event) {
  if (!requestKeyValid(event.requestKey) || !Number.isInteger(event.expectedRevision)) throw new Error('INVALID_REQUEST');
  if (run.revision !== event.expectedRevision) throw new Error('REVISION_CONFLICT');
  if (run.state !== 'active' || event.itemId !== item.id) throw new Error('STEP_CONFLICT');
  const next = { ...run, revision: run.revision + 1 };
  let rating = null;
  if (event.type === 'reveal' && run.mode === 'recall' && item.type === 'reveal' && !run.revealed) {
    next.revealed = true; next.feedback = { answer: item.answer, explanation: item.explanation, cue: item.cue };
  } else if (event.type === 'answer' && item.type !== 'reveal' && !run.revealed) {
    const correct = item.type === 'choice' ? event.value === item.answer : typeof event.value === 'string' && event.value.trim().toLowerCase() === String(item.answer).toLowerCase();
    if (item.type === 'choice' && (!Number.isInteger(event.value) || event.value < -1 || event.value >= item.options.length)) throw new Error('INVALID_ANSWER');
    if (item.type !== 'choice' && (typeof event.value !== 'string' || event.value.length > 200)) throw new Error('INVALID_ANSWER');
    next.revealed = true; next.feedback = { correct, answer: item.type === 'choice' ? item.options[item.answer] : item.answer, explanation: item.explanation, cue: item.cue };
    // An objectively checked result is persisted now, with the scheduler transaction.
    if (run.mode === 'recall') rating = !correct ? 1 : event.assisted === true ? 2 : 3;
  } else if (event.type === 'rate' && run.mode === 'recall' && item.type === 'reveal' && run.revealed) {
    if (![1,2,3,4].includes(event.rating)) throw new Error('INVALID_RATING');
    rating = event.rating; next.cursor++; next.revealed = false; next.feedback = null;
  } else if (event.type === 'continue' && ((item.type !== 'reveal' && run.revealed) || (run.mode === 'learn' && item.type === 'reading'))) {
    next.completedBlocks = [...run.completedBlocks, item.id]; next.cursor++; next.revealed = false; next.feedback = null;
  } else throw new Error('INVALID_STUDY_ACTION');
  const total = run.mode === 'recall' ? run.cardIds.length : item.total;
  if (next.cursor >= total) next.state = 'complete';
  return { projection: next, rating };
}
export function publicStudyItem(item, revealed = false) {
  if (!item) return null;
  const { answer: _answer, explanation: _explanation, cue: _cue, sourceFact: _fact, word, ...safe } = item;
  if(item.type!=='text' && word) safe.word=word;
  return revealed ? item : safe;
}
export function guidedSequence(plan, study, minutes = 20) {
  const allocation = { 10: [2,3,5], 20: [4,6,10], 30: [5,10,15] }[minutes] || [4,6,10];
  const sequence = [];
  if (plan.primary?.kind==='resume_session') sequence.push({ ...plan.primary, estimatedMinutes: allocation[2] });
  if (study.active) sequence.push({ kind: 'resume_study', title: 'Resume your study session', href: `/study/${study.active.id}`, reason: 'Continue from your last saved action.', estimatedMinutes: allocation[study.active.mode==='learn'?1:0] });
  if (['fresh_check','repair'].includes(plan.primary?.kind)) sequence.push({ ...plan.primary, estimatedMinutes: allocation[2] });
  if (study.active?.mode!=='recall' && study.queue?.items.length) sequence.push({ kind: 'recall', title: study.queue.dueCount ? 'Review your due cards' : 'Start a little recall', href: '/learn?recall=due', reason: study.queue.pausedNew ? 'Clear a small part of your review backlog; new cards can wait.' : 'Recall first, then see the answer.', estimatedMinutes: allocation[0] });
  if (study.active?.mode!=='learn' && study.nextUnit) sequence.push({ kind: 'learn', title: study.nextUnit.title, href: `/learn/${study.nextUnit.id}`, reason: 'A short concept you can learn and apply.', estimatedMinutes: allocation[1] });
  if (!sequence.some(s => ['resume_session','fresh_check','repair'].includes(s.kind))) sequence.push(plan.primary?.kind==='ordinary_practice' && sequence.length ? { ...plan.primary,title:`Practise ${allocation[2]} questions`,href:`/dashboard?mode=quick&count=${allocation[2]}`,reason:`About ${allocation[2]} minutes of practice. Check access and cost before starting.`,estimatedMinutes:allocation[2] } : { ...plan.primary,estimatedMinutes:allocation[2] });
  return sequence;
}
