// L1 (15 Nov 2026): POST /api/ai/mentor/chat answers a student in distress with the fixed support reply before it reads the
// record, opens a doubt (1 credit), reserves a credit or calls a model. The real route runs here; every dependency it would
// reach is a stand-in that records the call (and the model, the wallet and the record paths throw if they are reached).
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const reached = (name) => `(...a) => { globalThis.__l1.calls.push(${JSON.stringify(name)}); throw new Error(${JSON.stringify(`${name} reached`)}); }`;
const STUBS = {
  'src/lib/auth.ts': 'export async function auth() { return { user: { id: "u1" } }; }',
  'src/lib/server/rateLimit.js': 'export async function checkPersistentRateLimit() { return { allowed: true }; }',
  'data/db.js': `export const Database = { getUserById: async (id) => ({ id, subjects: ['accountancy'], isPremium: false }), getAttempts: ${reached('getAttempts')} };`,
  'data/subjects.js': 'export const SUBJECTS = [];',
  'data/cuet_controls.js': 'export const toPublicSubjectId = (s) => s;',
  'data/prepos_insights.js': `export const computePrepOSInsights = ${reached('computePrepOSInsights')}; export const answerFromInsights = ${reached('answerFromInsights')};`,
  'src/services/ai/getStudentAIContext.js': `export const getStudentAIContext = ${reached('getStudentAIContext')};`,
  'src/services/ai/contextBudget.js': `export const capContextBytes = ${reached('capContextBytes')};`,
  'src/services/usage/getDailyUsage.js': 'export async function getUsageSnapshot() { return { tier: "free", isPaid: false, aiWallet: null, normalCreditBalance: 0 }; }',
  'src/lib/supabase.js': 'export const supabaseAdmin = () => globalThis.__l1.db;',
  'src/services/prepos/modelReply.js': `export const runModelReply = ${reached('runModelReply')}; export const operationKeyFor = (u, r) => \`prepos:\${u}:\${r}\`; export const PREPOS_PAUSED_MESSAGE = 'paused';`,
  'src/services/prepos/replyDeps.js': `export const buildReplyDeps = ${reached('buildReplyDeps')}; export const modelRepliesOpen = () => true;`,
  'src/services/credits/aiCreditWallet.js': 'export const isPaidUser = () => false;',
  'src/lib/server/study.js': `export const studyTutorContext = ${reached('studyTutorContext')};`,
  'data/study_help.js': 'export const studyHelpReplay = () => null;',
  'src/services/recovery/askContext.js': `export const loadQuestionContext = ${reached('loadQuestionContext')};`,
  'src/services/recovery/repairCheckDeps.js': 'export const buildCheckDeps = () => ({});',
  'src/services/mobi/doubtThread.js': `export const openThread = ${reached('openThread')}; export const followUpThread = ${reached('followUpThread')}; export const resolveAnchor = ${reached('resolveAnchor')};`,
  'src/services/mobi/doubtThreadDeps.js': `export const buildThreadDeps = ${reached('buildThreadDeps')}; export const chapterCatalog = () => [];`,
  'data/mobi_tonight.js': `export const asksTonight = ${reached('asksTonight')};`,
  'src/services/mobi/tonight.js': `export const readTonight = ${reached('readTonight')};`,
  'src/lib/server/answerHold.js': 'export const openAttemptsOnly = (a) => a;',
};
const EXT = ['', '.js', '.mjs', '.jsx', '.ts', '/index.js'];
const probe = (base) => { for (const ext of EXT) { const f = base + ext; if (existsSync(f) && statSync(f).isFile()) return f; } return null; };
const ours = (url) => typeof url === 'string' && url.startsWith(pathToFileURL(ROOT).href) && !url.includes('/node_modules/');
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,', shortCircuit: true };
    if (specifier === 'next/server') return { url: `data:text/javascript,${encodeURIComponent('export const NextResponse = { json: (b, i) => Response.json(b, i) };')}`, shortCircuit: true };
    let found = null;
    if (specifier.startsWith('@/')) found = probe(path.join(ROOT, 'src', specifier.slice(2)));
    else if (/^\.\.?\//.test(specifier) && ours(context.parentURL)) found = probe(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier));
    if (!found) return next(specifier, context);
    const rel = path.relative(ROOT, found).split(path.sep).join('/');
    if (Object.hasOwn(STUBS, rel)) return { url: `data:text/javascript,${encodeURIComponent(STUBS[rel])}`, shortCircuit: true };
    return { url: pathToFileURL(found).href, shortCircuit: true };
  },
});

