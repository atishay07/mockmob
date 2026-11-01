// Tests for scripts/keycards/api-batch.mjs: no network, no key, no real ledger. A fake client object stands in for the SDK and a
// temporary SQLite file for the budget ledger (the real BudgetLedger class), so the reserve / submit / collect / settle path runs
// exactly as it does for real. The drafts and reviews it writes are then fed to validate.mjs and review-merge.mjs unchanged.
//   node --test scripts/keycards/api-batch.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { BudgetLedger } from '../pipeline/lib/budgetLedger.mjs';
import { CHAPTERS, RETIRED_CHAPTERS, resolveChapter } from '../../data/cuet_syllabus.js';
import { NCERT_KINDS, isStopword } from '../../data/keycards.js';
import { loadKeycardsSyllabus } from '../../src/lib/server/keycardsSyllabus.js';
import { cardHash, norm, pdfText } from './lib.mjs';
import { judge, readReviews, runReviewMerge } from './review-merge.mjs';
import { checkSubject, readDrafts, runValidate } from './validate.mjs';
import * as ab from './api-batch.mjs';

// ---------------------------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------------------------

const ENV = ['KEYCARDS_NCERT_DIR', 'KEYCARDS_DRAFTS_DIR', 'KEYCARDS_REVIEWS_DIR', 'KEYCARDS_OUT_DIR', 'KEYCARDS_API_DIR', 'CUET_BUDGET_LEDGER', 'CUET_CONTENT_LIMIT_USD', 'ANTHROPIC_API_KEY', 'ANTHROPIC_API_KEY_FILE'];

const ORIGINAL_ENV = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));

/** Fresh temp folders for the pipeline paths (lib.mjs reads them from the environment on every call); restored after the test. */
function sandbox(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'kc-api-test-'));
  const dirs = { root, pdf: path.join(root, 'pdf'), drafts: path.join(root, 'drafts'), reviews: path.join(root, 'reviews'), out: path.join(root, 'out'), api: path.join(root, 'api'), ledger: path.join(root, 'ledger.sqlite') };
  for (const d of [dirs.pdf, dirs.drafts, dirs.reviews, dirs.out, dirs.api]) mkdirSync(d, { recursive: true });
  Object.assign(process.env, { KEYCARDS_NCERT_DIR: dirs.pdf, KEYCARDS_DRAFTS_DIR: dirs.drafts, KEYCARDS_REVIEWS_DIR: dirs.reviews, KEYCARDS_OUT_DIR: dirs.out, KEYCARDS_API_DIR: dirs.api, CUET_BUDGET_LEDGER: dirs.ledger });
  for (const k of ['CUET_CONTENT_LIMIT_USD', 'ANTHROPIC_API_KEY', 'ANTHROPIC_API_KEY_FILE']) delete process.env[k];
  t.after(() => {
    for (const k of ENV) { if (ORIGINAL_ENV[k] === undefined) delete process.env[k]; else process.env[k] = ORIGINAL_ENV[k]; }
    try { rmSync(root, { recursive: true, force: true }); } catch { /* a locked sqlite file on Windows is not a test failure */ }
  });
  return dirs;
}

/** A ledger file with its history reconciled (the repo's rule before any paid call); returns nothing, closed. */
function makeLedger(file, { limitMicro = null } = {}) {
  const l = new BudgetLedger(file);
  l.reconcileHistory({ spent_usd: 0, basis: 'test fixture with no real spending whatsoever', confirmed_at: new Date().toISOString() });
  if (limitMicro !== null) l.db.prepare('UPDATE budget SET limit_micro=? WHERE id=1').run(limitMicro);
  l.close();
}

function rows(file) {
  const l = new BudgetLedger(file);
  try { return l.db.prepare('SELECT * FROM requests ORDER BY created_at, id').all(); } finally { l.close(); }
}

const touchPdf = (dirs, ...codes) => codes.forEach((c) => writeFileSync(path.join(dirs.pdf, `${c}.pdf`), ''));
const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));

// A tiny Business Studies chapter: printed pages 3 to 5 (offset 2).
const KEY = 'business_studies.nature-and-significance-of-management';
const SENT = {
  koontz: 'Management is the process of designing and maintaining an environment in which individuals, working together in groups, efficiently accomplish selected aims.',
  coord: 'Coordination is the force that binds all the other functions of management.',
  types: 'Objectives can be classified into organisational objectives, social objectives and personal or individual objectives.',
};
const PAGES = [
  `Definitions of Management\n${SENT.koontz}\nChapter 1 • Nature and Significance of Management\n3\nReprint 2026-27`,
  `${SENT.coord}\nObjectives of Management\n${SENT.types}\n4\nBusiness Studies\nReprint 2026-27`,
  'Importance of Management\nManagement helps in achieving group goals.\nChapter 1 • Nature and Significance of Management\n5\nReprint 2026-27',
];
const OFFSET = 2;
const SYLLABUS = 'CUET 2026 Business Studies. Unit I: Nature and Significance of Management. (fixture text)';
const fakePdf = { offset: OFFSET, page: PAGES.map(norm), body: PAGES.map(norm), full: norm(PAGES.join(' ')), alt: null };
const getPdf = (code) => (code === 'lebs101' ? fakePdf : null);

const goodCards = () => [
  { id: `kc.business_studies.nature-and-significance-of-management.def-management-koontz`, v: 1, subject: 'business_studies', chapterKey: KEY, chapter: 'x', unit: 'x', kind: 'definition', quote: SENT.koontz, front: 'Define management (Harold Koontz and Heinz Weihrich).', back: SENT.koontz, blanks: [], source: { kind: 'ncert', book: 'x', code: 'x', chapterNo: 9, page: 3, section: 'Definitions of Management' }, importance: 'must', asked: 0, tags: ['management'], order: 10, note: '' },
  { id: 'kc.business_studies.nature-and-significance-of-management.term-coordination-force', v: 1, subject: 'business_studies', chapterKey: KEY, chapter: 'x', unit: 'x', kind: 'term', quote: SENT.coord, front: '____ is the force that binds all the other functions of management.', back: SENT.coord, blanks: ['Coordination'], source: { kind: 'ncert', book: 'x', code: 'x', chapterNo: 9, page: 4, section: 'Coordination' }, importance: 'good', asked: 0, tags: [], order: 20, note: 'It ties the functions together.' },
  { id: 'kc.business_studies.nature-and-significance-of-management.types-objectives', v: 1, subject: 'business_studies', chapterKey: KEY, chapter: 'x', unit: 'x', kind: 'types', quote: SENT.types, front: 'Types of objectives of management.', back: 'organisational objectives\nsocial objectives\npersonal or individual objectives', blanks: [], source: { kind: 'ncert', book: 'x', code: 'x', chapterNo: 9, page: 4, section: 'Objectives of Management' }, importance: 'good', asked: 0, tags: ['objectives'], order: 30, note: '' },
];
const authorReply = (cards = goodCards()) => ({ code: 'lebs101', subject: 'business_studies', book: 'Business Studies Part 1', chapterNo: 1, cards, coverageNotes: [{ chapterKey: KEY, note: 'Only the three fixture points.' }] });

const USAGE = { input_tokens: 1000, cache_creation_input_tokens: 2000, cache_read_input_tokens: 10000, output_tokens: 500, service_tier: 'batch' };
const succeeded = (custom_id, reply, over = {}) => ({
  custom_id,
  result: { type: 'succeeded', message: { id: `msg_${custom_id}`, type: 'message', role: 'assistant', model: ab.MODEL, content: [{ type: 'thinking', thinking: 'summary', signature: 'sig' }, { type: 'text', text: JSON.stringify(reply) }], stop_reason: 'end_turn', stop_details: null, usage: USAGE, ...over } },
});

/** A stand-in for the SDK client: batches.create keeps the requests, results() answers each through `respond`, shuffled. */
function fakeClient({ respond, statuses = ['ended'], createError = null, shuffle = (a) => [...a].reverse() } = {}) {
  const calls = { create: [], retrieve: 0, results: 0 };
  let sent = [];
  return {
    calls,
    messages: {
      batches: {
        async create(body, opts) {
          calls.create.push({ body, opts });
          if (createError) throw createError;
          sent = body.requests;
          return { id: 'msgbatch_test01', type: 'message_batch', processing_status: 'in_progress', request_counts: { processing: sent.length, succeeded: 0, errored: 0, canceled: 0, expired: 0 } };
        },
        async retrieve(id) {
          const status = statuses[Math.min(calls.retrieve, statuses.length - 1)];
          calls.retrieve += 1;
          return { id, processing_status: status, request_counts: { processing: status === 'ended' ? 0 : sent.length, succeeded: status === 'ended' ? sent.length : 0, errored: 0, canceled: 0, expired: 0 }, created_at: '2026-11-01T10:00:00Z', ended_at: status === 'ended' ? '2026-11-01T10:30:00Z' : null, expires_at: '2026-11-02T10:00:00Z' };
        },
        async results() {
          calls.results += 1;
          const lines = shuffle(sent.map((r) => respond(r)));
          return (async function* gen() { for (const line of lines) yield line; })();
        },
      },
    },
  };
}

/** The dependency bag main() takes, with everything external replaced. */
function deps(dirs, client, extra = {}) {
  const out = [];
  const err = [];
  const sleeps = [];
  return {
    out, err, sleeps,
    log: (...a) => out.push(a.join(' ')),
    err: (...a) => err.push(a.join(' ')),
    err_: err,
    makeClient: () => client,
    openLedger: (f) => ab.openLedger(f ?? dirs.ledger),
    loadChapter: (code) => (code === 'lebs101' ? { pages: PAGES, offset: OFFSET } : { pages: ['Some text.\n1'], offset: 0 }),
    syllabusText: () => SYLLABUS,
    sleep: async (ms) => { sleeps.push(ms); },
    now: () => new Date('2026-11-01T10:00:00Z'),
    preCheck: async (draft) => {
      const { quarantined } = checkSubject(draft.subject, draft.cards, { syllabus: await loadKeycardsSyllabus(), machineOnly: true, getPdf });
      return { cards: draft.cards.length, quarantined: quarantined.length, reasons: Object.fromEntries(quarantined.flatMap((q) => q.reasons).map((r) => [r, 1])) };
    },
    ...extra,
  };
}

const authorRequest = (code = 'lebs101', over = {}) => ab.buildAuthorRequest({ code, pages: PAGES, offset: OFFSET, syllabusText: SYLLABUS, ...over });

