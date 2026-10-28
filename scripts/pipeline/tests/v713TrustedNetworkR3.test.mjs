import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { assertTrustedNetworkV713R3, providerTransportFaultV713R3,
  transportDiagnosticV713R3 } from '../lib/trustedNetworkV713R3.mjs';
import { runPilotV713R3 } from '../lib/cuetPilotRunV713R3.mjs';
import { BudgetLedger } from '../lib/budgetLedger.mjs';
import { createCampaignGuardV713 } from '../lib/campaignGuardV713.mjs';

test('Windows launch without trusted system CA is rejected before either probe', async () => {
  let probes = 0;
  await assert.rejects(assertTrustedNetworkV713R3({ platform: 'win32', execArgv: [], env: {},
    fetchImpl: async () => { probes++; return new Response(null, { status: 200 }); } }), /trusted_system_ca_launch_required/);
  assert.equal(probes, 0);
});

test('insecure TLS override is rejected before probes even when system CA is enabled', async () => {
  let probes = 0;
  await assert.rejects(assertTrustedNetworkV713R3({ platform: 'win32', execArgv: ['--use-system-ca'],
    env: { NODE_TLS_REJECT_UNAUTHORIZED: '0' }, fetchImpl: async () => { probes++; } }), /insecure_tls_configuration_forbidden/);
  assert.equal(probes, 0);
});

test('the effective last CA flag wins, including NODE_OPTIONS overrides', async () => {
  let probes = 0;
  await assert.rejects(assertTrustedNetworkV713R3({ platform: 'win32', execArgv: ['--no-use-system-ca'],
    env: { NODE_OPTIONS: '--use-system-ca' }, fetchImpl: async () => { probes++; } }), /trusted_system_ca_launch_required/);
  assert.equal(probes, 0);
});

test('trusted network preflight checks both exact provider hosts with unauthenticated HEAD requests', async () => {
  const calls = [];
  const result = await assertTrustedNetworkV713R3({ platform: 'win32', execArgv: ['--use-system-ca'], env: {},
    fetchImpl: async (url, init) => { calls.push({ url, init }); return new Response(null, { status: calls.length === 1 ? 421 : 404 }); } });
  assert.deepEqual(calls.map(c => c.url), ['https://api.openai.com/', 'https://generativelanguage.googleapis.com/']);
  assert.ok(calls.every(c => c.init.method === 'HEAD'));
  assert.ok(calls.every(c => !Object.keys(c.init.headers || {}).some(k => /authorization|api-key/i.test(k))));
  assert.deepEqual(result.rows.map(r => [r.host, r.status, r.tls_verified]), [
    ['api.openai.com', 421, true], ['generativelanguage.googleapis.com', 404, true],
  ]);
  assert.equal(result.model_calls, 0);
  assert.equal(result.contains_question_payload, false);
});

