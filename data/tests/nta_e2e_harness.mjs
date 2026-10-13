// Harness for the NTA end-to-end tests: runs the website's real route handlers (src/app/api/sessions,
// src/app/api/attempts) and real server code (practiceSessions, recoverySessions, data/db.js,
// data/nta_pool.js, data/nta_engine.js) in plain Node, with two stand-ins only: the Supabase client
// (data/tests/nta_e2e_supabase.mjs, over fixtures exported read-only from production) and sign-in
// (data/tests/nta_e2e_auth.mjs). No database, model or network is touched.
//
// Fixtures: node --use-system-ca scripts/nta-fixture-export.mjs  (writes tmp/nta-fixtures, select only).
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const FIXTURE_DIR = path.join(ROOT, 'tmp', 'nta-fixtures');
const here = (file) => pathToFileURL(path.join(ROOT, 'data', 'tests', file)).href;
const EXTENSIONS = ['', '.js', '.mjs', '.ts', '/index.js'];

function probe(base) {
  for (const extension of EXTENSIONS) {
    const file = base + extension;
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return pathToFileURL(file).href;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,', shortCircuit: true };
    if (specifier === '@/lib/supabase') return { url: here('nta_e2e_supabase.mjs'), shortCircuit: true };
    if (specifier === '@/lib/auth') return { url: here('nta_e2e_auth.mjs'), shortCircuit: true };
    if (specifier.startsWith('@/')) {
      const url = probe(path.join(ROOT, 'src', specifier.slice(2)));
      if (url) return { url, shortCircuit: true };
    }
    try { return next(specifier, context); } catch (error) {
      if (/^\.\.?\//.test(specifier) && context.parentURL?.startsWith('file:')) {
        const url = probe(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier));
        if (url) return { url, shortCircuit: true };
      }
      if (!/^[./@]/.test(specifier) || specifier.startsWith('@')) {
        for (const extension of ['.js']) { try { return next(specifier + extension, context); } catch { /* try the next */ } }
      }
      throw error;
    }
  },
});

export const fake = await import(here('nta_e2e_supabase.mjs'));

/** The signing key the production fixtures were signed with, read from .env.local; '' when absent. */
export function productionSigningKey() {
  try {
    const text = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8');
    const line = text.split(/\r?\n/).find((entry) => entry.startsWith('CUET_EVIDENCE_SIGNING_KEY='));
    return line ? line.slice('CUET_EVIDENCE_SIGNING_KEY='.length).trim() : '';
  } catch { return ''; }
}

export const fixturesAvailable = () => fs.existsSync(path.join(FIXTURE_DIR, 'manifest.json'));
export const readManifest = () => JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'manifest.json'), 'utf8'));
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf8'));
export const loadSubjectRows = (internal) => readJson(`${internal}.json`);
export const loadShared = () => readJson('shared.json');

// ---- environment ------------------------------------------------------------------------------
export const TEST_SECRET = 'nta-e2e-fixture-signing-key-0123456789';
export function configure({ signingKey, durable = false } = {}) {
  process.env.CUET_EVIDENCE_SIGNING_KEY = signingKey;
  process.env.PRACTICE_SESSION_SECRET = 'nta-e2e-practice-session-secret-0123456789abcdef';
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fake-service-role-key';
  process.env.PERSISTENT_LIMITS_ENABLED = 'false';
  if (durable) process.env.LEARNING_SESSIONS_ENABLED = 'true'; else delete process.env.LEARNING_SESSIONS_ENABLED;
}

