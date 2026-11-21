// The Ask Mobi row story (owner LK365, 21 Nov 2026): src/components/landing/stories/mobiStory.mjs + MobiStory.jsx.
// The story contract (tmp/1121-stories/COMMON.md): every hook the script aims at exists, the say lines and their pace, the
// script's length, the screen's own clock agrees with the script, and every word and figure the screen prints equals the
// copy or constant it comes from (bringMistakeCopy.mjs, chatCopy.mjs, bringMistake.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scriptMs, scriptHooks, CURSOR_PRESS_MS, ROW_MAX_MS, ROW_MIN_MS } from '../../src/components/landing/onePlaceModel.mjs';
import {
  MOBI_STORY, MOBI_STORY_TYPED, MOBI_SAYS, MOBI_TIMING, MOBI_PRACTICE, MOBI_SUBJECT, mobiStory, mobiSteps, practiceLine,
} from '../../src/components/landing/stories/mobiStory.mjs';
import { BRING_MISTAKE as W, PRACTICE_COUNT } from '../../src/components/landing/bringMistakeCopy.mjs';
import { CHAT_COPY } from '../../src/components/ai/chatCopy.mjs';
import { MISTAKE_COPY, nextStep } from '../../src/services/mobi/bringMistake.mjs';
import { FIRST_SET_COUNT } from '../../src/lib/firstSet.mjs';
import { SUBJECTS } from '../subjects.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const SRC = read('src/components/landing/stories/MobiStory.jsx');
const CSS = read('src/components/landing/stories/mobi-story.css');
const STORIES = [MOBI_STORY, MOBI_STORY_TYPED];

test('the story: its id, its title (the block\'s own h2), one per photo switch', () => {
  for (const story of STORIES) {
    assert.equal(story.id, 'mobi');
    assert.equal(story.title, W.h2);
  }
  assert.equal(mobiStory(true), MOBI_STORY);
  assert.equal(mobiStory(false), MOBI_STORY_TYPED);
});

test('every data-demo hook the script aims at is in the component, and the cursor never clicks a link', () => {
  // (Critic round, 21 Nov evening: the run ends as the practice set is dealt; the cursor no longer goes to its key, a link.)
  assert.deepEqual(scriptHooks(MOBI_STORY.steps).sort(), ['mobi-option', 'mobi-send', 'mobi-shoot', 'mobi-tocheck', 'mobi-topractice'].sort());
  assert.deepEqual(scriptHooks(MOBI_STORY_TYPED.steps).sort(), ['mobi-option', 'mobi-send', 'mobi-tocheck', 'mobi-topractice', 'mobi-type'].sort());
  for (const story of STORIES) {
    for (const hook of scriptHooks(story.steps)) assert.ok(SRC.includes(`data-demo="${hook}"`), `hook ${hook} missing from MobiStory.jsx`);
    for (const step of story.steps.filter((s) => s.click)) {
      const hook = step.target.match(/data-demo="([^"]+)"/)[1];
      // The element carrying a clicked hook is a <button type="button">.
      const at = SRC.indexOf(`data-demo="${hook}"`);
      const open = SRC.lastIndexOf('<', at);
      assert.match(SRC.slice(open, at), /^<button\s[^<]*type="button"/,`${hook} is a button`);
    }
    // The practice key is the one link: the cursor never presses it (since the critic round of 21 Nov evening it does not
    // go to it either; the run ends as the practice set is dealt).
    assert.ok(!story.steps.some((s) => s.target === '[data-demo="mobi-practice"]' && s.click), 'the practice key is never pressed');
  }
  assert.match(SRC, /<Link href=\{practiceTo\} className="st-mobi__go" data-demo="mobi-practice"/);
  // Every <button> in the screen is type="button".
  assert.equal((SRC.match(/<button\b/g) || []).length, (SRC.match(/<button\s[^<]{0,60}?type="button"/g) || []).length);
});

test('the right option of the fresh question is the one the cursor presses', () => {
  const pick = MOBI_STORY.steps.find((s) => s.target?.includes('mobi-option'));
  assert.equal(pick.target, `[data-demo="mobi-option"]:nth-child(${W.check.correct + 1})`);
  assert.equal(W.check.options.length, 4);
});

test('every focus selector names a class the component draws', () => {
  for (const story of STORIES) {
    for (const step of story.steps.filter((s) => 'focus' in s && s.focus)) {
      for (const cls of step.focus.match(/\.[\w-]+/g)) assert.ok(SRC.includes(cls.slice(1)), `focus ${step.focus} not in MobiStory.jsx`);
    }
  }
});

