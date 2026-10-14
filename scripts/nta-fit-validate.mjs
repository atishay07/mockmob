// Checks fit result files against docs/brain/NTA-CUET-FIT-RUBRIC.md. OFFLINE, read-only.
//
//   node scripts/nta-fit-validate.mjs [--dir tmp/nta-pass/fit] [--batch <name>] [--judges h1,h2,h3] [--exclude fcal-] [--json <report.json>]
//   (copy of tmp/nta-pass/fit/build/validate-fit-results.mjs; the committed copy defaults to the three Haiku judges)
//
//   --judges   comma list of judge suffixes to check (default h1,h2,h3; the first fit run used fj1,fj2)
//   --exclude  skip batch names starting with this prefix (for example fcal- to leave calibration out)
//   --json     also write { files, problems per file } to this path
//   Every non-excluded batch in batches/ (and calibration/ unless excluded) must have a result file per judge;
//   a missing file is reported as invalid ("missing").
//
// For every fit/results/<batch>__<judge>.json it checks the format (section 9), the ladder (section 6: the
// fit_score must equal the ladder result for the judge's own dims, flags and route) and the allowed names.
// Prints one line per problem and a summary; exit code 1 when any file is invalid.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const dir = path.resolve(arg('dir', 'tmp/nta-pass/fit'));
const only = arg('batch', null);
const judges = arg('judges', 'h1,h2,h3').split(',').map((x) => x.trim()).filter(Boolean);
const exclude = arg('exclude', null);
const jsonOut = arg('json', null);
const rd = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

const FLAGS = { syllabus_not_entitled: 2, not_cuet_format: 4, off_pattern_for_subject: 4, level_above_cbt: 5, too_slow: 5 };
const SKILLS = new Set(['central_idea', 'detail', 'not_mentioned', 'inference', 'tone_attitude', 'vocabulary_in_context', 'title', 'application', 'calculation', 'other']);
const RUBRIC_TYPES = ['passage_set_item', 'assertion_reason', 'match_the_following', 'sentence_rearrangement', 'sequence_ordering', 'statement_based', 'synonym', 'antonym', 'idiom_phrase', 'one_word_substitution', 'error_detection', 'fill_in_blank', 'single_mcq'];
const ROUTES = new Set(['pyq', 'board', 'cbt_staple', 'key_aspect']);
const DIMS = ['syllabus_objective', 'format_authenticity', 'level_calibration', 'time_suitability', 'discrimination_value'];
const BASE = { 15: 10, 14: 9, 13: 9, 12: 8, 11: 8, 10: 7, 9: 6, 8: 6, 7: 5, 6: 5, 5: 4, 4: 3, 3: 3, 2: 2, 1: 2, 0: 1 };

export const timeLevel = (s) => (s <= 90 ? 3 : s <= 150 ? 2 : s <= 240 ? 1 : 0);
export function ladder({ dims, fit_flags, ten_route }) {
  const total = DIMS.reduce((n, k) => n + dims[k], 0);
  let score = BASE[total];
  for (const f of fit_flags) score = Math.min(score, FLAGS[f] ?? 10);
  if (dims.syllabus_objective <= 1 || dims.format_authenticity <= 1) score = Math.min(score, 6);
  if (dims.level_calibration === 2) score = Math.min(score, 8);
  if (dims.level_calibration <= 1) score = Math.min(score, 6);
  if (dims.time_suitability === 2) score = Math.min(score, 8);
  if (dims.discrimination_value === 0) score = Math.min(score, 6);
  const nine = dims.format_authenticity === 3 && dims.level_calibration === 3 && dims.time_suitability === 3;
  if (score >= 9 && !nine) score = 8;
  const ten = nine && ten_route && dims.syllabus_objective === 3 && dims.discrimination_value >= 2 && fit_flags.length === 0;
  return ten ? 10 : Math.min(score, 9);
}

