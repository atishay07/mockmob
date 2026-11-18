// The pen and the highlighter on the public pages beyond the home page (18 Nov 2026, lane marks). The placements live in
// src/lib/publicMarks.mjs; the pages draw them with the home page's own Doodle/Marked (src/components/doodle/Doodle.jsx).
// Source-level checks of the placement rules that can be read from the code: the phrase and the mark on each page, one mark
// per heading, phrases of one to three words and at most 20 characters, at most one highlight per page, the mark that fits
// the words, no red pen (no page here is about a mistake), and no marks at all on the pages of plain facts.
// The rendered checks (360, 390 and 1440, Day and Night, real Chrome, scrolled like a reader) are in the lane's report.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const load = (rel) => import(pathToFileURL(join(ROOT, rel)).href);

const { PUBLIC_MARKS, GUIDE_MARKS, GUIDE_CLOSE_MARK, PLAIN_FACT_PAGES, MISTAKE_PAGES } = await load('src/lib/publicMarks.mjs');

const close = ['not practice.', 'squiggle', 'brand'];
// page key -> heading -> [phrase, mark, tone]
const PINS = {
  pricing: { head: ['without limits', 'highlight', 'volt'] },
  features: { head: ['free tools', 'highlight', 'volt'] },
  about: { head: ['one exam', 'underline', 'ink'] },
  daily: { head: ['Five', 'circle', 'brand'] },
  keyCards: { head: ['free to read', 'highlight', 'volt'], close: ['you read.', 'squiggle', 'brand'] },
  keyCardsChapter: { head: ['free to read', 'highlight', 'volt'] },
  cuet2027: { head: ['plan that works', 'underline', 'ink'], close },
  freeMockTest: { head: ['free', 'highlight', 'volt'], close },
  practiceTests: { head: ['practice tests', 'underline', 'ink'], close },
  previousYearQuestions: { close },
  subject: { head: ['mock tests', 'underline', 'ink'], keyCards: ['free to read', 'highlight', 'volt'], close },
  calculator: { sources: ['own documents', 'underline', 'ink'] },
  duCourse: { head: ['2026', 'circle', 'brand'] },
  duCollege: { head: ['2026', 'circle', 'brand'] },
  login: { head: ['next chapter', 'underline', 'ink'] },
  signup: { head: ['CUET 2027', 'circle', 'brand'] },
  notFound: { head: ['not here.', 'underline', 'current'] },
};

test('each page carries the pinned phrase and mark, and nothing else', () => {
  const flat = Object.fromEntries(Object.entries(PUBLIC_MARKS).map(([page, heads]) => [page, Object.fromEntries(Object.entries(heads).map(([h, [phrase, p]]) => [h, [phrase, p.mark, p.tone]]))]));
  assert.deepEqual(flat, PINS);
  assert.deepEqual(GUIDE_CLOSE_MARK, ['not practice.', { mark: 'squiggle', tone: 'brand' }]);
  assert.deepEqual(Object.keys(GUIDE_MARKS).sort(), ['cuet-2027', 'cuet-mock-test-free', 'cuet-practice-tests-online', 'cuet-previous-year-questions']);
});

test('the placement rules: short phrases, the mark that fits the words, one highlight a page, no red pen', () => {
  const toneFor = { highlight: ['volt'], circle: ['brand', 'ink'], underline: ['ink'], double: ['ink'], squiggle: ['brand'] };
  for (const [page, heads] of Object.entries(PUBLIC_MARKS)) {
    let highlights = 0;
    for (const [head, entry] of Object.entries(heads)) {
      assert.equal(entry.length, 2, `${page}.${head}: one phrase, one mark`);
      const [phrase, { mark, tone, ...rest }] = entry;
      assert.deepEqual(rest, {}, `${page}.${head}: no delay or other props`);
      assert.ok(phrase.length >= 1 && phrase.length <= 20, `${page}.${head}: "${phrase}" is at most 20 characters`);
      const words = phrase.trim().split(/\s+/).length;
      assert.ok(words >= 1 && words <= 3, `${page}.${head}: "${phrase}" is one to three words`);
      assert.ok(toneFor[mark], `${page}.${head}: ${mark} is not used in this lane (strike, spark, tick and cross are not)`);
      if (tone === 'pen') assert.ok(MISTAKE_PAGES.includes(page), `${page}.${head}: the red pen only on words about a mistake`);
      else if (page === 'notFound') assert.equal(tone, 'current', 'the arena shell: the words’ own colour (its --ink is dark in Night)');
      else assert.ok(toneFor[mark].includes(tone), `${page}.${head}: ${mark} in ${tone}`);
      if (mark === 'highlight') highlights += 1;
    }
    assert.ok(highlights <= 1, `${page}: at most one highlight`);
  }
  assert.deepEqual(MISTAKE_PAGES, [], 'no page in this lane is about a mistake');
});