// A Supabase-like client that records writes: mentor_sessions, mentor_messages, ai_reply_reports.
function fakeDb() {
  const writes = [];
  const from = (table) => {
    const q = {
      op: 'select', table,
      select() { return q; }, eq() { return q; }, limit() { return q; },
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () => ({ data: q.op === 'insert' ? { id: 'session-1' } : null, error: null }),
      insert(row) { q.op = 'insert'; writes.push({ table, op: 'insert', row }); return q; },
      update(row) { q.op = 'update'; writes.push({ table, op: 'update', row }); return q; },
      upsert(row, options) { writes.push({ table, op: 'upsert', row, options }); return Promise.resolve({ error: null }); },
      then(res, rej) { return Promise.resolve({ data: null, error: null }).then(res, rej); },
    };
    return q;
  };
  return { from, writes };
}

globalThis.__l1 = { calls: [], db: null };
const { POST } = await import(pathToFileURL(path.join(ROOT, 'src/app/api/ai/mentor/chat/route.js')).href);
const { SUPPORT_REPLY } = await import('../../src/services/ai/supportCheck.js');
const post = (body) => POST(new Request('https://mockmob.test/api/ai/mentor/chat', { method: 'POST', body: JSON.stringify(body) }));

for (const [label, body] of [
  ['an Ask now doubt (1 credit)', { message: 'I want to kill myself', replyKind: 'doubt', subject: 'accountancy', requestId: 'req_0123456789abcdef' }],
  ['a free follow-up inside a doubt', { message: 'jeena nahi hai', threadId: 'thread-1', requestId: 'req_0123456789abcdef' }],
  ['a record question', { message: 'मैं मरना चाहता हूँ', requestId: 'req_0123456789abcdef' }],
  ['a question attached from a result', { message: "I can't go on", questionRef: 'att1:q1' }],
  ['a lesson help request', { message: 'no point living', studyRunId: 'run1', studyRevision: 1, studyItemId: 'i1' }],
]) {
  test(`L1: ${label} that sounds like distress gets the support reply; no record read, credit or model`, async () => {
    const db = fakeDb();
    globalThis.__l1 = { calls: [], db };
    const res = await post(body);
    const out = await res.json();
    assert.equal(res.status, 200);
    assert.deepEqual(globalThis.__l1.calls, [], 'nothing past the check was reached');
    assert.equal(out.reply, SUPPORT_REPLY);
    assert.equal(out.origin, 'safety');
    assert.deepEqual(out.charge, { kind: 'included', creditUnits: 0, amount: 0 });
    assert.deepEqual([out.cards, out.actions], [[], []]);
    assert.equal(out.runtimeState, 'safety');
    // The turn is saved as any free turn is; the safety row holds the fixed reply, never the student's words.
    const messages = db.writes.find((w) => w.table === 'mentor_messages');
    assert.deepEqual(messages.row.map((m) => m.role), ['user', 'assistant']);
    const report = db.writes.find((w) => w.table === 'ai_reply_reports');
    assert.equal(report.row.reason, 'support_reply');
    assert.equal(report.row.reply_excerpt, SUPPORT_REPLY);
    assert.equal(JSON.stringify(report.row).includes(body.message), false);
  });
}

test('L1: an ordinary question still goes the normal way (the check does not catch exam talk)', async () => {
  globalThis.__l1 = { calls: [], db: fakeDb() };
  // The stand-ins on the normal path throw on purpose: reaching them is the point.
  await post({ message: 'this chapter is killing me, how do I revise it?', replyKind: 'doubt', subject: 'accountancy', requestId: 'req_0123456789abcdef' }).catch(() => null);
  assert.ok(globalThis.__l1.calls.length > 0, 'the normal path was taken');
  assert.ok(!globalThis.__l1.db.writes.some((w) => w.table === 'ai_reply_reports'));
});