test('the say lines: 5 beats, short, plain, sentence case, in the order a student does it', () => {
  for (const [kind, says] of Object.entries(MOBI_SAYS)) {
    assert.equal(says.length, 5, kind);
    for (const line of says) {
      assert.ok(line.length <= 58, `${line} (${line.length})`);
      assert.match(line, /^[A-Z][^A-Z]*$/u, `sentence case: ${line}`); // one capital, the first letter (Mobi and CUET excepted below)
      assert.ok(!/[—–!]/.test(line), `no dash or exclamation: ${line}`);
      assert.ok(!/\p{Extended_Pictographic}/u.test(line), `no emoji: ${line}`);
      assert.ok(line.endsWith('.'), line);
    }
  }
  const sayOf = (steps) => steps.filter((s) => typeof s.say === 'string').map((s) => s.say);
  assert.deepEqual(sayOf(MOBI_STORY.steps), [...MOBI_SAYS.photo]);
  assert.deepEqual(sayOf(MOBI_STORY_TYPED.steps), [...MOBI_SAYS.typed]);
  assert.equal(MOBI_SAYS.photo[4], `Check it on a fresh one, then ${PRACTICE_COUNT} more from the bank.`);
  // One idea a beat (critic round, 21 Nov evening): the chapter, then the slip, each its own line.
  assert.deepEqual(MOBI_SAYS.photo.slice(2, 4), ['It names the chapter.', 'And finds where you slipped.']);
  assert.equal(practiceLine(), MOBI_SAYS.typed[4]);
});

// When each step begins, ms after the script starts (CursorDemo's order: say/focus as a step begins, then its wait or move).
function timeline(steps) {
  let t = 0;
  return steps.map((step) => {
    const begin = t;
    if (step.wait) t += step.wait;
    else if (step.target) t += (step.move ?? 0) + (step.click ? CURSOR_PRESS_MS : 0) + (step.dwell ?? 0);
    return { step, begin, moveAt: step.target ? begin : null };
  });
}

test('the pace: each line stays 2.2 s or more, and the cursor waits 500 ms after a line before it moves', () => {
  for (const story of STORIES) {
    const line = timeline(story.steps);
    const says = line.filter((x) => typeof x.step.say === 'string');
    for (let i = 1; i < says.length; i += 1) assert.ok(says[i].begin - says[i - 1].begin >= 2200, `beat ${i} after ${says[i].begin - says[i - 1].begin} ms`);
    for (const s of says) {
      const move = line.find((x) => x.moveAt !== null && x.begin >= s.begin);
      if (move) assert.ok(move.begin - s.begin >= 500, `move ${move.begin - s.begin} ms after "${s.step.say}"`);
    }
    const ms = scriptMs(story.steps);
    assert.ok(ms >= ROW_MIN_MS && ms <= ROW_MAX_MS, `script ${ms} ms`);
  }
});

test('the screen\'s own clock after Send agrees with the script: each line comes as its part arrives', () => {
  // Critic round, 21 Nov evening: the scan has the whole of "Mobi reads the page." (it shows from Send on), the chapter line
  // comes as the page goes into the chat (MOBI_TIMING.scan), the slip line as the read arrives (MOBI_TIMING.read).
  for (const story of STORIES) {
    const line = timeline(story.steps);
    const send = line.find((x) => x.step.target === '[data-demo="mobi-send"]');
    const clickAt = send.begin + send.step.move + CURSOR_PRESS_MS;
    const at = (say) => line.find((x) => x.step.say === say).begin - clickAt;
    const says = story === MOBI_STORY ? MOBI_SAYS.photo : MOBI_SAYS.typed;
    assert.equal(at(says[1]), send.step.dwell, 'the scan line as Send is pressed');
    assert.equal(at(says[2]), MOBI_TIMING.scan);
    assert.equal(at(says[3]), MOBI_TIMING.read);
    assert.ok(MOBI_TIMING.scan >= 2200, 'the sweep has a whole beat');
    assert.ok(MOBI_TIMING.read - MOBI_TIMING.scan >= 2200, 'the chapter has a whole beat');
  }
  assert.ok(MOBI_TIMING.read > MOBI_TIMING.scan);
  // The component schedules exactly these two timeouts.
  assert.match(SRC, /setPhase\('asked'\), MOBI_TIMING\.scan\)/);
  assert.match(SRC, /setPhase\('read'\), MOBI_TIMING\.read\)/);
});

