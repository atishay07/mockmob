// node scripts/coverage/build-public.mjs [--snapshot-dir <dir>]... [--fetch]
//
// The public CUET 2026 coverage pages' data (owner LK368, 22 Nov 2026; spec tmp/1122-coverage/UI-SPEC.md; method
// data/coverage/METHOD.md). Reads every subject in data/coverage/cuet2026/ that has all three of <id>-paper.json,
// <id>-A.json and <id>-B.json, and writes data/coverage/cuet2026/public/:
//   <id>.json      the subject: counts, chapter totals, and every question with its status and the MockMob words that teach it;
//   summary.json   every subject's figure, the totals, and the chapters asked with practice in MockMob;
//   problems.json  anything that made a question "not-yet" against the checkers' verdict (a cited id that is not resolved).
// Every number on the pages is counted here from those files. Nothing is typed by hand.
//
// The status of a question:
//   * a <id>-final.json, when present, decides verdict, status (its matchKind), best match and reason;
//   * otherwise: B's "skill", "off_syllabus" and "dropped" labels win (shown, never counted); "covered" only when A AND B both
//     say covered, and then the status is "concept" (taught in MockMob); anything else is "not-yet". Never upgraded.
//   * a covered question whose best match cannot be resolved to served words is "not-yet" and listed in problems.json.
//
// The first check (owner, 23 Nov 2026: the pages must say what was there before we read the papers). A and B are the first
// check of a paper: the bank as it stood on their snapshotDate, before anything was written for the paper. Every question
// carries `first` (counted at the first check: A and B both found it, and it is counted now) and, when it is counted now and
// was not then, `since`: "added" (its match was written after the first check) or "found" (its match was already there and
// a later check found it). `since` is read from added-after.json (scripts/coverage/added-after.py, from git history); a
// later-counted question that file does not list is called "added" (the smaller claim) and listed in problems.json.
//
// The matched words: Key cards from data/keycards/decks/<deck>.json by card id; bank questions from
// data/coverage/cuet2026/bank-cache.json ({ [id]: { stem, options[4], key, explanation, chapter, subject, from } }). Only
// served rows ever enter the cache:
//   --snapshot-dir <dir>   copies cited ids from a saved read-only bank snapshot (bank_*.json with the served list beside it,
//                          served*.json) and the stored served counts per chapter (inventory_snapshot.json). No network.
//   --fetch                reads, SELECT only, the cited ids still missing (through data/inventory_count.js and the practice
//                          flows' own data/practice_library.js readablePracticeQuestions, so only rows the practice flows
//                          serve), and the stored served counts per chapter for subjects that have none. .env.local is the
//                          PRODUCTION database: nothing here ever writes to it.
// Without either flag the script runs offline on the cache it has.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIR = path.join(ROOT, 'data/coverage/cuet2026');
const OUT = path.join(DIR, 'public');
const CACHE = path.join(DIR, 'bank-cache.json');
const ADDED_AFTER = path.join(DIR, 'added-after.json');
const SERVED_CHAPTERS = path.join(OUT, 'served-chapters.json');
const DECKS = path.join(ROOT, 'data/keycards/decks');

/** A chapter has practice in MockMob when one of its questions is in MockMob, or MockMob serves at least this many from it. */
export const PRACTICE_MIN_SERVED = 10;

// Names and streams for the pages. A subject id not listed here still builds (its name from the id, stream "other").
const SUBJECTS = {
  accountancy: { name: 'Accountancy', stream: 'commerce' },
  'business-studies': { name: 'Business Studies', stream: 'commerce' },
  economics: { name: 'Economics', stream: 'commerce' },
  mathematics: { name: 'Mathematics', stream: 'science' }, // the owner, 24 Nov 2026: Maths sits in the Science tab
  'applied-mathematics': { name: 'Applied Mathematics', stream: 'commerce' },
  entrepreneurship: { name: 'Entrepreneurship', stream: 'commerce' },
  physics: { name: 'Physics', stream: 'science' },
  chemistry: { name: 'Chemistry', stream: 'science' },
  biology: { name: 'Biology', stream: 'science' },
  'computer-science': { name: 'Computer Science', stream: 'science' },
  history: { name: 'History', stream: 'humanities' },
  'political-science': { name: 'Political Science', stream: 'humanities' },
  geography: { name: 'Geography', stream: 'humanities' },
  sociology: { name: 'Sociology', stream: 'humanities' },
  psychology: { name: 'Psychology', stream: 'humanities' },
  english: { name: 'English', stream: 'general' },
  'general-test': { name: 'General Test', stream: 'general' },
  gat: { name: 'General Test', stream: 'general' },
};
const titleOf = (id) => id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const bankSubject = (id) => id.replace(/-/g, '_');