// A JSON-schema walk for the structured-output subset the API accepts.
function checkSchema(node, where = 'schema') {
  const bad = ['minLength', 'maxLength', 'minimum', 'maximum', 'multipleOf', 'pattern', 'minItems', 'maxItems', 'oneOf', '$ref', 'format'];
  for (const k of bad) assert.ok(!(k in node), `${where}: unsupported keyword ${k}`);
  if (node.type === 'object') {
    assert.equal(node.additionalProperties, false, `${where}: object must be closed`);
    assert.deepEqual([...(node.required ?? [])].sort(), Object.keys(node.properties).sort(), `${where}: every property required`);
    for (const [k, v] of Object.entries(node.properties)) checkSchema(v, `${where}.${k}`);
  } else if (node.type === 'array') checkSchema(node.items, `${where}[]`);
  else if (node.enum) assert.ok(node.enum.every((v) => ['string', 'number', 'boolean'].includes(typeof v)), `${where}: simple enums only`);
}

// ---------------------------------------------------------------------------------------------------------------
// Book codes, syllabus, chapter numbers
// ---------------------------------------------------------------------------------------------------------------

test('bookSubject: every prefix maps to its subject and CUET section option', () => {
  const table = {
    leph: ['physics', null], lech: ['chemistry', null], lemh: ['mathematics', 'B1'], lehs: ['history', null], legy: ['geography', null],
    lepy: ['psychology', null], lesy: ['sociology', null], lecs: ['computer_science', 'B1'], leip: ['computer_science', 'B2'], lebo: ['biology', null],
    leps: ['political_science', null], lebs: ['business_studies', null], leac: ['accountancy', null], leec: ['economics', null], keec: ['economics', null],
  };
  assert.deepEqual(Object.keys(ab.BOOK_FAMILIES).sort(), Object.keys(table).sort(), 'no prefix is missing or extra');
  for (const [prefix, [subject, option]] of Object.entries(table)) {
    for (const form of [prefix, `${prefix}1`, `${prefix}2`, `${prefix}101`]) {
      const got = ab.bookSubject(form);
      assert.equal(got.subject, subject, form);
      assert.equal(got.option, option, form);
      assert.equal(got.family, prefix);
    }
  }
  assert.equal(ab.bookSubject('leec2').bookCode, 'leec2');
  assert.equal(ab.bookSubject('leec').bookCode, null);
  for (const bad of ['xxxx', 'leph10', 'leph1011', '', undefined, 'LEPH1x', 'enligsh']) assert.throws(() => ab.bookSubject(bad), /unknown NCERT book code/, String(bad));
});

test('allowed chapters come from cuet_syllabus: retired chapters are out and the B1 / B2 options filter their sections', () => {
  const retired = new Set(Object.entries(RETIRED_CHAPTERS).flatMap(([subject, names]) => Object.keys(names).map((n) => `${subject}:${n}`)));
  for (const [prefix, fam] of Object.entries(ab.BOOK_FAMILIES)) {
    const list = ab.allowedChapters(fam.subject, fam.option);
    assert.ok(list.length > 0, prefix);
    assert.equal(new Set(list.map((c) => c.key)).size, list.length, `${prefix}: keys are unique`);
    for (const c of list) {
      assert.ok(!retired.has(`${c.subject}:${c.name}`), `${c.key} is retired`);
      assert.equal(resolveChapter(c.subject, c.name)?.key, c.key, `${c.key} resolves to itself`);
      assert.equal(c.key.startsWith(`${fam.subject}.`), true);
    }
  }
  const names = (s, o) => ab.allowedChapters(s, o).map((c) => c.name);
  // chemistry: the retired chapters are not offered
  for (const gone of ['Solid State', 'Surface Chemistry', 'p-Block Elements', 'Polymers']) assert.ok(!names('chemistry', null).includes(gone), gone);
  assert.ok(names('chemistry', null).includes('Solutions'));
  // mathematics B1 keeps the common section A1 and drops B2
  assert.ok(names('mathematics', 'B1').includes('Matrices') && names('mathematics', 'B1').includes('Probability'));
  for (const b2 of ['Time Based Data', 'Inferential Statistics', 'Financial Mathematics', 'Numbers, Quantification and Numerical Applications']) assert.ok(!names('mathematics', 'B1').includes(b2), b2);
  // computer science: Section A in both, then B1 or B2 only
  assert.ok(['Database Concepts', 'Structured Query Language', 'Computer Networks'].every((n) => names('computer_science', 'B1').includes(n) && names('computer_science', 'B2').includes(n)));
  assert.ok(names('computer_science', 'B1').includes('Stack') && !names('computer_science', 'B1').includes('Societal Impacts'));
  assert.ok(names('computer_science', 'B2').includes('Societal Impacts') && !names('computer_science', 'B2').includes('Stack'));
  // economics: all three courses, one subject
  assert.ok(['Production & Costs', 'Money & Banking', 'Rural Development'].every((n) => names('economics', null).includes(n)));
});

test('describeCode: printed chapter number, book and the syllabus chapters that point at the PDF', () => {
  assert.deepEqual(['lebs101', 'lebs108', 'lebs201', 'lebs203', 'lemh201', 'lemh101', 'leph201', 'lech201'].map((c) => ab.describeCode(c).chapterNo), [1, 8, 9, 11, 7, 1, 9, 6]);
  const bs = ab.describeCode('lebs101');
  assert.equal(bs.book, 'Business Studies Part 1');
  assert.equal(bs.title, 'Nature and Significance of Management');
  assert.deepEqual(bs.primaryKeys, [KEY]);
  // a span: Microeconomics ch 1 has no file of its own in the syllabus table but belongs to the chapter spanning 1-2
  assert.deepEqual(ab.describeCode('leec201').primaryKeys, ['economics.introduction-and-theory-of-consumer-behaviour']);
  assert.equal(ab.describeCode('leec201').title, null);
  // two syllabus chapters read from one NCERT chapter
  assert.equal(ab.describeCode('leps208').primaryKeys.length, 2);
  // a PDF nothing points at
  assert.deepEqual(ab.describeCode('lecs113').primaryKeys, []);
  assert.throws(() => ab.describeCode('lebs1'), /not a chapter code/);
  // every book's first chapter number is the same for all of its chapters (the derivation relies on it)
  const firsts = new Map();
  for (const c of CHAPTERS) if (c.ncert?.code) firsts.set(c.ncert.code.slice(0, 5), new Set([...(firsts.get(c.ncert.code.slice(0, 5)) ?? []), c.ncert.chapter - Number(c.ncert.code.slice(5)) + 1]));
  for (const [book, set] of firsts) assert.equal(set.size, 1, book);
});

// ---------------------------------------------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------------------------------------------

test('buildAuthorRequest: the request shape the API takes, with the brief\'s parameters and nothing it forbids', () => {
  const r = authorRequest();
  assert.equal(r.custom_id, 'author-lebs101');
  assert.match(r.custom_id, /^[A-Za-z0-9_-]{1,64}$/);
  const p = r.params;
  assert.equal(p.model, 'claude-opus-5-5');
  assert.equal(p.max_tokens, 32000);
  assert.deepEqual(p.thinking, { type: 'adaptive' });
  assert.equal(p.output_config.effort, 'high');
  assert.equal(p.output_config.format.type, 'json_schema');
  for (const forbidden of ['temperature', 'top_p', 'top_k', 'stream']) assert.ok(!(forbidden in p), forbidden);
  assert.ok(!JSON.stringify(p).includes('"disabled"'), 'thinking is never disabled');
  assert.ok(!JSON.stringify(p).includes('prefill'));
  // the last message is the user's: no assistant prefill
  assert.deepEqual(p.messages.map((m) => m.role), ['user']);
  // system: one cached text block; user: the subject block (cached) then the chapter block
  assert.equal(p.system.length, 1);
  assert.deepEqual(p.system[0].cache_control, { type: 'ephemeral' });
  const [subject, chapter] = p.messages[0].content;
  assert.deepEqual(subject.cache_control, { type: 'ephemeral' });
  assert.equal(chapter.cache_control, undefined);
  assert.match(subject.text, /SUBJECT: Business Studies/);
  assert.ok(subject.text.includes(SYLLABUS));
  assert.ok(subject.text.includes(`chapterKey: ${KEY} | chapter: Nature & Significance of Management | unit: Nature and Significance of Management`));
  assert.ok(!subject.text.includes('Entrepreneurship Development'), 'a retired chapter is not offered');
  // the chapter text carries a marker per PDF page with the PRINTED number (page index + offset)
  assert.match(chapter.text, /code: lebs101\nbook: Business Studies Part 1\nchapter number: 1\nchapter title: Nature and Significance of Management/);
  const markers = [...chapter.text.matchAll(/\[\[PRINTED PAGE (\d+)\]\]/g)].map((m) => Number(m[1]));
  assert.deepEqual(markers, [3, 4, 5]);
  assert.ok(chapter.text.indexOf('[[PRINTED PAGE 3]]') < chapter.text.indexOf(SENT.koontz));
  assert.ok(chapter.text.indexOf(SENT.coord) > chapter.text.indexOf('[[PRINTED PAGE 4]]'));
  assert.match(chapter.text, /allowed chapters that name this PDF as their NCERT chapter: business_studies\.nature-and-significance-of-management/);
  assert.equal(r.meta.kind, 'author');
  assert.deepEqual([r.meta.code, r.meta.subject, r.meta.option, r.meta.chapterNo], ['lebs101', 'business_studies', null, 1]);
});

test('a page without a printed number is marked "do not cite"', () => {
  assert.equal(ab.pageMarker(7), '[[PRINTED PAGE 7]]');
  assert.match(ab.pageMarker(0), /NO PRINTED PAGE NUMBER/);
  const block = ab.chapterBlockText({ info: ab.describeCode('lebs101'), pages: ['cover', 'one', 'two'], offset: -1 });
  assert.deepEqual([...block.matchAll(/^\[\[(.+?)\]\]$/gm)].map((m) => m[1]), ['NO PRINTED PAGE NUMBER: do not cite', 'PRINTED PAGE 1', 'PRINTED PAGE 2']);
});

test('the system prefix is byte-identical across requests of any subject, and so is the subject block within a subject', () => {
  const a = authorRequest('lebs101');
  const b = authorRequest('lebs102');
  const other = ab.buildAuthorRequest({ code: 'lepy101', pages: PAGES, offset: 0, syllabusText: 'psychology fixture' });
  assert.equal(JSON.stringify(a.params.system), JSON.stringify(b.params.system));
  assert.equal(JSON.stringify(a.params.system), JSON.stringify(other.params.system), 'one system prompt for every subject');
  assert.equal(JSON.stringify(a.params.messages[0].content[0]), JSON.stringify(b.params.messages[0].content[0]), 'same subject, same cached subject block');
  assert.notEqual(a.params.messages[0].content[0].text, other.params.messages[0].content[0].text);
  // nothing per-request or time-dependent in the cached parts
  const text = a.params.system[0].text + a.params.messages[0].content[0].text;
  assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text), 'no timestamp in a cached part');
  assert.ok(!text.includes('PRINTED PAGE 3'));
  // a review request's system text is the same for every review, whatever the draft
  const cards = goodCards();
  const r1 = ab.buildReviewRequest({ code: 'lebs101', pages: PAGES, offset: OFFSET, syllabusText: SYLLABUS, cards: cards.slice(0, 1) });
  const r2 = ab.buildReviewRequest({ code: 'lebs102', pages: PAGES, offset: OFFSET, syllabusText: SYLLABUS, cards: cards.slice(1) });
  assert.equal(JSON.stringify(r1.params.system), JSON.stringify(r2.params.system));
  assert.notEqual(r1.params.system[0].text, a.params.system[0].text);
});

