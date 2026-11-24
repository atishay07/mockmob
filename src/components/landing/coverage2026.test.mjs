// The CUET 2026 check on the home page, question by question (owner LK427, 23 Nov 2026; it replaced the teaser of LK368),
// held to the data it comes from: the figures to summary.json, the strips and the trimmed papers to the per-question files.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { COVERAGE_MARKS, COVERAGE_PATH, COVERAGE_STRIPS, COVERAGE_SUMMARY, coverageExplorer, coveragePct, homeQuestion, homeSubject, marksOf, stripOf } from './coverage2026.mjs';
import { CODE_STATUS, EXPLORER, HOME_STREAMS, LEGEND, STATUS_CODE, STATUS_WORDS, firstPick, groupOf, howWeCounted, viewStrip } from './coverageWords.mjs';

const path = (rel) => fileURLToPath(new URL(`../../../${rel}`, import.meta.url));
const read = (rel) => readFileSync(path(rel), 'utf8');
const json = (rel) => JSON.parse(read(rel));
const summary = json('data/coverage/cuet2026/public/summary.json');
const full = (id) => json(`data/coverage/cuet2026/public/${id}.json`);
const home = (id) => json(`data/coverage/cuet2026/home/${id}.json`);
const COUNT_FIELD = { same: 'same', 'new-values': 'newValues', concept: 'concept', 'not-yet': 'notYet', skill: 'skill', 'off-syllabus': 'offSyllabus', dropped: 'dropped' };

test('every number is the built summary, never a number typed here', () => {
  assert.deepEqual(COVERAGE_SUMMARY.total, summary.total);
  const model = coverageExplorer();
  assert.deepEqual(model.total, { covered: summary.total.covered, of: summary.total.counted, pct: summary.total.pct, papers: summary.subjects.length });
  assert.deepEqual(model.before, { covered: summary.firstCheck.covered, of: summary.firstCheck.counted, pct: summary.firstCheck.pct });
  assert.equal(model.total.pct, coveragePct(summary.total.covered, summary.total.counted));
  assert.equal(Object.keys(model.subjects).length, summary.subjects.length);
  for (const src of summary.subjects) {
    const s = model.subjects[src.id];
    assert.ok(s, `${src.id} is in the model`);
    assert.deepEqual([s.covered, s.of, s.pct, s.total], [src.covered, src.counted, src.pct, src.total], src.id);
    assert.equal(s.pct, coveragePct(src.covered, src.counted), src.id);
    for (const [status, field] of Object.entries(COUNT_FIELD)) assert.equal(s.counts[field], src[field], `${src.id} ${status}`);
    assert.equal(s.href, `${COVERAGE_PATH}/${src.id}`);
    assert.equal(s.sitting, `${src.examDay}, ${src.shift}`);
  }
  // The sum of the papers is the total: the head's line cannot drift from the chips.
  const sum = (f) => Object.values(model.subjects).reduce((n, s) => n + s[f], 0);
  assert.deepEqual([sum('covered'), sum('of')], [model.total.covered, model.total.of]);
});

test('every subject can be reached: each is under one stream tab, and each stream tab has a subject', () => {
  const model = coverageExplorer();
  const reached = model.streams.flatMap((stream) => stream.subjects);
  assert.deepEqual([...reached].sort(), summary.subjects.map((s) => s.id).sort());
  assert.equal(new Set(reached).size, reached.length, 'no subject sits under two tabs');
  for (const stream of model.streams) {
    assert.ok(stream.subjects.length > 0, stream.id);
    for (const id of stream.subjects) assert.equal(model.subjects[id].stream, stream.id);
  }
  assert.deepEqual(HOME_STREAMS.map((s) => s.name), ['Commerce', 'Humanities', 'Science'], "the owner's order (LK427)");
  // A subject in a stream the tabs do not have would be unreachable: this fails first.
  for (const s of summary.subjects) assert.ok(HOME_STREAMS.some((stream) => stream.id === s.stream), `${s.id}: stream ${s.stream} has a tab`);
});

