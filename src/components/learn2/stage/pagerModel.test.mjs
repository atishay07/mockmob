// The study stage's pure rules: the pager (wheel, release, scroller, keys) and the text rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WHEEL, wheelState, wheelStep, rubber, releaseVelocity, releaseTarget, touchLock, canScroll, scrollerThatCanMove, keyAction } from './pagerModel.mjs';
import { readFileSync } from 'node:fs';
import { frontSize, backSize, optionTexts, twoColumns, assertionReason, doneLine, timeLeft, speakable, chapterRef, matchLists, statementList } from './stageText.mjs';

const run = (events) => {
  let s = wheelState();
  const moves = [];
  for (const e of events) { const r = wheelStep(s, e); s = r.state; moves.push(r.move); }
  return moves.filter(Boolean);
};

test('one mouse notch moves one item at once', () => {
  assert.deepEqual(run([{ dy: 100, t: 0 }]), [1]);
  assert.deepEqual(run([{ dy: -120, t: 0 }]), [-1]);
});

test('a trackpad swipe moves one item after 60 px and its inertia tail moves nothing', () => {
  const swipe = Array.from({ length: 30 }, (_, i) => ({ dy: 40 - i, t: i * 16 }));
  assert.deepEqual(run(swipe), [1]);
});

test('three notches 1.3 s apart move three items; ten notches in one burst move one', () => {
  assert.deepEqual(run([{ dy: 100, t: 0 }, { dy: 100, t: 1300 }, { dy: 100, t: 2600 }]), [1, 1, 1]);
  assert.deepEqual(run(Array.from({ length: 10 }, (_, i) => ({ dy: 100, t: i * 60 }))), [1]);
  assert.deepEqual(run([{ dy: 100, t: 0 }, { dy: 100, t: 230 }]), [1, 1]);
});

test('Firefox line deltas count as 40 px a line; sideways and pinch are not the pager\'s', () => {
  assert.deepEqual(run([{ dy: 3, mode: 1, t: 0 }]), [1]);
  assert.equal(wheelStep(wheelState(), { dy: 10, dx: 80, t: 0 }).prevent, false);
  assert.equal(wheelStep(wheelState(), { dy: 100, t: 0, ctrl: true }).move, 0);
});

test('a gesture that starts inside a scroller ends there; a move in progress swallows the wheel', () => {
  let s = wheelState();
  let r = wheelStep(s, { dy: 100, t: 0, inner: true });
  assert.equal(r.prevent, false); s = r.state;
  r = wheelStep(s, { dy: 100, t: 50, inner: false }); // the scroller reached its edge mid-gesture
  assert.equal(r.move, 0); assert.equal(r.prevent, true); s = r.state;
  r = wheelStep(s, { dy: 100, t: 400 }); // a new gesture from the edge
  assert.equal(r.move, 1);
  assert.equal(wheelStep(wheelState(), { dy: 100, t: 0, moving: true }).move, 0);
  assert.ok(WHEEL.quiet === 220 && WHEEL.step === 60);
});

test('release: 18% of the area or 0.35 px/ms, never more than one item, a flick back springs back', () => {
  assert.equal(releaseTarget({ dy: -300, v: 0, height: 844, index: 2, count: 10 }), 3); // a slow third of the screen
  assert.equal(releaseTarget({ dy: -100, v: 0, height: 844, index: 2, count: 10 }), 2);
  assert.equal(releaseTarget({ dy: -40, v: -0.5, height: 844, index: 2, count: 10 }), 3);
  assert.equal(releaseTarget({ dy: 200, v: 0, height: 844, index: 2, count: 10 }), 1);
  assert.equal(releaseTarget({ dy: -800, v: -4, height: 844, index: 2, count: 10 }), 3);
  assert.equal(releaseTarget({ dy: -300, v: 0.6, height: 844, index: 2, count: 10 }), 1);
  assert.equal(releaseTarget({ dy: -300, v: 0, height: 844, index: 9, count: 10 }), 9);
  assert.equal(releaseTarget({ dy: 300, v: 0, height: 844, index: 0, count: 10 }), 0);
});