test('the author output schema is the draft shape: closed objects, every field required, only keywords the API takes', () => {
  const schema = ab.authorSchema(ab.describeCode('lebs101'));
  checkSchema(schema);
  assert.deepEqual(Object.keys(schema.properties), ['code', 'subject', 'book', 'chapterNo', 'cards', 'coverageNotes']);
  const card = schema.properties.cards.items;
  assert.deepEqual(Object.keys(card.properties).sort(), ['id', 'v', 'subject', 'chapterKey', 'chapter', 'unit', 'kind', 'front', 'back', 'quote', 'blanks', 'source', 'importance', 'asked', 'tags', 'order', 'note'].sort());
  assert.deepEqual(Object.keys(card.properties.source.properties), ['kind', 'book', 'code', 'chapterNo', 'page', 'section']);
  assert.deepEqual(card.properties.kind.enum, [...NCERT_KINDS]);
  assert.deepEqual(card.properties.chapterKey.enum, ab.allowedChapters('business_studies').map((c) => c.key));
  assert.deepEqual(card.properties.importance.enum, ['must', 'good']);
  assert.deepEqual([schema.properties.code.enum, schema.properties.chapterNo.enum, card.properties.v.enum, card.properties.asked.enum], [['lebs101'], [1], [1], [0]]);
  // a different subject and option get their own chapter enum
  const cs = ab.authorSchema(ab.describeCode('leip103'));
  assert.ok(cs.properties.cards.items.properties.chapterKey.enum.includes('computer_science.societal-impacts'));
  assert.ok(!cs.properties.cards.items.properties.chapterKey.enum.includes('computer_science.stack'));
  const review = ab.reviewSchema();
  checkSchema(review);
  assert.deepEqual(Object.keys(review.properties.reviews.items.properties), ['id', 'exact', 'important', 'unambiguous', 'importanceRight', 'reason']);
});

test('buildReviewRequest: cards as JSON lines after the cached chapter text, ids and content hashes kept in the meta', () => {
  const cards = goodCards();
  const r = ab.buildReviewRequest({ code: 'lebs101', pages: PAGES, offset: OFFSET, syllabusText: SYLLABUS, cards, chunk: 2, chunks: 3 });
  assert.equal(r.custom_id, 'review-lebs101-2');
  assert.match(r.custom_id, /^[A-Za-z0-9_-]{1,64}$/);
  assert.equal(r.params.max_tokens, 16000);
  assert.equal(r.params.output_config.effort, 'high');
  assert.deepEqual(r.params.thinking, { type: 'adaptive' });
  const [subject, chapter, list] = r.params.messages[0].content;
  assert.deepEqual([subject.cache_control, chapter.cache_control, list.cache_control], [{ type: 'ephemeral' }, { type: 'ephemeral' }, undefined]);
  assert.match(list.text, /part 2 of 3: 3 cards/);
  const lines = list.text.split('\n').filter((l) => l.startsWith('{'));
  assert.deepEqual(lines.map((l) => JSON.parse(l).id), cards.map((c) => c.id));
  const first = JSON.parse(lines[0]);
  assert.deepEqual(Object.keys(first), ['id', 'kind', 'chapterKey', 'page', 'section', 'importance', 'front', 'back', 'quote']);
  assert.equal(JSON.parse(lines[1]).blanks[0], 'Coordination');
  assert.equal(JSON.parse(lines[1]).note, 'It ties the functions together.');
  assert.deepEqual(r.meta.cardIds, cards.map((c) => c.id));
  assert.equal(r.meta.cardHashes[cards[0].id], cardHash(cards[0]));
  // the reviewer is never told how the author reasoned: no author-side fields in the card lines
  assert.ok(!list.text.includes('"tags"') && !list.text.includes('"order"') && !list.text.includes('"asked"'));
});

test('chunkCards: drafts of 50 or fewer cards are one request, longer ones are split evenly', () => {
  const make = (n) => Array.from({ length: n }, (_, i) => ({ id: `c${i}` }));
  assert.deepEqual(ab.chunkCards(make(50)).map((p) => p.length), [50]);
  assert.deepEqual(ab.chunkCards(make(51)).map((p) => p.length), [26, 25]);
  assert.deepEqual(ab.chunkCards(make(192)).map((p) => p.length), [48, 48, 48, 48]);
  assert.deepEqual(ab.chunkCards(make(3), 5).map((p) => p.length), [3]);
  assert.deepEqual(ab.chunkCards(make(0)), []);
  assert.equal(ab.chunkCards(make(192)).flat().length, 192);
});

// ---------------------------------------------------------------------------------------------------------------
// The prompts carry the spec
// ---------------------------------------------------------------------------------------------------------------

