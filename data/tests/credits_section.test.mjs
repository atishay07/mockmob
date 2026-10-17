// Account > Credits (audit findings 12 and 13): what the page prints from the contract body. Pure rules in
// src/components/profile/creditsModel.mjs; the wiring is read from the component source.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CREDITS_COPY, FILTERS, appendPage, creditTiles, creditsFromResponse, filterHistory, historyLine, longDate, whenLabel,
} from '../../src/components/profile/creditsModel.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const FIXTURE = JSON.parse(read('data/tests/fixtures/credits/contract_credits_v1.json'));

test('the contract fixture reads as two tiles with the renew date', () => {
  const [practice, ai] = creditTiles(FIXTURE);
  assert.deepEqual([practice.name, practice.figure, practice.state], ['Practice credits', '40', 'known']);
  assert.deepEqual([ai.name, ai.figure, ai.state], ['AI credits', '9', 'known']);
  assert.ok(ai.lines.includes('Renews on 1 November.'));
  assert.ok(ai.lines.includes('AI credits are for Ask Mobi and repair explanations.'));
  assert.ok(practice.lines.some((l) => /mocks and practice/.test(l)));
  assert.ok(!practice.lines.some((l) => /Renews/.test(l)), 'practice credits do not renew');
});

test('an unknown balance has no figure, never 0', () => {
  const [practice, ai] = creditTiles({ practice: { balance: null }, ai: { balance: null, renewsOn: null }, plan: { name: 'Free', until: null } });
  assert.equal(practice.figure, null);
  assert.equal(ai.figure, null);
  assert.equal(practice.state, 'unknown');
  assert.ok(ai.lines.includes(CREDITS_COPY.unavailable));
  assert.ok(!ai.lines.some((l) => /Renews/.test(l)));
  assert.equal(creditTiles({ practice: { balance: 0 }, ai: { balance: 0 }, plan: {} })[0].figure, '0', 'a real zero stays a zero');
});

test('Pro shows practice as included, with the paid-through date when there is one', () => {
  const body = { ...FIXTURE, plan: { name: 'Pro', until: '2027-01-12' } };
  const [practice] = creditTiles(body);
  assert.deepEqual([practice.figure, practice.state, practice.lines[0]], ['Unlimited', 'unlimited', 'Included with Pro until 12 January 2027.']);
  assert.equal(creditTiles({ ...FIXTURE, plan: { name: 'Pro', until: null } })[0].lines[0], 'Included with Pro.');
});

test('dates: a calendar date is never shifted, and a time is India time in 12 hours', () => {
  assert.equal(longDate('2026-11-01'), '1 November');
  assert.equal(longDate('2027-01-12'), '12 January');
  assert.equal(longDate('2026-13-01'), null);
  assert.equal(longDate(null), null);
  assert.equal(whenLabel('2026-10-14T11:00:00.000Z'), '14 Oct, 4:30 PM');
  assert.equal(whenLabel('2026-10-14T18:45:00.000Z'), '15 Oct, 12:15 AM');
  assert.equal(whenLabel('2026-10-14T06:30:00.000Z'), '14 Oct, 12:00 PM');
  assert.equal(whenLabel('nope'), null);
});

test('a history line prints what, when, the change, the pool and the balance after', () => {
  const lines = FIXTURE.history.map(historyLine);
  assert.deepEqual(
    [lines[0].what, lines[0].changeText, lines[0].poolName, lines[0].after, lines[0].when],
    ['Practice set', '-10', 'Practice credits', '40 left', '14 Oct, 4:30 PM'],
  );
  assert.deepEqual([lines[1].what, lines[1].changeText, lines[1].poolName, lines[1].after], ['Repair, Q2 Accountancy', '-1', 'AI credits', '9 left']);
  assert.deepEqual([lines[2].changeText, lines[2].spokenChange], ['+10', '10 added']);
  assert.equal(lines[1].spokenChange, '1 used');
  assert.equal(historyLine({ at: '2026-10-14T11:00:00Z', pool: 'ai', what: '', delta: 1, balanceAfter: null }).after, null, 'an unknown balance after is left out');
  assert.equal(historyLine({}).what, 'Credits');
});

test('every printed line is plain: no "!", no em dash, no middle dot, no PrepOS', () => {
  const printed = [
    ...Object.values(CREDITS_COPY), ...FILTERS.map((f) => f.label),
    ...creditTiles(FIXTURE).flatMap((t) => [t.name, ...t.lines]),
    ...creditTiles({ ...FIXTURE, plan: { name: 'Pro', until: '2027-01-12' } }).flatMap((t) => t.lines),
    ...FIXTURE.history.flatMap((l) => { const h = historyLine(l); return [h.what, h.poolName, h.after || '', h.changeText]; }),
  ];
  for (const text of printed) assert.doesNotMatch(text, /[!—·]|PrepOS/, text);
});

test('the filter keeps one name, and All keeps everything', () => {
  assert.equal(filterHistory(FIXTURE.history, 'all').length, 7);
  assert.deepEqual(new Set(filterHistory(FIXTURE.history, 'ai').map((l) => l.pool)), new Set(['ai']));
  assert.equal(filterHistory(FIXTURE.history, 'practice').length, 4);
  assert.equal(filterHistory(null, 'ai').length, 0);
  assert.deepEqual(FILTERS.map((f) => f.label), ['All', 'Practice credits', 'AI credits']);
});

test('showing more adds only what is new, in order', () => {
  const first = FIXTURE.history.slice(0, 3);
  const page = FIXTURE.history.slice(2, 6);
  const all = appendPage(first, page);
  assert.equal(all.length, 6);
  assert.deepEqual(all.map((l) => l.at), FIXTURE.history.slice(0, 6).map((l) => l.at));
  assert.equal(appendPage(first, null).length, 3);
});

test('only the contract is accepted; anything else is a failed load, not a zero', () => {
  assert.equal(creditsFromResponse(null), null);
  assert.equal(creditsFromResponse({ practice: {}, ai: {} }), null);
  assert.equal(creditsFromResponse({ error: 'unavailable' }), null);
  const ok = creditsFromResponse(FIXTURE);
  assert.equal(ok.history.length, 7);
  assert.equal(ok.nextCursor, null);
  assert.equal(creditsFromResponse({ ...FIXTURE, nextCursor: 'abc' }).nextCursor, 'abc');
  assert.equal(creditsFromResponse({ ...FIXTURE, nextCursor: '' }).nextCursor, null);
});

test('the account page shows the Credits section under the plan, reads the new route and pages with the cursor', () => {
  const page = read('src/app/(app)/profile/ProfilePageClient.jsx');
  assert.ok(page.indexOf('<PlanCredits') < page.indexOf('<CreditsSection'), 'Credits sits under the plan');
  const section = read('src/components/profile/CreditsSection.jsx');
  assert.match(section, /id="credits"/);
  assert.match(section, /apiGet\(CREDITS_URL\)/);
  assert.match(section, /cursor=\$\{encodeURIComponent\(state\.next\)\}/);
  assert.match(section, /role="alert"/, 'a failed load is announced');
  assert.match(section, /aria-pressed=\{filter === f\.id\}/);
  assert.match(read('src/components/profile/creditsModel.mjs'), /CREDITS_URL = '\/api\/me\/credits'/);
  const css = read('src/components/profile/credits.css');
  assert.match(css, /min-height: 44px/, '44 px targets');
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i, 'tokens only, so Night and Daylight match');
});
