// Ask Mobi guide copy. Mobi explains the shared server plan and the product; it does not build its own
// schedule, missions or entitlements. Every claim here must match a shipped capability (data/capabilities.js)
// and uses the names in data/glossary.mjs. Costs come from data/plan_facts.mjs, never typed here.
import { PLAN_FACTS } from '@/../data/plan_facts.mjs';

export const ASK_PAUSED_MESSAGE = 'Written replies are paused for now. Your AI credits have not been used.';

const FREE_AI = PLAN_FACTS.aiCredits.freeMonthly.value;
const PRO_AI = PLAN_FACTS.aiCredits.proMonthly.value;

export const FEATURE_GUIDE = [
  {
    key: 'today',
    name: 'Today',
    route: '/today',
    description: 'One next move from your practice record. Mobi shows the same move.',
    whenToUse: 'Start here when you are not sure what to do next.',
    actionLabel: 'Open Today',
  },
  {
    key: 'practice',
    name: 'Practice',
    route: '/dashboard',
    description: `Timed CUET practice by subject, mode and question count, marked +${PLAN_FACTS.marking.right.value} and ${PLAN_FACTS.marking.wrong.value} on the server. The cost is shown before a session starts.`,
    whenToUse: 'Use it for daily sets and full-length timing practice.',
    actionLabel: 'Open Practice',
  },
  {
    key: 'review',
    name: 'Review',
    route: '/review',
    description: 'Your mistakes to repair, your past results and your repair record.',
    whenToUse: 'Use it after a session, before practising the same chapter again.',
    actionLabel: 'Open Review',
  },
  {
    key: 'record',
    name: 'Your record',
    route: '/analytics',
    description: 'Accuracy, pace and missed chapters across your server-scored sessions. Small samples are shown as small samples.',
    whenToUse: 'Use it to see which chapters you have missed more than once.',
    actionLabel: 'Open Your record',
  },
  {
    key: 'cutoff',
    name: 'Cutoff calculator',
    route: '/admission-compass',
    description: 'Which DU courses your subjects open, with last year’s cutoffs. Historical figures only: it does not predict admission or turn mock marks into a CUET score.',
    whenToUse: 'Use it to check which programmes your subject combination allows.',
    actionLabel: 'Open Cutoff calculator',
  },
  {
    key: 'saved',
    name: 'Saved questions',
    route: '/saved',
    description: 'Questions you chose to keep for revision.',
    whenToUse: 'Use it for a short revision block.',
    actionLabel: 'Open Saved questions',
  },
  {
    key: 'credits',
    name: 'AI credits',
    route: '/profile#plan',
    description: `AI credits pay for Mistake Repair and written replies from Mobi. Free accounts get ${FREE_AI} a month and Pro gets ${PRO_AI}. They are separate from practice credits.`,
    whenToUse: 'Use it to see how many AI credits you have left.',
    actionLabel: 'See your plan and credits',
  },
];

export function pageHelpForPath(pathname = '/') {
  const help = (title, body, primary) => ({ title, body, primary });
  if (pathname.startsWith('/dashboard')) return help('Practice', 'Pick a subject, a mode and a question count. The confirm step shows the cost and the time before anything is used.', { label: 'Open Today', type: 'navigate', route: '/today' });
  if (pathname.startsWith('/test')) return help('Active session', 'Stay with the questions. Mobi stays out of the way until you submit.', null);
  if (pathname.startsWith('/admission-compass')) return help('Cutoff calculator', FEATURE_GUIDE.find((f) => f.key === 'cutoff').description, null);
  if (pathname.startsWith('/analytics')) return help('Your record', 'Your record summarises your server-scored sessions. Repair the chapters you missed more than once.', { label: 'Open Review', type: 'navigate', route: '/review' });
  if (pathname.startsWith('/saved')) return help('Saved questions', 'Saved questions are for short revision blocks.', null);
  if (pathname.startsWith('/pricing')) return help('Plans and credits', 'Pro and AI credits are separate. AI credits pay for Mistake Repair and written replies from Mobi.', null);
  return help('MockMob', 'Mobi explains your next move and the tools. Your plan comes from your practice record.', { label: 'Open Today', type: 'navigate', route: '/today' });
}

/** Instant answers that need no model. Returns null when Mobi should use the shared plan. */
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
    const credits = FEATURE_GUIDE.find((f) => f.key === 'credits');
    return reply(credits.description, 'Your balance comes from the server.', { label: credits.actionLabel, type: 'navigate', route: credits.route });
  }
  if (q.includes('college') || q.includes('admission') || q.includes('cutoff') || q.includes('chance') || q.includes(' du ') || q.startsWith('du ')) {
    const tool = FEATURE_GUIDE.find((f) => f.key === 'cutoff');
    return reply(tool.description, 'Sourced from DU’s published documents.', { label: tool.actionLabel, type: 'navigate', route: tool.route });
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