const STATUSES = ['same', 'new-values', 'concept', 'not-yet', 'skill', 'off-syllabus', 'dropped'];
const COVERED = new Set(['same', 'new-values', 'concept']);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const readIf = (file, fallback) => (existsSync(file) ? readJson(file) : fallback);
const writeJson = (file, data) => writeFileSync(file, `${JSON.stringify(data, null, 1)}\n`);

// ------------------------------------------------------------------------------------------------------------ arguments
const args = process.argv.slice(2);
const FETCH = args.includes('--fetch');
const SNAPSHOT_DIRS = args.flatMap((a, i) => (a === '--snapshot-dir' && args[i + 1] ? [path.resolve(args[i + 1])] : []));

// ------------------------------------------------------------------------------------------------------------ the inputs
/** Every subject id with a paper file, and whether its A and B files are there too. */
function subjectIds() {
  const ids = readdirSync(DIR).filter((f) => f.endsWith('-paper.json')).map((f) => f.slice(0, -'-paper.json'.length)).sort();
  return ids.map((id) => ({ id, complete: ['A', 'B'].every((k) => existsSync(path.join(DIR, `${id}-${k}.json`))) }));
}

/** The final verdict for one question from A and B (no final file). */
function verdictFromChecks(a, b) {
  if (b?.verdict === 'dropped') return 'dropped';
  if (b?.verdict === 'off_syllabus' || b?.offSyllabus === true) return 'off_syllabus';
  if (b?.verdict === 'skill') return 'skill';
  if (a?.verdict === 'covered' && b?.verdict === 'covered') return 'covered';
  return 'not_covered';
}

const statusOf = (verdict, matchKind) => {
  if (verdict === 'covered') return matchKind === 'same' ? 'same' : matchKind === 'new-values' ? 'new-values' : 'concept';
  if (verdict === 'skill') return 'skill';
  if (verdict === 'off_syllabus') return 'off-syllabus';
  if (verdict === 'dropped') return 'dropped';
  return 'not-yet';
};

/** "Settled covered: ..." and "Covered: ..." are the checkers' bookkeeping, not part of the reason. */
const cleanReason = (text) => (typeof text === 'string' ? text.replace(/^\s*(settled\s+)?covered\s*:\s*/i, '').trim() : '') || null;

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const dayLine = (iso) => {
  const m = ISO_DAY.exec(String(iso || ''));
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : null;
};
const shiftLine = (shift) => (shift ? `${String(shift).toLowerCase()} shift` : null);

// ------------------------------------------------------------------------------------------------------------ Key cards
const deckCache = new Map();
function deckFor(cardId) {
  const deck = String(cardId).split('.')[1];
  if (!deck) return null;
  if (!deckCache.has(deck)) {
    const file = path.join(DECKS, `${deck}.json`);
    const cards = existsSync(file) ? readJson(file).cards : [];
    deckCache.set(deck, new Map(cards.filter((c) => !c.suspended && c.status !== 'suspended').map((c) => [c.id, c])));
  }
  return deckCache.get(deck);
}
const sourceLine = (src) => {
  if (!src || src.kind !== 'ncert') return null;
  const parts = [`NCERT, ${src.book}`];
  if (src.chapterNo) parts.push(`chapter ${src.chapterNo}`);
  if (src.page) parts.push(`page ${src.page}`);
  return parts.join(', ');
};
function cardMatch(id) {
  const card = deckFor(id)?.get(id);
  if (!card || !card.front || !card.back) return null;
  return { kind: 'card', id, chapter: card.chapter || null, front: card.front, back: card.back, source: sourceLine(card.source) };
}

