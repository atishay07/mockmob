// Fixtures for the egress equality tests (16 Oct 2026). Software fixtures shaped like production rows:
// the question columns are the 55 of public.questions (checked read-only against production on 16 Oct 2026),
// evidence is a signed record bound to the real shipped registry (the same construction as
// data/tests/practice_pick_parity.test.mjs), attempts carry the real attemptOut shape.
// Nothing here establishes academic reliability.
import { readFileSync } from 'node:fs';
import { PRACTICE_QUESTION_COLUMNS, PRACTICE_HEAVY_COLUMNS } from '../../practice_pick.js';
import { currentRegistry } from '../../evidence_registry.js';
import { contentHash, evidenceSignature } from '../../content_evidence.js';

export const SECRET = 'software-fixture-secret';
export const ALL_COLUMNS = [...PRACTICE_QUESTION_COLUMNS, ...PRACTICE_HEAVY_COLUMNS];

export function setFixtureSecret() {
  const saved = { key: process.env.CUET_EVIDENCE_SIGNING_KEY, mock: process.env.MOCK_AI };
  process.env.CUET_EVIDENCE_SIGNING_KEY = SECRET;
  delete process.env.MOCK_AI;
  return () => {
    if (saved.key === undefined) delete process.env.CUET_EVIDENCE_SIGNING_KEY; else process.env.CUET_EVIDENCE_SIGNING_KEY = saved.key;
    if (saved.mock !== undefined) process.env.MOCK_AI = saved.mock;
  };
}

export function rng(seed) {
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
const SUBJECTS = ['accountancy', 'physics', 'history'];

export const fullRow = (over) => Object.assign(Object.fromEntries(ALL_COLUMNS.map((column) => [column, null])), over);

/** A pre-evidence library row (no evidence, no provenance), with junk in every column the counts must not read. */
export function legacyRow(rand, n, { subject } = {}) {
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const words = [0, 1, 2, 3].map(() => WORDS[Math.floor(rand() * WORDS.length)]);
  const key = Math.floor(rand() * 4);
  const status = rand() < 0.8 ? 'live' : pick(['pending', 'quarantined', 'rejected', 'invalid']);
  const lane = status === 'live' ? {} : (rand() < 0.5 ? { verification_state: 'verified', exploration_state: 'active' } : {});
  const id = `q-${String(n).padStart(4, '0')}`;
  const row = fullRow({
    id, subject: subject || pick(SUBJECTS), chapter: pick(CHAPTERS), topic: pick(['Goodwill', 'Dissolution', null]),
    body: `Which statement about ${words[0]} and ${words[1]} number ${n} is correct?`,
    question: `Which statement about ${words[0]} and ${words[1]} number ${n} is correct?`,
    options: words.map((word, i) => `The ${word} treatment ${n}-${i} follows the stated rule`),
    correct_answer: 'ABCD'[key], correct_index: key, explanation: rand() < 0.1 ? `The correct answer is ${'ABCD'[(key + 1) % 4]} here.` : `The stated rule for ${words[key]} applies in case ${n}.`,
    difficulty: pick(['easy', 'medium', 'hard']), status, is_deleted: rand() < 0.03, created_at: new Date(Date.UTC(2026, 3, 1 + Math.floor(rand() * 120))).toISOString(),
    score: Math.floor(rand() * 8) - 3, concept_id: `concept_${Math.floor(rand() * 14)}`, concept: rand() < 0.5 ? `concept ${n % 9}` : null,
    family_id: rand() < 0.35 ? `fam-legacy-${Math.floor(rand() * 40)}` : null,
    passage_group_id: rand() < 0.04 ? `grp-${Math.floor(rand() * 3)}` : null,
    question_type: pick(['mcq', 'synonym', null]),
    // Columns no counted path reads: random junk, so a hidden dependency would change an output.
    quality_score: rand(), momentum_score: rand(), exposure_used: Math.floor(rand() * 9), tags: rand() < 0.5 ? ['x', 'y'] : [], upvotes: Math.floor(rand() * 5),
    ai_tier: pick(['A', 'B', null]), content_hash: `h${Math.floor(rand() * 1e6)}`, uploaded_by: 'u-fixture', source: 'fixture', updated_at: new Date().toISOString(),
    ...lane,
  });
  if (rand() < 0.06) row.verification_state = 'disputed';
  if (rand() < 0.04) row.legacy_screening = { verdict: 'no_issue_found', content_hash: 'stale', question_id: id, review_version: 'subscription-screen-v1', reviewed_at: new Date().toISOString(), scope: 'local_mechanical', local_findings: [] };
  if (rand() < 0.03) row.options = ['same', 'same', 'other one', 'last one']; // fails the answer-integrity check
  return row;
}

/** Evidence-managed rows bound to the shipped registry: eligible ones and the ways a record can fail. */
export function managedRows(rand, startN, count, { padding = 30000, subject = 'accountancy', key = 0 } = {}) {
  const registry = currentRegistry();
  const manifest = JSON.parse(readFileSync(new URL('../../calibration_manifest.json', import.meta.url), 'utf8'));
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
      id, subject, chapter: CHAPTERS[i % CHAPTERS.length],
      body: `Managed question ${i} on ${words[0]}`, question: `Managed question ${i} on ${words[0]}`,
      options: words.map((word, k) => `The ${word} entry ${id}-${k} is posted`), correct_answer: 'ABCD'[key], correct_index: key,
      explanation: `Posting follows the ${words[0]} rule here.`, difficulty: ['easy', 'medium', 'hard'][i % 3], status: 'live',
      created_at: new Date(Date.UTC(2026, 5, 1 + Math.floor(rand() * 100))).toISOString(), score: Math.floor(rand() * 6) - 1,
      concept_id: `concept_${Math.floor(rand() * 14)}`, family_id: familyId, is_deleted: false, quality_score: rand(), exposure_used: Math.floor(rand() * 9),
    });
    const record = {
      candidate_id: id, content_hash: contentHash(row), family_id: familyId, family_version: family.version, state: 'published', route: 'conceptual',
      verifier_version: verifier, verified_at: new Date().toISOString(), expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      sources: [{ id: sourceId, version: source.version, locator, support_hash: supportHash }], solved_key: 'ABCD'[key], checks: {},
      notes: 'x'.repeat(padding), // a real record is about 35 KB; the padding makes byte comparisons meaningful
    };
    const kind = i % 7;
    if (kind === 1) record.expires_at = new Date(Date.now() - 1000).toISOString(); // stale
    if (kind === 2) { record.policy_version = 'cuet-llm-v3'; row.provenance = { kind: 'factory' }; } // factory-looking, fails the full gate
    for (const stage of ['schema', 'dedupe', 'source_support', 'blind_solution', 'alternatives', 'explanation_support', 'exam_fit']) {
      record.checks[stage] = { passed: true, evidence_hash: 'fixture-check', candidate_id: id, content_hash: record.content_hash };
    }
    row.evidence = { record, signature: kind === 3 ? 'bad-signature' : evidenceSignature(record, SECRET) };
    if (kind === 4) row.explanation = 'Changed after the evidence was signed.'; // content_changed
    if (kind === 5) row.status = 'pending';
    if (kind !== 2) row.provenance = null;
    out.push(row);
  }
  return out;
}

