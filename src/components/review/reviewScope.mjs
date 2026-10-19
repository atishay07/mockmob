// Review's scope and its stats strip, 19 Oct 2026 (owner G25, D106). PURE: no React, no I/O, so the page and the tests
// (data/tests/review_page.test.mjs) read the same functions.
//
// The page shows one scope at a time, all subjects or one: its papers, its chapters (body.lose.rows), its saved repairs and
// the head line. The stats strip is computed from that same scope, so its figures always agree with what is under it:
//   Papers sat    every paper in the scope: the server counts the whole history (body.papersTotal, body.papersBySubject),
//                 while the rows list the newest 40 (ATTEMPT_WINDOW); release 11 verifier L3
//   Latest marks  the first of those rows, with the change on the one before of the same subject, kind and length. "Your
//                 first practice set in English" only when no earlier paper of that subject and kind exists anywhere; when
//                 one does at another length, the line names the length, and when that cannot be known it is left out (M2)
//   To repair     the sum of the chapters' "N mistakes to repair"
//   Repaired      the Saved repairs count
import { SUBJECTS } from '../../../data/subjects.js';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const KIND_WORDS = { 'full mock': ['full mock', 'full mocks'], 'NTA paper': ['NTA paper', 'NTA papers'], 'smart practice': ['smart practice set', 'smart practice sets'], practice: ['practice set', 'practice sets'] };
export const kindWord = (kind, n) => (KIND_WORDS[kind] || ['paper', 'papers'])[n === 1 ? 0 : 1];
// A mock has its own name ("Mock 2"); every other paper is called "Quick practice", which names no one paper. So a sentence
// that points at one paper says "Mock 2", or "your practice set" / "your previous practice set" (R6: never "Quick practice
// lost 15 marks" or "Up 5 marks on Quick practice").
const named = (p) => /^Mock \d+$/.test(String(p?.name || ''));
export const paperWho = (p) => (named(p) ? p.name : `Your ${kindWord(p?.kind, 1)}`);
const paperBefore = (p) => (named(p) ? p.name : `your previous ${kindWord(p?.kind, 1)}`);

/** The subject's id whether the record names it by id ('accountancy') or by name ('Accountancy'). */
export const subjectKey = (value) => {
  const v = String(value || '').trim().toLowerCase();
  return SUBJECTS.find((s) => s.id === v || s.name.toLowerCase() === v)?.id || v.replace(/\s+/g, '_');
};

