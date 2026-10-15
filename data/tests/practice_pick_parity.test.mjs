import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FALLBACK, PRACTICE_HEAVY_COLUMNS, PRACTICE_LIGHT_SELECT, PRACTICE_QUESTION_COLUMNS, PRACTICE_STUB_COLUMNS,
  pickFromFullPool, pickFromLightPool, selectPracticeQuestions,
} from '../practice_pick.js';
import { readablePracticeQuestions } from '../practice_library.js';
import { currentRegistry } from '../evidence_registry.js';
import { contentHash, evidenceSignature } from '../content_evidence.js';
import { getMode } from '../test_modes.js';

// Before/after comparison for the session-start read (A5, 15 Oct 2026). The "before" is the whole
// subject read with every column (pickFromFullPool, the old getQuestions); the "after" is the slim
// read (pickFromLightPool). Over generated subjects and many inputs, the picks, their order, the
// selection tiers, the usage meta and every returned row must be identical, while the slim read
// moves a fraction of the bytes. Software fixtures; they do not establish academic reliability.
const SECRET = 'software-fixture-secret';
const saved = { key: process.env.CUET_EVIDENCE_SIGNING_KEY, mock: process.env.MOCK_AI };
process.env.CUET_EVIDENCE_SIGNING_KEY = SECRET;
delete process.env.MOCK_AI;
after(() => {
  if (saved.key === undefined) delete process.env.CUET_EVIDENCE_SIGNING_KEY; else process.env.CUET_EVIDENCE_SIGNING_KEY = saved.key;
  if (saved.mock !== undefined) process.env.MOCK_AI = saved.mock;
});

