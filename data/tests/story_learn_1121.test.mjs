// The Learn row's story (owner LK365, 21 Nov 2026): src/components/landing/stories/learnStory.mjs + LearnStory.jsx.
// Holds the story contract (tmp/1121-stories/COMMON.md): every hook the script aims at exists, the say lines and the pace
// obey the rules, and every word and number on the screen equals the product file it comes from.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEARN_CARD, LEARN_FREE, LEARN_LESSON, LEARN_LESSONS, LEARN_SCHEDULE, LEARN_STORY, LEARN_STRIP, LEARN_SUBJECT, lessonCount } from '../../src/components/landing/stories/learnStory.mjs';
import { scriptHooks, scriptMs, CURSOR_ENTER_MS, CURSOR_PRESS_MS, ROW_MAX_MS, ROW_MIN_MS } from '../../src/components/landing/onePlaceModel.mjs';
import { buildTour } from '../../src/components/landing/homeCopy.mjs';
import { scheduleReview } from '../study_scheduler.mjs';
import { whenDue, BLOCK_LABEL, itemLabel } from '../../src/components/study/studyCopy.js';

const root = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const SOURCE = read('src/components/landing/stories/LearnStory.jsx');
const CSS = read('src/components/landing/stories/learn-story.css');
const PILOT = JSON.parse(read('data/study/pilot.json'));
const RELEASE = JSON.parse(read('data/study/release.json'));
const { steps } = LEARN_STORY;
const says = steps.filter((s) => typeof s.say === 'string');
const MIN = 60_000;
const DAY = 86_400_000;

test('every data-demo hook the script aims at is a control in the component', () => {
  const hooks = scriptHooks(steps);
  assert.deepEqual(hooks.sort(), ['learn-back', 'learn-check', 'learn-lock', 'learn-next', 'learn-open', 'learn-option'].sort());
  // The last step only rests the cursor on Back to lessons' corner, off the strip's marks (critic round, 21 Nov evening).
  assert.ok(steps.some((s) => s.target === '[data-demo="learn-back"]' && !s.click), 'Back to lessons is rested on, never pressed');
  for (const hook of hooks) assert.ok(SOURCE.includes(`data-demo="${hook}"`), hook);
  // Hooks sit on buttons, never on links.
  assert.ok(!/<a\s/.test(SOURCE) && !/<Link/.test(SOURCE));
  for (const hook of hooks) assert.match(SOURCE, new RegExp(`<button[^>]*data-demo="${hook}"`), hook);
  // The option the demo misses is addressed by its index.
  assert.ok(steps.some((s) => s.target === `[data-demo="learn-option"][data-i="${LEARN_CARD.miss}"]`));
});

test('every focus names a part the component draws', () => {
  for (const s of steps.filter((x) => typeof x.focus === 'string')) {
    const cls = s.focus.match(/^\.([a-z_-]+)$/)?.[1];
    if (cls) assert.ok(SOURCE.includes(cls) && CSS.includes(`.${cls}`), s.focus);
    else assert.ok(scriptHooks([{ target: s.focus }]).length === 1, s.focus);
  }
});

test('the say lines: 3 to 5 plain sentences of at most 58 characters', () => {
  assert.ok(says.length >= 3 && says.length <= 5, String(says.length));
  for (const { say } of says) {
    assert.ok(say.length <= 58, say);
    assert.match(say, /^[A-Z][^A-Z]*\.$/, say); // sentence case, one sentence, a full stop
    assert.ok(!/[—–!]/.test(say), say);
    assert.ok(!/\p{Extended_Pictographic}/u.test(say), say);
  }
  assert.deepEqual(says.map((s) => s.say), [
    'Open a short lesson on the chapter.',
    'Read the worked example.',
    'Then a quick card checks you remember it.',
    'Miss one and that card comes back sooner.',
  ]);
});

test('the pace: each line stays 2.2 s, the cursor waits 500 ms after it, the script runs 11 to 16 s', () => {
  let t = CURSOR_ENTER_MS;
  const starts = [];
  for (const s of steps) {
    if (typeof s.say === 'string') {
      starts.push(t);
      assert.ok(s.wait >= 500, `"${s.say}" is a wait of at least 500 ms before the cursor moves`);
    }
    t += s.wait ? s.wait : (s.move ?? 0) + (s.click ? CURSOR_PRESS_MS : 0) + (s.dwell ?? 0);
  }
  starts.push(t);
  for (let i = 1; i < starts.length; i += 1) assert.ok(starts[i] - starts[i - 1] >= 2200, `beat ${i}: ${starts[i] - starts[i - 1]} ms`);
  const ms = scriptMs(steps);
  assert.ok(ms >= ROW_MIN_MS && ms <= ROW_MAX_MS, String(ms));
});

test('the title is the tour slide’s, and the end line is its points', () => {
  const slide = buildTour({ studyLive: true, studyLessons: 21, studySubjects: 4, offer: null }).find((s) => s.id === 'learn');
  assert.equal(LEARN_STORY.title, slide.title);
  assert.equal(LEARN_STORY.id, 'learn');
  assert.equal(lessonCount(21, 4), slide.points[0]);
  assert.equal(LEARN_FREE, slide.points[1]);
  assert.equal(lessonCount(0, 0), '');
});

test('the lessons are the study content’s own: titles, chapters, minutes and cards', () => {
  const units = PILOT.units.filter((u) => u.subject === 'accountancy').sort((a, b) => a.order - b.order);
  assert.equal(LEARN_SUBJECT, PILOT.syllabus.find((s) => s.subject === 'accountancy').title);
  assert.deepEqual(LEARN_LESSONS.map((l) => l.id), units.map((u) => u.id));
  for (const l of LEARN_LESSONS) {
    const u = units.find((x) => x.id === l.id);
    assert.equal(l.title, u.title);
    assert.equal(l.chapter, u.chapter);
    assert.equal(l.minutes, u.estimatedMinutes);
    assert.equal(l.cards, PILOT.cards.filter((c) => c.unitId === u.id).length);
    assert.ok(Object.keys(RELEASE.units).some((k) => k.split('@')[0] === l.id), `${l.id} is published`);
  }
});