test('the author prompt carries spec sections 2 to 5 word for word, with only the importance rule replaced', () => {
  const spec = readFileSync(new URL('../../docs/brain/intel-1031/KEYCARDS-CONTENT-SPEC.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const parts = ab.specParts(spec);
  const system = ab.buildAuthorSystem();
  assert.ok(system.includes(parts.kinds) && system.includes(parts.howMany) && system.includes(parts.checks) && system.includes(parts.record));
  assert.ok(spec.includes(parts.kinds) && spec.includes(parts.howMany) && spec.includes(parts.checks));
  // every line of the card-record section is the spec's own, apart from the replaced importance rule
  for (const line of parts.record.split('\n')) assert.ok(spec.includes(line) || ab.IMPORTANCE_OVERRIDE.includes(line), `not in the spec: ${line}`);
  for (const kind of NCERT_KINDS) assert.ok(system.includes(`| \`${kind}\` |`), kind);
  for (const rule of ['`quote` is the exact NCERT text the card rests on.', 'Paraphrase is allowed in exactly one place', 'The id is stable', 'A blank must\n  have exactly one right answer given the line.']) assert.ok(system.includes(rule), rule);
  assert.ok(!system.includes('Aim for about 60%') && system.includes('about 25% of a chapter'));
  assert.ok(!system.includes('English deck'), 'the English paragraph does not belong to NCERT chapters');
  assert.ok(system.includes('that language is what fetches them marks'));
  // a spec that lost its importance rule is refused rather than silently sent
  assert.throws(() => ab.specParts(spec.replace(/- \*\*`importance`:\*\*/, '- **`weight`:**')), /importance rule/);
  assert.throws(() => ab.specParts(spec.replace('## 4. How many cards', '## four')), /no "## 4\." section/);
  // the review prompt asks the four questions and carries the same card rules
  const review = ab.buildReviewSystem();
  for (const q of ['exact', 'important', 'unambiguous', 'importanceRight']) assert.match(review, new RegExp(`- ${q}:`));
  assert.ok(review.includes(parts.kinds) && review.includes('When unsure, set the flag false'));
  assert.match(review, /CHAPTER:/);
});

test('the stopword list in the prompt is the validator\'s', () => {
  for (const w of ab.STOPWORD_LIST) assert.ok(isStopword(w), w);
  for (const w of ['management', 'coordination', '250', 'planning']) assert.ok(!ab.STOPWORD_LIST.includes(w) && !isStopword(w), w);
  assert.ok(ab.buildAuthorSystem().includes(ab.STOPWORD_LIST.join(' ')));
});

// ---------------------------------------------------------------------------------------------------------------
// Cost
// ---------------------------------------------------------------------------------------------------------------

test('cost math: estimate, reservation, usage and the batch discount', () => {
  const req = (chars, max) => ({ custom_id: 'x', params: { max_tokens: max, system: [{ type: 'text', text: 'a'.repeat(chars) }], messages: [{ role: 'user', content: [{ type: 'text', text: '' }] }], output_config: { format: { schema: {} } } } });
  // 3200 characters + the 2-character schema "{}" = 3202 -> ceil(3202 / 3.2) = 1001 tokens
  assert.equal(ab.estimateInputTokens(req(3200, 1000).params), 1001);
  const est = ab.estimateCost([req(3200, 1000), req(6400, 2000)]);
  assert.equal(est.requests, 2);
  assert.equal(est.inputTokens, 1001 + 2001);
  assert.equal(est.maxOutputTokens, 3000);
  assert.equal(est.reserveMicro, 3002 * 4 + 3000 * 20, 'standard price, estimated input, every reply at max_tokens');
  assert.equal(est.batchMaxMicro, est.reserveMicro / 2);
  assert.equal(est.batchLikelyMicro, Math.ceil((3002 * 4 + 1200 * 20) / 2));
  assert.ok(est.batchLikelyMicro < est.batchMaxMicro && est.batchMaxMicro < est.reserveMicro);
  assert.ok(Number.isSafeInteger(est.reserveMicro));
  // usage: (input + 1.25 x cache writes + 0.1 x cache reads) at USD 4, output at USD 20, all x 0.5
  assert.equal(ab.usageCostMicro(USAGE), ((1000 + 2500 + 1000) * 4 + 500 * 20) * 0.5);
  assert.equal(ab.usageCostMicro(USAGE, { batch: false }), (1000 + 2500 + 1000) * 4 + 500 * 20);
  assert.equal(ab.usageCostMicro({ input_tokens: 10, output_tokens: 10, cache_creation_input_tokens: null, cache_read_input_tokens: null }), (10 * 4 + 10 * 20) / 2);
  assert.equal(ab.usageCostMicro(null), 0);
  assert.equal(ab.usd(14000), '$0.014');
  assert.equal(ab.usd(5230000), '$5.23');
  // a real request: the conservative reservation is far above what the batch can bill
  const real = ab.estimateCost([authorRequest()]);
  assert.ok(real.reserveMicro >= 2 * real.batchMaxMicro - 1 && real.reserveMicro > 32000 * 20);
});

// ---------------------------------------------------------------------------------------------------------------
// Reading results
// ---------------------------------------------------------------------------------------------------------------

test('parseResult (author): the draft file shape, constants set by the script, ids and notes made safe', () => {
  const meta = authorRequest().meta;
  const messy = goodCards();
  messy[0].id = 'Bad Id!';
  messy[1].id = messy[2].id; // a duplicate id inside one reply
  messy[1].note = 'n'.repeat(400);
  messy[1].front = `[[PRINTED PAGE 4]] ${messy[1].front}`;
  messy[2].chapter = 'wrong name';
  messy[2].unit = 'wrong unit';
  messy[2].v = 9;
  messy[2].asked = 5;
  messy[2].source = { ...messy[2].source, book: 'other', code: 'other', chapterNo: 99, kind: 'x' };
  messy[2].importance = 'maybe';
  const out = ab.parseResult(succeeded('author-lebs101', authorReply(messy)), meta);
  assert.equal(out.ok, true, out.reason);
  const draft = out.value;
  assert.deepEqual(Object.keys(draft), ['code', 'subject', 'book', 'chapterNo', 'cards', 'coverageNotes']);
  assert.deepEqual([draft.code, draft.subject, draft.book, draft.chapterNo], ['lebs101', 'business_studies', 'Business Studies Part 1', 1]);
  assert.deepEqual(draft.coverageNotes, { [KEY]: 'Only the three fixture points.' });
  const [c0, c1, c2] = draft.cards;
  assert.deepEqual(Object.keys(c0), ['id', 'v', 'subject', 'chapterKey', 'chapter', 'unit', 'kind', 'front', 'back', 'quote', 'blanks', 'source', 'importance', 'asked', 'tags', 'order']);
  assert.equal(c0.id, 'kc.business_studies.nature-and-significance-of-management.def-bad-id', 'a malformed id is rebuilt from its words');
  assert.equal(new Set(draft.cards.map((c) => c.id)).size, 3, 'ids are unique');
  assert.equal(c1.id, 'kc.business_studies.nature-and-significance-of-management.types-objectives');
  assert.equal(c2.id, 'kc.business_studies.nature-and-significance-of-management.types-objectives-2', 'the second card of a repeated id is renamed');
  assert.equal(c1.note, undefined, 'a note over the limit is dropped, not the card');
  assert.ok(out.warnings.some((w) => /note of 400/.test(w)));
  assert.equal(c1.front, '____ is the force that binds all the other functions of management.', 'a copied page marker is removed');
  assert.deepEqual([c2.chapter, c2.unit], ['Nature & Significance of Management', 'Nature and Significance of Management'], 'chapter and unit come from the syllabus');
  assert.deepEqual([c2.v, c2.asked, c2.importance], [1, 0, 'good']);
  assert.deepEqual(c2.source, { kind: 'ncert', book: 'Business Studies Part 1', code: 'lebs101', chapterNo: 1, page: 4, section: 'Objectives of Management' });
  assert.equal(c0.note, undefined, 'an empty note is left out as the existing drafts do');
  assert.equal(draft.cards[1].blanks[0], 'Coordination');
  // the words of a card are never touched
  assert.equal(c0.quote, SENT.koontz);
  assert.equal(c2.back, 'organisational objectives\nsocial objectives\npersonal or individual objectives');
  assert.ok(Math.ceil(out.costMicro) === ((1000 + 2500 + 1000) * 4 + 500 * 20) / 2);
  // an empty reply is a valid draft (an off-syllabus PDF); no coverage notes means no key
  const empty = ab.parseResult(succeeded('author-lebs101', { ...authorReply([]), coverageNotes: [] }), meta);
  assert.equal(empty.ok, true);
  assert.deepEqual(empty.value.cards, []);
  assert.equal('coverageNotes' in empty.value, false);
  // a card with a chapterKey the syllabus does not know is kept (validate.mjs quarantines it) and reported
  const odd = ab.parseResult(succeeded('author-lebs101', authorReply([{ ...goodCards()[0], chapterKey: 'business_studies.nope' }])), meta);
  assert.equal(odd.value.cards[0].chapterKey, 'business_studies.nope');
  assert.ok(odd.warnings.some((w) => /not an allowed chapter/.test(w)));
});

test('parseResult (review): verdicts keyed by id, in the order asked, with the missing and the extra reported', () => {
  const cards = goodCards();
  const meta = ab.buildReviewRequest({ code: 'lebs101', pages: PAGES, offset: OFFSET, syllabusText: SYLLABUS, cards }).meta;
  const v = (id, over = {}) => ({ id, exact: true, important: true, unambiguous: true, importanceRight: true, reason: '', ...over });
  const reply = { reviews: [v(cards[2].id, { importanceRight: false, reason: 'Minor line.' }), v('kc.ghost.id'), v(cards[0].id), v(cards[2].id, { exact: false, reason: '' })] };
  const out = ab.parseResult(succeeded('review-lebs101-1', reply), meta);
  assert.equal(out.ok, true);
  assert.deepEqual(out.value.map((e) => e.id), [cards[0].id, cards[2].id], 'asked order, one entry per id');
  assert.deepEqual(Object.keys(out.value[0]), ['id', 'exact', 'important', 'unambiguous', 'importanceRight', 'reason']);
  assert.deepEqual(out.value[1], { id: cards[2].id, exact: false, important: true, unambiguous: true, importanceRight: false, reason: 'Minor line.' }, 'two answers: the stricter wins');
  assert.deepEqual(out.missing, [cards[1].id]);
  assert.deepEqual(out.extra, ['kc.ghost.id']);
  // a "no" with no reason still gets one the quarantine record can show; booleans only
  const silent = ab.parseResult(succeeded('review-lebs101-1', { reviews: [v(cards[0].id, { exact: 'yes', reason: '' })] }), meta);
  assert.equal(silent.value[0].exact, false);
  assert.equal(silent.value[0].reason, 'reviewer gave no reason');
  assert.equal(judge(silent.value[0]).ok, false);
});

test('results that did not succeed, hit max_tokens or were refused are failures with a reason (and still cost their usage)', () => {
  const meta = authorRequest().meta;
  const lineWith = (over) => succeeded('author-lebs101', authorReply(), over);
  const max = ab.parseResult(lineWith({ stop_reason: 'max_tokens' }), meta);
  assert.deepEqual([max.ok, max.reason], [false, 'max_tokens']);
  assert.equal(max.costMicro, 14000, 'a truncated reply is billed');
  const refusal = ab.parseResult(lineWith({ stop_reason: 'refusal', stop_details: { type: 'refusal', category: 'cyber', explanation: 'policy' } }), meta);
  assert.deepEqual([refusal.ok, refusal.reason], [false, 'refusal']);
  assert.match(refusal.detail, /"category":"cyber"/);
  assert.equal(ab.parseResult(lineWith({ stop_reason: 'refusal', stop_details: null }), meta).detail, 'refused');
  assert.equal(ab.parseResult(lineWith({ stop_reason: 'pause_turn' }), meta).reason, 'stop_reason:pause_turn');
  const errored = ab.parseResult({ custom_id: 'author-lebs101', result: { type: 'errored', error: { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' }, request_id: 'req_1' } } }, meta);
  assert.deepEqual([errored.ok, errored.reason, errored.detail, errored.usage, errored.costMicro], [false, 'errored', 'overloaded_error: Overloaded', null, 0]);
  for (const type of ['expired', 'canceled']) {
    const o = ab.parseResult({ custom_id: 'author-lebs101', result: { type } }, meta);
    assert.deepEqual([o.ok, o.reason, o.costMicro], [false, type, 0]);
  }
  assert.equal(ab.parseResult({ custom_id: 'author-lebs101' }, meta).reason, 'no_result');
  const noText = ab.parseResult(lineWith({ content: [{ type: 'thinking', thinking: 'x' }] }), meta);
  assert.equal(noText.reason, 'no_text');
  const bad = ab.parseResult(lineWith({ content: [{ type: 'text', text: '{"cards": [' }] }), meta);
  assert.equal(bad.reason, 'bad_json');
  const shape = ab.parseResult(lineWith({ content: [{ type: 'text', text: '{"nothing": 1}' }] }), meta);
  assert.equal(shape.reason, 'bad_shape');
  // only text blocks are read: thinking before the JSON is ignored
  assert.equal(ab.parseResult(lineWith({}), meta).ok, true);
});

test('collectOutcomes matches results to requests by custom_id, whatever order the file is in', () => {
  const codes = ['lebs101', 'lebs102', 'lebs103', 'lebs104'];
  const reqs = codes.map((c) => authorRequest(c));
  const metas = reqs.map((r) => r.meta);
  const lines = reqs.map((r) => succeeded(r.custom_id, { ...authorReply([]), coverageNotes: [{ chapterKey: KEY, note: `note for ${r.meta.code}` }] }));
  const orders = [[0, 1, 2, 3], [3, 2, 1, 0], [2, 0, 3, 1], [1, 3, 0, 2]];
  const seen = orders.map((order) => {
    const { outcomes, unknown, missing } = ab.collectOutcomes(order.map((i) => lines[i]), metas);
    assert.deepEqual([unknown, missing], [[], []]);
    for (const m of metas) {
      const o = outcomes.get(m.custom_id);
      assert.equal(o.code, m.code);
      assert.equal(o.value.code, m.code);
      assert.equal(o.value.coverageNotes[KEY], `note for ${m.code}`, 'the result of another request never lands here');
    }
    return JSON.stringify([...outcomes.keys()].sort().map((k) => outcomes.get(k).value));
  });
  assert.equal(new Set(seen).size, 1, 'the same outcomes in every order');
  // a stranger, a missing line and a repeated line
  const { outcomes, unknown, missing } = ab.collectOutcomes([lines[1], succeeded('author-zzzz999', authorReply([])), lines[1], lines[0]], metas);
  assert.deepEqual(unknown, ['author-zzzz999']);
  assert.deepEqual(missing, ['author-lebs103', 'author-lebs104']);
  assert.equal(outcomes.size, 2);
});

// ---------------------------------------------------------------------------------------------------------------
// Key, command line, codes
// ---------------------------------------------------------------------------------------------------------------

test('resolveApiKey: the environment first, then the key file; the message names places, never the key', () => {
  assert.equal(ab.resolveApiKey({ env: { ANTHROPIC_API_KEY: '  sk-env-1  ' }, readFile: () => assert.fail('the file is not read') }), 'sk-env-1');
  assert.equal(ab.resolveApiKey({ env: {}, readFile: (f) => { assert.match(f, /anthropic-api-key\.txt$/); return '  sk-file-2 \r\nignored second line\n'; } }), 'sk-file-2');
  assert.equal(ab.resolveApiKey({ env: { ANTHROPIC_API_KEY_FILE: '/elsewhere/key' }, readFile: (f) => { assert.equal(f, '/elsewhere/key'); return 'sk-3'; } }), 'sk-3');
  for (const readFile of [() => { throw new Error('ENOENT'); }, () => '  \n']) {
    assert.throws(() => ab.resolveApiKey({ env: { ANTHROPIC_API_KEY: ' ' }, readFile }), (e) => /no Anthropic API key: set ANTHROPIC_API_KEY, or put the key on the first line of .*anthropic-api-key\.txt/.test(e.message));
  }
  assert.match(ab.DEFAULT_KEY_FILE.replace(/\\/g, '/'), /MockMob-keys\/anthropic-api-key\.txt$/);
});

test('parseArgs: strict flags (a typo must never start a paid run) and the right arguments per command', () => {
  assert.deepEqual(ab.parseArgs(['author', '--books=leph1,lech2', '--codes=leph101', '--dry-run']), { command: 'author', books: ['leph1', 'lech2'], codes: ['leph101'], dryRun: true, force: false, chunk: null, batchId: null });
  assert.equal(ab.parseArgs(['review', '--codes=leph101,leph102', '--force', '--chunk=20']).chunk, 20);
  assert.equal(ab.parseArgs(['collect', 'msgbatch_abc']).batchId, 'msgbatch_abc');
  assert.equal(ab.parseArgs(['status', 'msgbatch_abc']).command, 'status');
  for (const bad of [[], ['publish'], ['author', '--dryrun'], ['author', '--dry_run'], ['author', '--book=leph1'], ['author', 'leph1'], ['review', '--chunk=2'], ['review', '--chunk=x'], ['author', '--chunk=20'], ['collect'], ['collect', 'a', 'b'], ['collect', '--dry-run'], ['status', '--force']]) {
    assert.throws(() => ab.parseArgs(bad), ab.UsageError, JSON.stringify(bad));
  }
});

test('expandCodes: books by the PDFs found, codes as given, everything checked before anything is built', (t) => {
  const dirs = sandbox(t);
  touchPdf(dirs, 'leph101', 'leph102', 'leph201', 'lech101', 'lebo101');
  writeFileSync(path.join(dirs.pdf, 'leph1ps.pdf'), ''); // a preliminary-pages file is not a chapter
  assert.deepEqual(ab.expandCodes({ books: ['leph1'] }), ['leph101', 'leph102']);
  assert.deepEqual(ab.expandCodes({ books: ['leph'] }), ['leph101', 'leph102', 'leph201']);
  assert.deepEqual(ab.expandCodes({ books: ['leph2', 'lech1'], codes: ['leph101', 'leph101'] }), ['lech101', 'leph101', 'leph201']);
  assert.throws(() => ab.expandCodes({}), /name the chapters/);
  assert.throws(() => ab.expandCodes({ codes: ['leph103'] }), /no PDF for leph103/);
  assert.throws(() => ab.expandCodes({ codes: ['leph10'] }), /not a chapter code/);
  assert.throws(() => ab.expandCodes({ codes: ['abcd101'] }), /unknown NCERT book code/);
  assert.throws(() => ab.expandCodes({ books: ['legy1'] }), /no chapter PDFs for book legy1/);
  assert.throws(() => ab.expandCodes({ books: ['leph12'] }), /not a book code/);
});

// ---------------------------------------------------------------------------------------------------------------
// The commands, with a fake client and a real (temporary) ledger
// ---------------------------------------------------------------------------------------------------------------

test('--dry-run builds every request, writes JSONL and prints the estimate; no client, no ledger, no reservation', async (t) => {
  const dirs = sandbox(t);
  touchPdf(dirs, 'lebs101', 'lebs102');
  const d = deps(dirs, null, { makeClient: () => assert.fail('no client for a dry run'), openLedger: () => assert.fail('no ledger for a dry run') });
  assert.equal(await ab.main(['author', '--books=lebs1', '--dry-run'], d), 0);
  assert.ok(d.out.some((l) => l.startsWith('[dry run] author: 2 requests')));
  assert.ok(d.out.some((l) => /estimated input tokens : [\d,]+/.test(l)));
  assert.ok(d.out.some((l) => /batch price \(50%\)\s+: about \$[\d.]+ likely, \$[\d.]+ if every reply fills max_tokens/.test(l)));
  assert.ok(d.out.some((l) => /conservative maximum\s+: \$[\d.]+/.test(l)));
  const file = path.join(dirs.api, 'dryrun-author-1.jsonl');
  const lines = readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((l) => l.custom_id), ['author-lebs101', 'author-lebs102']);
  assert.deepEqual(Object.keys(lines[0]), ['custom_id', 'params']);
  assert.equal(lines[0].params.model, 'claude-opus-5-5');
  assert.equal(existsSync(dirs.ledger), false, 'the ledger file was never created');
  // a second dry run does not overwrite the first
  assert.equal(await ab.main(['author', '--books=lebs1', '--dry-run'], d), 0);
  assert.deepEqual(readdirSync(dirs.api).sort(), ['dryrun-author-1.jsonl', 'dryrun-author-2.jsonl']);
});

test('author -> collect with a fake client: one batch, one reservation, drafts written by custom_id, ledger settled at the real cost', async (t) => {
  const dirs = sandbox(t);
  makeLedger(dirs.ledger);
  touchPdf(dirs, 'lebs101', 'lebs102');
  const client = fakeClient({
    statuses: ['in_progress', 'in_progress', 'ended'],
    respond: (r) => (r.custom_id === 'author-lebs101' ? succeeded(r.custom_id, authorReply()) : succeeded(r.custom_id, { code: 'lebs102', subject: 'business_studies', book: 'Business Studies Part 1', chapterNo: 2, cards: [], coverageNotes: [{ chapterKey: KEY, note: 'Fixture chapter with nothing on the syllabus.' }] })),
  });
  const d = deps(dirs, client);
  assert.equal(await ab.main(['author', '--codes=lebs101,lebs102'], d), 0);

  // one batch, no SDK retries on create, the requests exactly as built
  assert.equal(client.calls.create.length, 1);
  assert.deepEqual(client.calls.create[0].opts, { maxRetries: 0 });
  assert.deepEqual(client.calls.create[0].body.requests.map((r) => r.custom_id), ['author-lebs101', 'author-lebs102']);
  for (const r of client.calls.create[0].body.requests) assert.deepEqual(Object.keys(r), ['custom_id', 'params']);
  assert.ok(d.out.includes('batch id: msgbatch_test01'));

  // the ledger holds the conservative maximum, marked submitted so a later start-up cannot turn it into a hold
  const record = readJson(path.join(dirs.api, 'msgbatch_test01.json'));
  assert.equal(record.status, 'submitted');
  assert.deepEqual(record.codes, ['lebs101', 'lebs102']);
  const [row] = rows(dirs.ledger).filter((r) => r.model === ab.LEDGER_MODEL);
  assert.equal(row.id, record.reservation.id);
  assert.equal(row.state, 'submitted');
  assert.equal(row.reserved, record.reservation.micro);
  assert.equal(row.reserved, record.estimate.reserveMicro);
  assert.equal(JSON.parse(row.receipt_json).provider_batch_id, 'msgbatch_test01');

  // submitting the same chapters again is refused while the batch is out (no second reservation, no second create)
  const again = deps(dirs, client);
  assert.equal(await ab.main(['author', '--codes=lebs101'], again), 0);
  assert.ok(again.out.some((l) => /skip lebs101: already in batch msgbatch_test01/.test(l)));
  assert.equal(client.calls.create.length, 1);
  assert.equal(rows(dirs.ledger).filter((r) => r.model === ab.LEDGER_MODEL).length, 1);

  // collect: polls until ended (slept twice), writes the drafts, settles the reservation
  assert.equal(await ab.main(['collect', 'msgbatch_test01'], d), 0);
  assert.equal(d.sleeps.length, 2);
  assert.deepEqual(d.sleeps, [ab.POLL_MS, ab.POLL_MS]);
  assert.ok(d.out.some((l) => /msgbatch_test01: in_progress \(processing 2/.test(l)));
  const draft = readJson(path.join(dirs.drafts, 'lebs101.json'));
  assert.equal(draft.cards.length, 3);
  assert.equal(draft.code, 'lebs101');
  const empty = readJson(path.join(dirs.drafts, 'lebs102.json'));
  assert.deepEqual(empty.cards, []);
  assert.equal(empty.chapterNo, 2);
  const done = readJson(path.join(dirs.api, 'msgbatch_test01.json'));
  assert.equal(done.status, 'collected');
  assert.equal(done.results['author-lebs101'].status, 'written');
  assert.equal(done.results['author-lebs101'].machineCheck.quarantined, 0, 'the fixture cards pass the machine checks');
  assert.equal(done.actualMicro, 2 * 14000, 'two succeeded results at the batch price');
  assert.deepEqual(done.usage, { input_tokens: 2000, output_tokens: 1000, cache_creation_input_tokens: 4000, cache_read_input_tokens: 20000 });
  assert.ok(existsSync(path.join(dirs.api, 'msgbatch_test01', 'author-lebs101.json')), 'raw results are kept');
  const settled = rows(dirs.ledger).find((r) => r.id === record.reservation.id);
  assert.equal(settled.state, 'settled');
  assert.equal(settled.actual, 28000);
  assert.equal(JSON.parse(settled.receipt_json).stage, 'keycards-author');
  assert.equal(JSON.parse(settled.receipt_json).usage.input_tokens, 2000 + 4000 + 20000);

  // collecting again changes nothing (no second API read, no overwrite)
  const retrieves = client.calls.retrieve;
  writeFileSync(path.join(dirs.drafts, 'lebs101.json'), '{"edited":"by hand"}');
  const second = deps(dirs, client);
  assert.equal(await ab.main(['collect', 'msgbatch_test01'], second), 0);
  assert.ok(second.out[0].includes('was collected'));
  assert.equal(client.calls.retrieve, retrieves);
  assert.equal(readFileSync(path.join(dirs.drafts, 'lebs101.json'), 'utf8'), '{"edited":"by hand"}');
});

test('the files collect writes are what validate.mjs and review-merge.mjs read, unchanged: author -> review -> merge -> validate', async (t) => {
  const dirs = sandbox(t);
  makeLedger(dirs.ledger);
  touchPdf(dirs, 'lebs101');
  const authorClient = fakeClient({ respond: (r) => succeeded(r.custom_id, authorReply()) });
  const d1 = deps(dirs, authorClient);
  assert.equal(await ab.main(['author', '--codes=lebs101'], d1), 0);
  assert.equal(await ab.main(['collect', 'msgbatch_test01'], d1), 0);
  const drafts = readDrafts(dirs.drafts);
  assert.deepEqual(drafts.map((x) => [x.file, x.code, x.subject, x.cards.length]), [['lebs101.json', 'lebs101', 'business_studies', 3]]);

  // review: the reviewer flags the third card
  const flagged = drafts[0].cards[2].id;
  const reviewClient = fakeClient({
    respond: (r) => {
      const cards = r.params.messages[0].content[2].text.split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l));
      return succeeded(r.custom_id, { reviews: cards.map((c) => ({ id: c.id, exact: true, important: true, unambiguous: true, importanceRight: c.id !== flagged, reason: c.id === flagged ? 'Minor line, not a must.' : '' })) });
    },
  });
  const d2 = deps(dirs, reviewClient);
  assert.equal(await ab.main(['review', '--codes=lebs101'], d2), 0);
  assert.equal(reviewClient.calls.create[0].body.requests[0].custom_id, 'review-lebs101-1');
  assert.equal(await ab.main(['collect', 'msgbatch_test01'], d2), 0, d2.out.join('\n'));
  const reviews = readReviews(dirs.reviews);
  assert.deepEqual(reviews.map((r) => [r.code, r.verdicts.length]), [['lebs101', 3]]);
  assert.deepEqual(reviews[0].verdicts.map((v) => v.id), drafts[0].cards.map((c) => c.id), 'the draft\'s order');
  assert.equal(judge(reviews[0].verdicts[2]).ok, false);

  // the repo's own merge and validate, untouched
  const merge = runReviewMerge({ draftsDir: dirs.drafts, reviewsDir: dirs.reviews, log: () => {} });
  assert.deepEqual([merge.reviewed, merge.passed, merge.failed, merge.unknownIds], [3, 2, 1, []]);
  const summary = await runValidate({ draftsDir: dirs.drafts, getPdf, log: () => {} });
  assert.deepEqual([summary.business_studies.published, summary.business_studies.quarantined], [2, 1]);
  assert.ok('review:not_importanceRight' in summary.business_studies.reasons);
  const deck = readJson(path.join(dirs.out, 'decks', 'business_studies.json'));
  assert.deepEqual(deck.cards.map((c) => c.kind), ['definition', 'term']);
  assert.ok(deck.cards.every((c) => c.chapter === 'Nature & Significance of Management'), 'validate renames to the stored chapter');
});

test('review: a long draft goes out in parts, a partly answered part is written partly, and re-running reviews only what is missing', async (t) => {
  const dirs = sandbox(t);
  makeLedger(dirs.ledger);
  touchPdf(dirs, 'lebs101');
  const many = Array.from({ length: 120 }, (_, i) => ({ ...goodCards()[0], id: `kc.business_studies.nature-and-significance-of-management.def-card-${i}`, order: (i + 1) * 10 }));
  writeFileSync(path.join(dirs.drafts, 'lebs101.json'), JSON.stringify({ code: 'lebs101', subject: 'business_studies', book: 'Business Studies Part 1', chapterNo: 1, cards: many }));
  const answerAll = (r, skip = new Set()) => {
    const cards = r.params.messages[0].content[2].text.split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l)).filter((c) => !skip.has(c.id));
    return succeeded(r.custom_id, { reviews: cards.map((c) => ({ id: c.id, exact: true, important: true, unambiguous: true, importanceRight: true, reason: '' })) });
  };
  const skip = new Set([many[5].id, many[100].id]);
  const client = fakeClient({ respond: (r) => answerAll(r, skip), shuffle: (a) => [...a].reverse() });
  const d = deps(dirs, client);
  assert.equal(await ab.main(['review', '--codes=lebs101'], d), 0);
  const ids = client.calls.create[0].body.requests.map((r) => r.custom_id);
  assert.deepEqual(ids, ['review-lebs101-1', 'review-lebs101-2', 'review-lebs101-3'], '120 cards, 50 per part at most: three even parts');
  assert.equal(await ab.main(['collect', 'msgbatch_test01'], d), 1, 'two cards without a verdict is a partial result: exit 1');
  assert.ok(d.out.some((l) => /written_partial review-lebs101-1: 39 verdicts, 1 card\(s\) got none/.test(l)));
  const first = readJson(path.join(dirs.reviews, 'lebs101.json'));
  assert.equal(first.length, 118);
  assert.deepEqual(first.map((v) => v.id), many.map((c) => c.id).filter((id) => !skip.has(id)), 'draft order, the two unanswered cards absent');
  assert.equal((await readReviews(dirs.reviews))[0].verdicts.length, 118);

  // run again: only the two cards without a verdict are sent
  const client2 = fakeClient({ respond: (r) => answerAll(r) });
  const again = deps(dirs, client2);
  assert.equal(await ab.main(['review', '--codes=lebs101'], again), 0);
  const second = client2.calls.create[0].body.requests;
  assert.equal(second.length, 1);
  assert.deepEqual(second[0].params.messages[0].content[2].text.split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l).id), [many[5].id, many[100].id]);
  assert.equal(await ab.main(['collect', 'msgbatch_test01'], again), 0);
  assert.equal(readJson(path.join(dirs.reviews, 'lebs101.json')).length, 120);

  // nothing left to review: skipped (no client call); --force reviews all 120 again
  const third = deps(dirs, client2);
  assert.equal(await ab.main(['review', '--codes=lebs101'], third), 0);
  assert.ok(third.out.some((l) => /skip lebs101: every card has a review/.test(l)));
  assert.equal(client2.calls.create.length, 1);
});

