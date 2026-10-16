import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PRODUCTION_SUPABASE_REF, STAGING_SUPABASE_REF, classifyEnvText, nonProductionUsesProduction, pointsAtProduction, productionFromOutsideLine,
  resetDbTargetWarning, supabaseRef, warnIfProductionFromOutside,
} from '../db_target.js';
import {
  FullBankReadBlocked, assertScriptFullBankRead, scriptFullBankReadAllowed, scriptFullBankReadBlockedLine,
} from '../full_bank_guard.js';

// Finding 1 of the 16 Oct 2026 production health audit: whole-bank reads run on Vercel production only. The
// website side is data/full_bank_guard.js (tests/full_bank_guard.test.mjs). This file covers the project the
// process is pointed at, and the scripts that read the whole bank.
const PROD = `https://${PRODUCTION_SUPABASE_REF}.supabase.co`;
const STAGING = `https://${STAGING_SUPABASE_REF}.supabase.co`;
const root = fileURLToPath(new URL('../../', import.meta.url));

test('the project ref is the first label of the URL, and only the production ref counts as production', () => {
  assert.equal(supabaseRef(PROD), PRODUCTION_SUPABASE_REF);
  assert.equal(supabaseRef(`${STAGING}/rest/v1/`), STAGING_SUPABASE_REF);
  for (const bad of ['', undefined, null, 'not a url', 'isrxrxzjocewrdureyhp']) assert.equal(supabaseRef(bad), '', String(bad));
  assert.equal(pointsAtProduction(PROD), true);
  assert.equal(pointsAtProduction(PROD.toUpperCase()), true);
  assert.equal(pointsAtProduction(STAGING), false);
  assert.equal(pointsAtProduction('http://localhost:54321'), false);
  assert.equal(pointsAtProduction(`https://evil.example/${PRODUCTION_SUPABASE_REF}`), false);
});

test('a server that is not Vercel production but uses the production project is flagged; staging and production deploys are not', () => {
  const dev = { NEXT_PUBLIC_SUPABASE_URL: PROD };
  assert.equal(nonProductionUsesProduction(dev), true);
  assert.equal(nonProductionUsesProduction({ ...dev, VERCEL_ENV: 'preview' }), true);
  assert.equal(nonProductionUsesProduction({ ...dev, VERCEL_ENV: 'development' }), true);
  assert.equal(nonProductionUsesProduction({ SUPABASE_URL: PROD }), true, 'falls back to SUPABASE_URL like the scripts do');
  assert.equal(nonProductionUsesProduction({ ...dev, VERCEL_ENV: 'production' }), false);
  assert.equal(nonProductionUsesProduction({ NEXT_PUBLIC_SUPABASE_URL: STAGING }), false);
  assert.equal(nonProductionUsesProduction({}), false);
  assert.match(productionFromOutsideLine(dev), /VERCEL_ENV=unset.*production project.*docs\/brain\/LOCAL-ENV-STAGING\.md/);
});

test('the warning is one line per process, and never throws', () => {
  resetDbTargetWarning();
  const lines = [];
  const log = (line) => lines.push(line);
  assert.equal(warnIfProductionFromOutside({ env: { NEXT_PUBLIC_SUPABASE_URL: STAGING }, log }), false);
  assert.equal(warnIfProductionFromOutside({ env: { NEXT_PUBLIC_SUPABASE_URL: PROD, VERCEL_ENV: 'production' }, log }), false);
  assert.equal(lines.length, 0);
  assert.equal(warnIfProductionFromOutside({ env: { NEXT_PUBLIC_SUPABASE_URL: PROD }, log }), true);
  assert.equal(warnIfProductionFromOutside({ env: { NEXT_PUBLIC_SUPABASE_URL: PROD }, log }), false);
  assert.equal(lines.length, 1);
  resetDbTargetWarning();
});

test('scripts: staging and Vercel production always pass; production from a local machine needs --allow-production', () => {
  const none = { argv: ['node', 'script.mjs'], env: {} };
  assert.equal(scriptFullBankReadAllowed({ url: STAGING, ...none }), true);
  assert.equal(scriptFullBankReadAllowed({ url: 'http://localhost:54321', ...none }), true);
  assert.equal(scriptFullBankReadAllowed({ url: '', ...none }), true, 'no URL: the client cannot be created anyway');
  assert.equal(scriptFullBankReadAllowed({ url: PROD, ...none }), false);
  assert.equal(scriptFullBankReadAllowed({ url: PROD, argv: ['node', 's.mjs', 'out.json'], env: { VERCEL_ENV: 'preview' } }), false);
  assert.equal(scriptFullBankReadAllowed({ url: PROD, argv: ['node', 's.mjs', '--allow-production'], env: {} }), true);
  assert.equal(scriptFullBankReadAllowed({ url: PROD, argv: ['node', 's.mjs'], env: { VERCEL_ENV: 'production' } }), true);
  assert.equal(scriptFullBankReadAllowed({ url: PROD, argv: ['node', 's.mjs', '--allow-production=yes'], env: {} }), false, 'only the exact flag');
});

test('assertScriptFullBankRead logs one line and throws FullBankReadBlocked before the caller reads anything', () => {
  const lines = [];
  const log = (line) => lines.push(line);
  assert.doesNotThrow(() => assertScriptFullBankRead('the test read', { url: STAGING, argv: [], env: {}, log }));
  assert.equal(lines.length, 0);
  let thrown;
  try { assertScriptFullBankRead('the test read', { url: PROD, argv: [], env: {}, log }); } catch (error) { thrown = error; }
  assert.ok(thrown instanceof FullBankReadBlocked);
  assert.equal(thrown.code, 'FULL_BANK_READ_BLOCKED');
  assert.deepEqual(lines, [scriptFullBankReadBlockedLine('the test read')]);
  assert.match(lines[0], /the test read reads every question.*production project.*--allow-production/);
});

