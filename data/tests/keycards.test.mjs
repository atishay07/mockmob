// Key cards: the pure rules (data/keycards.js), the content checks (scripts/keycards/*), the syllabus adapter, the Revise
// source and a 180-day simulation (KEYCARDS-BUILD-SPEC.md 2a, 2c, 2e; KEYCARDS-CONTENT-SPEC.md 3 and 5).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  KEYCARD_RULES, canAdd, cardMinutes, chapterAddSet, chapterKeyOf, chapterSlug, clampClientTime, deckView, dueQueue, horizonDays,
  istDay, lineNeeded, memoryShare, newSchedule, retrievability, schedule, tasteIds,
} from '../keycards.js';
import { syllabusFrom, sectionOpen, chipFor } from '../../src/lib/server/keycardsSyllabus.js';
import * as cuetSyllabus from '../cuet_syllabus.js';
import { blanksCheck, danglingStart, detectOffset, duplicateReasons, fillBlanks, norm, quoteCheck, shapeCheck, syllabusCheck } from '../../scripts/keycards/lib.mjs';
import { mergeQueue, filterSource, itemKey, summary, startRun, recordAnswer, mixLine } from '../../src/components/revise/reviseQueue.js';
import { reviseDue } from '../review_input.mjs';
import { keyCardsEnabled, OFF, loadDecks } from '../../src/lib/server/keycards.js';
import { sameContent } from '../../scripts/keycards/validate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DAY = 86_400_000;
const FIXTURE = JSON.parse(readFileSync(path.join(ROOT, 'data/keycards/decks/_fixture.json'), 'utf8'));
const T0 = Date.parse('2026-11-01T09:00:00+05:30');

let n = 0;
const card = (over = {}) => {
  n += 1;
  const chapterKey = over.chapterKey || 'business_studies.planning';
  return {
    id: `kc.${chapterKey}.def-c${n}`, v: 1, subject: chapterKey.split('.')[0], chapterKey, chapter: 'Planning', unit: 'Planning', kind: 'definition',
    front: `Front ${n}`, back: `Back ${n}`, quote: `Back ${n}`, blanks: [], importance: 'must', asked: 0, tags: [], order: n * 10,
    source: { kind: 'ncert', book: 'Business Studies Part 1', code: 'lebs104', chapterNo: 4, page: 100 }, ...over,
  };
};

// ---------------------------------------------------------------- keys and gating

test('the chapter key rule every part shares', () => {
  assert.equal(chapterKeyOf('business_studies', 'Nature & Significance of Management'), 'business_studies.nature-and-significance-of-management');
  assert.equal(chapterSlug('  d- and f-Block Elements '), 'd-and-f-block-elements');
  assert.equal(chapterSlug('Alcohols, Phenols & Ethers'), 'alcohols-phenols-and-ethers');
  assert.equal(chapterSlug('Accounting Ratios'), 'accounting-ratios');
});

