// What the /mentor page's ask does when it reaches the docked panel (release 11 fix pass D, the money item). PURE: no I/O.
//
// The doors hand the panel one ask to run as it opens. A record ask is marked `free`: the student was shown "Free" before the
// tap, so it is answered from the record or not at all, and NEVER goes out as a written reply that spends a credit. The old
// effect fell through to a paid reply whenever the panel's own read of the record had not produced an answer, so a failed read
// turned a "Free" ask into a charged one. Here the outcomes are named, and a free ask has no path to 'paid'.
import { answerFromInsights } from '../../../data/prepos_insights.js';
import { productAskFor, recordSource } from './askSuggestions.mjs';

export const RECORD_NOT_READ = 'Your record could not be read just now. Nothing was charged.';
export const RECORD_NO_ANSWER = 'Mobi could not answer that from your record just now. Nothing was charged.';

/**
 * @param {object} a
 * @param {{text?: string, answer?: object, free?: boolean}|null} a.initial the ask the page handed over
 * @param {string} a.status the record's status in the panel: loading, ready, empty or unavailable
 * @param {object|null} a.insights the record
 * @param {boolean} a.pro
 * @param {object|null} a.wallet
 * @param {boolean} a.offline
 * @param {{open: boolean, why: string|null}} a.paid paidState(wallet)
 * @returns {{kind: 'none'|'wait'|'page'|'product'|'record'|'say'|'record-failed'|'paid', ...}}
 */
export function planStart({ initial, status, insights, pro = false, wallet = null, offline = false, paid = { open: false, why: null } }) {
  if (!initial?.text) return { kind: 'none' };
  const text = String(initial.text).trim();
  if (initial.answer) return { kind: 'page', text, answer: initial.answer };
  const product = productAskFor(text);
  if (product) return { kind: 'product', text, product };
  if (status === 'loading') return { kind: 'wait' };
  const fromRecord = status === 'ready' || status === 'empty' ? answerFromInsights(text, insights ?? { state: 'empty' }, { pro }) : null;
  if (fromRecord) return { kind: 'record', text, answer: { reply: fromRecord.reply, actions: (fromRecord.actions || []).slice(0, 1), source: recordSource(insights) } };
  // A free ask stops here: no record answer means no answer, never a paid reply.
  if (initial.free === true) return { kind: 'record-failed', text, reply: status === 'unavailable' ? RECORD_NOT_READ : RECORD_NO_ANSWER };
  if (!wallet) return { kind: 'wait' };
  if (offline) return { kind: 'say', text, reply: 'This was not sent because you are offline. No credit was used.', actions: [] };
  if (!paid.open) return { kind: 'say', text, reply: paid.why, actions: [{ label: 'See your credits', route: '/wallet' }] };
  return { kind: 'paid', text };
}