test('the Science tab says plainly which papers are still being checked, and a paper leaves the note once it is checked', () => {
  const science = coverageExplorer().streams.find((s) => s.id === 'science');
  const have = new Set(summary.subjects.map((s) => s.id));
  const expected = [['physics', 'Physics'], ['chemistry', 'Chemistry'], ['mathematics', 'Maths']].filter(([id]) => !have.has(id)).map(([, name]) => name);
  assert.deepEqual(science.pending, expected);
  if (expected.length === 3) assert.equal(EXPLORER.pending(science.pending), 'Physics, Chemistry and Maths are still being checked.');
  assert.equal(EXPLORER.pending(['Physics']), 'Physics is still being checked.');
  const withPhysics = { ...summary, subjects: [...summary.subjects, { ...summary.subjects[0], id: 'physics', name: 'Physics', stream: 'science' }] };
  const after = coverageExplorer(withPhysics, { ...COVERAGE_STRIPS, physics: 'c' }).streams.find((s) => s.id === 'science');
  assert.ok(after.subjects.includes('physics'));
  assert.ok(!after.pending.includes('Physics'));
});

test('every status maps to its words, and to one letter of the strip', () => {
  assert.deepEqual(Object.keys(STATUS_WORDS).sort(), [...summary.statuses].sort());
  assert.deepEqual(Object.keys(STATUS_CODE).sort(), [...summary.statuses].sort());
  assert.equal(new Set(Object.values(STATUS_CODE)).size, summary.statuses.length, 'one letter a status');
  for (const status of summary.statuses) {
    const w = STATUS_WORDS[status];
    assert.ok(w.label && w.short && w.line, status);
    assert.equal(CODE_STATUS[STATUS_CODE[status]], status);
    assert.equal(groupOf(status), w.group);
  }
  assert.equal(STATUS_WORDS.same.label, 'Same question');
  assert.equal(STATUS_WORDS['new-values'].label, 'Same question, new numbers');
  assert.equal(STATUS_WORDS.concept.label, 'Taught as a concept');
  assert.equal(STATUS_WORDS['not-yet'].label, 'Not in MockMob yet');
  assert.equal(STATUS_WORDS.skill.label, 'Answer is in the passage');
  assert.match(STATUS_WORDS.skill.line, /left out of the count\.$/);
  assert.deepEqual(['same', 'new-values', 'concept'].map(groupOf), ['in', 'in', 'in']);
  assert.equal(groupOf('not-yet'), 'not');
  assert.deepEqual(['skill', 'off-syllabus', 'dropped'].map(groupOf), ['out', 'out', 'out']);
  // The legend names every count field once, so its numbers add up to the paper.
  assert.deepEqual(LEGEND.flatMap((item) => item.fields).sort(), Object.values(COUNT_FIELD).sort());
});

test('each strip is its paper, question for question, and counts to the summary', () => {
  assert.deepEqual(Object.keys(COVERAGE_STRIPS).sort(), summary.subjects.map((s) => s.id).sort());
  for (const s of summary.subjects) {
    const file = full(s.id);
    const strip = COVERAGE_STRIPS[s.id];
    assert.equal(strip, stripOf(file), s.id);
    assert.equal(strip.length, s.total, `${s.id}: one cell a question`);
    file.questions.forEach((q, i) => {
      assert.equal(q.n, i + 1, `${s.id}: questions are numbered in order`);
      assert.equal(CODE_STATUS[strip[i]], q.status, `${s.id} Q${q.n}`);
    });
    for (const [status, field] of Object.entries(COUNT_FIELD)) {
      assert.equal([...strip].filter((c) => c === STATUS_CODE[status]).length, s[field], `${s.id} ${status}`);
    }
  }
});

test('the trimmed papers are what build-home.mjs writes, and carry the words of every match', () => {
  const files = readdirSync(path('data/coverage/cuet2026/home')).sort();
  assert.deepEqual(files, [...summary.subjects.map((s) => `${s.id}.json`), 'strips.json', 'marks.json'].sort());
  for (const s of summary.subjects) {
    const file = full(s.id);
    const slim = home(s.id);
    assert.deepEqual(slim, JSON.parse(JSON.stringify(homeSubject(file))), `${s.id}: run node scripts/coverage/build-home.mjs`);
    for (const q of file.questions) {
      const h = homeQuestion(slim, q.n);
      assert.deepEqual([h.stem, h.options, h.key, h.status, h.chapter], [q.stem, q.options, q.key, q.status, q.chapter || null], `${s.id} Q${q.n}`);
      assert.equal(h.passage?.text ?? null, q.passage?.text ?? null, `${s.id} Q${q.n} passage`);
      if (!q.match) { assert.equal(h.match, null); continue; }
      if (q.match.kind === 'card') assert.deepEqual([h.match.front, h.match.back, h.match.source], [q.match.front, q.match.back, q.match.source || null]);
      else assert.deepEqual([h.match.stem, h.match.options, h.match.key], [q.match.stem, q.match.options, q.match.key]);
    }
    // The home page never ships the checker's notes or ids.
    assert.doesNotMatch(JSON.stringify(slim), /"(reason|explanation|paperNumber|section)":/);
    assert.doesNotMatch(JSON.stringify(slim.questions), /"id":/);
  }
});

