#!/usr/bin/env node
// Fixes sequence and match questions whose correct option is the order the stem lists its items in
// ((A)-(B)-(C)-(D), or (A)-(I), (B)-(II), ...) by reprinting the stem's items in another order and
// remapping every option to the new labels (lib/listed-order-reorder.mjs says exactly how). Reversible:
// every applied change is saved first to a restore file, and --mode=restore puts the saved text and state back.
//
//   node --use-system-ca scripts/question-reorder.mjs --mode=dry-run --list=<ids.json> [--list=...] [--source=db|fixtures] [--fixtures=tmp/nta-fixtures] [--seed=<text>]
//   node --use-system-ca scripts/question-reorder.mjs --mode=apply   --plan=<dry-run.json> --reason=<text> [--keep-live]
//   node --use-system-ca scripts/question-reorder.mjs --mode=restore --restore=<restore.json>
//   node --use-system-ca scripts/question-reorder.mjs --mode=release --restore=<restore.json>
//
// dry-run  reads only (the database with --source=db, or the local export with --source=fixtures), writes
//          reorder-dry-run-<stamp>.json (every row, before and after) and reorder-hold-fallback-<stamp>.json
//          (the ids this script will not rewrite; a list file for scripts/question-hold.mjs).
// apply    re-plans every row from the live data and writes only the rows whose rewrite is identical to the dry
//          run the owner approved. Rewritten rows are also withheld (the same hold as scripts/question-hold.mjs)
//          until they are re-verified, because the stored evidence, agent scores and CUET-fit scores are bound to the old text;
//          --keep-live leaves them visible instead.
// restore  puts the original text (and the saved state) back, row by row, only where the row still holds
//          exactly what apply wrote.
// release  keeps the rewritten text and puts the saved state back (after the rewritten rows are re-verified).
//
// A list file is a JSON array of ids, or of objects with an id field.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { listedOrderKeyReasons } from '../data/nta_item_checks.js';
import { classifyNtaType, getNtaBlueprint } from '../data/nta_engine.js';
import { planListedOrderFix, restoreEntry, rowStillAsWritten, updateFor, REORDER_VERSION } from './lib/listed-order-reorder.mjs';

// The same hold as scripts/question-hold.mjs and Mistake Repair: status pending, verification disputed, exploration pending_review.
const HOLD = Object.freeze({ status: 'pending', verification_state: 'disputed', exploration_state: 'pending_review' });
const STATE_FIELDS = ['status', 'verification_state', 'exploration_state'];
const DEFAULT_SEED = 'listed-order-2026-10-14';
const REPORT_DIR = path.resolve('docs/brain/reports/question-holds');

const isVisible = (row) => !row.is_deleted && (row.status === 'live' || (row.verification_state === 'verified' && row.exploration_state === 'active'));
const chunks = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

export function parseArgs(argv) {
  const out = { mode: 'dry-run', lists: [], reason: '', restore: null, plan: null, source: 'db', fixtures: 'tmp/nta-fixtures', seed: DEFAULT_SEED, keepLive: false, outDir: REPORT_DIR };
  for (const arg of argv) {
    if (arg === '--keep-live') { out.keepLive = true; continue; }
    const m = arg.match(/^--([\w-]+)=(.*)$/);
    if (!m) continue;
    if (m[1] === 'mode') out.mode = m[2];
    if (m[1] === 'list') out.lists.push(m[2]);
    if (m[1] === 'reason') out.reason = m[2];
    if (m[1] === 'restore') out.restore = m[2];
    if (m[1] === 'plan') out.plan = m[2];
    if (m[1] === 'source') out.source = m[2];
    if (m[1] === 'fixtures') out.fixtures = m[2];
    if (m[1] === 'seed') out.seed = m[2];
    if (m[1] === 'out') out.outDir = path.resolve(m[2]);
  }
  return out;
}

export function readIds(files) {
  const ids = new Set();
  for (const file of files) {
    const list = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const item of list) ids.add(typeof item === 'string' ? item : item?.id);
  }
  return [...ids].filter(Boolean);
}

function loadEnv(file = '.env.local') {
  return Object.fromEntries(
    fs.readFileSync(file, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }),
  );
}

async function makeClient() {
  const { createClient } = await import('@supabase/supabase-js');
  const env = loadEnv();
  return createClient(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

export async function fetchRows(sb, ids) {
  const rows = [];
  for (const part of chunks(ids, 50)) {
    const { data, error } = await sb.from('questions').select('*').in('id', part);
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

export function fixtureRows(dir, ids) {
  const wanted = new Set(ids);
  const rows = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !['manifest.json', 'shared.json'].includes(f))) {
    for (const row of JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))) if (wanted.has(row.id)) rows.push(row);
  }
  return rows;
}

