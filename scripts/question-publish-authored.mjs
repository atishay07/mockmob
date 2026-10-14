#!/usr/bin/env node
// Publishes the agent-authored CUET questions (wave 1, 14 Oct 2026, source claude-authored-2026-10-14) into the live
// question bank, as live and visible rows shaped like the verified live rows (scripts/lib/authored-wave.mjs says exactly
// how), with one passage_groups row per English passage set. Insert only: an id that already exists is never touched.
// Every applied change is saved first to a restore file, and --mode=restore hides or deletes exactly those rows.
//
//   node --use-system-ca scripts/question-publish-authored.mjs --mode=dry-run [--candidates=<file>] [--offline] [--fixtures=tmp/nta-fixtures] [--expect-project=<ref>]
//   node --use-system-ca scripts/question-publish-authored.mjs --mode=apply   --plan=<dry-run.json> --reason=<text> --expect-project=<ref> [--allow-unscored]
//   node --use-system-ca scripts/question-publish-authored.mjs --mode=restore --restore=<restore.json> [--hard-delete] --expect-project=<ref>
//
// dry-run  writes nothing to any database. It maps every candidate, checks the plan, and (unless --offline) READS the target:
//          that every column the insert writes exists, which of the planned ids and group ids already exist, and the live
//          counts per subject. It also checks the committed NTA score tables (agent always; fit when data/nta_fit_scores
//          exists) for an entry bound to each row's content hash, and the local export (--fixtures) for questions of the
//          bank that look the same. It writes authored-publish-plan-<stamp>.json (the full rows, the hashes, the checks).
// apply    re-plans from the candidates file the approved dry run named (sha256 and plan hash must match), refuses when any
//          planned id or group id already exists in the target, refuses unscored rows unless --allow-unscored, saves the
//          restore file, inserts the groups and then the questions in chunks, and reads everything back (visible, same
//          content hash). --expect-project is required: the project ref the target URL must have.
// restore  hides the inserted rows (the same withheld state as scripts/question-hold.mjs, plus is_deleted) and their
//          groups, only where the row is still from this source. --hard-delete deletes them instead, only where the row is
//          still exactly as written. Run it also after a failed apply: it only touches ids named in the restore file.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { contentHash } from '../data/content_evidence.js';
import { ntaAgentScoreEntry } from '../data/nta_agent_scores.js';
import { NEAR_DUPLICATE_STEM_JACCARD, contentTokens, jaccard } from '../data/nta_item_checks.js';
import { AUTHORED_SOURCE, AUTHORED_SUBJECTS, GROUP_COLUMNS, PUBLISH_VERSION, QUESTION_COLUMNS, planPublication, sha256OfFile } from './lib/authored-wave.mjs';

// The final candidates: the wave-1 candidates minus the four that failed the fresh judge pass, with the 19 engine-refused ones reworded.
const DEFAULT_CANDIDATES = 'docs/brain/reports/authored/wave1-candidates-final-2026-10-14.json';
const REPORT_DIR = path.resolve('docs/brain/reports/authored-publish');
// The same withheld state as scripts/question-hold.mjs and Mistake Repair.
const HOLD = Object.freeze({ status: 'pending', verification_state: 'disputed', exploration_state: 'pending_review' });
const CHUNK = 50;
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');
const chunks = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
const isVisible = (row) => !row.is_deleted && row.status === 'live' && row.verification_state === 'verified' && row.exploration_state === 'active';

export function parseArgs(argv) {
  const out = {
    mode: 'dry-run', candidates: DEFAULT_CANDIDATES, plan: null, restore: null, reason: '', outDir: REPORT_DIR, offline: false,
    fixtures: 'tmp/nta-fixtures', expectProject: null, allowUnscored: false, hardDelete: false, now: null, fitDir: 'data/nta_fit_scores', agentDir: null,
  };
  for (const arg of argv) {
    if (arg === '--offline') { out.offline = true; continue; }
    if (arg === '--allow-unscored') { out.allowUnscored = true; continue; }
    if (arg === '--hard-delete') { out.hardDelete = true; continue; }
    const m = arg.match(/^--([\w-]+)=(.*)$/);
    if (!m) continue;
    const [, name, value] = m;
    if (name === 'mode') out.mode = value;
    else if (name === 'candidates') out.candidates = value;
    else if (name === 'plan') out.plan = value;
    else if (name === 'restore') out.restore = value;
    else if (name === 'reason') out.reason = value;
    else if (name === 'out') out.outDir = path.resolve(value);
    else if (name === 'fixtures') out.fixtures = value;
    else if (name === 'expect-project') out.expectProject = value;
    else if (name === 'fit-dir') out.fitDir = value;
    else if (name === 'agent-dir') out.agentDir = value;
    else if (name === 'now') out.now = value;
  }
  return out;
}

