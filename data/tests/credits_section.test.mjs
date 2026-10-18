// Account > Credits (audit findings 12 and 13; one credits balance, D78): what the page prints from the contract body. Pure rules in
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

// One credits balance (owner, 18 Oct 2026, D78): one tile, one figure.
const ONE = { ...FIXTURE, total: { balance: 49, freeLeft: 9, freeAllowance: 50, held: 40, renewsOn: '2026-11-01', label: 'Credits' } };

test('the one balance: one tile, the total, what a credit buys and when the free ones come back', () => {
  const tiles = creditTiles(ONE);
  assert.equal(tiles.length, 1);
  const [one] = tiles;
  assert.deepEqual([one.name, one.figure, one.state], ['Credits', '49', 'known']);
  assert.ok(one.lines.includes('1 credit = 1 question or 1 Ask Mobi reply; a full mock is 50.'));
  assert.ok(one.lines.includes('9 of your 50 free credits left this month; 50 more on 1 November. They are used first.'));
  // An older server without `total`: the two stored parts are added (40 + 9), never shown as two numbers.
  const [old] = creditTiles(FIXTURE);
  assert.deepEqual([old.name, old.figure], ['Credits', '49']);
  assert.ok(old.lines.includes('Free credits come back on 1 November.'));
});

test('an unknown balance has no figure, never 0', () => {
  const [one] = creditTiles({ practice: { balance: null }, ai: { balance: null, renewsOn: null }, plan: { name: 'Free', until: null } });
  assert.equal(one.figure, null);
  assert.equal(one.state, 'unknown');
  assert.ok(one.lines.includes(CREDITS_COPY.unavailable));
  assert.equal(creditTiles({ practice: { balance: 40 }, ai: { balance: null }, plan: {} })[0].figure, null, 'an unknown part is an unknown total');
  assert.equal(creditTiles({ ...ONE, total: { ...ONE.total, balance: null } })[0].figure, null);
  assert.equal(creditTiles({ practice: { balance: 0 }, ai: { balance: 0 }, plan: {} })[0].figure, '0', 'a real zero stays a zero');
});

test('Pro: practice needs no credits, with the paid-through date when there is one; the balance still shows', () => {
  const [one] = creditTiles({ ...ONE, plan: { name: 'Pro', until: '2027-01-12' } });
  assert.equal(one.figure, '49');
  assert.ok(one.lines.includes('Practice needs no credits with Pro, until 12 January 2027.'));
  assert.ok(creditTiles({ ...ONE, plan: { name: 'Pro', until: null } })[0].lines.includes('Practice needs no credits with Pro.'));
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

test('a history line prints what, when, the change, what it paid for and the balance after', () => {
  const lines = FIXTURE.history.map(historyLine);
  assert.deepEqual(
    [lines[0].what, lines[0].changeText, lines[0].poolName, lines[0].after, lines[0].when],
    ['Practice set', '-10', 'Practice', '40 left', '14 Oct, 4:30 PM'],
  );
  assert.deepEqual([lines[1].what, lines[1].changeText, lines[1].poolName, lines[1].after], ['Repair, Q2 Accountancy', '-1', 'Ask Mobi and repairs', '9 left']);
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
    ...creditTiles(ONE).flatMap((t) => [t.name, ...t.lines]),
    ...FIXTURE.history.flatMap((l) => { const h = historyLine(l); return [h.what, h.poolName, h.after || '', h.changeText]; }),
  ];
  for (const text of printed) assert.doesNotMatch(text, /[!—·]|PrepOS/, text);
});

test('the filter keeps one kind (practice, or Ask Mobi and repairs), and All keeps everything', () => {
  assert.equal(filterHistory(FIXTURE.history, 'all').length, 7);
  assert.deepEqual(new Set(filterHistory(FIXTURE.history, 'ai').map((l) => l.pool)), new Set(['ai']));
  assert.equal(filterHistory(FIXTURE.history, 'practice').length, 4);
  assert.equal(filterHistory(null, 'ai').length, 0);
  assert.deepEqual(FILTERS.map((f) => f.label), ['All', 'Practice', 'Ask Mobi and repairs']);
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
  assert.deepEqual(creditsFromResponse(ONE).total, ONE.total, 'the one balance block is kept');
  assert.equal('total' in creditsFromResponse(FIXTURE), false);
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
