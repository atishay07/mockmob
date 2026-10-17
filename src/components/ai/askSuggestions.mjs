// What Ask Mobi offers first, and what each ask costs (ASK-MOBI-1018, sections 2 to 4). Pure, so a test holds every word
// and every price. The panel never shows a form before the first answer: the screen's context and the student's own record
// decide the asks, and each ask carries its price. A preview line is never invented: with no record line, it is omitted.
//
// Prices: an ask the record can answer is free (the same rule as the chat route, which answers record questions before any
// model call). Anything that needs a written reply costs 1 AI credit, and says so before it is sent (W-060).
import { answerFromInsights, readout } from '../../../data/prepos_insights.js';
import { FAQ_ITEMS } from '../../lib/helpFaq.mjs';

export const ASK_COST = 1;

/** The written-reply mode each context asks the model for (the chat route's `mode`). */
export function modeFor(kind) {
  if (kind === 'question') return 'revision';
  if (kind === 'mock') return 'autopsy';
  if (kind === 'practice') return 'mock_plan';
  return 'mentor';
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const sec = (s) => (s >= 60 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : `${Math.round(s)}s`);
const ready = (insights) => insights?.state === 'ready';

/** A chapter row from the record by name, or null. Ranked chapters first, then the thin ones. */
export function findChapter(insights, name) {
  if (!ready(insights) || !name) return null;
  const want = String(name).toLowerCase().trim();
  const rows = [...(insights.chapters?.ranked || []), ...(insights.chapters?.thin || [])];
  return rows.find((c) => String(c.chapter).toLowerCase() === want)
    || rows.find((c) => String(c.chapter).toLowerCase().startsWith(want) || want.startsWith(String(c.chapter).toLowerCase()))
    || null;
}

const topChapter = (insights) => (ready(insights) ? insights.chapters?.ranked?.[0] || null : null);
const chapterLine = (c) => `${c.wrong} wrong of ${c.n} answered, in ${plural(c.sessions, 'session')}`;

/** "9 sessions", "no sessions yet", or null while the record is loading or could not be read. */
export function sessionsLabel(insights, status) {
  if (status === 'ready' && ready(insights)) return plural(insights.sessions, 'session');
  if (status === 'empty' || insights?.state === 'empty') return 'no sessions yet';
  return null;
}

/** The record chip's three-line summary: marks ledger, biggest leak, pace. Real figures only. */
export function recordSummary(insights, { pro = false } = {}) {
  if (!ready(insights)) return [];
  const l = insights.ledger;
  const top = topChapter(insights);
  const p = insights.pace;
  return [
    { id: 'ledger', label: 'Marks ledger', text: `${l.net} net marks from ${plural(insights.questions, 'question')} in ${plural(insights.sessions, 'session')}` },
    { id: 'leak', label: 'Biggest leak', text: top ? `${top.chapter}, ${top.open} of ${l.open} open marks` : 'No chapter has enough answers to rank yet' },
    { id: 'pace', label: 'Pace', text: !pro ? 'Pace detail is part of Pro' : p?.usable && p.medianSec ? `A typical question takes ${sec(p.medianSec)}, across ${plural(p.questionsTimed, 'timed question')}` : 'Not enough timed questions for pace yet' },
  ];
}

/** "From your record, 4 sessions and 34 questions". */
export function recordSource(insights) {
  if (!ready(insights)) return 'From your record';
  return `From your record, ${plural(insights.sessions, 'session')} and ${plural(insights.questions, 'question')}`;
}

const product = (id) => FAQ_ITEMS.find((item) => item.id === id);

// Every ask Mobi can offer. `free` asks are answered here from the record or the product's own answers; `paid` asks are
// sent as written replies, with the label as the message.
function catalogue(context, insights, { pro }) {
  const chapterName = context.chapter || topChapter(insights)?.chapter || null;
  const chapter = findChapter(insights, chapterName);
  const top = topChapter(insights);
  const p = insights?.pace;
  const q = context.number ? `Q${context.number}` : 'this question';
  return {
    explain_key: context.blank
      ? { price: 'paid', label: 'Why is the key right?', line: 'Uses this question and the key' }
      : { price: 'paid', label: context.pickLabel && context.keyLabel ? `Why is ${context.keyLabel} right and ${context.pickLabel} wrong?` : 'Why is the key right and my answer wrong?', line: 'Uses this question, your pick and the key' },
    misread: { price: 'paid', label: context.blank ? 'What should I look for first?' : 'What did I misread?', line: `Points to the words in ${q} that decide the answer` },
    quick_check: { price: 'paid', label: 'Give me a quick check for this idea', line: 'A one-line test to run before answering' },
    chapter_history: chapterName ? { price: 'free', label: `Have I missed ${chapterName} before?`, line: chapter ? chapterLine(chapter) : null } : null,
    marks_leak: { price: 'free', label: 'Where am I losing marks?', line: top ? `${top.chapter}, ${top.open} of ${insights.ledger.open} open marks` : null },
    pace: { price: 'free', label: 'Where am I losing time?', line: pro && p?.usable && p.medianSec ? `A typical question takes ${sec(p.medianSec)}` : null },
    week: { price: 'free', label: 'How did this week go?', line: ready(insights) && insights.week?.thisWeek?.sessions ? `${plural(insights.week.thisWeek.sessions, 'session')} in the last 7 days` : null },
    mock_change: { price: 'paid', label: 'What should I change before the next mock?', line: 'Uses this mock and your record' },
    plan_talk: { price: 'paid', label: 'Talk me through this step', line: 'Uses the step and your record' },
    practice_plan: { price: 'paid', label: chapterName ? `How should I practise ${chapterName}?` : 'How should I practise this week?', line: 'Uses your record' },
    credits_help: { price: 'free', label: 'How do AI credits work?', line: null },
    nta_help: { price: 'free', label: 'What is NTA mode?', line: null },
  };
}

// The asks offered first for each context, in order. The record asks only appear when the record can answer them.
const ORDER = {
  question: ['explain_key', 'misread', 'chapter_history', 'quick_check', 'marks_leak'],
  mock: ['chapter_history', 'mock_change', 'pace', 'week'],
  today: ['marks_leak', 'plan_talk', 'week', 'pace'],
  practice: ['pace', 'practice_plan', 'week', 'marks_leak'],
  page: ['marks_leak', 'week', 'pace', 'practice_plan'],
};

/**
 * The asks for this context: [{ id, label, line, price }]. `asked` holds ids already used, so "Ask next" never repeats.
 * A new student (no sessions) gets the product asks, which are free. With the record unreadable, record asks are left out.
 */
export function suggestionsFor({ context, insights = null, status = 'loading', pro = false, asked = [], limit = 3 } = {}) {
  const kind = context?.kind || 'page';
  const all = catalogue(context || {}, insights, { pro });
  const recordUsable = status === 'ready' && ready(insights);
  const isNew = status === 'empty' || insights?.state === 'empty';
  let ids = ORDER[kind] || ORDER.page;
  if (isNew && kind !== 'question') ids = ['credits_help', 'nta_help'];
  const out = [];
  for (const id of ids) {
    const ask = all[id];
    if (!ask || asked.includes(id)) continue;
    if (ask.price === 'free' && !['credits_help', 'nta_help'].includes(id) && !recordUsable) continue;
    // The opening answer of a mock, Today or Practice already covers the biggest leak.
    if (id === 'marks_leak' && kind !== 'page' && kind !== 'question' && kind !== 'today') continue;
    out.push({ id, label: ask.label, line: ask.line || null, price: ask.price });
    if (out.length >= limit) break;
  }
  return out;
}

/** A free ask answered here: { reply, actions, source }. Null for a paid ask (it needs a written reply). */
export function answerFree(id, { context = {}, insights = null, pro = false } = {}) {
  if (id === 'credits_help' || id === 'nta_help') {
    const item = product(id === 'credits_help' ? 'credits' : 'nta');
    return { reply: item.answer.join(' '), actions: id === 'credits_help' ? [{ label: 'See your AI credits', route: '/pricing/ai-credits' }] : [], source: 'From the MockMob help answers' };
  }
  if (!ready(insights)) {
    if (['chapter_history', 'marks_leak', 'pace', 'week'].includes(id)) {
      return { reply: 'There is nothing to read yet. After one session Mobi can show where your marks went.', actions: [{ label: 'Take a 10-question check', route: '/dashboard?mode=quick&count=10' }], source: 'From your record, no sessions yet' };
    }
    return null;
  }
  const source = recordSource(insights);
  if (id === 'chapter_history') {
    const name = context.chapter || topChapter(insights)?.chapter;
    const c = findChapter(insights, name);
    if (!c) {
      return { reply: `Your record has no misses in ${name} yet. A chapter shows here once you have answered questions from it.`, actions: [], source };
    }
    const reply = `${c.chapter} (${c.subjectName}): ${c.right} right, ${c.wrong} wrong and ${c.skip} left blank, out of ${c.n} questions over ${plural(c.sessions, 'session')}. Those ${c.wrong + c.skip} questions were worth ${c.open} marks.`;
    return { reply, actions: [{ label: `Practise 10 ${c.chapter} questions`, route: `/dashboard?subject=${encodeURIComponent(c.subject)}&mode=quick&count=10` }], source };
  }
  const textFor = { marks_leak: 'where am i losing marks', pace: 'am i spending too long time', week: 'how did this week go progress' };
  if (!textFor[id]) return null;
  const hit = answerFromInsights(textFor[id], insights, { pro });
  return hit ? { reply: hit.reply, actions: (hit.actions || []).slice(0, 1), source } : null;
}

/**
 * The answer already shown when Mobi opens from a mock, Today or Practice (free, no tap needed), or null for a question
 * or the page. The opener's own lines win (a mock's chapter figures, Today's facts); otherwise the record answers.
 */
export function openingFor({ context = {}, insights = null, status = 'loading', pro = false } = {}) {
  const kind = context.kind;
  if (kind !== 'mock' && kind !== 'today' && kind !== 'practice') return null;
  const lines = context.lines || [];
  if (kind === 'today' && (context.reason || lines.length)) {
    return { ask: 'Why this step?', reply: [context.reason, ...lines].filter(Boolean).join(' '), actions: [], source: status === 'ready' ? recordSource(insights) : 'From your plan' };
  }
  if (kind === 'mock' && lines.length) {
    return { ask: `Where did the marks go in ${context.label || 'this mock'}?`, reply: lines.join(' '), actions: [], source: `From ${context.label || 'this mock'}` };
  }
  if (status !== 'ready' && status !== 'empty') return null;
  const ask = kind === 'practice' ? 'What should I practise?' : kind === 'today' ? 'Why this step?' : 'Where am I losing marks?';
  const answer = answerFree('marks_leak', { context, insights, pro });
  return answer ? { ask, ...answer } : null;
}

/** Product questions the help answers cover, matched loosely. Null when the text is not one of them. */
export function productAskFor(text) {
  const q = ` ${String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ')} `;
  if (/ (ai )?credits? /.test(q) && / (how|what|work|left|reset|renew) /.test(q)) return 'credits_help';
  if (/ nta (mode )?/.test(q) && / (what|how) /.test(q)) return 'nta_help';
  return null;
}

/**
 * What typed text costs, shown under the composer before it is sent. With a question attached a typed ask is always a
 * written reply (a record answer cannot discuss a question). Otherwise free when the record or the help answers can
 * answer it, else 1 AI credit. Unknown is shown as the price, never as free.
 */
export function priceForText(text, { insights = null, status = 'loading', pro = false, hasQuestion = false } = {}) {
  const t = String(text || '').trim();
  if (!t) return null;
  if (hasQuestion) return 'paid';
  if (productAskFor(t)) return 'free';
  if ((status === 'ready' || status === 'empty') && answerFromInsights(t, insights ?? { state: 'empty' }, { pro })) return 'free';
  return 'paid';
}

/** The record finding that leads, for a preview elsewhere (Practice's row). Null without one. */
export function leadFinding(insights) {
  return ready(insights) ? readout(insights, { limit: 1 })[0] || null : null;
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "1 Nov" in India time, or null. */
export function shortDate(iso) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return null;
  const d = new Date(t + 19_800_000);
  return `${d.getUTCDate()} ${SHORT_MONTHS[d.getUTCMonth()]}`;
}

/**
 * The one wallet line under the composer: { count, rest, reset }. "8 of 10 AI credits left", "resets 1 Nov". Purchased
 * credits make "of 10" untrue, so then it is the total alone. Unknown is never written as 0.
 */
export function walletLine(wallet) {
  if (!wallet) return { count: null, rest: 'Reading AI credits', reset: null };
  if (!wallet.known) return { count: null, rest: wallet.state === 'paused' ? 'Written replies are paused' : 'AI credits could not be read', reset: null };
  const reset = shortDate(wallet.resetAt);
  if (wallet.bonusCredits > 0 || !Number.isFinite(wallet.includedMonthlyCredits)) {
    return { count: wallet.total, rest: `AI credit${wallet.total === 1 ? '' : 's'} left`, reset: reset ? `resets ${reset}` : null };
  }
  return { count: wallet.includedRemaining, rest: `of ${wallet.includedMonthlyCredits} AI credits left`, reset: reset ? `resets ${reset}` : null };
}

/** Whether a paid ask can be sent now, and the plain words when it cannot. */
export function paidState(wallet) {
  if (!wallet) return { open: false, why: 'Reading your AI credits.' };
  if (wallet.state === 'available' && wallet.known && wallet.total > 0) return { open: true, why: null };
  if (wallet.state === 'paused') return { open: false, why: 'Written replies are paused for now. Questions about your record stay free. Nothing is charged from here.' };
  if (wallet.known && wallet.total <= 0) {
    const reset = shortDate(wallet.resetAt);
    return { open: false, why: `0 of ${wallet.includedMonthlyCredits ?? 10} AI credits left.${reset ? ` They reset on ${reset}.` : ''} Questions about your record stay free. Nothing is charged from here.` };
  }
  return { open: false, why: 'Your AI credits could not be read, so written replies wait. Questions about your record stay free. Nothing is charged.' };
}
