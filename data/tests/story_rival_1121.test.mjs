// The Benchmarks row story (owner LK365, 21 Nov 2026): src/components/landing/stories/rivalStory.mjs + RivalStory.jsx.
// The story contract (tmp/1121-stories/COMMON.md): every hook the script aims at exists, the say lines and their pace, the
// script's length, and every figure the screens print equals the rule or constant it comes from.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scriptMs, scriptHooks, CURSOR_ENTER_MS, CURSOR_PRESS_MS, ROW_MAX_MS, ROW_MIN_MS } from '../../src/components/landing/onePlaceModel.mjs';
import {
  RIVAL_STORY, LEVELS, STORY_LEVEL, DEFAULT_LEVEL, QUESTIONS, YOU_RIGHT, YOU_SECONDS, RUN_MS, MOCK, MOCK_POINTS, MOCK_MARKS,
  STANDING, STANDING_AFTER, FREE_LINE, FREE_DAILY_RUNS, runFor, timeLimitMinutes, landings,
} from '../../src/components/landing/stories/rivalStory.mjs';
import { RIVAL_PROFILES } from '../../src/services/ai-rival/rivalProfiles.js';
import { buildTour } from '../../src/components/landing/homeCopy.mjs';
import { standingFor } from '../../src/lib/server/standing.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const SRC = read('src/components/landing/stories/RivalStory.jsx');
const CSS = read('src/components/landing/stories/rival-story.css');
const steps = RIVAL_STORY.steps;

test('the story is the rival slide: its id and title', () => {
  const slide = buildTour().find((s) => s.id === 'rival');
  assert.equal(RIVAL_STORY.id, 'rival');
  assert.equal(RIVAL_STORY.title, slide.title);
});

test('every data-demo hook the script aims at is a button in the component', () => {
  const hooks = scriptHooks(steps);
  assert.deepEqual(hooks.sort(), [`rival-level-${STORY_LEVEL}`, 'rival-standing', 'rival-start', 'rival-submit'].sort());
  for (const h of hooks) {
    const literal = SRC.includes(`data-demo="${h}"`);
    const level = h.startsWith('rival-level-') && SRC.includes('data-demo={`rival-level-${l.id}`}') && LEVELS.some((l) => `rival-level-${l.id}` === h);
    assert.ok(literal || level, `hook ${h} missing from RivalStory.jsx`);
  }
  // Every clickable target is a <button type="button">, never a link.
  assert.ok(!/<a\b/.test(SRC), 'no <a> in the story');
  assert.equal((SRC.match(/<button/g) || []).length, (SRC.match(/<button[^<]{0,60}?type="button"/g) || []).length);
});

test('every focus selector names a class the component draws', () => {
  for (const s of steps.filter((x) => typeof x.focus === 'string')) {
    const cls = s.focus.match(/^\.([a-z-_]+)$/)?.[1];
    if (cls) assert.ok(SRC.includes(cls), `focus ${s.focus} not in the component`);
    else assert.match(s.focus, /^\[data-demo="rival-[a-z-]+"\]$/);
  }
});

test('the say lines: 3 to 5, one plain sentence each, at most 58 characters', () => {
  const says = steps.filter((s) => typeof s.say === 'string').map((s) => s.say);
  assert.ok(says.length >= 3 && says.length <= 5, `${says.length} beats`);
  for (const line of says) {
    assert.ok(line.length <= 58, `${line} is ${line.length}`);
    assert.match(line, /^[A-Z][^.!?]*\.$/, `one sentence in sentence case: ${line}`);
    assert.ok(!/[—–!]/.test(line), `no dash or exclamation: ${line}`);
    assert.ok(!/\p{Extended_Pictographic}/u.test(line), `no emoji: ${line}`);
  }
});