test('a card edited after it was sent for review gets no verdict (the reviewer judged the old text)', async (t) => {
  const dirs = sandbox(t);
  makeLedger(dirs.ledger);
  touchPdf(dirs, 'lebs101');
  const cards = goodCards();
  writeFileSync(path.join(dirs.drafts, 'lebs101.json'), JSON.stringify({ code: 'lebs101', subject: 'business_studies', book: 'Business Studies Part 1', chapterNo: 1, cards }));
  const client = fakeClient({
    respond: (r) => succeeded(r.custom_id, { reviews: cards.map((c) => ({ id: c.id, exact: true, important: true, unambiguous: true, importanceRight: true, reason: '' })) }),
  });
  const d = deps(dirs, client);
  assert.equal(await ab.main(['review', '--codes=lebs101'], d), 0);
  // an editor changes card 2 before the results are collected
  const edited = structuredClone(cards);
  edited[1].front = '____ is the force that binds all the other functions of management!';
  writeFileSync(path.join(dirs.drafts, 'lebs101.json'), JSON.stringify({ code: 'lebs101', subject: 'business_studies', book: 'Business Studies Part 1', chapterNo: 1, cards: edited }));
  assert.equal(await ab.main(['collect', 'msgbatch_test01'], d), 0);
  const file = readJson(path.join(dirs.reviews, 'lebs101.json'));
  assert.deepEqual(file.map((v) => v.id), [cards[0].id, cards[2].id]);
  assert.ok(d.out.some((l) => /1 stale verdict\(s\) dropped/.test(l)));
});