test('KEY_CARDS_ENABLED gates every route: off unless exactly "true"', () => {
  assert.equal(keyCardsEnabled({}), false);
  assert.equal(keyCardsEnabled({ KEY_CARDS_ENABLED: '1' }), false);
  assert.equal(keyCardsEnabled({ KEY_CARDS_ENABLED: 'true' }), true);
  assert.deepEqual(OFF, { http: 404, body: { error: 'KEY_CARDS_OFF' } });
  const routes = ['keycards', 'keycards/deck', 'keycards/add', 'keycards/due', 'keycards/review', 'keycards/line', 'keycards/report', 'me/chapters', 'me/subject-options'];
  for (const r of routes) {
    const src = readFileSync(path.join(ROOT, 'src/app/api', r, 'route.js'), 'utf8');
    assert.match(src, /keycardsHttp\(/, `${r} goes through the gated wrapper`);
  }
  const wrapper = readFileSync(path.join(ROOT, 'src/lib/server/keycardsHttp.js'), 'utf8');
  assert.ok(wrapper.indexOf('keyCardsEnabled()') < wrapper.indexOf('await auth('), 'the flag is checked before anything else');
});

// ---------------------------------------------------------------- deck view, taste, add sets

test('Free sees the taste cards of each chapter whole and the rest as stubs; Pro sees everything', () => {
  const cards = [
    ...Array.from({ length: 7 }, (_, i) => card({ chapterKey: 'business_studies.planning', importance: i % 2 ? 'good' : 'must', order: 70 - i * 10 })),
    ...Array.from({ length: 3 }, () => card({ chapterKey: 'business_studies.staffing', importance: 'good' })),
  ];
  const free = deckView(cards, { isPro: false });
  const pro = deckView(cards, { isPro: true });
  assert.equal(pro.length, 10);
  assert.ok(pro.every((c) => !c.locked));
  assert.deepEqual(free.map((c) => c.id), pro.map((c) => c.id), 'book order either way');
  const planning = free.filter((c) => c.id.includes('.planning.'));
  // The taste is Must-know only (L10): the four Must-know cards of a chapter of seven, never a Good-to-know card.
  const openPlanning = planning.filter((c) => !c.locked);
  assert.equal(openPlanning.length, 4);
  assert.ok(openPlanning.every((c) => c.importance === 'must'));
  const lockedOnes = planning.filter((c) => c.locked);
  assert.equal(lockedOnes.length, 3);
  for (const s of lockedOnes) assert.deepEqual(Object.keys(s).sort(), ['id', 'kind', 'label', 'locked']);
  assert.equal(free.filter((c) => c.id.includes('.staffing.') && !c.locked).length, 0, 'a chapter of Good-to-know cards only has no taste');
});

test('the taste rule is the shared fixture (data/keycards/fixtures/taste.json): the first 5 Must-know cards in book order', () => {
  const fx = JSON.parse(readFileSync(path.join(ROOT, 'data/keycards/fixtures/taste.json'), 'utf8'));
  assert.equal(fx.per, KEYCARD_RULES.free.tastePerChapter);
  const got = tasteIds(fx.cards);
  for (const [chapterKey, ids] of Object.entries(fx.taste)) {
    const mine = deckView(fx.cards.filter((c) => c.chapterKey === chapterKey), { isPro: false }).filter((c) => !c.locked).map((c) => c.id);
    assert.deepEqual(mine, ids, chapterKey);
  }
  assert.deepEqual([...got].sort(), Object.values(fx.taste).flat().sort());
  // Not "the first 5 in book order": that rule (the app's before L10) opens Good-to-know cards.
  const firstFive = [...fx.cards].filter((c) => c.chapterKey === 'business_studies.planning').sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)).slice(0, 5).map((c) => c.id);
  assert.notDeepEqual(firstFive, fx.taste['business_studies.planning']);
});

test('chapterAddSet: Pro adds every Must-know card, Free only the taste; good cards only by choice', () => {
  const cards = Array.from({ length: 9 }, (_, i) => card({ chapterKey: 'business_studies.directing', importance: i < 7 ? 'must' : 'good' }));
  const pro = chapterAddSet(cards, 'business_studies.directing', { isPro: true });
  assert.equal(pro.length, 7);
  assert.ok(pro.every((c) => c.importance === 'must'));
  const free = chapterAddSet(cards, 'business_studies.directing', { isPro: false });
  assert.deepEqual(new Set(free.map((c) => c.id)), tasteIds(cards));
  assert.equal(free.length, 5);
  assert.equal(canAdd(cards[8], cards, { isPro: false }), false, 'a good card past the taste is Pro');
  assert.equal(canAdd(cards[8], cards, { isPro: true }), true);
});

// ---------------------------------------------------------------- FSRS

test('schedule maps Missed/Got it/Easy to FSRS Again/Good/Easy and never passes the exam horizon', () => {
  const at = T0;
  const missed = schedule(null, 1, at);
  const got = schedule(null, 3, at);
  const easy = schedule(null, 4, at);
  assert.ok(Date.parse(missed.due_at) <= Date.parse(got.due_at) && Date.parse(got.due_at) < Date.parse(easy.due_at));
  assert.equal(got.reps, 1);
  assert.throws(() => schedule(null, 2, at), /INVALID_RATING/);
  // Many Easy answers in a row: the interval grows but never reaches past 15 May 2027.
  let state = null;
  let t = at;
  const horizon = Date.parse('2027-05-15T23:59:59+05:30');
  for (let i = 0; i < 12; i += 1) {
    const next = schedule(state, 4, t);
    // By the exam, or (on the exam's last day) at most the one day the spec's "at least 1" allows.
    assert.ok(Date.parse(next.due_at) <= horizon || Date.parse(next.due_at) - t <= DAY, `review ${i + 1} is due by the exam`);
    if (Date.parse(next.due_at) >= horizon - DAY) break;
    state = { schedule: next.schedule, reps: next.reps, lapses: next.lapses };
    t = Date.parse(next.due_at);
  }
  // Near the exam the longest interval is the days left, at least one.
  assert.equal(horizonDays(Date.parse('2027-05-15T10:00:00+05:30')), 1);
  assert.ok(horizonDays(T0) > 190);
  const late = schedule({ schedule: state.schedule, reps: state.reps, lapses: 0 }, 4, Date.parse('2027-05-10T10:00:00+05:30'));
  assert.ok(Date.parse(late.due_at) <= horizon);
});