const PRODUCTION_COLUMNS_15_OCT_2026 = 'id,subject,chapter,question,options,correct_index,explanation,difficulty,source,status,uploaded_by,created_at,body,correct_answer,author_id,tags,updated_at,ai_tier,ai_score,recommended_difficulty,verification_state,quality_band,quality_score,momentum_score,exposure_budget,exposure_used,exploration_lane,exploration_state,duplicate_group_id,content_hash,live_at,settled_at,is_deleted,upvotes,downvotes,score,is_ncert_relevant,is_cuet_syllabus,validation_confidence,topic,validated_at,concept,concept_id,pyq_anchor_id,anchor_tier,difficulty_weight,question_type,passage_group_id,passage_id,passage_type,order_index,evidence,family_id,passage_text,provenance,legacy_screening'.split(',');
const ALL_COLUMNS = [...PRACTICE_QUESTION_COLUMNS, ...PRACTICE_HEAVY_COLUMNS];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORDS = ['ledger', 'journal', 'balance', 'capital', 'drawings', 'goodwill', 'premium', 'discount', 'reserve', 'dividend', 'debenture', 'partner', 'asset', 'liability', 'revenue', 'expense', 'cashbook', 'voucher', 'invoice', 'surplus'];
const CHAPTERS = ['Partnership', 'Company Accounts', 'Cash Flow', 'Ratios'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

function fullRow(over) {
  const row = Object.fromEntries(ALL_COLUMNS.map((column) => [column, null]));
  return Object.assign(row, over);
}

function legacyRow(rand, n) {
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const words = [0, 1, 2, 3].map(() => WORDS[Math.floor(rand() * WORDS.length)]);
  const key = Math.floor(rand() * 4);
  const status = rand() < 0.86 ? 'live' : pick(['pending', 'quarantined', 'rejected', 'invalid']);
  const lane = status === 'live' ? null : (rand() < 0.5 ? { verification_state: 'verified', exploration_state: 'active' } : {});
  const id = `q-${String(n).padStart(4, '0')}`;
  const row = fullRow({
    id, subject: 'accountancy', chapter: pick(CHAPTERS), topic: pick(['Goodwill', 'Dissolution', 'Shares', null]),
    body: `Which statement about ${words[0]} and ${words[1]} number ${n} is correct?`,
    question: `Which statement about ${words[0]} and ${words[1]} number ${n} is correct?`,
    options: words.map((word, i) => `The ${word} treatment ${n}-${i} follows the stated rule`),
    correct_answer: 'ABCD'[key], correct_index: key, explanation: `The stated rule for ${words[key]} applies in case ${n}.`,
    difficulty: pick(DIFFICULTIES), status, is_deleted: rand() < 0.03, created_at: new Date(Date.UTC(2026, 3, 1 + Math.floor(rand() * 120))).toISOString(),
    score: Math.floor(rand() * 8) - 3, concept_id: `concept_${Math.floor(rand() * 14)}`,
    family_id: rand() < 0.35 ? `fam-legacy-${Math.floor(rand() * 40)}` : null,
    passage_group_id: rand() < 0.04 ? `grp-${Math.floor(rand() * 3)}` : null,
    ...(lane || {}),
  });
  if (rand() < 0.06) row.verification_state = 'disputed';
  if (rand() < 0.05) row.legacy_screening = { verdict: 'no_issue_found', content_hash: 'stale', question_id: id, review_version: 'subscription-screen-v1', reviewed_at: new Date().toISOString(), scope: 'local_mechanical', local_findings: [] };
  return row;
}

// Evidence-managed rows bound to the real shipped registry: eligible ones (signed, unexpired), and
// rows that look factory-made (policy v3) or are broken in ways only the full record shows.
function managedRows(rand, startN, count, registry, manifest, period = 7) {
  const families = Object.entries(registry.families).filter(([, f]) => f.state === 'active');
  const [sourceId, source] = Object.entries(registry.sources).find(([, s]) => s.state === 'active' && s.reuse_permitted && Object.keys(s.supports || {}).length);
  const [locator, supportHash] = Object.entries(source.supports)[0];
  const verifier = manifest.routes.conceptual.verifier_version;
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const [familyId, family] = families[(startN + i * 7) % families.length];
    const id = `m-${String(startN + i).padStart(4, '0')}`;
    const words = [0, 1, 2, 3].map(() => WORDS[Math.floor(rand() * WORDS.length)]);
    const row = fullRow({
      id, subject: 'accountancy', chapter: CHAPTERS[i % CHAPTERS.length],
      body: `Managed question ${i} on ${words[0]}`, question: `Managed question ${i} on ${words[0]}`,
      options: words.map((word, k) => `The ${word} entry ${id}-${k} is posted`), correct_answer: 'A', correct_index: 0,
      explanation: `Posting follows the ${words[0]} rule here.`, difficulty: DIFFICULTIES[i % 3], status: 'live',
      created_at: new Date(Date.UTC(2026, 5, 1 + Math.floor(rand() * 100))).toISOString(), score: Math.floor(rand() * 6) - 1,
      concept_id: `concept_${Math.floor(rand() * 14)}`, family_id: familyId, is_deleted: false,
    });
    const record = {
      candidate_id: id, content_hash: contentHash(row), family_id: familyId, family_version: family.version, state: 'published', route: 'conceptual',
      verifier_version: verifier, verified_at: new Date().toISOString(), expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      sources: [{ id: sourceId, version: source.version, locator, support_hash: supportHash }], solved_key: 'A', checks: {},
      notes: 'x'.repeat(30000), // a real record is about 38 KB; the padding makes the byte comparison meaningful
    };
    const kind = i % period;
    if (kind === 1) record.expires_at = new Date(Date.now() - 1000).toISOString(); // stale
    if (kind === 2) { record.policy_version = 'cuet-llm-v3'; row.provenance = { kind: 'factory' }; } // factory-looking, fails the full gate
    for (const stage of ['schema', 'dedupe', 'source_support', 'blind_solution', 'alternatives', 'explanation_support', 'exam_fit']) {
      record.checks[stage] = { passed: true, evidence_hash: 'fixture-check', candidate_id: id, content_hash: record.content_hash };
    }
    row.evidence = { record, signature: kind === 3 ? 'bad-signature' : evidenceSignature(record, SECRET) };
    if (kind === 4) row.explanation = 'Changed after the evidence was signed.'; // content_changed
    if (kind !== 2) row.provenance = null;
    out.push(row);
  }
  return out;
}

function buildSubject(seed, { legacy = 260, managed = 40, period = 7 } = {}) {
  const rand = rng(seed);
  const registry = currentRegistry();
  const manifest = JSON.parse(readFileSync(new URL('../calibration_manifest.json', import.meta.url), 'utf8'));
  const rows = [];
  for (let n = 0; n < legacy; n += 1) rows.push(legacyRow(rand, n));
  rows.push(...managedRows(rand, 1000, managed, registry, manifest, period));
  return rows;
}