test('collect records every kind of failure, writes nothing for it, and settles only what succeeded', async (t) => {
  const dirs = sandbox(t);
  makeLedger(dirs.ledger);
  touchPdf(dirs, 'lebs101', 'lebs102', 'lebs103', 'lebs104', 'lebs105');
  const client = fakeClient({
    respond: (r) => ({
      'author-lebs101': succeeded(r.custom_id, authorReply()),
      'author-lebs102': succeeded(r.custom_id, authorReply(), { stop_reason: 'max_tokens' }),
      'author-lebs103': succeeded(r.custom_id, authorReply(), { stop_reason: 'refusal', stop_details: { type: 'refusal', category: null, explanation: 'no' } }),
      'author-lebs104': { custom_id: r.custom_id, result: { type: 'errored', error: { type: 'error', error: { type: 'invalid_request_error', message: 'bad schema' } } } },
      'author-lebs105': { custom_id: r.custom_id, result: { type: 'expired' } },
    })[r.custom_id],
    shuffle: (a) => [a[2], a[4], a[0], a[3], a[1]],
  });
  const d = deps(dirs, client);
  assert.equal(await ab.main(['author', '--books=lebs1'], d), 0);
  assert.equal(await ab.main(['collect', 'msgbatch_test01'], d), 1, 'failures: exit 1');
  assert.deepEqual(readdirSync(dirs.drafts), ['lebs101.json'], 'only the success was written');
  const rec = readJson(path.join(dirs.api, 'msgbatch_test01.json'));
  assert.deepEqual(Object.fromEntries(Object.entries(rec.results).map(([k, v]) => [k, v.status === 'failed' ? v.reason : v.status])), {
    'author-lebs101': 'written', 'author-lebs102': 'max_tokens', 'author-lebs103': 'refusal', 'author-lebs104': 'errored', 'author-lebs105': 'expired',
  });
  assert.match(rec.results['author-lebs103'].detail, /"explanation":"no"/);
  assert.equal(rec.results['author-lebs104'].detail, 'invalid_request_error: bad schema');
  // billed: the success, the truncated reply and the refusal (each used tokens); not the errored or the expired request
  assert.equal(rec.actualMicro, 3 * 14000);
  assert.equal(rec.status, 'collected', 'the batch is accounted for even though some requests failed');
  assert.ok(d.out.some((l) => /FAILED author-lebs102: max_tokens/.test(l)));
  assert.ok(d.out.some((l) => /FAILED author-lebs105: expired/.test(l)));
  // failed codes are not "in a batch" any more: authoring them again is allowed
  const retry = deps(dirs, fakeClient({ respond: (r) => succeeded(r.custom_id, authorReply()) }));
  assert.equal(await ab.main(['author', '--codes=lebs102'], retry), 0);
  assert.ok(retry.out.some((l) => l.startsWith('batch id:')));
});

test('a draft that exists is never overwritten without --force, and --force keeps the old one in the run folder', async (t) => {
  const dirs = sandbox(t);
  makeLedger(dirs.ledger);
  touchPdf(dirs, 'lebs101');
  writeFileSync(path.join(dirs.drafts, 'lebs101.json'), '{"old":true}');
  const none = deps(dirs, fakeClient({ respond: () => assert.fail('nothing should be sent') }));
  assert.equal(await ab.main(['author', '--codes=lebs101'], none), 0);
  assert.ok(none.out.some((l) => /skip lebs101: a draft exists/.test(l)) && none.out.some((l) => /nothing to author/.test(l)));

  const client = fakeClient({ respond: (r) => succeeded(r.custom_id, authorReply()) });
  const d = deps(dirs, client);
  assert.equal(await ab.main(['author', '--codes=lebs101', '--force'], d), 0);
  assert.equal(await ab.main(['collect', 'msgbatch_test01'], d), 0);
  assert.equal(readJson(path.join(dirs.drafts, 'lebs101.json')).cards.length, 3);
  assert.deepEqual(readJson(path.join(dirs.api, 'msgbatch_test01', 'lebs101.previous.json')), { old: true });
});

test('a draft that appears while the batch runs is not overwritten (the new one is saved beside the run record)', async (t) => {
  const dirs = sandbox(t);
  makeLedger(dirs.ledger);
  touchPdf(dirs, 'lebs101');
  const client = fakeClient({ respond: (r) => succeeded(r.custom_id, authorReply()) });
  const d = deps(dirs, client);
  assert.equal(await ab.main(['author', '--codes=lebs101'], d), 0);
  writeFileSync(path.join(dirs.drafts, 'lebs101.json'), '{"by":"hand"}');
  assert.equal(await ab.main(['collect', 'msgbatch_test01'], d), 1);
  assert.equal(readFileSync(path.join(dirs.drafts, 'lebs101.json'), 'utf8'), '{"by":"hand"}');
  assert.equal(readJson(path.join(dirs.api, 'msgbatch_test01', 'lebs101.draft.json')).cards.length, 3);
  assert.ok(d.out.some((l) => /not_written lebs101/.test(l)));
});

