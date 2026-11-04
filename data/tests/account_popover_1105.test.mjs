// node --test data/tests/account_popover_1105.test.mjs
// D8 (owner LK97, 5 Nov 2026): the top bar's person door opens a small account pop-over modelled on the app's Account sheet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ACCOUNT_POPOVER_COPY as COPY, proUntilWords } from '../../src/components/account/accountPopoverCopy.mjs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const pop = read('src/components/account/AccountPopover.jsx');
const css = read('src/components/account/account-popover.css');

test('the door is a real button with aria-expanded, and the pop-over is a dialog', () => {
  assert.match(pop, /<button[\s\S]*aria-haspopup="dialog"[\s\S]*aria-expanded=\{open\}/);
  assert.match(pop, /role="dialog" aria-labelledby=\{titleId\}/);
});

test('Escape and a press outside close it, focus is held inside and returns to the door', () => {
  assert.match(pop, /event\.key === 'Escape'[\s\S]*close\(true\)/);
  assert.match(pop, /addEventListener\('pointerdown', onPress\)/);
  assert.match(pop, /door\.current\?\.focus\(\)/);
  assert.match(pop, /event\.key !== 'Tab'/);
  assert.match(pop, /dialog\[open\]/, 'the sign-out question is its own modal and keeps its own Escape');
});

test('content follows the app sheet: plan, credits, Appearance, account rows, Write to us, a quiet Sign out', () => {
  assert.match(pop, /<AppearanceSwitch/);
  assert.match(pop, /links\.wallet \|\| '\/wallet'/);
  assert.match(pop, /<SignOutButton className="acct-pop__out">/);
  assert.equal(COPY.rowAccount, 'Name, sign-in and plan');
  assert.equal(COPY.rowHelp, 'Help and about');
  assert.equal(COPY.rowContact, 'Write to us');
  assert.equal(COPY.contactAddress, 'support@mockmob.in');
  assert.equal(COPY.planFree, 'Free');
});

test('Pro says until when, in India time; a bad date says nothing', () => {
  assert.equal(proUntilWords('2026-11-12T18:29:59.000Z'), 'until 12 Nov');
  assert.equal(proUntilWords('2026-11-12T18:30:00.000Z'), 'until 13 Nov');
  assert.equal(proUntilWords(null), null);
  assert.equal(proUntilWords('nope'), null);
});

test('phones keep the dock: the pop-over is hidden under 640 px and the door goes to Account there', () => {
  assert.match(css, /@media \(max-width: 639px\) \{ \.app-shell \.acct-pop \{ display: none; \} \}/);
  assert.match(pop, /router\.push\(profileHref\)/);
});

test('tokens only: no literal colours', () => {
  assert.doesNotMatch(css, /#[0-9a-f]{3,6}\b|rgba?\(/i);
});
