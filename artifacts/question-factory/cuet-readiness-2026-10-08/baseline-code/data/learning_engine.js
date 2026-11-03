// Deterministic learning logic. The caller supplies released, versioned content.
// Software fixtures must never be passed to production as academic evidence.
import { solveReasoningStep } from './recovery_solvers.js';
const DAY = 86400000;
export const CONCEPT_BLUEPRINTS = [
  ['accountancy', 'sacrificing_gaining', 'Sacrificing and gaining ratios', 'numeric_step'],
  ['accountancy', 'revaluation', 'Revaluation treatment', 'numeric_step'],
  ['economics', 'national_income', 'National income inclusions and exclusions', 'choice'],
  ['economics', 'nominal_real', 'Nominal and real values', 'numeric_step'],
  ['business_studies', 'delegation_decentralisation', 'Delegation and decentralisation', 'choice'],
  ['business_studies', 'planning_controlling', 'Planning and controlling', 'choice'],
  ['english', 'explicit_inference', 'Explicit statements and inference', 'evidence_span'],
  ['english', 'main_idea', 'Main idea and supporting detail', 'evidence_span'],
].map(([subject, id, title, responseType]) => ({ subject, id, title, responseType, state: 'blocked_sources' }));

export function validatePathway(p) {
  if (!p?.id || !p.version || !p.sourceVersion || !p.ruleVersion || !Array.isArray(p.hypotheses) || !p.hypotheses.length || !p.explanation || !p.workedContrast) throw new Error('INVALID_PATHWAY');
  if (!Array.isArray(p.probes) || !p.probes.length || !Array.isArray(p.repair) || !p.repair.length || !Array.isArray(p.checks) || p.checks.length < 3) throw new Error('INCOMPLETE_PATHWAY');
  const items = [...p.probes, ...p.repair, ...p.checks];
  if (new Set(items.map(i => i.id)).size !== items.length || items.some(i => !i.id || !i.familyId || !i.prompt || !i.questionId || !i.contentHash)) throw new Error('INVALID_PATHWAY_ITEMS');
  if (new Set(items.map(i => i.familyId)).size < 6) throw new Error('INSUFFICIENT_INDEPENDENT_FAMILIES');
  for (const item of items) {
    if (!['choice', 'numeric_step', 'evidence_span'].includes(item.type)) throw new Error('INVALID_RESPONSE_TYPE');
    if (item.type === 'numeric_step' && (!Number.isFinite(item.answer) || !Number.isFinite(item.tolerance ?? 0) || (item.tolerance ?? 0) < 0)) throw new Error('INVALID_NUMERIC_KEY');
    if (p.state === 'released' && item.type === 'numeric_step' && Math.abs(solveReasoningStep(item.solver) - item.answer) > 1e-9) throw new Error('SOLVER_KEY_MISMATCH');
    if (item.type === 'choice' && (!Array.isArray(item.options) || !Number.isInteger(item.answer) || item.answer < 0 || item.answer >= item.options.length)) throw new Error('INVALID_CHOICE_KEY');
    if (item.type === 'evidence_span' && (!Array.isArray(item.spans) || !Array.isArray(item.acceptedSpans) || !item.acceptedSpans.length || item.acceptedSpans.some(id => !item.spans.some(s => s.id === id)))) throw new Error('INVALID_EVIDENCE_KEY');
  }
  for (const probe of p.probes) {
    if (!probe.matrix || p.hypotheses.some(h => !Array.isArray(probe.matrix[h]) || !probe.matrix[h].length)) throw new Error('INCOMPLETE_DIAGNOSTIC_MATRIX');
  }
  if (p.repairPaths) for (const h of ['general',...p.hypotheses]) {
    if (!Array.isArray(p.repairPaths[h]) || !p.repairPaths[h].length || p.repairPaths[h].some(id=>!p.repair.some(i=>i.id===id))) throw new Error('INVALID_REPAIR_PATH');
  }
  // Check sessions remain official-style multiple choice.
  if (p.checks.some(c => c.type !== 'choice')) throw new Error('CHECK_MUST_BE_CHOICE');
  return p;
}