test('author ids stay unique across the subject: a clash with another draft is renamed, never left to quarantine', async (t) => {
  const dirs = sandbox(t);
  makeLedger(dirs.ledger);
  touchPdf(dirs, 'lebs101');
  const other = goodCards().slice(0, 1);
  writeFileSync(path.join(dirs.drafts, 'lebs102.json'), JSON.stringify({ code: 'lebs102', subject: 'business_studies', book: 'Business Studies Part 1', chapterNo: 2, cards: other }));
  const client = fakeClient({ respond: (r) => succeeded(r.custom_id, authorReply()) });
  const d = deps(dirs, client);
  assert.equal(await ab.main(['author', '--codes=lebs101'], d), 0);
  assert.equal(await ab.main(['collect', 'msgbatch_test01'], d), 0);
  const ids = readJson(path.join(dirs.drafts, 'lebs101.json')).cards.map((c) => c.id);
  assert.equal(ids[0], `${other[0].id}-2`);
  assert.ok(!ids.includes(other[0].id));
  assert.deepEqual(ab.dedupeIds([{ id: 'a' }, { id: 'a' }, { id: 'a-2' }], new Set(['b'])), [['a', 'a-2'], ['a-2', 'a-2-2']]);
});

// ---------------------------------------------------------------------------------------------------------------
// The budget guard
// ---------------------------------------------------------------------------------------------------------------

test('the budget guard stops a run it cannot hold: exit 2, nothing submitted, nothing reserved', async (t) => {
  const dirs = sandbox(t);
  makeLedger(dirs.ledger, { limitMicro: 1000 }); // USD 0.001
  touchPdf(dirs, 'lebs101');
  const client = fakeClient({ respond: () => assert.fail('never reached') });
  const d = deps(dirs, client);
  assert.equal(await ab.main(['author', '--codes=lebs101'], d), 2);
  assert.equal(client.calls.create.length, 0);
  assert.match(d.err_.join('\n'), /stopped: budget guard refused the reservation of \$[\d.]+ \(budget_exhausted\).*Nothing was submitted/);
  assert.equal(rows(dirs.ledger).filter((r) => r.model === ab.LEDGER_MODEL).length, 0);
  // an unresolved hold with no bound blocks every paid call
  const dirs2 = sandbox(t);
  makeLedger(dirs2.ledger);
  touchPdf(dirs2, 'lebs101');
  const l = new BudgetLedger(dirs2.ledger);
  l.settle(l.reserve('some-model', 500), null, { error: 'lost receipt' });
  l.close();
  const d2 = deps(dirs2, fakeClient({ respond: () => assert.fail('never reached') }));
  assert.equal(await ab.main(['author', '--codes=lebs101'], d2), 2);
  assert.match(d2.err_.join('\n'), /budget_usage_unresolved/);
  // a ledger whose history was never reconciled is refused too (the repo's rule before any paid call)
  const dirs3 = sandbox(t);
  new BudgetLedger(dirs3.ledger).close();
  touchPdf(dirs3, 'lebs101');
  const d3 = deps(dirs3, fakeClient({ respond: () => assert.fail('never reached') }));
  assert.equal(await ab.main(['author', '--codes=lebs101'], d3), 2);
  assert.match(d3.err_.join('\n'), /historical_spend_reconciliation_required/);
});

test('CUET_CONTENT_LIMIT_USD stops one run before anything is reserved', async (t) => {
  const dirs = sandbox(t);
  makeLedger(dirs.ledger);
  touchPdf(dirs, 'lebs101');
  process.env.CUET_CONTENT_LIMIT_USD = '0.05';
  const client = fakeClient({ respond: () => assert.fail('never reached') });
  const d = deps(dirs, client);
  assert.equal(await ab.main(['author', '--codes=lebs101'], d), 2);
  assert.match(d.err_.join('\n'), /above CUET_CONTENT_LIMIT_USD=0\.05: nothing submitted/);
  assert.equal(rows(dirs.ledger).filter((r) => r.model === ab.LEDGER_MODEL).length, 0);
  // a dry run only warns
  const dry = deps(dirs, client);
  assert.equal(await ab.main(['author', '--codes=lebs101', '--dry-run'], dry), 0);
  assert.ok(dry.out.some((l) => /warning: the conservative maximum is above CUET_CONTENT_LIMIT_USD=0\.05/.test(l)));
  process.env.CUET_CONTENT_LIMIT_USD = '1000';
  const ok = fakeClient({ respond: (r) => succeeded(r.custom_id, authorReply()) });
  assert.equal(await ab.main(['author', '--codes=lebs101'], deps(dirs, ok)), 0);
});

test('a missing API key stops a real run before any reservation; the key never appears in output', async (t) => {
  const dirs = sandbox(t);
  makeLedger(dirs.ledger);
  touchPdf(dirs, 'lebs101');
  process.env.ANTHROPIC_API_KEY_FILE = path.join(dirs.root, 'no-such-key.txt');
  const d = deps(dirs, null, { makeClient: ab.makeClient });
  assert.equal(await ab.main(['author', '--codes=lebs101'], d), 1);
  assert.match(d.err_.join('\n'), /no Anthropic API key: set ANTHROPIC_API_KEY, or put the key on the first line of .*no-such-key\.txt/);
  assert.equal(rows(dirs.ledger).filter((r) => r.model === ab.LEDGER_MODEL).length, 0);
  // with a key in the environment the client builds, and the key is nowhere in what the script prints
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test-SECRET-123';
  const client = ab.makeClient();
  assert.equal(typeof client.messages.batches.create, 'function');
  const fake = fakeClient({ respond: (r) => succeeded(r.custom_id, authorReply()) });
  const ok = deps(dirs, fake);
  assert.equal(await ab.main(['author', '--codes=lebs101'], ok), 0);
  assert.ok(![...ok.out, ...ok.err_].join('\n').includes('SECRET'));
  assert.ok(!readFileSync(path.join(dirs.api, 'msgbatch_test01.json'), 'utf8').includes('SECRET'));
});

test('batch creation that fails: a 4xx releases the reservation at zero; anything unknown keeps a bounded hold and blocks nothing else', async (t) => {
  for (const [status, outcome] of [[400, 'released'], [401, 'released'], [429, 'released'], [500, 'held'], [529, 'held'], [408, 'held'], [undefined, 'held']]) {
    const dirs = sandbox(t);
    makeLedger(dirs.ledger);
    touchPdf(dirs, 'lebs101');
    const error = Object.assign(new Error(status ? `HTTP ${status}` : 'connection reset'), { status });
    const client = fakeClient({ createError: error, respond: () => assert.fail('no results') });
    const d = deps(dirs, client);
    assert.equal(await ab.main(['author', '--codes=lebs101'], d), 1, String(status));
    assert.equal(client.calls.create.length, 1, 'never retried');
    const [row] = rows(dirs.ledger).filter((r) => r.model === ab.LEDGER_MODEL);
    const msg = d.err_.join('\n');
    const ledger = new BudgetLedger(dirs.ledger);
    try {
      if (outcome === 'released') {
        assert.deepEqual([row.state, row.actual], ['settled', 0], String(status));
        assert.match(msg, /The reservation was released/);
        assert.equal(ledger.snapshot().committed_micro, 0);
      } else {
        assert.equal(row.state, 'unresolved', String(status));
        assert.match(msg, /The batch may exist: check the Anthropic console/);
        const hold = ledger.db.prepare('SELECT * FROM conservative_holds WHERE reservation_id=?').get(row.id);
        assert.equal(hold.maximum_micro, row.reserved, 'the bound proof was accepted: the hold is the full reservation');
        assert.equal(ledger.snapshot().unbounded_unresolved, 0);
        assert.equal(ledger.snapshot().committed_micro, row.reserved, 'still committed in full');
        ledger.reserve('independent', 1); // bounded: other work may continue
      }
    } finally { ledger.close(); }
    assert.equal(existsSync(path.join(dirs.api, 'msgbatch_test01.json')), false, 'no run record without a batch id');
    const unconfirmed = readdirSync(dirs.api).filter((f) => f.startsWith('unconfirmed-'));
    if (outcome === 'released') {
      assert.deepEqual(unconfirmed, [], 'a definite rejection leaves nothing behind');
      continue;
    }
    // a batch may exist: the chapters are remembered, and the same command is refused until somebody has looked
    assert.equal(unconfirmed.length, 1);
    const rec = readJson(path.join(dirs.api, unconfirmed[0]));
    assert.deepEqual([rec.status, rec.kind, rec.codes, rec.batchId, rec.reservation.id], ['submit_unknown', 'author', ['lebs101'], null, row.id]);
    const again = deps(dirs, fakeClient({ respond: () => assert.fail('nothing may be sent') }));
    assert.equal(await ab.main(['author', '--codes=lebs101'], again), 0);
    assert.ok(again.out.some((l) => /skip lebs101: an earlier submission that failed without a clear answer \(unconfirmed-.*\.json\) may have created a batch/.test(l)));
    assert.equal(rows(dirs.ledger).filter((r) => r.model === ab.LEDGER_MODEL).length, 1, 'no second reservation');
  }
});

test('the ledger\'s start-up sweep spares a submitted reservation but turns an unmarked one into a blocking hold', (t) => {
  const dirs = sandbox(t);
  makeLedger(dirs.ledger);
  const first = new BudgetLedger(dirs.ledger);
  const marked = first.reserve(ab.LEDGER_MODEL, 4000);
  ab.markSubmitted(first, marked, { provider: 'anthropic' });
  const bare = first.reserve(ab.LEDGER_MODEL, 5000); // as if the process died between reserve and submit
  first.db.prepare('UPDATE requests SET owner_pid=2147483000').run(); // a pid that is not running
  first.close();
  const second = new BudgetLedger(dirs.ledger);
  try {
    const state = (id) => second.db.prepare('SELECT state FROM requests WHERE id=?').get(id).state;
    assert.equal(state(marked), 'submitted', 'survives another process opening the ledger');
    assert.equal(state(bare), 'unresolved', 'the sweep holds what it cannot account for');
    assert.throws(() => second.reserve(ab.LEDGER_MODEL, 1), /budget_usage_unresolved/);
    assert.equal(second.snapshot().committed_micro, 9000);
    second.settle(marked, 2500, {});
    assert.equal(second.db.prepare('SELECT state, actual FROM requests WHERE id=?').get(marked).actual, 2500, 'a submitted reservation settles from any later process');
  } finally { second.close(); }
});

test('a reservation that the actual cost overruns is reported, not hidden', async (t) => {
  const dirs = sandbox(t);
  makeLedger(dirs.ledger);
  touchPdf(dirs, 'lebs101');
  const d = deps(dirs, fakeClient({ respond: (r) => succeeded(r.custom_id, authorReply(), { usage: { ...USAGE, output_tokens: 999_999_999 } }) }));
  assert.equal(await ab.main(['author', '--codes=lebs101'], d), 0);
  assert.equal(await ab.main(['collect', 'msgbatch_test01'], d), 1);
  assert.match(d.err_.join('\n'), /is above the reservation .*the ledger marked it unresolved/);
  const rec = readJson(path.join(dirs.api, 'msgbatch_test01.json'));
  assert.equal(rec.status, 'written', 'files written; settlement still open');
  assert.ok(readFileSync(path.join(dirs.drafts, 'lebs101.json'), 'utf8').includes('"cards"'));
});