test('each phrase is in the words its page draws', async () => {
  assert.match(read('src/app/pricing/page.js'), /title: 'Practise without limits',/);
  assert.ok(read('src/app/features/page.js').includes('<Marked text="CUET UG practice that shows where your marks went and what to do next, plus free tools for DU admissions." marks={[PUBLIC_MARKS.features.head]} />'));
  assert.ok(read('src/app/about/page.js').includes('<h1 className="mm-h1"><Marked text="Built for one exam: CUET." marks={[PUBLIC_MARKS.about.head]} /></h1>'));
  assert.ok(read('src/app/key-cards/page.js').includes('free to read, with no account." marks={[PUBLIC_MARKS.keyCards.head]} />'));
  assert.ok(read('src/app/key-cards/page.js').includes('<h2 className="mm-h2"><Marked text="Keep the cards you read." marks={[PUBLIC_MARKS.keyCards.close]} /></h2>'));
  const { freeLine } = await load('src/components/keycards/public/publicDeckCopy.mjs');
  for (const [open, total] of [[1, 1], [5, 5], [5, 52]]) assert.ok(freeLine(open, total, 'English').includes('free to read'), `the chapter line ${open}/${total}`);
  const { seoPages } = await load('src/lib/seoPages.js');
  assert.ok(seoPages.freeMockTest.h1.includes('free'));
  assert.ok(seoPages.practiceTests.h1.includes('practice tests'));
  assert.match(read('src/app/cuet-2027/page.js'), /h1: 'CUET 2027: pattern, expected dates and a plan that works',/);
  const hubs = [...read('src/lib/subjectHubs.js').matchAll(/^\s+h1: '([^']+)',$/gm)].map((m) => m[1]);
  assert.ok(hubs.length >= 15, 'every subject page');
  for (const h1 of hubs) assert.ok(h1.includes(' mock tests '), h1);
  assert.match(read('src/app/login/LoginPageClient.jsx'), /'Your next chapter is waiting\.'\}\n {6}titleMark=\{invite \? null : PUBLIC_MARKS\.login\.head\}/);
  assert.match(read('src/app/signup/SignupPageClient.jsx'), /'Start your CUET 2027 practice\.'\}\n {6}titleMark=\{invite \|\| carried \? null : PUBLIC_MARKS\.signup\.head\}/);
  assert.ok(read('src/components/SiteNotFound.jsx').includes('title={<Marked text="That page is not here." marks={[PUBLIC_MARKS.notFound.head]} />}'));
});

