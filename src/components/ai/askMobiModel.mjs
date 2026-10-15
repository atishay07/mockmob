// What Ask Mobi says about cost and credits, and where the old PrepOS tabs went (web IA plan 2.2 Review, 6).
// PURE: no I/O, no React, so it is unit-tested (data/tests/review_hub.test.mjs). Copy rules: sentence case,
// no "!", no em dash, real numbers only. Every number comes from data/plan_facts.mjs or the wallet the server
// returned; an unreadable balance is left out and never shown as 0.
import { PLAN_FACTS } from '../../../data/plan_facts.mjs';
import { ASK_HREF, RECORD_HREF, TODAY_HREF, YOU_HREF } from '../../lib/navigation.js';

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
const known = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const whole = (value) => Math.max(0, Math.trunc(Number(value)));

/** The cost of one written reply, from the plan facts. */
export const replyCost = () => PLAN_FACTS.aiCredits.askMobiReplyCost.value;
/** "1 AI credit" */
export const replyCostLabel = () => plural(replyCost(), 'AI credit');

/** The two kinds of reply, with their cost beside the name. `kind` is what the chat route is sent. */
export const REPLY_KINDS = Object.freeze([
  Object.freeze({ id: 'record', label: 'From your record', cost: 'Free' }),
  Object.freeze({ id: 'model', label: 'Written reply', get cost() { return replyCostLabel(); } }),
]);

/**
 * The old PrepOS tabs and where they went. /mentor?tab=ask (and no tab) is Ask Mobi itself; the Next step tab
 * repeated Today, the Your record tab was /analytics, and the tools and wallet tab is now You.
 * Old links (the app's ActionRouter, the result page) keep working: the page redirects.
 */
export function mentorTabTarget(tab) {
  switch (String(Array.isArray(tab) ? tab[0] : tab || '')) {
    case 'plan': return TODAY_HREF;
    case 'record': return RECORD_HREF;
    case 'tools': case 'guide': case 'wallet': return YOU_HREF;
    default: return null;
  }
}

/** The one line about the student's AI credits, or null while it is not known. Bonus credits get their own clause. */
export function walletLine(wallet) {
  if (!wallet || wallet.known !== true || !known(wallet.includedRemaining) || !known(wallet.includedMonthlyCredits)) return null;
  const left = whole(wallet.includedRemaining);
  const allowance = whole(wallet.includedMonthlyCredits);
  const bonus = known(wallet.bonusCredits) ? whole(wallet.bonusCredits) : 0;
  const bonusText = bonus > 0 ? `, plus ${bonus} that do not expire` : '';
  const renew = wallet.resetAt && !Number.isNaN(new Date(wallet.resetAt).getTime())
    ? ` Renews ${new Date(wallet.resetAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}.`
    : '';
  return `AI credits: ${left} of ${allowance} this month${bonusText}.${renew}`;
}

/** What to say about a written reply for each wallet state, or the reason it cannot be sent. */
export function writtenReplyNotice(wallet) {
  const cost = replyCostLabel();
  const free = 'Questions about your record are still free.';
  const state = wallet?.state;
  if (!wallet) return { ok: false, title: 'Reading your AI credits', body: free };
  if (wallet.known !== true && state !== 'paused') {
    return { ok: false, title: 'Written replies are off for now', body: `Mobi could not read your AI credits just now, so nothing is sent that could cost one. ${free}` };
  }
  if (state === 'available') {
    return { ok: true, title: `One written reply uses ${cost}`, body: 'Mobi writes from your record. It is guidance, not an answer key and not an admission prediction. A reply that fails costs nothing.' };
  }
  if (state === 'empty') {
    const renew = wallet.resetAt && !Number.isNaN(new Date(wallet.resetAt).getTime())
      ? ` They renew on ${new Date(wallet.resetAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}.` : '';
    return { ok: false, title: 'No AI credits left this month', body: `${renew.trim()} ${free}`.trim() };
  }
  if (state === 'paused') {
    return { ok: false, title: 'Written replies are paused for now', body: `Your AI credits are kept. ${free}` };
  }
  return { ok: false, title: 'Written replies are off for now', body: free };
}

