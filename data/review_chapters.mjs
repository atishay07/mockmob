// Review led by weak chapters, pass 1018 (docs/design-decisions/pass-1018/REVIEW-RESULT-1018.md 4.1 to 4.4, packet P-RR0).
// PURE: no I/O, no React, no clock (the record carries `now`). The app ports this file
// (flutter_app lib/features/review/model/review_chapters.dart) and reads the same fixtures.
//
// It reads the same record as data/review_input.mjs (data/tests/fixtures/review/student-1018.json is the reference) plus
// one field: chapterQuestions { [paperId]: { [chapterId]: n } }, how many questions of each chapter a paper asked (right
// answers included), so a chapter is priced against the marks it had on offer:
//   marks on offer = 5 x the chapter's questions
//   marks lost     = 6 per wrong answer (5 not earned + the 1 penalty) + 5 per blank
//   so marks lost  = on offer - scored.
// Questions whose key is held or corrected are left out of both (RESULT-1017 4.2). A repaired mistake still lost its marks
// on its paper, so it stays in the chapter's figure; it is listed in Saved repairs, not as a row under the chapter.
// Every number on Review comes from chapterRows(): the head line sums it, and the chapters add up to the papers' lost marks.
import { NEXT_MOVE_RULES } from './result_next_move.mjs';
import { istDate } from './revise.js';
import { actionLabel } from './repair_presentation.mjs';