const typeOfRow = (row) => {
  const blueprint = getNtaBlueprint(row.subject);
  return classifyNtaType(row, row.subject, blueprint ? Object.keys(blueprint.typeQuotas) : undefined);
};

const summarise = (rows) => rows.reduce((by, row) => { by[row.subject] = (by[row.subject] || 0) + 1; return by; }, {});

/** dry-run: plan every requested row; nothing is written to any database. */
export async function dryRun(args, { sb, readRows = (ids) => (args.source === 'fixtures' ? fixtureRows(args.fixtures, ids) : fetchRows(sb, ids)) } = {}) {
  if (!args.lists.length) throw new Error('need --list');
  const ids = readIds(args.lists);
  const rows = await readRows(ids);
  const found = new Set(rows.map((r) => r.id));
  const plans = rows.map((row) => ({ ...planListedOrderFix(row, { seed: args.seed }), status: row.status, verification_state: row.verification_state, exploration_state: row.exploration_state, is_deleted: !!row.is_deleted }));
  const reorder = plans.filter((p) => p.outcome === 'reorder');
  const holdFallback = plans.filter((p) => p.outcome === 'hold').map((p) => p.id);
  const skipped = plans.filter((p) => p.outcome === 'skip').map((p) => p.id);
  const summary = {
    requested: ids.length, found: rows.length, missing: ids.filter((id) => !found.has(id)),
    reorder: reorder.length, holdFallback: holdFallback.length, notListedOrder: skipped.length, notListedOrderIds: skipped,
    explanationRewritten: reorder.filter((p) => p.explanationChanged).length,
    reorderBySubject: summarise(reorder.map((p) => ({ subject: p.subject }))),
    holdReasons: plans.filter((p) => p.outcome === 'hold').reduce((by, p) => { for (const r of p.reasons) by[r] = (by[r] || 0) + 1; return by; }, {}),
  };
  const report = { kind: 'question_reorder_plan', version: REORDER_VERSION, mode: 'dry-run', source: args.source, seed: args.seed, at: new Date().toISOString(), summary, rows: plans };
  fs.mkdirSync(args.outDir, { recursive: true });
  const planFile = path.join(args.outDir, `reorder-dry-run-${stamp()}.json`);
  const holdFile = path.join(args.outDir, `reorder-hold-fallback-${stamp()}.json`);
  fs.writeFileSync(planFile, JSON.stringify(report, null, 1));
  fs.writeFileSync(holdFile, JSON.stringify(holdFallback, null, 1));
  return { summary, planFile, holdFile, plans };
}

const sameRewrite = (a, b) => JSON.stringify([a.stem, a.options, a.explanation]) === JSON.stringify([b.stem, b.options, b.explanation]);

/** apply: write only the rows whose fresh plan is identical to the approved dry run. Saves the restore file first. */
export async function apply(args, { sb }) {
  if (!args.plan || !args.reason) throw new Error('need --plan and --reason');
  const approved = JSON.parse(fs.readFileSync(args.plan, 'utf8'));
  if (approved.kind !== 'question_reorder_plan' || approved.version !== REORDER_VERSION) throw new Error('--plan is not a question_reorder_plan of this version');
  const wanted = approved.rows.filter((p) => p.outcome === 'reorder');
  const rows = await fetchRows(sb, wanted.map((p) => p.id));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const toWrite = [];
  const skipped = [];
  for (const approvedPlan of wanted) {
    const row = byId.get(approvedPlan.id);
    if (!row) { skipped.push({ id: approvedPlan.id, why: 'row_not_found' }); continue; }
    if (!isVisible(row)) { skipped.push({ id: row.id, why: 'not_live' }); continue; }
    const fresh = planListedOrderFix(row, { seed: approved.seed });
    if (fresh.outcome !== 'reorder') { skipped.push({ id: row.id, why: `plan_now_${fresh.outcome}:${fresh.reasons.join('+')}` }); continue; }
    if (!sameRewrite(fresh.after, approvedPlan.after) || !sameRewrite(fresh.before, approvedPlan.before)) { skipped.push({ id: row.id, why: 'changed_since_dry_run' }); continue; }
    toWrite.push({ row, plan: fresh });
  }
  const report = { kind: 'question_reorder', mode: 'apply', reason: args.reason, at: new Date().toISOString(), seed: approved.seed, keepLive: args.keepLive, planned: wanted.length, toWrite: toWrite.length, skipped };
  fs.mkdirSync(args.outDir, { recursive: true });
  const restoreFile = path.join(args.outDir, `reorder-restore-${stamp()}.json`);
  // The restore file is written before any row is touched.
  fs.writeFileSync(restoreFile, JSON.stringify({
    ...report, version: REORDER_VERSION, kind: 'question_reorder_restore',
    rows: toWrite.map(({ row, plan }) => ({ ...restoreEntry(row, plan), state: Object.fromEntries(STATE_FIELDS.map((f) => [f, row[f] ?? null])) })),
  }, null, 1));
  let written = 0;
  const notWritten = [];
  for (const { row, plan } of toWrite) {
    let query = sb.from('questions').update({ ...updateFor(plan), ...(args.keepLive ? {} : HOLD), updated_at: new Date().toISOString() }).eq('id', row.id).eq('is_deleted', false);
    if (row.updated_at) query = query.eq('updated_at', row.updated_at);
    const { data, error } = await query.select('id');
    if (error) throw error;
    if ((data || []).length) written += 1; else notWritten.push(row.id);
  }
  const after = await fetchRows(sb, toWrite.map(({ row }) => row.id));
  const stillListedOrder = after.filter((row) => listedOrderKeyReasons(row, typeOfRow(row)).length).map((r) => r.id);
  const stillVisible = args.keepLive ? [] : after.filter(isVisible).map((r) => r.id);
  return { ...report, written, notWritten, stillListedOrder, stillVisible, restoreFile };
}

