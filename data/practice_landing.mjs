// What the Practice page (/dashboard) leads with, the confirm line under its Start button, and the
// access panel. Pure functions so every state is tested without a browser.

// Query parameters that mean the student arrived to set up a particular session (from Today,
// PrepOS, a lesson or a plan step). The plan strip would only repeat what brought them here.
const SETUP_PARAMS = ['subject', 'mode', 'count', 'chapter', 'tonightKey'];

/** True when the URL already describes the session the student came to start. */
export function arrivedWithSetup(searchParams) {
  if (!searchParams || typeof searchParams.get !== 'function') return false;
  return SETUP_PARAMS.some((name) => {
    const value = searchParams.get(name);
    return typeof value === 'string' && value.trim() !== '';
  });
}

/** A plan step that points back at this page is a suggested setup, not somewhere to go. */
export function planStepIsSetup(step) {
  const href = typeof step?.href === 'string' ? step.href : '';
  return href === '/dashboard' || href.startsWith('/dashboard?');
}

/** The mode and count a setup step suggests, or null when it suggests none we can apply. */
export function planSetup(step, modes) {
  if (!planStepIsSetup(step)) return null;
  const query = new URLSearchParams(step.href.split('?')[1] || '');
  const mode = query.get('mode');
  const count = Number(query.get('count'));
  if (!mode || !modes?.[mode]) return null;
  const options = modes[mode].countOptions || [];
  return { mode, count: options.includes(count) ? count : null };
}

/**
 * The page's one dominant action.
 *
 *   resume   an unfinished test is saved on this device          Resume your test
 *   first    no submitted session yet (the S3 new member)        Start your 10-question check
 *   step     the plan names a step elsewhere (repair, a check)   that step
 *   setup    everything else                                     the Start button under the setup
 *
 * `strip` says what the compact next-step strip shows: hidden, loading, error, step (with the
 * dominant button), or setup (the suggested setup, applied in place; the Start button stays dominant).
 * `setupDominant` decides whether the setup's Start button is the filled primary.
 */
export function practiceLead({ attempts, resume, plan, planState = 'loading', arrivedWithSetup: arrived = false, touched = false }) {
  if (resume?.href) return { kind: 'resume', strip: 'hidden', setupDominant: false };
  if (Array.isArray(attempts) && attempts.length === 0) return { kind: 'first', strip: 'hidden', setupDominant: true };
  // Arriving with a setup already chosen: the setup is the job, the strip would repeat it.
  if (arrived) return { kind: 'setup', strip: 'hidden', setupDominant: true };
  if (planState === 'loading') return { kind: 'setup', strip: 'loading', setupDominant: true };
  if (planState !== 'ready' || !plan?.primary?.href || !plan.primary.title) return { kind: 'setup', strip: 'error', setupDominant: true };
  if (planStepIsSetup(plan.primary)) return { kind: 'setup', strip: 'setup', setupDominant: true };
  // Once the student starts choosing their own session, the Start button they are using leads.
  return { kind: 'step', strip: 'step', setupDominant: Boolean(touched) };
}

// Words that mean the plan is talking about the build, not the student's next step.
const BUILD_TALK = /awaiting|calibration|release check|source and|pathway|supported concept|family|unassisted/i;

/**
 * The one line the next-step strip shows under a plan step. Ordinary practice gets a fixed student
 * line (the plan's own reason explains why recovery is not ready, which is not the student's
 * business). Any other reason is shown only when it carries no build talk.
 */
export function stripReason(step) {
  if (planStepIsSetup(step)) return 'Practise the next set of questions.';
  const reason = typeof step?.reason === 'string' ? step.reason.trim() : '';
  return reason && !BUILD_TALK.test(reason) ? reason : '';
}

/** The first-session check: a fixed Quick Practice of ten questions. */
export const FIRST_CHECK = { mode: 'quick', count: 10 };