test('a lapse is counted when a reviewed card is missed; retrievability is null before the first review', () => {
  const first = schedule(null, 3, T0);
  const second = schedule({ schedule: first.schedule, reps: 1, lapses: 0 }, 3, Date.parse(first.due_at));
  const lapse = schedule({ schedule: second.schedule, reps: 2, lapses: 0 }, 1, Date.parse(second.due_at));
  assert.equal(lapse.lapses, 1);
  assert.equal(retrievability({ schedule: newSchedule(T0), reps: 0 }, T0), null);
  const r = retrievability({ schedule: second.schedule, reps: 2 }, Date.parse(second.due_at));
  assert.ok(r > 0.85 && r < 0.95, `retrievability at the due date is near the 0.9 target (${r})`);
});

test('clientReviewedAt is clamped to the 48 hours before server now and never in the future', () => {
  const now = T0;
  assert.equal(clampClientTime(undefined, now), null);
  assert.equal(clampClientTime('not a date', now), null);
  assert.equal(clampClientTime(new Date(now + 3600_000).toISOString(), now), new Date(now).toISOString());
  assert.equal(clampClientTime(new Date(now - 5 * DAY).toISOString(), now), new Date(now - 2 * DAY).toISOString());
  assert.equal(clampClientTime(new Date(now - 3600_000).toISOString(), now), new Date(now - 3600_000).toISOString());
});

// ---------------------------------------------------------------- the queue

const stateRow = (c, over = {}) => ({ card_id: c.id, subject: c.subject, chapter_key: c.chapterKey, schedule: newSchedule(T0), reps: 0, lapses: 0, due_at: new Date(T0).toISOString(), added_at: new Date(T0).toISOString(), suspended: false, ...over });

test('dueQueue: due first (Must-know, then oldest), then new in book order up to the allowance; skips suspended and unpublished', () => {
  const cards = Array.from({ length: 8 }, (_, i) => card({ chapterKey: 'business_studies.controlling', importance: i === 1 ? 'good' : 'must' }));
  const byId = new Map(cards.map((c) => [c.id, c]));
  const states = [
    stateRow(cards[0], { reps: 2, due_at: new Date(T0 - 2 * DAY).toISOString() }),
    stateRow(cards[1], { reps: 2, due_at: new Date(T0 - 5 * DAY).toISOString() }), // good: after the must card
    stateRow(cards[2], { reps: 2, due_at: new Date(T0 + DAY).toISOString() }), // not due
    stateRow(cards[3], { reps: 2, due_at: new Date(T0 - DAY).toISOString(), suspended: true }),
    stateRow(cards[5]), stateRow(cards[4]), stateRow(cards[6]),
    { ...stateRow(cards[7]), card_id: 'kc.gone.card' }, // no longer published
  ];
  const q = dueQueue(states, byId, { now: T0, isPro: true, newAllowanceLeft: 2, limit: 20 });
  assert.deepEqual(q.items.map((i) => i.card.id), [cards[0].id, cards[1].id, cards[4].id, cards[5].id]);
  assert.equal(q.due, 2);
  assert.equal(q.newShown, 2);
  const free = dueQueue(states, byId, { now: T0, isPro: false, newAllowanceLeft: 99, limit: 20 });
  assert.equal(free.newShown, 3, 'Free never more than its 5 a day, here the 3 that are added');
  assert.equal(dueQueue(states, byId, { now: T0, isPro: true, limit: 1 }).items.length, 1);
});

test('dueQueue: new cards chapter by chapter (the given rank, else subject and chapter key), then book order in the chapter', () => {
  const a = [1, 2, 3].map((i) => card({ chapterKey: 'business_studies.staffing', order: i * 10 }));
  const b = [1, 2, 3].map((i) => card({ chapterKey: 'business_studies.planning', order: i * 10 }));
  const byId = new Map([...a, ...b].map((c) => [c.id, c]));
  const states = [a[0], b[0], a[1], b[1], a[2], b[2]].map((c) => stateRow(c));
  const ids = (q) => q.items.map((i) => i.card.id);
  assert.deepEqual(ids(dueQueue(states, byId, { now: T0, isPro: true })), [...b, ...a].map((c) => c.id), 'no rank: planning < staffing by key, never interleaved');
  const rank = (key) => (key === 'business_studies.staffing' ? 0 : 1);
  assert.deepEqual(ids(dueQueue(states, byId, { now: T0, isPro: true, chapterRank: rank })), [...a, ...b].map((c) => c.id));
});

