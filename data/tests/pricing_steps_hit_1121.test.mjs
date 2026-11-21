// The home page's subject picker (pricing, "How many CUET subjects are you taking?", PlanValue.jsx .lp-usual__step) answers a
// press anywhere on it (owner LK365, 21 Nov 2026: "when I am clicking on the edges, the middle numbers are fine, so fix that").
// Measured with real input (tmp/1121-stories/fixes/press.mjs): before, 25 of 29 presses per size selected the number under them;
// every press at the control's rounded outer ends (keys 1 and 5) fell on the card, because the row clipped its keys to its
// frame (overflow: hidden with border-radius, and a clipped corner is not hit either); with a mouse a press 1 px inside a key's
// edge also failed, because the press-down scale (r13-motion.css) shrank the held key and the release landed outside it, so the
// browser fired no click. These tests pin the cause in the sheet that wins for #pricing (r19-home-b.css). Source-level.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SUBJECT_COUNT, usualWay } from '../../src/lib/payments/receipt.mjs';

const css = readFileSync(new URL('../../src/app/r19-home-b.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const jsx = readFileSync(new URL('../../src/components/landing/PlanValue.jsx', import.meta.url), 'utf8');
const rulesFor = (selector) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter(([, sel]) => sel.split(',').some((s) => s.trim().replace(/\s+/g, ' ') === selector))
  .map(([, , body]) => body);
const last = (selector, prop) => {
  let value = null;
  for (const body of rulesFor(selector)) for (const m of body.matchAll(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'g'))) value = m[1].trim();
  return value;
};
const P = 'body .mm.lp #pricing';

test('the row does not clip its keys: no overflow hidden on the frame', () => {
  const overflow = last(`${P} .lp-usual__steps`, 'overflow');
  assert.notEqual(overflow, 'hidden', 'a clipped key is not hit where it is clipped (the rounded ends of 1 and 5)');
  assert.equal(last(`${P} .lp-usual__steps`, 'border-radius'), '14px');
  assert.equal(last(`${P} .lp-usual__step:first-child`, 'border-radius'), '13px 0 0 13px', 'the end keys carry the frame radius themselves');
  assert.equal(last(`${P} .lp-usual__step:last-child`, 'border-radius'), '0 13px 13px 0');
});

test('each key reaches past its painted cell over the rim, the ends too', () => {
  assert.equal(last(`${P} .lp-usual__step`, 'position'), 'relative');
  assert.equal(last(`${P} .lp-usual__step::before`, 'content'), "''");
  assert.equal(last(`${P} .lp-usual__step::before`, 'position'), 'absolute');
  const inset = last(`${P} .lp-usual__step::before`, 'inset');
  assert.match(inset, /^-[1-9]\d*px 0$/, 'reaches above and below, never into the next key');
  assert.ok(Number(inset.match(/-(\d+)px/)[1]) >= 2, 'covers the 1 px rim and beyond');
  assert.match(last(`${P} .lp-usual__step:first-child::before`, 'left'), /^-[2-9]px$/);
  assert.match(last(`${P} .lp-usual__step:last-child::before`, 'right'), /^-[2-9]px$/);
});

test('a held key does not move or shrink, so the release stays on it', () => {
  assert.equal(last(`${P} .lp-usual__step:active`, 'transform'), 'none');
  assert.equal(last(`${P} .lp-usual__step`, 'transform'), 'none');
  // The press still answers: the wash.
  assert.match(last(`${P} .lp-usual__step:active`, 'background') || '', /tint/);
});

test('targets are at least 44 px and every count from first to last is a key that the plan handles', () => {
  assert.equal(last(`${P} .lp-usual__step`, 'min-height'), '44px');
  assert.match(jsx, /Array\.from\(\{ length: SUBJECT_COUNT\.max - SUBJECT_COUNT\.min \+ 1 \}, \(_, i\) => SUBJECT_COUNT\.min \+ i\)/);
  assert.match(jsx, /className="lp-usual__step" aria-pressed=\{count === u\.subjects\}/);
  assert.match(jsx, /onClick=\{\(\) => pick\(count\)\}/);
  const offer = { purchasable: 'one_time', oneTime: { rupees: 99 } };
  const totals = [];
  for (let c = SUBJECT_COUNT.min; c <= SUBJECT_COUNT.max; c += 1) {
    const u = usualWay(offer, c);
    assert.equal(u.subjects, c, `count ${c} is kept, not clamped to another`);
    totals.push(u.totalPaise);
  }
  assert.equal(new Set(totals).size, totals.length, 'each count gives its own total');
});