// ------------------------------------------------------------------------------------------------------------ bank rows
const LETTERS = ['A', 'B', 'C', 'D'];
/** A stored row's options as four plain strings, without a repeated "A " letter at the front of each. */
function optionTexts(options) {
  const list = (Array.isArray(options) ? options : []).map((o) => (typeof o === 'string' ? o : String(o?.text ?? '')).trim());
  const prefixed = list.length === 4 && list.every((t, i) => new RegExp(`^${LETTERS[i]}[\\s.)]+\\S`).test(t));
  return prefixed ? list.map((t) => t.replace(/^[A-D][\s.)]+/, '')) : list;
}
function keyIndex(row) {
  if (Number.isInteger(row.correct_index) && row.correct_index >= 0 && row.correct_index < 4) return row.correct_index;
  const letter = String(row.correct_answer ?? '').trim().toUpperCase();
  const at = LETTERS.indexOf(letter);
  if (at >= 0) return at;
  const opts = Array.isArray(row.options) ? row.options : [];
  const byKey = opts.findIndex((o) => o && typeof o === 'object' && String(o.key).toUpperCase() === letter);
  return byKey >= 0 ? byKey : null;
}
/** A served row in the cache's shape, or null when it cannot be shown whole. */
function cacheEntry(row, from) {
  const stem = String(row.body || row.question || '').trim();
  const options = optionTexts(row.options);
  const key = keyIndex(row);
  if (!stem || options.length !== 4 || options.some((o) => !o) || key === null) return null;
  return {
    subject: row.subject || null,
    chapter: row.chapter || null,
    stem,
    passage: row.passage_text ? String(row.passage_text).trim() : null,
    options,
    key,
    explanation: row.explanation ? String(row.explanation).trim() : null,
    from,
  };
}
const bankMatch = (id, cache) => {
  const row = cache[id];
  if (!row) return null;
  return { kind: 'question', id, chapter: row.chapter, stem: row.stem, passage: row.passage || null, options: row.options, key: row.key, explanation: row.explanation };
};

// ------------------------------------------------------------------------------------------------------------ one subject
function loadSubject(id) {
  const paper = readJson(path.join(DIR, `${id}-paper.json`));
  const A = readJson(path.join(DIR, `${id}-A.json`));
  const B = readJson(path.join(DIR, `${id}-B.json`));
  const final = readIf(path.join(DIR, `${id}-final.json`), null);
  return { id, paper, A, B, final };
}

/** Why a subject cannot be built (a sampled or mismatched check), or null. */
function incomplete({ paper, A, B, final }) {
  const ns = paper.questions.map((q) => q.n).sort((x, y) => x - y).join(',');
  const of = (file) => (file?.questions || []).map((q) => q.n).sort((x, y) => x - y).join(',');
  if (of(A) !== ns) return 'Checker A does not cover every question of the paper';
  if (of(B) !== ns) return 'Checker B does not cover every question of the paper';
  if (final && of(final) !== ns) return 'the final file does not cover every question of the paper';
  return null;
}

/** The ids the pages need words for: the best match of every question that is in MockMob. */
function citedIds(subject) {
  const out = [];
  for (const q of subject.paper.questions) {
    const r = resolveVerdict(subject, q.n);
    if (r.verdict === 'covered' && r.best) out.push(r.best);
  }
  return out;
}

function resolveVerdict({ A, B, final }, n) {
  const a = A.questions.find((x) => x.n === n);
  const b = B.questions.find((x) => x.n === n);
  const f = final?.questions?.find((x) => x.n === n);
  if (f) {
    const verdict = f.verdict;
    return { verdict, matchKind: f.matchKind ?? null, best: f.best || null, reason: f.reason || b?.reason || null, chapter: f.chapter || b?.chapter || a?.chapter || null, type: f.type || b?.type || a?.type || null, a, b };
  }
  const verdict = verdictFromChecks(a, b);
  return { verdict, matchKind: null, best: b?.best || a?.best || null, reason: b?.reason || a?.reason || null, chapter: b?.chapter || a?.chapter || null, type: b?.type || a?.type || null, a, b };
}