test('new cards pause while more than 40 are overdue', () => {
  const cards = Array.from({ length: 45 }, () => card({ chapterKey: 'business_studies.marketing-management' }));
  const byId = new Map(cards.map((c) => [c.id, c]));
  const states = cards.map((c, i) => stateRow(c, i < 41 ? { reps: 1, due_at: new Date(T0 - DAY).toISOString() } : {}));
  const q = dueQueue(states, byId, { now: T0, isPro: true, newAllowanceLeft: 15, limit: 100 });
  assert.equal(q.paused, true);
  assert.equal(q.newShown, 0);
  const fewer = dueQueue(states.map((s, i) => (i === 0 ? { ...s, due_at: new Date(T0 + DAY).toISOString() } : s)), byId, { now: T0, isPro: true, newAllowanceLeft: 15, limit: 100 });
  assert.equal(fewer.paused, false);
  assert.equal(fewer.newShown, 4);
  assert.equal(cardMinutes(40), 10);
  assert.equal(cardMinutes(1), 1);
  assert.equal(cardMinutes(0), 0);
});

// ---------------------------------------------------------------- the line you needed, memory

test('lineNeeded: links first, then the lexical match over Must-know cards of the chapter, else none', () => {
  const byId = new Map(FIXTURE.cards.map((c) => [c.id, c]));
  const linked = lineNeeded('q-fixture-1', { 'q-fixture-1': ['kc.business_studies.principles-of-management.def-principles'] }, byId, null);
  assert.equal(linked.source, 'linked');
  assert.equal(linked.cards.length, 1);
  const matched = lineNeeded('q2', {}, byId, {
    chapterKey: 'business_studies.nature-and-significance-of-management',
    text: 'Which statement describes effectiveness in management? It is concerned with doing the right task, completing activities and achieving goals.',
  });
  assert.equal(matched.source, 'matched');
  assert.equal(matched.cards[0].id, 'kc.business_studies.nature-and-significance-of-management.def-effectiveness');
  assert.ok(matched.cards.length <= 2);
  assert.ok(matched.cards.every((c) => c.importance === 'must'));
  const none = lineNeeded('q3', {}, byId, { chapterKey: 'business_studies.nature-and-significance-of-management', text: 'A question about stock exchanges and brokers.' });
  assert.deepEqual(none, { cards: [], source: 'none' });
  assert.equal(lineNeeded('q4', {}, byId, null).source, 'none');
});

test('memoryShare counts added Must-know cards holding at retrievability 0.9 or more', () => {
  const cards = FIXTURE.cards.filter((c) => c.chapterKey === 'business_studies.nature-and-significance-of-management');
  const must = cards.filter((c) => c.importance === 'must');
  const fresh = schedule(null, 4, T0);
  const states = [
    { card_id: must[0].id, reps: 1, schedule: fresh.schedule },
    { card_id: must[1].id, reps: 0, schedule: newSchedule(T0) },
  ];
  assert.deepEqual(memoryShare(states, cards, T0 + 3600_000), { holding: 1, added: 2, mustKnow: must.length });
  assert.deepEqual(memoryShare(states, cards, T0 + 400 * DAY), { holding: 0, added: 2, mustKnow: must.length });
});

// ---------------------------------------------------------------- content checks (scripts/keycards)

test('shape check: the fixture deck passes; broken cards name their reason', () => {
  for (const c of FIXTURE.cards) assert.deepEqual([...shapeCheck(c, 'business_studies'), ...blanksCheck(c)], [], c.id);
  const base = FIXTURE.cards[0];
  assert.ok(shapeCheck({ ...base, id: 'kc.business_studies.nature-and-significance-of-management.Def Bad' }, 'business_studies').includes('shape:id_pattern'));
  assert.ok(shapeCheck({ ...base, back: 'Management is getting things done through others.' }, 'business_studies').includes('shape:back_not_quote'), 'a paraphrased back fails');
  assert.ok(shapeCheck({ ...base, front: 'x'.repeat(200) }, 'business_studies').includes('shape:front_too_long'));
  assert.ok(shapeCheck({ ...base, importance: 'high' }, 'business_studies').includes('shape:importance'));
  assert.ok(shapeCheck({ ...base, quote: '' }, 'business_studies').includes('shape:quote_missing'));
  assert.ok(shapeCheck({ ...base, source: { ...base.source, kind: 'authored' } }, 'business_studies').includes('shape:source_kind'));
  const term = FIXTURE.cards.find((c) => c.kind === 'term');
  assert.ok(shapeCheck({ ...term, blanks: ['Planning'] }, 'business_studies').includes('shape:front_not_quote'));
  assert.equal(fillBlanks('____ is the essence of ____.', ['Coordination', 'management']), 'Coordination is the essence of management.');
});

test('blanks check: in the quote, not a stopword, not shown elsewhere in the front', () => {
  const line = FIXTURE.cards.find((c) => c.kind === 'key_line');
  assert.deepEqual(blanksCheck(line), []);
  assert.ok(blanksCheck({ ...line, blanks: ['the'] }).some((r) => r.endsWith(':stopword')));
  assert.ok(blanksCheck({ ...line, blanks: ['efficiency'] }).some((r) => r.endsWith(':not_in_quote')));
  assert.ok(blanksCheck({ ...line, front: 'Division of work leads to ____ (specialisation).', blanks: ['specialisation'] }).some((r) => r.endsWith(':shown_in_front')));
});

