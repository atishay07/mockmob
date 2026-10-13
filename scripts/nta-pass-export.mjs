// NTA agent pass: read-only export of the live questions in the 15 NTA subjects into judge batches.
// READ-ONLY: select queries only, with the service role from .env.local (production). It never inserts,
// updates, deletes or creates a session and calls no model. Writes only under tmp/nta-pass/.
//
//   node --use-system-ca scripts/nta-pass-export.mjs [outDir]      (default: tmp/nta-pass)
//
// Output:
//   <out>/batches/<subject>__<chapter-slug>__<nn>.json   ~25 questions (a passage or case set stays whole; max 30)
//   <out>/calibration_truth.json                         { [id]: { luna, gemini, mean } } for the 662 factory-scored rows
//   <out>/calibration/cal-01..04.json                    25 factory-scored questions each (no scores), 4 scored subjects
//   <out>/manifest.json                                  counts per subject, batch list, calibration ids
//   <out>/hashes.json                                    { [id]: { subject, content_hash, key } } for scripts/nta-pass-merge.mjs:
//                                                        the hash the engine will compute on the row it reads (slim columns,
//                                                        live passage attached), so a score stays bound to the scored text
// Batch files never contain judge scores, so judges stay blind.
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnv(file = '.env.local') {
  return Object.fromEntries(
    fs.readFileSync(file, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }),
  );
}
const env = loadEnv();
const { CUET_PUBLIC_ALLOWED_SUBJECTS, toInternalSubjectId } = await import('../data/cuet_controls.js');
const { normalizeOptions, getQuestionText } = await import('../data/nta_question_selector.js');
const { contentHash } = await import('../data/content_evidence.js');
const { NTA_SLIM_COLUMNS } = await import('../data/nta_pool.js');
const SLIM = NTA_SLIM_COLUMNS.split(',');

const outDir = path.resolve(process.argv[2] || 'tmp/nta-pass');
const TARGET = 25;
const MAX_WITH_SET = 30;
const SCORED_SUBJECTS = ['english', 'accountancy', 'business_studies', 'economics'];

const sb = createClient(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const supported = new Set([...CUET_PUBLIC_ALLOWED_SUBJECTS].map((s) => toInternalSubjectId(s)));

// ---- read (select only) ----
const rows = [];
for (let o = 0; ; o += 200) {
  const { data, error } = await sb.from('questions').select('*').eq('status', 'live').eq('is_deleted', false).order('id').range(o, o + 199);
  if (error) throw error;
  rows.push(...data);
  if (data.length < 200) break;
}
const { data: groups, error: gErr } = await sb.from('passage_groups').select('id, subject, chapter, title, passage_text, passage_type, status, discoverable');
if (gErr) throw gErr;
const groupById = new Map(groups.map((g) => [g.id, g]));

// ---- helpers ----
const text = (v) => (v == null ? '' : String(v));
const slug = (s) => text(s).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const judge = (row, check) => {
  const s = row.evidence?.record?.checks?.[check]?.item_quality_score;
  return s !== null && s !== undefined && Number.isFinite(Number(s)) ? Number(s) : null;
};
const luna = (r) => judge(r, 'exam_fit');
const gemini = (r) => judge(r, 'independent_evaluation');

function keyOf(row, options) {
  const raw = text(row.correct_answer ?? row.answer ?? row.correct_option ?? row.correctAnswer).trim();
  const idxFields = [row.correct_index, row.correctIndex, row.correct_option_index];
  for (const v of idxFields) {
    const n = Number(v);
    if (v != null && Number.isInteger(n)) { if (n >= 0 && n < options.length) return options[n].key; if (n >= 1 && n <= options.length) return options[n - 1].key; }
  }
  const up = raw.toUpperCase().replace(/^OPTION[_\s-]*/, '').replace(/[).:]+$/, '');
  if (options.some((o) => o.key === up)) return up;
  const byText = options.find((o) => text(o.text).trim().toLowerCase() === raw.toLowerCase());
  return byText ? byText.key : raw || null;
}

function shape(row) {
  const g = groupById.get(row.passage_group_id);
  const options = normalizeOptions(row.options, row).map((o) => ({ key: o.key, text: o.text }));
  const passage = text(row.passage_text || g?.passage_text) || null;
  return {
    id: row.id,
    subject: toInternalSubjectId(row.subject),
    chapter: row.chapter,
    unit: row.unit ?? null,
    type: row.question_type || (row.tags || []).find((t) => String(t).startsWith('question_type:'))?.slice(14) || null,
    stem: getQuestionText(row),
    options,
    correct_key: keyOf(row, options),
    explanation: row.explanation ?? null,
    passage_text: passage,
    set_id: row.passage_group_id || row.passage_id || null,
    set_type: g?.passage_type || null,
    difficulty_label: row.difficulty ?? row.difficulty_label ?? null,
  };
}

// The row as the NTA engine sees it: slim columns, live passage text attached (data/nta_pool.js attachPassages).
function engineView(row) {
  const view = Object.fromEntries(SLIM.filter((column) => column in row).map((column) => [column, row[column]]));
  const g = groupById.get(row.passage_group_id);
  if (g && g.status === 'live' && g.discoverable !== false) view.passage_text = row.passage_text || g.passage_text;
  return view;
}