test('a failed first TLS probe stops before contacting the second host', async () => {
  const cause = Object.assign(new Error('certificate issuer unavailable'), { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' });
  let probes = 0;
  await assert.rejects(assertTrustedNetworkV713R3({ platform: 'win32', execArgv: ['--use-system-ca'], env: {},
    fetchImpl: async () => { probes++; throw Object.assign(new Error('unable to verify the first certificate'), { cause }); } }),
  /unable to verify the first certificate/);
  assert.equal(probes, 1);
});

test('transport classifier recognizes whitelisted nested TLS and DNS codes', () => {
  const dns = Object.assign(new Error('fetch failed'), { cause: Object.assign(new Error('lookup failed'), { code: 'ENOTFOUND' }) });
  const tls = Object.assign(new Error('socket failed'), { cause: Object.assign(new Error('tls'), {
    cause: Object.assign(new Error('verify'), { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' }),
  }) });
  assert.equal(providerTransportFaultV713R3(dns), true);
  assert.equal(providerTransportFaultV713R3(tls), true);
});

test('provider HTTP receipts are not misclassified from provider-controlled message text', () => {
  const error = Object.assign(new Error('provider_http_400'), {
    providerReceipt: { http_status: 400, message: 'certificate verification failed' },
  });
  assert.equal(providerTransportFaultV713R3(error), false);
});

test('transport diagnostics whitelist codes and do not copy secrets or arbitrary cause text', () => {
  const error = Object.assign(new Error('unable to verify the first certificate; Authorization: Bearer sk-secret-value'), {
    code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    cause: Object.assign(new Error('hidden credential xyz'), { code: 'ENOTFOUND' }),
  });
  const diagnostic = transportDiagnosticV713R3(error);
  assert.equal(diagnostic.code, 'UNABLE_TO_VERIFY_LEAF_SIGNATURE');
  assert.equal(diagnostic.cause_code, 'ENOTFOUND');
  assert.equal(diagnostic.classification, 'provider_transport_fault');
  assert.doesNotMatch(JSON.stringify(diagnostic), /sk-secret-value|hidden credential|Bearer/i);
  assert.ok(JSON.stringify(diagnostic).length < 700);
});

test('unrecognized error and cause codes are omitted from persisted diagnostics', () => {
  const error = Object.assign(new Error('certificate verify failed'), {
    code: 'sk-should-never-be-persisted', cause: Object.assign(new Error('x'), { code: 'customer-secret' }),
  });
  const diagnostic = transportDiagnosticV713R3(error);
  assert.equal(diagnostic.code, null);
  assert.equal(diagnostic.cause_code, null);
  assert.doesNotMatch(JSON.stringify(diagnostic), /sk-should-never-be-persisted|customer-secret/);
});

test('qualification runner performs trusted preflight before lock, ledger, store, or generation', () => {
  const source = readFileSync(resolve('scripts/pipeline/tools/runQualificationV713R3.mjs'), 'utf8');
  const preflight = source.indexOf('await assertTrustedNetworkV713R3()');
  assert.ok(preflight >= 0);
  for (const marker of ['writeFileSync(lock,', 'new BudgetLedger(', 'new FactoryStore(', 'adapters.__evaluation(']) {
    assert.ok(source.indexOf(marker) > preflight, `${marker} must occur after trusted-network preflight`);
  }
});

test('the shared availability pause reaches the guard and prevents in-flight jobs from making their next request', () => {
  const source = readFileSync(resolve('scripts/pipeline/tools/runQualificationV713R3.mjs'), 'utf8');
  assert.match(source, /let ledger, store, stopping = false, availabilityPaused = false/);
  assert.match(source, /requested\s*=\s*\(\)\s*=>\s*stopping\s*\|\|\s*availabilityPaused/);
  assert.match(source, /stopRequested:\s*requested/);
  assert.match(source, /for\s*\(const provider of \['openai',\s*'gemini'\]\)\s*\{\s*if\s*\(requested\(\)\)/);
  assert.match(source, /if\s*\(paused\)\s*break/);
  assert.match(source, /if\s*\(!requested\(\)\s*&&\s*!paused\)\s*await native\.flush/);
});

test('transport pause persistence uses the sanitized diagnostic instead of provider error text', () => {
  const source = readFileSync(resolve('scripts/pipeline/tools/runQualificationV713R3.mjs'), 'utf8');
  const start = source.indexOf('else if (providerTransportFaultV713R3(error)');
  const end = source.indexOf('} finally { save(); }', start);
  assert.ok(start >= 0 && end > start);
  const transportCatch = source.slice(start, end);
  assert.match(transportCatch, /transportDiagnosticV713R3\(error\)/);
  assert.match(transportCatch, /reasons:\s*\[providerTransportFaultV713R3\(error\)\s*\?\s*diagnostic\.message\s*:\s*error\.message\]/);
});

for (const mode of ['authoring', 'validation', 'repair']) {
  test(`R3 engine pauses at the exact ${mode} stage for a typed network fault without recording an academic wave`, async () => {
    const jobs = Array.from({ length: 40 }, (_, i) => ({ id: `candidate-${i}`, subject: ['english', 'accountancy', 'business_studies', 'economics'][Math.floor(i / 10)],
      chapter: 'Test chapter', state: 'queued', repair_count: 0 }));
    const campaign = { id: 'offline-r3', jobs };
    const state = { jobs: Object.fromEntries(jobs.map(j => [j.id, { ...j, candidate: null }])), waves: [], weak_waves: 0,
      circuit_open: false, systemic_errors: 0, request_keys: [], stop_reason: null, runs: [] };
    const first = state.jobs['candidate-0'];
    if (mode === 'validation') { first.state = 'generated'; first.candidate = { id: first.id, body: 'Saved candidate body.' }; }
    if (mode === 'repair') { first.state = 'repair_started'; first.repair_count = 1; first.candidate = { id: first.id, body: 'Saved candidate body.' };
      first.first_result = { reasons: ['failed:source_support'] }; }
    let paused = false, calls = 0;
    const fault = Object.assign(new Error('TLS handshake failed'), {
      cause: Object.assign(new Error('certificate'), { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' }),
    });
    const deps = {
      async author() { calls++; if (mode === 'authoring') throw fault; throw Error('unexpected_author'); },
      prepare(candidate) { return { candidate, notes: [], quote: { passed: true, methods: [] } }; },
      async validate() { calls++; if (mode === 'validation') throw fault; throw Error('unexpected_validate'); },
      async repair() { calls++; if (mode === 'repair') throw fault; throw Error('unexpected_repair'); },
    };
    const result = await runPilotV713R3({ campaign, state, saveState() {}, deps, concurrency: 1,
      pauseDispatch() { paused = true; }, stopRequested: () => paused });
    assert.equal(paused, true);
    assert.equal(result.status, 'stopped');
    assert.equal(calls, 1);
    assert.equal(first.state, mode === 'authoring' ? 'authoring' : mode === 'validation' ? 'validating' : 'repair_started');
    assert.equal(first.repair_count, mode === 'repair' ? 1 : 0);
    assert.equal(first.result, undefined);
    assert.deepEqual(first.transport_diagnostic, { message: 'Provider connection or availability interrupted.', code: null,
      cause_code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', classification: 'provider_transport_fault' });
    assert.equal(state.weak_waves, 0);
    assert.equal(state.circuit_open, false);
    assert.equal(state.waves.length, 0);
    assert.equal(state.jobs['candidate-1'].state, 'queued');
  });
}

test('campaign guard sees the shared pause before creating a reservation or calling native transport', async () => {
  const root = mkdtempSync(join(tmpdir(), 'v713-r3-pause-'));
  const ledgerPath = join(root, 'budget.sqlite');
  const ledger = new BudgetLedger(ledgerPath);
  ledger.reconcileHistory({ spent_usd: 0, basis: 'Isolated R3 pause test; no provider spend.', confirmed_at: new Date().toISOString() });
  try {
    let paused = true, calls = 0;
    const prices = () => ({ source_url: 'https://offline.invalid/prices', expires_at: '2099-01-01', models: {
      'gpt-6-luna': { provider_host: 'api.openai.com', max_input_tokens: 12000, input_per_million: 1, output_per_million: 2 },
    } });
    const guard = createCampaignGuardV713({ ledger, native: { async generate() { calls++; return {}; } },
      campaignId: 'offline-pause', candidateIds: ['candidate'], capUsd: 1, prices, keys: new Set(),
      stopRequested: () => paused });
    const body = { model: 'gpt-6-luna', tools: [], max_output_tokens: 10,
      input: [{ role: 'user', content: JSON.stringify({ candidate_id: 'candidate' }) }] };
    const baselineRequests = ledger.db.prepare('SELECT count(*) n FROM requests').get().n;
    await assert.rejects(guard.generate('openai', body, { key: 'logical-key', stage: 'blind_solution' }), /study_draining_stop/);
    assert.equal(calls, 0);
    assert.equal(ledger.db.prepare('SELECT count(*) n FROM requests').get().n, baselineRequests);
    assert.equal(ledger.db.prepare('SELECT count(*) n FROM provider_requests').get().n, 0);
    paused = false;
  } finally {
    ledger.close();
    const rootPath = resolve(root), tempPath = resolve(tmpdir());
    assert.ok(rootPath.startsWith(tempPath + sep), 'test cleanup must stay inside OS temp directory');
    rmSync(rootPath, { recursive: true, force: true });
  }
});

test('mixed37 qualification IDs and keys are separate from all R2 diagnostic allocations', () => {
  const base = resolve('artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v713');
  const authored = JSON.parse(readFileSync(resolve(base, 'fresh-custody/sealed/authored-r3.json'), 'utf8'));
  const r2 = JSON.parse(readFileSync(resolve(base, 'measurement-continuation-40-r2/campaign.json'), 'utf8'));
  const freshIds = new Set(authored.items.map(row => row.id));
  const diagnosticIds = new Set(r2.jobs.map(row => row.id));
  const qualificationIds = [...freshIds, 'v75f-825e60a00f'];
  assert.equal(freshIds.size, 36);
  assert.equal(new Set(qualificationIds).size, 37);
  assert.equal([...qualificationIds].filter(id => diagnosticIds.has(id)).length, 0);
  assert.match(readFileSync(resolve('scripts/pipeline/tools/runQualificationV713R3.mjs'), 'utf8'),
    /cuet-v713-final-fresh31-regression6/);
  assert.match(readFileSync(resolve('scripts/pipeline/tools/captureMixedQualificationV713R3.mjs'), 'utf8'),
    /requests\.length !== 222/);
});