export function checkResult(r, q, batch) {
  const p = [];
  const allowed = batch.allowed[q.subject];
  const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  if (r?.id !== q.id) return ['id'];
  // Rubric 7.1: a type missing from the subject's list is written as the real type from the table and flagged
  // off_pattern_for_subject. single_mcq and assertion_reason stay accepted unflagged (as before).
  if (!allowed.types.includes(r.cuet_type) && !['single_mcq', 'assertion_reason'].includes(r.cuet_type)) {
    if (!RUBRIC_TYPES.includes(r.cuet_type)) p.push('cuet_type');
    else if (!Array.isArray(r.fit_flags) || !r.fit_flags.includes('off_pattern_for_subject')) p.push('cuet_type_outside_list_without_off_pattern_flag');
  }
  if (r.cuet_type === 'passage_set_item' ? !SKILLS.has(r.passage_skill) : r.passage_skill !== null) p.push('passage_skill');
  const units = new Map(allowed.units.map((u) => [u.unit, u.chapters]));
  const chapters = new Set([...allowed.units.flatMap((u) => u.chapters), ...allowed.excluded_chapters]);
  if (!chapters.has(r.chapter)) p.push('chapter');
  if (allowed.excluded_chapters.includes(r.chapter) ? r.unit !== null : !(units.get(r.unit) || []).includes(r.chapter)) p.push('unit');
  if (!int(r.pyq_closeness, 0, 3)) p.push('pyq_closeness');
  if ((r.pyq_closeness === 0) !== (r.pyq_anchor === null)) p.push('pyq_anchor');
  if (r.ten_route !== null && !ROUTES.has(r.ten_route)) p.push('ten_route');
  if (!int(r.reasoning_steps, 1, 8)) p.push('reasoning_steps');
  if (int(r.reasoning_steps, 1, 8) && r.est_seconds !== q.read_seconds + 18 * r.reasoning_steps) p.push(`est_seconds(expected ${q.read_seconds + 18 * r.reasoning_steps})`);
  if (!r.dims || DIMS.some((k) => !int(r.dims[k], 0, 3))) p.push('dims');
  else if (r.dims.time_suitability !== timeLevel(r.est_seconds)) p.push('time_suitability_vs_est_seconds');
  if (!Array.isArray(r.fit_flags) || r.fit_flags.some((f) => !(f in FLAGS))) p.push('fit_flags');
  if (!int(r.fit_score, 0, 10)) p.push('fit_score');
  if (typeof r.note !== 'string' || r.note.length > 200) p.push('note');
  if (!p.length) {
    if (r.dims.time_suitability <= 1 && !r.fit_flags.includes('too_slow')) p.push('missing_flag:too_slow');
    if (r.dims.level_calibration === 0 && !r.fit_flags.includes('level_above_cbt')) p.push('missing_flag:level_above_cbt');
    if (r.dims.format_authenticity === 0 && !r.fit_flags.includes('not_cuet_format')) p.push('missing_flag:not_cuet_format');
    if (r.dims.syllabus_objective === 0 && !r.fit_flags.includes('syllabus_not_entitled')) p.push('missing_flag:syllabus_not_entitled');
    if (r.ten_route === 'pyq' && r.pyq_closeness !== 3) p.push('route_pyq_needs_closeness_3');
    const expected = ladder(r);
    if (r.fit_score !== expected) p.push(`ladder(expected ${expected}, got ${r.fit_score})`);
  }
  return p;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let files = 0; let invalid = 0; let rows = 0; let problems = 0;
  const resDir = path.join(dir, 'results');
  const hist = {};
  const kinds = {};
  const report = [];
  const judgeRe = new RegExp('__(' + judges.join('|') + ')\\.json$');
  const present = new Set(fs.existsSync(resDir) ? fs.readdirSync(resDir) : []);
  // Expected files: every batch (not excluded) times every judge, so a missing file is not silent.
  const batchNames = new Set();
  for (const sub of ['batches', 'calibration']) {
    const d = path.join(dir, sub);
    if (fs.existsSync(d)) for (const x of fs.readdirSync(d)) if (x.endsWith('.json')) batchNames.add(x.replace(/\.json$/, ''));
  }
  const names = [];
  for (const name of [...batchNames].sort()) {
    if (exclude && name.startsWith(exclude)) continue;
    if (only && name !== only) continue;
    for (const j of judges) names.push({ name, j, f: name + '__' + j + '.json' });
  }
  for (const { name, j, f } of names) {
        if (!present.has(f)) { console.log(f + ': missing'); invalid += 1; files += 1; report.push({ file: f, batch: name, judge: j, problem: 'missing' }); kinds.missing = (kinds.missing || 0) + 1; continue; }
  }
  // Result files with a recognised judge suffix but no matching batch file.
  for (const f of [...present].sort()) {
    if (!judgeRe.test(f)) continue;
    const name = f.replace(judgeRe, '');
    if (exclude && name.startsWith(exclude)) continue;
    if (only && name !== only) continue;
    if (!batchNames.has(name)) { console.log(f + ': no batch file'); invalid += 1; files += 1; report.push({ file: f, batch: name, problem: 'no batch file' }); kinds.no_batch_file = (kinds.no_batch_file || 0) + 1; }
  }
  for (const { name, j, f } of names) {
    if (!present.has(f)) continue;
    const bf = [path.join(dir, 'batches', name + '.json'), path.join(dir, 'calibration', name + '.json')].find((x) => fs.existsSync(x));
    files += 1;
    const batch = rd(bf);
    let results;
    try { results = rd(path.join(resDir, f)); } catch (e) { console.log(f + ': not valid JSON'); invalid += 1; report.push({ file: f, batch: name, judge: j, problem: 'not valid JSON' }); kinds.not_valid_json = (kinds.not_valid_json || 0) + 1; continue; }
    if (!Array.isArray(results) || results.length !== batch.questions.length) { console.log(f + ': expected ' + batch.questions.length + ' results'); invalid += 1; report.push({ file: f, batch: name, judge: j, problem: 'expected ' + batch.questions.length + ' results, got ' + (Array.isArray(results) ? results.length : 'a non-array') }); kinds.wrong_length = (kinds.wrong_length || 0) + 1; continue; }
    let bad = 0;
    const rowProblems = [];
    batch.questions.forEach((q, i) => {
      let p;
      try { p = checkResult(results[i], q, batch); } catch (e) { p = ['unreadable_row(' + e.message + ')']; }
      rows += 1;
      if (p.length) {
        bad += 1; problems += p.length;
        console.log(f + ' #' + (i + 1) + ' ' + q.id.slice(0, 8) + ': ' + p.join(', '));
        rowProblems.push({ index: i + 1, id: q.id, problems: p });
        for (const x of p) { const k = x.replace(/\(.*$/, ''); kinds[k] = (kinds[k] || 0) + 1; }
      } else hist[results[i].fit_score] = (hist[results[i].fit_score] || 0) + 1;
    });
    if (bad) { invalid += 1; report.push({ file: f, batch: name, judge: j, rows: batch.questions.length, badRows: bad, rowProblems }); }
  }
  const summary = { judges, files, invalidFiles: invalid, rows, problems, problemKinds: kinds, fitScoreHistogramValidRows: hist };
  console.log(JSON.stringify(summary));
  if (jsonOut) fs.writeFileSync(path.resolve(jsonOut), JSON.stringify({ summary, invalid: report }, null, 1));
  process.exit(invalid ? 1 : 0);
}
