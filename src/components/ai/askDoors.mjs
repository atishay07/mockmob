// Ask Mobi's own page, the two doors (ASK-MOBI-1019, option B; the owner's D112 and D114). PURE: no I/O, no clock unless
// handed one. The website is the app's twin here (flutter_app lib/features/insights/data/ask_doors.dart and
// widgets/ask_doors.dart): the same words, the same order, the same prices, the same rule that every figure is read from the
// record and a line with no figure behind it is left out, never made up.
//
// "Ask now" takes any CUET doubt (typed, or one of three starters, each marked "1 credit" before the tap). "Ask your record"
// answers from the student's own papers: it leads with the biggest marks leak, then the record asks, each labelled Free,
// 1 credit or Pro. Free record answers stay free.
import { answerFromInsights } from '../../../data/prepos_insights.js';
import { creditCount } from '../../lib/creditCopy.mjs';
import { productAskFor, shortDate } from './askSuggestions.mjs';
import { shownFirstName } from '../../lib/displayName.mjs';
import { isTonightAsk } from './mobiJobs.mjs';

// ---- Words (read aloud, D84: whole sentences, no exclamation marks, arrows or emoji) -----------------------------------

export const DOOR_COPY = Object.freeze({
  title: 'Ask Mobi',
  nowTitle: 'Ask now',
  nowLine: 'Type any CUET doubt and Mobi explains it in plain words.',
  nowHint: 'Type your doubt here',
  nowTip: 'Or tap one to ask it now.',
  recordTitle: 'Ask your record',
  recordTip: 'Tap a question and Mobi answers at once.',
  emptySay: 'Your record is empty for now.',
  emptyBody: 'Finish one practice paper and Mobi can show you where every mark went.',
  emptyKey: 'Practise 10 questions first',
  emptyAfter: 'After that, you can ask where you lose marks, which chapter to practise and what to revise tonight.',
  reading: 'Mobi is reading your record.',
  readFailed: 'Your record could not be read just now. Ask now still works.',
  readOffline: 'You are offline, so your record has not loaded yet. It loads here when you are back online.',
  tryAgain: 'Try again',
  free: 'Free',
  oneCredit: '1 credit',
  pro: 'Pro',
  offline: 'You are offline. Answers from your record still work. Written answers wait until you are back online.',
  writing: 'Writing a reply',
  writingNote: 'This reply uses 1 credit. A reply that fails uses none.',
  startOver: 'Ask something new',
  followUp: 'Ask a follow-up',
  recentTitle: 'Your recent questions',
  howItCosts: 'Answers from your marks are free. A written answer uses 1 credit.',
  howItCostsNone: 'Answers from your marks stay free.',
  proDone: 'Done',
  recordInFull: 'Your record in full',
  recordInFullLink: 'See your record in full',
  recordInFullLede: 'Where your marks went, from your own saved sessions.',
  earlierReply: 'Earlier reply',
});

export const greeting = (name, sessions) => {
  const hi = name ? `Hi ${name}.` : 'Hi.';
  if (!sessions) return `${hi} Stuck on a CUET doubt? Ask me.`;
  return `${hi} Ask me any doubt, or ask what ${sessions === 1 ? 'your first paper says' : `your ${sessions} papers say`}.`;
};

/** The name Mobi may greet by: the first name a student gave, never a handle or the email's prefix (src/lib/displayName.mjs). */
export const greetName = (user) => shownFirstName(user?.name, user?.email);

export const recordLine = (sessions) => (sessions === 1 ? 'Mobi reads your first paper and answers from it.' : `Mobi reads your ${sessions} papers and answers from them.`);
export const leadFigureLine = (chapter) => `marks to win back in ${chapter}, your biggest leak`;
export const seeAll = (n) => `See all ${n} questions about your record`;
export const seeFewer = 'Show fewer questions';
export const chaptersRanked = (n) => `${n} ${n === 1 ? 'chapter' : 'chapters'} ranked from your answers`;
// v13 (C-dec 3, D157): "What should I revise tonight?" is read from the record, free: the chapters, the rules and the traps.
export const revisePreview = (when = 'tonight') => `Your chapters, rules and traps for ${when}`;
export const pacePreviewLocked = 'Timing from your timed papers';
export const changesPreviewLocked = 'From the answers you changed';
export const changesPreview = (count, gains, losses) => `${count} ${count === 1 ? 'change' : 'changes'}: ${gains} helped, ${losses} hurt`;
export const lastPaperLead = 'Your last paper was ';