test('velocity over the last 80 ms; rubber band at the ends; tap and direction lock', () => {
  assert.equal(releaseVelocity([{ t: 0, y: 0 }, { t: 100, y: -10 }, { t: 160, y: -50 }, { t: 180, y: -70 }]), -60 / 80);
  assert.equal(releaseVelocity([{ t: 0, y: 0 }]), 0);
  assert.equal(rubber(100, 0, 5), 35);
  assert.equal(rubber(-100, 4, 5), -35);
  assert.equal(rubber(-100, 2, 5), -100);
  assert.equal(touchLock(3, 4), 'tap');
  assert.equal(touchLock(2, 20), 'vertical');
  assert.equal(touchLock(30, 10), 'side');
});

test('the scroller that can move: the edge rule', () => {
  assert.equal(canScroll({ scrollTop: 0, scrollHeight: 900, clientHeight: 500 }, 1), true);
  assert.equal(canScroll({ scrollTop: 0, scrollHeight: 900, clientHeight: 500 }, -1), false);
  assert.equal(canScroll({ scrollTop: 400, scrollHeight: 900, clientHeight: 500 }, 1), false);
  assert.equal(canScroll({ scrollTop: 0, scrollHeight: 500, clientHeight: 500 }, 1), false);
  const root = { parentElement: null };
  const box = { parentElement: root, scrollTop: 10, scrollHeight: 900, clientHeight: 400, s: 'auto' };
  const leaf = { parentElement: box, scrollTop: 0, scrollHeight: 20, clientHeight: 20, s: 'visible' };
  const styleOf = (el) => ({ overflowY: el.s || 'visible' });
  assert.equal(scrollerThatCanMove(leaf, 1, root, styleOf), box);
  assert.equal(scrollerThatCanMove(leaf, -1, root, styleOf), box);
  box.scrollTop = 500;
  assert.equal(scrollerThatCanMove(leaf, 1, root, styleOf), null);
});

test('the key table', () => {
  for (const k of ['ArrowDown', 'PageDown', 'j']) assert.equal(keyAction(k, {}), 'next');
  for (const k of ['ArrowUp', 'PageUp', 'k']) assert.equal(keyAction(k, {}), 'prev');
  assert.equal(keyAction('Home', {}), 'first');
  assert.equal(keyAction('End', {}), 'last');
  assert.equal(keyAction(' ', { turnable: true }), 'turn');
  assert.equal(keyAction('Enter', {}), 'next');
  assert.equal(keyAction(' ', { onControl: true, turnable: true }), null);
  assert.equal(keyAction('ArrowDown', { mods: true }), null);
  assert.equal(keyAction('ArrowDown', { typing: true }), null);
  assert.equal(keyAction('ArrowDown', { scrollable: (d) => d === 1 }), null);
  assert.equal(keyAction('ArrowUp', { scrollable: (d) => d === 1 }), 'prev');
  assert.deepEqual(keyAction('2', { answerable: true, options: 4 }), { answer: 1 });
  assert.deepEqual(keyAction('C', { answerable: true, options: 4 }), { answer: 2 });
  assert.deepEqual(keyAction('5', { answerable: true, options: 5 }), { answer: 4 });
  assert.equal(keyAction('5', { answerable: true, options: 4 }), null);
  assert.equal(keyAction('a', { answerable: true, options: 4, foreign: true }), null);
  assert.equal(keyAction('a', { answerable: false, options: 4 }), null);
  assert.equal(keyAction('s', { saveable: true }), 'save');
  assert.equal(keyAction('S', { saveable: true, answerable: true, options: 4 }), 'save');
  assert.equal(keyAction('s', { saveable: false }), null);
  assert.equal(keyAction('s', { saveable: true, foreign: true }), null);
  assert.equal(keyAction('s', { saveable: true, typing: true }), null);
  assert.deepEqual(keyAction('f', { answerable: true, options: 6 }), { answer: 5 });
  assert.equal(keyAction('Escape', {}), 'escape');
  assert.equal(keyAction('?', {}), 'help');
});

