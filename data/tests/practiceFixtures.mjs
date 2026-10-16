// Fixture subjects shared by the practice start tests (practice_pick_parity, practice_verdicts): legacy rows,
// evidence-managed rows bound to the real shipped registry (eligible, stale, factory-looking, bad signature,
// content changed) and the helpers that describe them. Software fixtures; they do not establish academic reliability.
import { readFileSync } from 'node:fs';
import { PRACTICE_HEAVY_COLUMNS, PRACTICE_QUESTION_COLUMNS } from '../practice_pick.js';
import { currentRegistry } from '../evidence_registry.js';
import { contentHash, evidenceSignature } from '../content_evidence.js';

export const SECRET = 'software-fixture-secret';
process.env.CUET_EVIDENCE_SIGNING_KEY = SECRET;
delete process.env.MOCK_AI;

export const ALL_COLUMNS = [...PRACTICE_QUESTION_COLUMNS, ...PRACTICE_HEAVY_COLUMNS];

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

export const WORDS = ['ledger', 'journal', 'balance', 'capital', 'drawings', 'goodwill', 'premium', 'discount', 'reserve', 'dividend', 'debenture', 'partner', 'asset', 'liability', 'revenue', 'expense', 'cashbook', 'voucher', 'invoice', 'surplus'];
export const CHAPTERS = ['Partnership', 'Company Accounts', 'Cash Flow', 'Ratios'];
export const DIFFICULTIES = ['easy', 'medium', 'hard'];

export function fullRow(over) {
  const row = Object.fromEntries(ALL_COLUMNS.map((column) => [column, null]));
  return Object.assign(row, over);
}

export function legacyRow(rand, n) {
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
export function managedRows(rand, startN, count, registry, manifest, period = 7) {
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

export function buildSubject(seed, { legacy = 260, managed = 40, period = 7 } = {}) {
  const rand = rng(seed);
  const registry = currentRegistry();
  const manifest = JSON.parse(readFileSync(new URL('../calibration_manifest.json', import.meta.url), 'utf8'));
  const rows = [];
  for (let n = 0; n < legacy; n += 1) rows.push(legacyRow(rand, n));
  rows.push(...managedRows(rand, 1000, managed, registry, manifest, period));
  return rows;
}

export const visible = (row) => row.status === 'live' || (row.verification_state === 'verified' && row.exploration_state === 'active');
export const jsonPath = (value, ...path) => path.reduce((node, key) => (node && typeof node === 'object' ? node[key] : null), value) ?? null;
export const bytes = (value) => Buffer.byteLength(JSON.stringify(value));