test('where each mark is drawn: the heading it belongs to, and only there', () => {
  assert.ok(read('src/app/pricing/page.js').includes('<h1 className="pro-hero__title" id="pro-title"><Marked text={PRO_COPY.title} marks={[PUBLIC_MARKS.pricing.head]} /></h1>'));
  const daily = read('src/components/daily/DailyFive.jsx');
  assert.ok(daily.includes('<h1 className="dly__title"><Marked text="Daily Five" marks={[PUBLIC_MARKS.daily.head]} />'), 'the head of /daily');
  assert.equal(daily.match(/<Marked |<Doodle /g).length, 1, 'never inside the game');
  assert.ok(read('src/app/key-cards/[subject]/[chapter]/page.js').includes('<Marked text={keepTogether(freeLine(n, deck.total, deck.subject.name))} marks={[PUBLIC_MARKS.keyCardsChapter.head]} />'));
  const seo = read('src/components/SeoContentPage.jsx');
  assert.ok(seo.includes('const marks = GUIDE_MARKS[page.slug];'));
  assert.ok(seo.includes('{marks?.head ? <Marked text={keepTogether(page.h1)} marks={[marks.head]} /> : keepTogether(page.h1)}'));
  assert.ok(seo.includes('{marks?.close ? <Marked text="Reading about it is not practice." marks={[marks.close]} /> : \'Reading about it is not practice.\'}'));
  const subject = read('src/components/subject/SubjectLandingPage.jsx');
  assert.ok(subject.includes('<Marked text={keepTogether(hub.h1)} marks={[PUBLIC_MARKS.subject.head]} />'));
  assert.ok(subject.includes('<Marked text={`${name} Key cards, free to read`} marks={[PUBLIC_MARKS.subject.keyCards]} />'));
  assert.ok(subject.includes('{FIRST_FULL_FREE ? `Your first ${name} mock is free.` : <Marked text="Reading about it is not practice." marks={[PUBLIC_MARKS.subject.close]} />}'), 'the priced close stays unmarked');
  assert.ok(read('src/app/cuet-cutoff-calculator/page.js').includes('<h2 id="du-sources" className="lp-h2"><Marked text="Built from DU’s own documents" marks={[PUBLIC_MARKS.calculator.sources]} /></h2>'));
  assert.ok(read('src/app/du-cutoffs/[course]/page.js').includes('DU {course.name} cutoffs <Doodle {...PUBLIC_MARKS.duCourse.head[1]}>{PUBLIC_MARKS.duCourse.head[0]}</Doodle></h1>'));
  assert.ok(read('src/app/du-cutoffs/colleges/[college]/page.js').includes('{college.title} cutoffs <Doodle {...PUBLIC_MARKS.duCollege.head[1]}>{PUBLIC_MARKS.duCollege.head[0]}</Doodle></h1>'));
  const shell = read('src/components/auth/AuthShell.jsx');
  assert.ok(shell.includes('{titleMark ? <Marked text={keepTogether(title)} marks={[[keepTogether(titleMark[0]), titleMark[1]]]} /> : keepTogether(title)}'), '"CUET 2027" stays one phrase');
});

const MARKED_FILES = [
  'src/app/pricing/page.js', 'src/app/features/page.js', 'src/app/about/page.js', 'src/app/key-cards/page.js',
  'src/app/key-cards/[subject]/[chapter]/page.js', 'src/components/SeoContentPage.jsx', 'src/components/subject/SubjectLandingPage.jsx',
  'src/app/cuet-cutoff-calculator/page.js', 'src/app/du-cutoffs/[course]/page.js', 'src/app/du-cutoffs/colleges/[college]/page.js',
  'src/components/daily/DailyFive.jsx', 'src/components/auth/AuthShell.jsx', 'src/components/SiteNotFound.jsx',
];

test('one mark per heading: every marked heading holds one Marked or Doodle, with one phrase', () => {
  for (const file of MARKED_FILES) {
    const src = read(file);
    for (const line of src.split('\n').filter((l) => /<Marked |<Doodle /.test(l))) {
      assert.ok((line.match(/<Marked |<Doodle /g) || []).length <= 1, `${file}: ${line.trim()}`);
      const lists = [...line.matchAll(/marks=\{\[(.*?)\]\} \/>/g)].map((m) => m[1]);
      for (const list of lists) {
        assert.ok(!/\]\s*,\s*\[/.test(list) && (list.match(/PUBLIC_MARKS\.|marks\.|titleMark\[0\]/g) || []).length === 1, `${file}: one phrase in [${list}]`);
      }
    }
    assert.doesNotMatch(src, /tone(=|: )['"]pen/, `${file}: no red pen`);
  }
  // The pages left unmarked on purpose: their reasons are in src/lib/publicMarks.mjs.
  for (const file of ['src/app/sunday-mock/page.js', 'src/app/cuet-subject-combination/page.js', 'src/app/du-cutoffs/page.js']) {
    assert.doesNotMatch(read(file), /components\/doodle|publicMarks/, `${file} stays unmarked`);
  }
});

test('the pages of plain facts carry no marks at all', () => {
  assert.deepEqual([...PLAIN_FACT_PAGES].sort(), ['account-deletion', 'contact', 'corrections', 'privacy', 'refunds', 'terms']);
  const walk = (dir) => readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
  for (const page of PLAIN_FACT_PAGES) {
    const files = walk(join(ROOT, 'src', 'app', page)).filter((f) => /\.(js|jsx|mjs)$/.test(f));
    assert.ok(files.length > 0, page);
    for (const f of files) assert.doesNotMatch(readFileSync(f, 'utf8'), /components\/doodle|publicMarks|<Marked |<Doodle /, f);
  }
});
