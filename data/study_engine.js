// Shared deterministic study contracts. No answer keys from assessment banks belong here.
export const STUDY_SUBJECTS = ['english', 'accountancy', 'business_studies', 'economics'];
export const SCHEDULER_VERSION = 'fsrs-5.4.2-retention-090-v1';
export const NEW_CARDS_PER_DAY = 5;
export const DEFAULT_PREFERENCES = { subjects: STUDY_SUBJECTS, minutes: 20, newCardsPerDay: NEW_CARDS_PER_DAY, weeklyPlan: null, revision: 0 };
export const istDay = at => new Date(+new Date(at) + 19800000).toISOString().slice(0, 10);
// Due cards survive a changed preference; new cards require a completed current lesson.
export function taughtRecallCards(cards, states, completedUnitIds) {
  const taught = new Set(completedUnitIds);
  return cards.filter(card => taught.has(card.unitId) || states.some(s => s.card_id === card.id && s.content_version === card.version));
}
export function preferences(input, previous = DEFAULT_PREFERENCES, premium = false) {
  const subjects = input.subjects ?? previous.subjects;
  if (!Array.isArray(subjects) || !subjects.length || subjects.some(s => !STUDY_SUBJECTS.includes(s))) throw new Error('INVALID_SUBJECTS');
  const minutes = input.minutes ?? previous.minutes;
  if (![10, 20, 30].includes(minutes)) throw new Error('INVALID_MINUTES');
  const weeklyPlan = input.weeklyPlan === undefined ? previous.weeklyPlan : input.weeklyPlan;
  if (input.weeklyPlan != null && !premium) throw new Error('PREMIUM_REQUIRED');
  if (weeklyPlan != null && (!Array.isArray(weeklyPlan) || weeklyPlan.length !== 7 || weeklyPlan.some(d => !d || !STUDY_SUBJECTS.includes(d.subject) || ![10, 20, 30].includes(d.minutes)))) throw new Error('INVALID_WEEKLY_PLAN');
  return { subjects: [...new Set(subjects)], minutes, newCardsPerDay: NEW_CARDS_PER_DAY, weeklyPlan, revision: (previous.revision || 0) + 1 };
}
export function recallQueue(cards, states = [], at = Date.now(), introducedToday = 0, limit = 10, reviewCards = cards) {
  const byId = new Map(states.map(s => [s.card_id, s]));
  const current = cards.map(card => { const previous=byId.get(card.id);return { card, stored:previous?.content_version===card.version ? previous : null }; });
  const due = current.filter(x => x.stored && +new Date(x.stored.schedule.due) <= at).sort((a,b) => +new Date(a.stored.schedule.due) - +new Date(b.stored.schedule.due));
  const overdue = states.filter(state=>reviewCards.some(card=>card.id===state.card_id && card.version===state.content_version) && +new Date(state.schedule.due)<at-86400000).length;
  const allowance = overdue > 20 ? 0 : Math.max(0, NEW_CARDS_PER_DAY - introducedToday);
  const unseen = current.filter(x => !x.stored).slice(0, allowance);
  return { items: [...due, ...unseen].slice(0, limit), dueCount: due.length, overdueCount: overdue, newAllowance: allowance, pausedNew: overdue > 20, unseenCount: current.filter(x => !x.stored).length };
}
export function createStudyRun({ id, mode, unitIds, cardIds = [], at = Date.now() }) {
  if (!['learn', 'recall'].includes(mode) || !unitIds.length || (mode === 'recall' && !cardIds.length)) throw new Error('STUDY_CONTENT_UNAVAILABLE');
  return { id, mode, unitIds, cardIds, revision: 0, cursor: 0, revealed: false, feedback: null, state: 'active', completedBlocks: [], startedAt: new Date(at).toISOString() };
}
export const requestKeyValid = key => typeof key === 'string' && /^[a-zA-Z0-9_-]{12,100}$/.test(key);