// Every script below pages through the whole questions table (or a whole subject) with every column.
const WHOLE_BANK_SCRIPTS = [
  'scripts/nta-data-audit.mjs', 'scripts/nta-pass-export.mjs', 'scripts/nta-fixture-export.mjs',
  'scripts/nta-diagnose.mjs', 'scripts/nta-sample.mjs', 'scripts/pipeline/tools/auditBank.mjs',
];

test('every whole-bank script calls the guard before it creates a database client', () => {
  for (const file of WHOLE_BANK_SCRIPTS) {
    const source = readFileSync(join(root, file), 'utf8');
    const guard = source.indexOf('assertScriptFullBankRead(');
    const client = source.indexOf('createClient(', source.indexOf('assertScriptFullBankRead'));
    assert.ok(guard > 0, `${file} calls assertScriptFullBankRead`);
    assert.ok(source.slice(0, guard).indexOf('createClient(') === -1 || file.endsWith('auditBank.mjs'), `${file} creates no client before the guard`);
    assert.ok(client > guard, `${file}: the guard comes first`);
  }
});

test('the website paths that read the whole bank are guarded too', () => {
  const read = (file) => readFileSync(join(root, file), 'utf8');
  assert.match(read('src/lib/server/inventory.js'), /assertFullBankRead\('the inventory refresh'\)/);
  assert.match(read('src/lib/server/cohortStats.js'), /assertFullBankRead\('the cohort table refresh'/);
  assert.match(read('data/nta_index.js'), /assertFullBankRead\('the NTA index rebuild'/);
  assert.match(read('data/db.js'), /assertFullBankRead\('Database\.getAllQuestions'\)/);
});

test('only the daily cron route recomputes the inventory, and no request path schedules a refresh', () => {
  const importers = [];
  const walk = (dir) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (/\.(js|jsx|mjs|ts)$/.test(entry.name) && readFileSync(join(root, path), 'utf8').includes('refreshInventorySnapshot')) importers.push(path);
    }
  };
  walk('src');
  walk('data');
  const outsideTests = importers.filter((file) => !file.includes('/tests/'));
  assert.deepEqual(outsideTests.sort(), ['src/app/api/internal/refresh-inventory/route.js', 'src/lib/server/inventory.js']);
  const snapshot = readFileSync(join(root, 'src/lib/server/inventorySnapshot.js'), 'utf8');
  assert.doesNotMatch(snapshot, /FRESH_MS|15 \* 60 \* 1000|refresh:\s*true/);
  const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
  assert.equal(vercel.crons.filter((cron) => cron.path === '/api/internal/refresh-inventory').length, 1);
  assert.match(vercel.crons.find((cron) => cron.path === '/api/internal/refresh-inventory').schedule, /^\d+ \d+ \* \* \*$/, 'once a day');
});

test('a whole-bank script run from a local machine against production stops before any network call', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mm-fullbank-'));
  try {
    writeFileSync(join(dir, '.env.local'), `SUPABASE_URL=${PROD}\nSUPABASE_SERVICE_ROLE_KEY=not-a-real-key\nCUET_EVIDENCE_SIGNING_KEY=test\n`);
    const cases = [
      ['scripts/nta-data-audit.mjs', [join(dir, 'out.json')], dir],
      ['scripts/nta-pass-export.mjs', [join(dir, 'pass')], dir],
      ['scripts/nta-fixture-export.mjs', [join(dir, 'fixtures')], dir],
      ['scripts/nta-diagnose.mjs', [], dir],
      ['scripts/nta-sample.mjs', [], dir],
    ];
    for (const [script, args, cwd] of cases) {
      const run = spawnSync(process.execPath, [join(root, script), ...args], { cwd, encoding: 'utf8', env: { ...process.env, VERCEL_ENV: '' }, timeout: 60000 });
      assert.notEqual(run.status, 0, script);
      assert.match(run.stderr, /\[full-bank-read\] blocked: .* reads every question/, `${script}: ${run.stderr.slice(0, 300)}`);
      assert.doesNotMatch(run.stderr, /fetch failed|ENOTFOUND|ECONN/, `${script} made a network call`);
    }
    const audit = spawnSync(process.execPath, [join(root, 'scripts/pipeline/tools/auditBank.mjs'), '--database'], { cwd: root, encoding: 'utf8', env: { ...process.env, VERCEL_ENV: '', SUPABASE_URL: PROD, SUPABASE_SERVICE_ROLE_KEY: 'not-a-real-key' }, timeout: 120000 });
    assert.notEqual(audit.status, 0);
    assert.match(audit.stderr, /\[full-bank-read\] blocked: the bank audit/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('classifyEnvText names the variables that hold a project URL and never returns a value', () => {
  const text = [
    '# comment', '', `NEXT_PUBLIC_SUPABASE_URL=${PROD}`, `SUPABASE_URL=${PROD}`, 'SUPABASE_SERVICE_ROLE_KEY=secret-value-1',
    `STAGING_SUPABASE_URL=${STAGING}`, 'NEXTAUTH_SECRET=secret-value-2', 'no equals sign here',
  ].join('\r\n');
  const found = classifyEnvText(text);
  assert.deepEqual(found, { production: ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'], staging: ['STAGING_SUPABASE_URL'] });
  assert.ok(!JSON.stringify(found).includes('secret-value') && !JSON.stringify(found).includes('https://'));
  assert.deepEqual(classifyEnvText(''), { production: [], staging: [] });
  assert.deepEqual(classifyEnvText(undefined), { production: [], staging: [] });
});
