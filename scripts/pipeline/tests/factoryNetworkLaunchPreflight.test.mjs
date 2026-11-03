import test from 'node:test';
import assert from 'node:assert/strict';
import { checkFactoryConnectivity, factoryLaunchArguments, launchAfterFactoryPreflight } from '../lib/factoryNetworkLaunchPreflight.mjs';

const runner = 'scripts/pipeline/tools/runFreshCuetReadinessV74.mjs';
const healthy = async url => ({ status: url.includes('openai') ? 401 : 403, body: { cancel: async () => {} } });

test('unauthenticated model-list probes send no inference body, authorization or redirect', async () => {
  const calls = [];
  const result = await checkFactoryConnectivity({ fetchImpl: async (url, init) => {
    calls.push({ url, init }); return healthy(url);
  } });
  assert.equal(result.ready, true);
  assert.equal(result.paid_calls, 0);
  assert.equal(result.ledger_access, false);
  assert.equal(calls.length, 2);
  for (const { url, init } of calls) {
    assert.equal(new URL(url).search, '');
    assert.equal(init.method, 'GET');
    assert.equal(init.redirect, 'error');
    assert.equal(init.headers, undefined);
    assert.equal(init.body, undefined);
    assert.ok(init.signal instanceof AbortSignal);
  }
});

test('certificate failure stops before any worker launch and retains structured cause', async () => {
  let launches = 0;
  const error = new Error('fetch failed', { cause: { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' } });
  const result = await launchAfterFactoryPreflight({ runner, args: ['execute'],
    fetchImpl: async () => { throw error; }, launch: async () => { launches++; return 0; } });
  assert.equal(result.launched, false);
  assert.equal(result.exit_code, 1);
  assert.equal(launches, 0);
  assert.ok(result.preflight.results.every(result => result.error_code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'));
});

test('server errors and one unavailable provider refuse launch', async () => {
  for (const status of [429, 500, 503, 200]) {
    let launches = 0;
    const result = await launchAfterFactoryPreflight({ runner,
      fetchImpl: async url => url.includes('openai') ? healthy(url) : { status },
      launch: async () => { launches++; return 0; } });
    assert.equal(result.launched, false);
    assert.equal(launches, 0);
  }
});

test('successful probes preserve exact arguments and enforce system CA in child', async () => {
  const args = ['report', '--study-dir', 'path with spaces']; let actual;
  const result = await launchAfterFactoryPreflight({ runner, args, fetchImpl: healthy,
    launch: async argv => { actual = argv; return 7; } });
  assert.equal(result.launched, true);
  assert.equal(result.exit_code, 7);
  assert.equal(actual[0], '--use-system-ca');
  assert.deepEqual(actual.slice(2), args);
});

test('unregistered launch targets and unbounded probes are refused', async () => {
  assert.throws(() => factoryLaunchArguments('scripts/pipeline/tools/continueCuetFitCampaignC.mjs'), /explicit_current/);
  assert.throws(() => factoryLaunchArguments('../other.mjs'), /explicit_current/);
  assert.throws(() => factoryLaunchArguments(runner, ['report', null]), /explicit_current/);
  await assert.rejects(checkFactoryConnectivity({ fetchImpl: healthy, timeoutMs: 30001 }), /bounded_probe/);
});