test('the pace: each line stays 2.2 s, the cursor waits 500 ms after it, the script runs 11 to 16 s', () => {
  const ms = (s) => (s.wait ?? 0) + (s.move ?? 0) + (s.click ? CURSOR_PRESS_MS : 0) + (s.dwell ?? 0);
  const at = []; let t = CURSOR_ENTER_MS;
  for (const s of steps) { at.push(t); t += ms(s); }
  const beats = steps.map((s, i) => (typeof s.say === 'string' ? i : -1)).filter((i) => i >= 0);
  beats.forEach((i, n) => {
    const end = n + 1 < beats.length ? at[beats[n + 1]] : t;
    assert.ok(end - at[i] >= 2200, `beat ${n} stays ${end - at[i]} ms`);
    // The first move after the line: the line's own step waits first (a wait step, or no move on it).
    const first = steps.slice(i).find((s) => s.target);
    const before = steps.slice(i, steps.indexOf(first)).reduce((sum, s) => sum + ms(s), 0);
    assert.ok(before >= 500, `beat ${n}: the cursor moves after ${before} ms`);
  });
  const total = scriptMs(steps);
  assert.ok(total >= ROW_MIN_MS && total <= ROW_MAX_MS, `script ${total} ms`);
  // The run's wait covers the run: Submit is awake before the cursor reaches it.
  const runWait = steps.find((s) => s.focus === '.st-rival__race').wait;
  assert.ok(runWait >= RUN_MS);
});

test('the levels are the real benchmark profiles', () => {
  const map = { du: 'SRCC_DREAM', college: 'HANSRAJ_LEVEL', daily: 'NORTH_CAMPUS_RIVAL' };
  assert.deepEqual(LEVELS.map((l) => l.id), ['du', 'college', 'daily']);
  for (const l of LEVELS) {
    const p = RIVAL_PROFILES[map[l.id]];
    assert.equal(l.name, p.name);
    assert.equal(l.accuracy, Math.round(p.targetAccuracy * 100));
    assert.equal(l.perQuestion, p.avgTimePerQuestion);
    assert.equal(l.multiplier, p.difficultyMultiplier);
    assert.equal(l.access, p.creditCost > 0 ? `${p.creditCost} credits` : 'Free today');
  }
  assert.equal(DEFAULT_LEVEL, 'daily');
  // The time limit is createAIRivalBattle.js's own formula.
  const create = read('src/services/ai-rival/createAIRivalBattle.js');
  assert.ok(create.includes('Math.max(5, Math.round((count * profile.avgTimePerQuestion) / 60) + 2)'));
  assert.deepEqual(LEVELS.map((l) => [l.id, l.minutes]), [['du', 10], ['college', 10], ['daily', 11]]);
  assert.equal(timeLimitMinutes(QUESTIONS, 48), 10);
  // The lobby's default count.
  assert.ok(read('src/components/ai/AIRivalArena.jsx').includes('useState(10)'));
  assert.equal(QUESTIONS, 10);
});

test('the sample run obeys the scoring rules (scoreRivalBattle.js)', () => {
  const score = read('src/services/ai-rival/scoreRivalBattle.js');
  assert.ok(score.includes('Math.round(correct * 10 * (profile?.difficultyMultiplier || 1))'));
  assert.ok(score.includes('Math.round((correct / answered) * 100)'));
  const run = runFor(STORY_LEVEL);
  assert.equal(YOU_RIGHT.length, QUESTIONS);
  assert.equal(YOU_SECONDS.length, QUESTIONS);
  assert.deepEqual(run.you, { right: 8, answered: 10, accuracy: 80, seconds: 540, pace: 54, score: Math.round(8 * 10 * 1.22) });
  assert.deepEqual(run.them, { right: 9, accuracy: 90, seconds: 480, pace: 48, score: Math.round(9 * 10 * 1.22) });
  assert.equal(run.you.score, 98);
  assert.equal(run.them.score, 110);
  assert.equal(run.result, 'loss');
  assert.equal(run.title, 'The benchmark found a gap.');
  assert.equal(run.rank, 'Close miss'); // titleFor: a loss at 60% or more
  assert.equal(run.gap, 'One more right answer ties it at 110. Then pace decides: 54 s a question against 48 s.');
  // The run stays inside its time limit, and the clock ends at the time left.
  assert.ok(run.you.seconds <= run.limit && run.them.seconds <= run.limit);
  assert.equal(run.ticks[0], '10:00');
  assert.equal(run.ticks.at(-1), '1:00');
  // The run's length on screen is the last of your answers.
  assert.equal(RUN_MS, landings(YOU_SECONDS).at(-1) + 200);
  // At the daily level the same run clears it: equal scores, and the faster time wins.
  const daily = runFor('daily');
  assert.equal(daily.you.score, daily.them.score);
  assert.equal(daily.result, 'win');
});

