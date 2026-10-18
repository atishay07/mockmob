// Review's input to the one shared next-move function (docs/design-decisions/pass-1017/LEARN-REVIEW-1017.md 5.2 to 5.5,
// packet P-LR0). PURE: no I/O, no React, no clock (the record carries `now`). There is NO second move builder here:
// `reviewInput(record)` turns the cross-paper record into the input of `nextMove()` in data/result_next_move.mjs (the
// same function the result page calls and Today's plan is tested against), and `reviewMove(record)` only decorates the
// answer with the paper a target lives in. The app ports this file (flutter_app lib/features/review/model/review_input.dart)
// and reads the same fixtures (data/tests/fixtures/review/*.json).
//
// The record (data/tests/fixtures/review/student.json is the reference; GET /api/me/review returns the same fields plus the
// derived ones below):
//   state     'ready' (default) | 'empty' | 'unavailable' (the read failed; NEVER shown as the empty state, L12)
//   now       ISO time the record was read (India time is used for every day and hour)
//   wallet    { aiCredits, aiRenews, practiceCredits, isPremium }  (null = unknown, never zero)
//   papers    [{ id, name, subject, subjectName?, kind, mode?, at, questions, right, wrong, blank, score, of }]
//   chapters  [{ id, name, subject, subjectName?, syllabus? }]
//   items     [{ paper, q, ch, state, stem, pick?, repairedAt?, checkedAt?, reviseNext?, qid?, keyState? }]  server order
//               state    'open' | 'slipped' | 'repaired' | 'held' | 'blank'
//               keyState 'under_review' | 'corrected' when the answer key is not trusted (left out of repairs and pricing)
//   revise    { rotation, boxes, cap, answeredToday?, dueToday: {questions, again, checks, cards}, sources? }
//   repairOrder  optional [uid]: the server's repair order (lab.repairOrder across papers); else the order of `items`
// An item's uid is `${paper}:${qid ?? q}`; it is the id the shared function sees, and the target of a move names the paper.
import { NEXT_MOVE_RULES, nextMove } from './result_next_move.mjs';
import { REVISE_RULES, addDays, dayLabel, istDate, minutesFor } from './revise.js';
import { chaptersBody } from './review_chapters.mjs';

export const REVIEW_INPUT_VERSION = 1;
export const ITEM_STATES = Object.freeze(['open', 'slipped', 'repaired', 'held', 'blank']);
/** Lesson cards add at most this many to a day's Revise queue (LEARN-REVIEW-1017 5.8). */
export const REVISE_CARD_CAP = 5;