test('duplicate check: same quote and kind, or same front; the first in book order keeps its place', () => {
  const [a, b] = FIXTURE.cards;
  const dupQuote = { ...a, id: `${a.id}-2`, front: 'Another way to ask it?', order: 99 };
  const dupFront = { ...b, id: `${b.id}-2`, quote: 'Something else entirely.', back: 'Something else entirely.', order: 98 };
  const out = duplicateReasons([a, b, dupQuote, dupFront]);
  assert.equal(out.get(a), undefined);
  assert.match(out.get(dupQuote).join(' '), /duplicate:quote/);
  assert.match(out.get(dupFront).join(' '), /duplicate:front/);
});

test('id reuse: a published card renamed to the syllabus chapter and unit keeps its content; a changed back does not', () => {
  const draft = { id: 'kc.business_studies.planning.def-planning', v: 1, chapter: 'Planning (old)', unit: 'Old unit', front: 'What is planning?', back: 'Planning is deciding in advance.', quote: 'Planning is deciding in advance.' };
  assert.equal(sameContent({ ...draft, chapter: 'Planning', unit: 'Unit IV' }, draft), true);
  assert.equal(sameContent({ ...draft, back: 'Planning is thinking ahead.' }, draft), false);
});

test('page offset: majority vote over standalone integers, a stray table number does not move it', () => {
  const pages = ['Title\n', 'text\n2\n', 'text\n3\n', 'table\n1\n0\n10\n4\n', 'text\n5\n'];
  assert.equal(detectOffset(pages), 0);
  assert.equal(detectOffset(['a', 'b\n39\n', 'c\n40\n', 'd\n41\n']), 37);
  assert.equal(detectOffset(['no numbers']), null);
  assert.equal(norm('Manage-\nment  is  “the” process'), 'managementistheprocess');
});

test('shape check: a front that does not stand on its own is quarantined; a term with a capital inside is not', () => {
  for (const front of ['It is the process of ____.', 'This is called ____.', 'Thus the ____ falls.', 'different habitats), one can call this ____.', 'In other words, what is ____?']) {
    assert.equal(danglingStart(front), true, front);
  }
  for (const front of ['Define management.', 'mRNA carries the code from DNA to ____.', 'pH of the soil affects ____.', 'Name the 14 principles of management.', 'Italy joined the ____ in 1957.']) {
    assert.equal(danglingStart(front), false, front);
  }
});

test('quote check: a sentence pdftotext splits across two columns passes when the pdfium extraction has it whole', () => {
  const card = { source: { kind: 'ncert', code: 'keec104', page: 69 }, quote: 'The Tapas Majumdar Committee, appointed by the Government of India in 1999' };
  const split = norm('educational achievements. The Tapas from education cess has been Majumdar Committee, appointed by earmarked for spending');
  const whole = norm('educational achievements. The Tapas Majumdar Committee, appointed by the Government of India in 1999, estimated');
  const base = { offset: 68, page: [split], body: [split], full: split };
  assert.equal(quoteCheck(card, () => ({ ...base, alt: null })), 'quote:not_in_pdf');
  assert.equal(quoteCheck(card, () => ({ ...base, alt: { page: [whole], body: [whole], full: whole } })), null);
  // A quote in neither extraction still fails.
  assert.equal(quoteCheck({ ...card, quote: 'The Kothari Commission met in 1999' }, () => ({ ...base, alt: { page: [whole], body: [whole], full: whole } })), 'quote:not_in_pdf');
});