test('text: front and back sizes, blanks read aloud, options stripped only when every option carries its letter', () => {
  assert.equal(frontSize('What is goodwill?'), 's');
  assert.equal(frontSize('x'.repeat(100)), 'm');
  assert.equal(frontSize('x'.repeat(140)), 'm', 'R3 L1: m up to 140');
  assert.equal(frontSize('x'.repeat(141)), 'l');
  assert.equal(backSize('x'.repeat(100)), 's');
  assert.equal(backSize('x'.repeat(330)), 'xl');
  assert.equal(speakable('The ____ ratio'), 'The blank ratio');
  assert.deepEqual(optionTexts([{ key: 'A', text: 'A. Nil' }, { key: 'B', text: 'B. Rs 100' }]), ['Nil', 'Rs 100']);
  assert.deepEqual(optionTexts([{ key: 'A', text: '(A) Nil' }, { key: 'B', text: '(B) Rs 100' }]), ['Nil', 'Rs 100']);
  assert.deepEqual(optionTexts([{ key: 'A', text: 'A reduction in capital' }, { key: 'B', text: 'Both' }]), ['A reduction in capital', 'Both']);
  assert.equal(twoColumns(['Rs 25,200, Rs 16,800 and Nil', 'Nil']), true);
  assert.equal(twoColumns(['a'.repeat(29), 'b']), false);
});

test('text: Assertion and Reason, the done line, time left, the book line', () => {
  assert.deepEqual(assertionReason('Assertion (A): Goodwill is an asset. Reason (R): It can be sold.'), { assertion: 'Goodwill is an asset.', reason: 'It can be sold.' });
  assert.equal(assertionReason('What is goodwill?'), null);
  assert.equal(doneLine({ reached: 21, of: 21, minutes: 9 }), 'All 21 done in 9 min.');
  assert.equal(doneLine({ reached: 21, of: 21 }), 'All 21 done.');
  assert.equal(doneLine({ reached: 8, of: 21, minutes: 4 }), 'You stopped at 8 of 21.');
  assert.equal(timeLeft(30), 'Under a minute left');
  assert.equal(timeLeft(330), 'About 6 min left');
  assert.equal(timeLeft(0), null);
  assert.equal(chapterRef({ ref: 'Ch 4', partTitle: 'Accountancy Part 1' }), 'Ch 4, Accountancy Part 1');
  assert.equal(chapterRef({}), null);
});

test('text: a List-I / List-II stem is set as two lists; a plain stem is not', () => {
  const m = matchLists('Match each situation in List-I with its treatment in List-II. List-I (A) Paid privately. (B) Through the firm. List-II (I) No entry. (II) Bank A/c Dr. (III) Nil. Choose the correct answer from the options given below:');
  assert.equal(m.lead, 'Match each situation in List-I with its treatment in List-II.');
  assert.deepEqual(m.one.map((x) => x.label), ['A', 'B']);
  assert.deepEqual(m.two.map((x) => [x.label, x.text]), [['I', 'No entry.'], ['II', 'Bank A/c Dr.'], ['III', 'Nil.']]);
  assert.equal(m.tail, 'Choose the correct answer from the options given below:');
  assert.equal(matchLists('What is goodwill?'), null);
});

test('text: a Statement I / II / III stem is set as a list with its lead and its ask; a plain stem is not', () => {
  const m = statementList('Read the following statements. Statement I: Goodwill is an asset. Statement II: It can be sold. Statement III: It is tangible. Choose the correct option.');
  assert.equal(m.lead, 'Read the following statements.');
  assert.deepEqual(m.items.map((x) => [x.label, x.text]), [['I', 'Goodwill is an asset.'], ['II', 'It can be sold.'], ['III', 'It is tangible.']]);
  assert.equal(m.tail, 'Choose the correct option.');
  assert.equal(statementList('What is goodwill?'), null);
  assert.equal(statementList('Statement I: only one statement here.'), null);
  assert.equal(statementList('Which of the following is right? Statement 1: a. Statement 2: b.').items.length, 2);
});