const visible = (row) => row.status === 'live' || (row.verification_state === 'verified' && row.exploration_state === 'active');
const jsonPath = (value, ...path) => path.reduce((node, key) => (node && typeof node === 'object' ? node[key] : null), value) ?? null;
const bytes = (value) => Buffer.byteLength(JSON.stringify(value));

// The database, as the query in data/db.js getQuestions sees it.
function makeSource(allRows, { subject = 'accountancy', mode, opts = {}, recent = new Set(), progress = new Map(), weak = new Set(), holds = new Set(), groups = {} } = {}) {
  const tally = { fullPoolBytes: 0, lightBytes: 0, fullRowBytes: 0, fullRowsRead: 0, progressIdCalls: [] };
  const matching = () => allRows
    .filter((row) => row.subject === subject && row.is_deleted === false && visible(row) && Number(row.score ?? 0) >= -2)
    .filter((row) => (Array.isArray(opts.chapters) && opts.chapters.length ? opts.chapters.includes(row.chapter) : opts.chapter ? row.chapter === opts.chapter : true))
    .filter((row) => (mode.allowDifficultyOverride && DIFFICULTIES.includes(opts.difficulty) ? row.difficulty === opts.difficulty : true))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : b.score - a.score || (a.id < b.id ? -1 : 1)));
  const db = { from: (table) => ({ select: () => ({ in: async (_column, ids) => ({ data: table === 'recovery_family_holds' ? ids.filter((id) => holds.has(id)).map((family_id) => ({ family_id })) : [], error: null }) }) }) };
  return {
    tally,
    loadFullPool: async () => { const rows = structuredClone(matching()); tally.fullPoolBytes += bytes(rows); return rows; },
    loadLightPool: async () => {
      const rows = matching().map((row) => ({
        ...Object.fromEntries(PRACTICE_QUESTION_COLUMNS.map((column) => [column, row[column]])),
        ev_policy: jsonPath(row.evidence, 'record', 'policy_version'),
        ev_family: jsonPath(row.evidence, 'record', 'family_id'),
        prov_kind: jsonPath(row.provenance, 'kind'),
      }));
      const managedIds = new Set(allRows.filter((row) => row.subject === subject && row.is_deleted === false && (row.evidence !== null || row.provenance !== null)).map((row) => row.id));
      tally.lightBytes += bytes(rows) + bytes([...managedIds]);
      return { rows: structuredClone(rows), managedIds };
    },
    loadFullRows: async (ids) => {
      const rows = structuredClone(allRows.filter((row) => ids.includes(row.id)));
      tally.fullRowBytes += bytes(rows); tally.fullRowsRead += rows.length;
      return rows;
    },
    attachPassages: async (rows) => rows.map((row) => {
      const group = groups[row.passage_group_id || row.group_id];
      return group ? { ...row, passage_id: row.passage_id || row.passage_group_id, passage_text: row.passage_text || group.text, passage_title: row.passage_title || group.title } : row;
    }),
    readable: (rows) => readablePracticeQuestions(rows, db, { requireEvidence: opts.requireEvidence === true }),
    recentIds: async () => recent,
    userProgress: async (ids) => { tally.progressIdCalls.push(ids.length); return new Map([...progress].filter(([id]) => ids.includes(id))); },
    weakConcepts: async () => weak,
  };
}

async function compare(allRows, scenario) {
  const mode = getMode(scenario.mode);
  const targetCount = scenario.count;
  const make = () => makeSource(allRows, { mode, ...scenario.world });
  const ctx = (source) => ({ mode, targetCount, opts: scenario.opts || {}, stats: source.stats = {} });
  const before = make();
  const expected = await pickFromFullPool(before, ctx(before));
  const after = make();
  const slim = await pickFromLightPool(after, ctx(after));
  return { expected, slim, before, after };
}

test('the light column list plus the two heavy records is exactly the production questions table', () => {
  assert.deepEqual([...ALL_COLUMNS].sort(), [...PRODUCTION_COLUMNS_15_OCT_2026].sort());
  assert.ok(!PRACTICE_QUESTION_COLUMNS.includes('evidence') && !PRACTICE_QUESTION_COLUMNS.includes('provenance'));
  assert.equal(new Set(PRACTICE_QUESTION_COLUMNS).size, PRACTICE_QUESTION_COLUMNS.length);
  assert.deepEqual(PRACTICE_STUB_COLUMNS, ['ev_policy:evidence->record->>policy_version', 'ev_family:evidence->record->>family_id', 'prov_kind:provenance->>kind']);
  assert.ok(PRACTICE_LIGHT_SELECT.startsWith('id,subject,') && PRACTICE_LIGHT_SELECT.endsWith('prov_kind:provenance->>kind'));
});

