// node scripts/coverage/merge-2024.mjs [inputDir]
//
// The CUET 2024 past-paper coverage, merged from its two independent checks into product data (owner LK362, 20 Nov 2026;
// method: tmp/1120-speed/coverage/METHOD.md). For each real question of the three whole papers checked (Accountancy 301,
// Economics 309, Business Studies 305, booklet A, 50 questions each), Checker A and Checker B each wrote a verdict with the
// MockMob material that teaches it. The final verdict:
//   * "skill" (the answer is printed in a passage the paper gives), "off_syllabus" (not in the CUET 2026 syllabus) and
//     "dropped" (NTA dropped the question) are B's labels, and B's label wins: shown, never counted;
//   * otherwise "covered" only when BOTH checkers say covered; anything else (one doubt) is "not_covered".
// English is left out: one checker only, and 28 countable items is too few for a figure (METHOD.md, 20 Nov late).
//
// Writes data/coverage/cuet-2024.json: per subject the paper (registry id, code, date, booklet), the snapshot date, counts, and
// per question its number, chapter, type, both checkers' verdicts, the final verdict, the best match (kind "bank" or "card"
// and its id) and B's one-line reason (A's where B has none). No question text: the registry holds it
// (data/source_registry.json) and the page reads it there, on the server.
//
// Checks before it writes, and refuses on any failure: both files have the same 50 questions; each paper is in the registry with
// 50 questions; both checkers' NTA keys equal the registry's key; every cited Key card is in its bundled deck.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const INPUT = path.resolve(ROOT, process.argv[2] || 'tmp/1120-speed/coverage');
const OUT = path.join(ROOT, 'data/coverage/cuet-2024.json');

// The three whole papers. `file` is the checkers' file name, `id` the app's subject id, `registry` the paper's registry id.
const PAPERS = [
  { file: 'accountancy', id: 'accountancy', name: 'Accountancy', registry: 'cuet2024-accountancy-bookA-paper' },
  { file: 'economics', id: 'economics', name: 'Economics', registry: 'cuet2024-economics-bookA-paper' },
  { file: 'business-studies', id: 'business_studies', name: 'Business Studies', registry: 'cuet2024-business_studies-bookA-paper' },
];
const NOT_COUNTED = new Set(['skill', 'off_syllabus', 'dropped']);
const VERDICTS = new Set(['covered', 'not_covered', ...NOT_COUNTED]);

/** The final verdict from the two checks (the rule above). Exported so the test holds the same rule. */
export function finalVerdict(a, b) {
  if (NOT_COUNTED.has(b)) return b;
  return a === 'covered' && b === 'covered' ? 'covered' : 'not_covered';
}

const fail = (why) => { throw new Error(`merge-2024: ${why}`); };
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

// "theory, match" -> { type: 'theory', form: 'match' }; "theory (passage)" -> form 'passage'; "numerical" -> no form.
function typeOf(raw) {
  const text = String(raw || '').toLowerCase();
  const type = text.startsWith('numerical') ? 'numerical' : 'theory';
  const form = (text.match(/(?:,\s*|\()\s*([a-z-]+)\)?\s*$/) || [])[1] || null;
  return { type, form };
}

// The paper's facts, wherever the checker put them (A and B of Economics keep them at the top level).
function paperOf(checker) {
  const p = checker.provenance || {};
  return {
    code: String(p.subjectCode || checker.subjectCode || ''),
    date: String(p.date || p.examDate || checker.examDate || ''),
    booklet: String(p.booklet || checker.booklet || ''),
  };
}

// The registry's NTA key for a question: the position (1 to 4), "Drop", or several positions ("1,2"), as printed.
function registryKey(q) {
  if (q.official_key?.answer) return String(q.official_key.answer).replace(/\s+/g, '');
  const pos = q.anchor_metadata?.official_key_answer_position;
  if (pos) return String(pos);
  const note = String(q.anchor_metadata?.curation_note || '');
  const multi = note.match(/multiple answers ([\d,\s]+)/i);
  return multi ? multi[1].replace(/\s+/g, '') : null;
}
const checkerKey = (k) => (Array.isArray(k) ? k.join(',') : String(k ?? '')).replace(/\s+/g, '');

const kindOf = (id, matches) => {
  const hit = (matches || []).find((m) => m?.id === id);
  if (hit?.kind === 'card' || hit?.kind === 'bank') return hit.kind;
  return String(id).startsWith('kc.') ? 'card' : 'bank';
};