// ---- modules under test (imported once, after the hooks above) --------------------------------
let modules = null;
export async function app() {
  if (modules) return modules;
  const content = await import(pathToFileURL(path.join(ROOT, 'data', 'content_evidence.js')).href);
  const pool = await import(pathToFileURL(path.join(ROOT, 'data', 'nta_pool.js')).href);
  const engine = await import(pathToFileURL(path.join(ROOT, 'data', 'nta_engine.js')).href);
  const sessions = await import(pathToFileURL(path.join(ROOT, 'src', 'app', 'api', 'sessions', 'route.js')).href);
  const attempts = await import(pathToFileURL(path.join(ROOT, 'src', 'app', 'api', 'attempts', 'route.js')).href).catch((error) => ({ importError: error }));
  const controls = await import(pathToFileURL(path.join(ROOT, 'data', 'cuet_controls.js')).href);
  const recovery = await import(pathToFileURL(path.join(ROOT, 'data', 'recovery.js')).href);
  modules = { content, pool, engine, sessions, attempts, controls, recovery };
  return modules;
}

// ---- fixtures ---------------------------------------------------------------------------------
/**
 * Synthetic scores for a local copy of a subject, signed with TEST_SECRET so the engine can verify
 * them: rows that carry production evidence keep its scores, solved keys and content hash (only the
 * signature changes), rows with no evidence get two judge scores of 8 and 9 and both blind solvers on
 * the stored key. This exercises the session path for subjects whose real questions are not scored
 * yet; it says nothing about those questions' quality.
 */
export function promoteRows(rows, content, { luna = 8, gemini = 9 } = {}) {
  return rows.map((row) => {
    if (row.evidence?.record) {
      return { ...row, evidence: { record: row.evidence.record, signature: content.evidenceSignature(row.evidence.record, TEST_SECRET) } };
    }
    const key = content.canonicalQuestion(row).key;
    const record = {
      candidate_id: row.id,
      content_hash: content.contentHash(row),
      solved_key: key,
      synthetic: true,
      checks: { exam_fit: { item_quality_score: luna }, independent_evaluation: { item_quality_score: gemini, solved_key: key } },
    };
    return { ...row, evidence: { record, signature: content.evidenceSignature(record, TEST_SECRET) } };
  });
}

/**
 * Loads one subject, or a list of subjects, and the shared tables into the fake.
 * mode: 'asis' (production scores) or 'promoted' (synthetic signed scores where production has none).
 */
export async function loadSubject(internal, { mode = 'asis', students = [] } = {}) {
  const { content, pool } = await app();
  const shared = loadShared();
  let rows = (Array.isArray(internal) ? internal : [internal]).flatMap((subject) => loadSubjectRows(subject));
  if (mode === 'promoted') rows = promoteRows(rows, content);
  fake.resetStore({ missing: ['nta_question_index', 'nta_paper_shortfalls'] });
  fake.seed('questions', rows);
  fake.seed('passage_groups', shared.passage_groups);
  fake.seed('question_content_disputes', shared.question_content_disputes);
  fake.seed('recovery_family_holds', shared.recovery_family_holds);
  fake.seed('users', students.map((student) => ({
    id: student.id, email: `${student.id}@example.test`, name: 'Test Student', role: 'student', credit_balance: student.credits ?? 0,
    subscription_status: student.premium === false ? 'free' : 'active', created_at: new Date().toISOString(),
  })));
  fake.seed('attempts', []);
  fake.seed('user_question_progress', []);
  fake.seed('recovery_sessions', []);
  pool.clearNtaPoolCache();
  return rows;
}

// ---- calling the real routes ------------------------------------------------------------------
let ipCounter = 0;
export async function call(method, body, userId, { path: url = '/api/sessions', route = 'sessions' } = {}) {
  const { sessions, attempts } = await app();
  const handlers = route === 'attempts' ? attempts : sessions;
  const headers = { 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${(ipCounter += 1) % 250}` };
  if (userId) headers['x-test-user'] = userId;
  const request = new Request(`http://localhost${url}`, { method, headers, body: JSON.stringify(body) });
  const response = await handlers[method](request);
  return { status: response.status, body: await response.json() };
}

let keyCounter = 0;
export const generationKey = (label) => `e2e_${label}_${Date.now().toString(36)}_${(keyCounter += 1)}`.replace(/[^a-zA-Z0-9_-]/g, '_');
