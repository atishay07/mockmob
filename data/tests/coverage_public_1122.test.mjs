// The CUET 2026 coverage pages' data (owner LK368, 22 Nov 2026; spec tmp/1122-coverage/UI-SPEC.md), held to the files it is
// counted from. scripts/coverage/build-public.mjs writes data/coverage/cuet2026/public/; these tests recount it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { COVERAGE_PATH, INDEX, STATUS, STATUS_ORDER, STREAMS, SUBJECT } from '../../src/components/coverage/coverageCopy.mjs';
import { COVERAGE_PATH as HOME_PATH, STREAM_ORDER } from '../../src/components/landing/coverage2026.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIR = path.join(ROOT, 'data/coverage/cuet2026');
const PUB = path.join(DIR, 'public');
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const summary = read(path.join(PUB, 'summary.json'));
const subjects = summary.subjects.map((s) => ({ s, file: read(path.join(PUB, `${s.id}.json`)) }));
const cache = read(path.join(DIR, 'bank-cache.json'));
const ALLOWED = new Set(['same', 'new-values', 'concept', 'not-yet', 'skill', 'off-syllabus', 'dropped']);
const COVERED = new Set(['same', 'new-values', 'concept']);
const pct = (covered, counted) => (counted ? Math.round((covered / counted) * 100) : 0);

test('every status is one of the allowed set, and the copy names each of them', () => {
  assert.deepEqual(new Set(summary.statuses), ALLOWED);
  assert.deepEqual(new Set(STATUS_ORDER), ALLOWED);
  for (const { file } of subjects) for (const q of file.questions) assert.ok(ALLOWED.has(q.status), `${file.id} Q${q.n}: ${q.status}`);
  for (const s of ALLOWED) assert.ok(STATUS[s]?.label && STATUS[s]?.meaning, s);
});

test('the summary equals a recount of the per-question files', () => {
  const t = { counted: 0, covered: 0, same: 0, newValues: 0, concept: 0 };
  let asked = 0;
  for (const { s, file } of subjects) {
    const n = (status) => file.questions.filter((q) => q.status === status).length;
    const c = {
      total: file.questions.length, same: n('same'), newValues: n('new-values'), concept: n('concept'), notYet: n('not-yet'),
      skill: n('skill'), offSyllabus: n('off-syllabus'), dropped: n('dropped'),
    };
    c.covered = c.same + c.newValues + c.concept;
    c.counted = c.covered + c.notYet;
    c.pct = pct(c.covered, c.counted);
    for (const k of Object.keys(c)) assert.equal(file.counts[k], c[k], `${s.id} counts.${k}`);
    for (const k of ['counted', 'covered', 'pct', 'same', 'newValues', 'concept', 'notYet']) assert.equal(s[k], c[k], `${s.id} summary.${k}`);
    // Chapter totals add up to the counted questions.
    assert.equal(file.chapters.reduce((x, ch) => x + ch.asked, 0), c.counted, `${s.id} chapters asked`);
    assert.equal(file.chapters.reduce((x, ch) => x + ch.covered, 0), c.covered, `${s.id} chapters covered`);
    asked += file.chapters.length;
    for (const k of Object.keys(t)) t[k] += c[k];
  }
  for (const k of Object.keys(t)) assert.equal(summary.total[k], t[k], `total.${k}`);
  assert.equal(summary.total.pct, pct(t.covered, t.counted));
  assert.equal(summary.chapters.asked, asked);
  const list = summary.chapters.list;
  assert.equal(list.length, asked);
  assert.equal(summary.chapters.withPractice, list.filter((c) => c.practice).length);
  for (const c of list) assert.equal(c.practice, c.covered > 0 || c.served >= summary.chapters.minServed, `${c.subject} ${c.chapter}`);
  assert.match(summary.chapters.rule, new RegExp(`at least ${summary.chapters.minServed} questions`));
});

test('pct is round(covered / counted x 100) everywhere', () => {
  for (const { s, file } of subjects) {
    assert.equal(s.pct, pct(s.covered, s.counted), s.id);
    assert.equal(file.counts.pct, pct(file.counts.covered, file.counts.counted), s.id);
  }
});

