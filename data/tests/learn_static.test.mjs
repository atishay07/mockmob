// Learn v2 static checks (A6-wiring.md test plan item 5): no AI or paid-model import in the Learn server or engine sources,
// no production route imports a preview or memory module, and every /api/learn route goes through learnHttp.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');
const imports = (src) => [...src.matchAll(/(?:import\s[^'"]*?from\s*|import\s*\(\s*|require\(\s*)['"]([^'"]+)['"]/g)].map((m) => m[1]);
const walk = (dir) => (existsSync(dir) ? readdirSync(dir).flatMap((name) => {
  const full = path.join(dir, name);
  return statSync(full).isDirectory() ? walk(full) : [full];
}) : []);

const LEARN_SERVER = readdirSync(path.join(root, 'src/lib/server')).filter((f) => /^learn.*\.js$/.test(f)).map((f) => `src/lib/server/${f}`);
const LEARN_ENGINE = readdirSync(path.join(root, 'data/learn')).filter((f) => f.endsWith('.js')).map((f) => `data/learn/${f}`);
const ROUTES = walk(path.join(root, 'src/app/api/learn')).filter((f) => f.endsWith('route.js')).map((f) => path.relative(root, f).split(path.sep).join('/'));
export const LEARN_ROUTES = Object.freeze({
  'src/app/api/learn/subject/route.js': ['GET'],
  'src/app/api/learn/home/route.js': ['GET'], // R2 speed.md item 3: the subject body and the shelves in one answer
  'src/app/api/learn/runs/route.js': ['POST'],
  'src/app/api/learn/runs/preview/route.js': ['POST'],
  'src/app/api/learn/runs/[id]/route.js': ['GET'],
  'src/app/api/learn/runs/[id]/answer/route.js': ['POST'],
  'src/app/api/learn/runs/[id]/rate/route.js': ['POST'],
  'src/app/api/learn/runs/[id]/end/route.js': ['GET'],
  'src/app/api/learn/cards/route.js': ['GET'],
  'src/app/api/learn/shelves/route.js': ['GET'],
  'src/app/api/learn/search/route.js': ['GET'],
  'src/app/api/learn/covers/route.js': ['GET'],
});

test('no AI or paid-model import in the Learn server and engine sources', () => {
  assert.ok(LEARN_SERVER.includes('src/lib/server/learn.js') && LEARN_SERVER.includes('src/lib/server/learnHttp.js'));
  for (const file of [...LEARN_SERVER, ...LEARN_ENGINE]) {
    for (const spec of imports(read(file))) {
      assert.doesNotMatch(spec, /openai|anthropic|runtimeAi|budgetLedger|aiClient|mobi/i, `${file} imports ${spec}`);
    }
  }
});

test('the production service and wrapper never import a preview or in-memory module', () => {
  for (const file of ['src/lib/server/learn.js', 'src/lib/server/learnStore.js', 'src/lib/server/learnHttp.js']) {
    for (const spec of imports(read(file))) assert.doesNotMatch(spec, /learnPreview|keycardsPreview|keycardsMemoryDb|fixtures/, `${file} imports ${spec}`);
  }
});

test('every /api/learn route exists, is dynamic, takes (request), goes through learnHttp and imports no preview module', () => {
  assert.deepEqual([...ROUTES].sort(), Object.keys(LEARN_ROUTES).sort(), 'the 12 route files (13 handlers with the rate Keep body)');
  for (const [file, methods] of Object.entries(LEARN_ROUTES)) {
    const src = read(file);
    assert.match(src, /export const dynamic = 'force-dynamic'/, file);
    for (const m of methods) assert.match(src, new RegExp(`export async function ${m}\\(request`), `${file} ${m}`);
    assert.match(src, /learnHttp\(request,/, `${file} calls learnHttp`);
    if (file.includes('[id]')) assert.match(src, /const \{ id \} = await params/, `${file} awaits params (Next 16)`);
    for (const spec of imports(src)) assert.doesNotMatch(spec, /learnPreview|keycardsPreview|keycardsMemoryDb/, `${file} imports ${spec}`);
  }
});
