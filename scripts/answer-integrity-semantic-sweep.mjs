#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  TOP_15_ANSWER_GUARD_SUBJECTS,
  normalizeAnswerOptions,
  resolveAnswerCorrectIndex,
} from '../data/answer_integrity.js';

const REPORT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'pipeline',
  'data',
  'answer_integrity_reports',
);

function parseArgs(argv = process.argv) {
  const out = {
    mode: 'dry-run',
    subjects: 'top15',
    scope: 'visible',
    limit: null,
    batchSize: 30,
    concurrency: 3,
    model: process.env.NTA_ANSWER_VERIFIER_MODEL || 'gpt-5-nano',
    failThreshold: Number(process.env.ANSWER_SEMANTIC_FAIL_THRESHOLD || 0.74),
    reportDir: REPORT_DIR,
    fromReport: null,
  };

  for (const arg of argv.slice(2)) {
    const match = arg.match(/^--([\w-]+)=(.+)$/);
    if (!match) continue;
    const [, key, value] = match;
    if (key === 'mode') out.mode = value;
    if (key === 'subjects') out.subjects = value;
    if (key === 'scope') out.scope = value;
    if (key === 'limit') out.limit = Math.max(1, Number(value));
    if (key === 'batch-size') out.batchSize = Math.max(1, Math.min(50, Number(value)));
    if (key === 'concurrency') out.concurrency = Math.max(1, Math.min(6, Number(value)));
    if (key === 'model') out.model = value;
    if (key === 'fail-threshold') out.failThreshold = Math.max(0.5, Math.min(0.95, Number(value)));
    if (key === 'report-dir') out.reportDir = value;
    if (key === 'from-report') out.fromReport = value;
  }

  if (!['dry-run', 'apply'].includes(out.mode)) {
    throw new Error(`--mode must be dry-run or apply, got "${out.mode}"`);
  }
  if (out.scope !== 'visible') {
    throw new Error(`Only --scope=visible is supported for this rollout, got "${out.scope}"`);
  }
  if (out.subjects !== 'top15') {
    throw new Error('Semantic sweep is limited to --subjects=top15 right now.');
  }
  if (out.mode === 'apply' && !out.fromReport) {
    throw new Error('--mode=apply requires --from-report=<semantic-report.json>');
  }

  return out;
}

function makeSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function fetchVisibleRows(supabase, options) {
  const rows = [];
  const pageSize = 500;
  const limit = Number.isFinite(options.limit) ? options.limit : Infinity;

  for (let from = 0; rows.length < limit; from += pageSize) {
    const end = from + Math.min(pageSize, limit - rows.length) - 1;
    const { data, error } = await supabase
      .from('questions')
      .select('id, subject, chapter, body, question, options, correct_answer, correct_index, explanation, status, verification_state, exploration_state, is_deleted')
      .in('subject', TOP_15_ANSWER_GUARD_SUBJECTS)
      .eq('is_deleted', false)
      .eq('status', 'live')
      .eq('verification_state', 'verified')
      .eq('exploration_state', 'active')
      .order('id', { ascending: true })
      .range(from, end);

    if (error) throw error;
    const page = Array.isArray(data) ? data : [];
    rows.push(...page);
    console.log(`[semantic_sweep] fetched_page rows=${rows.length}`);
    if (page.length < pageSize) break;
  }

  return rows.slice(0, limit);
}

function toVerifierItem(row) {
  const options = normalizeAnswerOptions(row.options, row);
  const correctIndex = resolveAnswerCorrectIndex(row, options);
  const answerKey = correctIndex >= 0 ? options[correctIndex]?.key : String(row.correct_answer || '').trim().toUpperCase();
  return {
    id: row.id,
    subject: row.subject,
    chapter: row.chapter || null,
    question: String(row.body || row.question || '').slice(0, 1200),
    options,
    answer_key: answerKey || null,
    explanation: row.explanation ? String(row.explanation).slice(0, 800) : null,
  };
}

function normalizeAiResult(item, raw, threshold) {
  const verdict = String(raw?.verdict || '').trim().toLowerCase();
  const solved = String(raw?.solved_answer || '').trim().toUpperCase().replace(/^OPTION[_\s-]*/, '').replace(/[).:]+$/, '');
  const confidence = Math.max(0, Math.min(1, Number(raw?.confidence || 0)));
  const answerKey = String(item.answer_key || '').trim().toUpperCase();
  const mismatch = Boolean(answerKey && solved && answerKey !== solved);
  const failed = mismatch && confidence >= threshold;
  return {
    id: item.id,
    subject: item.subject,
    chapter: item.chapter,
    answerKey,
    solvedAnswer: solved || null,
    verdict: ['pass', 'fail', 'unsure'].includes(verdict) ? verdict : 'unsure',
    confidence,
    action: failed && confidence >= threshold ? (confidence >= 0.84 ? 'reject' : 'dispute') : 'keep',
    reason: String(raw?.reason || '').replace(/\s+/g, ' ').trim().slice(0, 260),
  };
}

