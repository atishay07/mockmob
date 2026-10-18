// PrepOS guide copy. PrepOS explains the shared server plan and the product; it does not
// build its own schedule, missions, benchmarks or entitlements. Every claim here must
// match a shipped capability (see data/capabilities.js).
import { CAPABILITIES } from '@/../data/capabilities';

export const PREPOS_PAUSED_MESSAGE = 'AI features are paused for now. Your credits have not been used.';

export const FEATURE_GUIDE = [
  {
    key: 'today',
    name: 'Today',
    route: '/today',
    description: 'One next step from your practice record, sized to 10, 20 or 30 minutes. Ask Mobi shows the same step.',
    whenToUse: 'Start here when you are not sure what to do next.',
    actionLabel: 'Open Today',
  },
  {
    key: 'practice',
    name: 'Practice',
    route: '/dashboard',
    description: 'Timed CUET practice by subject, mode and question count, marked +5 / −1 on the server. Access and credits are checked before a session starts.',
    whenToUse: 'Use it for daily sets and full-length timing practice.',
    actionLabel: 'Open Practice',
  },
  {
    key: 'review',
    name: 'Review',
    route: '/review',
    description: 'Your wrong and skipped answers from past sessions, with explanations.',
    whenToUse: 'Use it after a session, before practising the same chapter again.',
    actionLabel: 'Open Review',
  },
  {
    key: 'radar',
    name: 'Marks trend',
    route: '/analytics',
    description: 'Accuracy, pace and missed chapters across your server-scored sessions. Small samples are shown as small samples.',
    whenToUse: 'Use it to see which chapters you have missed more than once.',
    actionLabel: 'Open Marks trend',
  },
  {
    key: 'compass',
    name: 'DU eligibility and cutoffs',
    route: '/admission-compass',
    description: 'Checks your subjects against DU’s published 2026 eligibility rules and shows the 2026 Round 1–III minimum allocation scores by category. Historical figures only: it does not predict admission or turn mock marks into a CUET score.',
    whenToUse: 'Use it to check which programmes your subject combination allows.',
    actionLabel: 'Open Compass',
  },
  {
    key: 'saved',
    name: 'Saved questions',
    route: '/saved',
    description: 'Questions you chose to keep for revision.',
    whenToUse: 'Use it for a short revision block.',
    actionLabel: 'Open Saved',
  },
  {
    key: 'benchmark',
    name: 'Shadow Benchmark',
    route: '/rival',
    description: 'A timed set against a simulated pace. Basic benchmarks are included; Pro benchmarks use credits and are paused for now.',
    whenToUse: 'Use it for a short timed check without a full mock.',
    actionLabel: 'Open Benchmark',
  },
  {
    key: 'credits',
    name: 'Credits',
    route: '/pricing/ai-credits',
    description: 'One credits balance pays for practice and Ask Mobi: 1 credit a question or a reply, a full mock 50. Everyone gets 50 free a month, used first.',
    whenToUse: 'Use it to see your credits and what they pay for.',
    actionLabel: 'See your credits',
  },
];

export function pageHelpForPath(pathname = '/') {
  const help = (title, body, primary) => ({ title, body, primary });
  if (pathname.startsWith('/dashboard')) return help('Practice', 'Pick a subject, a mode and a question count. The launch check shows the cost, time and any reason a session cannot start.', { label: 'Open Today', type: 'navigate', route: '/today' });
  if (pathname.startsWith('/test')) return help('Active session', 'Stay with the questions. Mobi stays out of the way until you submit.', null);
  if (pathname.startsWith('/rival')) return help('Shadow Benchmark', 'A timed set against a simulated pace. It reports accuracy, pace and skips for this set only.', null);
  if (pathname.startsWith('/admission-compass')) return help('DU eligibility and cutoffs', FEATURE_GUIDE.find((f) => f.key === 'compass').description, null);
  if (pathname.startsWith('/analytics')) return help('Marks trend', 'This page summarises your server-scored sessions. Review the chapters you missed more than once.', { label: 'Open Review', type: 'navigate', route: '/review' });
  if (pathname.startsWith('/saved')) return help('Saved questions', 'Saved questions are for short revision blocks.', null);
  if (pathname.startsWith('/pricing')) return help('Plans and credits', 'One credits balance pays for practice and Ask Mobi. Pro makes practice free of credits.', null);
  return help('MockMob', 'Mobi explains your next step and the tools. Your plan comes from your practice record.', { label: 'Open Today', type: 'navigate', route: '/today' });
}

/** Instant answers that need no model. Returns null when PrepOS should use the shared plan. */
export function deterministicReplyFor({ text, pathname }) {
  const q = normalize(text);
  if (!q) return null;
  const current = pageHelpForPath(pathname);
  const reply = (body, reason, action) => ({ reply: body, reason, actions: action ? [action] : [], cards: [], confidence: 0, deterministic: true });

  // Plan questions go to the server, which answers from the shared next action.
  if (/ (today|next|plan|replan|what should) /.test(q)) return null;
  if (q.includes('this page') || q.includes('current page') || q.includes('where am i')) {
    return reply(`${current.title}. ${current.body}`, 'Based on the page you are on.', current.primary);
  }
  if (q.includes('credit') || q.includes('pricing') || q.includes('buy') || q.includes('top up') || q.includes('topup')) {
    const paused = CAPABILITIES.optionalAi.state !== 'available';
    return reply(
      paused
        ? `${PREPOS_PAUSED_MESSAGE} Your credits still pay for practice sets and full mocks.`
        : 'One credits balance pays for practice and Ask Mobi: 1 credit a question or a reply, a full mock 50. The 50 free credits each month are used first.',
      'Wallet state comes from the server.',
      { label: 'See your credits', type: 'navigate', route: '/pricing/ai-credits' },
    );
  }
  if (q.includes('college') || q.includes('admission') || q.includes('cutoff') || q.includes('chance') || q.includes(' du ') || q.startsWith('du ')) {
    const compass = FEATURE_GUIDE.find((f) => f.key === 'compass');
    return reply(compass.description, 'Sourced from DU’s published 2026 documents.', { label: compass.actionLabel, type: 'navigate', route: compass.route });
  }
  const feature = FEATURE_GUIDE.find((item) => normalize(`${item.key} ${item.name}`).split(' ').some((token) => token.length > 3 && q.includes(token)));
  if (feature) {
    return reply(`${feature.name}: ${feature.description}`, feature.whenToUse, { label: feature.actionLabel, type: 'navigate', route: feature.route });
  }
  return null;
}

function normalize(value) {
  return ` ${String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()} `;
}
