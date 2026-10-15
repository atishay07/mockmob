// IA2: what the Today page says (src/components/today/todayModel.mjs, TonightMove, the page).
// Each fixture state shows exactly one primary and matches data/fixtures/next_step; the card and the road say
// only what the facts say.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { CUET_DATES, ROAD_END, etaLabel, firstNameOf, goalState, greetingFor, moveInput, roadToMay, sheetGaps, todayMove } from '../../src/components/today/todayModel.mjs';
import { retiredTermIn } from '../glossary.mjs';
import { resolvesHref } from './ia_helpers.mjs';

const DIR = new URL('../fixtures/next_step/', import.meta.url);
const FIXTURES = readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8')));
const root = (path) => new URL(`../../${path}`, import.meta.url);

// The client's view of a fixture: the server's moveFacts plus the user, wallet and clock the page adds.
function viaClient(fx) {
  const { input } = fx;
  const facts = { attempts: input.attempts || [], openSession: input.openSession, unopenedResult: input.unopenedResult, repair: input.repair, weakChapter: input.weakChapter, freshCheck: input.freshCheck, capabilities: input.capabilities };
  const user = { subjects: (input.subjects || []).map((s) => s.id), isPremium: input.plan === 'pro' };
  return todayMove(facts, { user, practiceCredits: input.practiceCredits ?? null, aiCredits: input.aiCredits ?? null, now: Date.parse(input.now) });
}

test('the Today states each show exactly one primary and match the shared fixtures', () => {
  const states = ['first', 'resume', 'unopened', 'repair', 'practise', 'mock-due', 'stale'];
  for (const name of states) {
    const fx = FIXTURES.find((f) => f.name === name);
    assert.ok(fx, name);
    const move = viaClient(fx);
    assert.ok(move.primary.label && move.primary.href, `${name}: one primary`);
    assert.equal(typeof move.primary, 'object');
    assert.ok(!Array.isArray(move.primary), `${name}: a single primary, not a list`);
    for (const [key, want] of Object.entries(fx.expect)) assert.deepEqual(move[key] ?? null, want, `${name}.${key}`);
    assert.ok(resolvesHref(move.primary.href), `${name}: ${move.primary.href}`);
  }
});

test('every fixture state, including the gated ones, resolves and never repeats its primary in "others"', () => {
  for (const fx of FIXTURES) {
    const move = viaClient(fx);
    assert.equal(move.id, fx.expect.id, fx.name);
    assert.ok(!move.others.some((o) => o.id === move.id), fx.name);
    for (const o of move.others) assert.ok(resolvesHref(o.href), `${fx.name} other ${o.href}`);
  }
});

test('no unrepaired mistakes means no repair move, and no mistakes means no "Review your mistakes" anywhere', () => {
  const base = FIXTURES.find((f) => f.name === 'repair');
  const none = todayMove({ attempts: base.input.attempts, repair: null, capabilities: {} }, { user: { subjects: ['accountancy'] }, now: Date.parse(base.input.now) });
  assert.notEqual(none.id, 'repair');
  const texts = [none.title, none.detail, none.cost, none.primary.label, ...none.others.flatMap((o) => [o.title, o.label]), none.more.label].filter(Boolean).join(' | ');
  assert.doesNotMatch(texts, /Review your mistakes/);
});

test('copy rules on every state: sentence case, no "!", no em dash, no retired names, no recovery caveat', () => {
  for (const fx of FIXTURES) {
    const move = viaClient(fx);
    const lines = [move.label, move.title, move.detail, move.cost, move.primary.label, move.secondary?.label, move.away?.line, move.othersLabel, move.more.label, ...move.others.flatMap((o) => [o.title, o.label])].filter(Boolean);
    for (const line of lines) {
      assert.doesNotMatch(line, /[!—]/, line);
      assert.doesNotMatch(line, /awaiting|calibration|being prepared|recovery content/i, line);
      assert.equal(retiredTermIn(line), null, line);
    }
  }
});

test('a facts object that could not be read gives no move (Today shows its error state)', () => {
  assert.equal(todayMove(null, {}), null);
  assert.equal(todayMove(undefined, {}), null);
});

test('subjects the practice bank does not support never become the move\'s subject', () => {
  const facts = { attempts: [], capabilities: {} };
  const user = { subjects: ['hindi', 'accountancy'] };
  assert.equal(moveInput(facts, { user, supported: new Set(['accountancy']) }).subjects.join(), 'accountancy');
  assert.equal(moveInput(facts, { user, supported: null }).subjects.join(), 'hindi,accountancy', 'unknown support filters nothing');
  assert.match(todayMove(facts, { user, supported: new Set(['accountancy']), now: Date.parse('2026-10-15T14:30:00Z') }).title, /in Accountancy/);
});

test('an unreadable balance is null, never 0: the cost line names no balance', () => {
  const fx = FIXTURES.find((f) => f.name === 'first');
  const move = todayMove({ attempts: [] }, { user: { subjects: ['accountancy'] }, practiceCredits: null, now: Date.parse(fx.input.now) });
  assert.equal(move.cost, 'Uses 10 practice credits.');
  assert.equal(moveInput({}, { practiceCredits: null, aiCredits: null }).practiceCredits, null);
});

