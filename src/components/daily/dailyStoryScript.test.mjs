// node --test src/components/daily/dailyStoryScript.test.mjs
// The Daily Five's demo on the home page (owner LK365, 21 Nov 2026; dailyStoryScript.mjs, DailyStory.jsx, daily-story.css,
// DailyFiveRow.jsx HomeBlock): the cursor only clicks controls the screen has; the beats keep the frame's pace rules; every
// word and number on the screen is what /daily's own rules would say for the sample; the motion is transform and opacity.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DAILY_SAY, DAILY_STORY, QUIET_MS, STORY_FED, STORY_FED_LINES, STORY_FIVE, STORY_MIX, STORY_QUESTION, STORY_SCORE, STORY_SLOTS,
  STORY_STREAK, STORY_WORDS,
} from './dailyStoryScript.mjs';
import { DAILY_FIVE_SIZE } from '../../lib/dailyFive.mjs';
import { MINE_COPY, MINE_PLAN, fedCounts, fedLines, mineLabel, mixLine } from '../../lib/dailyFiveMine.mjs';
import { CURSOR_ENTER_MS, SAY_MAX_CHARS, sayCount, sayPace, scriptHooks, scriptMs } from '../landing/onePlaceModel.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const JSX = read('./DailyStory.jsx');
const ROW = read('./DailyFiveRow.jsx');
const CSS = read('./daily-story.css');

test('every control the script clicks is a real button of the screen, with its hook', () => {
  assert.deepEqual(scriptHooks(DAILY_STORY.steps).sort(), ['daily-next', 'daily-pick-B', 'daily-slot-1']);
  assert.match(JSX, /<button type="button" className="dst-slot" data-kind=\{s\.kind\} data-demo=\{`daily-slot-\$\{s\.n\}`\}/);
  assert.match(JSX, /<button key=\{option\} type="button" className="dst-opt" [^>]*data-demo=\{`daily-pick-\$\{LETTERS\[i\]\}`\}/);
  assert.match(JSX, /<button type="button" className="dst-next" data-demo="daily-next"/);
  assert.equal(STORY_QUESTION.right, 1, 'the cursor picks B, the right option');
  // Every stressed part is one the screen draws, and one part only: a single row or a single block, never a group of rows
  // (owner LK366, 22 Nov 2026: the boxes around groups of rows read as "boxes here and there").
  for (const step of DAILY_STORY.steps) {
    if (step.focus) {
      if (step.focus.startsWith('[data-demo=')) assert.equal(scriptHooks([{ target: step.focus }]).length, 1, step.focus);
      else assert.ok(JSX.includes(`className="${step.focus.slice(1)}" data-part=""`), step.focus);
    }
  }
  assert.match(JSX, /data-demo=\{`daily-slot-\$\{s\.n\}`\} data-part=""/, 'each row is its own part');
  assert.doesNotMatch(JSX, /data-kind-group/, 'no group of rows to stress');
  assert.ok(!/<a[\s>]|<Link/.test(JSX), 'the cursor can never click a link: the screen has none');
});

test('four beats, each one plain sentence, read before the cursor moves, at the reader pace (owner LK366)', () => {
  assert.equal(sayCount(DAILY_STORY.steps), 4);
  assert.deepEqual(DAILY_STORY.steps.filter((s) => s.say).map((s) => s.say), [...DAILY_SAY]);
  // The reader's order: what it is, the first, what a right answer does, the streak.
  assert.deepEqual([...DAILY_SAY], [
    'Each day, five questions are picked for you.',
    'The first is one you got wrong before.',
    'Get it right and that mistake is fixed.',
    'Finish all five and your streak grows by a day.',
  ]);
  for (const line of DAILY_SAY) {
    assert.ok(line.length <= SAY_MAX_CHARS, line);
    assert.match(line, /^[A-Z]/, line);
    assert.match(line, /\.$/, line);
    assert.doesNotMatch(line, /[!—–]|\p{Extended_Pictographic}/u, line);
    assert.equal(line.split(/\.\s/).length, 1, `one sentence: ${line}`);
  }
  for (const beat of sayPace(DAILY_STORY.steps)) {
    assert.ok(beat.holds >= 3200, `${beat.say} holds ${beat.holds}`);
    assert.ok(beat.firstMove >= 700, `${beat.say} moves after ${beat.firstMove}`);
  }
  const ms = scriptMs(DAILY_STORY.steps);
  assert.ok(ms >= 15000 && ms <= 18000, `script ${ms} ms`);
  // Nothing changes in the last 1.2 s of a beat: beats 2 to 4 end on an exact wait of QUIET_MS after the screen's own change
  // has landed (a view or an answer at most 600 ms after the click, the day's end 1.8 s: the waits before cover them).
  assert.ok(QUIET_MS >= 1200);
  const steps = DAILY_STORY.steps;
  const sayAt = steps.map((s, i) => (typeof s.say === 'string' ? i : -1)).filter((i) => i >= 0);
  sayAt.forEach((start, b) => {
    const beat = steps.slice(start, sayAt[b + 1] ?? steps.length);
    const last = beat.at(-1);
    if (b === 0) { assert.ok(last.wait >= 1400 + 1200 && !beat.some((s) => s.target), 'beat 1: the rows are up by 1.4 s, then still'); return; }
    assert.equal(last.wait, QUIET_MS, `beat ${b + 1} ends on the still wait`);
    assert.equal(last.exact, true, `beat ${b + 1}: the still wait is never shortened`);
    const click = beat.findIndex((s) => s.click);
    // A wait that is not exact may be halved on a slow phone: count half.
    const afterClick = beat.slice(click + 1, -1).reduce((t, s) => t + (s.wait || 0) / 2, 0) + beat[click].dwell;
    assert.ok(afterClick >= (b === 3 ? 900 : 350), `beat ${b + 1}: room for the change before the still wait (${afterClick} ms)`);
  });
  // Before the run the card already shows the first line, so beat 1 is read for longer than its own wait.
  assert.ok(CURSOR_ENTER_MS + steps[0].wait >= 3200);
});

