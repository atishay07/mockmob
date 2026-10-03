import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCompassShowcase } from '../../src/lib/du/showcase.js';
import { CREATOR_REELS, MOCKMOB_POSTS, embedSrc, permalink } from '../../src/lib/social.js';
import { VOICES, publishedVoices } from '../../src/lib/voices.js';
import { computePrepOSInsights, answerFromInsights } from '../prepos_insights.js';

test('Compass ladder numbers are DU’s published figures, not estimates', () => {
  const data = buildCompassShowcase();
  assert.ok(data.programmes.length >= 3, 'at least three programmes load from the published files');
  const file = JSON.parse(readFileSync(new URL('../../public/du/2026/offerings/b-com-hons.json', import.meta.url), 'utf8'));
  const programme = data.programmes.find((p) => p.id === 'b-com-hons');
  const hindu = programme.rows.find((r) => r.college === 'Hindu');
  const source = file.rows.find((r) => /^Hindu\b/.test(r[0]));
  assert.equal(hindu.cutoffs['round-1'].UR, Math.round(source[2][file.categories.indexOf('UR')] * 10) / 10);
  for (const p of data.programmes) {
    assert.ok(p.rows.length >= 6 && p.rows.length <= 10);
    for (const row of p.rows) {
      for (const round of data.rounds) for (const category of data.categories) {
        const v = row.cutoffs[round][category];
        assert.ok(v === null || (v > 100 && v < 1000), `${p.id} ${row.college} ${round} ${category} is null or a plausible score`);
      }
    }
  }
  assert.deepEqual(data.categories, ['UR', 'OBC-NCL', 'EWS', 'SC']);
  assert.ok(JSON.stringify(data).length < 40_000, 'stays small enough to ship to a phone');
});

test('Instagram entries are well-formed, unique and link to the official embed', () => {
  const items = [...CREATOR_REELS, ...MOCKMOB_POSTS];
  const codes = items.map((i) => i.code);
  assert.equal(new Set(codes).size, codes.length);
  for (const item of items) {
    assert.match(item.code, /^[A-Za-z0-9_-]{8,16}$/);
    assert.match(permalink(item), /^https:\/\/www\.instagram\.com\/(reel|p)\/[A-Za-z0-9_-]+\/$/);
    assert.equal(embedSrc(item), `${permalink(item)}embed`);
    assert.ok(item.creator && item.handle);
  }
  assert.ok(CREATOR_REELS.every((r) => r.kind === 'reel'));
});

test('the Wall of love shows only consented, complete voices, and nothing by default', () => {
  assert.deepEqual(publishedVoices(VOICES), [], 'no testimonial ships until a real, consented one is added');
  const sample = [
    { name: 'A', quote: 'x', consent: true },
    { name: 'B', quote: 'y' },
    { name: 'C', quote: 'z', consent: 'yes' },
    { name: '', quote: 'w', consent: true },
    { name: 'D', quote: '', consent: true },
  ];
  assert.deepEqual(publishedVoices(sample).map((v) => v.name), ['A']);
});

test('free accounts do not get Pro pace and changed-answer detail through Ask', () => {
  const NOW = Date.parse('2026-10-10T10:00:00Z');
  const attempt = { id: 'a', completedAt: NOW - 3600_000, subject: 'accountancy', details: [{ qid: 'q1', isCorrect: true }, { qid: 'q2', isCorrect: false }],
    questionsSnapshot: [{ id: 'q1', chapter: 'X' }, { id: 'q2', chapter: 'X' }], selectionMeta: { recovery: { telemetry: 'self_reported', timeline: [{ qid: 'q1', at: 0 }, { qid: 'q2', at: 400000 }, { qid: 'q2', at: 900000 }], observed: { answerChanges: [{ qid: 'q2', markEffect: -6 }, { qid: 'q1', markEffect: -6 }] } } } };
  const insights = computePrepOSInsights([attempt], { now: NOW });
  const free = answerFromInsights('am I changing answers too much', insights, { pro: false });
  assert.match(free.reply, /part of Pro/);
  assert.equal(free.actions[0].route, '/pricing');
  const paid = answerFromInsights('am I changing answers too much', insights, { pro: true });
  assert.match(paid.reply, /Both directions are counted/);
  const chapters = answerFromInsights('which chapter is my weak spot', insights, { pro: false });
  assert.doesNotMatch(chapters.reply, /part of Pro/, 'chapters and the ledger stay free');
});