/** "tonight" from 4:00 PM to 4:59 AM, otherwise "today" (the app's tonightOrToday). */
export function tonightOrToday(now = new Date()) {
  const h = now.getHours();
  return h >= 16 || h < 5 ? 'tonight' : 'today';
}

// ---- Ask now ------------------------------------------------------------------------------------------------------

/**
 * Starters per subject: common CUET doubts, each a question the model answers. None is answered from the record, so none is
 * marked "1 credit" and then answered free (a test holds this).
 */
export const ASK_NOW_BANK = Object.freeze({
  accountancy: ['Explain the sacrificing ratio in simple words', 'How is goodwill valued by the super profit method?', 'What is the difference between shares and debentures?'],
  economics: ['What is price elasticity of demand?', 'Explain the investment multiplier in simple words', 'Why does the demand curve slope downwards?'],
  business_studies: ['Explain Fayol’s principles of management in simple words', 'What is the difference between delegation and decentralisation?'],
  english: ['How do I find the main idea of a passage?', 'How do I solve para jumbles faster?'],
  mathematics: ['How do I find the inverse of a 2 by 2 matrix?', 'Explain the chain rule in simple words'],
  general_test: ['How do I solve blood relation questions quickly?', 'How do I find a percentage increase in my head?'],
  physics: ['Explain Gauss’s law in simple words'],
  chemistry: ['How do I balance a redox equation?'],
  biology: ['Explain how DNA replication works in simple words'],
  history: ['What were the main features of the Harappan cities?'],
  political_science: ['What did the Non-Aligned Movement stand for?'],
  geography: ['What is the difference between weather and climate?'],
  psychology: ['What is the difference between a trait and a type?'],
  sociology: ['What does social stratification mean?'],
  computer_science: ['What is the difference between a list and a tuple in Python?'],
});

const SUBJECT_NAMES = Object.freeze({
  accountancy: 'Accountancy', economics: 'Economics', business_studies: 'Business Studies', english: 'English', mathematics: 'Mathematics',
  general_test: 'General Test', physics: 'Physics', chemistry: 'Chemistry', biology: 'Biology', history: 'History',
  political_science: 'Political Science', geography: 'Geography', psychology: 'Psychology', sociology: 'Sociology', computer_science: 'Computer Science',
});

