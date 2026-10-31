// Learn v2 egress (A6-wiring.md sections 3 and 8, test plan item 3): one snapshot per request whatever the chapter count,
// no select('*') and no schedule JSON in the Learn server sources, the json-path stubs give the same chapter memory as full
// rows, the progress read is ordered and paged, and Find's shelf over a subject is one request.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createKeycards } from '../../src/lib/server/keycards.js';
import { fakeDb } from '../../src/lib/server/keycardsMemoryDb.js';
import { syllabusFrom } from '../../src/lib/server/keycardsSyllabus.js';
import { createLearn } from '../../src/lib/server/learn.js';
import { STATE_COLUMNS, toState } from '../../src/lib/server/learnStore.js';
import { memoryShare, schedule } from '../keycards.js';

const T0 = Date.parse('2026-11-02T18:00:00+05:30');
const DAY = 86_400_000;
const syllabus = syllabusFrom(null);
const CHAPTERS = syllabus.unitsFor('business_studies', {}).flatMap((u) => u.chapters.map((c) => c.key));
const deckOf = (keys) => {
  const cards = keys.flatMap((key, k) => Array.from({ length: 6 }, (_, i) => ({
    id: `kc.${key}.c${i}`, v: 1, subject: 'business_studies', chapterKey: key, chapter: key, unit: key, kind: 'definition',
    front: `Front ${k}.${i}`, back: `Back ${k}.${i}`, quote: `Quote ${k}.${i}`, importance: i < 4 ? 'must' : 'good', order: i, source: { kind: 'ncert', section: 'Meaning' },
  })));
  return { bySubject: new Map([['business_studies', { version: 1, cards }]]), byId: new Map(cards.map((c) => [c.id, c])), links: new Map([['business_studies', {}]]), disabled: [] };
};

function service(keys) {
  const db = fakeDb({ questions: [] });
  const decks = deckOf(keys);
  const user = { isPremium: true, subjects: ['business_studies'] };
  const kc = createKeycards({ db, decks, syllabus, now: () => T0, getUser: async () => user });
  const learn = createLearn({ db, kc, decks, syllabus, getUser: async () => user, questionIndex: async () => ({ list: [] }), now: () => T0, warn: () => {} });
  return { db, learn };
}
const reads = (db) => db.log.filter((x) => x.table || x.rpc).length;

test('one snapshot per request: 12 chapters ask no more reads than 2', async () => {
  const few = service(CHAPTERS.slice(0, 2));
  const many = service(CHAPTERS);
  const p = new URLSearchParams({ subject: 'business_studies' });
  for (const name of ['subject', 'covers', 'shelves', 'cards']) {
    const a = few.db.log.length;
    const b = many.db.log.length;
    await few.learn[name]('u1', p);
    await many.learn[name]('u1', p);
    assert.equal(many.db.log.length - b, few.db.log.length - a, `${name}: a constant number of reads`);
  }
  assert.ok(reads(many.db) > 0);
});

test('Find\'s shelf over a subject is one request with one card-state read', async () => {
  const { db, learn } = service(CHAPTERS);
  const before = db.log.length;
  const out = await learn.cards('u1', new URLSearchParams({ subject: 'business_studies', filter: 'all' }));
  assert.equal(out.http, 200);
  assert.equal(out.body.chapters.length, CHAPTERS.length);
  assert.equal(db.log.slice(before).filter((x) => x.table === 'key_card_states').length, 1);
});

test('the progress read is ordered and paged; the card states are read with the stubs, never the schedule JSON', async () => {
  const { db, learn } = service(CHAPTERS.slice(0, 2));
  await learn.subject('u1', new URLSearchParams({ subject: 'business_studies' }));
  const progress = db.log.filter((x) => x.table === 'user_question_progress');
  assert.ok(progress.length >= 1 && progress.every((x) => Array.isArray(x.range)), 'paged with a range');
  const states = db.log.filter((x) => x.table === 'key_card_states' && x.op === 'select');
  assert.ok(states.length >= 1 && states.every((x) => x.cols === STATE_COLUMNS && Array.isArray(x.range)));
  assert.doesNotMatch(STATE_COLUMNS, /(^|,)schedule(,|$)/);
});

test('parity: the json-path stubs give the same memory as the full schedule rows', () => {
  const card = (i) => ({ id: `c${i}`, chapterKey: 'x', importance: 'must' });
  const cards = Array.from({ length: 12 }, (_, i) => card(i));
  for (let seed = 0; seed < 5; seed += 1) {
    const full = cards.map((c, i) => {
      let s = null;
      let state = null;
      for (let k = 0; k <= (i + seed) % 4; k += 1) {
        const at = T0 - (30 - k * 7 - seed) * DAY;
        s = schedule(state, [1, 3, 4][(i + k + seed) % 3], at);
        state = { schedule: s.schedule, reps: s.reps, lapses: s.lapses };
      }
      return { card_id: c.id, reps: s.reps, lapses: s.lapses, due_at: s.due_at, last_review_at: s.schedule.last_review, suspended: false, schedule: s.schedule };
    });
    const stubs = full.map(({ schedule: sc, ...rest }) => toState({ ...rest, st: sc.stability, lr: sc.last_review, sst: sc.state, sdue: sc.due }));
    for (const now of [T0, T0 + 5 * DAY, T0 + 40 * DAY]) assert.deepEqual(memoryShare(stubs, cards, now), memoryShare(full, cards, now));
  }
});

test('static: the Learn server sources never select(\'*\') and never read the bare schedule column', () => {
  for (const file of ['src/lib/server/learn.js', 'src/lib/server/learnStore.js', 'src/lib/server/learnHttp.js']) {
    const src = readFileSync(path.join(process.cwd(), file), 'utf8');
    assert.doesNotMatch(src, /select\(\s*['"`]\*['"`]\s*\)/, `${file}: no select('*')`);
    assert.doesNotMatch(src, /select\([^)]*(['"`,])schedule(['"`,])/, `${file}: no bare schedule column`);
  }
});
