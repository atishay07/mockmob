// Builds the learning record behind GET /api/learning/plan. PURE orchestration: every read
// and every rule arrives through `deps`, so the unit tests can prove the result is identical to
// the earlier sequential version while the reads now run in parallel.
//
// What runs at the same time (each line waits only for what it actually needs):
//  - study preferences, all attempts, learning episodes plus the active session, and the
//    released pathways start together;
//  - each episode's pathway check starts as soon as the episode rows arrive, all in parallel;
//  - the study record starts as soon as preferences and attempts are known;
//  - the plan itself is computed once everything it reads is in.
// Error precedence is kept: results are awaited in the original order, so when several reads
// fail the caller sees the same error the sequential version threw. Every started promise has a
// handler attached, so an early throw never leaves an unhandled rejection behind.
//
// view 'step' returns what the next-step card needs and leaves out the episode list, the
// supported concepts and the milestones (the heavier parts); the default view is unchanged.

export const STEP_VIEW_OMITS = Object.freeze(['episodes', 'supportedConcepts', 'milestones']);

/** Starts `fn` now and marks the promise as handled; awaiting it later still throws. */
export function started(fn) {
  const p = Promise.resolve().then(fn);
  p.catch(() => {});
  return p;
}

/**
 * Runs every task in parallel but settles like a sequential loop: resolves with all values in
 * order, or rejects with the first failure by index (not by time).
 */
export async function allInOrder(tasks) {
  const results = await Promise.allSettled(tasks.map(task => Promise.resolve().then(task)));
  const failed = results.find(r => r.status === 'rejected');
  if (failed) throw failed.reason;
  return results.map(r => r.value);
}

/** One validation per distinct pathway within a request (episodes often repeat a released pathway). */
export function memoValidator(validate) {
  const seen = new Map();
  return pathway => {
    let key;
    try { key = JSON.stringify(pathway); } catch { return validate(pathway); }
    if (!seen.has(key)) seen.set(key, Promise.resolve().then(() => validate(pathway)));
    return seen.get(key);
  };
}

const weekdayOf = (istDay, now) => (new Date(`${istDay(now)}T00:00:00Z`).getUTCDay() + 6) % 7;

export async function composeLearningRecord(userId, { subject, minutes, view = 'full' } = {}, deps) {
  const guided = deps.env.STUDY_GUIDED_PLAN_ENABLED === 'true';
  const now = deps.now || Date.now;
  const validate = deps.validateCurrentPathway;

  const prefsP = guided ? started(() => deps.getStudyPreferences(userId)) : null;
  const attemptsP = started(() => deps.getAttempts(userId));
  const rowsP = started(() => Promise.all([deps.loadEpisodes(userId), deps.loadActiveSession(userId)]));
  const episodesP = started(async () => {
    const [episodeResult] = await rowsP;
    return Promise.all((episodeResult.data || []).map(async row => {
      try { await validate(row.pathway); return deps.publicEpisode(row.pathway, row.projection, now()); }
      catch { return { id: row.id, title: row.pathway.title, state: 'blocked_content', evidenceLabel: 'Current evidence unavailable; progress claims paused', sampleSize: 0 }; }
    }));
  });
  // Fail closed: ordinary review remains useful without released pathways.
  const availableP = started(() => deps.releasedPathways()).catch(() => []);

  if (guided) {
    try {
      const prefs = await prefsP;
      const weekday = weekdayOf(deps.istDay, now());
      const weekly = prefs.premium ? prefs.weeklyPlan?.[weekday] : null;
      if (!subject) subject = weekly?.subject;
      if (![10, 20, 30].includes(minutes)) minutes = weekly?.minutes || prefs.minutes;
    } catch { /* Existing learning record remains available if study storage is not deployed. */ }
  }
  const attempts = await attemptsP;
  const studyP = guided ? started(() => {
    const weakConcepts = attempts.flatMap(attempt => (attempt.details || []).filter(answer => answer.isCorrect === false).map(answer => attempt.questionsSnapshot?.find(q => q.id === answer.qid)?.conceptId).filter(Boolean));
    // Chapters behind recent ordinary mistakes point to the matching lesson, if one is published.
    const weakChapters = attempts.slice(0, 10).flatMap(attempt => (attempt.details || []).filter(answer => answer.isCorrect === false).map(answer => { const q = attempt.questionsSnapshot?.find(q => q.id === answer.qid); return q?.chapter ? { subject: q.subject || attempt.subject, chapter: q.chapter } : null; }).filter(Boolean));
    return deps.studyRecord(userId, { subject: subject || undefined, weakConcepts, weakChapters });
  }) : null;

  const [episodeResult, sessionResult] = await rowsP;
  const episodes = await episodesP;
  const active = sessionResult.data?.[0];
  const available = await availableP;
  const activeSession = active ? { id: active.id, href: `/test?${new URLSearchParams({ subject: active.subject, mode: active.mode, sessionId: active.id, experience: active.selection_meta?.learningPurpose === 'ordinary_practice' ? 'practice' : 'recovery' })}` } : null;
  const plan = deps.learningPlan({ episodes, activeSession, attempts, subject, minutes, availableConcepts: available.map(p => p.id) });
  let suite = {};
  if (guided) {
    try {
      const study = await studyP;
      if (study.state === 'ready') {
        const sequence = deps.guidedSequence(plan, study, plan.minutes);
        suite = { sequence, primary: sequence[0] || plan.primary, study: { dueCards: study.queue.dueCount, lessonsRead: study.progress.lessonsRead, preferences: study.preferences, weekday: weekdayOf(deps.istDay, now()) } };
      }
    } catch { suite = { studyState: 'unavailable' }; } // Existing practice remains usable during rollback.
  }
  const withActions = deps.withPlanActions({ ...plan, ...suite });
  const base = { ...withActions, pathwayState: available.length ? 'available' : 'blocked_content' };
  const shared = { recordState: episodeResult.error ? 'unavailable' : 'ready', ordinaryAttemptCount: attempts.length, tonight: deps.tonightCompletion(attempts) };
  if (view === 'step') return { ...base, ...shared };
  return { ...withActions, episodes,
    pathwayState: base.pathwayState, supportedConcepts: available.map(p => ({ id: p.id, subject: p.subject, title: p.title })),
    ...shared, milestones: deps.studyMilestones(attempts, episodes) };
}