async function verifyBatch(openai, batch, options, attempt = 1) {
  const payload = {
    instructions: [
      'Solve each MCQ independently.',
      'Compare your solved answer with answer_key.',
      'Use verdict "fail" only when the stored answer key is clearly wrong or the item has no single defensible answer.',
      'Use verdict "unsure" when the question cannot be solved from the given text.',
      'Return concise JSON only with results.',
    ],
    schema: {
      results: [{ id: 'string', verdict: 'pass|fail|unsure', solved_answer: 'A|B|C|D|null', confidence: '0..1', reason: 'max 12 words' }],
    },
    items: batch,
  };

  try {
    const response = await openai.chat.completions.create({
      model: options.model,
      messages: [
        { role: 'system', content: 'You are a strict CUET MCQ answer-key auditor. Return only valid JSON.' },
        { role: 'user', content: JSON.stringify(payload) },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 8000,
    });
    const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
    const resultMap = new Map((Array.isArray(parsed.results) ? parsed.results : []).map((entry) => [entry.id, entry]));
    return batch.map((item) => normalizeAiResult(item, resultMap.get(item.id), options.failThreshold));
  } catch (error) {
    if (attempt < 2) return verifyBatch(openai, batch, options, attempt + 1);
    return batch.map((item) => ({
      id: item.id,
      subject: item.subject,
      chapter: item.chapter,
      answerKey: item.answer_key,
      solvedAnswer: null,
      verdict: 'unsure',
      confidence: 0,
      action: 'keep',
      reason: `ai_batch_failed:${error.message}`,
    }));
  }
}

async function verifyRows(rows, options) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const items = rows.map(toVerifierItem);
  const batches = [];
  for (let index = 0; index < items.length; index += options.batchSize) {
    batches.push(items.slice(index, index + options.batchSize));
  }

  const results = [];
  let next = 0;
  let completed = 0;

  async function worker() {
    while (next < batches.length) {
      const current = next;
      next += 1;
      const batchResults = await verifyBatch(openai, batches[current], options);
      results.push(...batchResults);
      completed += 1;
      if (completed % 10 === 0 || completed === batches.length) {
        const flagged = results.filter((entry) => entry.action !== 'keep').length;
        console.log(`[semantic_sweep] batches=${completed}/${batches.length} checked=${results.length}/${items.length} flagged=${flagged}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(options.concurrency, batches.length) }, () => worker()));
  return results.sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function summarize(results, options) {
  const rejected = results.filter((entry) => entry.action === 'reject');
  const disputed = results.filter((entry) => entry.action === 'dispute');
  const unsure = results.filter((entry) => entry.verdict === 'unsure');
  return {
    kind: 'answer_integrity_semantic_sweep_report',
    version: 1,
    model: options.model,
    failThreshold: options.failThreshold,
    scope: 'visible',
    subjects: TOP_15_ANSWER_GUARD_SUBJECTS,
    createdAt: new Date().toISOString(),
    totals: {
      checked: results.length,
      kept: results.length - rejected.length - disputed.length,
      rejected: rejected.length,
      disputed: disputed.length,
      unsafe: rejected.length + disputed.length,
      unsure: unsure.length,
    },
    rejections: rejected,
    disputes: disputed,
    results,
  };
}

async function writeReport(report, reportDir) {
  await fs.mkdir(reportDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(reportDir, `answer-integrity-semantic-top15-${stamp}.json`);
  await fs.writeFile(target, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return target;
}

async function updateIds(supabase, entries, action) {
  const ids = entries.map((entry) => entry.id);
  if (ids.length === 0) return 0;
  const patch = action === 'reject'
    ? { is_deleted: true, status: 'rejected', verification_state: 'rejected', exploration_state: 'rejected' }
    : { is_deleted: true, status: 'rejected', verification_state: 'disputed', exploration_state: 'rejected' };
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

async function applyReport(supabase, report) {
  const rejected = Array.isArray(report.rejections) ? report.rejections : [];
  const disputed = Array.isArray(report.disputes) ? report.disputes : [];
  const rejectedUpdated = await updateIds(supabase, rejected, 'reject');
  const disputedUpdated = await updateIds(supabase, disputed, 'dispute');
  return {
    requested: rejected.length + disputed.length,
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
    const report = JSON.parse(await fs.readFile(options.fromReport, 'utf8'));
    const result = await applyReport(supabase, report);
    console.log(JSON.stringify({ mode: 'apply', result }, null, 2));
    return;
  }

  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required for semantic sweep.');
  const rows = await fetchVisibleRows(supabase, options);
  console.log(`[semantic_sweep] fetched=${rows.length} model=${options.model} batchSize=${options.batchSize} concurrency=${options.concurrency}`);
  const results = await verifyRows(rows, options);
  const report = summarize(results, options);
  const reportPath = await writeReport(report, options.reportDir);
  console.log(JSON.stringify({
    mode: 'dry-run',
    reportPath,
    totals: report.totals,
  }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