export function gradeStep(item, response) {
  if (!response || response.type !== item.type) throw new Error('INVALID_RESPONSE_TYPE');
  if (item.type === 'numeric_step') {
    if (typeof response.value !== 'number' || !Number.isFinite(response.value)) throw new Error('INVALID_NUMERIC_RESPONSE');
    return Math.abs(response.value - item.answer) <= (item.tolerance ?? 0);
  }
  if (item.type === 'evidence_span') {
    if (!item.spans.some(s => s.id === response.value)) throw new Error('INVALID_EVIDENCE_SPAN');
    return item.acceptedSpans.includes(response.value);
  }
  if (!Number.isInteger(response.value) || response.value < 0 || response.value >= item.options.length) throw new Error('INVALID_CHOICE');
  return response.value === item.answer;
}

export function diagnosis(p, observations) {
  const probes = observations.filter(o => o.kind === 'probe');
  const supporting = Object.fromEntries(p.hypotheses.map(h => [h, new Set()]));
  let remaining = [...p.hypotheses];
  for (const o of probes) {
    const probe = p.probes.find(i => i.id === o.itemId);
    if (!probe) throw new Error('UNKNOWN_PROBE');
    const matches = p.hypotheses.filter(h => probe.matrix[h].includes(o.value));
    remaining = remaining.filter(h => matches.includes(h));
    for (const h of matches) supporting[h].add(probe.familyId);
  }
  const conflict = probes.length > 0 && remaining.length === 0;
  const supported = !conflict && remaining.length === 1 && supporting[remaining[0]].size >= 2;
  return { remaining, conflict, supported: supported ? remaining[0] : null, probeCount: probes.length };
}

export function nextProbe(p, observations) {
  const d = diagnosis(p, observations);
  if (d.probeCount >= 3 || d.supported || d.conflict) return null;
  const used = new Set(observations.map(o => o.itemId));
  const candidates = p.probes.filter(i => !used.has(i.id));
  const hypotheses = d.remaining.length ? d.remaining : p.hypotheses;
  const separation = probe => hypotheses.reduce((n, a, index) => n + hypotheses.slice(index + 1).filter(b => JSON.stringify([...probe.matrix[a]].sort()) !== JSON.stringify([...probe.matrix[b]].sort())).length, 0);
  return candidates.sort((a, b) => separation(b) - separation(a) || a.id.localeCompare(b.id))[0] || null;
}

export function createEpisode(p, { id, at, seenIds = [], seenFamilies = [] }) {
  validatePathway(p);
  const ids = new Set(seenIds), families = new Set(seenFamilies);
  // Reserve the entire pathway before exposing even its first probe.
  const items = [...p.probes, ...p.repair, ...p.checks];
  if (items.some(i => ids.has(i.questionId) || families.has(i.familyId))) throw new Error('INSUFFICIENT_FRESH_CONTENT');
  if (new Set(p.checks.map(c => c.familyId)).size !== p.checks.length || p.checks.some(c => [...p.probes, ...p.repair].some(i => i.familyId === c.familyId))) throw new Error('CHECK_FAMILY_OVERLAP');
  return { id, conceptId: p.id, pathwayVersion: p.version, sourceVersion: p.sourceVersion, ruleVersion: p.ruleVersion, state: 'investigating', revision: 0, createdAt: at, observations: [], repairIndex: 0, repairAt: null, firstDelayedAt: null, nextDueAt: null, checks: [], diagnosis: { supported: null, conflict: false } };
}

export function permittedStep(p, e, now) {
  if (['invalidated', 'blocked_content'].includes(e.state)) return null;
  if (e.state === 'investigating') return nextProbe(p, e.observations);
  if (['repairing', 'needs_repair'].includes(e.state)) return repairSequence(p,e)[e.repairIndex];
  if (e.nextDueAt && now < e.nextDueAt) return null;
  if (!['immediate_check', 'delayed_check_1', 'delayed_check_2', 'maintained'].includes(e.state)) return null;
  // Failed checks consume their families too. A repeat can never certify repair.
  return p.checks.find(item => !e.checks.some(c => c.questionId === item.questionId || c.familyId === item.familyId)) || null;
}

