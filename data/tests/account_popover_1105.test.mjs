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
  assert.match(pop, /<button[\s\S]*aria-haspopup="dialog"[\s\S]*aria-expanded=\{Boolean\(open\)\}/);
  assert.match(pop, /role="dialog" aria-modal=\{open === 'sheet' \? 'true' : undefined\} aria-labelledby=\{titleId\}/);
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
  assert.equal(COPY.rowHelp, 'Guide', 'R8 TOOLS-05: the help page is called Guide on every surface');
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

// Owner LK141 (5 Nov 2026, supersedes "phones keep the dock: the door goes to Account"): on a phone the person in the top bar opens the
// account sheet, and the dock's You opens the You page.
test('LK141: on a phone the door opens the same panel as a sheet under the top bar, over a scrim, never a page', () => {
  assert.doesNotMatch(pop, /router\.push/, 'the door never navigates');
  assert.doesNotMatch(css, /\.acct-pop \{ display: none; \}/, 'the panel is not hidden on a phone');
  assert.match(pop, /if \(isPhone\(\)\) \{[\s\S]{0,400}setOpen\('sheet'\)/);
  assert.match(pop, /createPortal\([\s\S]{0,160}className="acct-pop-scrim"[\s\S]{0,120}onClick=\{\(\) => close\(true\)\}/, 'drawn at the shell level, with a scrim that closes on its own click');
  assert.match(pop, /event\.target\?\.closest\?\.\('\.acct-pop-scrim'\)/, 'a press on the scrim never falls through to the page');
  assert.match(css, /\.app-shell \.acct-pop\.acct-pop--sheet \{[^}]*position: fixed; left: 12px; right: 12px;/);
  assert.match(css, /html:has\(\.app-shell \.acct-pop--sheet\) \{ overflow: hidden; \}/);
});

test('LK141: the sheet carries Show me around, which closes it and starts the tour', () => {
  assert.match(pop, /\{onTour \? <button type="button" onClick=\{tour\}>\{TOUR_LABEL\}<\/button> : null\}/);
  assert.match(pop, /const tour = \(\) => \{ close\(false\); onTour\?\.\(\); \};/);
});

test('tokens only: no literal colours', () => {
  assert.doesNotMatch(css, /#[0-9a-f]{3,6}\b|rgba?\(/i);
});