test('the standing: the ranks fixture student, then one mock of real points, one place up', () => {
  const recovery = read('data/recovery.js');
  assert.ok(recovery.includes('const rawScore = correct * 5 - wrong;'));
  assert.ok(recovery.includes('Math.max(0, Math.round(rawScore / (questions.length * 5) * 100))'));
  assert.equal(MOCK_MARKS, 180);
  assert.equal(MOCK_POINTS, Math.max(0, Math.round(((5 * MOCK.right - MOCK.wrong) / (MOCK.total * 5)) * 100)));
  assert.equal(MOCK_POINTS, 72);
  // The fixture's student: 12 mocks at 62 a mock (ArenaPreviewClient.jsx /api/leaderboard).
  const fixture = read('src/app/preview/arena/ArenaPreviewClient.jsx');
  assert.ok(fixture.includes("tests: 12, totalScore: 12 * (state === 'long' ? 71 : 62)"));
  assert.equal(STANDING.you.points, 12 * 62);
  assert.equal(STANDING.you.mocks, 12);
  // The places, by the real ranking (standing.js): competition ranking over totals.
  const others = Array.from({ length: STANDING.students - 3 }, (_, i) => ({ userId: `x${i}`, totalScore: i < 60 ? 900 + i : 100 }));
  const board = (you, next) => [...others, { userId: 'above', totalScore: STANDING.above.points }, { userId: 'next', totalScore: next }, { userId: 'you', totalScore: you }];
  const before = standingFor(board(STANDING.you.points, STANDING.next.points), 'you').you;
  assert.equal(before.rank, STANDING.you.place);
  assert.equal(standingFor(board(STANDING.you.points, STANDING.next.points), 'next').you.rank, STANDING.next.place);
  assert.equal(standingFor(board(STANDING.you.points, STANDING.next.points), 'you').board.toNext, 14);
  const after = standingFor(board(STANDING_AFTER.you.points, STANDING.next.points), 'you');
  assert.equal(after.you.rank, STANDING_AFTER.you.place);
  assert.equal(after.you.rank, STANDING.you.place - 1);
  assert.equal(standingFor(board(STANDING_AFTER.you.points, STANDING.next.points), 'next').you.rank, STANDING_AFTER.next.place);
  assert.equal(after.board.toNext, 6);
});

test('the free daily benchmark: the usage limit and the slide say it', () => {
  assert.ok(read('src/services/usage/getDailyUsage.js').includes('basicRivalBattles: 1,'));
  assert.equal(FREE_DAILY_RUNS, 1);
  assert.equal(FREE_LINE, 'The daily benchmark is free every day.');
  assert.ok(buildTour().find((s) => s.id === 'rival').points.includes('The daily benchmark is free'));
});

test('the component: one fixed-height screen, motion that honours reduced motion, selectors scoped', () => {
  assert.match(SRC, /^'use client';/);
  assert.ok(SRC.includes('className="st st-rival" data-phase={phase}'));
  assert.ok(!/setInterval|requestAnimationFrame|getBoundingClientRect|offsetWidth/.test(SRC));
  assert.match(CSS, /\.st-rival__screen \{[^}]*height: 500px/);
  assert.ok(CSS.includes('@container (min-width: 640px) { .st-rival__screen { height: 548px; } }'));
  assert.ok(CSS.includes('prefers-reduced-motion: reduce'));
  assert.ok(CSS.includes("html[data-motion='reduced'] .st-rival"));
  for (const rule of CSS.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}@]+\{/g) || []) {
    const sel = rule.slice(0, -1).trim();
    if (!sel || /^(from|to|\d+%)$/.test(sel) || sel.startsWith('keyframes') || sel.startsWith('container') || sel.startsWith('media')) continue;
    const parts = []; let depth = 0; let cur = '';
    for (const ch of sel) { if (ch === '(') depth += 1; if (ch === ')') depth -= 1; if (ch === ',' && !depth) { parts.push(cur); cur = ''; } else cur += ch; }
    parts.push(cur);
    for (const part of parts.map((x) => x.trim())) {
      assert.ok(/^(\.st-rival|html\[data-(motion|theme)=)/.test(part), `selector not scoped: ${part}`);
    }
  }
  // Text is never under 14 px.
  for (const m of CSS.matchAll(/font(?:-size)?:\s*(?:\d+\s+)?([\d.]+)px/g)) assert.ok(Number(m[1]) >= 14, `font ${m[0]}`);
});