export function isFirstCheck({ lead, modeId, count }) {
  return lead?.kind === 'first' && modeId === FIRST_CHECK.mode && count === FIRST_CHECK.count;
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * "10 questions, 10 minutes. 10 credits." The cost and time on the line under Start, as the app
 * writes it. Cost comes only from a server quote that matches the setup; it is never guessed.
 *   quoteState: idle | loading | ready | error;  quote: the matching quote or null.
 */
export function confirmLine({ count, minutes, approximate = false, quoteState, quote, isPremium = false }) {
  const size = `${plural(count, 'question')}, ${approximate ? 'about ' : ''}${plural(Math.max(1, Math.round(minutes)), 'minute')}.`;
  return `${size} ${confirmCost({ quoteState, quote, isPremium })}`;
}

export function confirmCost({ quoteState, quote, isPremium = false }) {
  if (quoteState === 'error') return 'Cost not checked yet.';
  if (quoteState !== 'ready' || !quote) return 'Checking the cost.';
  if (quote.launchable !== true) return 'Not available right now.';
  if (isPremium) return 'Included with Pro.';
  const cost = Number(quote.creditCost);
  if (!Number.isFinite(cost)) return 'Checking the cost.';
  if (cost === 0) return 'Free today. No credits needed.';
  return `${plural(cost, 'credit')}.`;
}

/** The short cost value for the session summary table. */
export function costValue({ quoteState, quote, isPremium = false }) {
  if (quoteState === 'error') return 'Not checked';
  if (quoteState !== 'ready' || !quote) return 'Checking';
  if (quote.launchable !== true) return 'Not available';
  if (isPremium) return 'Included';
  const cost = Number(quote.creditCost);
  if (!Number.isFinite(cost)) return 'Checking';
  return cost === 0 ? 'Free today' : plural(cost, 'credit');
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dateLabel(value) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return '';
  return new Date(time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

/**
 * The access panel, by plan. Free: the balance and what Pro adds, said once. Pro: "Your access"
 * with the end date. Unknown is never shown as zero.
 */
export function accessSummary({ isPremium, premiumUntil, creditBalance, now = Date.now() }) {
  if (isPremium) {
    const until = dateLabel(premiumUntil);
    const ends = Date.parse(premiumUntil);
    const daysLeft = Number.isFinite(ends) ? Math.ceil((ends - now) / DAY_MS) : null;
    let status;
    if (!until) status = 'Pro is active.';
    else if (ends < now) status = `Pro ended on ${until}.`;
    else if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 7) status = daysLeft <= 1 ? `Pro ends on ${until}.` : `Pro ends in ${daysLeft} days, on ${until}.`;
    else status = `Pro until ${until}.`;
    return {
      plan: 'pro',
      title: 'Your access',
      status,
      detail: 'Quick Practice, Full Mock, Smart Practice and NTA Mode are included, subject to available questions.',
      balance: null,
      action: null,
      earn: null,
    };
  }
  const known = typeof creditBalance === 'number' && Number.isFinite(creditBalance);
  const balance = known ? Math.max(0, Math.floor(creditBalance)) : null;
  return {
    plan: 'free',
    title: 'Free plan',
    status: balance === null ? 'Your credit balance could not be read.' : balance === 0 ? 'No practice credits left.' : `${balance.toLocaleString('en-IN')} practice ${balance === 1 ? 'credit' : 'credits'} left.`,
    detail: 'Pro adds Smart Practice and NTA Mode, and Quick Practice and Full Mock stop costing credits.',
    balance,
    action: { label: 'See Pro', href: '/pricing' },
    // Only when it helps: a student with no credits learns the free way to earn more.
    earn: balance === 0 ? { line: 'A question you upload earns credits once it passes moderation.', label: 'Upload a question', href: '/upload' } : null,
  };
}

/** "6 of 10 correct" for a recent session row; unknown counts are left out, never shown as 0. */
export function sessionTally(attempt) {
  if (attempt?.correct == null || attempt?.total == null) return '';
  const correct = Number(attempt.correct);
  const total = Number(attempt.total);
  if (!Number.isFinite(correct) || !Number.isFinite(total) || total <= 0) return '';
  return `${correct} of ${total} correct`;
}
