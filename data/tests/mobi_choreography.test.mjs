// The web's Mobi tables must say what the app's say. data/mobi-choreography.json is a copy of the
// app's docs/brain/MOBI-CHOREOGRAPHY.json (written from MobiMoves, MobiMoments, MobiRation and
// MobiTapCycle). When the app changes a table, copy the file again; these tests then show what the
// web has to follow.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MOBI_ACTS, SPEC, REACTION_ACTS, STILL_ACTS, resolveAct, stanceAfter } from '../../src/components/brand/mobiActs.js';
import { CELEBRATION_ACTS } from '../../src/lib/mobiPrefs.js';
import { MOBI_EVENTS, LATE_NIGHT_START, LATE_NIGHT_END, ASLEEP_FROM, TAP_CYCLE, FOLLOW, underLevel, entranceAt } from '../../src/lib/mobiMoments.js';
import { GLANCE_GAP_MS, NUDGE_AFTER_MS, FAILURE_RUN_MS, WAIT_LONG_MS } from '../../src/lib/mobiRation.js';

const spec = JSON.parse(readFileSync(new URL('../mobi-choreography.json', import.meta.url), 'utf8'));
const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('the web has exactly the app acts, plus idle', () => {
  assert.deepEqual([...MOBI_ACTS, 'idle'].sort(), Object.keys(spec.acts).sort());
});

test('every act: stance, duration, held, celebration, reaction and the reduced-motion kind match the app', () => {
  for (const [act, app] of Object.entries(spec.acts)) {
    const web = SPEC[act];
    assert.ok(web, `${act} has a spec`);
    assert.equal(web.stance, app.stance, `${act} stance`);
    assert.equal(Boolean(web.held), app.held, `${act} held`);
    // Held acts carry the app's duration as a transition length the raster does not need, except
    // nudge, whose two jabs run for it.
    if (!app.held || act === 'nudge') assert.equal(web.ms, app.durationMs, `${act} duration`);
    assert.equal(CELEBRATION_ACTS.includes(act), app.celebration, `${act} celebration`);
    assert.equal(REACTION_ACTS.includes(act), app.reaction, `${act} reaction`);
    assert.equal(STILL_ACTS.includes(act), app.reducedMotion === 'still', `${act} reduced motion`);
  }
});

test('the stance an act leaves him in is the app stance, as a web act', () => {
  for (const [act, app] of Object.entries(spec.acts)) {
    const expected = app.stance === null ? null : app.stance === 'stand' ? 'idle' : app.stance;
    assert.equal(stanceAfter(act), expected, `${act} leaves him in ${expected}`);
  }
});

test('Celebrations: Quiet and Off do what the app does, for every act', () => {
  for (const [act, app] of Object.entries(spec.acts)) {
    assert.equal(underLevel(act, 'full'), act);
    assert.equal(underLevel(act, 'quiet'), app.underQuiet.act, `${act} under Quiet`);
    assert.equal(underLevel(act, 'off'), app.underOff, `${act} under Off`);
    // The kit resolves the same way (Off keeps the stance, so it stands at ease).
    const quiet = resolveAct(act, { celebrations: 'quiet' }).act;
    if (app.celebration) assert.equal(quiet, 'nod');
    else assert.equal(quiet, act);
    if (app.celebration) assert.equal(resolveAct(act, { celebrations: 'off' }).act, 'idle');
  }
  assert.deepEqual([...CELEBRATION_ACTS].sort(), [...spec.celebrationActs].sort());
});

test('Reduce motion: a still act keeps its pose, an act that is only motion leaves him in his stance', () => {
  for (const [act, app] of Object.entries(spec.acts)) {
    const resolved = resolveAct(act, { reduced: true });
    assert.equal(resolved.live, false, `${act} does not move`);
    if (app.reducedMotion === 'still' || app.held) assert.equal(resolved.act, act, `${act} keeps its pose`);
    else assert.equal(resolved.act, stanceAfter(act) || 'idle', `${act} leaves him in his stance`);
  }
});

test('the event table is the app table', () => {
  assert.deepEqual(MOBI_EVENTS, spec.events);
});

test('the rate limits, the late-night window and the tap cycle are the app numbers', () => {
  assert.equal(GLANCE_GAP_MS, spec.rateLimits.glanceGapMs);
  assert.equal(GLANCE_GAP_MS, spec.rateLimits.reactNowDefaultGapMs);
  assert.equal(NUDGE_AFTER_MS, spec.rateLimits.nudgeAfterMs);
  assert.equal(FAILURE_RUN_MS, spec.rateLimits.failureRunMs);
  assert.equal(WAIT_LONG_MS, spec.rateLimits.waitLongAfterMs);
  assert.equal(LATE_NIGHT_START, spec.lateNight.startHour);
  assert.equal(LATE_NIGHT_END, spec.lateNight.endHour);
  assert.equal(ASLEEP_FROM, spec.lateNight.sleepFromHour);
  assert.equal(entranceAt(new Date(2026, 9, 15, 23, 30)), spec.lateNight.sleepyAct);
  assert.equal(entranceAt(new Date(2026, 9, 16, 2, 0)), spec.lateNight.sleepAct);
  assert.deepEqual(TAP_CYCLE.acts, spec.tapCycle.acts);
  assert.equal(TAP_CYCLE.resetAfterMs, spec.tapCycle.resetAfterMs);
  assert.equal(TAP_CYCLE.cap, spec.tapCycle.capPerVisit);
  assert.equal(FOLLOW.releaseAfterMs, spec.followPointer.releaseAfterMs);
  assert.equal(FOLLOW.clampX, spec.followPointer.clampX);
  assert.equal(FOLLOW.clampY, spec.followPointer.clampY);
});

test('every act is a program in the rig table with the same length and stance as the choreography table', () => {
  const rig = JSON.parse(read('data/mobi_rig.v2.json'));
  for (const [act, app] of Object.entries(spec.acts)) {
    const row = rig.acts[act];
    assert.ok(row, `${act} is in the rig table`);
    assert.equal(Math.round(row.seconds * 1000), app.durationMs, `${act} seconds`);
    assert.equal(row.stance, app.stance, `${act} stance`);
    assert.equal(Boolean(row.held), app.held, `${act} held`);
  }
});
