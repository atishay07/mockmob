// node --test src/components/learn2/home/__tests__/offerLength.test.mjs
// LK37 (R6 Web E): Learn home's offer can be lengthened or shortened in place, as the chapter page's can. Pinned on the source, as
// r3Home.test.mjs does, because the page is client code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const hero = src('../RoadmapHero.jsx');
const home = src('../LearnHome.jsx');
const api = src('../../api.js');
const picker = src('../../LengthPicker.jsx');
const chapter = src('../../chapter/ChapterPage.jsx');
const css = src('../learn-home.css');

test('the length control is one component, used by the offer and the chapter page (5 | 10 | 20 | Other)', () => {
  assert.match(picker, /export const LENGTHS = \[5, 10, 20\]/);
  assert.match(picker, /export function LengthControl/);
  assert.match(picker, /export function OwnSheet/);
  assert.match(picker, /'Other'/);
  assert.match(hero, /from '\.\.\/LengthPicker'/);
  assert.match(chapter, /from '\.\.\/LengthPicker'/);
  assert.doesNotMatch(chapter, /function OwnSheet|function LengthControl/, 'one copy only');
});

test('the offer shows the control only for an offer that has a length (today, new), and Free\'s cap line under it', () => {
  assert.match(hero, /\(mode === 'today' \|\| mode === 'new'\)/);
  assert.match(hero, /capped\?\.text/);
  assert.match(hero, /How long have you got\?/);
});

test('the length is read from and kept in the same place as the chapter page, and is part of the home read', () => {
  assert.match(home, /MINUTES_KEY/);
  assert.match(home, /learnHome\(subject, \{ fresh: fresh\.current, minutes \}\)/);
  assert.match(api, /\{ fresh = false, minutes = null \}/);
  assert.match(api, /q\(\{ subject, minutes \}\)/);
  assert.match(api, /const key = `\$\{subject \|\| ''\}\|\$\{minutes \|\| ''\}`/, 'each length is its own kept answer');
});

test('the Start key waits for the answer for the chosen length: it never starts what it does not say', () => {
  assert.match(hero, /aria-disabled=\{pending \|\| undefined\}/);
  assert.match(hero, /if \(pending\) e\.preventDefault\(\)/);
  assert.match(home, /Number\(data\.roadmap\.asked\) !== \(minutes \|\| 10\)/);
});

test('the control has its own place in the wide offer, and 44 px segments', () => {
  assert.match(css, /'sub or' 'len or' 'keys or'/);
  assert.match(css, /\.lh-hero__len \.lc-len-wrap \.lc-seg \.ctl-seg__opt \{ min-height: 44px; \}/);
});