const LETTERS = 'ABCDEFGH';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const IST_MS = 19_800_000;
const KIND_MODE = { 'full mock': 'full', 'NTA paper': 'nta', 'smart practice': 'smart', practice: 'quick' };

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const joinNames = (list) => (list.length <= 1 ? list[0] || '' : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`);
const time = (value) => { const t = typeof value === 'number' ? value : Date.parse(value); return Number.isFinite(t) ? t : null; };
const istHour = (ms) => new Date(ms + IST_MS).getUTCHours();
const isWrong = (item) => item.state !== 'blank';
const keyHeld = (item) => Boolean(item.keyState);
/** An item that still costs marks: an open or slipped wrong answer, or a blank, whose key is trusted. */
export const isOpenItem = (item) => !keyHeld(item) && (item.state === 'open' || item.state === 'slipped' || item.state === 'blank');
const isOpenWrong = (item) => isOpenItem(item) && item.state !== 'blank';
const hasRepair = (item) => item.state === 'repaired' || item.state === 'held' || item.state === 'slipped';

export const uidOf = (item) => item.uid || `${item.paper}:${item.qid ?? item.q}`;

/** "16 Oct" in India time. */
export function shortDate(value) {
  const t = time(value);
  if (t === null) return '';
  const [, m, d] = istDate(t).split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
}
/**
 * "They renew on 1 Nov." for a student whose credits are at 0 and whose renewal day the server knows (the monthly reset);
 * '' otherwise: an unknown balance is never 0, and no date is guessed. One credits balance (D78): at 0 nothing bought is
 * left, so what comes back is the month's free credits (REVIEW-RESULT-1018 4.7, the 0 credits state).
 */
export function aiRenewsLine(wallet) {
  if (wallet?.aiCredits !== 0 || !wallet?.aiRenews) return '';
  const day = shortDate(`${wallet.aiRenews}T00:00:00+05:30`);
  return day ? `They renew on ${day}.` : '';
}
/** "9:40 PM" in India time. */
export function shortTime(value) {
  const t = time(value);
  if (t === null) return '';
  const d = new Date(t + IST_MS);
  const h = d.getUTCHours();
  return `${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
/** "16 Oct, 9:40 PM": the day and time a paper was attempted, never relative (F17). */
export const stampWhen = (value) => [shortDate(value), shortTime(value)].filter(Boolean).join(', ');

/** The record read once into the lookups every function here shares. */
function context(record) {
  const papers = [...(record?.papers || [])].sort((a, b) => (time(b.at) ?? 0) - (time(a.at) ?? 0) || String(a.id).localeCompare(String(b.id)));
  const paperById = new Map(papers.map((p, i) => [p.id, { ...p, rank: i }]));
  const chapterById = new Map((record?.chapters || []).map((c) => [c.id, c]));
  const items = (record?.items || []).map((item, serverIndex) => {
    const paper = paperById.get(item.paper) || { id: item.paper, name: item.paper, subject: '', rank: papers.length, at: null };
    const chapter = chapterById.get(item.ch) || { id: item.ch, name: item.chapter || item.ch, subject: paper.subject, subjectName: paper.subjectName };
    return { ...item, uid: uidOf(item), serverIndex, paperRef: paper, chapterRef: chapter };
  });
  // Paper order: newest paper first, then the paper's own question order. This is the order the shared function's tie
  // rule reads ("the newest paper, then the earlier chapter in that paper").
  const paperOrder = [...items].sort((a, b) => a.paperRef.rank - b.paperRef.rank || a.q - b.q || a.serverIndex - b.serverIndex);
  return { papers, paperById, chapterById, items, paperOrder, byUid: new Map(items.map((i) => [i.uid, i])), now: time(record?.now) ?? Date.now() };
}

/** 'ready' | 'empty' | 'unavailable'. A failed read is never 'empty' (L12). */
export function reviewState(record) {
  if (!record || record.state === 'unavailable') return 'unavailable';
  if (record.state === 'empty' || !Array.isArray(record.papers) || !record.papers.length) return 'empty';
  return 'ready';
}

/** The chapters with what each costs: LEARN-REVIEW-1017 5.5, priced as RESULT-1017 4.2 on the open items across papers. */
export function chapterRows(record) {
  const ctx = context(record);
  const groups = new Map();
  ctx.paperOrder.forEach((item, order) => {
    const key = item.chapterRef.id;
    const g = groups.get(key) || { id: key, name: item.chapterRef.name, subject: item.chapterRef.subject, subjectName: item.chapterRef.subjectName || item.chapterRef.subject, items: [], firstOpen: null, firstAny: order };
    g.items.push(item);
    if (isOpenItem(item) && g.firstOpen === null) g.firstOpen = order;
    groups.set(key, g);
  });
  const rows = [...groups.values()].map((g) => {
    const openWrong = g.items.filter(isOpenWrong).length;
    const blank = g.items.filter((i) => isOpenItem(i) && i.state === 'blank').length;
    const wrong = g.items.filter(isWrong).length;
    const slipped = g.items.filter((i) => i.state === 'slipped' && !keyHeld(i)).length;
    const fixed = g.items.filter((i) => i.state === 'repaired' || i.state === 'held').length;
    const papers = [...new Map(g.items.map((i) => [i.paperRef.id, i.paperRef])).values()].sort((a, b) => a.rank - b.rank).map((p) => p.name);
    const parts = [openWrong ? `${openWrong} wrong` : null, blank ? `${blank} left blank` : null].filter(Boolean);
    // Inside a chapter: repairable in server order, then slipped, then blanks, then repaired and held (5.5). None disappears.
    const rank = (i) => (keyHeld(i) ? 4 : i.state === 'open' ? 0 : i.state === 'slipped' ? 1 : i.state === 'blank' ? 2 : 3);
    const ordered = [...g.items].sort((a, b) => rank(a) - rank(b) || (rank(a) === 0 ? a.serverIndex - b.serverIndex : a.paperRef.rank - b.paperRef.rank || a.q - b.q));
    return {
      id: g.id, name: g.name, subject: g.subject, subjectName: g.subjectName,
      marks: openWrong * NEXT_MOVE_RULES.gapWrong + blank * NEXT_MOVE_RULES.gapBlank,
      openWrong, blank, wrong, repaired: fixed, slipped,
      pending: g.items.filter((i) => i.state === 'repaired').length,
      held: g.items.filter((i) => i.state === 'held').length,
      keyHeld: g.items.filter(keyHeld).length,
      papers,
      source: `${parts.length ? `${parts.join(', ')}. ` : ''}${[g.subjectName, joinNames(papers)].filter(Boolean).join(', ')}`,
      progress: `${fixed} of ${wrong} repaired${slipped ? `, ${slipped} slipped` : ''}`,
      itemIds: ordered.map((i) => i.uid),
      _first: g.firstOpen ?? g.firstAny + 1e6,
    };
  });
  // Costliest first. Ties: more wrong answers, then the newest paper and the earlier chapter in it (one paper: RESULT's tie rule).
  rows.sort((a, b) => b.marks - a.marks || b.openWrong - a.openWrong || a._first - b._first);
  return rows.map(({ _first, ...row }) => row);
}

/** The counts every surface on Review agrees on (control, head, panel). All from the same items. */
export function reviewCounts(record) {
  const ctx = context(record);
  const wrong = ctx.items.filter(isWrong);
  const open = ctx.items.filter(isOpenItem);
  const marks = chapterRows(record).reduce((sum, c) => sum + c.marks, 0);
  const lost = ctx.papers.reduce((sum, p) => sum + NEXT_MOVE_RULES.gapWrong * (Number(p.wrong) || 0) + NEXT_MOVE_RULES.gapBlank * (Number(p.blank) || 0), 0);
  return {
    found: wrong.length,
    open: open.filter((i) => i.state !== 'blank').length,
    blanks: open.filter((i) => i.state === 'blank').length,
    marks,
    openPapers: new Set(open.map((i) => i.paperRef.id)).size,
    papers: ctx.papers.length,
    lost,
    slipped: wrong.filter((i) => i.state === 'slipped').length,
    pending: wrong.filter((i) => i.state === 'repaired').length,
  };
}

/** "22 open mistakes" and the line under it (LEARN-REVIEW-1017 5.5). */
export function mistakesHead(record) {
  const c = reviewCounts(record);
  const across = `${c.marks} marks across ${plural(c.openPapers, 'paper')}`;
  return {
    title: `${plural(c.open, 'open mistake')}`,
    sub: `${c.blanks ? `With ${c.blanks} left blank, they cost you ${across}.` : `They cost you ${across}.`} A wrong answer costs ${NEXT_MOVE_RULES.gapWrong} marks, a blank ${NEXT_MOVE_RULES.gapBlank}.`,
  };
}

/** Tomorrow, or a named day: how a Revise day reads in a sentence. */
function dayPhrase(day, today) {
  if (day <= today) return 'today';
  if (day === addDays(today, 1)) return `tomorrow, ${dayLabel(day)}`;
  return `on ${dayLabel(day)}`;
}

/**
 * The receipt strip and its one line (5.4). Found, Repaired, Retested, Still right; a slipped mistake is in Repaired and
 * Retested, not in Still right, and it is open again. No percentage and no claim of cause.
 */
export function receipt(record) {
  const ctx = context(record);
  const wrong = ctx.items.filter(isWrong);
  const repaired = wrong.filter(hasRepair);
  const retested = wrong.filter((i) => i.state === 'slipped' || i.state === 'held');
  const held = wrong.filter((i) => i.state === 'held');
  const today = istDate(ctx.now);
  const strip = { found: wrong.length, repaired: repaired.length, retested: retested.length, stillRight: held.length };
  const slips = wrong.filter((i) => i.state === 'slipped').sort((a, b) => (time(b.checkedAt) ?? 0) - (time(a.checkedAt) ?? 0));
  const newest = slips[0] || null;
  let line;
  let slip = null;
  if (retested.length) {
    const checks = retested.length === 1 ? 'check' : 'checks';
    line = `${held.length} of the ${retested.length} ${checks} held.`;
    if (newest) {
      const at = time(newest.checkedAt);
      const day = at === null ? today : istDate(at);
      const hour = at === null ? istHour(ctx.now) : istHour(at);
      const when = day === today ? (hour >= 17 || hour < 4 ? 'tonight' : 'today') : `on ${dayLabel(day)}`;
      const back = newest.reviseNext || addDays(day, 1);
      slip = { uid: newest.uid, number: newest.q, paper: newest.paperRef.name, when, backIn: back, backLabel: dayPhrase(back, today) };
      line += ` Q${newest.q} slipped ${when}, so it is open again and back in Revise ${slip.backLabel}.`;
    } else line += ' Nothing slipped.';
  } else if (repaired.length) line = `${repaired.length} repaired. Each one comes with a Check it held.`;
  else line = 'None repaired yet. A repair explains why your pick looked right, then checks it.';
  return { ...strip, line, slip, onlyFound: repaired.length === 0 };
}

/**
 * What Revise has today across its four sources, deduplicated (5.8): wrong answers due, repaired mistakes due again (a
 * question due in both plays once, as Review again), pending Check it held, lesson cards. The daily cap (5 or 10) holds
 * sources 1 and 2, a Check it held is always included, cards add at most 5. `cards: null` is unknown, never zero.
 */
export function reviseDue(record, { cap } = {}) {
  const r = record?.revise || {};
  const capN = [5, 10].includes(Number(cap ?? r.cap)) ? Number(cap ?? r.cap) : REVISE_RULES.cap;
  const room = Math.max(0, capN - (Number(r.answeredToday) || 0));
  // `null` is unknown (a read failed): it counts as none in the total, and is named in `unknown`, never shown as zero.
  const list = (value) => (Array.isArray(value) ? [...new Set(value)] : null);
  const count = (value) => (value === null || value === undefined ? null : Number(value) || 0);
  let againRaw;
  let questionsRaw;
  let checks;
  let cards;
  if (r.sources) {
    const s = r.sources;
    const againIds = list(s.again);
    const taken = new Set(againIds || []);
    const questionIds = list(s.questions);
    againRaw = againIds === null ? null : againIds.length;
    questionsRaw = questionIds === null ? null : questionIds.filter((id) => !taken.has(id)).length;
    checks = new Set(s.checks || []).size;
    cards = count(s.cards);
  } else {
    const d = r.dueToday || {};
    againRaw = count(d.again);
    questionsRaw = count(d.questions);
    checks = Number(d.checks) || 0;
    cards = count(d.cards);
  }
  const again = Math.min(againRaw ?? 0, room);
  const questions = Math.min(questionsRaw ?? 0, room - again);
  const shownCards = cards === null ? 0 : Math.min(cards, REVISE_CARD_CAP);
  const total = questions + again + checks + shownCards;
  const back = questions + again;
  const parts = [back ? `${plural(back, 'question')} back` : null, checks ? `${checks} Check it held` : null, shownCards ? plural(shownCards, 'concept card') : null].filter(Boolean);
  const minutes = minutesFor(total);
  return {
    questions, again, checks, cards: shownCards, total, minutes, cap: capN,
    unknown: [questionsRaw === null ? 'questions' : null, againRaw === null ? 'again' : null, cards === null ? 'cards' : null].filter(Boolean),
    head: total ? `${total} due today` : 'Nothing due today',
    mix: parts.join(', '),
    row: total ? `${parts.join(', ')}. About ${plural(minutes, 'minute')}, free.` : 'Nothing is due today.',
  };
}

const chapterOfMove = (move) => move?.target?.chapter || null;

/**
 * The input of nextMove() for the open set across papers (5.3). Rules 1 and 2 read the newest paper (nothing missed on any
 * paper; under 40 percent right on the newest paper); rules 3 to 5 read the open items across papers priced by chapterRows.
 * `hour` is the India hour of `record.now` unless given (the late line). `dailySet` ('free' | 'priced' | 'unknown', src/lib/dailySet.mjs)
 * is what the server quote said about today's included 10-question set; left out, the set's price reads as it always did.
 * Null when there is no paper.
 */
export function reviewInput(record, { hour, dailySet } = {}) {
  if (reviewState(record) !== 'ready') return null;
  const ctx = context(record);
  const newest = ctx.papers[0];
  const rows = [];
  const mistakes = [];
  ctx.paperOrder.forEach((item, index) => {
    const letter = typeof item.pick === 'string' ? LETTERS.indexOf(item.pick.toUpperCase()) : -1;
    const givenIndex = letter >= 0 ? letter : Number.isInteger(item.givenIndex) ? item.givenIndex : null;
    const base = { q: { id: item.uid }, d: givenIndex === null ? null : { givenIndex }, index, number: item.q, chapter: item.chapterRef.name };
    // Priced rows: what is still open. Repaired and held mistakes are done work and leave the chapter's marks.
    rows.push({ ...base, verdict: item.state === 'blank' ? 'skipped' : isOpenWrong(item) ? 'wrong' : 'correct' });
    if (isWrong(item)) mistakes.push({ ...base, verdict: 'wrong' });
  });
  const lostAll = ctx.papers.reduce((sum, p) => sum + NEXT_MOVE_RULES.gapWrong * (Number(p.wrong) || 0) + NEXT_MOVE_RULES.gapBlank * (Number(p.blank) || 0), 0);
  const marks = {
    scored: newest.score, max: newest.of, gap: lostAll, right: Number(newest.right) || 0, wrong: Number(newest.wrong) || 0, blank: Number(newest.blank) || 0,
    gapWrong: NEXT_MOVE_RULES.gapWrong * (Number(newest.wrong) || 0), gapBlank: NEXT_MOVE_RULES.gapBlank * (Number(newest.blank) || 0),
  };
  const analysis = { rows, marks, mistakes };
  const order = Array.isArray(record.repairOrder) && record.repairOrder.length ? record.repairOrder : ctx.items.filter(isWrong).map((i) => i.uid);
  const wallet = record.wallet || {};
  // The set is aimed in the subject of the costliest chapter; with nothing open, in the newest paper's subject.
  const top = chapterRows(record).find((c) => c.marks > 0) || null;
  const subject = top ? top.subject : newest.subject;
  const subjectName = top ? top.subjectName : newest.subjectName || newest.subject;
  const answerReviews = Object.fromEntries(ctx.items.filter(keyHeld).map((i) => [i.uid, { state: i.keyState }]));
  const checks = Object.fromEntries(ctx.items.filter((i) => i.state === 'held' || i.state === 'slipped').map((i) => [i.uid, i.state === 'held' ? 'right' : 'wrong']));
  return {
    analysis, answerReviews, repairOrder: { qids: order },
    repaired: new Set(ctx.items.filter(hasRepair).map((i) => i.uid)), checks,
    aiCredits: Number.isFinite(wallet.aiCredits) ? wallet.aiCredits : null,
    practiceCredits: Number.isFinite(wallet.practiceCredits) ? wallet.practiceCredits : null,
    isPremium: Boolean(wallet.isPremium),
    mode: newest.mode || KIND_MODE[newest.kind] || null,
    subject, subjectName, labReady: true,
    hour: Number.isInteger(hour) ? hour : istHour(ctx.now),
    ...(dailySet ? { dailySet } : {}),
  };
}

function decorate(target, ctx) {
  const item = target?.qid ? ctx.byUid.get(target.qid) : null;
  if (!item) return target;
  return { ...target, uid: item.uid, qid: item.qid ?? item.uid, attemptId: item.paper, paper: item.paperRef.name };
}

/**
 * The one next move on Review, from the shared function: { kind, rule, label, why, value, cost, late, alt, note, target, panel }
 * with the target naming its paper ({ qid, uid, attemptId, paper, number, chapter }). `panel` is Review's title and line
 * (5.3: the line for Repair names the chapter's marks and its papers; every other rule keeps the shared `why`).
 * Null when there is no record to read.
 */
export function reviewMove(record, options = {}) {
  const input = reviewInput(record, options);
  if (!input) return null;
  const ctx = context(record);
  const move = nextMove(input);
  if (!move) return null;
  const out = { ...move, target: decorate(move.target, ctx), alt: move.alt ? { ...move.alt, target: decorate(move.alt.target, ctx) } : null };
  const rows = chapterRows(record);
  const chapter = chapterOfMove(out);
  const row = chapter ? rows.find((c) => c.name === chapter) : rows.find((c) => c.marks > 0);
  // Review speaks across papers: the shared sentences say "on this paper", which would be wrong here.
  let line = String(move.why || '').replace(/ on this paper/g, '');
  let title = chapter || row?.name || input.subjectName;
  if (move.kind === 'repair' && row) {
    const lead = rows.find((c) => c.marks > 0);
    line = `${lead && lead.id === row.id ? 'Your costliest chapter: ' : ''}${row.marks} marks lost in ${joinNames(row.papers)}. Q${out.target.number} comes first.`;
  } else if (move.rule === 5 && input.aiCredits === 0 && aiRenewsLine(record.wallet)) {
    // Review's wording of the zero-credit line names the day the credits renew (5.3).
    line = `${line} ${aiRenewsLine(record.wallet)}`;
  } else if (move.kind === 'check') title = 'Check it held';
  else if (move.kind === 'harder') title = 'Every question right';
  out.panel = { title, line };
  return out;
}

/** The items as a page draws them: the paper and time on every row (F17) and the pill from the item's state. */
export function itemViews(record) {
  const ctx = context(record);
  const pills = { open: 'Repair', repaired: 'Check it held', held: 'Held on a new question', slipped: 'Slipped on a new question', blank: 'Try it again, free' };
  return ctx.items.map((i) => ({
    uid: i.uid, qid: i.qid ?? null, paper: i.paper, attemptId: i.paper, q: i.q, number: i.q, ch: i.chapterRef.id, chapterId: i.chapterRef.id, chapter: i.chapterRef.name,
    state: i.state, keyState: i.keyState || null, pick: i.pick || null, stem: i.stem || '',
    pill: i.keyState === 'corrected' ? 'Key corrected' : i.keyState ? 'Key being re-checked' : pills[i.state],
    paperName: i.paperRef.name, at: i.paperRef.at || null, stamp: [i.paperRef.name, stampWhen(i.paperRef.at)].filter(Boolean).join(', '),
    repairedAt: i.repairedAt || null, checkedAt: i.checkedAt || null, reviseNext: i.reviseNext || null,
    reviseNextLabel: i.reviseNext ? dayPhrase(i.reviseNext, istDate(ctx.now)) : null,
    open: isOpenItem(i), repairable: i.state === 'open' && !keyHeld(i),
  }));
}

/** The papers as the Papers view draws them, newest first. */
export function paperViews(record) {
  return context(record).papers.map((p) => ({ ...p, stamp: [p.name, stampWhen(p.at)].filter(Boolean).join(', '), when: stampWhen(p.at) }));
}

/** The body of GET /api/me/review (the record's own fields, then the derived ones, all from the same items). */
export function reviewBody(record) {
  const state = reviewState(record);
  if (state === 'unavailable') return { version: REVIEW_INPUT_VERSION, state, message: record?.message || null };
  const due = reviseDue(record);
  return {
    version: REVIEW_INPUT_VERSION, state, now: record.now, wallet: record.wallet ?? null,
    papers: paperViews(record), chapters: chapterRows(record), items: itemViews(record),
    receipt: receipt(record), reviseDue: due, counts: reviewCounts(record), head: mistakesHead(record),
    // The ids behind Revise's counts stay on the server: the body carries the counts after the dedupe and the cap.
    revise: record.revise ? {
      rotation: record.revise.rotation ?? null, boxes: record.revise.boxes ?? null, cap: record.revise.cap ?? REVISE_RULES.cap, answeredToday: record.revise.answeredToday ?? 0,
      dueToday: { questions: due.unknown.includes('questions') ? null : due.questions, again: due.unknown.includes('again') ? null : due.again, checks: due.checks, cards: due.unknown.includes('cards') ? null : due.cards },
    } : null,
    repairOrder: record.repairOrder ?? null,
    // Pass 1018 (REVIEW-RESULT-1018 4.1 to 4.4): the weak chapters priced against their marks on offer, the saved repairs
    // and the head line, from data/review_chapters.mjs (one function feeds every number on the page).
    chapterQuestions: record.chapterQuestions ?? null,
    lose: chaptersBody(record),
  };
}