function repairSequence(p,e) {
  const ids=p.repairPaths?.[e.diagnosis.supported || 'general'];
  return ids ? ids.map(id=>p.repair.find(i=>i.id===id)) : p.repair;
}

export function advanceEpisode(p, original, response, now, { incompleteCheck = null } = {}) {
  const e = structuredClone(original), item = permittedStep(p, e, now);
  if (!item) throw new Error(e.nextDueAt > now ? 'CHECK_NOT_DUE' : 'NO_PERMITTED_STEP');
  if (response.itemId !== item.id) throw new Error('STEP_CONFLICT');
  const check = ['immediate_check', 'delayed_check_1', 'delayed_check_2', 'maintained'].includes(e.state);
  if (incompleteCheck && (!check || !['unanswered', 'expired'].includes(incompleteCheck) || response.value !== null)) throw new Error('INVALID_INCOMPLETE_CHECK');
  const correct = incompleteCheck ? false : gradeStep(item, response);
  if (check && response.assisted === true) throw new Error('ASSISTED_CHECK');
  if (check && e.checks.some(c => c.questionId === item.questionId || c.familyId === item.familyId)) throw new Error('REPEATED_CHECK');
  e.observations.push({ kind: e.state === 'investigating' ? 'probe' : check ? 'check' : 'repair', itemId: item.id, questionId: item.questionId, familyId: item.familyId, value: response.value, correct, at: now, assisted: !check, ...(incompleteCheck ? { incompleteReason: incompleteCheck } : {}) });
  if (e.state === 'investigating') {
    const d = diagnosis(p, e.observations);
    e.diagnosis = { supported: d.supported, conflict: d.conflict };
    if (!nextProbe(p, e.observations)) e.state = 'repairing';
  } else if (!check) {
    if (correct) e.repairIndex++;
    if (e.repairIndex >= repairSequence(p,e).length) { e.state = 'immediate_check'; e.repairAt = now; e.nextDueAt = null; }
  } else {
    e.checks.push({ questionId: item.questionId, familyId: item.familyId, correct, at: now, stage: e.state, assisted: false, ...(incompleteCheck ? { incompleteReason: incompleteCheck } : {}) });
    if (!correct) { e.state = 'needs_repair'; e.repairIndex = 0; e.nextDueAt = null; }
    else if (e.state === 'immediate_check') { e.state = 'delayed_check_1'; e.nextDueAt = e.repairAt + DAY; }
    else if (e.state === 'delayed_check_1') { e.state = 'delayed_check_2'; e.firstDelayedAt = now; e.nextDueAt = Math.max(e.repairAt + 3 * DAY, now + DAY); }
    else { e.state = 'maintained'; e.nextDueAt = p.checks.some(i=>!e.checks.some(c=>c.questionId===i.questionId || c.familyId===i.familyId)) ? now + 7 * DAY : null; }
  }
  e.revision++;
  if (['immediate_check','delayed_check_1','delayed_check_2'].includes(e.state) && !p.checks.some(item => !e.checks.some(c => c.questionId === item.questionId || c.familyId === item.familyId))) e.state = 'blocked_content';
  return e;
}

