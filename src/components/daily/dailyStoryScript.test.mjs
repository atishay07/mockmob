// node --test src/components/daily/dailyStoryScript.test.mjs
// The Daily Five's demo on the home page (owner LK365, 21 Nov 2026; dailyStoryScript.mjs, DailyStory.jsx, daily-story.css,
// DailyFiveRow.jsx HomeBlock): the cursor only clicks controls the screen has; the beats keep the frame's pace rules; every
// word and number on the screen is what /daily's own rules would say for the sample; the motion is transform and opacity.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DAILY_SAY, DAILY_STORY, REST_LINE, STORY_FED, STORY_FED_LINES, STORY_FIVE, STORY_MIX, STORY_QUESTION, STORY_SCORE, STORY_SLOTS,
  STORY_STREAK, STORY_WORDS,
} from './dailyStoryScript.mjs';
import { DAILY_FIVE_SIZE, shortDate } from '../../lib/dailyFive.mjs';
import { MINE_COPY, MINE_PLAN, fedCounts, fedLines, mineLabel, mixLine } from '../../lib/dailyFiveMine.mjs';
import { SAY_MAX_CHARS, sayCount, sayPace, scriptHooks, scriptMs } from '../landing/onePlaceModel.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const JSX = read('./DailyStory.jsx');
const ROW = read('./DailyFiveRow.jsx');
const CSS = read('./daily-story.css');

test('every control the script clicks is a real button of the screen, with its hook', () => {
  assert.deepEqual(scriptHooks(DAILY_STORY.steps).sort(), ['daily-next', 'daily-pick-B', 'daily-slot-1']);
  assert.match(JSX, /<button key=\{s\.n\} type="button" className="dst-slot" data-kind=\{s\.kind\} data-demo=\{`daily-slot-\$\{s\.n\}`\}/);
  assert.match(JSX, /<button key=\{option\} type="button" className="dst-opt" [^>]*data-demo=\{`daily-pick-\$\{LETTERS\[i\]\}`\}/);
  assert.match(JSX, /<button type="button" className="dst-next" data-demo="daily-next"/);
  assert.equal(STORY_QUESTION.right, 1, 'the cursor picks B, the right option');
  // Every stressed part and every pointed-at group is one the screen draws.
  for (const step of DAILY_STORY.steps) {
    if (step.focus) {
      const group = step.focus.match(/data-kind-group="([a-z]+)"/)?.[1];
      if (group) assert.ok(['missed', 'weak', 'subject'].includes(group) && JSX.includes('data-kind-group={kind}'), step.focus);
      else assert.ok(JSX.includes(`className="${step.focus.slice(1)}"`), step.focus);
    }
  }
  assert.ok(!/<a[\s>]|<Link/.test(JSX), 'the cursor can never click a link: the screen has none');
});

test('four beats, each one plain sentence, read before the cursor moves, at the frame pace', () => {
  assert.equal(sayCount(DAILY_STORY.steps), 4);
  assert.deepEqual(DAILY_STORY.steps.filter((s) => s.say).map((s) => s.say), [...DAILY_SAY]);
  for (const line of [...DAILY_SAY, REST_LINE]) {
    assert.ok(line.length <= SAY_MAX_CHARS, line);
    assert.match(line, /^[A-Z]/, line);
    assert.match(line, /\.$/, line);
    assert.doesNotMatch(line, /[!—–]|\p{Extended_Pictographic}/u, line);
    assert.equal(line.split(/\.\s/).length, 1, `one sentence: ${line}`);
  }
  for (const beat of sayPace(DAILY_STORY.steps)) {
    assert.ok(beat.holds >= 2200, `${beat.say} holds ${beat.holds}`);
    assert.ok(beat.firstMove >= 500, `${beat.say} moves after ${beat.firstMove}`);
  }
  const ms = scriptMs(DAILY_STORY.steps);
  assert.ok(ms >= 9000 && ms <= 14000, `script ${ms} ms`);
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
  assert.ok(DAILY_SAY[1].includes(shortDate(STORY_FIVE[0].why.since)), 'the beat names the day the card shows');
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
  // It reads plainly as an example.
  assert.equal(STORY_WORDS.example, 'Example');
  assert.match(JSX, /<span className="dst-top__ex">\{STORY_WORDS\.example\}<\/span>/);
});

test('the card plays when it is in the window, once a visit; a real tap takes over; reduced motion shows the end', () => {
  assert.match(ROW, /new IntersectionObserver\(/);
  assert.match(ROW, /if \(armed && m !== 'taken'\)/, 'never replays itself after the reader took over');
  assert.match(ROW, /if \(m === 'playing'\) \{ setMode\('idle'\); setRun\(\(n\) => n \+ 1\);/, 'leaving mid-way resets it');
  assert.match(ROW, /<CursorDemo key=\{run\} steps=\{DAILY_STORY\.steps\} playing=\{mode === 'playing'\} onSay=\{onSay\} onDone=\{onDone\} onTakeover=\{onTakeover\}/);
  assert.match(ROW, /<DailyStory rest=\{reduced\} \/>/);
  assert.match(JSX, /if \(!rest\) return undefined;[\s\S]*setPhase\('day'\)/, 'reduced motion: the day end');
  // The Sunday Mock card is untouched.
  assert.match(ROW, /<article className="dwk-card" data-kind="sunday" data-state=\{sunday\.phase\} aria-labelledby="dwk-sunday">/);
});

test('the screen never changes height, and its motion is transform and opacity only', () => {
  assert.match(CSS, /\.st-daily \.dst-view \{\n\s+grid-area: 1 \/ 1;/, 'the three views share one grid cell');
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