test('every covered question carries a resolved match with its words; nothing else carries one', () => {
  const decks = new Map();
  const card = (id) => {
    const deck = id.split('.')[1];
    if (!decks.has(deck)) decks.set(deck, new Map(read(path.join(ROOT, 'data/keycards/decks', `${deck}.json`)).cards.map((c) => [c.id, c])));
    return decks.get(deck).get(id);
  };
  for (const { file } of subjects) {
    for (const q of file.questions) {
      const where = `${file.id} Q${q.n}`;
      assert.equal(q.options.length, 4, where);
      assert.ok(q.key.length >= 1 && q.key.every((k) => Number.isInteger(k) && k >= 0 && k < 4), where);
      if (!COVERED.has(q.status)) { assert.equal(q.match, null, where); continue; }
      const m = q.match;
      assert.ok(m && m.id, where);
      if (m.kind === 'card') {
        const c = card(m.id);
        assert.ok(c, `${where}: card ${m.id} is in its deck`);
        assert.equal(m.front, c.front, where);
        assert.equal(m.back, c.back, where);
        assert.ok(m.front.trim() && m.back.trim(), where);
      } else {
        assert.equal(m.kind, 'question', where);
        assert.ok(cache[m.id], `${where}: ${m.id} is in bank-cache.json`);
        assert.ok(m.stem.trim(), where);
        assert.equal(m.options.length, 4, where);
        assert.ok(m.options.every((o) => o.trim()), where);
        assert.ok(Number.isInteger(m.key) && m.key >= 0 && m.key < 4, where);
      }
      assert.ok(q.reason && q.reason.trim(), `${where} has a reason`);
    }
  }
});

test('without a final file a question is in MockMob only when both checks said covered', () => {
  for (const { s, file } of subjects) {
    if (existsSync(path.join(DIR, `${s.id}-final.json`))) continue;
    const A = read(path.join(DIR, `${s.id}-A.json`)).questions;
    const B = read(path.join(DIR, `${s.id}-B.json`)).questions;
    for (const q of file.questions) {
      const a = A.find((x) => x.n === q.n);
      const b = B.find((x) => x.n === q.n);
      if (COVERED.has(q.status)) {
        assert.equal(q.status, 'concept', `${s.id} Q${q.n}: never upgraded without a final file`);
        assert.ok(a.verdict === 'covered' && b.verdict === 'covered', `${s.id} Q${q.n}`);
      }
      if (b.verdict === 'skill') assert.equal(q.status, 'skill', `${s.id} Q${q.n}`);
    }
  }
});

test('a subject is in the summary only when its paper and both checks exist, and every complete one is there', () => {
  const ids = readdirSync(DIR).filter((f) => f.endsWith('-paper.json')).map((f) => f.slice(0, -'-paper.json'.length));
  const complete = ids.filter((id) => existsSync(path.join(DIR, `${id}-A.json`)) && existsSync(path.join(DIR, `${id}-B.json`)));
  const skipped = new Set((summary.skipped || []).map((x) => x.id));
  for (const { s } of subjects) assert.ok(complete.includes(s.id), s.id);
  // Owner LK368 set a bar of 80%; on 24 Nov 2026 he asked for Chemistry, Maths and Physics to be shown as they stand, so the
  // bar is 0: a subject is drawn once its final check is done, at its true figure.
  const held = new Map((summary.held || []).map((x) => [x.id, x]));
  assert.equal(summary.showMinPct, 0);
  for (const id of complete) assert.ok(summary.subjects.some((s) => s.id === id) || skipped.has(id) || held.has(id), `${id} is shown, held or skipped`);
  for (const s of summary.subjects) { assert.ok(s.final === true && s.pct >= summary.showMinPct, `${s.id} is shown at ${s.pct}%`); assert.ok(!held.has(s.id), s.id); }
  for (const h of held.values()) assert.ok(h.why === 'no final check yet' || h.pct < summary.showMinPct, `${h.id} is held for a reason`);
});

test("the README's three finals still hold while no final file exists", () => {
  const readme = readFileSync(path.join(DIR, 'README.md'), 'utf8').replace(/\s+/g, ' ');
  const want = { accountancy: [38, 55, '69\\.1'], economics: [32, 45, '71\\.1'], 'business-studies': [30, 49, '61\\.2'] };
  const names = { accountancy: 'Accountancy', economics: 'Economics', 'business-studies': 'Business Studies' };
  let covered = 0;
  let counted = 0;
  for (const [id, [c, of, p]] of Object.entries(want)) {
    if (existsSync(path.join(DIR, `${id}-final.json`))) continue;
    const s = summary.subjects.find((x) => x.id === id);
    assert.ok(s, `${id} is built`);
    assert.equal(s.covered, c, id);
    assert.equal(s.counted, of, id);
    assert.match(readme, new RegExp(`${names[id]} ${c} of ${of} \\(${p}%`));
    covered += c;
    counted += of;
  }
  if (counted === 149) assert.match(readme, new RegExp(`All three: ${covered} of ${counted} \\(67\\.1%\\)`));
});