export function buildBank(seed, { legacy = 220, managed = 28 } = {}) {
  const rand = rng(seed);
  const rows = [];
  for (let n = 0; n < legacy; n += 1) rows.push(legacyRow(rand, n));
  rows.push(...managedRows(rand, 1000, managed));
  return rows;
}

// ---- A supabase-js style fake over fixture rows, with real column projection ----------------------------------
const jsonPath = (value, path) => path.reduce((node, key) => (node && typeof node === 'object' ? node[key] : null), value) ?? null;
export const bytesOf = (value) => Buffer.byteLength(JSON.stringify(value));
const VISIBLE = (r) => r.status === 'live' || (r.verification_state === 'verified' && r.exploration_state === 'active');

/** One projected row as PostgREST returns it. `strict` rows throw when code reads a real column that was not selected. */
export function projectRow(row, select, { strict = true } = {}) {
  if (select.trim() === '*') return structuredClone(row);
  const out = {};
  for (const part of select.split(',').map((s) => s.trim()).filter(Boolean)) {
    const alias = part.match(/^(\w+):(\w+)((?:->>?\w+)+)$/);
    if (alias) { out[alias[1]] = jsonPath(row[alias[2]], alias[3].split(/->>?/).filter(Boolean)); continue; }
    if (!ALL_COLUMNS.includes(part)) throw new Error(`unknown column ${part}`);
    out[part] = structuredClone(row[part]);
  }
  if (!strict) return out;
  return new Proxy(out, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && ALL_COLUMNS.includes(prop) && !(prop in target)) throw new Error(`READ OF UNSELECTED COLUMN ${prop}`);
      return Reflect.get(target, prop, receiver);
    },
  });
}

/**
 * A fake database. tables.questions is an array of full rows; other tables are plain row arrays.
 * Every select is recorded in `calls` with the bytes of the JSON it returned.
 */
export function fakeDb(tables, { strict = true } = {}) {
  const calls = [];
  const db = {
    calls,
    from(name) {
      const state = { select: '*', filters: [], or: null, order: null, range: null, not: [] };
      const run = () => {
        let rows = (tables[name] || []).slice();
        for (const [kind, column, value] of state.filters) {
          if (kind === 'eq') rows = rows.filter((r) => r[column] === value);
          if (kind === 'in') rows = rows.filter((r) => value.includes(r[column]));
        }
        for (const [column, value] of state.not) rows = rows.filter((r) => (value === null ? r[column] != null : true));
        if (state.or === 'visible') rows = rows.filter(VISIBLE);
        if (state.order) rows.sort((a, b) => (a[state.order] < b[state.order] ? -1 : a[state.order] > b[state.order] ? 1 : 0));
        if (state.range) rows = rows.slice(state.range[0], state.range[1] + 1);
        return rows;
      };
      const finish = (rows, single) => {
        const isQ = name === 'questions';
        const projected = rows.map((r) => (isQ ? projectRow(r, state.select, { strict }) : structuredClone(r)));
        calls.push({ table: name, select: state.select, rows: projected.length, bytes: bytesOf(rows.map((r) => (isQ ? projectRow(r, state.select, { strict: false }) : r))), filters: state.filters.map((f) => f.slice(0, 2).join(':')) });
        return single ? { data: projected[0] ?? null, error: null } : { data: projected, error: null };
      };
      const q = {
        select(columns) { state.select = columns ?? '*'; return q; },
        eq(column, value) { state.filters.push(['eq', column, value]); return q; },
        in(column, value) { state.filters.push(['in', column, value]); return q; },
        not(column, op, value) { state.not.push([column, value]); return q; },
        or(expression) { if (expression.startsWith('status.eq.live')) state.or = 'visible'; else throw new Error(`fake or() does not know ${expression}`); return q; },
        order(column) { state.order = column; return q; },
        range(a, b) { state.range = [a, b]; return q; },
        maybeSingle: async () => finish(run(), true),
        then(resolve, reject) { return Promise.resolve(finish(run(), false)).then(resolve, reject); },
      };
      return q;
    },
  };
  return db;
}