test('the fixture world is not trivial: legacy, eligible managed and rejected managed rows all occur', async () => {
  const rows = buildSubject(11);
  const eligible = await readablePracticeQuestions(structuredClone(rows.filter((row) => row.id.startsWith('m-'))), { from: () => ({ select: () => ({ in: async () => ({ data: [], error: null }) }) }) });
  assert.ok(eligible.length >= 10 && eligible.length < 36, `managed rows that pass the full gate: ${eligible.length}`);
  assert.ok(eligible.every((row) => row.selection_evidence_tier === 2));
  const legacy = await readablePracticeQuestions(structuredClone(rows.filter((row) => row.id.startsWith('q-') && visible(row) && !row.is_deleted)), { from: () => ({ select: () => ({ in: async () => ({ data: [], error: null }) }) }) });
  assert.ok(legacy.length > 100, `legacy rows readable: ${legacy.length}`);
  assert.ok(rows.some((row) => row.provenance?.kind === 'factory'), 'rows that look factory-made but fail the full gate exist');
});

const MODES = [['quick', 10], ['quick', 25], ['smart', 15], ['full', 50], ['quick', 50]];

test('picks, order, tiers, meta and rows are identical to the full read over seeds, modes and inputs', async () => {
  let compared = 0;
  let fastPath = 0;
  let fullRowsReadTotal = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const rows = buildSubject(seed);
    const rand = rng(seed * 101);
    const ids = rows.filter((row) => !row.is_deleted).map((row) => row.id);
    const sample = (n) => new Set(Array.from({ length: n }, () => ids[Math.floor(rand() * ids.length)]));
    const progressFor = () => new Map([...sample(120)].map((id) => [id, { question_id: id, attempt_count: 1 + Math.floor(rand() * 3), correct_count: 1, last_attempted_at: new Date(Date.UTC(2026, 8, 1 + Math.floor(rand() * 40))).toISOString() }]));
    const worlds = [
      {},
      { progress: progressFor(), recent: sample(60), weak: new Set(['concept_1', 'concept_5']) },
      { holds: new Set(rows.filter((row) => row.evidence).slice(0, 6).map((row) => row.family_id)), progress: progressFor() },
      { groups: { 'grp-0': { text: 'A passage about partnership.', title: 'P0' }, 'grp-1': { text: 'A passage about shares.', title: 'P1' } } },
    ];
    const optionSets = [
      {},
      { userId: 'u1' },
      { userId: 'u1', excludeQuestionIds: [...sample(25)], excludeFamilyIds: ['fam-legacy-3', 'fam-legacy-9'] },
      { userId: 'u1', chapters: ['Partnership', 'Ratios'] },
      { difficulty: 'hard' },
      { userId: 'u1', requireEvidence: true },
      { chapter: 'Cash Flow', userId: 'u1' },
    ];
    for (const [mode, count] of MODES) {
      for (let k = 0; k < worlds.length; k += 1) {
        const opts = optionSets[(seed + k + count) % optionSets.length];
        const result = await compare(rows, { mode, count, opts, world: { opts, ...worlds[k] } });
        compared += 1;
        if (result.slim === FALLBACK) continue; // proven separately; the caller then runs the full read
        fastPath += 1;
        assert.deepEqual(result.slim, result.expected, `seed ${seed} ${mode} x${count} world ${k} ${JSON.stringify(opts)}`);
        assert.deepEqual(result.slim.selected.map((row) => row.id), result.expected.selected.map((row) => row.id));
        assert.equal(result.after.tally.progressIdCalls.length <= 1, true);
        fullRowsReadTotal += result.after.stats.fullRowsRead;
      }
    }
  }
  assert.ok(compared >= 100, `scenarios compared: ${compared}`);
  assert.ok(fastPath / compared > 0.9, `the slim path served ${fastPath} of ${compared}; fallbacks must stay rare`);
  assert.ok(fullRowsReadTotal > 0);
});