test('the words: plain, no competitor, never a prediction', () => {
  const words = [];
  const walk = (v) => {
    if (typeof v === 'string') words.push(v);
    else if (typeof v === 'function') {
      const fake = { name: 'Accountancy', examDay: '20 May 2026', shift: 'first shift', snapshotDay: '20 November 2026', counts: { total: 55, covered: 38, counted: 55 } };
      for (const args of [[fake], [1, 2], [2, 1], [10]]) { try { walk(v(...args)); } catch { /* not this shape */ } }
    } else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(INDEX);
  walk(SUBJECT);
  walk(STATUS);
  for (const text of words) {
    assert.doesNotMatch(text, /[—!]|\p{Extended_Pictographic}/u, text);
    assert.doesNotMatch(text, /preparoo|highest in the market|guarantee|leaked/i, text);
    if (/predict/i.test(text)) assert.equal(text, INDEX.after, text);
  }
  assert.equal(INDEX.after, 'This is a check made after the exam. It is not a prediction of the next paper.');
});

test("the home teaser's address and stream order are the full pages' own", () => {
  assert.equal(HOME_PATH, COVERAGE_PATH);
  assert.deepEqual([...STREAM_ORDER], STREAMS.map((s) => s.id));
});

test('the pages are static and the filter is their only script', () => {
  const src = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');
  assert.match(src('src/app/cuet-2026-coverage/[subject]/page.js'), /export const dynamicParams = false/);
  assert.match(src('src/app/cuet-2026-coverage/[subject]/page.js'), /generateStaticParams/);
  const dir = path.join(ROOT, 'src/components/coverage');
  const clients = readdirSync(dir).filter((f) => /\.(jsx?|mjs)$/.test(f) && /^'use client'/m.test(readFileSync(path.join(dir, f), 'utf8')));
  assert.deepEqual(clients, ['CoverageFilter.jsx']);
  for (const rel of ['src/app/cuet-2026-coverage/page.js', 'src/app/cuet-2026-coverage/[subject]/page.js']) assert.doesNotMatch(src(rel), /'use client'/);
  assert.match(src('src/app/sitemap.js'), /cuet-2026-coverage|COVERAGE_PATH/);
});

// ---- The first check, on record and not drawn (owner, 23 Nov 2026 evening). The data files keep what MockMob taught before
// anything was written for these papers, and which matches were written after; the pages show today's figure only.
test('the first check is on record in the data, counted from the two first checks themselves', () => {
  const fc = summary.firstCheck;
  assert.ok(fc, 'summary.firstCheck');
  const record = read(path.join(DIR, 'added-after.json'));
  let first = 0;
  for (const { s, file } of subjects) {
    const A = new Map(read(path.join(DIR, `${s.id}-A.json`)).questions.map((q) => [q.n, q.verdict]));
    const B = new Map(read(path.join(DIR, `${s.id}-B.json`)).questions.map((q) => [q.n, q.verdict]));
    const own = file.questions.filter((q) => COVERED.has(q.status) && A.get(q.n) === 'covered' && B.get(q.n) === 'covered').length;
    assert.equal(s.first, own, `${s.id}: first check`);
    assert.equal(s.first + s.addedCards + s.addedQuestions + s.found, s.covered, `${s.id}: first + added + found = now`);
    const row = record.subjects[s.id] || { addedCards: [], addedQuestions: [], found: [] };
    const listed = new Map([...row.addedCards, ...row.addedQuestions].map((x) => [x.n, ['added', x.id]]).concat(row.found.map((x) => [x.n, ['found', x.id]])));
    for (const q of file.questions) {
      assert.equal(Boolean(q.first || q.since), COVERED.has(q.status), `${file.id} Q${q.n}`);
      if (q.since) assert.deepEqual(listed.get(q.n), [q.since, q.match.id], `${file.id} Q${q.n}: on record in added-after.json`);
    }
    assert.equal(listed.size, s.addedCards + s.addedQuestions + s.found, `${s.id}: nothing on record that the paper does not show`);
    first += own;
  }
  assert.equal(fc.covered, first);
  assert.equal(fc.counted, summary.total.counted);
  assert.equal(fc.covered + fc.addedCards + fc.addedQuestions + fc.found, summary.total.covered);
  // Not drawn: no page reads these fields.
  const src = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');
  for (const rel of ['src/app/cuet-2026-coverage/page.js', 'src/app/cuet-2026-coverage/[subject]/page.js', 'src/components/coverage/CoveragePieces.jsx', 'src/components/coverage/coverageCopy.mjs']) {
    assert.doesNotMatch(src(rel), /firstCheck|\.since\b|addedCards/, rel);
  }
});