export const REVIEW_CHAPTERS_VERSION = 1;
const PER_RIGHT = 5;
const LOST_WRONG = NEXT_MOVE_RULES.gapWrong; // 6
const LOST_BLANK = NEXT_MOVE_RULES.gapBlank; // 5
const IST_MS = 19_800_000;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SAVED = new Set(['repaired', 'held', 'slipped']);

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const time = (value) => { const t = typeof value === 'number' ? value : Date.parse(value); return Number.isFinite(t) ? t : null; };
const keyHeld = (item) => Boolean(item.keyState);
const isWrong = (item) => item.state !== 'blank';
export const joinNames = (list) => (list.length <= 1 ? list[0] || '' : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`);
const uidOf = (item) => item.uid || `${item.paper}:${item.qid ?? item.q}`;

/** "Fri 16 Oct, 9:40 PM" in India time: a real weekday and a 12-hour clock, never relative (F17, check 10). */
export function dayStamp(value) {
  const t = time(value);
  if (t === null) return '';
  const d = new Date(t + IST_MS);
  const h = d.getUTCHours();
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
/** "9:40 PM" in India time. */
function clock(t) {
  const d = new Date(t + IST_MS);
  const h = d.getUTCHours();
  return `${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
/** "tonight, 8:30 PM" / "today, 11:05 AM" on the record's day; otherwise "Tue 13 Oct, 10:40 PM". */
export function whenSaid(value, now) {
  const t = time(value);
  if (t === null) return '';
  if (istDate(t) === istDate(now)) {
    const h = new Date(t + IST_MS).getUTCHours();
    return `${h >= 17 ? 'tonight' : 'today'}, ${clock(t)}`;
  }
  return dayStamp(t);
}

function context(record) {
  const papers = [...(record?.papers || [])].sort((a, b) => (time(b.at) ?? 0) - (time(a.at) ?? 0) || String(a.id).localeCompare(String(b.id)));
  const paperById = new Map(papers.map((p, i) => [p.id, { ...p, rank: i }]));
  const chapterById = new Map((record?.chapters || []).map((c) => [c.id, c]));
  const items = (record?.items || []).map((item, serverIndex) => {
    const paper = paperById.get(item.paper) || { id: item.paper, name: item.paper, rank: papers.length, at: null };
    const chapter = chapterById.get(item.ch) || { id: item.ch, name: item.chapter || item.ch, subject: paper.subject, subjectName: paper.subjectName };
    return { ...item, uid: uidOf(item), serverIndex, paperRef: paper, chapterRef: chapter };
  });
  return { papers, paperById, chapterById, items, now: time(record?.now) ?? Date.now() };
}

/** The item as a row shows it: its paper and a weekday stamp (F17). */
function itemOut(i) {
  return { uid: i.uid, number: i.q, paper: i.paperRef.id, paperName: i.paperRef.name, stamp: [i.paperRef.name, dayStamp(i.paperRef.at)].filter(Boolean).join(', '), state: i.state, pick: i.pick || null, stem: i.stem || '' };
}

/**
 * The chapter's one sentence. Never "lost X of Y" with X > Y: a wrong answer costs 6 against the 5 it had on offer, so a
 * chapter where every question is wrong loses more than it offered. Then the "of N" goes and the marks stand alone (R9, D18).
 */
function lineFor({ lost, offer, asked, papers, counted }) {
  if (offer === null) return { lead: `Lost ${lost} marks`, rest: ` in ${joinNames(papers)}. ${counted}.` };
  if (lost > offer) return { lead: `Lost ${lost} marks`, rest: `${asked}. ${counted}.` };
  return { lead: `Lost ${lost} of the ${offer} marks`, rest: ` on offer${asked}. ${counted}.` };
}

/**
 * The chapters, most marks lost first: { id, name, subject, subjectName, lost, offer, questions, scored, wrong, blank,
 * papers, line, open, blanks, repaired, held, slipped, pending }. `open` is the never-repaired wrong answers, newest first;
 * `blanks` the blanks; `repaired` the saved repairs (named in the foot). `offer` is null when the record does not say how
 * many questions the chapter asked (an older server): the line then states the marks lost alone.
 * Ties: more wrong answers, then the newest paper.
 */
export function chapterRows(record) {
  const ctx = context(record);
  const counts = record?.chapterQuestions && typeof record.chapterQuestions === 'object' ? record.chapterQuestions : null;
  const groups = new Map();
  for (const item of ctx.items) {
    const g = groups.get(item.chapterRef.id) || { ref: item.chapterRef, items: [], held: 0 };
    if (keyHeld(item)) g.held += 1; else g.items.push(item);
    groups.set(item.chapterRef.id, g);
  }
  const rows = [];
  for (const [id, g] of groups) {
    if (!g.items.length) continue;
    const wrong = g.items.filter(isWrong).length;
    const blank = g.items.length - wrong;
    const lost = wrong * LOST_WRONG + blank * LOST_BLANK;
    // Questions on offer across the papers that asked this chapter, less those whose key is held.
    let questions = null;
    if (counts) {
      const papersAsked = new Set([...Object.keys(counts).filter((p) => Number(counts[p]?.[id]) > 0), ...g.items.map((i) => i.paperRef.id)]);
      let n = 0;
      for (const p of papersAsked) n += Number(counts[p]?.[id]) || 0;
      n -= g.held;
      if (n >= g.items.length) questions = n;
    }
    const offer = questions === null ? null : questions * PER_RIGHT;
    const scored = offer === null ? null : offer - lost;
    const paperRefs = [...new Map(g.items.map((i) => [i.paperRef.id, i.paperRef])).values()].sort((a, b) => a.rank - b.rank);
    const papers = paperRefs.map((p) => p.name);
    const newestFirst = (a, b) => a.paperRef.rank - b.paperRef.rank || a.serverIndex - b.serverIndex;
    const open = g.items.filter((i) => i.state === 'open').sort(newestFirst);
    const blanks = g.items.filter((i) => i.state === 'blank').sort(newestFirst);
    const repaired = g.items.filter((i) => SAVED.has(i.state)).sort(newestFirst);
    const counted = [wrong ? `${wrong} wrong` : null, blank ? `${blank} left blank` : null].filter(Boolean).join(', ');
    const asked = questions === null ? '' : `, ${plural(questions, 'question')} in ${joinNames(papers)}`;
    rows.push({
      id, name: g.ref.name, subject: g.ref.subject, subjectName: g.ref.subjectName || g.ref.subject,
      lost, offer, questions, scored, wrong, blank,
      papers, paperIds: paperRefs.map((p) => p.id),
      line: lineFor({ lost, offer, asked, papers, counted }),
      share: offer ? Math.min(1, lost / offer) : 1,
      open: open.map(itemOut), blanks: blanks.map(itemOut), repaired: repaired.map(itemOut),
      held: repaired.filter((i) => i.state === 'held').length,
      slipped: repaired.filter((i) => i.state === 'slipped').length,
      pending: repaired.filter((i) => i.state === 'repaired').length,
      keyHeld: g.held,
      _newest: Math.min(...g.items.map((i) => i.paperRef.rank)),
    });
  }
  rows.sort((a, b) => b.lost - a.lost || b.wrong - a.wrong || a._newest - b._newest || a.name.localeCompare(b.name));
  return rows.map(({ _newest, ...row }) => row);
}

/**
 * The saved repairs, slipped first, then those waiting for Check it held, then those that held; newest first inside each.
 * Every one opens free (F17). { uid, number, chapter, paperName, stamp, state, kind, line, action }.
 */
export function savedRepairs(record) {
  const ctx = context(record);
  const order = { slipped: 0, repaired: 1, held: 2 };
  const list = ctx.items.filter((i) => SAVED.has(i.state));
  list.sort((a, b) => order[a.state] - order[b.state] || (time(b.checkedAt || b.repairedAt) ?? 0) - (time(a.checkedAt || a.repairedAt) ?? 0) || a.paperRef.rank - b.paperRef.rank);
  return list.map((i) => {
    const repairedAt = whenSaid(i.repairedAt, ctx.now);
    const line = i.state === 'slipped'
      ? `Slipped on a new question${i.checkedAt ? ` ${whenSaid(i.checkedAt, ctx.now)}` : ''}. Back in Revise tomorrow.`
      : i.state === 'repaired'
        ? `Repaired${repairedAt ? ` ${repairedAt}` : ''}. One new question shows whether it held.`
        : `Held on a new question.${repairedAt ? ` Repaired ${repairedAt}.` : ''}`;
    const kind = i.state === 'repaired' ? 'pending' : i.state;
    return { ...itemOut(i), chapter: i.chapterRef.name, chapterId: i.chapterRef.id, kind, line, action: actionFor(i) };
  });
}

/** "6 held on a new question, 1 slipped, 2 waiting for Check it held." */
export function savedLine(saved) {
  const held = saved.filter((s) => s.state === 'held').length;
  const slipped = saved.filter((s) => s.state === 'slipped').length;
  const pending = saved.filter((s) => s.state === 'repaired').length;
  const parts = [held ? `${held} held on a new question` : null, slipped ? `${slipped} slipped` : null, pending ? `${pending} waiting for Check it held` : null].filter(Boolean);
  return parts.length ? `${parts.join(', ')}.` : '';
}

/** One action label per state (section 7), the same words on the result, Review and the app. */
export function actionFor(item) {
  return actionLabel(item.state, { keyHeld: keyHeld(item) });
}

/** "Your 3 papers lost 220 marks: 30 wrong answers and 8 left blank. 9 are repaired." Summed from chapterRows(). */
export function reviewLine(record, rows = chapterRows(record), saved = savedRepairs(record)) {
  const ctx = context(record);
  const lost = rows.reduce((s, r) => s + r.lost, 0);
  const wrong = rows.reduce((s, r) => s + r.wrong, 0);
  const blank = rows.reduce((s, r) => s + r.blank, 0);
  // One paper: a mock by its name ("Mock 3 lost 92 marks"); any other paper is "Quick practice", which names no one paper, so it
  // is "Your practice set" (copy pass, 19 Oct, R6).
  const one = ctx.papers[0];
  const who = ctx.papers.length === 1 ? (/^Mock \d+$/.test(String(one?.name || '')) ? one.name : 'Your practice set') : `Your ${ctx.papers.length} papers`;
  const what = [wrong ? plural(wrong, 'wrong answer') : null, blank ? `${blank} left blank` : null].filter(Boolean).join(' and ');
  const fixed = saved.length ? ` ${saved.length === 1 ? '1 is repaired' : `${saved.length} are repaired`}.` : '';
  return { lost, wrong, blank, who, what, fixed, text: lost ? `${who} lost ${lost} marks: ${what}.${fixed}` : `${who} lost no marks.` };
}

/** "Each chapter across Mock 3, Quick practice and Mock 2." (one paper: "Each chapter in Mock 3.") */
export function acrossLine(record) {
  const ctx = context(record);
  const names = ctx.papers.map((p) => p.name);
  return names.length === 1 ? `Each chapter in ${names[0]}.` : `Each chapter across ${joinNames(names)}.`;
}

/** The 1018 part of GET /api/me/review: everything the weak-chapter page draws, from the one record. */
export function chaptersBody(record) {
  const rows = chapterRows(record);
  const saved = savedRepairs(record);
  const papers = context(record).papers.map((p) => ({ id: p.id, stamp: dayStamp(p.at) }));
  return { version: REVIEW_CHAPTERS_VERSION, rows, saved, savedLine: savedLine(saved), line: reviewLine(record, rows, saved), across: acrossLine(record), paperStamps: papers };
}