/** The subject's name as the app writes it. */
export function subjectLabel(value) {
  const id = subjectKey(value);
  const known = SUBJECTS.find((s) => s.id === id)?.name;
  if (known) return known;
  const text = String(value || '').replace(/_/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

/** The subjects to filter by: those with papers, newest paper first, then the student's other subjects (no papers yet). Each
 *  chip's count is every paper in the subject when the server counted them (`counts`, paperCountsOf), else the rows listed. */
export function subjectsOf(papers = [], mine = [], counts = null) {
  const out = new Map();
  for (const p of papers) {
    const id = subjectKey(p.subject);
    const g = out.get(id) || { id, name: p.subjectName || subjectLabel(p.subject), n: 0 };
    g.n += 1;
    out.set(id, g);
  }
  for (const g of out.values()) g.n = Math.max(g.n, counts?.get?.(g.id)?.total || 0);
  for (const value of mine || []) {
    const id = subjectKey(value);
    if (id && !out.has(id)) out.set(id, { id, name: subjectLabel(id), n: 0 });
  }
  return [...out.values()];
}

/**
 * The server's count of every paper, by subject id: Map(id -> { total, kinds: { [kind]: n } }), or null from a server (or a
 * fixture) that does not send it. Keys are merged through subjectKey, so 'General Test' and 'general_test' are one subject.
 */
export function paperCountsOf(body) {
  const raw = body?.papersBySubject;
  if (!raw || typeof raw !== 'object') return null;
  const out = new Map();
  for (const [subject, g] of Object.entries(raw)) {
    if (!g || !Number.isInteger(g.total) || g.total < 0) continue;
    const id = subjectKey(subject);
    const have = out.get(id) || { total: 0, kinds: {} };
    have.total += g.total;
    for (const [kind, n] of Object.entries(g.kinds || {})) if (Number.isInteger(n) && n > 0) have.kinds[kind] = (have.kinds[kind] || 0) + n;
    out.set(id, have);
  }
  return out;
}

/** Everything the page shows for one subject ('all' for every subject): papers, chapters, saved repairs, the head line, and
 *  how many papers the scope holds in all (`total`, `kinds`; null when unknown) and whether the rows are every one of them. */
export function scopeOf(body, subject = 'all', name = '') {
  const lose = body.lose;
  const papers = body.papers || [];
  const counts = paperCountsOf(body);
  const complete = body.partial !== true;
  if (subject === 'all') {
    const sent = Number.isInteger(body.papersTotal) && body.papersTotal >= papers.length ? body.papersTotal : null;
    let kinds = null;
    if (counts) {
      kinds = {};
      for (const g of counts.values()) for (const [k, n] of Object.entries(g.kinds)) kinds[k] = (kinds[k] || 0) + n;
    }
    return { papers, rows: lose.rows, saved: lose.saved, savedLine: lose.savedLine, line: lose.line, counts, complete,
      total: sent ?? (complete ? papers.length : null), kinds };
  }
  const own = papers.filter((p) => subjectKey(p.subject) === subject);
  const ids = new Set(own.map((p) => p.id));
  const rows = lose.rows.filter((r) => subjectKey(r.subject) === subject);
  const chapters = new Set(rows.map((r) => r.id));
  const saved = lose.saved.filter((x) => ids.has(x.paper) || chapters.has(x.chapterId));
  const lost = rows.reduce((t, r) => t + r.lost, 0);
  const wrong = rows.reduce((t, r) => t + r.wrong, 0);
  const blank = rows.reduce((t, r) => t + r.blank, 0);
  const who = own.length === 1 ? paperWho(own[0]) : `Your ${own.length} ${name} papers`;
  const what = [wrong ? plural(wrong, 'wrong answer') : null, blank ? `${blank} left blank` : null].filter(Boolean).join(' and ');
  const fixed = saved.length ? ` ${saved.length === 1 ? '1 is repaired' : `${saved.length} are repaired`}.` : '';
  const held = saved.filter((x) => x.state === 'held').length;
  const slipped = saved.filter((x) => x.state === 'slipped').length;
  const pending = saved.filter((x) => x.state === 'repaired').length;
  const savedLine = [held ? `${held} held on a new question` : null, slipped ? `${slipped} slipped` : null, pending ? `${pending} waiting for Check it held` : null].filter(Boolean).join(', ');
  const mine = counts ? counts.get(subject) || { total: 0, kinds: {} } : null;
  return {
    papers: own, rows, saved, savedLine: savedLine ? `${savedLine}.` : '',
    line: { lost, wrong, blank, who, what, fixed, text: lost ? `${who} lost ${lost} marks: ${what}.${fixed}` : `${who} lost no marks.` },
    counts, complete,
    total: mine && mine.total >= own.length ? mine.total : complete ? own.length : null,
    kinds: mine && mine.total >= own.length ? mine.kinds : null,
  };
}

/** The four figures of the stats strip, with the line under each, from the scope. */
export function statsOf(scope, scopeName = '') {
  const { papers, rows, saved } = scope;
  // An older caller's scope carries no count: its rows are taken as every paper, as before.
  const complete = scope.complete !== false;
  const total = Number.isInteger(scope.total) ? scope.total : complete ? papers.length : null;
  const latest = papers[0] || null;
  const sameKind = (p) => subjectKey(p.subject) === subjectKey(latest.subject) && p.kind === latest.kind;
  const before = latest ? papers.slice(1).find((p) => sameKind(p) && Number(p.of) === Number(latest.of)) : null;
  const diff = latest && before ? (Number(latest.score) || 0) - (Number(before.score) || 0) : null;
  // The kinds in the order the rows first show them (newest first), then any that only older papers have.
  const kinds = new Map();
  for (const p of papers) kinds.set(p.kind, 0);
  if (scope.kinds && typeof scope.kinds === 'object') {
    for (const [k, n] of Object.entries(scope.kinds)) kinds.set(k, n);
    for (const [k, n] of kinds) if (!n) kinds.delete(k);
  } else if (complete) for (const p of papers) kinds.set(p.kind, kinds.get(p.kind) + 1);
  else kinds.clear();
  const toRepair = rows.reduce((t, r) => t + r.open.length, 0);
  const chapters = rows.filter((r) => r.open.length).length;
  const held = saved.filter((x) => x.state === 'held').length;
  const slipped = saved.filter((x) => x.state === 'slipped').length;
  const pending = saved.filter((x) => x.state === 'repaired').length;
  const latestSubject = latest ? latest.subjectName || subjectLabel(latest.subject) : '';
  let trend = null;
  if (latest && diff === null) {
    // "First" is said only when no earlier paper of this subject and kind exists, over the whole history when the server counted
    // it; an earlier one at another length names the length ("Your first 10-question practice set"); unknown says nothing.
    const counted = scope.counts?.get?.(subjectKey(latest.subject))?.kinds?.[latest.kind];
    const firstOfKind = Number.isInteger(counted) ? counted <= 1 : complete && !papers.slice(1).some(sameKind);
    const length = Number(latest.questions) || Math.round((Number(latest.of) || 0) / 5);
    if (firstOfKind) trend = { dir: 'first', text: `Your first ${kindWord(latest.kind, 1)} in ${latestSubject}` };
    else if (complete && length > 0) trend = { dir: 'first', text: `Your first ${length}-question ${kindWord(latest.kind, 1)} in ${latestSubject}` };
  } else if (latest && diff > 0) trend = { dir: 'up', text: `Up ${plural(diff, 'mark')} on ${paperBefore(before)}` };
  else if (latest && diff < 0) trend = { dir: 'down', text: `Down ${plural(-diff, 'mark')} on ${paperBefore(before)}` };
  else if (latest) trend = { dir: 'same', text: `The same marks as ${paperBefore(before)}` };
  return {
    papers: total ?? papers.length,
    listed: papers.length,
    papersNote: !papers.length ? (total ? 'Older than the papers listed here' : `No ${scopeName ? `${scopeName} ` : ''}papers yet`)
      : kinds.size ? [...kinds].map(([k, n]) => `${n} ${kindWord(k, n)}`).join(', ')
        : `The newest ${papers.length} are listed below`,
    latest: latest ? Number(latest.score) || 0 : null,
    latestOf: latest ? latest.of : null,
    latestNote: latest ? `${latest.name}, ${latestSubject}` : 'Your first paper’s marks show here',
    trend,
    toRepair,
    toRepairNote: toRepair ? `across ${plural(chapters, 'chapter')}` : saved.length ? 'Every mistake is repaired' : papers.length ? 'Nothing to repair' : 'No mistakes yet',
    repaired: saved.length,
    repairedNote: saved.length ? [held ? `${held} held` : null, slipped ? `${slipped} slipped` : null, pending ? `${pending} waiting to be checked` : null].filter(Boolean).join(', ') : 'None yet',
  };
}

/** The chapter that opens on arrival: one with a mistake to repair, never one whose header reads "Nothing left to repair". */
export const firstOpen = (rows) => rows.find((r) => r.open.length)?.id || null;