test('text: every fixture question that has Statement lines splits into 2 or more statements, each with words', () => {
  const rows = JSON.parse(readFileSync(new URL('../../../../data/fixtures/learn-preview-questions.json', import.meta.url), 'utf8')).questions;
  const withStatements = rows.filter((q) => /Statement\s+(I|1)\s*[:.–-]/.test(q.body || ''));
  assert.ok(withStatements.length >= 3, 'the fixtures hold statement questions');
  for (const q of withStatements) {
    const m = statementList(q.body);
    assert.ok(m && m.items.length >= 2, `splits: ${q.body.slice(0, 60)}`);
    assert.ok(m.items.every((x) => x.text.length > 3 && !/Statement\s+(I|II|III)\s*:/.test(x.text)), 'no statement text swallows the next label');
    assert.ok(m.lead.length > 0 && !/Statement/.test(m.lead), 'the lead is the lead-in only');
  }
});

// ---------------------------------------------------------------- R4: science notation, the verdict scroll, Options below
import { sciText, sciPlain, hasSci, isChemistry } from './sciText.mjs';
import { verdictScrollTop, optionsBelow } from './pagerModel.mjs';

const readText = (url) => readFileSync(url, 'utf8').replace(/\r\n/g, '\n');

test('R4 sciText: common ions take their charge from the table', () => {
  assert.equal(sciPlain(sciText('SO42− and NH4+ ions')), 'SO₄²⁻ and NH₄⁺ ions');
  assert.equal(sciPlain(sciText('Cu2+, Fe2+, Fe3+, Zn2+, Ag+, Na+, K+, Ca2+, Mg2+, Al3+')), 'Cu²⁺, Fe²⁺, Fe³⁺, Zn²⁺, Ag⁺, Na⁺, K⁺, Ca²⁺, Mg²⁺, Al³⁺');
  assert.equal(sciPlain(sciText('OH−, NO3−, CO32−, PO43−, HCO3−, Cl−, H3O+')), 'OH⁻, NO₃⁻, CO₃²⁻, PO₄³⁻, HCO₃⁻, Cl⁻, H₃O⁺');
  assert.equal(sciPlain(sciText('Cl- and SO42- ions')), 'Cl⁻ and SO₄²⁻ ions', 'a hyphen at a word end reads as the minus sign');
  assert.deepEqual(sciText('SO42−'), [{ kind: 'plain', text: 'SO' }, { kind: 'sub', text: '4' }, { kind: 'sup', text: '2−' }]);
  assert.deepEqual(sciText('NH4+'), [{ kind: 'plain', text: 'NH' }, { kind: 'sub', text: '4' }, { kind: 'sup', text: '+' }]);
});

test('R4 sciText: a digit after an element symbol or ")" in a formula token is a subscript', () => {
  assert.equal(sciPlain(sciText('CH3OH, (CH3)2NH, PbO2, H2SO4, C6H5OH')), 'CH₃OH, (CH₃)₂NH, PbO₂, H₂SO₄, C₆H₅OH');
  assert.equal(sciPlain(sciText('2H2O and CuSO4·5H2O')), '2H₂O and CuSO₄·5H₂O', 'a coefficient stays plain');
  assert.deepEqual(sciText('(CH3)2NH'), [{ kind: 'plain', text: '(CH' }, { kind: 'sub', text: '3' }, { kind: 'plain', text: ')' }, { kind: 'sub', text: '2' }, { kind: 'plain', text: 'NH' }]);
});

test('R4 sciText: [X]0 and t1/2', () => {
  assert.equal(sciPlain(sciText('[A]0 and [R]0')), '[A]₀ and [R]₀');
  assert.equal(sciPlain(sciText('The half-life t1/2 is constant.')), 'The half-life t₁/₂ is constant.');
});

test('R4 sciText: plain numbers, words and reaction names are never touched', () => {
  for (const t of ['Table 2.4', 'Unit 4', 'p. 52', 'step 1', '373 K', 'NCERT, Chemistry Part 1, Ch 2, p. 48', 'SN1 and SN2, E1, E2', 'Vitamin B12', 'Class 12', 'pH 7', 'I- and F-', 'Part I-A']) {
    assert.deepEqual(sciText(t), [{ kind: 'plain', text: t }], t);
    assert.equal(hasSci(sciText(t)), false, t);
  }
  assert.deepEqual(sciText(''), []);
  assert.equal(sciPlain(sciText('O2 and O2−')), 'O₂ and O²⁻');
});