export function loadCandidates(file) {
  const buffer = fs.readFileSync(file);
  return { candidates: JSON.parse(buffer.toString('utf8')), sha256: sha256OfFile(buffer) };
}

function loadEnv(file = '.env.local') {
  return Object.fromEntries(
    fs.readFileSync(file, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }),
  );
}

/** The project ref and host of a Supabase URL (https://<ref>.supabase.co). */
export function targetOf(url) {
  const host = new URL(url).hostname;
  return { host, ref: host.split('.')[0] };
}

async function makeClient(args) {
  const { createClient } = await import('@supabase/supabase-js');
  const env = loadEnv();
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const target = targetOf(url);
  if (args.expectProject && target.ref !== args.expectProject) throw new Error(`--expect-project=${args.expectProject} but the target is ${target.ref}; nothing was done`);
  if (args.mode !== 'dry-run' && !args.expectProject) throw new Error(`--mode=${args.mode} needs --expect-project=<ref> (the target is ${target.ref}); nothing was done`);
  return { sb: createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }), target };
}

// ---------------------------------------------------------------------------------------------
// Select-only reads of the target
// ---------------------------------------------------------------------------------------------

/** Columns the insert writes that the target table does not have (a select of them errors with 42703). */
export async function missingColumns(sb, table, columns) {
  const missing = [];
  const { error } = await sb.from(table).select(columns.join(',')).limit(1);
  if (!error) return missing;
  // One query names one missing column; probe each to list them all.
  for (const column of columns) {
    const probe = await sb.from(table).select(column).limit(1);
    if (probe.error) missing.push({ column, code: probe.error.code || null, message: probe.error.message });
  }
  if (!missing.length) throw error;
  return missing;
}

export async function existingIds(sb, table, ids) {
  const found = [];
  for (const part of chunks(ids, 100)) {
    const { data, error } = await sb.from(table).select('id').in('id', part);
    if (error) throw error;
    found.push(...(data || []).map((row) => row.id));
  }
  return found;
}

async function liveCounts(sb, subjects) {
  const counts = {};
  for (const subject of subjects) {
    const { count, error } = await sb.from('questions').select('id', { count: 'exact', head: true }).eq('subject', subject).eq('status', 'live').eq('is_deleted', false);
    if (error) throw error;
    counts[subject] = count ?? null;
  }
  return counts;
}

