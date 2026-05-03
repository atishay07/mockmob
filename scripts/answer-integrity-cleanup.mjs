#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  TOP_15_ANSWER_GUARD_SUBJECTS,
  verifyAnswerIntegrity,
} from '../data/answer_integrity.js';

const REPORT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'pipeline',
  'data',
  'answer_integrity_reports',
);

const DEFINITE_REJECTION_REASONS = new Set([
  'answer_guard_options_count',
  'answer_guard_options_invalid',
  'answer_guard_key_unresolved',
  'answer_guard_correct_option_empty',
  'answer_guard_near_duplicate_options',
  'answer_guard_explanation_contradicts_key',
  'answer_guard_multiple_explanation_claims',
]);

const QUESTION_SELECT_FIELDS = [
  'id',
  'subject',
  'chapter',
  'body',
  'question',
  'options',
  'correct_answer',
  'correct_index',
  'explanation',
  'status',
  'verification_state',
  'exploration_state',
  'is_deleted',
];

export function parseArgs(argv = process.argv) {
  const out = {
    mode: 'dry-run',
    subjects: 'top15',
    scope: 'visible',
    limit: null,
    fromReport: null,
    reportDir: REPORT_DIR,
  };

  for (const arg of argv.slice(2)) {
    const match = arg.match(/^--([\w-]+)=(.+)$/);
    if (!match) continue;
    const [, key, value] = match;
    if (key === 'mode') out.mode = value;
    if (key === 'subjects') out.subjects = value;
    if (key === 'scope') out.scope = value;
    if (key === 'limit') out.limit = Math.max(1, Number(value));
    if (key === 'from-report') out.fromReport = value;
    if (key === 'report-dir') out.reportDir = value;
  }

  if (!['dry-run', 'apply'].includes(out.mode)) {
    throw new Error(`--mode must be dry-run or apply, got "${out.mode}"`);
  }
  if (out.scope !== 'visible') {
    throw new Error(`Only --scope=visible is supported for this safe cleanup rollout, got "${out.scope}"`);
  }
  if (out.mode === 'apply' && !out.fromReport) {
    throw new Error('--mode=apply requires --from-report=<dry-run-report.json>');
  }

  return out;
}

export function resolveSubjectFilter(subjects = 'top15') {
  if (subjects === 'top15') return [...TOP_15_ANSWER_GUARD_SUBJECTS];
  const list = String(subjects || '')
    .split(',')
    .map((subject) => subject.trim())
    .filter(Boolean);
  if (list.length === 0) throw new Error('No subjects resolved for answer integrity cleanup.');
  const invalid = list.filter((subject) => !TOP_15_ANSWER_GUARD_SUBJECTS.includes(subject));
  if (invalid.length > 0) {
    throw new Error(`Cleanup is limited to top15 subjects right now. Invalid: ${invalid.join(', ')}`);
  }
  return [...new Set(list)];
}

function makeSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function fetchVisibleQuestions(supabase, options) {
  const subjects = resolveSubjectFilter(options.subjects);
  const pageSize = 500;
  const limit = Number.isFinite(options.limit) ? options.limit : Infinity;
  const rows = [];
  let includeAnswerCheck = true;

  for (let from = 0; rows.length < limit; from += pageSize) {
    const remaining = limit - rows.length;
    const end = from + Math.min(pageSize, remaining) - 1;
    const fields = includeAnswerCheck
      ? [...QUESTION_SELECT_FIELDS, 'answer_check']
      : QUESTION_SELECT_FIELDS;
    let { data, error } = await supabase
      .from('questions')
      .select(fields.join(', '))
      .in('subject', subjects)
      .eq('is_deleted', false)
      .eq('status', 'live')
      .eq('verification_state', 'verified')
      .eq('exploration_state', 'active')
      .order('id', { ascending: true })
      .range(from, end);

    if (error && includeAnswerCheck && /answer_check|schema cache|does not exist/i.test(error.message || '')) {
      includeAnswerCheck = false;
      ({ data, error } = await supabase
        .from('questions')
        .select(QUESTION_SELECT_FIELDS.join(', '))
        .in('subject', subjects)
        .eq('is_deleted', false)
        .eq('status', 'live')
        .eq('verification_state', 'verified')
        .eq('exploration_state', 'active')
        .order('id', { ascending: true })
        .range(from, end));
    }

    if (error) throw error;
    const page = Array.isArray(data) ? data : [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows.slice(0, limit);
}

export function classifyAnswerIntegrity(row) {
  const check = verifyAnswerIntegrity(row, { verification: 'database_cleanup' });
  if (check.accepted) {
    return {
      action: 'keep',
      severity: 'clean',
      check,
      reasons: [],
      patch: null,
    };
  }

  const hasDefiniteReason = check.reasons.some((reason) => DEFINITE_REJECTION_REASONS.has(reason));
  const action = hasDefiniteReason ? 'reject' : 'dispute';
  return {
    action,
    severity: hasDefiniteReason ? 'definite' : 'uncertain',
    check,
    reasons: check.reasons,
    patch: buildSafeHidePatch(action),
  };
}

export function buildSafeHidePatch(action) {
  if (action === 'reject') {
    return {
      is_deleted: true,
      status: 'rejected',
      verification_state: 'rejected',
      exploration_state: 'rejected',
    };
  }
  if (action === 'dispute') {
    return {
      is_deleted: true,
      status: 'rejected',
      verification_state: 'disputed',
      exploration_state: 'rejected',
    };
  }
  return null;
}

function topReasons(entries) {
  const counts = new Map();
  for (const entry of entries) {
    for (const reason of entry.reasons || []) {
      counts.set(reason, (counts.get(reason) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([reason, count]) => ({ reason, count }));
}

export function createAnswerIntegrityReport(rows, options = {}) {
  const subjects = resolveSubjectFilter(options.subjects);
  const subjectSet = new Set(subjects);
  const scopedRows = rows.filter((row) => subjectSet.has(row.subject));
  const entries = scopedRows.map((row) => {
    const classification = classifyAnswerIntegrity(row);
    return {
      id: row.id,
      subject: row.subject,
      chapter: row.chapter || null,
      action: classification.action,
      severity: classification.severity,
      reasons: classification.reasons,
      correctKey: classification.check.correctKey,
      explanationClaims: classification.check.explanationClaims,
      patch: classification.patch,
    };
  });
  const rejected = entries.filter((entry) => entry.action === 'reject');
  const disputed = entries.filter((entry) => entry.action === 'dispute');
  const clean = entries.filter((entry) => entry.action === 'keep');

  return {
    kind: 'answer_integrity_cleanup_report',
    version: 1,
    mode: options.mode || 'dry-run',
    scope: 'visible',
    subjects,
    createdAt: new Date().toISOString(),
    totals: {
      scanned: entries.length,
      clean: clean.length,
      rejected: rejected.length,
      disputed: disputed.length,
      unsafe: rejected.length + disputed.length,
    },
    topReasons: topReasons([...rejected, ...disputed]),
    rejections: rejected,
    disputes: disputed,
    cleanIds: clean.map((entry) => entry.id),
  };
}

async function writeReport(report, reportDir) {
  await fs.mkdir(reportDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(reportDir, `answer-integrity-top15-${stamp}.json`);
  await fs.writeFile(target, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return target;
}

function actionableEntriesFromReport(report) {
  const entries = [
    ...(Array.isArray(report?.rejections) ? report.rejections : []),
    ...(Array.isArray(report?.disputes) ? report.disputes : []),
  ];
  const subjects = new Set(resolveSubjectFilter((report?.subjects || TOP_15_ANSWER_GUARD_SUBJECTS).join?.(',') || 'top15'));
  return entries.filter((entry) =>
    entry?.id &&
    subjects.has(entry.subject) &&
    ['reject', 'dispute'].includes(entry.action)
  );
}

async function updateIds(supabase, entries, action) {
  const ids = entries.map((entry) => entry.id);
  if (ids.length === 0) return 0;
  const patch = buildSafeHidePatch(action);
  let updated = 0;

  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100);
    const { data, error } = await supabase
      .from('questions')
      .update(patch)
      .in('id', chunk)
      .in('subject', TOP_15_ANSWER_GUARD_SUBJECTS)
      .eq('is_deleted', false)
      .select('id');

    if (error) throw error;
    updated += Array.isArray(data) ? data.length : 0;
  }

  return updated;
}

export async function applyAnswerIntegrityReport(supabase, report) {
  const entries = actionableEntriesFromReport(report);
  const rejected = entries.filter((entry) => entry.action === 'reject');
  const disputed = entries.filter((entry) => entry.action === 'dispute');
  const rejectedUpdated = await updateIds(supabase, rejected, 'reject');
  const disputedUpdated = await updateIds(supabase, disputed, 'dispute');
  return {
    requested: entries.length,
    rejectedRequested: rejected.length,
    disputedRequested: disputed.length,
    rejectedUpdated,
    disputedUpdated,
    updated: rejectedUpdated + disputedUpdated,
  };
}

async function main() {
  const options = parseArgs();
  const supabase = makeSupabase();

  if (options.mode === 'apply') {
    const raw = await fs.readFile(options.fromReport, 'utf8');
    const report = JSON.parse(raw);
    const result = await applyAnswerIntegrityReport(supabase, report);
    console.log(JSON.stringify({ mode: 'apply', result }, null, 2));
    return;
  }

  const rows = await fetchVisibleQuestions(supabase, options);
  const report = createAnswerIntegrityReport(rows, options);
  const reportPath = await writeReport(report, options.reportDir);
  console.log(JSON.stringify({
    mode: 'dry-run',
    reportPath,
    totals: report.totals,
    topReasons: report.topReasons,
  }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
