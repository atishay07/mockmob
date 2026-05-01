import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import {
  getNtaContentWarnings,
  getPassageText,
  getQuestionText,
  hasRealPassageBlock,
  NTA_QUESTION_COUNT,
  qualityGateNtaQuestion,
  selectNtaQuestionSet,
} from '../data/nta_question_selector.js';
import { toInternalSubjectId } from '../data/cuet_controls.js';

function parseArgs(argv = process.argv.slice(2)) {
  return Object.fromEntries(argv.map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    return [key, rest.join('=') || 'true'];
  }));
}

function splitList(value) {
  return String(value || '').split(',').map((entry) => entry.trim()).filter(Boolean);
}

function loadEnv(path = '.env.local') {
  if (!fs.existsSync(path)) return {};
  return Object.fromEntries(
    fs.readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const idx = line.indexOf('=');
        return [line.slice(0, idx), line.slice(idx + 1)];
      }),
  );
}

async function fetchSubjectRows(supabase, subject, limit = 5000) {
  const pageSize = 1000;
  const rows = [];
  let useDeletedFilter = true;

  for (let offset = 0; offset < limit; offset += pageSize) {
    const end = Math.min(offset + pageSize - 1, limit - 1);
    let query = supabase
      .from('questions')
      .select('*')
      .eq('subject', subject)
      .order('created_at', { ascending: false })
      .range(offset, end);

    if (useDeletedFilter) query = query.eq('is_deleted', false);

    let { data, error } = await query;
    if (error && useDeletedFilter && error.code === '42703') {
      useDeletedFilter = false;
      ({ data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('subject', subject)
        .order('created_at', { ascending: false })
        .range(offset, end));
    }
    if (error) throw error;

    const page = Array.isArray(data) ? data : [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

function preview(text, length = 120) {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  return cleaned.length > length ? `${cleaned.slice(0, length - 1)}...` : cleaned;
}

function selectedWarnings(row, subject) {
  const warnings = [...getNtaContentWarnings(row, { subjectId: subject })];
  const gate = qualityGateNtaQuestion(row, { subjectId: subject });
  if (!gate.accepted) warnings.push(...gate.reasons.map((reason) => `selected_failed_gate:${reason}`));
  return Array.from(new Set(warnings));
}

function duplicateWarnings(selectedRows) {
  const seenIds = new Set();
  const seenText = new Set();
  const warningsById = new Map();
  for (const row of selectedRows) {
    const warnings = [];
    const id = String(row.id || '');
    const text = preview(getQuestionText(row), 500).toLowerCase();
    if (id && seenIds.has(id)) warnings.push('duplicate_question_id');
    if (text && seenText.has(text)) warnings.push('duplicate_question_text');
    if (id) seenIds.add(id);
    if (text) seenText.add(text);
    if (warnings.length) warningsById.set(id, warnings);
  }
  return warningsById;
}

function printRun(subject, run, result) {
  const { selectedRows, diagnostics } = result;
  const duplicateMap = duplicateWarnings(selectedRows);
  console.log(`\n# NTA sample subject=${subject} run=${run}`);
  console.log(`selected=${selectedRows.length}/${NTA_QUESTION_COUNT} canBuild50=${diagnostics.canBuild50} durationMinutes=${diagnostics.durationMinutes}`);
  console.log(`topRejectReasons=${JSON.stringify(diagnostics.poolStats.topRejectReasons || [])}`);
  console.log('idx | id | chapter | type | passage_group_id | real_passage | text | warnings');
  console.log('---: | --- | --- | --- | --- | --- | --- | ---');
  selectedRows.forEach((row, index) => {
    const passageText = getPassageText(row);
    const warnings = [
      ...selectedWarnings(row, subject),
      ...(duplicateMap.get(String(row.id || '')) || []),
    ];
    console.log([
      index + 1,
      row.id || '',
      row.chapter || '',
      row.question_type || row.questionType || '',
      row.passage_group_id || row.passageGroupId || row.group_id || '',
      passageText ? (hasRealPassageBlock(row) ? 'yes' : 'too_short') : 'no',
      preview(getQuestionText(row)).replace(/\|/g, '/'),
      warnings.length ? warnings.join(',') : '-',
    ].join(' | '));
  });
}

const args = parseArgs();
const env = loadEnv();
const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
function normalizeSubjectArg(subject) {
  const normalized = String(subject || '').trim().toLowerCase().replace(/-/g, '_');
  if (normalized === 'general_test') return 'gat';
  return toInternalSubjectId(normalized);
}

const subjects = splitList(args.subject || args.subjects || 'english').map(normalizeSubjectArg);
const runs = Math.max(1, Number(args.runs || 1));
const limit = Math.max(50, Number(args.limit || 5000));

for (const subject of subjects) {
  const rows = await fetchSubjectRows(supabase, subject, limit);
  console.log(`\n## Loaded ${rows.length} candidate rows for ${subject}`);
  for (let run = 1; run <= runs; run += 1) {
    const seed = `${args.seed || 'nta-sample'}:${subject}:${run}`;
    const result = selectNtaQuestionSet(rows, NTA_QUESTION_COUNT, { subjectId: subject, seed });
    printRun(subject, run, result);
  }
}