test('the words: the example is bringMistakeCopy.mjs, the app\'s words are chatCopy.mjs and bringMistake.mjs', () => {
  const words = {
    photoKey: CHAT_COPY.photoKey, fieldPhoto: CHAT_COPY.fieldPhoto, fieldMistake: CHAT_COPY.fieldMistake, kindDoubt: CHAT_COPY.kindDoubt,
    kindMistake: CHAT_COPY.kindMistake, marked: CHAT_COPY.marked, send: CHAT_COPY.send, photoPrivacy: CHAT_COPY.photoPrivacy,
    photoTake: CHAT_COPY.photoTake, headline: CHAT_COPY.headline, aiNote: CHAT_COPY.aiNote,
    sendingPhoto: MISTAKE_COPY.sendingPhoto, sending: MISTAKE_COPY.sending,
  };
  for (const [key, value] of Object.entries(words)) assert.ok(SRC.includes(`${key}: ${JSON.stringify(value).replace(/"/g, "'")}`), `APP_WORDS.${key} = ${value}`);
  // The example's parts are read from the copy, never retyped.
  for (const ref of ['W.slip.q', 'W.slip.options', 'W.slip.chosen', 'W.read.chapter', 'W.read.why.lines', 'W.read.slip', 'W.check.q', 'W.check.options', 'W.check.why', 'W.practice.count', 'W.practice.what', 'W.practice.from', 'W.practice.why', 'W.honest', 'W.next[1]', 'W.next[2]']) {
    assert.ok(SRC.includes(ref), `${ref} used`);
  }
  assert.equal(W.honest, 'This example is ours, and Mobi can be wrong.');
});

test('the figures: 10 from the bank, the practice key as the app makes it, the subject a real one', () => {
  assert.equal(W.practice.count, FIRST_SET_COUNT);
  const next = nextStep(MOBI_SUBJECT, W.read.chapter);
  assert.equal(MOBI_PRACTICE.label, next.label);
  assert.equal(MOBI_PRACTICE.href, next.href);
  assert.equal(SUBJECTS.find((s) => s.id === MOBI_SUBJECT.id)?.name, W.slip.subject);
  // The deck draws one tile per question of the set.
  assert.match(SRC, /Array\.from\(\{ length: W\.practice\.count \}/);
});

test('the sheet: every selector is scoped, no type under 14 px, height within the frame\'s limits', () => {
  const body = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [];
  const re = /([^{}]+)\{/g;
  let m;
  while ((m = re.exec(body))) {
    const sel = m[1].trim();
    if (!sel || sel.startsWith('@') || /^(from|to|\d+%)$/.test(sel)) continue;
    selectors.push(...sel.split(/,(?![^(]*\))/).map((s) => s.trim()));
  }
  assert.ok(selectors.length > 50);
  for (const s of selectors) assert.ok(s.startsWith('.st-mobi'), `unscoped selector: ${s}`);
  for (const size of body.matchAll(/font(?:-size)?:\s*(?:\d{3}\s+)?(\d+(?:\.\d+)?)px/g)) assert.ok(Number(size[1]) >= 14, `font ${size[0]}`);
  // The screen's fixed heights, plus the gap and the one honest line under it (14 px at 1.4).
  const narrow = Number(body.match(/\.st-mobi__screen \{\s*height: (\d+)px/)[1]);
  const wide = Number(body.match(/@container \(min-width: 640px\)[\s\S]*?\.st-mobi__screen \{ height: (\d+)px/)[1]);
  assert.ok(narrow + 8 + 20 <= 520, `narrow ${narrow}`);
  assert.ok(wide + 8 + 21 <= 580, `wide ${wide}`);
  // Reduced motion and the app's own switch both stop every transition and animation.
  assert.match(body, /prefers-reduced-motion: reduce/);
  assert.match(body, /html\[data-motion='reduced'\]/);
  // Night is written for.
  assert.match(body, /html\[data-theme='dark'\]/);
});

test('the photo switch: off means no camera and the question typed', () => {
  assert.equal(mobiSteps(false).some((s) => s.target?.includes('mobi-shoot')), false);
  assert.match(SRC, /\{photo \? \(\s*<div className="st-mobi__finder">/);
});
