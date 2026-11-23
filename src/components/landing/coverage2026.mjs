// The CUET 2026 paper, checked against MockMob, on the home page (owner, 22 Nov 2026, LK368: a teaser; 23 Nov 2026, LK427:
// the check itself, question by question, in the teaser's place: stream tabs, subject chips with their percent, a strip with
// one cell a question, and NTA's question beside the MockMob question or Key card that covers it).
//
// Where the numbers come from: data/coverage/cuet2026/public/summary.json, written by scripts/coverage/build-public.mjs from
// NTA's 2026 master papers (one shift a subject, every question authenticated against NTA's final key) and the two independent
// checks of each question against MockMob's served questions and Key cards (data/coverage/METHOD.md). A question counts only
// when BOTH checks found it covered; reading-skill items are shown and left out of the count. Nothing here is typed by hand:
// coverage2026.test.mjs holds these figures to the summary and the strips to the per-question files.
//
// What the browser gets: the model below (figures and one short string a paper) in the page, and a paper's questions only when
// that paper is chosen (data/coverage/cuet2026/home/<id>.json, a trimmed copy written by scripts/coverage/build-home.mjs).
//
// The check was made after the exam, on the bank as it is now: the words never say MockMob predicted the paper.
import SUMMARY from '../../../data/coverage/cuet2026/public/summary.json' with { type: 'json' };
import STRIPS from '../../../data/coverage/cuet2026/home/strips.json' with { type: 'json' };
import MARKS from '../../../data/coverage/cuet2026/home/marks.json' with { type: 'json' };
import { COVERAGE_PATH, HOME_STREAMS, STATUS_CODE, firstPick, subjectPath } from './coverageWords.mjs';

export { COVERAGE_PATH };
// The full pages' stream order, the same as src/components/coverage/coverageCopy.mjs (a test holds them equal). The home
// page's tabs have their own order (HOME_STREAMS, coverageWords.mjs).
export const STREAM_ORDER = Object.freeze(['commerce', 'science', 'humanities', 'general', 'other']);
export const COVERAGE_SUMMARY = SUMMARY;
export const COVERAGE_STRIPS = STRIPS;
export const COVERAGE_MARKS = MARKS;
/** A paper's first check as one string: 1 for a question counted then, 0 for any other. */
export const marksOf = (file) => file.questions.map((q) => (q.first ? '1' : '0')).join('');

/** A whole percent, rounded half up. */
export const coveragePct = (covered, of) => (of > 0 ? Math.round((covered / of) * 100) : 0);

/** A paper as one string, one letter a question in the paper's order (STATUS_CODE). */
export const stripOf = (file) => file.questions.map((q) => STATUS_CODE[q.status] || STATUS_CODE.dropped).join('');

/** A paper trimmed to what the home page draws: each question's own words and the words of its match. Passages are kept
 *  once and pointed at by index. Left out: the checker's reason, the explanation, ids and section labels (the full pages
 *  carry them). */
export function homeSubject(file) {
  const passages = [];
  const seen = new Map();
  const passageIndex = (p) => {
    if (!p || !p.text) return null;
    const key = `${p.title || ''}\n${p.text}`;
    if (!seen.has(key)) { seen.set(key, passages.length); passages.push({ title: p.title || null, text: p.text }); }
    return seen.get(key);
  };
  const matchOf = (m) => {
    if (!m) return null;
    if (m.kind === 'card') return { kind: 'card', chapter: m.chapter || null, front: m.front, back: m.back, source: m.source || null };
    return { kind: 'question', chapter: m.chapter || null, passage: m.passage || null, stem: m.stem, options: m.options, key: m.key };
  };
  const questions = file.questions.map((q) => ({
    n: q.n, chapter: q.chapter || null, status: q.status, passage: passageIndex(q.passage), stem: q.stem, options: q.options, key: q.key, match: matchOf(q.match),
  }));
  return { id: file.id, passages, questions };
}

/** One question of a trimmed paper with its passage in place (the page's first pair, drawn before any paper is fetched). */
export function homeQuestion(home, n) {
  const q = home.questions.find((x) => x.n === n);
  if (!q) return null;
  return { ...q, passage: q.passage == null ? null : home.passages[q.passage] };
}

/** The explorer's model: the total, the streams as tabs (only those with a checked paper), every subject with its figures
 *  and its strip, and the pair the section opens on. */
export function coverageExplorer(summary = SUMMARY, strips = STRIPS, marks = MARKS) {
  const subjects = {};
  for (const s of summary.subjects || []) {
    const strip = strips[s.id];
    if (!strip) continue;
    subjects[s.id] = {
      id: s.id, name: s.name, stream: s.stream, pct: s.pct, covered: s.covered, of: s.counted, total: s.total,
      first: { covered: s.first ?? s.covered, pct: s.firstPct ?? s.pct },
      marks: marks[s.id] && marks[s.id].length === strip.length ? marks[s.id] : '1'.repeat(strip.length),
      counts: { same: s.same, newValues: s.newValues, concept: s.concept, notYet: s.notYet, skill: s.skill, offSyllabus: s.offSyllabus, dropped: s.dropped },
      sitting: [s.examDay, s.shift].filter(Boolean).join(', '),
      strip, href: subjectPath(s.id),
    };
  }
  const streams = HOME_STREAMS.map((stream) => ({
    id: stream.id, name: stream.name,
    subjects: Object.values(subjects).filter((s) => s.stream === stream.id).sort((a, b) => a.name.localeCompare(b.name)).map((s) => s.id),
    pending: stream.pending.filter((p) => !subjects[p.id]).map((p) => p.name),
  })).filter((stream) => stream.subjects.length);
  const total = summary.total || { covered: 0, counted: 0, pct: 0 };
  const firstSubject = streams[0]?.subjects[0] || null;
  return {
    total: { covered: total.covered, of: total.counted, pct: total.pct, papers: Object.keys(subjects).length },
    // The earlier figure (summary.firstCheck), or null when there is none on record.
    before: summary.firstCheck ? { covered: summary.firstCheck.covered, of: summary.firstCheck.counted, pct: summary.firstCheck.pct } : null,
    streams, subjects,
    first: firstSubject ? { stream: streams[0].id, subject: firstSubject, n: firstPick(subjects[firstSubject].strip) } : null,
  };
}