/** restore: original text and state back, only where the row still holds exactly what apply wrote. */
export async function restore(args, { sb }) {
  if (!args.restore) throw new Error('need --restore');
  const saved = JSON.parse(fs.readFileSync(args.restore, 'utf8'));
  if (saved.kind !== 'question_reorder_restore') throw new Error('--restore is not a question_reorder_restore file');
  const rows = await fetchRows(sb, saved.rows.map((e) => e.id));
  const byId = new Map(rows.map((r) => [r.id, r]));
  let restored = 0;
  const skipped = [];
  for (const entry of saved.rows) {
    const row = byId.get(entry.id);
    if (!row) { skipped.push({ id: entry.id, why: 'row_not_found' }); continue; }
    if (!rowStillAsWritten(row, entry)) { skipped.push({ id: entry.id, why: 'edited_since_apply' }); continue; }
    const { data, error } = await sb.from('questions').update({ ...entry.original, ...entry.state, updated_at: new Date().toISOString() }).eq('id', entry.id).select('id');
    if (error) throw error;
    if ((data || []).length) restored += 1; else skipped.push({ id: entry.id, why: 'update_matched_nothing' });
  }
  return { restored, of: saved.rows.length, skipped };
}

/** release: keep the rewritten text and put the saved state back (after the rewritten rows are re-verified). */
export async function release(args, { sb }) {
  if (!args.restore) throw new Error('need --restore');
  const saved = JSON.parse(fs.readFileSync(args.restore, 'utf8'));
  if (saved.kind !== 'question_reorder_restore') throw new Error('--restore is not a question_reorder_restore file');
  const rows = await fetchRows(sb, saved.rows.map((e) => e.id));
  const byId = new Map(rows.map((r) => [r.id, r]));
  let released = 0;
  const skipped = [];
  for (const entry of saved.rows) {
    const row = byId.get(entry.id);
    if (!row) { skipped.push({ id: entry.id, why: 'row_not_found' }); continue; }
    if (!rowStillAsWritten(row, entry)) { skipped.push({ id: entry.id, why: 'edited_since_apply' }); continue; }
    if (!STATE_FIELDS.every((f) => row[f] === HOLD[f])) { skipped.push({ id: entry.id, why: 'not_in_the_hold_state' }); continue; }
    const { data, error } = await sb.from('questions').update({ ...entry.state, updated_at: new Date().toISOString() }).eq('id', entry.id).match(HOLD).select('id');
    if (error) throw error;
    if ((data || []).length) released += 1; else skipped.push({ id: entry.id, why: 'update_matched_nothing' });
  }
  return { released, of: saved.rows.length, skipped };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!['dry-run', 'apply', 'restore', 'release'].includes(args.mode)) throw new Error(`unknown --mode=${args.mode}`);
  const needsDb = args.mode !== 'dry-run' || args.source === 'db';
  const sb = needsDb ? await makeClient() : null;
  const result = await ({ 'dry-run': dryRun, apply, restore, release })[args.mode](args, { sb });
  const { plans, ...printable } = result;
  console.log(JSON.stringify(printable, null, 1));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error?.message || error); process.exit(1); });
}
