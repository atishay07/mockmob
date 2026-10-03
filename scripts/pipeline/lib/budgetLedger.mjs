import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

// Integer micro-dollars; BEGIN IMMEDIATE serializes independent worker processes.
// Owner authorization, 4 Oct 2026: content generation may spend up to USD 50 in total (lifetime,
// incremental from this ledger's start), raised from USD 10. Reserve-before-call is unchanged.
export const CONTENT_LIFETIME_CEILING_USD = 50;

export class BudgetLedger {
  constructor(path, limitUsd = 2) {
    mkdirSync(dirname(resolve(path)), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA busy_timeout=10000; PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS budget (id INTEGER PRIMARY KEY CHECK(id=1), limit_micro INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, model TEXT NOT NULL, reserved INTEGER NOT NULL,
        actual INTEGER, state TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS routes (id TEXT PRIMARY KEY, failures INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS repairs (id TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS cache (id TEXT PRIMARY KEY, value TEXT NOT NULL);`);
    const columns=this.db.prepare('PRAGMA table_info(requests)').all();
    if(!columns.some(c=>c.name==='owner_pid'))this.db.exec('ALTER TABLE requests ADD COLUMN owner_pid INTEGER');
    if(!columns.some(c=>c.name==='receipt_json'))this.db.exec('ALTER TABLE requests ADD COLUMN receipt_json TEXT');
    this.db.prepare('INSERT OR IGNORE INTO budget VALUES (1, ?)').run(Math.min(CONTENT_LIFETIME_CEILING_USD, Math.max(0, limitUsd)) * 1e6);
    this.transaction(()=>{
      for(const row of this.db.prepare("SELECT id,owner_pid FROM requests WHERE state='reserved'").all()){
        let alive=false;
        if(row.owner_pid)try{process.kill(row.owner_pid,0);alive=true;}catch(error){alive=error.code==='EPERM';}
        if(!alive)this.db.prepare("UPDATE requests SET state='unresolved' WHERE id=?").run(row.id);
      }
    });
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  snapshot() {
    return { ...this.db.prepare('SELECT limit_micro FROM budget WHERE id=1').get(),
      ...this.db.prepare("SELECT COALESCE(SUM(COALESCE(actual,reserved)),0) AS committed_micro, COUNT(*) AS requests, SUM(CASE WHEN state='unresolved' THEN 1 ELSE 0 END) AS unresolved FROM requests").get() };
  }
  releaseAfterCalibration(report, limitUsd = CONTENT_LIFETIME_CEILING_USD) {
    if(report?.released!==true || report.independent!==true || report.valid_survival<.95 || report.critical_false_accepts!==0 || report.missing_categories?.length!==0) throw new Error('calibration_release_required');
    if(!Number.isFinite(limitUsd) || limitUsd<2 || limitUsd>CONTENT_LIFETIME_CEILING_USD) throw new Error('hard_ceiling_exceeded');
    this.transaction(()=>this.db.prepare('UPDATE budget SET limit_micro=? WHERE id=1').run(Math.floor(limitUsd*1e6)));
  }
  reserve(model, amountMicro) {
    if (!Number.isSafeInteger(amountMicro) || amountMicro <= 0) throw new Error('invalid_reservation');
    return this.transaction(() => {
      const state = this.snapshot();
      if (state.unresolved > 0) throw new Error('budget_usage_unresolved');
      if (state.committed_micro + amountMicro > state.limit_micro) throw new Error('budget_exhausted');
      const id = randomUUID();
      this.db.prepare("INSERT INTO requests(id,model,reserved,state,owner_pid) VALUES(?,?,?,'reserved',?)").run(id, model, amountMicro, process.pid);
      return id;
    });
  }
  settle(id, actualMicro, receipt={}) {
    return this.transaction(() => {
      const row = this.db.prepare('SELECT * FROM requests WHERE id=?').get(id);
      if (!row || row.state === 'settled') throw new Error('reservation_not_open');
      if (!Number.isSafeInteger(actualMicro) || actualMicro < 0) {
        this.db.prepare("UPDATE requests SET state='unresolved',receipt_json=? WHERE id=?").run(JSON.stringify(receipt),id);
        return;
      }
      this.db.prepare('UPDATE requests SET actual=?, state=?,receipt_json=? WHERE id=?').run(actualMicro, actualMicro > row.reserved ? 'unresolved' : 'settled',JSON.stringify(receipt), id);
    });
  }
  assertRoute(id) {
    if ((this.db.prepare('SELECT failures FROM routes WHERE id=?').get(id)?.failures || 0) >= 2) throw new Error('route_paused_zero_yield');
  }
  recordBatch(id, published) {
    this.db.prepare('INSERT INTO routes(id,failures) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET failures=CASE WHEN ? > 0 THEN 0 ELSE failures+1 END').run(id, published > 0 ? 0 : 1, published);
  }
  claimRepair(id) {
    return this.db.prepare('INSERT OR IGNORE INTO repairs VALUES(?)').run(id).changes === 1;
  }
  getCache(key) { const row = this.db.prepare('SELECT value FROM cache WHERE id=?').get(key); return row ? JSON.parse(row.value) : null; }
  setCache(key, value) { this.db.prepare('INSERT OR REPLACE INTO cache VALUES(?,?)').run(key, JSON.stringify(value)); }
  close() { this.db.close(); }
}

let shared;
export function pipelineBudget() {
  shared ??= new BudgetLedger(resolve(process.env.CUET_BUDGET_LEDGER || 'data/pipeline-budget.sqlite'));
  return shared;
}

// The transport sees EVERY request, including SDK retries. Prices must be supplied
// with an expiry after verification; unknown prices never receive fallback estimates.
export function budgetedFetch(baseFetch = globalThis.fetch, {getPrices=()=>JSON.parse(readFileSync(resolve('data/pipeline-prices.json'),'utf8')),getLedger=pipelineBudget}={}) {
  return async (url, init = {}) => {
    if (!String(url).includes('/chat/completions')) throw new Error('unbudgeted_provider_endpoint');
    if (process.env.MOCK_AI === 'true') throw new Error('mock_mode_cannot_dispatch');
    const body = JSON.parse(init.body);
    const prices = getPrices();
    const price = prices.models?.[body.model];
    const output = body.max_completion_tokens ?? body.max_tokens;
    const providerHost=new URL(String(url)).host;
    if (!price || !(Date.parse(prices.expires_at) > Date.now()) || !prices.source_url ||
        price.provider_host!==providerHost ||
        !Number.isFinite(price.input_per_million) || !Number.isFinite(price.output_per_million) ||
        !Number.isInteger(price.max_input_tokens) || price.max_input_tokens <= 0 ||
        price.input_per_million < 0 || price.output_per_million < 0 || !Number.isInteger(output) || output <= 0 || body.stream) {
      throw new Error('verified_pricing_and_token_limits_required');
    }
    const ledger = getLedger();
    // Reserve full configured input limit, not a character/token guess.
    const reserved = Math.ceil(price.max_input_tokens * price.input_per_million + output * price.output_per_million);
    const id = ledger.reserve(body.model, reserved);
    try {
      const response = await baseFetch(url, init);
      const payload = await response.clone().json();
      const usage = payload.usage;
      const actual = Number.isInteger(usage?.prompt_tokens) && Number.isInteger(usage?.completion_tokens)
        && usage.prompt_tokens >= 0 && usage.completion_tokens >= 0
        ? Math.ceil(usage.prompt_tokens * price.input_per_million + usage.completion_tokens * price.output_per_million) : null;
      ledger.settle(id, actual,{provider_host:providerHost,http_status:response.status,usage:usage || null,pricing_source:prices.source_url,pricing_expires_at:prices.expires_at,input_per_million:price.input_per_million,output_per_million:price.output_per_million});
      if (actual === null || actual > reserved) throw new Error('provider_usage_unresolved');
      return response;
    } catch (error) {
      const row = ledger.db.prepare('SELECT state FROM requests WHERE id=?').get(id);
      if (row?.state === 'reserved') ledger.settle(id, null);
      throw error;
    }
  };
}