/** The other served ids B (and A) cited as teaching part of a covered question, beside the best one. */
function moreCount(r) {
  const ids = new Set();
  for (const m of [...(r.b?.matches || []), ...(r.a?.matches || [])]) if (m?.id) ids.add(m.id);
  ids.delete(r.best);
  const cards = [...ids].filter((x) => x.startsWith('kc.')).length;
  return { cards, questions: ids.size - cards };
}

const passageOf = (paper, q) => {
  if (!q.passage || !paper.passages) return null;
  const p = paper.passages[q.passage];
  return p?.text ? { title: p.title || null, text: p.text } : null;
};

/** "added" or "found" for a question counted now and not at the first check, from added-after.json; null when not listed. */
function sinceOf(record, id, n, best) {
  const row = record?.subjects?.[id];
  if (!row) return null;
  const has = (list) => (list || []).some((x) => x.n === n && x.id === best);
  if (has(row.addedCards) || has(row.addedQuestions)) return 'added';
  if (has(row.found)) return 'found';
  return null;
}

function buildSubject(subject, cache, problems, addedAfter) {
  const { id, paper, A, B, final } = subject;
  const meta = SUBJECTS[id] || { name: titleOf(id), stream: 'other' };
  const snapshotDate = final?.snapshotDate || B.snapshotDate || A.snapshotDate || null;
  const questions = [...paper.questions].sort((x, y) => x.n - y.n).map((q) => {
    const r = resolveVerdict(subject, q.n);
    let status = statusOf(r.verdict, r.matchKind);
    let match = null;
    if (COVERED.has(status)) {
      const best = r.best;
      match = best ? (best.startsWith('kc.') ? cardMatch(best) : bankMatch(best, cache)) : null;
      if (!match) {
        problems.push({ subject: id, n: q.n, id: best || null, problem: best ? 'the cited match is not resolved to served words (bank-cache.json or the Key card decks)' : 'covered without a best match', was: status });
        status = 'not-yet';
      } else {
        match.more = moreCount(r);
      }
    }
    const keys = Array.isArray(q.answerPositions) && q.answerPositions.length ? q.answerPositions : [q.answerPosition];
    const first = COVERED.has(status) && verdictFromChecks(r.a, r.b) === 'covered';
    let since = null;
    if (COVERED.has(status) && !first) {
      since = sinceOf(addedAfter, id, q.n, r.best);
      if (!since) {
        problems.push({ subject: id, n: q.n, id: r.best || null, problem: 'counted now and not at the first check, and not listed in added-after.json: run python scripts/coverage/added-after.py', was: status });
        since = 'added';
      }
    }
    return {
      n: q.n,
      paperNumber: q.paperNumber ?? null,
      section: q.section || null,
      chapter: r.chapter,
      type: r.type,
      stem: q.stem,
      passage: passageOf(paper, q),
      options: q.options,
      key: keys.filter((k) => Number.isInteger(k)).map((k) => k - 1),
      status,
      first,
      since,
      reason: COVERED.has(status) ? cleanReason(r.reason) : null,
      match,
    };
  });

  const count = (s) => questions.filter((q) => q.status === s).length;
  const counts = {
    total: questions.length,
    same: count('same'),
    newValues: count('new-values'),
    concept: count('concept'),
    notYet: count('not-yet'),
    skill: count('skill'),
    offSyllabus: count('off-syllabus'),
    dropped: count('dropped'),
  };
  counts.covered = counts.same + counts.newValues + counts.concept;
  counts.counted = counts.covered + counts.notYet;
  counts.pct = counts.counted ? Math.round((counts.covered / counts.counted) * 100) : 0;
  // The first check, over the same counted questions.
  counts.first = questions.filter((q) => q.first).length;
  counts.firstPct = counts.counted ? Math.round((counts.first / counts.counted) * 100) : 0;
  counts.addedCards = questions.filter((q) => q.since === 'added' && q.match?.kind === 'card').length;
  counts.addedQuestions = questions.filter((q) => q.since === 'added' && q.match?.kind !== 'card').length;
  counts.found = questions.filter((q) => q.since === 'found').length;
  counts.sameFirst = questions.filter((q) => q.first && q.status === 'same').length;
  counts.newValuesFirst = questions.filter((q) => q.first && q.status === 'new-values').length;
  const firstDates = [A.snapshotDate, B.snapshotDate].filter(Boolean).sort();

  const byChapter = new Map();
  for (const q of questions) {
    if (!(COVERED.has(q.status) || q.status === 'not-yet')) continue;
    const name = q.chapter || 'Other';
    const row = byChapter.get(name) || { name, asked: 0, covered: 0 };
    row.asked += 1;
    if (COVERED.has(q.status)) row.covered += 1;
    byChapter.set(name, row);
  }
  const chapters = [...byChapter.values()].sort((x, y) => y.asked - x.asked || x.name.localeCompare(y.name));

  return {
    id,
    name: meta.name,
    stream: meta.stream,
    code: paper.subjectCode || A.provenance?.subjectCode || B.provenance?.subjectCode || null,
    examDate: paper.examDate || null,
    examDay: dayLine(paper.examDate),
    shift: shiftLine(paper.shift),
    snapshotDate,
    snapshotDay: dayLine(snapshotDate),
    firstDate: firstDates[0] || null,
    firstDay: dayLine(firstDates[0]),
    final: Boolean(final),
    counts,
    chapters,
    questions,
  };
}