test('a batch whose results lack a request keeps its reservation open and says so', async (t) => {
  const dirs = sandbox(t);
  makeLedger(dirs.ledger);
  touchPdf(dirs, 'lebs101', 'lebs102');
  let answer = true;
  const client = fakeClient({ respond: (r) => succeeded(r.custom_id, authorReply()) });
  const real = client.messages.batches.results.bind(client.messages.batches);
  client.messages.batches.results = async (id) => {
    const all = await real(id);
    const lines = [];
    for await (const l of all) lines.push(l);
    return (async function* g() { for (const l of answer ? lines.slice(0, 1) : lines) yield l; })();
  };
  const d = deps(dirs, client);
  assert.equal(await ab.main(['author', '--codes=lebs101,lebs102'], d), 0);
  assert.equal(await ab.main(['collect', 'msgbatch_test01'], d), 1);
  assert.match(d.err_.join('\n'), /1 request\(s\) have no result line: the reservation stays open/);
  assert.equal(rows(dirs.ledger).find((r) => r.model === ab.LEDGER_MODEL).state, 'submitted');
  // the missing line shows up on the next collect; everything settles
  answer = false;
  assert.equal(await ab.main(['collect', 'msgbatch_test01'], d), 0, d.err_.join('\n'));
  assert.equal(rows(dirs.ledger).find((r) => r.model === ab.LEDGER_MODEL).state, 'settled');
  assert.equal(readdirSync(dirs.drafts).length, 2);
});

test('status prints the batch counts and the run record', async (t) => {
  const dirs = sandbox(t);
  makeLedger(dirs.ledger);
  touchPdf(dirs, 'lebs101');
  const client = fakeClient({ respond: (r) => succeeded(r.custom_id, authorReply()), statuses: ['in_progress'] });
  const d = deps(dirs, client);
  assert.equal(await ab.main(['author', '--codes=lebs101'], d), 0);
  const s = deps(dirs, client);
  assert.equal(await ab.main(['status', 'msgbatch_test01'], s), 0);
  assert.ok(s.out.some((l) => l.startsWith('msgbatch_test01: in_progress')));
  assert.ok(s.out.some((l) => /processing 1, succeeded 0, errored 0, expired 0, canceled 0/.test(l)));
  assert.ok(s.out.some((l) => /run record: author of lebs101; submitted, reserved \$/.test(l)));
  const bad = deps(dirs, client);
  assert.equal(await ab.main(['status', '../../etc/passwd'], bad), 1);
  assert.equal(await ab.main(['collect', 'msgbatch_unknown'], bad), 1);
  assert.match(bad.err_.join('\n'), /no run record for msgbatch_unknown/);
});

// ---------------------------------------------------------------------------------------------------------------
// Against a real PDF (needs pdftotext; the PDFs of the pipeline are not in the repo, so a tiny one is built here)
// ---------------------------------------------------------------------------------------------------------------

function miniPdf(pages) {
  const objs = ['<</Type/Catalog/Pages 2 0 R>>', `<</Type/Pages/Kids[${pages.map((_, i) => `${3 + i * 2} 0 R`).join(' ')}]/Count ${pages.length}>>`];
  pages.forEach((lines, i) => {
    const content = lines.map(([text, x, y]) => `BT /F1 12 Tf ${x} ${y} Td (${text}) Tj ET`).join(' ');
    objs.push(`<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents ${4 + i * 2} 0 R/Resources<</Font<</F1 ${3 + pages.length * 2} 0 R>>>>>>`);
    objs.push(`<</Length ${content.length}>>\nstream\n${content}\nendstream`);
  });
  objs.push('<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>');
  let out = '%PDF-1.4\n';
  const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<</Root 1 0 R/Size ${objs.length + 1}>>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const havePdftotext = (() => { try { execFileSync('pdftotext', ['-v'], { stdio: 'ignore' }); return true; } catch (e) { return e.status !== undefined; } })();

test('loadChapterPages reads a real PDF through lib.mjs: the same pages and printed-page offset the validator uses', { skip: !havePdftotext && 'pdftotext not installed' }, (t) => {
  const dirs = sandbox(t);
  const page = (n, body) => [[body[0], 72, 700], [body[1], 72, 650], [body[2], 72, 600], [String(n), 300, 40]];
  writeFileSync(path.join(dirs.pdf, 'lebs199.pdf'), miniPdf([
    page(31, ['Management is the process of getting things done.', 'Planning is looking ahead.', 'Organising is arranging resources.']),
    page(32, ['Staffing is filling positions.', 'Directing is guiding people.', 'Controlling is comparing results.']),
  ]));
  const got = ab.loadChapterPages('lebs199');
  const lib = pdfText('lebs199');
  assert.equal(got.pages, lib.pages, 'the very pages lib.mjs checks quotes against');
  assert.equal(got.offset, 30, 'printed 31 on PDF page 1');
  const request = ab.buildAuthorRequest({ code: 'lebs199', pages: got.pages, offset: got.offset, syllabusText: SYLLABUS });
  const text = request.params.messages[0].content[1].text;
  assert.deepEqual([...text.matchAll(/\[\[PRINTED PAGE (\d+)\]\]/g)].map((m) => Number(m[1])), [31, 32]);
  assert.ok(text.indexOf('[[PRINTED PAGE 32]]') < text.indexOf('Staffing is filling positions.'));
  assert.equal(ab.loadChapterPages('lebs198'), null, 'a PDF that is not there');
  // and the syllabus text of a subject is read from the repo's own CUET 2026 PDF
  assert.match(ab.readSyllabusText('psychology'), /Unit 1: Variations in Psychological Attributes/);
  assert.throws(() => ab.readSyllabusText('no_such_subject'), /syllabus PDF not found/);
});

// ---------------------------------------------------------------------------------------------------------------
// The real SDK client over a mocked transport: what actually goes over the wire, and that a failed create is never retried
// ---------------------------------------------------------------------------------------------------------------

function transport({ postStatus = 200, respond = (r) => succeeded(r.custom_id, authorReply()) } = {}) {
  const seen = [];
  let sent = [];
  const batch = (over = {}) => ({ id: 'msgbatch_http01', type: 'message_batch', processing_status: 'ended', request_counts: { processing: 0, succeeded: sent.length, errored: 0, canceled: 0, expired: 0 }, created_at: '2026-11-01T10:00:00Z', ended_at: '2026-11-01T10:20:00Z', expires_at: '2026-11-02T10:00:00Z', archived_at: null, cancel_initiated_at: null, results_url: 'https://api.anthropic.com/v1/messages/batches/msgbatch_http01/results', ...over });
  const fetch = async (url, init = {}) => {
    const u = String(url);
    const method = String(init.method ?? 'GET').toUpperCase();
    seen.push({ method, url: u, headers: Object.fromEntries(new Headers(init.headers).entries()), body: init.body });
    if (method === 'POST' && /\/v1\/messages\/batches$/.test(u)) {
      if (postStatus !== 200) return new Response(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'upstream trouble' } }), { status: postStatus, headers: { 'content-type': 'application/json' } });
      sent = JSON.parse(init.body).requests;
      return Response.json(batch({ processing_status: 'in_progress', results_url: null }));
    }
    if (method === 'GET' && /\/v1\/messages\/batches\/msgbatch_http01$/.test(u)) return Response.json(batch());
    if (method === 'GET' && u.endsWith('/results')) return new Response(`${sent.map((r) => JSON.stringify(respond(r))).reverse().join('\n')}\n`, { status: 200, headers: { 'content-type': 'application/binary' } });
    return new Response('not found', { status: 404 });
  };
  return { seen, fetch };
}

test('over the real SDK client: one POST with the key and the requests as built, results read back by custom_id', async (t) => {
  const dirs = sandbox(t);
  makeLedger(dirs.ledger);
  touchPdf(dirs, 'lebs101', 'lebs102');
  const wire = transport();
  const client = new Anthropic({ apiKey: 'sk-ant-wire-test-key', fetch: wire.fetch });
  const d = deps(dirs, client);
  assert.equal(await ab.main(['author', '--codes=lebs101,lebs102'], d), 0, d.out.join('\n'));
  const posts = wire.seen.filter((x) => x.method === 'POST');
  assert.equal(posts.length, 1);
  assert.match(posts[0].url, /\/v1\/messages\/batches$/);
  assert.equal(posts[0].headers['x-api-key'], 'sk-ant-wire-test-key');
  assert.ok(posts[0].headers['anthropic-version']);
  const body = JSON.parse(posts[0].body);
  assert.deepEqual(Object.keys(body), ['requests']);
  assert.deepEqual(body.requests.map((r) => r.custom_id), ['author-lebs101', 'author-lebs102']);
  const p = body.requests[0].params;
  assert.deepEqual([p.model, p.max_tokens, p.thinking, p.output_config.effort, p.output_config.format.type], ['claude-opus-5-5', 32000, { type: 'adaptive' }, 'high', 'json_schema']);
  assert.deepEqual(p.system[0].cache_control, { type: 'ephemeral' });
  assert.ok(![...d.out, ...d.err_].join('\n').includes('sk-ant-wire'), 'the key is never printed');
  // collect: the JSONL results come back through the SDK's decoder, in the reverse of the request order
  assert.equal(await ab.main(['collect', 'msgbatch_http01'], d), 0, d.out.join('\n'));
  assert.equal(readJson(path.join(dirs.drafts, 'lebs101.json')).cards.length, 3);
  assert.equal(readJson(path.join(dirs.drafts, 'lebs102.json')).code, 'lebs102');
  assert.equal(readJson(path.join(dirs.api, 'msgbatch_http01.json')).actualMicro, 2 * 14000);
  assert.ok(wire.seen.filter((x) => x.method === 'GET').length >= 2);
});

test('over the real SDK client: a failing create is sent once (the SDK would retry a 500 twice by default)', async (t) => {
  const dirs = sandbox(t);
  makeLedger(dirs.ledger);
  touchPdf(dirs, 'lebs101');
  const wire = transport({ postStatus: 500 });
  const client = new Anthropic({ apiKey: 'sk-ant-wire-test-key', fetch: wire.fetch });
  const d = deps(dirs, client);
  assert.equal(await ab.main(['author', '--codes=lebs101'], d), 1);
  assert.equal(wire.seen.filter((x) => x.method === 'POST').length, 1, 'no automatic retry of a call that may have created a batch');
  assert.match(d.err_.join('\n'), /batch submission failed \(500:/);
  assert.equal(rows(dirs.ledger).find((r) => r.model === ab.LEDGER_MODEL).state, 'unresolved');
  assert.ok(![...d.out, ...d.err_].join('\n').includes('sk-ant-wire'));
});
