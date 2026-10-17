// A saved attempt can earn a badge, and the server keeps a student's badge list for 5 minutes (badgesStore.js). So the routes that
// save an attempt drop that one student's cached list (forgetBadges), and the result's earned row and Progress read it fresh
// (BADGES-REFINE-1018, release 6 integration). The real badgesStore and the real /api/sessions route run here; only the edges
// (the database, the session, the rate limit, the two session writers) are stubs. No network, no database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { computeRhythm } from '../../src/lib/server/rhythm.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const ROOT_URL = pathToFileURL(`${root}/`).href;

const HOOKS = `
import { fileURLToPath } from 'node:url';
import { statSync } from 'node:fs';
const ROOT = ${JSON.stringify(ROOT_URL)};
const STUBS = {
  'server-only': 'export {};',
  '@/lib/supabase': 'export const supabaseAdmin = () => globalThis.__bf.db();',
  '@/lib/auth': 'export async function auth() { return globalThis.__bf.session; }',
  '@/lib/server/rateLimit': 'export async function checkPersistentRateLimit() { return { allowed: true }; }',
  '@/lib/server/mobileCors': 'export const mobileOptions = () => ({});',
  '@/lib/server/recoverySessions': 'export const startSession = async () => ({ ok: true }); export const finishSession = async (userId, body) => globalThis.__bf.finish(userId, body); export const recordEvents = async () => ({ ok: true });',
  '@/lib/server/practiceSessions': 'export const startPractice = async () => ({ ok: true }); export const finishPractice = async (userId, body) => globalThis.__bf.finish(userId, body);',
  '@/lib/server/funnelOnceStore': 'export const countStepOnce = () => {};',
  '@/lib/server/funnelOnce': 'export const funnelStepsForSession = () => [];',
};
// The rhythm read is the other thing the store calls; it is a stub keyed by the file it resolves to.
const FILE_STUBS = {
  'src/lib/server/appPrefs.js': 'export async function getRhythm(userId) { globalThis.__bf.reads.push(userId); return globalThis.__bf.rhythm; }',
};
const ours = (url) => typeof url === 'string' && url.startsWith(ROOT) && !url.includes('/node_modules/');
const isFile = (url) => { try { return statSync(fileURLToPath(url)).isFile(); } catch { return false; } };
export async function resolve(specifier, context, next) {
  if (Object.hasOwn(STUBS, specifier)) return { url: 'stub:' + specifier, shortCircuit: true };
  if (ours(context.parentURL) && (specifier.startsWith('@/') || specifier.startsWith('./') || specifier.startsWith('../'))) {
    const base = specifier.startsWith('@/') ? new URL('src/' + specifier.slice(2), ROOT).href : new URL(specifier, context.parentURL).href;
    for (const ext of ['', '.js', '.jsx', '.mjs']) {
      if (!isFile(base + ext)) continue;
      const rel = (base + ext).slice(ROOT.length);
      if (Object.hasOwn(FILE_STUBS, rel)) return { url: 'stub:file:' + rel, shortCircuit: true };
      return { url: base + ext, shortCircuit: true };
    }
  }
  return next(specifier, context);
}
export async function load(url, context, next) {
  if (url.startsWith('stub:file:')) return { format: 'module', source: FILE_STUBS[url.slice(10)], shortCircuit: true };
  if (url.startsWith('stub:')) return { format: 'module', source: STUBS[url.slice(5)], shortCircuit: true };
  return next(url, context);
}
`;

const NOW = Date.parse('2026-10-16T10:00:00+05:30');
// The one slim read of the student's attempts: the same chain badgesStore calls, answering with no rows.
const chain = () => {
  const q = { select: () => q, eq: () => q, in: () => q, order: () => q, limit: async () => ({ data: [], error: null }) };
  return q;
};
globalThis.__bf = {
  reads: [],
  session: { user: { id: 'u1' } },
  rhythm: computeRhythm({ activities: [], daysPerWeek: 1, now: NOW, firstHoldAt: null }),
  db: () => ({ from: () => chain() }),
  finish: async () => ({ ok: true }),
};
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);
const url = (rel) => pathToFileURL(resolve(root, rel)).href;
const { getBadges, forgetBadges } = await import(url('src/lib/server/badgesStore.js'));
const sessions = await import(url('src/app/api/sessions/route.js'));