// ------------------------------------------------------------------------------------------------------------ the cache
function seedFromSnapshots(dirs, wanted, cache, servedChapters) {
  for (const dir of dirs) {
    if (!existsSync(dir)) { console.warn(`snapshot dir not found: ${dir}`); continue; }
    const files = readdirSync(dir);
    const served = new Set();
    for (const f of files.filter((x) => /^served.*\.json$/.test(x))) {
      for (const x of readJson(path.join(dir, f))) served.add(typeof x === 'string' ? x : x?.id);
    }
    for (const f of files.filter((x) => /^bank_.*\.json$/.test(x))) {
      for (const row of readJson(path.join(dir, f))) {
        if (!wanted.has(row.id) || cache[row.id] || !served.has(row.id)) continue;
        const entry = cacheEntry(row, `saved read-only snapshot ${path.basename(dir)}/${f}`);
        if (entry) cache[row.id] = entry;
      }
    }
    const inv = path.join(dir, 'inventory_snapshot.json');
    if (existsSync(inv)) {
      const snap = readJson(inv);
      for (const [subject, counts] of Object.entries(snap.chapterCounts || {})) {
        if (servedChapters.subjects[subject]) continue;
        servedChapters.subjects[subject] = { countedAt: snap.checkedAt || snap.computed_at || null, chapters: counts };
      }
    }
  }
}

async function fetchMissing(missing, needCounts, cache, servedChapters) {
  if (!missing.length && !needCounts.length) { console.log('--fetch: nothing missing, no read made'); return; }
  const require = createRequire(path.join(ROOT, 'package.json'));
  const { createClient } = require('@supabase/supabase-js');
  const env = Object.fromEntries(readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/).map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; }));
  process.env.CUET_EVIDENCE_SIGNING_KEY = env.CUET_EVIDENCE_SIGNING_KEY || process.env.CUET_EVIDENCE_SIGNING_KEY || '';
  process.env.MOCK_AI = 'false';
  const mod = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
  const { INVENTORY_SELECT, isInventoryVisible } = await mod('data/inventory_count.js');
  const { readablePracticeQuestions } = await mod('data/practice_library.js');
  const db = createClient(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const day = new Date().toISOString().slice(0, 10);
  if (missing.length) {
    // SELECT by id only. Served = visible and passing the practice flows' own eligibility.
    const { data, error } = await db.from('questions').select(INVENTORY_SELECT).in('id', missing).eq('is_deleted', false);
    if (error) throw new Error(`read failed: ${error.message}`);
    const eligible = await readablePracticeQuestions((data || []).filter(isInventoryVisible), db, { requireEvidence: false });
    for (const row of eligible) {
      const entry = cacheEntry(row, `read-only fetch ${day}`);
      if (entry) cache[row.id] = entry;
    }
    console.log(`--fetch: ${missing.length} asked, ${eligible.length} served and cached`);
  }
  if (needCounts.length) {
    const { data, error } = await db.from('public_inventory_snapshot').select('value,computed_at').eq('id', 'current').maybeSingle();
    if (error) throw new Error(`read failed: ${error.message}`);
    const v = data?.value || {};
    for (const s of needCounts) {
      if (v.chapterCounts?.[s]) servedChapters.subjects[s] = { countedAt: v.checkedAt || data?.computed_at || null, chapters: v.chapterCounts[s] };
    }
    console.log(`--fetch: served counts per chapter read for ${needCounts.filter((s) => servedChapters.subjects[s]).join(', ') || 'none'}`);
  }
}