// ---- select the 15 subjects ----
const live = rows.filter((r) => supported.has(toInternalSubjectId(r.subject)));
const shaped = live.map((r) => ({ src: r, q: shape(r) }));

const truth = {};
for (const { src, q } of shaped) {
  const l = luna(src), g = gemini(src);
  if (l !== null || g !== null) truth[q.id] = { luna: l, gemini: g, mean: l !== null && g !== null ? (l + g) / 2 : (l ?? g), subject: q.subject };
}

// ---- batches: group by subject, chapter; keep each set whole ----
fs.mkdirSync(path.join(outDir, 'batches'), { recursive: true });
fs.mkdirSync(path.join(outDir, 'calibration'), { recursive: true });
fs.mkdirSync(path.join(outDir, 'results'), { recursive: true });
for (const f of fs.readdirSync(path.join(outDir, 'batches'))) if (f.endsWith('.json')) fs.unlinkSync(path.join(outDir, 'batches', f));

const byChapter = new Map();
for (const { q } of shaped) {
  const k = `${q.subject}\u0000${q.chapter || 'unknown'}`;
  if (!byChapter.has(k)) byChapter.set(k, []);
  byChapter.get(k).push(q);
}
const batchPaths = [];
const counts = {};
for (const [k, list] of [...byChapter.entries()].sort()) {
  const [subject, chapter] = k.split('\u0000');
  counts[subject] = (counts[subject] || 0) + list.length;
  // units: a set is one unit; a stand-alone question is a unit of one
  const units = []; const seen = new Map();
  for (const q of list.sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
    if (q.set_id) { if (!seen.has(q.set_id)) { seen.set(q.set_id, []); units.push(seen.get(q.set_id)); } seen.get(q.set_id).push(q); } else units.push([q]);
  }
  // pack into ~TARGET; a set never splits; the cap with a set is MAX_WITH_SET
  const packs = []; let cur = [];
  const flush = () => { if (cur.length) packs.push(cur); cur = []; };
  for (const u of units) {
    if (cur.length && cur.length + u.length > (u.length > 1 || cur.some((x) => x.set_id) ? MAX_WITH_SET : TARGET)) flush();
    cur.push(...u);
    if (cur.length >= TARGET) flush();
  }
  flush();
  // merge a tiny tail into the previous batch when it stays within the cap
  if (packs.length > 1 && packs.at(-1).length < 8 && packs.at(-2).length + packs.at(-1).length <= MAX_WITH_SET) packs.splice(-2, 2, [...packs.at(-2), ...packs.at(-1)]);
  packs.forEach((pack, i) => {
    const name = `${subject}__${slug(chapter)}__${String(i + 1).padStart(2, '0')}`;
    const file = path.join(outDir, 'batches', `${name}.json`);
    fs.writeFileSync(file, JSON.stringify({ batch: name, subject, chapter, count: pack.length, questions: pack }, null, 2));
    batchPaths.push(file);
  });
}

// ---- calibration set: 25 factory-scored per scored subject, no scores, spread over chapters ----
const calPaths = [];
const calIds = {};
SCORED_SUBJECTS.forEach((subject, i) => {
  const pool = shaped.filter(({ q }) => q.subject === subject && truth[q.id]).map(({ q }) => q);
  const chapters = new Map();
  for (const q of pool.sort((a, b) => String(a.id).localeCompare(String(b.id)))) { if (!chapters.has(q.chapter)) chapters.set(q.chapter, []); chapters.get(q.chapter).push(q); }
  // round-robin across chapters, singletons only (no passage sets) except english where passages are part of the exam
  const lists = [...chapters.values()].map((l) => l.filter((q) => !q.set_id || subject === 'english'));
  const picked = [];
  for (let round = 0; picked.length < 25 && lists.some((l) => l[round]); round += 1) for (const l of lists) if (l[round] && picked.length < 25) picked.push(l[round]);
  const name = `cal-${String(i + 1).padStart(2, '0')}`;
  const file = path.join(outDir, 'calibration', `${name}.json`);
  fs.writeFileSync(file, JSON.stringify({ batch: name, subject, count: picked.length, questions: picked }, null, 2));
  calPaths.push(file);
  calIds[name] = picked.map((q) => q.id);
});

fs.writeFileSync(path.join(outDir, 'calibration_truth.json'), JSON.stringify(truth, null, 2));
const hashes = {};
for (const { src, q } of shaped) hashes[q.id] = { subject: q.subject, content_hash: contentHash(engineView(src)), key: q.correct_key };
fs.writeFileSync(path.join(outDir, 'hashes.json'), JSON.stringify(hashes));
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), counts, total: shaped.length, scored: Object.keys(truth).length, batches: batchPaths, calibration: calPaths, calibrationIds: calIds }, null, 2));
console.log(JSON.stringify({ total: shaped.length, scored: Object.keys(truth).length, batches: batchPaths.length, calibration: calPaths.length, counts }, null, 1));
