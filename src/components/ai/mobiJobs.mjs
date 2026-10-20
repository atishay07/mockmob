// Mobi's v13 jobs on the website (C-dec 3 and 3b, D157; contract MOBI-CONTRACT 20 Oct 2026). PURE: no I/O, no clock.
//
// Why a student picks Mobi over a free chatbot: Mobi works on the student's own record and acts. What it reads from the
// record is free (Where you stand, What should I revise tonight). One credit buys a finished job, never talk: a doubt
// settled and then tested on 2 new CUET-style questions (one follow-up included), or a mistake fixed for good. Pro does not make
// Mobi free: every Mobi job costs 1 credit on every plan, so nothing here says "Included in Pro" or "fair use".
//
// Every figure below comes from the server's answer; a line with no figure behind it is left out, never made up.
import { getCanonicalChapters } from '../../../data/canonical_syllabus.js';

// ---- Words (plain, warm, whole sentences; no exclamation marks, no arrows) ------------------------------------------------

export const JOB_COPY = Object.freeze({
  // Where you stand
  standTitle: 'Where you stand',
  standReading: 'Working out where you stand.',
  standFailed: 'Where you stand could not be worked out just now. Nothing was charged.',
  standOffline: 'You are offline. Where you stand loads here when you are back online.',
  standEmpty: 'Finish one scored paper and Mobi sets your practice against your colleges.',
  standThin: 'Mobi gives a range once a paper has 30 questions answered or skipped.',
  standCompare: 'Mobi compares you with your colleges once all 4 papers DU adds up have a range: 1 language and 3 domain subjects.',
  addColleges: 'Add your colleges',
  addCollegesLine: 'Add the colleges you want, and Mobi sets your range against their 2026 Round 1 closing marks.',
  noCutoffLine: 'None of your colleges has a 2026 Round 1 closing mark yet, so there is no gap to show.',
  closeGap: 'What closes the gap fastest',
  mostOpen: 'Where your marks are most open',
  otherColleges: (n) => `Your other ${n === 1 ? 'college' : `${n} colleges`}`,
  tryAgain: 'Try again',
  // Ask now
  creditBuys: '1 credit settles a doubt: Mobi’s answer, one follow-up, and 2 new CUET-style questions to test it.',
  startersTip: 'From the chapters your practice says you miss. Each one is a doubt, for 1 credit.',
  startersTipFresh: 'Tap one to ask it now, for 1 credit.',
  // The thread
  checksTitle: 'Test it on 2 new CUET-style questions',
  checksLead: (chapter) => `New, checked questions${chapter ? ` on ${chapter}` : ''} that you have not seen. They come with this doubt, so there is no extra credit.`,
  checksFinding: (chapter) => (chapter ? `Finding 2 questions on ${chapter}.` : 'Finding 2 questions.'),
  checksFailed: 'The 2 questions could not be loaded just now. Nothing extra was charged.',
  pickChapter: 'Pick the chapter',
  submit: 'Check my answer',
  marking: 'Marking your answer',
  firstCounts: 'Your first answer counts.',
  markFailed: 'The mark could not be confirmed. Try again. Your answer is counted once.',
  explanation: 'Explanation',
  questionOf: (i, n) => `Question ${i} of ${n}`,
  followUpFree: 'Your one follow-up on this doubt is free.',
  followUpPlaceholder: 'Ask your follow-up, free',
  newDoubt: 'Ask a new doubt (1 credit)',
  newDoubtPlaceholder: 'Type a new doubt',
  settled: 'This doubt has had its follow-up.',
  followUpSource: 'Follow-up on this doubt. No credit used.',
  // Tonight
  tonightChapters: 'Chapters to look at',
  tonightRules: 'Your rules to keep',
  tonightTraps: 'Traps that catch you',
  tonightSource: 'From your record. Free.',
  tonightOffline: 'You are offline, so Mobi could not read your record for tonight. Nothing was charged.',
  // Failures
  nothingCharged: 'Nothing was charged.',
  failed: 'Mobi could not answer just now. Nothing was charged.',
  tooMany: 'Too many questions in a short time. Wait a minute and try again. Nothing was charged.',
});