/** A subject id as the bank keys it ("gat" is the General Test; ids are lower-case with underscores). */
export function canonicalSubject(id) {
  const key = String(id ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return key === 'gat' ? 'general_test' : key;
}

const ready = (insights) => insights?.state === 'ready';

/**
 * The three Ask now starters, in order. A student with a record leads with their own weakest chapter (T001); the rest come
 * from their subjects, one subject at a time. With no subjects the Commerce set the design was drawn with stands in. A set
 * with few starters of its own is filled from the parts every CUET student sits, so there are always three.
 */
export function askNowStarters({ insights = null, subjects = [] } = {}) {
  const out = [];
  const add = (s) => { if (s && !out.includes(s) && out.length < 3) out.push(s); };
  const top = ready(insights) ? String(insights.chapters?.ranked?.[0]?.chapter || '').trim() : '';
  if (top) add(`Explain ${top} in simple words`);
  const lists = (subjects || []).map((s) => ASK_NOW_BANK[canonicalSubject(s)]).filter(Boolean);
  if (!lists.length) lists.push(ASK_NOW_BANK.accountancy, ASK_NOW_BANK.economics, ASK_NOW_BANK.english);
  for (let round = 0; out.length < 3 && round < 3; round += 1) for (const l of lists) if (round < l.length) add(l[round]);
  for (const s of [...ASK_NOW_BANK.english, ...ASK_NOW_BANK.general_test]) add(s);
  return out;
}

/** More ideas from the student's own subjects, beyond the three shown (at most three more); [] when the bank has no more. */
export function moreStarters({ insights = null, subjects = [] } = {}) {
  const shown = new Set(askNowStarters({ insights, subjects }));
  const out = [];
  const lists = (subjects || []).map((s) => ASK_NOW_BANK[canonicalSubject(s)]).filter(Boolean);
  for (let round = 0; round < 3; round += 1) for (const l of lists) if (round < l.length && !shown.has(l[round]) && !out.includes(l[round]) && out.length < 3) out.push(l[round]);
  return out;
}

/** "Accountancy, Economics and English": the student's subjects that have ideas, at most three. */
export function subjectsLine(subjects = []) {
  const names = [...new Set((subjects || []).map(canonicalSubject).filter((s) => ASK_NOW_BANK[s]))].slice(0, 3).map((s) => SUBJECT_NAMES[s] || s);
  if (names.length <= 1) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

export const moreIdeasLabel = (subjects) => { const line = subjectsLine(subjects); return line ? `See more ideas for ${line}` : 'See more ideas'; };
export const fewerIdeasLabel = 'Show fewer ideas';

/**
 * What typed text costs, said under the field before it is sent: 'free' when the record or the help answers can answer it,
 * else 'credit'; null for an empty field. Unknown is the price, never free.
 */
export function priceOfTyped(text, { insights = null, status = 'loading', pro = false } = {}) {
  const t = String(text || '').trim();
  if (!t) return null;
  if (productAskFor(t)) return 'free';
  if (isTonightAsk(t)) return 'free';
  if ((status === 'ready' || status === 'empty') && answerFromInsights(t, insights ?? { state: 'empty' }, { pro })) return 'free';
  return 'credit';
}

// ---- Ask your record ----------------------------------------------------------------------------------------------

/**
 * The record's own biggest leak: its top-ranked chapter and that chapter's figure, { lost, chapter }, or null when no chapter is
 * ranked yet. The ranking and the figure are the record's (data/prepos_insights.js: chapters ranked by the marks to win back,
 * `open`; the record below the doors prints the same number as "marks to win back"), never worked out a second way here, so one
 * chapter has one number on the page and the door names the chapter the answer names.
 */
export function recordLead(insights) {
  if (!ready(insights)) return null;
  const top = (insights.chapters?.ranked || [])[0];
  const name = String(top?.chapter || '').trim();
  const lost = Number(top?.open);
  return name && Number.isFinite(lost) && lost > 0 ? { lost, chapter: name } : null;
}

const sec = (s) => (s >= 60 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : `${Math.round(s)}s`);

function paceLine(insights) {
  const p = insights?.pace;
  if (!p?.usable) return null;
  if (p.medianWrongSec && p.medianRightSec) return `Wrong answers take ${sec(p.medianWrongSec)}, right ones ${sec(p.medianRightSec)}`;
  return p.medianSec ? `A typical question takes ${sec(p.medianSec)}` : null;
}

// ---- The last paper -----------------------------------------------------------------------------------------------

const SUBJECT_LABEL = (id) => SUBJECT_NAMES[canonicalSubject(id)] || String(id || '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) || 'Practice';
const whole = (n) => Number.isFinite(n) && n >= 0;

/**
 * A paper whose marks may be shown: scored, with a total, and not sealed. The web opens a paper's result at /result/<id> for
 * every type, so there is no separate unopened state today; a paper that carries `sealed: true`, or has no marks, never has
 * its score printed (the app's verifier found a last-paper row printing the score of a paper still sealed).
 */
export function paperIsOpen(p) {
  return Boolean(p && typeof p.id === 'string' && p.id) && p.sealed !== true && p.resultOpened !== false && Number.isFinite(p.marks) && Number.isFinite(p.maxMarks) && p.total > 0;
}

/** Every paper type opens the one result page. The id is encoded, and nothing else is accepted. */
export const resultHref = (id) => (typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id) ? `/result/${encodeURIComponent(id)}` : null);

/** "Accountancy full mock", "Economics Quick 10": the row's short label. */
export function paperName(p) {
  const subject = SUBJECT_LABEL(p.subject);
  if (p.mode === 'full') return `${subject} full mock`;
  if (p.mode === 'nta') return `${subject} NTA mock`;
  if (p.mode === 'smart') return `${subject} Smart practice`;
  return `${subject} Quick ${p.total}`;
}

/** The paper inside a sentence: "the Accountancy full mock", "the Economics set of 10 questions". */
export function paperPhrase(p) {
  const subject = SUBJECT_LABEL(p.subject);
  if (p.mode === 'full') return `the ${subject} full mock`;
  if (p.mode === 'nta') return `the ${subject} mock in NTA mode`;
  if (p.mode === 'smart') return `the ${subject} Smart practice set`;
  return `the ${subject} set of ${p.total} questions`;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "today", "yesterday", "Thursday" within the week, otherwise "12 Oct". */
export function paperDay(at, now = Date.now()) {
  const a = new Date(at); const n = new Date(now);
  const days = Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return WEEKDAYS[a.getDay()];
  return `${a.getDate()} ${MONTHS[a.getMonth()]}`;
}

const signed = (n) => (n < 0 ? `−${-n}` : String(n));

/**
 * The student's latest paper, read from its own answers: { id, href, preview, reply, actions }, or null. `item` is the newest
 * row of GET /api/attempts/summary; `analysis` (optional) is analyseSession() of the saved paper, for the chapters that cost
 * the most. The newest paper is the last paper: a sealed one is not skipped for an older one, so the ask is left out and no
 * figure is printed. With no analysis the answer says the marks and the wrong and blank counts it can read.
 */
export function lastPaper(item, { analysis = null, now = Date.now() } = {}) {
  if (!paperIsOpen(item)) return null;
  const href = resultHref(item.id);
  if (!href) return null;
  const day = paperDay(item.completedAt, now);
  const marks = `${signed(item.marks)} of ${item.maxMarks}`;
  const lost = Math.max(0, item.maxMarks - item.marks);
  const on = day === 'today' || day === 'yesterday' ? day : `on ${day}`;
  const opening = `${lastPaperLead}${paperPhrase(item)} you sat ${on}. It scored ${marks} marks.`;
  const gap = analysis?.marks?.gap;
  const chapters = (analysis?.chapters || []).filter((c) => c?.chapter && whole(c.gap) && c.gap > 0).slice(0, 3);
  let reply;
  if (lost <= 0) reply = `${opening} It lost no marks at all.`;
  else if (chapters.length && whole(gap) && gap > 0) {
    const lines = chapters.map((c) => {
      const how = [c.wrong ? `${c.wrong} wrong` : null, c.blank ? `${c.blank} blank` : null].filter(Boolean).join(' and ');
      return `${c.chapter}: ${c.gap} ${c.gap === 1 ? 'mark' : 'marks'}${how ? `, from ${how}` : ''}.`;
    });
    reply = `${opening} It lost ${gap} marks, and these chapters cost the most:\n${lines.join('\n')}`;
  } else {
    const w = item.wrong || 0; const b = item.unattempted || 0;
    const cause = [w ? `${w} wrong ${w === 1 ? 'answer' : 'answers'}` : null, b ? `${b} left blank` : null].filter(Boolean).join(' and ');
    reply = `${opening} It lost ${lost} marks${cause ? `, from ${cause}` : ''}.`;
  }
  return { id: item.id, href, preview: `${paperName(item)}, ${marks}, ${day}`, reply, actions: [{ label: 'See this paper', route: href }] };
}

export const LAST_PAPER_ASK = 'Why did I lose marks in my last paper?';

/**
 * Every record ask, in the door's order: the lead first, then the rest. The count of this list is the "See all" number. With no
 * paper to read, the last-paper ask is left out. Pro asks stay visible with price 'pro' while the student is on Free (D101);
 * on Pro they are free.
 */
export function recordDoorAsks(insights, { pro = false, last = null, now = new Date() } = {}) {
  const isReady = ready(insights);
  const lead = recordLead(insights);
  const week = isReady ? insights.week?.thisWeek : null;
  const changes = isReady ? insights.changes : null;
  const ranked = isReady ? insights.chapters?.ranked || [] : [];
  return [
    { id: 'losing', text: 'Where am I losing marks?', price: 'free', preview: lead ? `${lead.lost} marks to win back in ${lead.chapter}` : 'Reads your wrong and blank answers' },
    { id: 'chapter', text: 'Which chapter should I practise?', price: 'free', preview: ranked.length ? chaptersRanked(ranked.length) : 'Ranks the chapters costing you the most marks' },
    ...(last ? [{ id: 'last', text: LAST_PAPER_ASK, price: 'free', preview: last.preview, answer: last }] : []),
    { id: 'revise', text: `What should I revise ${tonightOrToday(now)}?`, price: 'free', preview: revisePreview(tonightOrToday(now)), tonight: true },
    { id: 'pace', text: 'Am I too slow on wrong answers?', price: pro ? 'free' : 'pro', locked: !pro, preview: pro ? paceLine(insights) || 'Needs timed answers' : pacePreviewLocked },
    {
      id: 'week', text: 'How is my week going?', price: 'free',
      preview: !week ? 'Counts your last 7 days' : week.sessions === 0 ? 'No papers in the last 7 days' : `${week.sessions} ${week.sessions === 1 ? 'paper' : 'papers'}, ${week.questions} questions in 7 days`,
    },
    {
      id: 'changes', text: 'Do I change answers too much?', price: pro ? 'free' : 'pro', locked: !pro,
      preview: pro ? (changes?.count > 0 ? changesPreview(changes.count, changes.gains, changes.losses) : 'Needs timed answers') : changesPreviewLocked,
    },
  ];
}

/** The price word said on a row before the tap, for people who hear it: Free, 1 credit, or Part of Pro. */
export const priceWord = (price) => (price === 'free' ? DOOR_COPY.free : price === 'credit' ? DOOR_COPY.oneCredit : 'Part of Pro');

// ---- The credit line ----------------------------------------------------------------------------------------------

/** "1 Nov" with a no-break space, so the date is never split across two lines. */
const day = (wallet) => (shortDate(wallet?.resetAt) || '').replace(' ', ' ');

/**
 * The two lines at the foot of the doors, from the wallet's own numbers (the app's creditLineWords). Every number is the
 * wallet's: an unknown balance is never a zero, and a pause says so. { first, second, link } where `first` is the link to the
 * credit details.
 */
export function creditLine(wallet) {
  if (!wallet) return { first: 'Reading your credits', second: DOOR_COPY.howItCosts, known: false };
  if (wallet.state === 'paused') return { first: 'Written answers are paused just now.', second: 'Answers from your marks still work.', known: false };
  if (!wallet.known || !Number.isFinite(wallet.total)) return { first: 'See your credits', second: DOOR_COPY.howItCosts, known: false };
  const d = day(wallet);
  if (wallet.total <= 0) return { first: `You have no credits left.${d ? ` Your free credits refill on ${d.replace(' ', ' ')}.` : ''}`, second: DOOR_COPY.howItCostsNone, known: true };
  const bought = (wallet.bonusCredits || 0) > 0 || (wallet.balanceCredits || 0) > 0 || (wallet.heldCredits || 0) > 0;
  const monthly = wallet.includedMonthlyCredits;
  const when = d ? ` · they refill on ${d}` : '';
  if (!bought && Number.isFinite(monthly) && wallet.total <= monthly) {
    return { first: `${wallet.total} of your ${monthly} free credits left${when}`, second: DOOR_COPY.howItCosts, known: true };
  }
  const free = d ? ` · free ones refill on ${d}` : '';
  return { first: `${wallet.total === 1 ? '1 credit' : `${wallet.total} credits`} left${free}`, second: DOOR_COPY.howItCosts, known: true };
}

/**
 * The line under the field, before anything is sent: what the question in the field will cost and who writes the reply (the
 * app's askNoteIdle, askNoteFree, askNoteCost, askNoteEmpty and askPausedLine). Said quietly; a tap or Send goes straight to the
 * answer. `price` is priceOfTyped(): null (nothing typed), 'free' or 'credit'.
 */
export function noteFor(price, wallet) {
  if (wallet?.state === 'paused') return 'AI replies are paused just now. Questions about your record still work.';
  const empty = Boolean(wallet?.known) && Number.isFinite(wallet.total) && wallet.total <= 0;
  if (price === 'free') return 'Free. Mobi answers this from your record.';
  if (empty) {
    const d = shortDate(wallet.resetAt);
    return `No credits left.${d ? ` They refill on ${d}.` : ''} Questions about your record stay free.`;
  }
  const writes = 'An AI service writes Mobi’s replies';
  const balance = wallet?.known && Number.isFinite(wallet.total) ? wallet.total : null;
  if (balance === null) return `${writes} · 1 credit`;
  if (balance === 1) return `${writes} · your last credit`;
  return `${writes} · 1 of your ${balance} credits`;
}

// ---- Your recent questions ----------------------------------------------------------------------------------------

/** "Thursday 15 Oct, 9:40 pm" in the device's own clock (12-hour). `timeZone` is for tests only. */
export function clockStamp(at, { timeZone } = {}) {
  const t = typeof at === 'number' ? at : Date.parse(at || '');
  if (!Number.isFinite(t)) return '';
  const parts = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, ...(timeZone ? { timeZone } : {}) }).formatToParts(new Date(t));
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return `${get('weekday')} ${get('day')} ${get('month')}, ${get('hour')}:${get('minute')} ${get('dayPeriod').toLowerCase()}`;
}

/**
 * What a saved reply cost, in words: a written reply says the credits it really used, a record answer says free, anything else
 * says nothing. A written reply with no charge saved (0) claims no cost, never "1 credit" (release 11 fix pass D).
 */
export function costOf(row) {
  if (row.origin === 'model') return Number(row.charged) > 0 ? `Written answer · ${creditCount(Number(row.charged))}` : 'Written answer';
  if (row.origin === 'record') return 'From your record · free';
  return null;
}