test('the slim read moves a fraction of the bytes of the full read, and reads full rows only for picks and the newest window', async () => {
  const rows = buildSubject(21, { legacy: 700, managed: 150, period: 40 });
  const mode = getMode('quick');
  for (const count of [10, 20, 50]) {
    const result = await compare(rows, { mode: 'quick', count, opts: {}, world: {} });
    assert.notEqual(result.slim, FALLBACK);
    assert.deepEqual(result.slim, result.expected);
    const slimBytes = result.after.tally.lightBytes + result.after.tally.fullRowBytes;
    const ratio = slimBytes / result.before.tally.fullPoolBytes;
    console.log(`  [bytes] x${count}: full ${result.before.tally.fullPoolBytes} slim ${slimBytes} (${(ratio * 100).toFixed(0)}%), full rows read ${result.after.tally.fullRowsRead}, rounds ${result.after.stats.rounds}`);
    assert.ok(ratio < (count <= 10 ? 0.4 : 0.8), `x${count}: slim ${slimBytes} vs full ${result.before.tally.fullPoolBytes}`);
    assert.ok(result.after.tally.fullRowsRead <= 3 * count + 30, `x${count}: full rows read ${result.after.tally.fullRowsRead}`);
    assert.ok(result.after.stats.rounds >= 2 && result.after.stats.rounds <= 8, JSON.stringify(result.after.stats));
  }
  assert.equal(mode.id, 'quick');
});

test('a pool that is mostly rejected evidence rows still ends with identical picks', async () => {
  // 120 managed rows, four in five of them failing the full gate, and few legacy rows to fall back on.
  const rows = buildSubject(31, { legacy: 40, managed: 120 });
  for (const [mode, count] of [['quick', 10], ['full', 50], ['smart', 15]]) {
    const result = await compare(rows, { mode, count, opts: { userId: 'u9' }, world: { opts: { userId: 'u9' }, recent: new Set(rows.slice(0, 30).map((row) => row.id)) } });
    if (result.slim === FALLBACK) continue;
    assert.deepEqual(result.slim, result.expected, `${mode} x${count}`);
  }
});

test('an empty subject gives the same empty result without reading any evidence', async () => {
  const rows = buildSubject(41, { legacy: 30, managed: 5 });
  const result = await compare(rows, { mode: 'quick', count: 10, opts: { chapter: 'No Such Chapter' }, world: { opts: { chapter: 'No Such Chapter' } } });
  assert.deepEqual(result.slim, result.expected);
  assert.deepEqual(result.slim.selected, []);
  assert.equal(result.after.tally.fullRowsRead, 0);
});

test('the recency trim straddling the threshold is not guessed: the slim path hands over to the full read', async () => {
  // Few legacy rows, almost all recent, so the trimmed count depends on which managed rows pass.
  const rows = buildSubject(51, { legacy: 14, managed: 30 });
  const legacyIds = new Set(rows.filter((row) => row.id.startsWith('q-')).map((row) => row.id));
  const opts = { userId: 'u2' };
  const world = { opts, recent: legacyIds };
  const mode = getMode('quick');
  const source = makeSource(rows, { mode, ...world });
  const expected = await pickFromFullPool(makeSource(rows, { mode, ...world }), { mode, targetCount: 30, opts });
  const viaWrapper = await selectPracticeQuestions(source, { mode, targetCount: 30, opts, warn: () => {} });
  assert.deepEqual(viaWrapper, expected, 'whether or not the slim path answered, the result equals the full read');
});

test('a read error in the slim path falls back to the full read instead of failing the session start', async () => {
  const rows = buildSubject(61);
  const mode = getMode('quick');
  const broken = makeSource(rows, { mode });
  broken.loadLightPool = async () => { throw new Error('json path columns unsupported'); };
  const warned = [];
  const result = await selectPracticeQuestions(broken, { mode, targetCount: 10, opts: {}, warn: (info) => warned.push(info.reason) });
  assert.deepEqual(result, await pickFromFullPool(makeSource(rows, { mode }), { mode, targetCount: 10, opts: {} }));
  assert.deepEqual(warned, ['slim_error']);
  const off = await selectPracticeQuestions(makeSource(rows, { mode }), { mode, targetCount: 10, opts: {} }, { slim: false });
  assert.deepEqual(off, result);
});
