import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { CUET_ALLOWED_SUBJECTS } from '../data/cuet_controls.js';
import { NTA_QUESTION_COUNT, selectNtaQuestionSet } from '../data/nta_question_selector.js';

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

function formatReasons(reasons) {
  if (!Array.isArray(reasons) || reasons.length === 0) return '-';
  return reasons.map((entry) => `${entry.reason}:${entry.count}`).join(', ');
}

const env = loadEnv();
const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

console.log('subject | total candidates | usable | hard rejected | tier1 | tier2 | tier3 | canBuild50 | passageGroups | top reject reasons');
console.log('--- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---');

for (const subject of CUET_ALLOWED_SUBJECTS) {
  const rows = await fetchSubjectRows(supabase, subject);
  const { diagnostics } = selectNtaQuestionSet(rows, NTA_QUESTION_COUNT, {
    subjectId: subject,
    seed: `diagnose:${subject}`,
  });
  const stats = diagnostics.poolStats;
  console.log([
    subject,
    stats.totalSubjectCandidates,
    stats.usable,
    stats.hardRejected,
    stats.tier1,
    stats.tier2,
    stats.tier3,
    diagnostics.canBuild50 ? 'yes' : 'no',
    stats.passageGroupsSelected,
    formatReasons(stats.topRejectReasons),
  ].join(' | '));
}