test('syllabus check and adapter: syllabus v2, retired chapters, the canonical view', () => {
  // The live adapter is syllabus v2 (data/cuet_syllabus.js): retired chapters are named there.
  const live = syllabusFrom(cuetSyllabus);
  assert.equal(live.source, 'v2');
  assert.equal(syllabusCheck(FIXTURE.cards[0], live), null);
  assert.equal(syllabusCheck({ ...FIXTURE.cards[0], chapterKey: 'business_studies.entrepreneurship-development' }, live), 'syllabus:retired:not_in_cuet_2026');
  assert.equal(syllabusCheck({ ...FIXTURE.cards[0], chapterKey: 'business_studies.no-such-chapter' }, live), 'syllabus:unknown_chapter');
  assert.equal(live.resolveChapter('chemistry', 'Solid State').retired, true);
  assert.equal(live.resolveChapter('chemistry', 'Nonsense'), null);
  // The canonical view (syllabusFrom(null)) reads the map syllabus v2 rebuilt: live chapters only for the top subjects.
  const fallback = syllabusFrom(null);
  assert.equal(fallback.source, 'canonical');
  assert.equal(syllabusCheck(FIXTURE.cards[0], fallback), null);
  assert.equal(fallback.resolveChapter('business_studies', 'Nature & Significance of Management').key, 'business_studies.nature-and-significance-of-management');
  assert.equal(fallback.resolveChapter('chemistry', 'Nonsense'), null);
  assert.ok(fallback.unitsFor('business_studies').every((u) => !/Existing/.test(u.unit)));
  assert.deepEqual(fallback.subjectOptions('accountancy').choices.map((c) => c.id), ['AFS', 'CAS']);
  // The v2 module's documented interface is used as it is.
  const v2 = syllabusFrom({
    SYLLABUS_YEAR: 2026,
    SUBJECT_OPTIONS: { mathematics: { label: 'Section', choices: [{ id: 'B1', label: 'B1' }, { id: 'B2', label: 'B2' }], default: 'B1' } },
    CHAPTERS: [
      { key: 'mathematics.matrices', subject: 'mathematics', name: 'Matrices', title: 'Matrices', unit: 'Algebra', section: 'B1', cuetOnly: false, cbseClass11: false, ncert: { book: 'Mathematics Part 1', code: 'lemh103', chapter: 3 } },
      { key: 'mathematics.linear-programming', subject: 'mathematics', name: 'Linear Programming', title: 'Linear Programming', unit: 'LP', section: 'B2', cuetOnly: true },
    ],
    RETIRED_CHAPTERS: { mathematics: { 'Old Thing': 'not_in_cuet_2026' } },
    resolveChapter: (s, name) => (name === 'Matrices' ? { key: 'mathematics.matrices', name, title: name, unit: 'Algebra', section: 'B1', retired: false } : null),
  });
  assert.equal(v2.source, 'v2');
  assert.equal(v2.chapterByKey('mathematics.old-thing').retired, true);
  assert.deepEqual(v2.chaptersFor('mathematics', { option: 'B1' }).map((c) => c.key), ['mathematics.matrices']);
  assert.deepEqual(v2.chaptersFor('mathematics').map((c) => c.key), ['mathematics.matrices', 'mathematics.linear-programming']);
  assert.equal(chipFor(v2.chapterByKey('mathematics.linear-programming')), 'CUET only');
  assert.equal(sectionOpen('A1', 'B2'), true);
  assert.equal(sectionOpen('B1', 'B2'), false);
});