// Exact answer checking. Numbers accept equivalent fractions/decimals; ratios are compared in lowest terms.
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const clean = value => String(value ?? '').trim().replace(/[−–—]/g, '-').replace(/[₹,\s]/g, '').replace(/^rs\.?/i, '');
export function parseRational(value) {
  const text = clean(value);
  let match = text.match(/^(-?\d+)\/(\d+)$/);
  if (match) { const d = Number(match[2]); if (!d) return null; return reduce(Number(match[1]), d); }
  match = text.match(/^(-?)(\d+)(?:\.(\d+))?%?$/);
  if (!match || text.endsWith('%')) return null;
  const decimals = match[3] || '';
  return reduce(Number(`${match[1]}${match[2]}${decimals}`), 10 ** decimals.length);
}
function reduce(n, d) { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d) || 1; return [n / g, d / g]; }
export function parseRatio(value) {
  const parts = clean(value).split(':');
  if (parts.length < 2 || parts.some(p => !/^\d+(?:\/\d+)?$/.test(p))) return null;
  const fractions = parts.map(parseRational);
  const lcm = fractions.reduce((m, [, d]) => m / gcd(m, d) * d, 1);
  const whole = fractions.map(([n, d]) => n * (lcm / d));
  const g = whole.reduce((a, b) => gcd(a, b));
  return g ? whole.map(x => x / g) : null;
}
const normalWords = value => String(value ?? '').trim().toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
export function checkAnswer(item, value) {
  if (item.type === 'choice') {
    if (!Number.isInteger(value) || value < -1 || value >= item.options.length) throw new Error('INVALID_ANSWER');
    return value === item.answer;
  }
  if (typeof value !== 'string' || value.length > 200) throw new Error('INVALID_ANSWER');
  if (item.type === 'numeric') { const a = parseRational(value), b = parseRational(item.answer); return !!a && a[0] === b[0] && a[1] === b[1]; }
  if (item.type === 'ratio') { const a = parseRatio(value), b = parseRatio(item.answer); return !!a && a.length === b.length && a.every((x, i) => x === b[i]); }
  return [item.answer, ...(item.accept || [])].some(answer => normalWords(answer) === normalWords(value));
}
const CHECKED = ['choice', 'text', 'numeric', 'ratio'];
const answerText = item => item.type === 'choice' ? item.options[item.answer] : item.answer;