test('greeting follows the app: morning, afternoon, evening, and up late from 11 PM to 5 AM', () => {
  assert.equal(greetingFor(9, 'Asha'), 'Good morning, Asha');
  assert.equal(greetingFor(12, 'Asha'), 'Good afternoon, Asha');
  assert.equal(greetingFor(18, 'Asha'), 'Good evening, Asha');
  assert.equal(greetingFor(23, 'Asha'), 'Up late, Asha');
  assert.equal(greetingFor(4, ''), 'Up late tonight');
  assert.equal(greetingFor(5, ''), 'Good morning');
  assert.equal(firstNameOf('  Asha  Rao '), 'Asha');
  assert.equal(firstNameOf(null), '');
});

test('Finish your sheet appears only for what the site can keep and a profile says is missing', () => {
  assert.equal(sheetGaps(null), null);
  assert.equal(sheetGaps({ name: 'A', subjects: ['accountancy'] }), null, 'no course or colleges field: not stored here, so not missing');
  assert.equal(sheetGaps({ course: 'B.Com (Hons)', colleges: ['SRCC'] }), null);
  const both = sheetGaps({ course: null, colleges: [] });
  assert.equal(both.line, 'Add your course and colleges. Today plans the road from them.');
  assert.equal(both.label, 'Finish your sheet');
  assert.equal(sheetGaps({ course: 'B.Com (Hons)', colleges: [] }).line, 'Add your colleges. Today plans the road from them.');
  assert.equal(sheetGaps({ course: '', colleges: ['SRCC'] }).line, 'Add your course. Today plans the road from them.');
  assert.ok(resolvesHref(both.href));
});

test('the week ring says "Set your goal" only when the server says no goal is chosen', () => {
  assert.deepEqual(goalState(null), { known: false, set: true, days: null });
  assert.deepEqual(goalState({ daysPerWeek: 4 }), { known: true, set: true, days: 4 }, 'an older server that sends no flag keeps the days in force');
  assert.deepEqual(goalState({ daysPerWeek: 4, set: true }), { known: true, set: true, days: 4 });
  assert.equal(goalState({ daysPerWeek: 4, set: false }).set, false);
});

test('the road to May is calendar arithmetic with every date tagged Expected', () => {
  const road = roadToMay(Date.UTC(2026, 9, 15, 9)); // 15 Oct 2026
  assert.equal(road.countdown, true);
  assert.equal(road.days, 198);
  assert.equal(road.weeks, 28);
  assert.equal(road.headline, '28 weeks to the expected CUET window, May 2027.');
  assert.deepEqual(road.stops.map((s) => s.id), ['registration', 'boards', 'exam']);
  for (const stop of road.stops) {
    assert.equal(stop.tag, 'Expected');
    assert.ok(stop.left >= 0 && stop.left + stop.width <= 100.0001, `${stop.id} sits inside the road`);
  }
  assert.ok(road.stops[0].left < road.stops[2].left, 'registration comes before the exam window');
  assert.equal(road.stops[0].eta, 'in 15 weeks');
  assert.match(road.note, /Expected dates/);
});

test('the road follows the calendar: stops on now, the window open, then gone', () => {
  const inRegistration = roadToMay(Date.UTC(2027, 1, 20));
  assert.equal(inRegistration.stops.find((s) => s.id === 'registration').eta, 'On now');
  assert.equal(inRegistration.stops.find((s) => s.id === 'registration').current, true);
  assert.equal(inRegistration.stops.find((s) => s.id === 'registration').left, 0, 'a stop already on starts at today');
  const open = roadToMay(Date.UTC(2027, 4, 10));
  assert.equal(open.countdown, false);
  assert.equal(open.headline, 'The expected CUET window is open, May 2027.');
  assert.deepEqual(open.stops.map((s) => s.id), ['exam'], 'finished stops leave the road');
  assert.equal(roadToMay(ROAD_END), null);
  assert.equal(roadToMay(Date.UTC(2027, 7, 1)), null);
  assert.equal(etaLabel(CUET_DATES.exam, Date.UTC(2027, 3, 28)), 'in 3 days');
});

test('the Today page composes one primary: the hero is the only filled button', () => {
  const page = readFileSync(root('src/app/(app)/today/page.jsx'), 'utf8');
  const hero = readFileSync(root('src/components/today/TonightMove.jsx'), 'utf8');
  const sheet = readFileSync(root('src/components/today/FinishSheetCard.jsx'), 'utf8');
  const glimpse = readFileSync(root('src/components/ai/RecordGlimpse.jsx'), 'utf8');
  assert.equal((hero.match(/btn-volt/g) || []).length, 2, 'the primary link and the error state\'s retry (never shown together)');
  for (const [name, src] of [['page', page], ['sheet card', sheet], ['record glimpse', glimpse]]) assert.doesNotMatch(src, /btn-volt/, `${name} has no filled button`);
});

test('Today carries no retired name, caveat or eyebrow in its own files', () => {
  const files = ['src/app/(app)/today/page.jsx', 'src/components/today/TonightMove.jsx', 'src/components/today/FinishSheetCard.jsx', 'src/components/today/RoadToMay.jsx', 'src/components/today/TodayMobi.jsx', 'src/components/today/todayModel.mjs', 'src/components/ai/RecordGlimpse.jsx', 'src/components/RhythmCard.jsx'];
  for (const file of files) {
    const src = readFileSync(root(file), 'utf8');
    assert.doesNotMatch(src, /Volt weeks?|PrepOS|Radar|Arena|Mentor/, file);
    assert.doesNotMatch(src, /awaiting source|being prepared|Existing access and credits are preserved/i, file);
    assert.doesNotMatch(src, /className="eyebrow"/, file);
  }
});