async function fetchRows(sb, ids) {
  const rows = [];
  for (const part of chunks(ids, CHUNK)) {
    const { data, error } = await sb.from('questions').select('*').in('id', part);
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

// ---------------------------------------------------------------------------------------------
// Local checks
// ---------------------------------------------------------------------------------------------

/**
 * Whether each planned row has score entries bound to its current content hash: the agent tables (committed under
 * data/nta_agent_scores) always, the fit tables (data/nta_fit_scores) when that directory exists in this checkout.
 */
/** { [subject]: table } from a directory of agent tables (to check tables that are not committed yet), or undefined for the committed ones. */
export function agentTablesFrom(dir) {
  if (!dir) return undefined;
  const tables = {};
  for (const subject of AUTHORED_SUBJECTS) {
    const file = path.join(dir, `${subject}.json`);
    if (fs.existsSync(file)) tables[subject] = JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  return tables;
}

export function scoreCoverage(rows, { fitDir = 'data/nta_fit_scores', agentScores } = {}) {
  const fitTables = new Map();
  const fitAvailable = fs.existsSync(fitDir);
  const loadFit = (subject) => {
    if (!fitTables.has(subject)) {
      const file = path.join(fitDir, `${subject}.json`);
      fitTables.set(subject, fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null);
    }
    return fitTables.get(subject);
  };
  const out = { agent: { bound: 0, missing: [], hashMismatch: [] }, fit: { checked: fitAvailable, bound: 0, missing: [], hashMismatch: [] } };
  for (const row of rows) {
    const hash = contentHash(row);
    const agent = ntaAgentScoreEntry(row.id, { agentScores });
    if (!agent?.entry) out.agent.missing.push(row.id);
    else if (agent.entry.content_hash !== hash) out.agent.hashMismatch.push(row.id);
    else out.agent.bound += 1;
    if (fitAvailable) {
      const entry = loadFit(row.subject)?.questions?.[row.id];
      if (!entry) out.fit.missing.push(row.id);
      else if (entry.content_hash !== hash) out.fit.hashMismatch.push(row.id);
      else out.fit.bound += 1;
    }
  }
  return out;
}

/** Ids the NTA engine could not admit for want of a score entry bound to the row's hash (agent always, fit where the fit tables exist). */
export function unscoredIds(scores) {
  return [...new Set([...scores.agent.missing, ...scores.agent.hashMismatch, ...(scores.fit.checked ? [...scores.fit.missing, ...scores.fit.hashMismatch] : [])])];
}

const normalise = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Questions of the bank (a local export, tmp/nta-fixtures: no network) that look like a planned row: the same stem and the
 * same set of options, or a stem that shares at least NEAR_DUPLICATE_STEM_JACCARD of its words. Informational: it never blocks.
 */
export function bankLookalikes(rows, fixturesDir) {
  if (!fixturesDir || !fs.existsSync(fixturesDir)) return { checked: false, exact: [], near: [] };
  const bySubject = new Map();
  for (const file of fs.readdirSync(fixturesDir).filter((name) => name.endsWith('.json') && !['manifest.json', 'shared.json'].includes(name))) {
    for (const row of JSON.parse(fs.readFileSync(path.join(fixturesDir, file), 'utf8'))) {
      if (row.status !== 'live' || row.is_deleted) continue;
      const stem = row.body ?? row.question ?? '';
      const options = (Array.isArray(row.options) ? row.options : []).map((option) => normalise(typeof option === 'string' ? option : option?.text));
      const list = bySubject.get(row.subject) || [];
      list.push({ id: row.id, stemKey: normalise(stem), optionKey: options.slice().sort().join('|'), tokens: contentTokens(stem) });
      bySubject.set(row.subject, list);
    }
  }
  const exact = [];
  const near = [];
  for (const row of rows) {
    const stemKey = normalise(row.body);
    const optionKey = row.options.map((option) => normalise(option.text)).sort().join('|');
    const tokens = contentTokens(row.body);
    for (const other of bySubject.get(row.subject) || []) {
      if (other.stemKey === stemKey && other.optionKey === optionKey) exact.push({ id: row.id, existingId: other.id });
      else if (tokens.size >= 6 && jaccard(tokens, other.tokens) >= NEAR_DUPLICATE_STEM_JACCARD) near.push({ id: row.id, existingId: other.id });
    }
  }
  return { checked: true, exact, near };
}

// ---------------------------------------------------------------------------------------------
// dry-run
// ---------------------------------------------------------------------------------------------

/** dry-run: plan every candidate and check the target with select-only reads. Writes a plan file, never a row. */
export async function dryRun(args, { sb = null, target = null } = {}) {
  const { candidates, sha256 } = loadCandidates(args.candidates);
  const plan = planPublication(candidates);
  if (plan.problems.length) throw new Error(`candidates do not validate (${plan.problems.length}): ${JSON.stringify(plan.problems.slice(0, 5))}`);
  const rowIds = plan.rows.map((row) => row.id);
  const groupIds = plan.groups.map((group) => group.id);
  const checks = { target: target ? target.host : 'not read (--offline)' };
  if (sb && !args.offline) {
    checks.questionColumnsMissing = await missingColumns(sb, 'questions', QUESTION_COLUMNS);
    checks.passageGroupColumnsMissing = await missingColumns(sb, 'passage_groups', GROUP_COLUMNS);
    checks.existingQuestionIds = await existingIds(sb, 'questions', rowIds);
    checks.existingGroupIds = await existingIds(sb, 'passage_groups', groupIds);
    checks.liveBefore = await liveCounts(sb, Object.keys(plan.summary.bySubject));
  } else {
    checks.note = 'offline: the target was not read, so column presence, existing ids and live counts are NOT checked';
  }
  checks.scores = scoreCoverage(plan.rows, { fitDir: args.fitDir, agentScores: agentTablesFrom(args.agentDir) });
  checks.bankLookalikes = bankLookalikes(plan.rows, args.fixtures);
  const blockers = [];
  if (checks.questionColumnsMissing?.length) blockers.push('questions table lacks columns the insert writes');
  if (checks.passageGroupColumnsMissing?.length) blockers.push('passage_groups table lacks columns the insert writes');
  if (checks.existingQuestionIds?.length) blockers.push(`${checks.existingQuestionIds.length} planned question ids already exist`);
  if (checks.existingGroupIds?.length) blockers.push(`${checks.existingGroupIds.length} planned passage group ids already exist`);
  if (unscoredIds(checks.scores).length) blockers.push('rows without an agent score entry (and a fit entry, where the fit tables exist) bound to their content hash: merge the scores first (scripts/authored-scores-merge.mjs)');
  const report = {
    kind: 'authored_publish_plan', version: PUBLISH_VERSION, mode: 'dry-run', source: AUTHORED_SOURCE, at: args.now || new Date().toISOString(),
    candidatesFile: args.candidates, candidatesSha256: sha256, planHash: plan.planHash,
    summary: plan.summary, blockers,
    // Not blockers: a passage set below the engine's minimum is published (practice and full mock show it) but NTA mode will not serve it.
    warnings: plan.summary.passageSetsBelowNtaMinimum.map((set) => `passage set ${set.setId} has ${set.children} questions, below the NTA minimum of ${set.ntaMinimum}: not served in NTA mode`),
    checks: summariseChecks(checks),
  };
  fs.mkdirSync(args.outDir, { recursive: true });
  const planFile = path.join(args.outDir, `authored-publish-plan-${stamp()}.json`);
  fs.writeFileSync(planFile, JSON.stringify({ ...report, checksDetail: checks, groups: plan.groups, rows: plan.rows }, null, 1));
  return { ...report, planFile };
}

function summariseChecks(checks) {
  return {
    target: checks.target,
    ...(checks.note ? { note: checks.note } : {}),
    ...(checks.questionColumnsMissing ? { questionColumnsMissing: checks.questionColumnsMissing.length, passageGroupColumnsMissing: checks.passageGroupColumnsMissing.length, existingQuestionIds: checks.existingQuestionIds.length, existingGroupIds: checks.existingGroupIds.length, liveBefore: checks.liveBefore } : {}),
    agentScores: { bound: checks.scores.agent.bound, missing: checks.scores.agent.missing.length, hashMismatch: checks.scores.agent.hashMismatch.length },
    fitScores: checks.scores.fit.checked ? { bound: checks.scores.fit.bound, missing: checks.scores.fit.missing.length, hashMismatch: checks.scores.fit.hashMismatch.length } : 'not checked: no data/nta_fit_scores in this checkout',
    bankLookalikes: checks.bankLookalikes.checked ? { exact: checks.bankLookalikes.exact.length, nearStem: checks.bankLookalikes.near.length } : 'not checked: no local export',
  };
}

// ---------------------------------------------------------------------------------------------
// apply
// ---------------------------------------------------------------------------------------------

/** apply: insert the approved plan. Saves the restore file before the first insert. */
export async function apply(args, { sb, target = null }) {
  if (!args.plan || !args.reason) throw new Error('need --plan and --reason');
  const approved = JSON.parse(fs.readFileSync(args.plan, 'utf8'));
  if (approved.kind !== 'authored_publish_plan' || approved.version !== PUBLISH_VERSION) throw new Error('--plan is not an authored_publish_plan of this version');
  const { candidates, sha256 } = loadCandidates(approved.candidatesFile);
  if (sha256 !== approved.candidatesSha256) throw new Error('the candidates file changed since the approved dry run (sha256 differs); run the dry run again');
  const plan = planPublication(candidates);
  if (plan.problems.length) throw new Error(`candidates do not validate: ${JSON.stringify(plan.problems.slice(0, 5))}`);
  if (plan.planHash !== approved.planHash) throw new Error('the rows this script would write differ from the approved dry run (plan hash differs); run the dry run again');
  if (approved.blockers?.length) throw new Error(`the approved dry run listed blockers: ${approved.blockers.join('; ')}`);

  const rowIds = plan.rows.map((row) => row.id);
  const groupIds = plan.groups.map((group) => group.id);
  const missingQuestionColumns = await missingColumns(sb, 'questions', QUESTION_COLUMNS);
  const missingGroupColumns = plan.groups.length ? await missingColumns(sb, 'passage_groups', GROUP_COLUMNS) : [];
  if (missingQuestionColumns.length || missingGroupColumns.length) throw new Error(`the target lacks columns: ${JSON.stringify([...missingQuestionColumns, ...missingGroupColumns].map((c) => c.column))}`);
  const alreadyQuestions = await existingIds(sb, 'questions', rowIds);
  const alreadyGroups = await existingIds(sb, 'passage_groups', groupIds);
  if (alreadyQuestions.length || alreadyGroups.length) {
    throw new Error(`refusing: ${alreadyQuestions.length} question ids and ${alreadyGroups.length} passage group ids already exist in the target (${[...alreadyQuestions, ...alreadyGroups].slice(0, 3).join(', ')}...). Nothing was written.`);
  }
  const scores = scoreCoverage(plan.rows, { fitDir: args.fitDir, agentScores: agentTablesFrom(args.agentDir) });
  const unscored = unscoredIds(scores);
  if (unscored.length && !args.allowUnscored) throw new Error(`refusing: ${unscored.length} rows have no agent score entry (or fit entry, where the fit tables exist) bound to their content hash, so the NTA engine could not admit them. Merge the scores first, or pass --allow-unscored.`);

  const at = args.now || new Date().toISOString();
  const rows = plan.rows.map((row) => ({ ...row, live_at: at }));
  fs.mkdirSync(args.outDir, { recursive: true });
  const restoreFile = path.join(args.outDir, `authored-publish-restore-${stamp()}.json`);
  const report = {
    kind: 'authored_publish_restore', version: PUBLISH_VERSION, source: AUTHORED_SOURCE, reason: args.reason, at,
    target: target ? target.host : null, planHash: plan.planHash, planFile: args.plan,
    questionIds: rowIds, groupIds,
    rows: plan.rows.map((row) => ({ id: row.id, subject: row.subject, contentHash: contentHash(row) })),
  };
  // The restore file is written before any row is touched.
  fs.writeFileSync(restoreFile, JSON.stringify(report, null, 1));

  const liveBefore = await liveCounts(sb, Object.keys(plan.summary.bySubject));
  let groupsInserted = 0;
  let questionsInserted = 0;
  try {
    for (const part of chunks(plan.groups, CHUNK)) {
      const { data, error } = await sb.from('passage_groups').insert(part).select('id');
      if (error) throw error;
      groupsInserted += (data || []).length;
    }
    for (const part of chunks(rows, CHUNK)) {
      const { data, error } = await sb.from('questions').insert(part).select('id');
      if (error) throw error;
      questionsInserted += (data || []).length;
    }
  } catch (error) {
    const wrapped = new Error(`insert failed after ${groupsInserted} groups and ${questionsInserted} questions: ${error?.message || error}. Run --mode=restore --restore=${restoreFile} to withdraw what was written.`);
    wrapped.restoreFile = restoreFile;
    throw wrapped;
  }

  const readBack = await fetchRows(sb, rowIds);
  const byId = new Map(readBack.map((row) => [row.id, row]));
  const expected = new Map(plan.rows.map((row) => [row.id, contentHash(row)]));
  const missing = rowIds.filter((id) => !byId.has(id));
  const notVisible = readBack.filter((row) => !isVisible(row)).map((row) => row.id);
  const hashMismatch = readBack.filter((row) => contentHash(row) !== expected.get(row.id)).map((row) => row.id);
  const groupsRead = await existingIds(sb, 'passage_groups', groupIds);
  return {
    kind: 'authored_publish', mode: 'apply', source: AUTHORED_SOURCE, at, planned: rows.length, groupsPlanned: plan.groups.length,
    inserted: questionsInserted, groupsInserted, missing, notVisible, hashMismatch, groupsMissing: groupIds.filter((id) => !groupsRead.includes(id)),
    liveBefore, liveAfter: await liveCounts(sb, Object.keys(plan.summary.bySubject)), restoreFile,
  };
}

// ---------------------------------------------------------------------------------------------
// restore
// ---------------------------------------------------------------------------------------------

/**
 * restore: withdraw what apply wrote. Hide (default) puts the rows into the withheld state and marks them deleted, and takes
 * their groups out of discovery; --hard-delete deletes the rows that are still exactly as written, then the groups no
 * remaining question points at. Only ids named in the restore file, only rows still from this source.
 */
export async function restore(args, { sb }) {
  if (!args.restore) throw new Error('need --restore');
  const saved = JSON.parse(fs.readFileSync(args.restore, 'utf8'));
  if (saved.kind !== 'authored_publish_restore' || saved.source !== AUTHORED_SOURCE) throw new Error('--restore is not an authored_publish_restore file of this source');
  const rows = await fetchRows(sb, saved.questionIds);
  const mine = new Map(rows.filter((row) => row.source === AUTHORED_SOURCE).map((row) => [row.id, row]));
  const skipped = [];
  for (const id of saved.questionIds) if (!mine.has(id)) skipped.push({ id, why: 'not_found_or_not_from_this_source' });
  const savedHash = new Map(saved.rows.map((row) => [row.id, row.contentHash]));
  const at = new Date().toISOString();
  let affected = 0;
  if (args.hardDelete) {
    const deletable = [];
    for (const [id, row] of mine) {
      if (contentHash(row) !== savedHash.get(id)) skipped.push({ id, why: 'edited_since_apply' }); else deletable.push(id);
    }
    for (const part of chunks(deletable, CHUNK)) {
      const { data, error } = await sb.from('questions').delete().in('id', part).eq('source', AUTHORED_SOURCE).select('id');
      if (error) throw error;
      affected += (data || []).length;
    }
    // A group goes only when no question points at it any more.
    let groupsDeleted = 0;
    for (const groupId of saved.groupIds) {
      const { data, error } = await sb.from('questions').select('id').eq('passage_group_id', groupId).limit(1);
      if (error) throw error;
      if ((data || []).length) { skipped.push({ id: groupId, why: 'group_still_has_questions' }); continue; }
      const removed = await sb.from('passage_groups').delete().eq('id', groupId).eq('source', AUTHORED_SOURCE).select('id');
      if (removed.error) throw removed.error;
      groupsDeleted += (removed.data || []).length;
    }
    return { mode: 'restore', action: 'hard-delete', of: saved.questionIds.length, deleted: affected, groupsDeleted, skipped };
  }
  for (const part of chunks([...mine.keys()], CHUNK)) {
    const { data, error } = await sb.from('questions').update({ ...HOLD, is_deleted: true, updated_at: at }).in('id', part).eq('source', AUTHORED_SOURCE).select('id');
    if (error) throw error;
    affected += (data || []).length;
  }
  let groupsHidden = 0;
  for (const part of chunks(saved.groupIds, CHUNK)) {
    const { data, error } = await sb.from('passage_groups').update({ status: 'hidden', discoverable: false }).in('id', part).eq('source', AUTHORED_SOURCE).select('id');
    if (error) throw error;
    groupsHidden += (data || []).length;
  }
  return { mode: 'restore', action: 'hide', of: saved.questionIds.length, hidden: affected, groupsHidden, skipped };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!['dry-run', 'apply', 'restore'].includes(args.mode)) throw new Error(`unknown --mode=${args.mode}`);
  let client = { sb: null, target: null };
  if (!(args.mode === 'dry-run' && args.offline)) client = await makeClient(args);
  const result = await ({ 'dry-run': dryRun, apply, restore })[args.mode](args, client);
  console.log(JSON.stringify(result, null, 1));
  if (args.mode === 'dry-run' && result.blockers.length) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error?.message || error); process.exit(1); });
}
