import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { candidates, nextMove, practiceHref, repairMinutes, safeHref, weakChapterFromSwot, whenWord, RULE_IDS } from '../next_step_rules.mjs';
import { retiredTermIn } from '../glossary.mjs';
import { resolvesHref } from './ia_helpers.mjs';

const DIR = new URL('../fixtures/next_step/', import.meta.url);
const FIXTURES = readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8')));

test('fixtures cover the Today states IA2 must show', () => {
  const names = FIXTURES.map((f) => f.name);
  for (const state of ['first', 'resume', 'unopened', 'repair', 'practise', 'mock-due', 'stale']) assert.ok(names.includes(state), state);
});

for (const fx of FIXTURES) {
  test(`fixture ${fx.name}: ${fx.description}`, () => {
    const move = nextMove(fx.input);
    for (const [key, want] of Object.entries(fx.expect)) assert.deepEqual(move[key] ?? null, want, `${fx.name}.${key}`);
  });
}

test('every move has exactly one primary, and its href resolves to a page or a planned move', () => {
  for (const fx of FIXTURES) {
    const move = nextMove(fx.input);
    assert.ok(move.primary?.label && move.primary?.href, fx.name);
    assert.ok(resolvesHref(move.primary.href), `${fx.name}: ${move.primary.href}`);
    for (const other of move.others) assert.ok(resolvesHref(other.href), `${fx.name} other: ${other.href}`);
    if (move.secondary) assert.ok(resolvesHref(move.secondary.href), `${fx.name} secondary`);
    assert.ok(move.others.length <= 3);
    assert.ok(!move.others.some((o) => o.id === move.id), 'the primary is not repeated in others');
  }
});

test('copy rules: sentence case, no "!", no em dash, no retired names', () => {
  for (const fx of FIXTURES) {
    const move = nextMove(fx.input);
    const lines = [move.label, move.title, move.detail, move.cost, move.primary.label, move.secondary?.label, move.away?.line, move.othersLabel, move.more.label,
      ...move.others.flatMap((o) => [o.title, o.label])].filter(Boolean);
    for (const line of lines) {
      assert.doesNotMatch(line, /[!—]/, line);
      assert.equal(retiredTermIn(line), null, line);
    }
  }
});

test("repair minutes use the app's formula: 3 a mistake, rounded up to 5", () => {
  assert.equal(repairMinutes(0), null);
  assert.equal(repairMinutes(1), 5);
  assert.equal(repairMinutes(2), 10);
  assert.equal(repairMinutes(4), 15);
  assert.equal(repairMinutes(5), 15);
  assert.equal(repairMinutes(6), 20);
});

test('no Review your mistakes when there are no mistakes, and no fresh check before A.9', () => {
  const ids = candidates({ now: '2026-10-15T14:30:00Z', attempts: [{ id: 'a', subject: 'accountancy', mode: 'full', completedAt: '2026-10-14T10:00:00Z' }], repair: { attemptId: 'a', open: 0 }, freshCheck: { due: 3 } }).map((c) => c.id);
  assert.ok(!ids.includes('repair'));
  assert.ok(!ids.includes('check'));
  const withCheck = candidates({ now: '2026-10-15T14:30:00Z', capabilities: { freshCheck: true }, attempts: [{ id: 'a', subject: 'accountancy', mode: 'full', completedAt: '2026-10-14T10:00:00Z' }], freshCheck: { due: 2 } });
  assert.equal(withCheck[0].id, 'check');
  assert.equal(withCheck[0].title, 'Check 2 repaired questions, free');
});

test('rule order: resume beats everything, then unopened, repair, practise, mock', () => {
  const now = '2026-10-15T14:30:00Z';
  const base = { now, subjects: ['accountancy'], attempts: [{ id: 'a', subject: 'accountancy', mode: 'quick', completedAt: '2026-09-01T10:00:00Z' }] };
  const all = { ...base, openSession: { subject: 'accountancy', mode: 'quick', answered: 3, total: 10, href: '/test?sessionId=s1' },
    unopenedResult: { attemptId: 'a' }, repair: { attemptId: 'a', open: 2, mode: 'quick', completedAt: '2026-09-01T10:00:00Z' },
    weakChapter: { subject: 'accountancy', chapter: 'Partnership' } };
  assert.deepEqual(candidates(all).map((c) => c.id), ['resume', 'unopened', 'repair', 'practise', 'mock', 'quick']);
  assert.ok(candidates(all).every((c, i, arr) => i === 0 || arr[i - 1].rule < c.rule));
  for (const id of candidates(all).map((c) => c.id)) assert.ok(RULE_IDS.includes(id));
});

test('hrefs from the server or SWOT are never trusted blindly', () => {
  assert.equal(safeHref('https://evil.example/x'), null);
  assert.equal(safeHref('//evil.example'), null);
  assert.equal(safeHref('javascript:alert(1)'), null);
  assert.equal(safeHref('/dashboard?x=1', { prefixes: ['/dashboard'] }), '/dashboard?x=1');
  assert.equal(safeHref('/dashboardx', { prefixes: ['/dashboard'] }), null);
  const move = nextMove({ now: '2026-10-15T14:30:00Z', attempts: [{ id: 'a', subject: 'accountancy', mode: 'quick', completedAt: '2026-10-14T10:00:00Z' }],
    openSession: { subject: 'accountancy', mode: 'quick', answered: 1, total: 10, href: 'https://evil.example' } });
  assert.equal(move.primary.href, '/dashboard');
});

test('the SWOT plan[0] becomes the weak chapter with its own href', () => {
  const swot = { state: 'ready', plan: [{ id: 'p1', label: 'Practise 10 on Accounting Ratios', reason: '21 marks lost here.', practice: { subject: 'accountancy', mode: 'quick', count: 10, chapter: 'Accounting Ratios' },
    href: '/dashboard?subject=accountancy&mode=quick&count=10&chapter=Accounting%20Ratios' }] };
  const weak = weakChapterFromSwot(swot);
  assert.deepEqual(weak, { subject: 'accountancy', chapter: 'Accounting Ratios', count: 10, href: swot.plan[0].href, reason: '21 marks lost here.', source: 'swot' });
  assert.equal(weakChapterFromSwot({ state: 'too_few', plan: [] }), null);
  assert.equal(weakChapterFromSwot(null), null);
});

test('day words in India time', () => {
  const now = Date.parse('2026-10-15T14:30:00Z');
  assert.equal(whenWord(Date.parse('2026-10-15T03:00:00Z'), now), "today's");
  assert.equal(whenWord(Date.parse('2026-10-14T03:00:00Z'), now), "yesterday's");
  assert.equal(whenWord(Date.parse('2026-10-13T03:00:00Z'), now), "Tuesday's");
  assert.equal(whenWord(Date.parse('2026-10-01T03:00:00Z'), now), 'the 1 Oct');
  assert.equal(practiceHref({ subject: 'economics', mode: 'full' }), '/dashboard?subject=economics&mode=full');
});