test('it opens on Commerce, Accountancy, with a "Same question" cell chosen, and that pair is in the page', () => {
  const model = coverageExplorer();
  assert.deepEqual([model.first.stream, model.first.subject], ['commerce', 'accountancy']);
  const strip = model.subjects.accountancy.strip;
  assert.equal(model.first.n, firstPick(strip));
  assert.equal(CODE_STATUS[strip[model.first.n - 1]], 'same');
  assert.equal(firstPick('ccvn'), 3);
  assert.equal(firstPick('ncck'), 2);
  assert.equal(firstPick('nnk'), 1);
  const shell = read('src/components/landing/CoverageProof.jsx');
  assert.match(shell, new RegExp(`home/${model.first.subject}\\.json`), 'the shell reads the first paper');
  const q = homeQuestion(home(model.first.subject), model.first.n);
  assert.ok(q && q.match, 'the first pair has a match to show');
});

test('a paper is fetched only when chosen: nine loaders, no paper in the page but the first question', () => {
  const explorer = read('src/components/landing/CoverageExplorer.jsx');
  assert.match(explorer, /^'use client'/);
  for (const s of summary.subjects) {
    assert.match(explorer, new RegExp(`import\\('\\.\\./\\.\\./\\.\\./data/coverage/cuet2026/home/${s.id}\\.json'\\)`), `${s.id} has a loader`);
    assert.ok(existsSync(path(`data/coverage/cuet2026/home/${s.id}.json`)));
  }
  assert.equal((explorer.match(/import\('[^']*home\/[a-z-]+\.json'\)/g) || []).length, summary.subjects.length, 'no loader without a subject');
  // The words module the browser gets imports no data; the summary stays on the server.
  assert.doesNotMatch(read('src/components/landing/coverageWords.mjs'), /^import /m);
  assert.doesNotMatch(explorer, /coverage2026\.mjs|summary\.json|public\//);
  // Nothing plays by itself: no timer drives the choice, only taps and keys.
  assert.doesNotMatch(explorer, /setInterval|autoplay/i);
  // The model in the page stays small (one short string a paper).
  assert.ok(JSON.stringify(coverageExplorer()).length < 9000); // thirteen papers since 24 Nov 2026
});

test('the words say what was checked: no hype, no prediction, no comparison with another company', () => {
  const words = [];
  const walk = (v) => {
    if (typeof v === 'string') words.push(v);
    else if (typeof v === 'function') { for (const args of [[1, 2, 9], ['Accountancy', 55], [['Physics', 'Maths']], ['20 May 2026, first shift']]) { try { walk(v(...args)); } catch { /* not this shape */ } } }
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(EXPLORER);
  walk(STATUS_WORDS);
  assert.ok(words.length > 30);
  for (const text of words) {
    assert.doesNotMatch(text, /[—!]|\p{Extended_Pictographic}/u, text);
    assert.doesNotMatch(text, /predict|guarantee|came from MockMob|leaked|preparoo|highest in the market|73%/i, text);
  }
  assert.equal(EXPLORER.h2, 'CUET 2026, checked question by question.');
  assert.ok(EXPLORER.h2.includes(EXPLORER.mark));
  assert.equal(EXPLORER.note('20 May 2026, first shift'), 'This paper: 20 May 2026, first shift.');
  assert.equal(EXPLORER.note(''), '');
  assert.equal(EXPLORER.total(382, 416, 9), '382 of 416 questions from 9 CUET 2026 papers are taught in MockMob.');
});

test('the section sits right before pricing, keeps its address, and links each paper to its full page', () => {
  const shell = read('src/components/landing/CoverageProof.jsx');
  assert.doesNotMatch(shell, /'use client'/);
  assert.match(shell, /<section className="lp-sec lp-cov" id="cuet-2026"/);
  const explorer = read('src/components/landing/CoverageExplorer.jsx');
  assert.match(explorer, /href=\{subject\.href\}/);
  // The way to every paper is the sheet's own key ("Open all 9 papers"), under the figure.
  assert.match(read('src/components/landing/coverageWords.mjs'), /link: \{ href: COVERAGE_PATH,/);
  assert.match(shell, /<CoverageHow key="how" how=\{howWeCounted\(\{ total: model\.total, before: model\.before \}\)\} \/>/);
  const css = read('src/components/landing/coverage-proof.css');
  assert.doesNotMatch(css, /position:\s*(fixed|sticky)/);
  assert.doesNotMatch(css, /infinite/, 'nothing loops');
  assert.match(css, /prefers-reduced-motion: reduce/);
  const page = read('src/app/page.js');
  assert.match(page, /<Later><CoverageProof \/><\/Later>/);
  // Owner, 23 Nov 2026 evening: the check sits right above the Mistake Lab.
  const at = page.indexOf('<Later><CoverageProof />');
  const lab = page.indexOf('id="inside-the-lab"');
  assert.ok(at > 0 && lab > at, 'the check comes before the Mistake Lab');
  assert.doesNotMatch(page.slice(at + 30, page.lastIndexOf('<Later>', lab)), /<Later>/, 'nothing between the check and the Lab');
  assert.match(page, /const HASH_IDS = \[[^\]]*'cuet-2026'/, '/#cuet-2026 lands on the section');
  // The full pages stay: the index and one page a subject.
  assert.ok(existsSync(path('src/app/cuet-2026-coverage/page.js')));
  assert.ok(existsSync(path('src/app/cuet-2026-coverage/[subject]/page.js')));
});

// ---- Owner, 23 Nov 2026 evening: "way too much transparency and clutter ... how clean, aesthetic, and elegant" his reference
// is. One figure, a strip that draws three things, and one quiet key to a short sheet.
test('the strip and its legend draw three things: in MockMob, not yet, not counted', () => {
  assert.deepEqual(LEGEND.map((item) => item.label), ['In MockMob', 'Not yet', 'Answer is in the passage']);
  assert.deepEqual(LEGEND[0].fields, ['same', 'newValues', 'concept']);
  for (const s of summary.subjects) {
    const legend = LEGEND.map((item) => item.fields.reduce((sum, f) => sum + (s[f] || 0), 0));
    assert.deepEqual(legend, [s.covered, s.notYet, s.skill + s.offSyllabus + s.dropped], `${s.id}: the legend is the paper's own count`);
    assert.equal(legend.reduce((a, b) => a + b, 0), s.total, `${s.id}: every question is in the legend once`);
  }
  const css = read('src/components/landing/coverage-proof.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /\.lp-cq-st--concept, \.lp-cq-st--same, \.lp-cq-st--new-values \{ background: var\(--cq-in\); \}/, 'one look for a question in MockMob');
  assert.doesNotMatch(css, /\.lp-cq-st--(same|new-values) \{[^}]*(repeating-linear-gradient|inset 0 0 0 4px)/, 'no rings or stripes on the strip');
  assert.match(css, /\.lp-cq-st--not-yet \{[^}]*repeating-linear-gradient/, 'not yet is hollow and hatched: never colour alone');
  // Which kind of match a question has is still said, once, on the chosen question.
  assert.match(read('src/components/landing/CoverageExplorer.jsx'), /<b>\{words\.label\}<\/b>/);
});

test('"How we counted" is one quiet key and a sheet built like his reference: logo, a question, bold lead-ins, the two figures, no prediction', () => {
  const model = coverageExplorer();
  const how = howWeCounted({ total: model.total, before: model.before });
  assert.equal(how.button, 'How we counted');
  assert.equal(how.title, 'What does “in MockMob” mean?');
  assert.deepEqual(how.sections.map((s) => s.id), ['counts', 'check']);
  assert.ok(how.sections.every((s) => s.points.length <= 3), 'short lists');
  assert.ok(how.sections.every((s) => s.points.every((p) => /:$/.test(p.lead) && p.text)), 'every point has a bold lead-in');
  assert.deepEqual(how.sections[0].points.map((p) => p.lead), ['Theory questions:', 'Numerical questions:', 'Passage questions:']);
  assert.equal(how.note.text, `We checked ${summary.subjects.length} CUET 2026 papers, one shift of each subject: ${summary.total.counted} questions in all. Previously, ${summary.firstCheck.covered} (${summary.firstCheck.pct}%) were in MockMob. Now ${summary.total.covered} (${summary.total.pct}%) are.`);
  assert.match(how.claim.text, /It is not a prediction\.$/);
  assert.deepEqual(how.link, { href: COVERAGE_PATH, text: `Open all ${summary.subjects.length} papers` });
  const words = [how.title, how.lead, how.claim.lead, how.claim.text, how.note.text, how.link.text, ...how.sections.flatMap((s) => [s.head || '', s.lead || '', ...s.points.flatMap((p) => [p.lead, p.text])])];
  for (const w of words) {
    assert.doesNotMatch(w, /[—!]|\p{Extended_Pictographic}/u, w);
    assert.doesNotMatch(w, /guarantee|came from MockMob|leaked|preparoo|highest in the market|73%/i, w);
    assert.doesNotMatch(w, /2026 bank|before the exam|already covered|had covered|we had/i, w);
  }
  const sheet = read('src/components/landing/CoverageHow.jsx');
  assert.match(sheet, /^'use client'/);
  assert.match(sheet, /<dialog ref=\{dialogRef\} className="lp-ch" aria-labelledby="lp-ch-title"/, 'a native dialog: Esc closes it and the page behind is inert');
  assert.match(sheet, /showModal\(\)/);
  assert.match(sheet, /className="lp-ch-key" onClick=\{open\}/);
  assert.match(sheet, /keyRef\.current\?\.focus\(\{ preventScroll: true \}\)/, 'focus returns to the key');
  // Two figures as one switch (owner, 23 Nov 2026): the first check and now, each a key with its own number. No dates, no marks.
  const explorer = read('src/components/landing/CoverageExplorer.jsx');
  // 24 Nov 2026 (owner: "a subject-specific score"; "a tag ... old bank and new bank"): the keys carry the chosen paper's two
  // figures under their bank's name, level with each other; all papers together are said in one line under them.
  assert.match(explorer, /\[\['before', subject\.first\], \['now', subject\]\]/);
  assert.match(explorer, /<span className="lp-cv__bank">\{C\.bank\[id\]\}<\/span>/);
  assert.deepEqual(EXPLORER.bank, { before: 'Old bank', now: 'New bank' });
  assert.equal(EXPLORER.allPapers(66, 99, 13), 'All 13 papers together: 66% with the old bank, 99% with the new bank.');
  assert.match(explorer, /C\.allPapers\(model\.before\.pct, model\.total\.pct, model\.total\.papers\)/);
  assert.match(read('src/components/landing/coverage-proof.css'), /\.lp-cv__name \{[^}]*min-height: 2\.4em/, 'both names take two lines, so the figures stand level');
  // The chosen question's place never shrinks within a paper: picking a square moves nothing under it up.
  assert.match(explorer, /el\.style\.minHeight = `\$\{h\}px`/);
  assert.match(explorer, /useState\('now'\)/);
  assert.doesNotMatch(explorer, /data-since/);
  assert.deepEqual(EXPLORER.view, { before: 'Previously, for CUET 2026', now: 'Now, for CUET 2027' });
  assert.deepEqual(COVERAGE_MARKS, json('data/coverage/cuet2026/home/marks.json'));
  for (const s of summary.subjects) {
    const marks = COVERAGE_MARKS[s.id];
    assert.equal(marks, marksOf(full(s.id)), s.id);
    assert.equal([...marks].filter((m) => m === '1').length, s.first, `${s.id}: the marks count to the first check`);
    const strip = COVERAGE_STRIPS[s.id];
    assert.equal(viewStrip(strip, marks, 'now'), strip);
    assert.equal([...viewStrip(strip, marks, 'before')].filter((c) => 'svc'.includes(c)).length, s.first, `${s.id}: the first view counts to the first check`);
    assert.deepEqual(model.subjects[s.id].first, { covered: s.first, pct: s.firstPct });
  }
});