test('the sample five obeys the real rules, and every word on it is the page own', () => {
  assert.equal(STORY_FIVE.length, DAILY_FIVE_SIZE);
  assert.deepEqual(STORY_MIX, { ...MINE_PLAN }, 'the plan mix: 2 missed, 2 weak, 1 new');
  assert.deepEqual(STORY_FIVE.map((p) => p.why.kind), ['missed', 'missed', 'weak', 'weak', 'subject'], 'kinds in place order');
  assert.equal(new Set(STORY_FIVE.filter((p) => p.why.kind === 'missed').map((p) => p.why.chapter)).size, 2, 'missed: one a chapter');
  assert.equal(STORY_WORDS.mix, mixLine(STORY_MIX));
  assert.equal(STORY_WORDS.mix, '2 you missed, 2 from your weak chapters, 1 new');
  assert.equal(STORY_WORDS.head, MINE_COPY.head);
  assert.equal(STORY_WORDS.didHead, MINE_COPY.doneHead);
  STORY_SLOTS.forEach((slot, i) => assert.equal(slot.label, mineLabel(STORY_FIVE[i].why)));
  assert.equal(STORY_SLOTS[0].label, 'You missed this on 14 Nov');
  assert.equal(STORY_FIVE[0].why.kind, 'missed', 'the beat says the first is one you got wrong: place 1 is a missed question');
  assert.equal(STORY_WORDS.fixedMark, 'Fixed');
  assert.match(JSX, /<span className="dst-q__fixed" aria-hidden="true">\{STORY_WORDS\.fixedMark\}<\/span>/);
  // The day's end: counted from the marks and the checks' fed values, never typed.
  assert.equal(STORY_SCORE, STORY_FIVE.filter((p) => p.mark).length);
  assert.equal(STORY_WORDS.score, `${STORY_SCORE}/${DAILY_FIVE_SIZE} today`);
  assert.deepEqual([...STORY_FED_LINES], fedLines(fedCounts(STORY_FED)));
  assert.deepEqual([...STORY_FED_LINES], ['1 mistake fixed', '1 sent back to your mistakes']);
  assert.equal(STORY_FED[0], 'fixed', 'place 1 was missed before and is answered right');
  assert.equal(STORY_FIVE[0].mark, true);
  assert.equal(STORY_FED[1], 'mistakes', 'place 2 missed again goes back to the mistakes');
  assert.equal(STORY_FIVE[1].mark, false);
  // A whole five is a streak day: the run steps up by exactly one; seven squares filled means at least seven days.
  assert.equal(STORY_STREAK.after, STORY_STREAK.before + 1);
  assert.equal(STORY_STREAK.days.length, 7);
  assert.ok(STORY_STREAK.after >= STORY_STREAK.days.length);
  // The screen counts its own day's end from the click (a wrong pick by hand changes the lines honestly).
  assert.match(JSX, /const did = fedLines\(fedCounts\(fed\)\);/);
  assert.match(JSX, /i === 0 \? \(right \? 'fixed' : 'mistakes'\) : f/);
  // It reads plainly as an example. Owner LK428 (23 Nov 2026): what a visitor can do now comes first (today's state, the key,
  // the small print); the demo sits under it, set apart and named: the mark and one line right above the screen.
  assert.equal(STORY_WORDS.example, 'Example');
  // 26 Nov 2026 (the council's verdict, tmp/council/2026-11-26-landing): the home card is one calendar card with no
  // openers, so the example and its demo are no longer drawn there (DailyStory and its script stay, tested above and below).
  // The Daily Five's row is the name, its one line, its state, then the key.
  assert.doesNotMatch(ROW, /<DailyDemo|DAILY_EG|STORY_WORDS|dwk-eg/, 'no example on the home card');
  const head = ROW.indexOf('<h3 className="dwk-name" id="dwk-daily">Daily Five</h3>');
  const line = ROW.indexOf('<p className="dcal__line">{CAL_COPY.daily}</p>');
  const key = ROW.indexOf('<Link href={daily.href} prefetch={false} className="dwk-key"');
  assert.ok(head > 0 && line > head && key > line, 'the head, then the line, then the key');
  assert.doesNotMatch(JSX, /dst-top|STORY_WORDS\.head|STORY_WORDS\.mix/, 'no second title or mix line on the screen');
});