/** Can the student send a written reply right now? */
export const canWriteReply = (wallet) => writtenReplyNotice(wallet).ok;

/** The label on the send key: free for the record, the cost for a written reply. */
export function sendLabel(kind, { pending = false } = {}) {
  if (pending) return 'Reading';
  return kind === 'model' ? `Send, ${replyCostLabel()}` : 'Ask';
}

/** The line under the composer. */
export function composerHint(kind) {
  return kind === 'model' ? `Uses ${replyCostLabel()} when the reply arrives` : 'Free, from your recorded sessions';
}

/** Where a reply came from, as a short label under it. `charged` is the credits the server says it took. */
export function replySource(response) {
  switch (response?.origin) {
    case 'model': {
      const charged = known(response.charged) ? whole(response.charged) : 0;
      return charged > 0 ? `Written reply. ${plural(charged, 'AI credit')} used.` : 'Written reply. Check your AI credits for the final charge.';
    }
    case 'record': return 'From your record. Free.';
    case 'status': return 'Service status';
    default: return 'Earlier reply, source not recorded';
  }
}

/**
 * The server and older replies still say PrepOS in places (src/services and the API routes are not part of this
 * page). What the student reads uses the glossary names: Ask Mobi, and AI credits for the wallet.
 */
export function plainServerText(text) {
  return String(text ?? '')
    .replace(/\bPrepOS credits?\b/g, (m) => (m.endsWith('s') ? 'AI credits' : 'AI credit'))
    .replace(/\bPrepOS wallet\b/g, 'AI credits')
    .replace(/\bPrepOS\b/g, 'Mobi')
    .replace(/ \u2014 /g, ', ')
    .replace(/\u2014/g, ', ');
}

/** The reply shown when the chat route refuses or fails, by status. Never shows a charge that did not happen. */
export function failureReply(status, serverMessage = '') {
  if (status === 429) return { reply: 'That was a lot of questions in a short time. Wait a minute and try again.', actions: [{ label: 'Open Today', type: 'navigate', route: TODAY_HREF }] };
  if (status === 402) return { reply: `You have no AI credits left this month. Questions about your record are still free.`, actions: [{ label: 'See your plan and credits', type: 'navigate', route: '/profile#plan' }] };
  const said = plainServerText(serverMessage).trim();
  return { reply: said || 'Mobi could not answer just now. Check your AI credits to see whether one was used.', actions: [{ label: 'Open Today', type: 'navigate', route: TODAY_HREF }] };
}

export const SUGGESTIONS = Object.freeze(['Where am I losing marks?', 'Which chapter should I practise?', 'Am I spending too long?']);

/** The focus options for a written reply. `id` is what the chat route is sent as `mode`. */
export const FOCUS_OPTIONS = Object.freeze([
  Object.freeze({ id: 'mentor', label: 'Explain my next step' }),
  Object.freeze({ id: 'revision', label: 'Reason through a concept' }),
  Object.freeze({ id: 'autopsy', label: 'Reflect on my session' }),
  Object.freeze({ id: 'mock_plan', label: 'Plan a practice approach' }),
]);

export const ASK_COPY = Object.freeze({
  title: 'Ask Mobi',
  lede: 'Ask about your own record. Mobi answers from your sessions, so every number traces back to your results.',
  signedOut: 'Mobi reads your own record, so Ask Mobi needs an account.',
  empty: 'Start with something your record can answer.',
  placeholderRecord: 'What does my record show?',
  placeholderModel: 'What would you like to reason through?',
  retryTitle: 'We could not confirm that reply',
  retryBody: 'Retry the same question and it will not be charged twice. Your AI credits show the final outcome.',
  reading: 'Mobi is reading your record',
});

export { ASK_HREF };