test('validate.mjs and review-merge.mjs on the fixture draft: machine checks, then check 6 decides publication', { skip: !existsSync(path.join(ROOT, '../ncert-books/pdf/lebs101.pdf')) && !process.env.KEYCARDS_NCERT_DIR }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'kc-validate-'));
  try {
    const drafts = path.join(dir, 'drafts');
    const reviews = path.join(dir, 'reviews');
    const out = path.join(dir, 'out');
    mkdirSync(reviews, { recursive: true });
    cpSync(path.join(ROOT, 'data/keycards/fixtures/drafts'), drafts, { recursive: true });
    // One broken card: right words on the wrong page.
    const draft = JSON.parse(readFileSync(path.join(drafts, 'lebs1xx.json'), 'utf8'));
    draft.cards.push({ ...draft.cards[0], id: 'kc.business_studies.nature-and-significance-of-management.def-management-wrong-page', front: 'Define management (wrong page).', source: { ...draft.cards[0].source, page: 20 } });
    writeFileSync(path.join(drafts, 'lebs1xx.json'), JSON.stringify(draft));
    process.env.KEYCARDS_OUT_DIR = out;
    process.env.KEYCARDS_REVIEWS_DIR = reviews;
    const { runValidate } = await import('../../scripts/keycards/validate.mjs');
    const { runReviewMerge } = await import('../../scripts/keycards/review-merge.mjs');
    const quiet = () => {};
    let s = await runValidate({ draftsDir: drafts, log: quiet });
    assert.equal(s.business_studies.published, 0, 'nothing publishes before review');
    assert.equal(s.business_studies.reasons['review:missing'], 6);
    assert.ok(s.business_studies.reasons['quote:wrong_page'] === 1 || s.business_studies.reasons['duplicate:quote'] === 1);
    const verdicts = draft.cards.slice(0, 6).map((c, i) => ({ id: c.id, exact: true, important: i !== 2, unambiguous: true, importanceRight: true, reason: i === 2 ? 'summary aside' : '' }));
    writeFileSync(path.join(reviews, 'lebs1xx.json'), JSON.stringify(verdicts));
    runReviewMerge({ draftsDir: drafts, reviewsDir: reviews, log: quiet });
    s = await runValidate({ draftsDir: drafts, log: quiet });
    assert.equal(s.business_studies.published, 5);
    const deck = JSON.parse(readFileSync(path.join(out, 'decks/business_studies.json'), 'utf8'));
    const manifest = JSON.parse(readFileSync(path.join(out, 'manifest.json'), 'utf8'));
    assert.equal(manifest.business_studies.cards, 5);
    assert.equal(manifest.business_studies.version, deck.version);
    const quarantine = JSON.parse(readFileSync(path.join(out, 'quarantine/business_studies.json'), 'utf8'));
    assert.ok(quarantine.cards.every((c) => c.reasons.length));
    const coverage = JSON.parse(readFileSync(path.join(out, 'coverage/business_studies.json'), 'utf8'));
    assert.equal(coverage.chapters['business_studies.nature-and-significance-of-management'].belowMinimum, true);
    // The loader serves a deck only when its bytes match the manifest.
    const ok = loadDecks({ dir: out, log: quiet });
    assert.equal(ok.bySubject.get('business_studies').cards.length, 5);
    writeFileSync(path.join(out, 'decks/business_studies.json'), JSON.stringify({ ...deck, cards: deck.cards.slice(1) }));
    const logs = [];
    const bad = loadDecks({ dir: out, log: (m) => logs.push(m) });
    assert.equal(bad.bySubject.has('business_studies'), false);
    assert.deepEqual(bad.disabled, [{ subject: 'business_studies', why: 'sha256' }]);
    assert.match(logs[0], /sha256/);
    // Malformed input exits non-zero (throws before writing).
    // A file that is not named by a code (an author's scratch file) is ignored; a malformed draft stops the run.
    writeFileSync(path.join(drafts, 'lebs1xx.scratch.json'), '{not json');
    const logged = [];
    await runValidate({ draftsDir: drafts, dryRun: true, log: (m) => logged.push(m) });
    assert.deepEqual(JSON.parse(logged[0]).ignored, ['lebs1xx.scratch.json']);
    writeFileSync(path.join(drafts, 'lebs199.json'), '{"code":"other","subject":"x","cards":{}}');
    await assert.rejects(runValidate({ draftsDir: drafts, log: quiet }), /malformed drafts/);
  } finally {
    delete process.env.KEYCARDS_OUT_DIR;
    delete process.env.KEYCARDS_REVIEWS_DIR;
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------- Revise: the fifth source

test('Revise queue: Key cards come after everything, keep their own count and take 15 seconds each', () => {
  const kc = FIXTURE.cards.slice(0, 3).map((c) => ({ kind: 'keycard', cardId: c.id, card: c }));
  const base = { questions: [{ questionId: 'q1', dueDay: '2026-11-01', box: 1 }], again: [], checks: [], cards: 2 };
  const without = mergeQueue(base);
  assert.equal('keycards' in without.counts, false, 'the feature off leaves the four-source body exactly as before');
  const withKc = mergeQueue({ ...base, keycards: [...kc, kc[0]] });
  assert.equal(withKc.counts.keycards, 3, 'one per card');
  assert.deepEqual(withKc.items.map((i) => i.kind), ['question', 'card', 'card', 'keycard', 'keycard', 'keycard']);
  assert.equal(withKc.total, 6);
  assert.equal(withKc.minutes, without.minutes + 1);
  assert.equal(itemKey(withKc.items[3]), `kc:${kc[0].cardId}`);
  assert.match(mixLine(withKc.counts), /3 Key cards$/);
  const only = filterSource(withKc, 'keycards');
  assert.equal(only.total, 3);
  assert.equal(only.counts.keycards, 3);
  let run = startRun(withKc.items);
  run = recordAnswer(run, withKc.items[3], { correct: true });
  assert.equal(summary(run).keycards, 1);
  // Review's count (data/review_input.mjs reviseDue) agrees with the queue.
  const due = reviseDue({ revise: { cap: 10, answeredToday: 0, sources: { questions: ['q1'], again: [], checks: [], cards: 2, keycards: 3 } } });
  assert.equal(due.total, withKc.total);
  assert.equal(due.minutes, withKc.minutes);
  assert.match(due.mix, /3 Key cards/);
  const off = reviseDue({ revise: { cap: 10, answeredToday: 0, sources: { questions: ['q1'], again: [], checks: [], cards: 2 } } });
  assert.equal('keycards' in off, false);
});

test('Revise server passes the Key cards source through, and leaves it out when it fails', async () => {
  const { getRevise } = await import('../../src/lib/server/revise.js');
  const db = { from: () => ({ select() { return this; }, eq() { return this; }, not() { return this; }, order() { return this; }, in() { return this; }, limit() { return Promise.resolve({ data: [], error: null }); }, then: (r) => r({ data: [], error: null }) }) };
  const kc = { due: 4, items: FIXTURE.cards.slice(0, 2).map((c) => ({ kind: 'keycard', cardId: c.id, card: c })), minutes: 1 };
  const plain = await getRevise('u1', { db, now: T0, keyCards: async () => kc });
  assert.deepEqual(plain.body.keyCards, { due: 4, today: 2, minutes: 1 });
  const failed = await getRevise('u1', { db, now: T0, keyCards: async () => { throw new Error('x'); } });
  assert.equal('keyCards' in failed.body, false);
  const queued = await getRevise('u1', { db, now: T0, queue: { readKeyCards: async () => kc } });
  assert.equal(queued.body.queue.counts.keycards, 2);
  const noKc = await getRevise('u1', { db, now: T0, queue: {} });
  assert.equal('keycards' in noKc.body.queue.counts, false);
});

// ---------------------------------------------------------------- 180 days

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

test('180 days: a 5-subject Pro student at 10 minutes a day keeps a bounded queue and keeps getting new cards', () => {
  const rand = rng(1031);
  const subjects = ['accountancy', 'business_studies', 'economics', 'english', 'political_science'];
  const deck = [];
  for (const s of subjects) for (let ch = 1; ch <= 12; ch += 1) for (let i = 1; i <= 35; i += 1) {
    deck.push({ id: `kc.${s}.ch${ch}.def-c${i}`, subject: s, chapterKey: `${s}.ch${ch}`, importance: i <= 21 ? 'must' : 'good', order: i * 10, quote: 'x' });
  }
  const byId = new Map(deck.map((c) => [c.id, c]));
  const states = new Map();
  const perDay = Math.floor(10 / KEYCARD_RULES.minutesPerCard); // 40 cards in 10 minutes
  let maxDue = 0;
  const newDays = new Map(); // week -> days with new cards
  let chapterAt = 0;
  for (let day = 0; day < 180; day += 1) {
    const now = T0 + day * DAY;
    // The student adds a chapter (its Must-know set) every second day, round the five subjects.
    if (day % 2 === 0 && chapterAt < 60) {
      const s = subjects[chapterAt % 5];
      const ch = Math.floor(chapterAt / 5) + 1;
      for (const c of chapterAddSet(deck, `${s}.ch${ch}`, { isPro: true })) {
        if (!states.has(c.id)) states.set(c.id, { card_id: c.id, schedule: newSchedule(now), reps: 0, lapses: 0, due_at: new Date(now).toISOString(), added_at: new Date(now + c.order).toISOString(), suspended: false });
      }
      chapterAt += 1;
    }
    const q = dueQueue([...states.values()], byId, { now, isPro: true, newAllowanceLeft: KEYCARD_RULES.pro.newPerDayDefault, limit: perDay });
    maxDue = Math.max(maxDue, q.due);
    if (q.newShown > 0) { const w = Math.floor(day / 7); newDays.set(w, (newDays.get(w) || 0) + 1); }
    for (const { card, state } of q.items) {
      const r = retrievability(state, now);
      const recalled = rand() < (r === null ? 0.75 : r);
      const rating = !recalled ? 1 : rand() < 0.15 ? 4 : 3;
      const next = schedule(state, rating, now);
      states.set(card.id, { ...state, schedule: next.schedule, reps: next.reps, lapses: next.lapses, due_at: next.due_at, last_review_at: new Date(now).toISOString() });
    }
  }
  assert.ok(maxDue <= 60, `never more than 60 due (max ${maxDue})`);
  const weeks = [...Array(Math.floor(180 / 7)).keys()].filter((w) => w * 7 * 1 < 120); // while chapters are still being added
  for (const w of weeks) assert.ok((newDays.get(w) || 0) >= 3, `new cards on at least 3 days of week ${w + 1} (got ${newDays.get(w) || 0})`);
});

test('the IST day is the period of a Free allowance', () => {
  assert.equal(istDay(Date.parse('2026-10-31T19:00:00Z')), '2026-11-01');
  assert.equal(istDay(Date.parse('2026-10-31T18:00:00Z')), '2026-10-31');
});

test('example and fact backs may name the concept on a first short line; the rest must be NCERT\'s words', () => {
  const base = { ...FIXTURE.cards[1], id: 'kc.business_studies.nature-and-significance-of-management.ex-effectiveness', kind: 'example' };
  assert.deepEqual(shapeCheck({ ...base, back: `Effectiveness\n${base.quote}` }, 'business_studies'), []);
  assert.ok(shapeCheck({ ...base, back: 'Effectiveness\nIt means getting the job done.' }, 'business_studies').includes('shape:back_not_quote'));
  assert.ok(shapeCheck({ ...base, kind: 'definition', back: `Effectiveness\n${base.quote}` }, 'business_studies').includes('shape:back_not_quote'), 'a definition back is the quote itself');
});