export function publicEpisode(p, e, now) {
  const item = permittedStep(p, e, now);
  // Explicit allowlist: no matrices, future checks, hidden solutions or keys.
  const check = ['immediate_check', 'delayed_check_1', 'delayed_check_2', 'maintained'].includes(e.state);
  const step = item ? check ? { id:item.id,type:'choice',kind:'scored_check' } : { id: item.id, type: item.type, prompt: item.prompt,
    options: item.options?.map(o=>typeof o==='string'?o:{key:o.key,text:o.text}),
    spans: item.spans?.map(s=>({id:s.id,text:s.text})),kind:'activity' } : null;
  const lastFailure = e.checks.findLastIndex(c => !c.correct);
  const delayed = e.checks.slice(lastFailure + 1).filter(c => ['delayed_check_1', 'delayed_check_2'].includes(c.stage) && c.correct);
  return { id: e.id, conceptId: e.conceptId, subject: p.subject, title: p.title, state: e.state, revision: e.revision, nextDueAt: e.nextDueAt, step,
    explanation: ['repairing', 'needs_repair'].includes(e.state) ? p.explanations?.[e.diagnosis.supported || 'general'] || p.explanation : undefined,
    workedContrast: ['repairing', 'needs_repair'].includes(e.state) ? p.contrasts?.[e.diagnosis.supported || 'general'] || p.workedContrast : undefined,
    feedback: e.observations.at(-1)?.kind === 'repair' ? !e.observations.at(-1).correct ? 'Revisit this step using the worked contrast, then try again.'
      : e.state === 'immediate_check' ? 'Repair steps complete. They are practice, so they do not count as evidence on their own.' : 'That step checks out. Continue with the next reasoning step.' : undefined,
    evidenceLabel: e.state === 'invalidated' ? 'Evidence changed; checks are excluded' : e.state === 'blocked_content' ? 'More fresh content is needed' : delayed.length >= 2 ? 'Passed two fresh checks' : 'More fresh checks needed',
    sampleSize: e.state === 'invalidated' ? 0 : delayed.length,
    diagnosisLabel: e.diagnosis.conflict ? 'We need another check. Start with the general concept explanation.'
      : e.diagnosis.supported && e.diagnosis.supported === p.noGapHypothesis ? 'Two different scenarios showed this distinction applied correctly. No reasoning gap is labelled.'
      : e.diagnosis.supported ? 'Two distinct observations support this reasoning gap.' : 'An initial signal; more evidence is needed.' };
}

export function allowancePeriod(kind, now) {
  const ist = new Date(now + 19800000);
  if (kind === 'weekly_episode') ist.setUTCDate(ist.getUTCDate() - (ist.getUTCDay() + 6) % 7);
  return kind.startsWith('baseline:') || kind.startsWith('full_sample:') ? 'cuet_2027' : ist.toISOString().slice(0, 10);
}

// 10/20/30 minutes → Quick Practice size. Quick Practice allows at most 20 questions, so the
// 30-minute choice adds a review block instead of inventing a longer timed set.
export function practiceForMinutes(minutes) {
  const m = [10, 20, 30].includes(Number(minutes)) ? Number(minutes) : 10;
  return m === 10 ? { count: 10, review: 0 } : m === 20 ? { count: 20, review: 0 } : { count: 20, review: 10 };
}

// Facts are deterministic statements from the student's own record ('record') or a product rule
// ('rule'). PrepOS and optional model replies explain these; they never replace them.
const istTime = t => new Date(t).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) + ' IST';
const fact = (basis, text) => ({ basis, text });