function merge() {
  const registry = readJson(path.join(ROOT, 'data/source_registry.json'));
  const source = (id) => (Array.isArray(registry.sources) ? registry.sources.find((s) => s.id === id) : registry.sources[id]);
  const decks = new Map();
  const deckIds = (subject) => {
    if (!decks.has(subject)) decks.set(subject, new Set(readJson(path.join(ROOT, `data/keycards/decks/${subject}.json`)).cards.map((c) => c.id)));
    return decks.get(subject);
  };

  const subjects = [];
  for (const paper of PAPERS) {
    const A = readJson(path.join(INPUT, `cuet2024-${paper.file}-A.json`));
    const B = readJson(path.join(INPUT, `cuet2024-${paper.file}-B.json`));
    if (A.checker !== 'A' || B.checker !== 'B') fail(`${paper.file}: the files are not checker A and checker B`);
    if (A.paper !== paper.registry || B.paper !== paper.registry) fail(`${paper.file}: paper id ${A.paper} / ${B.paper}, expected ${paper.registry}`);
    const auth = source(paper.registry)?.authentication;
    const reg = auth?.questions;
    const printed = Number(auth?.question_count);
    if (!Array.isArray(reg) || printed !== 50 || reg.length !== printed) fail(`${paper.registry}: not 50 questions in the registry`);
    if (A.questions.length !== 50 || B.questions.length !== 50) fail(`${paper.file}: a checker did not check all 50 questions`);
    const facts = paperOf(B);
    const factsA = paperOf(A);
    for (const k of ['code', 'date', 'booklet']) if (facts[k] !== factsA[k] || !facts[k]) fail(`${paper.file}: ${k} ${facts[k]} / ${factsA[k]}`);

    const questions = [];
    for (let n = 1; n <= 50; n += 1) {
      const a = A.questions.find((q) => q.n === n);
      const b = B.questions.find((q) => q.n === n);
      const r = reg.find((q) => q.id === n);
      if (!a || !b || !r) fail(`${paper.file} Q${n}: missing from a checker or the registry`);
      if (!VERDICTS.has(a.verdict) || !VERDICTS.has(b.verdict)) fail(`${paper.file} Q${n}: unknown verdict ${a.verdict} / ${b.verdict}`);
      const key = registryKey(r);
      if (checkerKey(a.ntaKey) !== key || checkerKey(b.ntaKey) !== key) fail(`${paper.file} Q${n}: NTA key A ${a.ntaKey}, B ${b.ntaKey}, registry ${key}`);
      const verdict = finalVerdict(a.verdict, b.verdict);
      const bestId = b.best || null;
      const best = bestId ? { kind: kindOf(bestId, b.matches), id: bestId } : null;
      if (best?.kind === 'card' && !deckIds(paper.id).has(best.id)) fail(`${paper.file} Q${n}: card ${best.id} is not in the ${paper.id} deck`);
      if (verdict === 'covered' && !best) fail(`${paper.file} Q${n}: covered with no match`);
      const { type, form } = typeOf(b.type || a.type);
      const reasonB = String(b.reason || '').trim();
      questions.push({
        n,
        chapter: b.chapter ?? a.chapter ?? null,
        type,
        form,
        checks: { A: a.verdict, B: b.verdict },
        verdict,
        best,
        reason: reasonB || String(a.reason || '').trim(),
        reasonFrom: reasonB ? 'B' : 'A',
      });
    }
    const tally = (v) => questions.filter((q) => q.verdict === v).length;
    const counts = {
      questions: questions.length,
      counted: tally('covered') + tally('not_covered'),
      covered: tally('covered'),
      not_covered: tally('not_covered'),
      skill: tally('skill'),
      off_syllabus: tally('off_syllabus'),
      dropped: tally('dropped'),
    };
    subjects.push({
      id: paper.id,
      name: paper.name,
      // `questions`: how many the paper prints (the registry's question_count). A figure needs every one of them checked twice.
      paper: { registryId: paper.registry, code: facts.code, date: facts.date, booklet: facts.booklet, questions: printed },
      snapshotDate: B.snapshotDate || A.snapshotDate,
      checkers: ['A', 'B'],
      checked: questions.length,
      counts,
      questions,
    });
  }

  const covered = subjects.reduce((s, x) => s + x.counts.covered, 0);
  const counted = subjects.reduce((s, x) => s + x.counts.counted, 0);
  return {
    exam: 'CUET (UG) 2024',
    year: 2024,
    source: 'data/source_registry.json',
    method: 'tmp/1120-speed/coverage/METHOD.md',
    generatedBy: 'scripts/coverage/merge-2024.mjs',
    rule: 'Covered only when both independent checkers say covered; a doubtful match counts as not covered. Checker B\'s skill, off_syllabus and dropped labels win and are shown, not counted. Key cards count as teaching material and are labelled. A numerical counts only with a practice question that uses the same formula and steps.',
    snapshotDate: subjects.map((s) => s.snapshotDate).sort().at(-1),
    leftOut: [{ id: 'english', name: 'English', why: 'Most English questions test reading and skill on a passage, so too few can be checked against stored material for a fair figure.' }],
    totals: { subjects: subjects.length, counted, covered },
    subjects,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const data = merge();
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(data, null, 1)}\n`);
  for (const s of data.subjects) console.log(`${s.name}: ${s.counts.covered} covered of ${s.counts.counted} counted (${JSON.stringify(s.counts)})`);
  console.log(`Together: ${data.totals.covered} of ${data.totals.counted}. Wrote ${path.relative(ROOT, OUT)}`);
}
