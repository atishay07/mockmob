// "Where you stand" (src/services/mobi/standing.js readStanding) leaves out a Mob paper still held for the Mob, whether its
// row carries the Mob tag or not (the summary-function tier drops it), so closeFastest never names its wrong and blank chapters.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const STUBS = {
  'data/db.js': 'export const Database = { getAttempts: async () => globalThis.__hold.attempts };',
  'data/subjects.js': 'export const SUBJECTS = [];',
  'data/cuet_controls.js': 'export const toPublicSubjectId = (s) => s;',
  'data/prepos_insights.js': 'export const computePrepOSInsights = () => ({ chapters: { ranked: [] } });',
  'data/mobi_standing.js': 'export const buildStanding = ({ attempts }) => ({ ids: attempts.map((a) => a.id) });',
  'src/lib/server/myColleges.js': 'export const getColleges = async () => [];',
  'src/lib/server/duOfferings.js': 'export const offeringsFor = () => [];',
  'src/lib/supabase.js': 'export const supabaseAdmin = () => globalThis.__hold.db;',
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

// The held-papers read (answerHold.js readHeldMobPapers): the student's tagged attempts of the last 16 days.
const heldDb = (rows, error = null) => {
  const q = { select: () => q, eq: () => q, not: () => q, gte: () => q, then: (res, rej) => Promise.resolve({ data: error ? null : rows, error }).then(res, rej) };
  return { from: () => q };
};
const OPEN_UNTIL = new Date(Date.now() + 3 * 86_400_000).toISOString();
const held = { id: 'mob1', completed_at: new Date().toISOString(), mobPaper: { mobId: 'm1', weekStart: '2026-11-09', holdUntil: OPEN_UNTIL }, details: [{ qid: 'q1' }] };
const { readStanding } = await import(pathToFileURL(path.join(ROOT, 'src/services/mobi/standing.js')).href);

test('a held Mob paper is left out of the standing, tagged or not', async () => {
  // Untagged rows (the summary-function tier): only the held-papers read knows mob1 is held.
  globalThis.__hold = { attempts: [{ id: 'solo1', subject: 'accountancy' }, { id: 'mob1', subject: 'accountancy' }], db: heldDb([held]) };
  assert.deepEqual(await readStanding('u1'), { ids: ['solo1'] });
  // Tagged rows passed in by a caller.
  globalThis.__hold = { attempts: [], db: heldDb([]) };
  const tagged = [{ id: 'solo1', subject: 'accountancy' }, { id: 'mob2', subject: 'accountancy', selectionMeta: { mobPaper: { mobId: 'm1', weekStart: '2026-11-09', holdUntil: OPEN_UNTIL } } }];
  assert.deepEqual(await readStanding('u1', { attempts: tagged }), { ids: ['solo1'] });
});

test('a paper whose hold has ended counts again; a failed held-papers read refuses rather than show a held paper', async () => {
  globalThis.__hold = { attempts: [{ id: 'mob1', subject: 'accountancy' }], db: heldDb([{ ...held, mobPaper: { ...held.mobPaper, holdUntil: '2026-01-01T00:00:00.000Z' } }]) };
  assert.deepEqual(await readStanding('u1'), { ids: ['mob1'] });
  globalThis.__hold = { attempts: [{ id: 'mob1', subject: 'accountancy' }], db: heldDb([], { message: 'down' }) };
  await assert.rejects(readStanding('u1'));
});
