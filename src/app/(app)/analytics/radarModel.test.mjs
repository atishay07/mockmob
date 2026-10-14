// Run: node --test "src/app/(app)/analytics/radarModel.test.mjs"
import test from 'node:test';
import assert from 'node:assert/strict';
import { radarLead, radarStage, subjectLine, trendBars, trendCaption } from './radarModel.mjs';

const NOW = Date.parse('2026-10-14T12:00:00Z');

test('stages: cold, thin, ready', () => {
  assert.equal(radarStage(0), 'cold');
  assert.equal(radarStage(undefined), 'cold');
  assert.equal(radarStage(2), 'thin');
  assert.equal(radarStage(3), 'ready');
});

test('bars keep the last twelve, oldest first, clamped but honest', () => {
  const timeline = Array.from({ length: 15 }, (_, i) => ({ test: `T${i + 1}`, score: i === 14 ? 104 : i === 13 ? -8 : 40 + i, at: `2026-10-${String(i + 1).padStart(2, '0')}T08:00:00Z` }));
  const bars = trendBars(timeline, { now: NOW });
  assert.equal(bars.length, 12);
  assert.equal(bars[0].n, 4);
  assert.equal(bars[0].label, 'Session 4, 4 Oct');
  assert.equal(bars.at(-1).latest, true);
  assert.equal(bars.at(-1).score, 104);
  assert.equal(bars.at(-1).height, 100);
  assert.equal(bars.at(-2).height, 0);
  assert.equal(bars.filter((b) => b.latest).length, 1);
  assert.deepEqual(trendBars([{ score: null }, null]), []);
});

test('captions name their sample and never overclaim', () => {
  assert.equal(trendCaption([]), 'Finish a session to start your trend.');
  assert.equal(trendCaption([{ score: 61.4 }]), 'One session so far, at 61%. One more and the trend starts.');
  assert.equal(trendCaption([{ score: 50 }, { score: 72 }]), '50% to 72% across 2 sessions. Each session is a different set of questions, so read it as a rough guide.');
  assert.equal(radarLead({}), 'Radar reads your saved sessions and shows where marks are being lost, chapter by chapter.');
  assert.match(radarLead({ totalAttempts: 1, questions: 10, device: 1 }), /From 1 session and 10 answered questions\. One earlier session was scored on your device/);
  assert.equal(subjectLine({ tests: 3, avg: 61.6 }), '3 sessions, average 62%');
  assert.equal(subjectLine({ tests: 1 }), '1 session');
  for (const s of [trendCaption([{ score: 1 }, { score: 2 }]), radarLead({ totalAttempts: 4, questions: 40, device: 2 })]) {
    assert.ok(!/[—!·]/.test(s), s);
  }
});
