// IA4 (web IA plan section 4 and 2.3): the landing and the public chrome.
// Static checks over the source: the sample keeps the server's scoring contract, no caveat or
// retired product name reaches the page, the landing never links into a signed-in page, and the
// copy rules (no em dash, no exclamation mark) hold.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { CAVEAT_PATTERNS, retiredHits, studentStrings } from '../glossary.mjs';
import { SAMPLE_QUESTIONS } from '../../src/lib/server/sampleImport.js';
import { isSignedInPath, FOOTER_COLUMNS, PUBLIC_DOCK, HEADER_ACTIONS } from '../../src/lib/navigation.js';
import { PUBLIC_SUBJECTS } from '../subject_art.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const LANDING_DIR = 'src/components/landing';
// Not on the landing: the ladder and college tiles wait for the calculator page (IA8), and the wall
// of love is only in a development preview.
const NOT_ON_LANDING = ['CompassLadder.jsx', 'CollegeDestinations.jsx', 'WallOfLove.jsx'];
const LANDING = ['src/app/page.js', ...readdirSync(join(ROOT, LANDING_DIR)).filter((f) => /\.(jsx?|mjs)$/.test(f) && !NOT_ON_LANDING.includes(f)).map((f) => `${LANDING_DIR}/${f}`)];
const CHROME = ['src/components/NavBar.jsx', 'src/components/MarketingFooter.jsx', 'src/components/MobileDock.jsx', 'src/components/LandingActions.jsx', 'src/components/Logo.jsx'];
const ALL = [...LANDING, ...CHROME];

test('the sample keeps the server scoring contract (order, subjects, keys)', () => {
  const src = read(`${LANDING_DIR}/DemoDrill.jsx`);
  const body = src.slice(src.indexOf('export const DRILL'), src.indexOf('];', src.indexOf('export const DRILL')));
  const subjects = [...body.matchAll(/subject: '([^']+)'/g)].map((m) => m[1]);
  const correct = [...body.matchAll(/correct: (\d)/g)].map((m) => 'ABCD'[Number(m[1])]);
  assert.deepEqual(subjects, SAMPLE_QUESTIONS.map((q) => q.subject));
  assert.deepEqual(correct, SAMPLE_QUESTIONS.map((q) => q.correctKey));
  assert.match(src, /writeSampleHandoff\(/, 'the finished sample is handed to the new account');
  assert.match(src, /\/signup\?from=sample/);
});

test('no caveat line on the landing or the public chrome', () => {
  for (const file of ALL) {
    const strings = studentStrings(read(file));
    for (const re of CAVEAT_PATTERNS) {
      const hit = strings.find((s) => re.test(s));
      assert.equal(hit, undefined, `${file}: ${hit}`);
    }
  }
});

test('no retired product name on the landing or the public chrome', () => {
  for (const file of ALL) assert.deepEqual(retiredHits(read(file), file), [], file);
});

test('the landing never links into a signed-in page', () => {
  for (const file of LANDING) {
    const src = read(file);
    const hrefs = [...src.matchAll(/href=["'`]([^"'`$]+)["'`]/g), ...src.matchAll(/(?:href|Href|HREF)\s*[:=]\s*['"`](\/[^'"`$]*)['"`]/g)].map((m) => m[1]);
    for (const href of hrefs) {
      if (!href.startsWith('/')) continue;
      assert.equal(isSignedInPath(href), false, `${file} links to ${href}`);
    }
  }
});

test('the public dock and header follow the plan', () => {
  assert.equal(PUBLIC_DOCK.label, 'Try 5 questions');
  assert.equal(PUBLIC_DOCK.href, '/#try');
  assert.match(read(`${LANDING_DIR}/SampleStage.jsx`), /id="try"/, 'the dock target exists');
  assert.match(read(`${LANDING_DIR}/SampleStage.jsx`), /id="try-practice"/, 'old sample links still land');
  assert.match(read('src/app/page.js'), /id="exam-experience"/, 'old exam preview links still land');
  assert.match(read('src/app/page.js'), /id="how-it-works"/);
  assert.match(read('src/app/page.js'), /id="subjects"/);
  const nav = read('src/components/NavBar.jsx');
  assert.match(nav, /HEADER_ACTIONS/);
  assert.ok(HEADER_ACTIONS.some((a) => a.label === 'Open MockMob'));
});

test('the footer lists all 15 subjects and the non-affiliation line', () => {
  const subjects = FOOTER_COLUMNS.find((c) => c.id === 'subjects');
  assert.equal(subjects.links.length, PUBLIC_SUBJECTS.length);
  assert.match(read('src/components/MarketingFooter.jsx'), /NON_AFFILIATION_LINE/);
});

test('copy rules: no em dash and no exclamation mark in student-facing strings', () => {
  for (const file of ALL) {
    for (const s of studentStrings(read(file))) {
      assert.ok(!s.includes('—'), `${file}: em dash in "${s.slice(0, 80)}"`);
      if (/\s/.test(s.trim()) && /[A-Za-z]{2}/.test(s)) assert.ok(!/[A-Za-z]!(\s|$)/.test(s), `${file}: "!" in "${s.slice(0, 80)}"`);
    }
  }
});

test('nothing on the landing plays by itself', () => {
  const page = read('src/app/page.js');
  for (const gone of ['PipGuide', 'FeatureTour', 'MistakeLab', 'CompassLadder', 'HeroBackdrop', 'Reveal']) {
    assert.ok(!page.includes(gone), `page.js still uses ${gone}`);
  }
  for (const file of LANDING) {
    const src = read(file);
    if (!src.includes('setInterval(')) continue;
    // The only timer is the exam preview's demo clock, which starts after the visitor acts.
    assert.equal(file, `${LANDING_DIR}/ExamComparator.jsx`, `${file} runs a timer`);
    assert.match(src, /if \(!started \|\| !onScreen/);
  }
});
