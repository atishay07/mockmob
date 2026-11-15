// L4 (15 Nov 2026): POST /api/sessions sends only a real recovery to the recovery path (free Quick 5); every other start is a
// Practice start, charged as Practice charges. The real route and gate run here; the two start paths are stand-ins that
// record which one was chosen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const STUBS = {
  'src/lib/auth.ts': 'export async function auth() { return { user: { id: "u1" } }; }',
  'src/lib/server/rateLimit.js': 'export async function checkPersistentRateLimit() { return { allowed: true }; }',
  'src/lib/server/mobileCors.js': 'export const mobileOptions = () => ({});',
  'src/lib/server/funnelOnceStore.js': 'export const countStepOnce = () => {};',
  'src/lib/server/funnelOnce.js': 'export const funnelStepsForSession = () => [];',
  'src/lib/server/badgesStore.js': 'export const forgetBadges = () => {};',
  'src/lib/server/recoverySessions.js': 'export async function startSession() { return { path: "recovery" }; } export async function finishSession() { return {}; } export async function recordEvents() { return {}; }',
  'src/lib/server/practiceSessions.js': 'export async function startPractice() { return { path: "practice" }; } export async function finishPractice() { return {}; }',
  'data/db.js': 'export const Database = { getAttemptById: async (id) => globalThis.__l4.attempts[id] ?? null };',
};
const EXT = ['', '.js', '.mjs', '.jsx', '.ts', '/index.js'];
const probe = (base) => { for (const ext of EXT) { const f = base + ext; if (existsSync(f) && statSync(f).isFile()) return f; } return null; };
const ours = (url) => typeof url === 'string' && url.startsWith(pathToFileURL(ROOT).href) && !url.includes('/node_modules/');
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,', shortCircuit: true };
    let found = null;
    if (specifier.startsWith('@/')) found = probe(path.join(ROOT, 'src', specifier.slice(2)));
    else if (/^\.\.?\//.test(specifier) && ours(context.parentURL)) found = probe(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier));
    if (!found) return next(specifier, context);
    const rel = path.relative(ROOT, found).split(path.sep).join('/');
    if (Object.hasOwn(STUBS, rel)) return { url: `data:text/javascript,${encodeURIComponent(STUBS[rel])}`, shortCircuit: true };
    return { url: pathToFileURL(found).href, shortCircuit: true };
  },
});

const attempt = (over = {}) => ({
  id: 'att1', userId: 'u1', subject: 'english',
  questionsSnapshot: [{ id: 'q1', chapter: 'Vocabulary' }, { id: 'q2', chapter: 'Correct Word Usage' }],
  details: [{ qid: 'q1', isCorrect: true }, { qid: 'q2', isCorrect: false }],
  selectionMeta: { scoringVersion: 'server_practice_v1' },
  ...over,
});
globalThis.__l4 = { attempts: {} };
const { POST } = await import(pathToFileURL(path.join(ROOT, 'src/app/api/sessions/route.js')).href);
const start = async (body, attempts = {}) => {
  globalThis.__l4 = { attempts };
  const res = await POST(new Request('https://mockmob.test/api/sessions', { method: 'POST', body: JSON.stringify({ generationKey: 'k_0123456789abc', mode: 'quick', count: '5', ...body }) }));
  return (await res.json()).path;
};

test('L4: a start with no experience and no recovery is a Practice start (it was a free recovery start)', async () => {
  assert.equal(await start({ subject: 'english' }), 'practice');
  assert.equal(await start({ subject: 'english', experience: 'recovery' }), 'practice');
  assert.equal(await start({ subject: 'english', experience: 'practice' }), 'practice');
});

test('L4: a replay of a chapter the student\'s own attempt missed is a recovery start; an episode check too', async () => {
  const mine = { att1: attempt() };
  assert.equal(await start({ subject: 'english', chapter: 'Correct Word Usage', recoveryFrom: 'att1', experience: 'recovery' }, mine), 'recovery');
  assert.equal(await start({ episodeId: 'ep1' }), 'recovery');
});

test('L4: a recoveryFrom that is not a real replay takes the Practice path', async () => {
  const cases = [
    ['another student\'s attempt', { att1: attempt({ userId: 'u2' }) }, { chapter: 'Correct Word Usage' }],
    ['a chapter the attempt got right', { att1: attempt() }, { chapter: 'Vocabulary' }],
    ['no chapter at all', { att1: attempt() }, {}],
    ['another subject', { att1: attempt() }, { subject: 'economics', chapter: 'Correct Word Usage' }],
    ['an attempt that does not exist', {}, { chapter: 'Correct Word Usage' }],
    ['a Mob paper still held', { att1: attempt({ selectionMeta: { mobPaper: { mobId: 'm', weekStart: '2026-11-09', holdUntil: '2099-01-01T00:00:00.000Z' } } }) }, { chapter: 'Correct Word Usage' }],
  ];
  for (const [label, attempts, body] of cases) {
    assert.equal(await start({ subject: 'english', recoveryFrom: 'att1', experience: 'recovery', ...body }, attempts), 'practice', label);
  }
});

test('L4: a resume by session id stays on the Practice path as before', async () => {
  assert.equal(await start({ sessionId: 's1' }), 'practice');
});