export function studyTransition(run, item, event) {
  if (!requestKeyValid(event.requestKey) || !Number.isInteger(event.expectedRevision)) throw new Error('INVALID_REQUEST');
  if (run.revision !== event.expectedRevision) throw new Error('REVISION_CONFLICT');
  if (event.type === 'set_aside') {
    // Leaving one session to open another keeps every saved action and introduces nothing.
    if (run.state !== 'active') throw new Error('STEP_CONFLICT');
    return { projection: { ...run, revision: run.revision + 1, state: 'set_aside' }, rating: null };
  }
  if (run.state !== 'active' || event.itemId !== item.id) throw new Error('STEP_CONFLICT');
  const next = { ...run, revision: run.revision + 1 };
  let rating = null;
  if (event.type === 'reveal' && run.mode === 'recall' && item.type === 'reveal' && !run.revealed) {
    next.revealed = true; next.feedback = { answer: item.answer, explanation: item.explanation, cue: item.cue };
  } else if (event.type === 'answer' && CHECKED.includes(item.type) && !run.revealed) {
    const correct = checkAnswer(item, event.value);
    const chosen = item.type === 'choice' && event.value >= 0 ? event.value : null;
    next.revealed = true;
    next.feedback = { correct, answer: answerText(item), explanation: item.explanation, cue: item.cue,
      ...(item.type !== 'choice' && typeof event.value === 'string' && event.value.trim() ? { given: event.value.trim().slice(0, 200) } : {}),
      ...(chosen !== null ? { chosen: item.options[chosen], whyChosen: correct ? null : item.optionNotes?.[chosen] || null } : {}),
      ...(event.value === -1 || event.value === '' ? { skipped: true } : {}) };
    // An objectively checked result is persisted now, with the scheduler transaction.
    if (run.mode === 'recall') rating = !correct ? 1 : event.assisted === true ? 2 : 3;
  } else if (event.type === 'rate' && run.mode === 'recall' && item.type === 'reveal' && run.revealed) {
    if (![1,2,3,4].includes(event.rating)) throw new Error('INVALID_RATING');
    rating = event.rating; next.cursor++; next.revealed = false; next.feedback = null;
  } else if (event.type === 'continue' && ((item.type !== 'reveal' && run.revealed) || (run.mode === 'learn' && item.type === 'reading'))) {
    next.completedBlocks = [...run.completedBlocks, item.id]; next.cursor++; next.revealed = false; next.feedback = null;
  } else throw new Error('INVALID_STUDY_ACTION');
  if (run.mode === 'learn' && event.type === 'answer') next.checks = [...(run.checks || []), { id: item.id, correct: next.feedback.correct }];
  const total = run.mode === 'recall' ? run.cardIds.length : item.total;
  if (next.cursor >= total) next.state = 'complete';
  return { projection: next, rating };
}
const SECRET = ['answer', 'explanation', 'cue', 'sourceFact', 'accept', 'optionNotes', 'variants', 'sourceRefs'];
export function publicStudyItem(item, revealed = false) {
  if (!item) return null;
  if (revealed) { const { variants: _v, accept: _a, ...shown } = item; return shown; }
  const safe = Object.fromEntries(Object.entries(item).filter(([key]) => !SECRET.includes(key) && key !== 'word'));
  // A spelling or gap-fill task must not print the word it asks for.
  if (item.word && !['text'].includes(item.type) && !item.hideWord) safe.word = item.word;
  return safe;
}
// One card is one memory. Each review can ask for it in a different form (meaning in context,
// gap fill, spelling, synonym); the variant is fixed when the run starts and bound to the card hash.
export function cardItem(card, reps = 0) {
  if (!card.variants?.length) return card;
  const { variants, ...base } = card;
  const variant = variants[reps % variants.length];
  return { ...base, ...variant, variantId: variant.variantId, variantCount: variants.length };
}
const STEP_COPY = {
  recall: { purpose: 'Keeps what you have learned from fading before the exam.', done: 'Done when each card is answered or rated.' },
  learn: { purpose: 'Understand one concept, then try it straight away.', done: 'Done when you finish the lesson and its checks.' },
  resume_study: { purpose: 'Pick up from your last saved action.', done: 'Nothing you did is lost.' },
  ordinary_practice: { purpose: 'Apply what you know under exam-style marking.', done: 'Done when you submit; your result shows the chapters to fix.' },
};
export function guidedSequence(plan, study, minutes = 20) {
  const allocation = { 10: [2,3,5], 20: [4,6,10], 30: [5,10,15] }[minutes] || [4,6,10];
  const sequence = [];
  const add = step => sequence.push({ ...STEP_COPY[step.kind], ...step });
  if (plan.primary?.kind==='resume_session') add({ ...plan.primary, estimatedMinutes: allocation[2] });
  if (study.active) add({ kind: 'resume_study', title: study.active.mode === 'learn' ? `Finish your lesson${study.active.title ? `: ${study.active.title}` : ''}` : 'Finish your recall session', href: `/study/${study.active.id}`, reason: 'Continue from your last saved action.', estimatedMinutes: allocation[study.active.mode==='learn'?1:0], mode: study.active.mode });
  if (['fresh_check','repair'].includes(plan.primary?.kind)) add({ ...plan.primary, estimatedMinutes: allocation[2] });
  if (study.active?.mode!=='recall' && study.queue?.items.length) {
    const due = study.queue.dueCount, fresh = study.queue.items.length - Math.min(due, study.queue.items.length);
    add({ kind: 'recall', title: due ? `Review ${Math.min(due, study.queue.items.length)} due ${due === 1 ? 'card' : 'cards'}` : `Lock in ${fresh} new ${fresh === 1 ? 'card' : 'cards'}`, href: '/learn?recall=due', reason: study.queue.pausedNew ? 'Clear part of your review backlog first; new cards wait until it is smaller.' : due ? 'These are due now. Answer from memory first, then check.' : 'Cards from lessons you have read. Answer from memory first, then check.', estimatedMinutes: allocation[0] });
  }
  if (study.active?.mode!=='learn' && study.nextUnit) add({ kind: 'learn', title: `Learn: ${study.nextUnit.title}`, href: `/learn/${study.nextUnit.id}`, reason: study.nextUnit.reason || 'A short lesson with worked examples and a quick check.', estimatedMinutes: allocation[1], subject: study.nextUnit.subject, chapter: study.nextUnit.chapter });
  if (!sequence.some(s => ['resume_session','fresh_check','repair'].includes(s.kind))) {
    const chapter = study.nextUnit?.chapter && study.nextUnit?.subject ? study.nextUnit : null;
    add(plan.primary?.kind==='ordinary_practice' && sequence.length
      ? { ...plan.primary, title: `Practise ${allocation[2]} questions`, href: `/dashboard?mode=quick&count=${allocation[2]}${chapter ? `&${new URLSearchParams({ subject: chapter.subject, chapter: chapter.chapter })}` : ''}`, reason: `About ${allocation[2]} minutes of exam-style questions${chapter ? ` from ${chapter.chapter}` : ''}. Access and cost are shown before you start.`, estimatedMinutes: allocation[2] }
      : { ...plan.primary, estimatedMinutes: allocation[2] });
  }
  return sequence;
}