export function learningPlan({ episodes = [], activeSession, attempts = [], subject = 'economics', minutes = 10, now = Date.now(), availableConcepts = [] }) {
  const duration = [10, 20, 30].includes(Number(minutes)) ? Number(minutes) : 10;
  const action = (kind, title, href, reason, evidence = [], facts = []) => ({ kind, title, href, reason, duration, availability: 'available', evidence, facts });
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  let primary;
  if (activeSession) primary = action('resume_session', 'Resume your practice', activeSession.href, 'Your active session is waiting.', [activeSession.id],
    [fact('record', 'You have an unfinished session that the server is holding for you.')]);
  const live = episodes.filter(e => !['blocked_content', 'invalidated'].includes(e.state));
  const due = live.filter(e => e.nextDueAt && e.nextDueAt <= now).sort((a,b) => a.nextDueAt - b.nextDueAt || a.id.localeCompare(b.id))[0];
  if (!primary && due) primary = action('fresh_check', 'Take your fresh check', `/recovery?episode=${due.id}`, 'This check is due; it uses an unseen family.', [due.id], [
    fact('record', `${due.title}: ${due.evidenceLabel}.`),
    fact('record', `${due.sampleSize ?? 0} of 2 delayed checks passed since your last repair. Due since ${istTime(due.nextDueAt)}.`),
    fact('rule', 'A check counts only when it is unassisted, uses a question family you have not seen, and comes at least a day after repair.')]);
  const repair = episodes.find(e => ['investigating', 'repairing', 'needs_repair', 'immediate_check'].includes(e.state));
  if (!primary && repair?.state === 'immediate_check') primary = action('repair', 'Take your first fresh check', `/recovery?episode=${repair.id}`, 'Your repair steps are done. The first check is unassisted and uses an unseen family.', [repair.id], [
    fact('record', `${repair.title}: repair steps complete.`),
    fact('rule', 'Passing this check opens the first delayed check at least 24 hours after repair.')]);
  if (!primary && repair) primary = action('repair', 'Continue your reasoning repair', `/recovery?episode=${repair.id}`, 'Pick up the activity you started.', [repair.id], [
    fact('record', `${repair.title}: ${repair.diagnosisLabel || 'activity in progress'}`),
    fact('rule', 'Repair activities are practice. They never count as evidence that a gap is fixed.')]);
  const misses = new Map();
  for (const a of attempts) for (const d of a.details || []) if (d.isCorrect === false) {
    const q = a.questionsSnapshot?.find(q => q.id === d.qid);
    if (q?.conceptId && availableConcepts.includes(q.conceptId)) { const m = misses.get(q.conceptId) || []; m.push(a.id); misses.set(q.conceptId, m); }
  }
  const repeated = [...misses].find(([,refs]) => new Set(refs).size >= 2);
  if (!primary && repeated) primary = action('investigate', 'Investigate a repeated mistake', `/recovery?concept=${repeated[0]}`, 'This supported concept was missed in at least two sessions.', [...new Set(repeated[1])], [
    fact('record', `Missed in ${plural(new Set(repeated[1]).size, 'separate session')}.`),
    fact('rule', 'A repeated miss is a reason to investigate, not a diagnosis.')]);
  if (!primary && availableConcepts.length && !attempts.some(a => a.subject === subject)) primary = action('baseline', 'Start a five-question baseline', `/recovery?subject=${subject}`, 'Five questions provide an initial signal for this subject.', [],
    [fact('record', 'No recorded session in this subject yet.')]);
  if (!primary) {
    // The chosen time sets the session: Quick Practice is timed at one minute a question.
    const { count, review } = practiceForMinutes(duration);
    const upcoming = live.filter(e => e.nextDueAt && e.nextDueAt > now).sort((a,b) => a.nextDueAt - b.nextDueAt)[0];
    primary = action('ordinary_practice', `Start ${count} practice questions`, `/dashboard?mode=quick&count=${count}`,
      `${count} questions, about ${count} minutes${review ? `, then ${review} minutes reviewing your mistakes` : ''}. ${availableConcepts.length ? 'No supported concept has been missed twice yet, so this is ordinary practice.' : 'Recovery content is awaiting source and calibration checks, so this is ordinary practice.'}`, [], [
        fact('record', `${plural(attempts.length, 'saved session')}.`),
        ...(upcoming ? [fact('record', `Your next fresh check (${upcoming.title}) opens ${istTime(upcoming.nextDueAt)}.`)] : []),
        fact('rule', availableConcepts.length ? 'Recovery starts from a concept you have missed in two separate sessions.' : 'No recovery pathway has passed its release checks yet.')]);
  }
  return { primary, alternatives: [action('review', 'Review your mistakes', '/review', `${attempts.length} saved attempts.`), action('practice', 'Choose another subject', '/dashboard', 'Practice available content at your own pace.')].filter(a => a.href !== primary.href).slice(0, 2), minutes: duration };
}