const request = (method, body) => new Request('http://localhost/api/sessions', { method, body: JSON.stringify(body) });
const prime = async (userId) => { forgetBadges(userId); await getBadges(userId, NOW); assert.equal((await getBadges(userId, NOW)).cached, true, `${userId} is cached`); };
const cachedNow = async (userId) => (await getBadges(userId, NOW)).cached;

test('forgetBadges drops that student\'s cached list and no one else\'s', async () => {
  await prime('u1');
  await prime('u2');
  const readsBefore = globalThis.__bf.reads.length;
  forgetBadges('u1');
  assert.equal(await cachedNow('u2'), true, 'another student keeps theirs');
  assert.equal(globalThis.__bf.reads.length, readsBefore, 'nothing was read for the student who kept it');
  assert.equal(await cachedNow('u1'), false, 'the next read for u1 is a fresh one');
  assert.equal(globalThis.__bf.reads.length, readsBefore + 1, 'and it did read their record again');
  assert.equal(await cachedNow('u1'), true, 'then it is cached again');
});

test('finishing a session or a practice set drops the signed-in student\'s cached badge list', async () => {
  for (const body of [{ sessionTicket: 't-1' }, { sessionId: 's-1' }]) {
    await prime('u1');
    const response = await sessions.PATCH(request('PATCH', body));
    assert.equal(response.status, 200);
    assert.equal(await cachedNow('u1'), false, `a finished ${body.sessionTicket ? 'practice set' : 'session'} clears u1`);
  }
});

test('only the student who finished is cleared; a start, an event batch and a failed finish clear nothing', async () => {
  await prime('u1');
  await prime('u2');
  globalThis.__bf.session = { user: { id: 'u2' } };
  assert.equal((await sessions.PATCH(request('PATCH', { sessionTicket: 't' }))).status, 200);
  assert.equal(await cachedNow('u1'), true, 'u1 is untouched by u2 finishing');
  assert.equal(await cachedNow('u2'), false, 'u2 is cleared');

  globalThis.__bf.session = { user: { id: 'u1' } };
  await prime('u1');
  assert.equal((await sessions.POST(request('POST', { sessionId: 's-2' }))).status, 200);
  assert.equal((await sessions.PUT(request('PUT', { events: [] }))).status, 200);
  assert.equal(await cachedNow('u1'), true, 'starting a session and recording events save no attempt');

  const finish = globalThis.__bf.finish;
  globalThis.__bf.finish = async () => { throw new Error('SESSION_NOT_FOUND'); };
  try {
    assert.equal((await sessions.PATCH(request('PATCH', { sessionTicket: 'gone' }))).status, 404);
  } finally { globalThis.__bf.finish = finish; }
  assert.equal(await cachedNow('u1'), true, 'a finish that saved nothing leaves the list alone');
});

test('a signed-out finish clears nothing', async () => {
  await prime('u1');
  globalThis.__bf.session = null;
  assert.equal((await sessions.PATCH(request('PATCH', { sessionTicket: 't' }))).status, 401);
  globalThis.__bf.session = { user: { id: 'u1' } };
  assert.equal(await cachedNow('u1'), true);
});

test('the routes that turn an expired session into a result drop the list too', () => {
  const attempts = read('src/app/api/attempts/route.js');
  assert.match(attempts, /import \{ forgetBadges \} from '@\/lib\/server\/badgesStore';/);
  assert.match(attempts, /if \(finalised\?\.finalised\) forgetBadges\(session\.user\.id\);/);
  const summary = read('src/app/api/attempts/summary/route.js');
  assert.match(summary, /import \{ forgetBadges \} from '@\/lib\/server\/badgesStore';/);
  assert.match(summary, /if \(finalised\?\.finalised\) forgetBadges\(session\.user\.id\);/);
  const route = read('src/app/api/sessions/route.js');
  assert.match(route, /if \(funnelKind === 'finish'\) forgetBadges\(session\.user\.id\);/);
});