// 26 Nov 2026 (the council's verdict, tmp/council/2026-11-26-landing): the demo that played by itself left the home card
// (one calendar card, "nothing here moves"). The screen keeps its own reduced-motion end; the home card has no player at all.
test('the home card plays nothing by itself: no demo, no cursor, no observer; the screen keeps its reduced-motion end', () => {
  assert.doesNotMatch(ROW, /new IntersectionObserver\(|<CursorDemo|<DailyStory|DAILY_STORY|DAILY_SAY|Watch again/, 'no demo on the home card');
  assert.doesNotMatch(ROW, /REST_LINE/);
  assert.match(JSX, /if \(!rest\) return undefined;[\s\S]*setPhase\('day'\)/, 'reduced motion: the day end');
  // One surface: each row's facts sit in one state line above its key (no TodayLine, no edition sentence).
  assert.match(ROW, /<p className="dwk-state">\s*<StateMark mark=\{daily\.state === 'played' \? 'done' : today \? 'open' : 'none'\} \/>/);
  assert.doesNotMatch(ROW, /<TodayLine|editionName\(/);
  // The Sunday Mock is the card's second row, with the same heading id.
  assert.match(ROW, /<section className="dcal__row" data-kind="sunday" data-state=\{sunday\.phase\} aria-labelledby="dwk-sunday">/);
  assert.match(ROW, /<h3 className="dwk-name" id="dwk-sunday">Sunday Mock<\/h3>/);
});

test('the screen never changes height, is drawn flat, stresses without boxes, and its motion is transform and opacity only', () => {
  assert.match(CSS, /\.st-daily \.dst-view \{\n\s+grid-area: 1 \/ 1;/, 'the three views share one grid cell');
  assert.match(CSS, /\.st-daily \{\n\s+--dst-h: \d+px;\n\s+container-type: inline-size; display: grid; min-width: 0; height: var\(--dst-h\);/, 'one fixed height');
  const screen = CSS.match(/\.st-daily \{\n([^}]*)\}/)[1];
  assert.doesNotMatch(screen, /border|background/, 'no card in the card');
  // The rest falls to half over 200 ms; nothing draws an outline or a ring around a stressed part.
  assert.match(CSS, /\.cd-stage\[data-demo-focusing\] \.st-daily \[data-part\]:not\(\[data-demo-focus\]\) \{ opacity: 0\.5; \}/);
  assert.match(CSS, /\.st-daily \[data-part\] \{ transition: opacity 200ms ease-out; \}/);
  assert.doesNotMatch(CSS, /data-demo-focus\][^{]*\{[^}]*(outline|box-shadow)/);
  // The rows come up one by one, 220 ms apart.
  assert.match(CSS, /animation-delay: calc\(200ms \+ var\(--i, 0\) \* 220ms\)/);
  for (const m of CSS.matchAll(/transition:\s*([^;]+);/g)) {
    for (const part of m[1].split(/,(?![^(]*\))/)) {
      const prop = part.trim().split(/\s+/)[0];
      assert.ok(['opacity', 'transform', 'visibility', 'none'].includes(prop), `transition of ${prop}`);
    }
  }
  for (const m of CSS.matchAll(/@keyframes [a-z-]+ \{(.*)\}/g)) {
    const props = [...m[1].matchAll(/([a-z-]+):/g)].map((p) => p[1]);
    for (const p of props) assert.ok(['opacity', 'transform'].includes(p), `${m[0]}: ${p}`);
  }
  assert.doesNotMatch(CSS, /infinite/);
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(CSS, /html\[data-motion='reduced'\]/);
  // Text on the screen is never under 14 px (0.875rem).
  for (const m of CSS.matchAll(/font: \d+ ([\d.]+)rem/g)) assert.ok(Number(m[1]) >= 0.875, m[0]);
});