test('R4 sciText is for chemistry only: isChemistry reads the card or the chapter key', () => {
  assert.equal(isChemistry({ subject: 'chemistry' }), true);
  assert.equal(isChemistry(null, 'chemistry.solutions'), true);
  assert.equal(isChemistry(null, 'accountancy.partnership-fundamentals'), false);
  assert.equal(isChemistry({}), false);
  const face = readText(new URL('./CardFace.jsx', import.meta.url));
  assert.match(face, /sci \? <SciNcert card=\{card\} \/> : <NcertText card=\{card\} \/>/, 'the back');
  assert.match(face, /const FrontText = sci \? SciFront : Front;/, 'the front');
  const q = readText(new URL('./Question.jsx', import.meta.url));
  assert.match(q, /sci \? <SciNcert card=\{line\.card\} \/> : <NcertText card=\{line\.card\} \/>/, 'the quote (the line you needed)');
});

test('R4 ui-correctness#7: the verdict scroll brings the line into view but never moves the head line under the top', () => {
  // The box is 70..770; the head at 90, the line at 600..900: the line needs 146 px, the head allows 90 - 70 - 24 < 0: none.
  assert.equal(verdictScrollTop({ box: { top: 70, bottom: 770, scrollTop: 0 }, head: { top: 90 }, target: { top: 600, bottom: 900 } }), null, 'the head is near the top: no scroll at all');
  // The head sits 300 px down: the scroll goes only as far as 200 px of the line (146), short of the head's limit (206).
  assert.equal(verdictScrollTop({ box: { top: 70, bottom: 770, scrollTop: 0 }, head: { top: 300 }, target: { top: 700, bottom: 1100 } }), 146);
  // The head's limit wins over the line: 170 - 70 - 24 = 76.
  assert.equal(verdictScrollTop({ box: { top: 70, bottom: 770, scrollTop: 0 }, head: { top: 170 }, target: { top: 700, bottom: 1100 } }), 76);
  assert.equal(verdictScrollTop({ box: { top: 0, bottom: 800, scrollTop: 0 }, head: { top: 40 }, target: { top: 300, bottom: 420 } }), null, 'already in view: stay');
  assert.equal(verdictScrollTop({ box: { top: 0, bottom: 800, scrollTop: 50 }, head: { top: 500 }, target: { top: 900, bottom: 1000 } }), 266);
  assert.equal(verdictScrollTop({ box: null, target: { top: 0, bottom: 1 } }), null);
});