test('the worked example is the lesson’s block word for word, and its key line is in it', () => {
  const unit = PILOT.units.find((u) => u.id === LEARN_LESSON.id);
  assert.equal(LEARN_LESSON.steps, unit.blocks.length);
  const block = unit.blocks[LEARN_LESSON.step - 1];
  assert.equal(block.kind, 'worked_example');
  assert.equal(LEARN_LESSON.label, BLOCK_LABEL.worked_example);
  assert.equal(LEARN_LESSON.title, block.title);
  assert.equal(`${LEARN_LESSON.lead} ${LEARN_LESSON.key} ${LEARN_LESSON.tail}`, block.body);
  assert.deepEqual([LEARN_LESSON.head, ...LEARN_LESSON.rows], block.rows);
  assert.match(LEARN_LESSON.rows[LEARN_LESSON.keyRow].at(-1), /^Gain/);
});

test('the recall card is the lesson’s first card, its choice variant', () => {
  const card = PILOT.cards.find((c) => c.id === LEARN_CARD.id);
  assert.equal(card.unitId, LEARN_LESSON.id);
  assert.equal(PILOT.cards.filter((c) => c.unitId === LEARN_LESSON.id)[0].id, LEARN_CARD.id);
  assert.equal(LEARN_CARD.title, card.title);
  const v = card.variants.find((x) => x.type === 'choice');
  assert.equal(LEARN_CARD.label, itemLabel(v));
  assert.equal(LEARN_CARD.prompt, v.prompt);
  assert.deepEqual(LEARN_CARD.options, v.options);
  assert.equal(LEARN_CARD.right, v.answer);
  assert.deepEqual(LEARN_CARD.notes, v.optionNotes);
  assert.equal(LEARN_CARD.explanation, v.explanation);
  assert.notEqual(LEARN_CARD.miss, LEARN_CARD.right);
  assert.ok(PILOT.cards.some((c) => c.unitId === LEARN_LESSON.id && c.title === LEARN_CARD.other));
});

test('when cards come back: the study scheduler’s own intervals', () => {
  const t0 = Date.parse('2026-11-21T10:00:00+05:30');
  const after = (r) => Date.parse(r.schedule.due);
  // A miss (rating 1, data/study_engine.js) on a new card, on a card in its learning steps, and on a card in review.
  const fresh = scheduleReview(null, 1, t0);
  const good1 = scheduleReview(null, 3, t0);
  const learnMiss = scheduleReview(good1.schedule, 1, after(good1));
  const good2 = scheduleReview(good1.schedule, 3, after(good1));
  const reviewMiss = scheduleReview(good2.schedule, 1, after(good2));
  for (const [r, at] of [[fresh, t0], [learnMiss, after(good1)], [reviewMiss, after(good2)]]) {
    const gap = after(r) - at;
    assert.ok(gap <= LEARN_SCHEDULE.missedMinutesMax * MIN, String(gap));
    assert.equal(whenDue(r.schedule.due, at), LEARN_SCHEDULE.missedWords);
  }
  // A card answered right from memory (rating 3): 10 minutes, then 2 days, then 11.
  assert.equal(after(good1) - t0, 10 * MIN);
  const good3 = scheduleReview(good2.schedule, 3, after(good2));
  assert.equal(Math.round((after(good2) - after(good1)) / DAY), LEARN_SCHEDULE.knownDays[0]);
  assert.equal(Math.round((after(good3) - after(good2)) / DAY), LEARN_SCHEDULE.knownDays[1]);
  assert.deepEqual(LEARN_STRIP.ticks, ['Today', 'In 2 days', 'In 11 days']);
  assert.equal(LEARN_STRIP.missed, 'Missed: back in under an hour');
  assert.equal(LEARN_STRIP.known, 'Got it: back in 2 days, then 11');
});

test('the screen: fixed heights, its own selectors, reduced motion', () => {
  for (const rule of CSS.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]+(?=\{)/g)) {
    const sel = rule.trim();
    if (!sel || sel.startsWith('@') || /^(from|to|\d+%)/.test(sel)) continue;
    for (const part of sel.split(/,(?![^(]*\))/)) assert.match(part.trim(), /(^|\s)(html\[[^\]]+\]\s+)?(\.cd-stage[^ ]*\s+)?\.st-learn|^\.st-learn|:is\(\.st-learn/, part.trim());
  }
  assert.match(CSS, /\.st-learn__screen \{[^}]*height: 500px/);
  assert.match(CSS, /@container \(min-width: 640px\)[\s\S]*height: 548px/);
  assert.match(CSS, /prefers-reduced-motion: reduce/);
  assert.match(CSS, /html\[data-motion='reduced'\]/);
  assert.match(CSS, /html\[data-theme='dark'\] \.st-learn/);
  assert.match(SOURCE, /^'use client';/);
  assert.match(SOURCE, /className="st st-learn" data-phase=\{phase\}/);
  assert.match(SOURCE, /useState\('list'\)/);
  // The highlighter's wait while the cursor plays: the open click's dwell, then 400 ms into the worked-example beat.
  const open = steps.find((s) => s.target === '[data-demo="learn-open"]');
  const delay = Number(CSS.match(/data-demo-live\] \.st-learn\[data-phase='lesson'\] \.st-learn__key::before \{ animation-delay: (\d+)ms/)[1]);
  assert.equal(delay, open.dwell + 400);
});
