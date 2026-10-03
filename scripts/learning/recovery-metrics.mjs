// Read-only recovery validation report. Selects learning_episodes; never writes rows, calls RPCs
// or providers. Content spend is read from the local budget ledger only if that file exists.
//   node --env-file=.env.local scripts/learning/recovery-metrics.mjs            # configured database
//   node scripts/learning/recovery-metrics.mjs --fixture                        # labelled simulated cohort
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { recoveryValidationMetrics } from '../../data/recovery_metrics.js';
import { simulatedCohort, COHORT_NOW } from '../../data/tests/recoveryCohortFixture.mjs';

const fixture = process.argv.includes('--fixture');
const pathway = JSON.parse(readFileSync(new URL('../../data/recovery_candidates/sacrificing_gaining.pathway.json', import.meta.url), 'utf8'));
const out = { readOnly: true, source: fixture ? 'simulated_fixture_not_student_data' : 'configured_database', database: {} };

function contentLedger() {
  const path = resolve(process.env.CUET_BUDGET_LEDGER || 'data/pipeline-budget.sqlite');
  if (!existsSync(path)) return { contentUsd: null, ledger: 'absent: no paid content calls recorded from this checkout' };
  return import('node:sqlite').then(({ DatabaseSync }) => {
    const db = new DatabaseSync(path, { readOnly: true });
    try {
      const s = db.prepare("SELECT COALESCE(SUM(COALESCE(actual,reserved)),0) AS committed, SUM(CASE WHEN state='unresolved' THEN 1 ELSE 0 END) AS unresolved FROM requests").get();
      const limit = db.prepare('SELECT limit_micro FROM budget WHERE id=1').get();
      return { contentUsd: s.committed / 1e6, contentLimitUsd: (limit?.limit_micro ?? 0) / 1e6, ledger: `${s.unresolved || 0} unresolved requests` };
    } finally { db.close(); }
  });
}

let rows = [];
if (fixture) rows = simulatedCohort(pathway);
else {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) out.database = { configured: false };
  else {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (i, init) => fetch(i, { ...init, signal: AbortSignal.timeout(12000) }) } });
    // Projection only: no request keys, raw responses or account fields beyond an opaque owner id for counting learners.
    const { data, error } = await sb.from('learning_episodes').select('id,user_id,concept_id,pathway->version,projection,created_at').limit(5000);
    out.database = { configured: true, readable: !error, errorCode: error?.code || null, rows: data?.length ?? 0 };
    rows = (data || []).map(r => ({ ...r, pathway: { version: r.version } }));
  }
}
const ledger = await contentLedger();
const metrics = recoveryValidationMetrics(rows, { ...(fixture ? { now: COHORT_NOW } : {}), pathways: { [pathway.id]: pathway }, costs: { paidModelCalls: 0, contentUsd: ledger.contentUsd, contentLimitUsd: ledger.contentLimitUsd } });
const report = { generatedAt: new Date().toISOString(), ...out, ledger: ledger.ledger, metrics };
mkdirSync(new URL('../../docs/brain/reports/', import.meta.url), { recursive: true });
const name = fixture ? 'recovery-metrics-fixture.json' : 'recovery-metrics.json';
writeFileSync(new URL(`../../docs/brain/reports/${name}`, import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ source: report.source, database: out.database, episodes: rows.length, pathways: Object.keys(metrics.pathways), report: `docs/brain/reports/${name}` }));