test('R4 ui-correctness#5: Options below only while option A is really below the fold, inside the stage', () => {
  assert.equal(optionsBelow({ optionTop: 400, edge: 760 }), false, 'all four options in view (f03): no chip');
  assert.equal(optionsBelow({ optionTop: 740, edge: 760 }), true, 'less than 28 px of option A shows');
  assert.equal(optionsBelow({ optionTop: 733, edge: 760 }), true);
  assert.equal(optionsBelow({ optionTop: 732, edge: 760 }), false);
  assert.equal(optionsBelow({ optionTop: Number.NaN, edge: 760 }), false);
  const stage = readText(new URL('./Stage.jsx', import.meta.url));
  assert.match(stage, /st-below--stage/, 'the feed draws the chip inside the stage');
  const feed = readText(new URL('../feed/ChapterFeed.jsx', import.meta.url));
  assert.match(feed, /below=\{below \? <BelowChip show place="stage"/, 'the feed passes the chip to the stage, never the bar or the peek strip');
  assert.match(feed, /viewport: false/, 'a page still sliding in reads against its own foot');
  const css = readText(new URL('./stage.css', import.meta.url));
  assert.match(css, /\.st-below--stage \{ top: auto; bottom: calc\(var\(--st-peek, 0px\) \+ 8px\)/, 'above the peek strip');
});

test('R4 client-code#12: every stage reduced-motion rule is mirrored under html[data-motion=reduced]', () => {
  const css = readText(new URL('./stage.css', import.meta.url));
  const media = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce) {\n  .st-card'));
  const block = media.slice(0, media.indexOf('\n}\n'));
  const selectors = block.split('\n').slice(1).map((l) => l.trim()).filter(Boolean).flatMap((l) => l.split('{')[0].split(',').map((x) => x.trim()));
  assert.ok(selectors.length > 20);
  for (const sel of selectors) assert.ok(css.includes(`html[data-motion='reduced'] ${sel}`), sel);
  const run = readText(new URL('../run/run.css', import.meta.url));
  assert.match(run, /html\[data-motion='reduced'\] \.lr \.lr-face--back \{ transform: none/);
  assert.match(run, /html\[data-motion='reduced'\] \.lr \*, /);
  assert.match(readText(new URL('./Stage.jsx', import.meta.url)), /document\.documentElement\.dataset\.motion === 'reduced'/, 'still() reads the app setting');
});

test('R4 ui-correctness#18 and first-timer#17: the stop sheet goes "Back to it"; one close control, the X with "Close"', () => {
  const sheet = readText(new URL('./Sheet.jsx', import.meta.url));
  assert.match(sheet, /export const BACK_TO_IT = 'Back to it';/);
  assert.doesNotMatch(sheet.split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n'), />Keep going</);
  const stage = readText(new URL('./Stage.jsx', import.meta.url));
  assert.match(stage, /st-iconkey st-iconkey--word" aria-label=\{closeLabel\} onClick=\{onClose\}><X size=\{22\} strokeWidth=\{2\.2\} aria-hidden="true" \/><span aria-hidden="true">Close<\/span>/);
  const run = readText(new URL('../run/run.css', import.meta.url));
  assert.match(run, /\n\.lr-close__word \{ display: inline; \}/, 'the run shows the word at every width');
});

test('science notation, round 4 follow-up: complex-ion charges, NCERT en-dash minus, electron configurations; bonds and ranges stay plain', () => {
  const t = (x) => sciPlain(sciText(x));
  assert.equal(t('[Co(NH3)6]3+ is octahedral'), '[Co(NH₃)₆]³⁺ is octahedral');
  assert.equal(t('[PtCl4]2– is square planar'), '[PtCl₄]²⁻ is square planar');
  assert.equal(t('how NO2– can coordinate'), 'how NO₂⁻ can coordinate');
  assert.equal(t('configuration 3d8.'), 'configuration 3d⁸.');
  assert.equal(t('from d4 to d3'), 'from d⁴ to d³');
  assert.equal(t('1s2 2s2 2p6'), '1s² 2s² 2p⁶');
  assert.equal(t('a Br–Br bond and the C–Cl bond'), 'a Br–Br bond and the C–Cl bond');
  assert.equal(t('pp. 89–117, Table 2.4, step 1, Unit 4, 373 K'), 'pp. 89–117, Table 2.4, step 1, Unit 4, 373 K');
  assert.equal(t('for d4 (Cr2+, Mn3+), d6 (Fe2+, Co3+)'), 'for d⁴ (Cr²⁺, Mn³⁺), d⁶ (Fe²⁺, Co³⁺)');
  assert.equal(t('the NO2– and SCN– ions'), 'the NO₂⁻ and SCN⁻ ions');
  assert.equal(t('(CH3)2NH and (C2H5)2NH'), '(CH₃)₂NH and (C₂H₅)₂NH', 'a formula that starts with a bracket keeps it');
});


// ---------------------------------------------------------------- R5 LK40: nothing traps the wheel

test('R5 LK40: the run item scrollers chain to the stage (a question that fits must not trap the wheel); only the stage body contains', () => {
  const run = readText(new URL('../run/run.css', import.meta.url));
  const lines = run.split('\n');
  const areaRules = lines.filter((l) => /^\s*\.lr-area \{.*max-height/.test(l) && /overflow-y: auto/.test(l));
  assert.ok(areaRules.length >= 1, 'the item area that scrolls from tablet up');
  for (const r of areaRules) {
    assert.match(r, /overscroll-behavior: auto/, 'the item area chains to the stage body');
    assert.doesNotMatch(r, /overscroll-behavior: contain/);
  }
  assert.match(run, /\.lr-face \{[^}]*overscroll-behavior: auto/, 'a card face that cannot scroll lets the wheel through');
  assert.ok(lines.some((l) => l.startsWith('.lr-body {') && /overscroll-behavior: contain/.test(l)), 'the stage body keeps the page behind from moving');
  const stage = readText(new URL('./stage.css', import.meta.url));
  assert.match(stage, /html:has\(\.st\.kc\) \{ overscroll-behavior: none; \}/);
});