const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Marks as a student reads them: whole when whole, else one decimal ("66", "66.5"). Unknown is null, never 0. */
export function marksWord(n) {
  const v = num(n);
  if (v === null) return null;
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

// ---- Where you stand (GET /api/mobi/standing; free, no model) -------------------------------------------------------------

const SAFE_ID = /^[A-Za-z0-9_-]{1,60}$/;

/**
 * The chapter practice link, the server's own form (data/mobi_standing.js practiceLink: 10 questions on that chapter).
 * Nothing unsafe goes into it; without a subject it is Quick practice.
 */
export function practiceHref(subject, chapter) {
  const s = String(subject ?? '');
  const c = text(chapter);
  if (!SAFE_ID.test(s)) return '/dashboard?mode=quick';
  return `/test?${new URLSearchParams({ subject: s, mode: 'quick', count: '10', ...(c ? { chapter: c } : {}) })}`;
}

/** A link the server sent is used only when it is one of ours (a relative practice link); otherwise it is built here. */
export const safePracticeHref = (href, subject, chapter) => (typeof href === 'string' && /^\/(test|dashboard)\?[^\s]*$/.test(href) && !href.startsWith('//') ? href : practiceHref(subject, chapter));

/**
 * Where the band and the first college's cutoff sit on one bar, as percentages of a window around them (so a 610 to 680
 * band is not a sliver of 0 to 1000). The window snaps to 50s and never leaves 0..max. null without a usable band.
 */
export function rangeScale({ low, high, max, cutoff = null } = {}) {
  const lo = num(low); const hi = num(high); const top = num(max);
  if (lo === null || hi === null || top === null || top <= 0 || hi < lo) return null;
  const c = num(cutoff);
  const from = Math.max(0, Math.floor((Math.min(lo, c ?? lo) - 40) / 50) * 50);
  const to = Math.min(top, Math.ceil((Math.max(hi, c ?? hi) + 40) / 50) * 50);
  const span = Math.max(1, to - from);
  const at = (v) => Math.round(((Math.min(Math.max(v, from), to) - from) / span) * 1000) / 10;
  return { from, to, band: [at(lo), at(hi)], tick: c === null ? null : at(c) };
}

/** "SRCC, B.Com (Hons)": the college and its programme, as the student added them. */
const collegeName = (c) => [text(c?.college), text(c?.programme)].filter(Boolean).join(', ') || 'Your college';

/** What the gap means, in one sentence. `gap` = cutoff - the middle of the band; positive = marks short. */
export function gapLine(college) {
  const g = num(college?.gap);
  if (g === null) return null;
  const words = marksWord(Math.abs(g));
  if (college.position === 'above') return `Your whole range is above it. The middle of your range clears it by ${words} ${words === '1' ? 'mark' : 'marks'}.`;
  if (college.position === 'within') {
    return g > 0
      ? `It sits inside your range. The middle of your range is ${words} ${words === '1' ? 'mark' : 'marks'} short of it.`
      : `It sits inside your range. The middle of your range clears it by ${words} ${words === '1' ? 'mark' : 'marks'}.`;
  }
  if (g <= 0) return `The middle of your range clears it by ${words} ${words === '1' ? 'mark' : 'marks'}.`;
  return `You are ${words} ${words === '1' ? 'mark' : 'marks'} short of it at the middle of your range.`;
}

/** One college row under the first: its closing mark and where the band sits, in words (never colour alone). */
export function collegeRowView(c) {
  const cutoff = marksWord(c?.cutoff);
  const g = num(c?.gap);
  const where = cutoff === null ? 'No 2026 Round 1 closing mark'
    : c.position === 'above' ? 'Above your range'
      : c.position === 'within' ? 'Inside your range'
        : c.position === 'below' && g !== null ? `${marksWord(g)} marks short`
          : null;
  return { name: collegeName(c), cutoff: cutoff === null ? null : `Closed at ${cutoff}`, where, position: c?.position || 'none' };
}

const chapterRows = (rows) => (Array.isArray(rows) ? rows : [])
  .filter((r) => text(r?.chapter) && num(r?.marks) !== null && r.marks > 0)
  .slice(0, 3)
  .map((r) => ({
    key: `${r.subject}::${r.chapter}`, chapter: text(r.chapter), subject: text(r.subjectName) || text(r.subject) || '',
    marks: `${marksWord(r.marks)} ${r.marks === 1 ? 'mark' : 'marks'} open`,
    detail: [r.wrong ? plural(r.wrong, 'wrong answer') : null, r.blank ? `${r.blank} left blank` : null].filter(Boolean).join(' and ') || null,
    href: safePracticeHref(r.href, r.subject, r.chapter),
  }));

/**
 * The view of "Where you stand" for one read. `phase` is the read: 'loading' | 'error' | 'offline' | 'done'. `body` is the
 * route's 200 body. Kinds: loading, error, empty, thin, partial, ready. A ready band with no college to compare says so with
 * the link to add colleges; nothing is ever guessed.
 */
export function standingView({ phase = 'loading', body = null } = {}) {
  if (phase === 'loading') return { kind: 'loading', line: JOB_COPY.standReading };
  if (phase === 'offline') return { kind: 'error', line: JOB_COPY.standOffline, retry: true };
  if (phase !== 'done' || !body || body.ok !== true) return { kind: 'error', line: JOB_COPY.standFailed, retry: true };
  const note = text(body.note) || 'From your own practice, before NTA normalisation. Not a prediction.';
  const collegesHref = text(body.links?.colleges) || '/admission-compass';
  const thinRows = (Array.isArray(body.thin) ? body.thin : []).filter((t) => text(t?.name) && Number.isInteger(t?.needed) && t.needed > 0)
    .map((t) => ({ key: t.subject, name: t.name, line: `${plural(t.needed, 'more question')} to go`, href: practiceHref(t.subject, null) }));
  if (body.status === 'empty') return { kind: 'empty', line: JOB_COPY.standEmpty };
  const band = body.band;
  if (body.status === 'thin' || !band || num(band.low) === null || num(band.high) === null) {
    if (!thinRows.length) return { kind: 'empty', line: JOB_COPY.standEmpty };
    return { kind: 'thin', line: JOB_COPY.standThin, thin: thinRows };
  }
  const max = num(band.max) ?? (num(body.paperMax) ?? 250) * (band.count || 1);
  const range = { low: marksWord(band.low), high: marksWord(band.high), max: marksWord(max) };
  const headline = `Your practice puts you at ${range.low} to ${range.high} out of ${range.max}.`;
  const papers = (Array.isArray(band.papers) ? band.papers : []).map((p) => text(p?.name)).filter(Boolean);
  const chapters = chapterRows(body.closeFastest);
  if (body.status === 'partial' || band.complete !== true) {
    const count = Number.isInteger(band.count) ? band.count : papers.length;
    const from = papers.length ? `From ${papers.length === 1 ? papers[0] : `${papers.slice(0, -1).join(', ')} and ${papers.at(-1)}`}, ${count} of the 4 papers DU adds up.` : null;
    return {
      kind: 'partial', range, headline, from, compare: JOB_COPY.standCompare, thin: thinRows,
      scale: rangeScale({ low: band.low, high: band.high, max }), chapters, chaptersTitle: JOB_COPY.mostOpen, note,
    };
  }
  const colleges = Array.isArray(body.colleges) ? body.colleges : [];
  const first = body.first && num(body.first.cutoff) !== null ? body.first : null;
  const view = {
    kind: 'ready', range, headline, scale: rangeScale({ low: band.low, high: band.high, max, cutoff: first?.cutoff }), chapters, note, collegesHref,
    chaptersTitle: first && num(first.gap) !== null && first.gap > 0 ? JOB_COPY.closeGap : JOB_COPY.mostOpen,
    college: null, gap: null, others: [], addColleges: null,
  };
  if (!colleges.length) return { ...view, addColleges: JOB_COPY.addCollegesLine };
  if (!first) return { ...view, addColleges: JOB_COPY.noCutoffLine };
  const category = text(first.category) || text(body.category) || 'UR';
  view.college = { name: collegeName(first), line: `Closed at ${marksWord(first.cutoff)} in 2026 Round 1, for the ${category} category.`, cutoff: marksWord(first.cutoff) };
  view.gap = gapLine(first);
  view.others = colleges.filter((c) => c !== body.first && !(c.programmeId && c.programmeId === first.programmeId && c.college === first.college)).slice(0, 8).map(collegeRowView);
  return view;
}

// ---- Ask now: doubts tied to the student's own chapters ------------------------------------------------------------------

/**
 * A doubt for a fresh account, still tied to a real chapter so the 2 check questions come from it. The chapter names are
 * the canonical syllabus's own (data/canonical_syllabus.js), so the server's chapter lookup finds them.
 */
export const FRESH_DOUBTS = Object.freeze({
  accountancy: [
    { text: 'Explain the sacrificing ratio in simple words', chapter: 'Change in Profit Sharing Ratio' },
    { text: 'How is goodwill valued by the super profit method?', chapter: 'Goodwill Valuation' },
    { text: 'What is the difference between shares and debentures?', chapter: 'Debentures' },
  ],
  economics: [
    { text: 'What is price elasticity of demand?', chapter: 'Introduction & Theory of Consumer Behaviour' },
    { text: 'Explain the investment multiplier in simple words', chapter: 'Income Determination' },
  ],
  business_studies: [
    { text: 'Explain Fayol’s principles of management in simple words', chapter: 'Principles of Management' },
    { text: 'What is the difference between delegation and decentralisation?', chapter: 'Organising' },
  ],
  english: [
    { text: 'How do I find the main idea of a passage?', chapter: 'Factual Passage' },
    { text: 'How do I solve para jumbles faster?', chapter: 'Para Jumbles' },
  ],
  mathematics: [
    { text: 'How do I find the inverse of a 2 by 2 matrix?', chapter: 'Determinants' },
    { text: 'Explain the chain rule in simple words', chapter: 'Continuity & Differentiability' },
  ],
});

const subjectKey = (id) => {
  const key = String(id ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return key === 'gat' ? 'general_test' : key;
};

/**
 * The doubt a weak chapter asks. Its words never ask about marks, time, blanks or changes, so the record never answers it
 * free when 1 credit was shown (the record's keywords are in data/prepos_insights.js answerFromInsights).
 */
export const doubtFor = (chapter, wrong) => (wrong > 0
  ? `I keep getting ${chapter} questions wrong. What am I missing?`
  : `I am not sure how to start ${chapter} questions. Where do I begin?`);

/**
 * The Ask now starters: up to 3 doubts, each { id, text, subject, chapter, preview, mine }. A record leads with the
 * chapters it ranks first (the chapters the student misses); the rest come from the student's subjects, then the Commerce
 * set the design was drawn with. Every starter carries its subject, and a chapter where one is known, so Mobi can test it.
 */
export function doubtStarters({ insights = null, subjects = [], limit = 3 } = {}) {
  const out = [];
  const seen = new Set();
  const add = (s) => {
    const k = `${s.subject}::${s.chapter || s.text}`;
    if (out.length >= limit || seen.has(k) || !text(s.text)) return;
    seen.add(k); out.push(s);
  };
  const ranked = insights?.state === 'ready' ? insights.chapters?.ranked || [] : [];
  for (const c of ranked) {
    const chapter = text(c?.chapter);
    const subject = text(c?.subject);
    if (!chapter || !subject) continue;
    const wrong = Number(c.wrong) || 0; const blank = Number(c.skip) || 0;
    if (!wrong && !blank) continue;
    const name = text(c.subjectName);
    const tally = [wrong ? plural(wrong, 'wrong answer') : null, blank ? `${blank} left blank` : null].filter(Boolean).join(' and ');
    add({ id: `mine:${subject}:${chapter}`, text: doubtFor(chapter, wrong), subject, chapter, preview: `${name ? `${name}: ` : ''}${tally} in your practice`, mine: true });
  }
  const lists = (subjects || []).map((s) => [s, FRESH_DOUBTS[subjectKey(s)]]).filter(([, l]) => l);
  if (!lists.length) for (const s of ['accountancy', 'economics', 'english']) lists.push([s, FRESH_DOUBTS[s]]);
  for (let round = 0; out.length < limit && round < 3; round += 1) {
    for (const [subject, list] of lists) {
      const d = list[round];
      if (d) add({ id: `fresh:${subjectKey(subject)}:${d.chapter}`, text: d.text, subject: String(subject), chapter: d.chapter, preview: `Then 2 new CUET-style questions on ${d.chapter}`, mine: false });
    }
  }
  return out;
}

const syllabusId = (subject) => (subjectKey(subject) === 'general_test' ? 'gat' : subjectKey(subject));

/**
 * The chapter chips offered when a doubt came back without its 2 questions (no chapter found): the student's own missed
 * chapters first, then the syllabus's chapters of the doubt's subject (or of the student's first subjects). Each chip is
 * { subject, chapter }; the subject is sent back as the student's record or the thread names it.
 */
export function chapterChips({ subject = null, insights = null, subjects = [], limit = 6 } = {}) {
  const out = [];
  const seen = new Set();
  const add = (s, c) => { const k = `${syllabusId(s)}::${c}`; if (s && c && !seen.has(k) && out.length < limit) { seen.add(k); out.push({ subject: String(s), chapter: c }); } };
  const ranked = insights?.state === 'ready' ? insights.chapters?.ranked || [] : [];
  for (const c of ranked) if (!subject || syllabusId(c.subject) === syllabusId(subject)) add(c.subject, text(c.chapter));
  const pool = subject ? [subject] : (subjects || []).slice(0, 2);
  for (const s of pool) for (const c of getCanonicalChapters(syllabusId(s))) add(s, c);
  return out;
}

// ---- What should I revise tonight? (free, from the record) --------------------------------------------------------------

const TONIGHT = /\bwhat should i revise (tonight|today)\b/;
/** The words that ask for tonight's set. It is answered from the record, free (replyKind 'tonight'). */
export const isTonightAsk = (value) => TONIGHT.test(` ${String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()} `);

/** The trap line, the record's own counts: "A missed NOT or EXCEPT has caught you 4 times in 6 chances." */
export function trapLine(t) {
  const phrase = text(t?.phrase);
  const caught = Number.isInteger(t?.caught) ? t.caught : null;
  const chances = Number.isInteger(t?.chances) ? t.chances : Number.isInteger(t?.of) ? t.of : null;
  if (!phrase || caught === null || chances === null || chances < 1) return null;
  return `${phrase.replace(/[.\s]+$/, '')} has caught you ${caught === 1 ? 'once' : `${caught} times`} in ${plural(chances, 'chance')}.`;
}

/** The tonight payload as the screen shows it: only the parts the record filled. null when there is nothing at all. */
export function tonightView(tonight) {
  if (!tonight || typeof tonight !== 'object') return null;
  const chapters = (Array.isArray(tonight.chapters) ? tonight.chapters : []).filter((c) => text(c?.chapter)).slice(0, 3).map((c) => ({
    key: `${c.subject}::${c.chapter}`, chapter: text(c.chapter), subject: text(c.subjectName),
    lost: num(c.lost) !== null && c.lost > 0 ? `${marksWord(c.lost)} ${c.lost === 1 ? 'mark' : 'marks'} lost` : null,
    href: safePracticeHref(c.href, c.subject, c.chapter),
  }));
  const rules = (Array.isArray(tonight.rules) ? tonight.rules : []).map((r) => text(typeof r === 'string' ? r : r?.text)).filter(Boolean).slice(0, 5);
  const traps = (Array.isArray(tonight.traps) ? tonight.traps : []).map(trapLine).filter(Boolean).slice(0, 3);
  const due = Number.isInteger(tonight.reviseDue) && tonight.reviseDue > 0 ? `${tonight.reviseDue} Revise ${tonight.reviseDue === 1 ? 'card is' : 'cards are'} due.` : null;
  const line = text(tonight.line);
  if (!chapters.length && !rules.length && !traps.length && !due && !line) return null;
  return { line, chapters, rules, traps, due };
}

// ---- The doubt thread (POST /api/ai/mentor/chat with threadId; /api/mobi/thread) -----------------------------------------

/** A check question the screen may show: an id, a stem and four options with text. Half a question is never shown. */
export function isShowableQuestion(q) {
  return Boolean(q && text(q.checkQuestionId) && text(q.question) && Array.isArray(q.options) && q.options.length === 4 && q.options.every((o) => text(o?.text)));
}

/** The thread fields of a chat reply (they may sit at the top level or inside `response`). */
export function threadFromReply(data) {
  const src = data && typeof data === 'object' ? data : {};
  const inner = src.response && typeof src.response === 'object' ? src.response : {};
  const raw = src.thread ?? inner.thread ?? null;
  const thread = raw && text(raw.id) ? {
    id: raw.id,
    followUpsLeft: Number.isInteger(raw.followUpsLeft) && raw.followUpsLeft >= 0 ? raw.followUpsLeft : 0,
    followUpsMax: Number.isInteger(raw.followUpsMax) ? raw.followUpsMax : 1,
    subject: text(raw.subject), chapter: text(raw.chapter),
  } : null;
  const checks = (Array.isArray(src.checks) ? src.checks : Array.isArray(inner.checks) ? inner.checks : []).filter(isShowableQuestion).slice(0, 2);
  const note = text(src.checksNote ?? inner.checksNote);
  const tonight = src.tonight ?? inner.tonight ?? null;
  return { thread, checks, checksNote: checks.length ? null : note, tonight };
}

/** Whether the next typed words are the free follow-up of an open doubt. */
export const followUpOpen = (thread) => Boolean(thread?.id) && thread.followUpsLeft > 0;

const SAYS_CHARGE = /nothing (extra )?(was|is|will be) charged|no credits? (was |were |is )?used|not charged|nothing extra/i;
/** Every failure says nothing was charged; a server line that already says so is kept as it came. */
export const withNothingCharged = (line) => {
  const t = text(line);
  if (!t) return JOB_COPY.failed;
  return SAYS_CHARGE.test(t) ? t : `${t.replace(/\s+$/, '')}${/[.?]$/.test(t) ? '' : '.'} ${JOB_COPY.nothingCharged}`;
};

/**
 * A chat reply that was not a 200, for the thread: { reply, actions, full, gone }. `full` (409 thread_full) closes the
 * follow-up; `gone` (404 thread_not_found) forgets the thread. Every line says nothing was charged.
 */
export function chatFailure(status, body) {
  const error = text(body?.error);
  const message = text(body?.message);
  if (status === 409 && error === 'thread_full') return { reply: withNothingCharged(message || 'This doubt has had its follow-up. Ask a new doubt to open a new one, for 1 credit.'), actions: [], full: true, gone: false };
  if (status === 404 && error === 'thread_not_found') return { reply: withNothingCharged(message || 'That doubt could not be found. Ask it again as a new doubt.'), actions: [], full: false, gone: true };
  if (status === 429) return { reply: message ? withNothingCharged(message) : JOB_COPY.tooMany, actions: [], full: false, gone: false };
  if (status === 402) return { reply: withNothingCharged(message || 'You have no credits left for a new doubt.'), actions: [{ label: 'See your credits', route: '/wallet' }], full: false, gone: false };
  return { reply: withNothingCharged(message || JOB_COPY.failed), actions: [], full: false, gone: false };
}

const LETTERS = 'ABCD';

/** The option rows of a check: lettered in the order shown; once answered, each says whether it is the key or the pick. */
export function checkRows(question, result = null) {
  const keyIndex = Number.isInteger(result?.key?.index) ? result.key.index : null;
  const pickIndex = Number.isInteger(result?.picked?.index) ? result.picked.index : Number.isInteger(result?.pick) ? result.pick : null;
  return (Array.isArray(question?.options) ? question.options : []).map((o, i) => {
    const index = Number.isInteger(o?.index) ? o.index : i;
    const isKey = result ? index === keyIndex : false;
    const isPick = result ? index === pickIndex : false;
    return {
      index, letter: LETTERS[index] || String(index + 1), text: text(o?.text) || 'Option', isKey, isPick,
      state: isKey ? 'key' : isPick ? 'mine' : null,
      tag: isKey && isPick ? 'Your pick and the key' : isKey ? 'Key' : isPick ? 'Your pick' : null,
    };
  });
}

/** A marked answer the screen can show: the verdict, the key and the server's own line. */
export const isShowableResult = (r) => Boolean(r && typeof r.right === 'boolean' && Number.isInteger(r.key?.index) && text(r.line));

/** What the screen does after POST op 'answer': { state: 'answered', result, replayed } or { state: 'error', message, canRetry }. */
export function planThreadAnswer(outcome) {
  if (outcome?.kind !== 'response') return { state: 'error', message: JOB_COPY.markFailed, canRetry: true };
  const { res, body } = outcome;
  if (res.ok && body?.ok && isShowableResult(body.result)) return { state: 'answered', result: body.result, replayed: body.replayed === true };
  const message = text(body?.message);
  if (res.status === 422 || res.status === 404 || res.status === 409) return { state: 'error', message: message || JOB_COPY.markFailed, canRetry: false };
  return { state: 'error', message: message || JOB_COPY.markFailed, canRetry: true };
}

/** What the screen does after POST op 'checks': the questions, or the server's reason with the chips kept. */
export function planThreadChecks(outcome) {
  if (outcome?.kind !== 'response') return { state: 'error', message: JOB_COPY.checksFailed };
  const { res, body } = outcome;
  const checks = (Array.isArray(body?.checks) ? body.checks : []).filter(isShowableQuestion).slice(0, 2);
  if (res.ok && body?.ok && checks.length) return { state: 'ready', checks };
  const note = text(body?.checksNote) || text(body?.message);
  if (res.ok && body?.ok) return { state: 'none', message: withNothingCharged(note || JOB_COPY.checksFailed) };
  return { state: 'error', message: withNothingCharged(note || JOB_COPY.checksFailed) };
}

/** "1 of 2 right." once every offered question is answered; null before. */
export function checksTally(results, total) {
  const marked = Object.values(results || {}).filter((r) => typeof r?.right === 'boolean');
  if (!total || marked.length < total) return null;
  const right = marked.filter((r) => r.right).length;
  return right === total ? `${right} of ${total} right. The idea held on new CUET-style questions.` : `${right} of ${total} right. The explanation under each one shows the step.`;
}
