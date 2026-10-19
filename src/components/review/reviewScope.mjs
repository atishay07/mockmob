// Review's scope and its stats strip, 19 Oct 2026 (owner G25, D106). PURE: no React, no I/O, so the page and the tests
// (data/tests/review_page.test.mjs) read the same functions.
//
// The page shows one scope at a time, all subjects or one: its papers, its chapters (body.lose.rows), its saved repairs and
// the head line. The stats strip is computed from that same scope, so its figures always agree with what is under it:
//   Papers sat    the rows under Your papers
//   Latest marks  the first of those rows, with the change on the one before of the same subject, kind and length
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

/** The subjects to filter by: those with papers, newest paper first, then the student's other subjects (no papers yet). */
export function subjectsOf(papers = [], mine = []) {
  const out = new Map();
  for (const p of papers) {
    const id = subjectKey(p.subject);
    const g = out.get(id) || { id, name: p.subjectName || subjectLabel(p.subject), n: 0 };
    g.n += 1;
    out.set(id, g);
  }
  for (const value of mine || []) {
    const id = subjectKey(value);
    if (id && !out.has(id)) out.set(id, { id, name: subjectLabel(id), n: 0 });
  }
  return [...out.values()];
}

/** Everything the page shows for one subject ('all' for every subject): papers, chapters, saved repairs, the head line. */
export function scopeOf(body, subject = 'all', name = '') {
  const lose = body.lose;
  const papers = body.papers || [];
  if (subject === 'all') return { papers, rows: lose.rows, saved: lose.saved, savedLine: lose.savedLine, line: lose.line };
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
  return {
    papers: own, rows, saved, savedLine: savedLine ? `${savedLine}.` : '',
    line: { lost, wrong, blank, who, what, fixed, text: lost ? `${who} lost ${lost} marks: ${what}.${fixed}` : `${who} lost no marks.` },
  };
}

/** The four figures of the stats strip, with the line under each, from the scope. */
export function statsOf(scope, scopeName = '') {
  const { papers, rows, saved } = scope;
  const latest = papers[0] || null;
  const before = latest ? papers.slice(1).find((p) => subjectKey(p.subject) === subjectKey(latest.subject) && p.kind === latest.kind && Number(p.of) === Number(latest.of)) : null;
  const diff = latest && before ? (Number(latest.score) || 0) - (Number(before.score) || 0) : null;
  const kinds = new Map();
  for (const p of papers) kinds.set(p.kind, (kinds.get(p.kind) || 0) + 1);
  const toRepair = rows.reduce((t, r) => t + r.open.length, 0);
  const chapters = rows.filter((r) => r.open.length).length;
  const held = saved.filter((x) => x.state === 'held').length;
  const slipped = saved.filter((x) => x.state === 'slipped').length;
  const pending = saved.filter((x) => x.state === 'repaired').length;
  const latestSubject = latest ? latest.subjectName || subjectLabel(latest.subject) : '';
  let trend = null;
  if (latest && diff === null) trend = { dir: 'first', text: `Your first ${kindWord(latest.kind, 1)} in ${latestSubject}` };
  else if (latest && diff > 0) trend = { dir: 'up', text: `Up ${plural(diff, 'mark')} on ${paperBefore(before)}` };
  else if (latest && diff < 0) trend = { dir: 'down', text: `Down ${plural(-diff, 'mark')} on ${paperBefore(before)}` };
  else if (latest) trend = { dir: 'same', text: `The same marks as ${paperBefore(before)}` };
  return {
    papers: papers.length,
    papersNote: papers.length ? [...kinds].map(([k, n]) => `${n} ${kindWord(k, n)}`).join(', ') : `No ${scopeName ? `${scopeName} ` : ''}papers yet`,
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