// ------------------------------------------------------------------------------------------------------------ main
/** A subject is drawn on the site only at this percent or more (owner LK368). */
const SHOW_MIN_PCT = 0; // was 80 (LK368); the owner, 24 Nov 2026: "Just add the chemistry, maths, and physics also in the science section"
async function main() {
  mkdirSync(OUT, { recursive: true });
  const found = subjectIds();
  const skipped = found.filter((s) => !s.complete).map((s) => ({ id: s.id, why: 'paper without both checks' }));
  const subjects = [];
  for (const s of found.filter((x) => x.complete)) {
    const loaded = loadSubject(s.id);
    const why = incomplete(loaded);
    if (why) skipped.push({ id: s.id, why });
    else subjects.push(loaded);
  }

  const cache = readIf(CACHE, {});
  const servedChapters = readIf(SERVED_CHAPTERS, { rule: null, subjects: {} });
  const wanted = new Set(subjects.flatMap(citedIds).filter((x) => !x.startsWith('kc.')));
  if (SNAPSHOT_DIRS.length) seedFromSnapshots(SNAPSHOT_DIRS, wanted, cache, servedChapters);
  if (FETCH) {
    const missing = [...wanted].filter((x) => !cache[x]);
    const needCounts = subjects.map((s) => bankSubject(s.id)).filter((s) => !servedChapters.subjects[s]);
    await fetchMissing(missing, needCounts, cache, servedChapters);
  }
  // Keep the cache to the ids some page cites, sorted, so its diff stays readable.
  const nextCache = Object.fromEntries([...wanted].filter((x) => cache[x]).sort().map((x) => [x, cache[x]]));
  writeJson(CACHE, nextCache);
  servedChapters.rule = `A chapter has practice in MockMob when at least one of its questions is in MockMob, or MockMob serves at least ${PRACTICE_MIN_SERVED} questions from it (the stored daily count of served questions per chapter).`;
  writeJson(SERVED_CHAPTERS, servedChapters);

  const problems = [];
  // Owner LK368 (22 Nov 2026): "get every subject to at least 80% or above. Once that is done, just build the section."
  // So a subject is shown only when its whole exercise is done (the independent final check wrote <id>-final.json) and it
  // stands at SHOW_MIN_PCT or more; the others are built, listed under `held` with the reason, and not drawn anywhere.
  const addedAfter = readIf(ADDED_AFTER, { subjects: {} });
  const builtAll = subjects.map((s) => buildSubject(s, nextCache, problems, addedAfter));
  const held = [];
  const built = builtAll.filter((s) => {
    const why = !s.final ? 'no final check yet' : s.counts.pct < SHOW_MIN_PCT ? `below ${SHOW_MIN_PCT}%` : null;
    if (why) held.push({ id: s.id, covered: s.counts.covered, counted: s.counts.counted, pct: s.counts.pct, why });
    return !why;
  });
  for (const s of builtAll) writeJson(path.join(OUT, `${s.id}.json`), s);

  // Chapters asked, and those with practice in MockMob.
  let asked = 0;
  let withPractice = 0;
  const chapterList = [];
  for (const s of built) {
    const served = servedChapters.subjects[bankSubject(s.id)]?.chapters || {};
    for (const c of s.chapters) {
      const servedCount = served[c.name] ?? 0;
      const has = c.covered > 0 || servedCount >= PRACTICE_MIN_SERVED;
      asked += 1;
      if (has) withPractice += 1;
      chapterList.push({ subject: s.id, chapter: c.name, asked: c.asked, covered: c.covered, served: servedCount, practice: has });
    }
  }

  const total = built.reduce((t, s) => ({
    counted: t.counted + s.counts.counted,
    covered: t.covered + s.counts.covered,
    same: t.same + s.counts.same,
    newValues: t.newValues + s.counts.newValues,
    concept: t.concept + s.counts.concept,
    notYet: t.notYet + s.counts.notYet,
    skill: t.skill + s.counts.skill,
  }), { counted: 0, covered: 0, same: 0, newValues: 0, concept: 0, notYet: 0, skill: 0 });
  total.pct = total.counted ? Math.round((total.covered / total.counted) * 100) : 0;
  // The first check and what came after it, over the same questions (kept apart from `total`, which older readers hold whole).
  const sumOf = (field) => built.reduce((n, s) => n + s.counts[field], 0);
  const firstDays = [...new Set(built.map((s) => s.firstDate).filter(Boolean))].sort();
  const firstCheck = {
    from: firstDays[0] || null,
    to: firstDays[firstDays.length - 1] || null,
    fromDay: dayLine(firstDays[0]),
    toDay: dayLine(firstDays[firstDays.length - 1]),
    covered: sumOf('first'),
    counted: total.counted,
    pct: total.counted ? Math.round((sumOf('first') / total.counted) * 100) : 0,
    addedCards: sumOf('addedCards'),
    addedQuestions: sumOf('addedQuestions'),
    found: sumOf('found'),
    same: sumOf('sameFirst'),
    newValues: sumOf('newValuesFirst'),
    questions: sumOf('total'),
  };

  const snapshotDates = [...new Set(built.map((s) => s.snapshotDate).filter(Boolean))].sort();
  const summary = {
    builtAt: new Date().toISOString(),
    snapshotDate: snapshotDates[snapshotDates.length - 1] || null,
    snapshotDay: dayLine(snapshotDates[snapshotDates.length - 1]),
    snapshotDates,
    statuses: STATUSES,
    subjects: built.map((s) => ({
      id: s.id, name: s.name, stream: s.stream, examDate: s.examDate, examDay: s.examDay, shift: s.shift,
      total: s.counts.total, counted: s.counts.counted, covered: s.counts.covered, pct: s.counts.pct,
      same: s.counts.same, newValues: s.counts.newValues, concept: s.counts.concept, notYet: s.counts.notYet,
      skill: s.counts.skill, offSyllabus: s.counts.offSyllabus, dropped: s.counts.dropped, final: s.final,
      first: s.counts.first, firstPct: s.counts.firstPct, firstDay: s.firstDay,
      addedCards: s.counts.addedCards, addedQuestions: s.counts.addedQuestions, found: s.counts.found,
    })),
    total,
    firstCheck,
    chapters: { asked, withPractice, minServed: PRACTICE_MIN_SERVED, rule: servedChapters.rule, list: chapterList },
    skipped,
    held,
    showMinPct: SHOW_MIN_PCT,
  };
  writeJson(path.join(OUT, 'summary.json'), summary);
  writeJson(path.join(OUT, 'problems.json'), { builtAt: summary.builtAt, problems });

  if (held.length) console.log(`held (not shown): ${held.map((h) => `${h.id} ${h.covered}/${h.counted} (${h.pct}%), ${h.why}`).join('; ')}`);
  console.log(`subjects built: ${built.map((s) => `${s.id} ${s.counts.covered}/${s.counts.counted} (${s.counts.pct}%)${s.final ? ' final' : ''}`).join(', ') || 'none'}`);
  if (skipped.length) console.log(`skipped: ${skipped.map((s) => `${s.id} (${s.why})`).join(', ')}`);
  console.log(`total ${total.covered}/${total.counted} (${total.pct}%), same ${total.same}, new numbers ${total.newValues}; chapters ${withPractice} of ${asked} with practice`);
  console.log(`first check ${firstCheck.covered}/${firstCheck.counted} (${firstCheck.pct}%), ${firstCheck.fromDay} to ${firstCheck.toDay}; since then ${firstCheck.addedCards} Key cards and ${firstCheck.addedQuestions} questions added, ${firstCheck.found} found`);
  console.log(`problems: ${problems.length}; bank-cache ${Object.keys(nextCache).length} of ${wanted.size} cited bank ids`);
  // The home page's trimmed copies follow the public files (owner LK427, 23 Nov 2026).
  const { buildHome } = await import('./build-home.mjs');
  await buildHome();
}

main().catch((err) => { console.error(err); process.exit(1); });
