#!/usr/bin/env node
// Authored wave 2 (claude-authored-2026-10-14-w2): acceptance of the raw solver and judge files, and an offline engine check.
// OFFLINE: reads files, writes files under docs/brain/reports/authored-w2. No database, no network, no model, no engine edit.
//
//   node scripts/authored-w2-accept.mjs --mode=accept [--raw=tmp/authored-w2] [--out=docs/brain/reports/authored-w2] [--date=2026-10-14]
//   node scripts/authored-w2-accept.mjs --mode=check  [--out=docs/brain/reports/authored-w2] [--root=<checkout>] [--label=<name>] [--final]
//   node scripts/authored-w2-accept.mjs --mode=final  [--raw=tmp/authored-w2] [--out=docs/brain/reports/authored-w2] [--date=2026-10-14]
//
// --wave=w3 (17 Oct 2026, claude-authored-2026-10-17-w3: general_test, physics, chemistry; batches <subject>__w3b<n> under tmp/authored-w3s) runs the very
//   same acceptance rule and engine check with the wave-3 settings (WAVE_CONFIGS below): other source, other file names
//   (wave3-acceptance-, wave3-candidates-scored-, wave3-score-entries-, wave3-engine-check-<label>-), the batch text is also compared with the
//   assembled candidates file (--candidates) and the manifest, the candidates carry that file's _verdict (haiku_blind_verified / opus_audited),
//   wave 2's final candidates join the duplicate screen. Wave 3 has no expert pass, no fresh pass and no final mode. The default is --wave=w2: nothing changes there.
//
// --wave=w4 (17 Oct 2026, claude-authored-2026-10-17-w4: general_test, physics, chemistry, mathematics, biology; batches <subject>__w4b<n> under tmp/authored-w4s) is the
//   same acceptance rule and engine check again (accept and check modes; --mode=final, added after the expert pass, is the wave-3 final mode with wave-4 inputs). Files: wave4-acceptance-,
//   wave4-candidates-scored-, wave4-score-entries-, wave4-engine-check-<label>-. The duplicate screen also reads wave 2's final and wave 3's final candidates.
//   Wave 4 holds case sets (biology, chemistry, general_test); the engine check gives them the group ids the publisher writes (groupIdOfCandidate).
//
// final   (14 Oct, after the expert pass, the rewords and the spot-check) the same acceptance, now also reading
//           --expert=<dir>        expert verdicts (docs/brain/reports/authored-w2/expert/*.json, { verdicts: [{ id, verdict, why, repair }] })
//           --asjudged=<file>     the candidates as the first acceptance judged them (wave2-candidates-asjudged-...json), so a repair after judging is recorded
//           --fresh=<dir> ...     fresh judge passes on a later wording (default tmp/authored-w2/reword: batch rw-w2 and its five solvers, two quality and three fit judges)
//           --resolve=<dir>       blind re-solves of expert-repaired text (rv-w2-blind.json and rv-w2__s1..s3.json; default tmp/authored-w2/resolve)
//           --decisions=<file>    drops decided by hand (wave2-drop-decisions-...json: id, category, reason, who)
//           --spotcheck=<file>    the independent spot-check table (wave2-spotcheck-...md)
//         and writes wave2-candidates-final-, wave2-score-entries-final- and wave2-dropped- (every drop with its reason) besides the acceptance files.
//         The wave-1 rules carry over: a fresh pass counts only when its batch text is the final text and all ten of its records are there; a repaired
//         question whose text blind solvers see changed after they solved needs its own blind re-solve (2 of 3 on the key), and is held back without one
//         (nothing is invented); a repair that touched only what solvers do not see (explanation, label, NCERT reference) keeps the solvers' result.
//
// accept  validates every file of tmp/authored-w2/<subject>/ (batch text, blind text, five solver files s1-s5, two quality-judge
//         files j1-j2, three CUET-fit judge files h1-h3 per batch) and applies the wave-1 acceptance rule per question
//         (docs/brain/AUTHORED-QUESTIONS-WAVE1-2026-10-14.md): at least 4 of 5 blind solvers match the key; both quality judges
//         score 7 or more with no flag and a blind answer equal to the key; the fit median is 8 or more and fewer than two fit judges
//         raise a flag. A question whose records are missing or malformed is NOT accepted (nothing is invented). Writes
//           wave2-acceptance-2026-10-14.json     per question: accepted and reasons, plus the per-subject table and the file validation
//           wave2-candidates-2026-10-14.json     accepted questions in the wave-1 candidates format (_verdict is null: no expert pass yet)
//           wave2-score-entries-2026-10-14.json  one durable record per accepted question, the wave-1 entries format
// check   reads those two files and runs the NTA engine's own eligibility check (data/nta_engine.js ntaEligibility, quality gate and
//         CUET-fit gate, the content gates included) on every accepted question with the committed agent and fit tables plus the
//         wave-2 entries merged in memory. --root names the checkout whose engine and tables are used (default: this one). Nothing in
//         data/ is written. Writes wave2-engine-check-<label>-2026-10-14.json.
//
// Why this is a wrapper and not authored-scores-merge.mjs: that script and scripts/lib/authored-wave.mjs are wave 1 specific
// (AUTHORED_SUBJECTS lists six subjects, the source must be claude-authored-2026-10-14, every candidate needs an expert verdict of
// ready or repaired, passage children must be type passage_set_item, and the batch text loader only reads <subject>__<letter><digit>.json).
// This file reuses their pure helpers (qualityProblems, fitCheck, acceptanceReasons, agentEntryFor, fitEntryFor, mergeAgentTable,
// mergeFitTable, toQuestionRow, contentHashOf) and does not change them.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { applyExpertRepair } from './lib/authored-w3-repair.mjs';

const SKIP_DIRS = new Set(['reword', 'expert', 'resolve', 'exemplars', 'prompts']);
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const W2_SOURCE = 'claude-authored-2026-10-14-w2';
export const W3_SOURCE = 'claude-authored-2026-10-17-w3';
export const W4_SOURCE = 'claude-authored-2026-10-17-w4';
const SOLVERS = ['s1', 's2', 's3', 's4', 's5'];
const QUALITY = ['j1', 'j2'];
const FIT = ['h1', 'h2', 'h3'];
const ROLES = [...SOLVERS, ...QUALITY, ...FIT];
const ROLE_FILE = /^(.+)__(s[1-5]|j[12]|h[1-3])\.json$/;
const OPTION_KEYS = ['A', 'B', 'C', 'D'];
const LEVELS = ['easy', 'medium', 'hard'];
const MODELS = { quality: 'claude-haiku-5-5', fit: 'claude-haiku-5-5', solver: 'claude-haiku-5-5' };
const RULE = {
  solversMatchingKeyAtLeast: 4, solversRequired: 5, qualityScoreAtLeast: 7, qualityFlagsAllowed: 0, qualityBlindAnswerMustEqualKey: true,
  fitMedianAtLeast: 8, fitFlaggedByFewerThan: 2, source: 'docs/brain/AUTHORED-QUESTIONS-WAVE1-2026-10-14.md (acceptance rule), docs/brain/RUNBOOK-PUBLISH-AUTHORED-2026-10-14.md section 0',
};
const BLIND_FIELDS_W2 = ['stem', 'options', 'passage_text', 'chapter', 'type', 'subject'];
// Per wave settings. Wave 2 is the original behaviour and the default; every value here is what the code used to hold as a literal.
export const WAVE_CONFIGS = {
  w2: {
    id: 'w2', wave: 2, source: W2_SOURCE, label: 'wave2', kind: 'authored_w2', modelNote: 'claude-haiku-5-5 for every solver and judge was stated by the orchestrator (14 Oct 2026)',
    models: MODELS, finalMode: true,
    raw: 'tmp/authored-w2', out: 'docs/brain/reports/authored-w2', date: '2026-10-14',
    files: (date) => ({ acceptance: `wave2-acceptance-${date}.json`, candidates: `wave2-candidates-${date}.json`, entries: `wave2-score-entries-${date}.json` }),
    engineFile: (label, date) => `wave2-engine-check-${label}-${date}.json`,
    batchRe: null, priorFiles: [], blindFields: BLIND_FIELDS_W2,
    expert: 'docs/brain/reports/authored-w2/expert', asjudged: 'docs/brain/reports/authored-w2/wave2-candidates-asjudged-2026-10-14.json', fresh: ['tmp/authored-w2/reword'],
    resolve: 'tmp/authored-w2/resolve', decisions: 'docs/brain/reports/authored-w2/wave2-drop-decisions-2026-10-14.json',
    spotcheck: 'docs/brain/reports/authored-w2/wave2-spotcheck-2026-10-14.md', engineReasons: 'docs/brain/reports/authored-w2/wave2-engine-check-working-r5.2-2026-10-14.json',
    sourceCandidates: null, manifest: null,
    resolvePrefix: 'rv-w2', finalInputs: null, carryBlindAnswers: false,
    batchLabel: '<subject>__w3b<n>',
    acceptNote: 'Wave-1 acceptance rule applied to the wave-2 raw files. Questions whose solver or judge records are missing or malformed are not accepted; no result was invented. No expert pass has been run on wave 2 (candidates carry _verdict: null).',
    entriesNote: 'One record per question the rule accepted (the acceptance rule and the duplicate screen, before the hand decisions and the expert gate), in the wave-1 entries format. Built by scripts/authored-w2-accept.mjs; --mode=final narrows it to the publication set (wave2-score-entries-final-). The first-pass pair, before the expert repairs and the rewords, is kept as wave2-candidates-asjudged- and wave2-score-entries-asjudged-.',
  },
  w3: {
    id: 'w3', wave: 3, source: W3_SOURCE, label: 'wave3', kind: 'authored_w3', modelNote: 'the model of the subagents that produced the raw files is not recorded in them',
    models: { quality: 'claude-subagent-unrecorded', fit: 'claude-subagent-unrecorded', solver: 'claude-subagent-unrecorded' }, finalMode: false,
    raw: 'tmp/authored-w3s', out: 'docs/brain/reports/authored-w3', date: '2026-10-17',
    files: (date) => ({ acceptance: `wave3-acceptance-${date}.json`, candidates: `wave3-candidates-scored-${date}.json`, entries: `wave3-score-entries-${date}.json` }),
    engineFile: (label, date) => `wave3-engine-check-${label}-${date}.json`,
    blindFields: ['stem', 'options', 'passage_text', 'type', 'subject'], // the wave-3 blind file carries no chapter by design
    batchRe: /^(chemistry|general_test|physics)__w3b\d+$/, priorFiles: [{ from: 'wave2', file: 'docs/brain/reports/authored-w2/wave2-candidates-final-2026-10-14.json' }],
    expert: null, asjudged: null, fresh: [], resolve: null, decisions: null, spotcheck: null, engineReasons: null,
    sourceCandidates: 'docs/brain/reports/authored-w3/wave3-candidates-2026-10-17.json', manifest: 'tmp/authored-w3s/manifest.json',
    // --mode=final (17 Oct 2026, after the expert pass): the inputs the first-pass acceptance above does not read. The accept mode keeps its defaults (null) so its output never changes.
    // repairs: the expert verdicts' repairs are applied to the batch text here (the batch files are never edited); resolve: blind re-solves rv-w3-blind.json and rv-w3__s1..s3.json;
    // fresh: the full fresh pass (rw-w3 batch text, blind text, s1-s5, j1-j2, h1-h3) on the reworded rows.
    resolvePrefix: 'rv-w3', carryBlindAnswers: true,
    finalInputs: { expert: 'docs/brain/reports/authored-w3/expert', resolve: 'tmp/authored-w3s/resolve', fresh: ['tmp/authored-w3s/reword'] },
    // The owner's publish rule of 17 Oct 2026: the mean of the two quality judges and the fit median are both 8 or more; 7 to 7.9 is held.
    publishRule: { qualityMeanAtLeast: 8, fitMedianAtLeast: 8 },
    batchLabel: '<subject>__w3b<n>',
    acceptNote: 'Wave-1 acceptance rule applied to the wave-3 raw files (general_test, physics, chemistry; Hindi was not laid out). Questions whose solver or judge records are missing or malformed are not accepted; no result was invented. The candidates carry the authoring verdict of the assembled candidates file (haiku_blind_verified or opus_audited), not an expert verdict.',
    entriesNote: 'One record per question the wave-3 rule accepted (the acceptance rule and the duplicate screen, no expert gate: the questions were verified by blind solvers, a few also audited), in the wave-1 entries format. Built by scripts/authored-w2-accept.mjs --wave=w3 from the raw files under tmp/authored-w3s (untracked scratch; the batch text is also in the commit that laid it out). Tables are built from it by scripts/authored-scores-merge.mjs later; nothing here is written into data/.',
  },
  // Wave 4 (17 Oct 2026): accept and check modes only. The same rule, the same engine check; the authoring verdict of every candidate is claude_audited.
  w4: {
    id: 'w4', wave: 4, source: W4_SOURCE, label: 'wave4', kind: 'authored_w4', modelNote: 'the model of the subagents that produced the raw files is not recorded in them',
    models: { quality: 'claude-subagent-unrecorded', fit: 'claude-subagent-unrecorded', solver: 'claude-subagent-unrecorded' }, finalMode: false,
    raw: 'tmp/authored-w4s', out: 'docs/brain/reports/authored-w4', date: '2026-10-17',
    files: (date) => ({ acceptance: `wave4-acceptance-${date}.json`, candidates: `wave4-candidates-scored-${date}.json`, entries: `wave4-score-entries-${date}.json` }),
    engineFile: (label, date) => `wave4-engine-check-${label}-${date}.json`,
    blindFields: ['stem', 'options', 'passage_text', 'type', 'subject'], // the blind file carries no chapter by design (as in wave 3)
    batchRe: /^(biology|chemistry|general_test|mathematics|physics)__w4b\d+$/,
    priorFiles: [
      { from: 'wave2', file: 'docs/brain/reports/authored-w2/wave2-candidates-final-2026-10-14.json' },
      { from: 'wave3', file: 'docs/brain/reports/authored-w3/wave3-candidates-final-2026-10-17.json' },
    ],
    expert: null, asjudged: null, fresh: [], resolve: null, decisions: null, spotcheck: null, engineReasons: null,
    sourceCandidates: 'docs/brain/reports/authored-w4/wave4-candidates-2026-10-17.json', manifest: 'tmp/authored-w4s/manifest.json',
    resolvePrefix: 'rv-w4', carryBlindAnswers: false,
    // --mode=final (17 Oct 2026, after the expert pass): the inputs the first-pass acceptance does not read (the accept mode keeps its null defaults, so its output never changes).
    // expert: verdicts with the repairs (applied to the batch text here, the batch files are never edited); resolve: blind re-solves rv-w4-blind.json and rv-w4__s1..s3.json of the repairs
    // that changed what a solver sees; fresh: the full fresh pass (rw-w4 batch text, blind text, s1-s5, j1-j2, h1-h3) on reworded rows (wave 4 has none).
    finalInputs: { expert: 'docs/brain/reports/authored-w4/expert', resolve: 'tmp/authored-w4s/resolve', fresh: ['tmp/authored-w4s/reword'] },
    // The owner's publish rule of 17 Oct 2026: the mean of the two quality judges and the fit median are both 8 or more; 7 to 7.9 is held.
    publishRule: { qualityMeanAtLeast: 8, fitMedianAtLeast: 8 },
    batchLabel: '<subject>__w4b<n>',
    acceptNote: 'Wave-1 acceptance rule applied to the wave-4 raw files (general_test, physics, chemistry, mathematics, biology; Hindi stays out; the unaudited physics draft w4-phys-01 was not laid out). Questions whose solver or judge records are missing or malformed are not accepted; no result was invented. The candidates carry the authoring verdict of the assembled candidates file (claude_audited), not an expert verdict.',
    entriesNote: 'One record per question the wave-4 rule accepted (the acceptance rule and the duplicate screen, no expert gate: every question was authored by Claude, solved blind and audited by a second Claude pass), in the wave-1 entries format. Built by scripts/authored-w2-accept.mjs --wave=w4 from the raw files under tmp/authored-w4s (the role files are committed with git add -f). Tables are built from it by scripts/authored-scores-merge.mjs later; nothing here is written into data/.',
  },
};
const FILES = (date, cfg = WAVE_CONFIGS.w2) => ({
  ...cfg.files(date),
  ...(cfg.finalMode ? { candidatesFinal: `wave2-candidates-final-${date}.json`, entriesFinal: `wave2-score-entries-final-${date}.json`, dropped: `wave2-dropped-${date}.json` } : {}),
  ...(cfg.finalInputs ? { acceptanceFinal: `${cfg.label}-final-acceptance-${date}.json`, candidatesFinal: `${cfg.label}-candidates-final-${date}.json`, entriesFinal: `${cfg.label}-score-entries-final-${date}.json`, dropped: `${cfg.label}-dropped-${date}.json`, held: `${cfg.label}-held-7-${date}.json` } : {}),
  engine: (label) => cfg.engineFile(label, date),
});

export function parseArgs(argv) {
  const waveArg = argv.map((arg) => arg.match(/^--wave=(.*)$/)).find(Boolean)?.[1] || 'w2';
  const cfg = WAVE_CONFIGS[waveArg];
  if (!cfg) throw new Error(`unknown --wave=${waveArg} (w2, w3 or w4)`);
  const out = {
    wave: cfg.id, cfg, mode: 'accept', raw: cfg.raw, out: cfg.out, root: path.resolve(HERE, '..'), date: cfg.date, label: 'working',
    wave1Final: 'docs/brain/reports/authored/wave1-candidates-final-2026-10-14.json',
    wave1Original: 'docs/brain/reports/authored/wave1-candidates-2026-10-14.json',
    fixtures: 'tmp/nta-fixtures', now: null,
    expert: cfg.expert, asjudged: cfg.asjudged,
    fresh: [], resolve: cfg.resolve, decisions: cfg.decisions,
    spotcheck: cfg.spotcheck, engineReasons: cfg.engineReasons, candidates: cfg.sourceCandidates, manifest: cfg.manifest, final: false,
  };
  for (const arg of argv) {
    const m = arg.match(/^--([\w-]+)=(.*)$/);
    if (!m) continue;
    const [, name, value] = m;
    if (name === 'mode') out.mode = value;
    else if (name === 'raw') out.raw = value;
    else if (name === 'out') out.out = value;
    else if (name === 'root') out.root = path.resolve(value);
    else if (name === 'date') out.date = value;
    else if (name === 'label') out.label = value;
    else if (name === 'wave1-final') out.wave1Final = value;
    else if (name === 'wave1-original') out.wave1Original = value;
    else if (name === 'fixtures') out.fixtures = value;
    else if (name === 'now') out.now = value;
    else if (name === 'expert') out.expert = value;
    else if (name === 'asjudged') out.asjudged = value;
    else if (name === 'fresh') out.fresh.push(value);
    else if (name === 'resolve') out.resolve = value;
    else if (name === 'decisions') out.decisions = value;
    else if (name === 'spotcheck') out.spotcheck = value;
    else if (name === 'engine-reasons') out.engineReasons = value;
    else if (name === 'candidates') out.candidates = value;
    else if (name === 'manifest') out.manifest = value;
  }
  if (argv.includes('--final')) out.final = true;
  if (!out.fresh.length) out.fresh = [...cfg.fresh];
  return out;
}

const text = (value) => (value === null || value === undefined ? '' : String(value));
const up = (value) => text(value).trim().toUpperCase();
const stableJson = (value, indent = 1) => `${JSON.stringify(value, null, indent)}\n`;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const sha256Text = (file) => sha256(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'));
const naturalCompare = (a, b) => a.localeCompare(b, 'en', { numeric: true });
const median3 = (values) => values.slice().sort((x, y) => x - y)[1];
const normStem = (value) => text(value).toLowerCase().replace(/\s+/g, ' ').trim();
const stemKey = (c) => `${c.subject}|${normStem(c.stem)}|${text(c.passage_text).slice(0, 80)}`;
const rel = (file) => path.relative(process.cwd(), file).replace(/\\/g, '/');

function tryJson(file) {
  if (!fs.existsSync(file)) return { state: 'missing' };
  try { return { state: 'ok', value: JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')) }; } catch (error) { return { state: 'malformed', error: text(error.message).slice(0, 200) }; }
}

async function loadLib(root) {
  const imp = (relative) => import(pathToFileURL(path.join(root, relative)).href);
  const [engine, scores, wave, evidence, items, agent] = await Promise.all([
    imp('data/nta_engine.js'), imp('scripts/lib/authored-scores.mjs'), imp('scripts/lib/authored-wave.mjs'), imp('data/content_evidence.js'), imp('data/nta_item_checks.js'), imp('data/nta_agent_scores.js'),
  ]);
  return { root, engine, scores, wave, evidence, items, agent };
}

// ---------------------------------------------------------------------------------------------
// Blueprint facts for the structural checks
// ---------------------------------------------------------------------------------------------

function blueprintFacts(lib, subject) {
  const bp = lib.engine.getNtaBlueprint(subject);
  if (!bp) return null;
  const chapterUnits = new Map();
  for (const variant of bp.variants) for (const section of variant.sections) for (const unit of section.units) {
    for (const chapter of unit.chapters) for (const name of [chapter.name, ...(chapter.aliases || [])]) chapterUnits.set(name, [...new Set([...(chapterUnits.get(name) || []), unit.name])]);
  }
  return { bp, chapterUnits, excluded: new Set((bp.excludedChapters || []).map((entry) => entry.name)), types: bp.typeQuotas, passageWords: bp.sets?.passageWords || null };
}

/** [problem codes] that make a candidate unpublishable or never servable, and [warnings] that do not. */
function structuralCheck(q, subject, facts, lib, source = W2_SOURCE) {
  const problems = [];
  const warnings = [];
  const id = q?.id ?? null;
  if (!lib.items.isNtaQuestionId(id)) problems.push('id_not_uuid');
  if (q.subject !== subject) problems.push('subject_differs_from_folder');
  if (q.source !== source) problems.push(source === W2_SOURCE ? 'source_not_wave2' : 'source_not_this_wave');
  if (!facts) problems.push('no_blueprint_for_subject');
  else {
    if (facts.excluded.has(q.chapter)) problems.push('chapter_excluded_by_blueprint');
    else if (!facts.chapterUnits.has(q.chapter)) problems.push('chapter_not_in_blueprint');
    else if (q.unit && !facts.chapterUnits.get(q.chapter).includes(q.unit)) warnings.push(`unit_differs_from_blueprint:${q.unit}|${facts.chapterUnits.get(q.chapter).join('/')}`);
    const allowed = new Set(Object.keys(facts.types).filter((type) => facts.types[type].max > 0));
    if (q.type !== 'passage_set_item' && !allowed.has(q.type)) problems.push(`type_not_in_paper:${q.type}`);
  }
  if (text(q.stem).trim().length < 10) problems.push('stem_missing_or_too_short');
  if (!text(q.explanation).trim()) problems.push('explanation_missing');
  if (!LEVELS.includes(q.difficulty_label)) problems.push('difficulty_label_invalid');
  const options = Array.isArray(q.options) ? q.options : [];
  if (options.length !== 4 || options.some((option, i) => option?.key !== OPTION_KEYS[i] || !text(option?.text).trim())) problems.push('options_not_four_keyed_A_to_D');
  else if (new Set(options.map((option) => text(option.text).trim().toLowerCase())).size < 4) problems.push('duplicate_option_text');
  if (!OPTION_KEYS.includes(q.correct_key)) problems.push('correct_key_invalid');
  const hasSet = Boolean(text(q.set_id).trim());
  const hasPassage = Boolean(text(q.passage_text).trim());
  if (hasSet !== hasPassage) problems.push(hasSet ? 'set_id_without_passage_text' : 'passage_text_without_set_id');
  if (q.type === 'passage_set_item' && !(hasSet && hasPassage)) problems.push('passage_item_without_passage_or_set');
  if (hasSet && q.type !== 'passage_set_item') warnings.push('case_set_item_typed_as_' + q.type + '_not_passage_set_item');
  return { problems, warnings };
}

// ---------------------------------------------------------------------------------------------
// Phase 1: discover and validate the files
// ---------------------------------------------------------------------------------------------

function discover(rawDir, cfg = WAVE_CONFIGS.w2) {
  const batches = [];
  const unexpected = [];
  // reword (a fresh pass on later wording), expert and resolve (re-solves) are not subjects: they are read by the final mode.
  const subjects = fs.readdirSync(rawDir, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !SKIP_DIRS.has(entry.name)).map((entry) => entry.name).sort();
  for (const subject of subjects) {
    const dir = path.join(rawDir, subject);
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    // <batch>-fitaids.json is what the fit judges were handed besides the batch text (wave 3 layout): not a batch.
    const isAid = (name) => name.endsWith('-fitaids.json');
    const names = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json') && !entry.name.endsWith('-blind.json') && !isAid(entry.name)).map((entry) => entry.name.slice(0, -5)).sort(naturalCompare);
    for (const entry of entries) {
      const file = rel(path.join(dir, entry.name));
      if (entry.isFile() && entry.name.endsWith('-blind.json')) { if (!names.includes(entry.name.slice(0, -11))) unexpected.push({ file, problem: 'blind file without a batch file' }); }
      else if (entry.isFile() && isAid(entry.name)) { if (!names.includes(entry.name.slice(0, -13))) unexpected.push({ file, problem: 'fit-aids file without a batch file' }); }
      else if (entry.isFile() && !entry.name.endsWith('.json')) unexpected.push({ file, problem: 'not a .json file' });
      else if (entry.isDirectory() && entry.name !== 'verify') unexpected.push({ file, problem: 'unexpected folder' });
    }
    const verifyDir = path.join(dir, 'verify');
    for (const name of fs.existsSync(verifyDir) ? fs.readdirSync(verifyDir) : []) {
      if (name === '.gitkeep') continue;
      const m = name.match(ROLE_FILE);
      if (!m || !names.includes(m[1])) unexpected.push({ file: rel(path.join(verifyDir, name)), problem: m ? 'result file of a batch that has no batch file' : 'name is not <batch>__<role>.json' });
    }
    for (const batch of names) {
      if (cfg.batchRe && !cfg.batchRe.test(batch)) { unexpected.push({ file: rel(path.join(dir, `${batch}.json`)), problem: `batch name is not ${cfg.batchLabel}; not scored` }); continue; }
      batches.push({ subject, batch, dir, verifyDir });
    }
  }
  return { batches, unexpected };
}

function validSolver(result, id) {
  const problems = [];
  if (!result || typeof result !== 'object') return ['not an object'];
  if (result.id !== id) problems.push('id');
  if (!['A', 'B', 'C', 'D', '?'].includes(up(result.answer))) problems.push('answer');
  return problems;
}

/** One batch: its text, its blind text, and for every role the state of the file and of each question's record. */
function loadBatch(spec, lib) {
  const { subject, batch, dir, verifyDir } = spec;
  const fileReport = { subject, batch, batchFile: rel(path.join(dir, `${batch}.json`)), problems: [], roles: {} };
  const batchRes = tryJson(path.join(dir, `${batch}.json`));
  const blindRes = tryJson(path.join(dir, `${batch}-blind.json`));
  const out = { subject, batch, fileReport, questions: [], blind: new Map(), roleResults: new Map() };
  if (batchRes.state !== 'ok') { fileReport.problems.push(`batch file ${batchRes.state}`); return out; }
  const header = batchRes.value;
  if (header.batch !== batch) fileReport.problems.push(`batch field is "${header.batch}", file is ${batch}`);
  if (header.subject !== subject) fileReport.problems.push(`subject field is "${header.subject}", folder is ${subject}`);
  if (!Array.isArray(header.questions)) { fileReport.problems.push('questions is not an array'); return out; }
  out.questions = header.questions;
  const ids = out.questions.map((q) => q?.id);
  const idSet = new Set(ids);
  if (idSet.size !== ids.length) fileReport.problems.push('duplicate ids inside the batch file');
  fileReport.questions = ids.length;

  // The blind text the solvers were given must be the batch's text without the key and the explanation.
  // The blind files come in two shapes (an object with a questions array, or a bare array); both carry the same content.
  const blindList = blindRes.state === 'ok' ? (Array.isArray(blindRes.value) ? blindRes.value : blindRes.value?.questions) : null;
  if (blindRes.state !== 'ok') fileReport.problems.push(`blind file ${blindRes.state}`);
  else if (!Array.isArray(blindList)) fileReport.problems.push('blind file is neither an array nor an object with a questions array');
  else {
    fileReport.blindFormat = Array.isArray(blindRes.value) ? 'bare_array' : 'object_with_questions';
    const blind = blindList;
    if (blind.length !== ids.length) fileReport.problems.push(`blind file has ${blind.length} questions, batch has ${ids.length}`);
    for (const question of blind) out.blind.set(question.id, question);
    const leaks = blind.filter((question) => 'correct_key' in question || 'explanation' in question || 'answer' in question).length;
    if (leaks) fileReport.problems.push(`${leaks} blind questions carry correct_key, explanation or answer`);
  }

  for (const role of ROLES) {
    const file = path.join(verifyDir, `${batch}__${role}.json`);
    const res = tryJson(file);
    const info = { file: rel(file), state: res.state };
    fileReport.roles[role] = info;
    const results = new Map();
    out.roleResults.set(role, { state: res.state, results });
    if (res.state === 'malformed') { info.error = res.error; continue; }
    if (res.state !== 'ok') continue;
    if (!Array.isArray(res.value)) { info.state = 'not_array'; out.roleResults.get(role).state = 'not_array'; continue; }
    info.records = res.value.length;
    const seen = new Set();
    const issues = [];
    for (const result of res.value) {
      const id = result?.id;
      if (seen.has(id)) { issues.push(`duplicate id ${id}`); continue; }
      seen.add(id);
      if (!idSet.has(id)) { issues.push(`id ${id} is not in the batch`); continue; }
      results.set(id, result);
    }
    if (res.value.length !== ids.length) issues.push(`${res.value.length} records for ${ids.length} questions`);
    const missing = ids.filter((id) => !seen.has(id));
    if (missing.length) issues.push(`${missing.length} batch ids have no record`);
    else if (!issues.length && res.value.map((r) => r?.id).join('|') !== ids.join('|')) issues.push('same ids but a different order than the batch (harmless)');
    if (issues.length) info.issues = issues;
  }
  return out;
}

/** The state of one role's record for one question: { state: ok|missing|malformed|not_array|not_in_file|invalid, value?, problems? }. */
function roleRecord(loaded, role, q, lib, card, otherFlags) {
  const slot = loaded.roleResults.get(role);
  if (!slot || slot.state !== 'ok') return { state: slot?.state || 'missing' };
  const raw = slot.results.get(q.id);
  if (!raw) return { state: 'not_in_file' };
  if (SOLVERS.includes(role)) {
    const problems = validSolver(raw, q.id);
    return problems.length ? { state: 'invalid', problems } : { state: 'ok', value: { answer: up(raw.answer), confidence: raw.confidence ?? null } };
  }
  if (QUALITY.includes(role)) {
    const problems = lib.scores.qualityProblems(raw, q.id);
    return problems.length ? { state: 'invalid', problems } : { state: 'ok', value: raw };
  }
  const checked = lib.scores.fitCheck(raw, q.id, card, otherFlags);
  return checked.value ? { state: 'ok', value: checked.value, raw } : { state: 'invalid', problems: checked.problems, rawScore: Number.isInteger(raw.fit_score) ? raw.fit_score : null, rawFlags: Array.isArray(raw.fit_flags) ? raw.fit_flags.map(String) : [] };
}

// ---------------------------------------------------------------------------------------------
// Phase 2: acceptance per question
// ---------------------------------------------------------------------------------------------

const REASON_CATEGORY = [
  [/^incomplete_/, 'verification_incomplete'], [/^structural_/, 'structural'], [/^blind_text_/, 'blind_text'], [/^duplicate_/, 'duplicate'],
  [/^solvers_/, 'solvers'], [/^j\d_quality_/, 'quality_score'], [/^j\d_flags_/, 'quality_flag'], [/^j\d_blind_answer_/, 'judge_blind_answer'],
  [/^fit_median_/, 'fit_median'], [/^fit_flagged_by_two/, 'fit_flags'],
  [/^(no_blind_solver_evidence_on_final_text|repaired_text_without_blind_resolve)/, 'repaired_without_resolve'], [/^resolve_/, 'resolve'], [/^expert_verdict_/, 'expert_verdict'], [/^expert_repair_/, 'expert_verdict'], [/^reworded_/, 'repaired_without_resolve'],
];
export const categoryOf = (reason) => (REASON_CATEGORY.find(([re]) => re.test(reason)) || [null, 'other'])[1];
const CATEGORIES = ['solvers', 'quality_score', 'quality_flag', 'judge_blind_answer', 'fit_median', 'fit_flags', 'verification_incomplete', 'structural', 'blind_text', 'duplicate', 'repaired_without_resolve', 'resolve', 'expert_verdict', 'other'];

const BLIND_FIELDS = BLIND_FIELDS_W2;
function sameBlind(blind, q, fields = BLIND_FIELDS) {
  if (!blind) return ['no_blind_text'];
  const diff = [];
  for (const field of fields) if (JSON.stringify(blind[field] ?? null) !== JSON.stringify(q[field] ?? null)) diff.push(field);
  return diff;
}

/**
 * The fresh pass that speaks for q: all ten records (five solvers, two quality judges, three fit judges) from one batch whose text is q's
 * hashed text (wave 1's rule: a pass on an older wording never speaks for a later one, and the judges of a question are fresh together).
 * { batch, roleResults, blind } or null.
 */
function freshEvidence(q, ctx) {
  for (const scan of ctx.fresh || []) {
    const found = {};
    for (const role of ROLES) {
      const hit = (scan.byRole[role]?.get(q.id) || []).find((entry) => ctx.lib.scores.sameHashedText(scan.texts.get(entry.batch)?.get(q.id), q));
      if (hit) found[role] = hit;
    }
    const have = Object.keys(found);
    if (!have.length) continue;
    const batches = new Set(Object.values(found).map((hit) => hit.batch));
    if (have.length === ROLES.length && batches.size === 1) {
      const batch = [...batches][0];
      const blind = new Map();
      const blindText = scan.texts.get(`${batch}-blind`)?.get(q.id);
      if (blindText) blind.set(q.id, blindText);
      return { batch, roleResults: new Map(ROLES.map((role) => [role, { state: 'ok', results: new Map([[q.id, found[role].result]]) }])), blind };
    }
    ctx.freshPartial.push({ id: q.id, have, batches: [...batches] });
  }
  return null;
}

function evaluateQuestion(q, loaded, lib, ctx) {
  const fresh = freshEvidence(q, ctx);
  // A fresh pass replaces the original records of every role (and the blind text they were solved on) for this question.
  const view = fresh ? { ...loaded, blind: fresh.blind, roleResults: fresh.roleResults } : loaded;
  const roles = Object.fromEntries(ROLES.map((role) => [role, roleRecord(view, role, q, lib, ctx.card, ctx.otherFlags)]));
  const reasons = [];
  const warnings = [];
  // 1. Structure of the question itself.
  const structure = structuralCheck(q, loaded.subject, ctx.facts, lib, ctx.cfg.source);
  for (const problem of structure.problems) reasons.push(`structural_${problem}`);
  warnings.push(...structure.warnings);
  // 2. The expert verdict, where there is one: practice and reject are not published.
  const expert = ctx.expert.get(q.id) || null;
  if (expert && !['ready', 'repaired'].includes(expert.verdict)) reasons.push(`expert_verdict_${expert.verdict}`);
  // Wave 3: a reworded row is judged on its reworded text by its own fresh pass; without all ten records of that pass it is held (the as-authored judges never saw this text).
  if (ctx.cfg.finalInputs && ctx.rewordIds?.has(q.id) && !fresh) reasons.push('reworded_without_complete_fresh_pass');
  // 3. The text the blind solvers saw. After an expert repair it differs by design: the five solvers solved the text before the repair.
  const blindDiff = sameBlind(view.blind.get(q.id), q, ctx.cfg.blindFields);
  let drift = null;
  if (blindDiff.length) {
    if (!fresh && expert?.verdict === 'repaired') drift = blindDiff;
    else reasons.push(`blind_text_differs_${blindDiff.join('+')}`);
  }
  // 4. Missing or malformed records: never invented, never accepted.
  const incomplete = [];
  for (const role of ROLES) {
    const r = roles[role];
    if (r.state !== 'ok') incomplete.push(r.state === 'invalid' ? `incomplete_invalid_${role}(${r.problems.join(',')})` : `incomplete_${r.state}_${role}`);
  }
  reasons.push(...incomplete);

  const answers = SOLVERS.map((role) => (roles[role].state === 'ok' ? roles[role].value.answer : null));
  const matched = answers.filter((answer) => answer === q.correct_key).length;
  const solvers = { n: answers.filter((answer) => answer !== null).length, matched_key: matched, answers };
  const quality = QUALITY.map((role) => (roles[role].state === 'ok' ? { judge: role, score: roles[role].value.quality_score, blind_answer: up(roles[role].value.blind_answer), flags: roles[role].value.flags.map(String), difficulty_check: roles[role].value.difficulty_check } : { judge: role, missing: true }));
  const fitJudges = FIT.map((role) => (roles[role].state === 'ok' ? { judge: role, score: roles[role].value.fit_score, flags: roles[role].value.fit_flags, other_flags: roles[role].value.other_flags || [], cuet_type: roles[role].value.cuet_type, chapter: roles[role].value.chapter, unit: roles[role].value.unit } : { judge: role, missing: true }));
  for (const judge of quality) for (const flag of judge.flags || []) if (!ctx.blockingFlags.has(flag)) warnings.push(`${judge.judge}_flag_outside_rubric_list:${flag}`);
  for (const judge of fitJudges) if (judge.other_flags?.length) warnings.push(`${judge.judge}_fit_flags_outside_rubric_list:${judge.other_flags.join('+')}`);

  // 5. A repair that changed what the blind solvers see needs a blind re-solve of the repaired text (2 of 3 on the key); without one it is held back.
  const asjudged = ctx.asjudged.get(q.id) || null;
  const resolve = drift ? ctx.resolveFor(q) : null;
  if (drift && !resolve) reasons.push(`repaired_text_without_blind_resolve:${drift.join('+')}`);

  let record = null;
  if (!incomplete.length) {
    const preRepair = !fresh && asjudged ? lib.scores.preRepairDiff(asjudged, q) : {};
    const reworded = fresh && asjudged ? Object.keys(lib.scores.preRepairDiff(asjudged, q)) : [];
    const spot = ctx.spot.get(q.id) || null;
    // Wave 3: a repair that moved or reshuffled the options leaves the judges' blind answer on the pre-repair text. Where the judge answered the pre-repair key and the three blind
    // re-solvers (two of three on the key) confirm the repaired key, the judge's answer is carried to the repaired key and the carry is recorded; otherwise the answer stays as given.
    const carried = [];
    const blindAnswerOf = (role, r) => {
      const given = up(r.blind_answer);
      const judgedKey = asjudged?.correct_key;
      if (drift && ctx.cfg.carryBlindAnswers && resolve && resolve.matched_key >= 2 && judgedKey && judgedKey !== q.correct_key && given === judgedKey) {
        carried.push({ judge: role, judged_answer: given, judged_key: judgedKey, repaired_key: q.correct_key });
        return q.correct_key;
      }
      return given;
    };
    record = {
      subject: loaded.subject, batch: loaded.batch, chapter: q.chapter, set_id: q.set_id || null,
      text: {
        expert_verdict: expert?.verdict ?? null, expert_issue: expert?.why || null,
        // earlier_text: the expert reviewed the wording before it was reworded for the engine; only the fresh judges and solvers saw the final text.
        expert_reviewed_text: !expert ? 'not_reviewed' : (fresh && !ctx.cfg.finalInputs ? 'earlier_text' : 'final'),
        judged: fresh ? 'final' : 'as_authored',
        pre_repair: Object.keys(preRepair).length ? preRepair : null,
        ...(reworded.length ? { reworded_after_acceptance: reworded, reworded_engine_reasons: ctx.engineReasons.get(q.id) || null } : {}),
        ...(spot ? { spot_check: spot } : {}),
        ...(expert?.file === ctx.supplementFile ? { supplementary_review: { reviewer: ctx.supplementReviewer, note: 'reviewed after the 24-batch expert pass, from the re-run judge files; one reviewer, key solved independently' } } : {}),
      },
      // on: final = the blind solvers saw the final blind text (a repair of the explanation, label or NCERT reference changes nothing they see).
      blind_solvers: { n: solvers.n, matched_key: matched, answers, on: drift ? 'as_authored' : 'final' },
      blind_resolve_on_final_text: resolve,
      quality: QUALITY.map((role) => {
        const r = roles[role].value;
        return { judge: role, quality_score: r.quality_score, blind_answer: blindAnswerOf(role, r), key_matches: r.key_matches, difficulty_check: r.difficulty_check, objective_tag: r.objective_tag.trim(), flags: r.flags.map(String), note: text(r.note).slice(0, 240), on_final_text: fresh ? true : null, batch: fresh ? fresh.batch : loaded.batch };
      }),
      fit: FIT.map((role) => ({ judge: role, ...roles[role].value, on_final_text: fresh ? true : null, batch: fresh ? fresh.batch : loaded.batch })),
    };
    if (carried.length) record.text.judge_blind_answer_carried_over = carried; // filled while the quality records above were built
    // The wave-1 rule itself (scripts/lib/authored-scores.mjs acceptanceReasons), so wave 2 cannot drift from it.
    reasons.push(...lib.scores.acceptanceReasons(record, q));
    for (const role of QUALITY) if (roles[role].value.key_matches !== (up(roles[role].value.blind_answer) === q.correct_key) && !carried.some((c) => c.judge === role)) warnings.push(`${role}_key_matches_field_disagrees_with_blind_answer`);
  } else {
    // Partial evidence is reported as it stands; the question stays unaccepted (the rule needs all ten records).
    if (solvers.n === 5 && matched < RULE.solversMatchingKeyAtLeast) reasons.push(`solvers_${matched}_of_${solvers.n}`);
    for (const judge of quality) {
      if (judge.missing) continue;
      if (judge.score < RULE.qualityScoreAtLeast) reasons.push(`${judge.judge}_quality_${judge.score}`);
      if (judge.flags.length) reasons.push(`${judge.judge}_flags_${judge.flags.join('+')}`);
      if (judge.blind_answer !== q.correct_key) reasons.push(`${judge.judge}_blind_answer_${judge.blind_answer}`);
    }
  }
  const fitScores = fitJudges.filter((judge) => !judge.missing).map((judge) => judge.score);
  const fitFlaggedBy = fitJudges.filter((judge) => !judge.missing && judge.flags.length).length;
  const invalidFit = Object.fromEntries(FIT.filter((role) => roles[role].state === 'invalid').map((role) => [role, { problems: roles[role].problems, own_score: roles[role].rawScore }]));
  const fit = { ...(Object.keys(invalidFit).length ? { invalid_records: invalidFit } : {}), scores: fitJudges.map((judge) => (judge.missing ? null : judge.score)), median: fitScores.length === 3 ? median3(fitScores) : null, flagged_by: fitFlaggedBy, flags: [...new Set(fitJudges.flatMap((judge) => judge.flags || []))] };
  const accepted = reasons.length === 0;
  const row = {
    id: q.id, subject: loaded.subject, batch: loaded.batch, chapter: q.chapter, type: q.type, difficulty_label: q.difficulty_label, set_id: q.set_id || null,
    accepted, reasons: [...new Set(reasons)],
    ...(expert ? { expert: { verdict: expert.verdict, file: expert.file } } : {}),
    ...(fresh ? { fresh_pass: { batch: fresh.batch } } : {}),
    ...(drift ? { repaired_after_solve: { blind_text_changed: drift, blind_resolve: resolve } } : {}),
    solvers, quality, fit,
    ...(warnings.length ? { warnings } : {}),
  };
  // For a question held back only by missing records: would it pass on what is there? (information for the owner, not an acceptance)
  if (incomplete.length && !reasons.some((reason) => !reason.startsWith('incomplete_'))) {
    // A present but format-invalid fit record counts here by its own score and flags (the builder would still refuse it).
    const presentFit = FIT.map((role) => (roles[role].state === 'ok' ? { score: roles[role].value.fit_score, flags: roles[role].value.fit_flags } : roles[role].state === 'invalid' && roles[role].rawScore !== null ? { score: roles[role].rawScore, flags: roles[role].rawFlags } : null)).filter(Boolean);
    const presentScores = presentFit.map((judge) => judge.score);
    const fitOk = presentScores.length > 0 && Math.min(...presentScores) >= RULE.fitMedianAtLeast && presentFit.filter((judge) => judge.flags.length).length < RULE.fitFlaggedByFewerThan;
    row.provisional = { would_pass_on_available_records: fitOk, note: fitOk ? 'every record that exists (a format-invalid fit record counted by its own score) meets the rule; the missing or invalid record is the only thing that separates the question from acceptance' : 'a present fit score is below the bar or flagged: it would likely still fail', missing: incomplete };
  }
  return { row, record, fresh: Boolean(fresh), drift };
}

// ---------------------------------------------------------------------------------------------
// The extra inputs of the final pass
// ---------------------------------------------------------------------------------------------

/** Expert verdicts of every *.json under dir ({ verdicts: [{ id, verdict, why, repair }] }), by id. A later file name wins; disagreements are listed. */
function loadExpert(dir) {
  const verdicts = new Map();
  const conflicts = [];
  const files = [];
  if (fs.existsSync(dir)) {
    for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.json')).sort(naturalCompare)) {
      const res = tryJson(path.join(dir, name));
      if (res.state !== 'ok' || !Array.isArray(res.value?.verdicts)) { files.push({ file: name, problem: res.state === 'ok' ? 'no verdicts array' : res.state }); continue; }
      files.push({ file: name, verdicts: res.value.verdicts.length });
      for (const v of res.value.verdicts) {
        if (!v?.id || !v?.verdict) continue;
        if (verdicts.has(v.id) && verdicts.get(v.id).verdict !== v.verdict) conflicts.push({ id: v.id, files: [verdicts.get(v.id).file, name], verdicts: [verdicts.get(v.id).verdict, v.verdict] });
        verdicts.set(v.id, { verdict: v.verdict, why: text(v.why), repair: v.repair ?? null, file: name, raw: v });
      }
    }
  }
  return { verdicts, conflicts, files };
}

/** Blind re-solves of repaired text: rv-w2-blind.json (the blind questions the solvers saw) and rv-w2__s1..s3.json ([{ id, answer }]). */
function loadResolve(dir, prefix = 'rv-w2') {
  const out = { blind: new Map(), solvers: [] };
  if (!fs.existsSync(dir)) return out;
  const blind = tryJson(path.join(dir, `${prefix}-blind.json`));
  if (blind.state === 'ok') for (const question of (Array.isArray(blind.value) ? blind.value : blind.value?.questions) || []) out.blind.set(question.id, question);
  for (const role of ['s1', 's2', 's3']) {
    const res = tryJson(path.join(dir, `${prefix}__${role}.json`));
    // A solver whose answer is not A to D gave no answer (wave 2's files hold only valid letters, so its output does not change).
    if (res.state === 'ok' && Array.isArray(res.value)) out.solvers.push(new Map(res.value.filter((r) => r?.id && OPTION_KEYS.includes(up(r.answer))).map((r) => [r.id, up(r.answer)])));
  }
  return out;
}

/** The spot-check table of the markdown report: { id -> { verdict, expert, answer_matched_key } }. */
function loadSpotCheck(file) {
  const map = new Map();
  if (!fs.existsSync(file)) return map;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const cells = line.split('|').map((cell) => cell.trim());
    const id = cells.find((cell) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(cell));
    if (!id) continue;
    const at = cells.indexOf(id);
    const answerKey = (cells[at + 2] || '').split('/').map((part) => part.trim());
    map.set(id, { reviewer: 'independent spot-check, 14 Oct 2026 (60 of the 390 first-accepted items)', verdict: (cells[at + 4] || '').replace(/\*/g, ''), expert_verdict_then: cells[at + 3] || null, answer_matched_key: answerKey.length === 2 && answerKey[0] === answerKey[1] });
  }
  return map;
}

function loadDecisions(file) {
  const res = tryJson(file);
  const map = new Map();
  if (res.state !== 'ok') return { map, state: res.state };
  for (const d of res.value?.decisions || []) map.set(d.id, d);
  return { map, state: 'ok' };
}

function loadEngineReasons(file) {
  const res = tryJson(file);
  return new Map((res.state === 'ok' ? res.value?.refused || [] : []).map((entry) => [entry.id, entry.reasons]));
}

/** Everything the final pass reads besides the raw batch files, with the rule for the final text of a reworded question. */
async function loadExtras(args, lib) {
  const abs = (value) => (value ? path.resolve(value) : ''); // wave 3 has no expert, fresh, resolve, decision or spot-check inputs: null reads as empty
  const expert = loadExpert(abs(args.expert));
  const asjudgedList = tryJson(abs(args.asjudged)).value || [];
  const fresh = lib.scores.scanFresh(args.fresh.map((dir) => path.resolve(dir)).filter((dir) => fs.existsSync(dir)));
  const cfgOf = args.cfg || WAVE_CONFIGS.w2;
  const resolve = loadResolve(abs(args.resolve), cfgOf.resolvePrefix);
  const rewordText = new Map();
  for (const scan of fresh) for (const [batch, questions] of scan.texts) if (!batch.endsWith('-blind')) for (const [id, question] of questions) rewordText.set(id, question);
  const decisions = loadDecisions(abs(args.decisions));
  const supplementFile = 'supplement-2026-10-14.json';
  const ctx = {
    lib, expert: expert.verdicts, fresh, freshPartial: [], rewordIds: new Set(rewordText.keys()), asjudged: new Map(asjudgedList.map((c) => [c.id, c])),
    // The ids the first acceptance took (the as-judged file also holds the pre-repair text of questions reviewed later, flagged _added_after_first_pass).
    firstPass: new Set(asjudgedList.filter((c) => !c._added_after_first_pass).map((c) => c.id)), engineReasons: loadEngineReasons(abs(args.engineReasons)),
    spot: loadSpotCheck(abs(args.spotcheck)), supplementFile, supplementReviewer: 'Claude Sonnet 5.5 (this session)',
    resolveFor: (q) => {
      const blind = resolve.blind.get(q.id);
      if (!blind || sameBlind(blind, q, cfgOf.blindFields).length) return null;
      const given = resolve.solvers.map((solver) => solver.get(q.id)).filter(Boolean);
      return given.length === 3 ? { n: 3, matched_key: given.filter((a) => a === q.correct_key).length, answers: given } : null;
    },
  };
  // The final text of a reworded question is the text its fresh pass judged (a later pass of the expert had set one of the ten back: see the report).
  // Wave 3 (final mode): the expert verdict's repair is applied to the batch text first (scripts/lib/authored-w3-repair.mjs); the batch files stay as they were.
  const finalText = (raw) => {
    const repair = cfgOf.finalInputs && expert.verdicts.size ? applyExpertRepair(raw, expert.verdicts.get(raw.id)?.raw) : null;
    const base = repair ? repair.q : raw;
    const fresh_ = rewordText.get(raw.id);
    if (!fresh_) return { q: base, overridden: [], repair };
    const fields = ['unit', 'stem', 'options', 'correct_key', 'explanation', 'difficulty_label', 'ncert_ref'];
    const next = { ...base };
    const overridden = [];
    for (const field of fields) if (field in fresh_ && JSON.stringify(fresh_[field] ?? null) !== JSON.stringify(base[field] ?? null)) { next[field] = fresh_[field]; overridden.push(field); }
    return { q: next, overridden, repair };
  };
  return { ctx, expert, decisions, finalText, rewordIds: new Set(rewordText.keys()), resolve, asjudgedList };
}

// ---------------------------------------------------------------------------------------------
// accept
// ---------------------------------------------------------------------------------------------

function liveStemIndex(fixturesDir, subjects) {
  const index = new Map();
  const names = { general_test: 'gat' };
  for (const subject of subjects) {
    const res = tryJson(path.join(fixturesDir, `${names[subject] || subject}.json`));
    if (res.state !== 'ok' || !Array.isArray(res.value)) continue;
    for (const row of res.value) {
      if (row.status !== 'live' || row.is_deleted) continue;
      const key = `${subject}|${normStem(row.body || row.question)}`;
      if (!index.has(key)) index.set(key, row.id);
    }
  }
  return index;
}

const grams = (stem) => { const t = ` ${normStem(stem)} `; const set = new Set(); for (let i = 0; i + 3 <= t.length; i += 1) set.add(t.slice(i, i + 3)); return set; };
const dice = (a, b) => { let shared = 0; for (const g of a) if (b.has(g)) shared += 1; return (2 * shared) / ((a.size + b.size) || 1); };
const alnum = (value) => text(value).toLowerCase().replace(/[^a-z0-9\u0080-\uffff]+/g, '');
const optionSet = (c) => new Set((c.options || []).map((option) => alnum(option?.text)).filter((value) => value.length >= 2));
const sharedOptions = (a, b) => { let n = 0; for (const value of a) if (b.has(value)) n += 1; return n; };
const answerText = (c) => alnum((c.options || []).find((option) => option.key === c.correct_key)?.text);
// Equal after stripping punctuation, or one is the other plus a unit word ("8" and "8 days").
const answersEquivalent = (a, b) => Boolean(a) && Boolean(b) && (a === b || (Math.min(a.length, b.length) >= 1 && (a.startsWith(b) || b.startsWith(a)) && /^[0-9]/.test(a) && /^[0-9]/.test(b)));

function liveRows(fixturesDir, subjects) {
  const names = { general_test: 'gat' };
  const out = [];
  for (const subject of subjects) {
    const res = tryJson(path.join(fixturesDir, `${names[subject] || subject}.json`));
    if (res.state !== 'ok' || !Array.isArray(res.value)) continue;
    for (const row of res.value) {
      if (row.status !== 'live' || row.is_deleted) continue;
      const option = (Array.isArray(row.options) ? row.options : []).find((o) => o?.key === row.correct_answer);
      out.push({ id: row.id, subject, stem: row.body || row.question || '', answer: option ? alnum(text(option.text).replace(new RegExp(`^${row.correct_answer}\\s+`), '')) : '' });
    }
  }
  return out;
}

/** The assembled candidates file the wave-3 batch text was cut from (ids, text without the _ marks, _verdict), plus the manifest's expected batches. */
function loadSourceCandidates(args) {
  if (!args.candidates) return null;
  const res = tryJson(path.resolve(args.candidates));
  if (res.state !== 'ok' || !Array.isArray(res.value)) throw new Error(`--candidates ${args.candidates}: ${res.state}`);
  const textOnly = (c) => Object.fromEntries(Object.entries(c).filter(([key]) => !key.startsWith('_')));
  // marks: the other _ fields of the candidate (wave 3: _reworded on the rows the audit repaired), carried into the scored candidate as they are.
  const marksOf = (c) => Object.fromEntries(Object.entries(c).filter(([key]) => key.startsWith('_') && key !== '_verdict'));
  const byId = new Map(res.value.map((c) => [c.id, { text: textOnly(c), verdict: c._verdict ?? null, marks: marksOf(c) }]));
  const manifest = args.manifest ? tryJson(path.resolve(args.manifest)) : null;
  return { file: rel(path.resolve(args.candidates)), sha256: sha256Text(path.resolve(args.candidates)), byId, manifest: manifest?.state === 'ok' ? manifest.value : null, manifestState: manifest?.state ?? null };
}

/**
 * Wave 3: what the batch files on disk say against the assembled candidates file and the layout manifest. Reported in the acceptance file (files.sourceCandidates).
 * A batch whose file hash differs from the manifest is listed as a problem (the per-question text comparison is what rejects a question).
 */
function sourceCheck(src, batches, files, args, rows) {
  const out = { candidatesFile: src.file, candidatesSha256: src.sha256, candidatesInFile: src.byId.size, manifestState: src.manifestState, problems: [] };
  const manifest = src.manifest;
  if (manifest) {
    if (manifest.candidatesSha256 !== src.sha256) out.problems.push(`candidates file sha256 differs from the manifest (${src.sha256} against ${manifest.candidatesSha256})`);
    const byName = new Map(batches.map((spec) => [spec.batch, spec]));
    for (const entry of manifest.batches || []) {
      const spec = byName.get(entry.batch);
      if (!spec) { out.problems.push(`manifest batch ${entry.batch} has no batch file in ${args.raw}`); continue; }
      const check = { text: path.join(spec.dir, `${entry.batch}.json`), blind: path.join(spec.dir, `${entry.batch}-blind.json`), aids: path.join(spec.dir, `${entry.batch}-fitaids.json`) };
      for (const [kind, file] of Object.entries(check)) {
        if (!fs.existsSync(file)) { out.problems.push(`${rel(file)} is missing`); continue; }
        if (![sha256(fs.readFileSync(file)), sha256Text(file)].includes(entry.sha256?.[kind])) out.problems.push(`${rel(file)} differs from the manifest's sha256`);
      }
      const onDisk = tryJson(check.text).value?.questions?.map((q) => q.id) || [];
      if (onDisk.join('|') !== (entry.ids || []).join('|')) out.problems.push(`${entry.batch}: the ids in the batch file are not the manifest's ids in the manifest's order`);
    }
    for (const spec of batches) if (!(manifest.batches || []).some((entry) => entry.batch === spec.batch)) out.problems.push(`batch file ${spec.batch} is not in the manifest`);
  } else out.problems.push(`manifest ${args.manifest}: ${src.manifestState}`);
  const scored = new Set(rows.map((row) => row.id));
  const missing = [...src.byId].filter(([id]) => !scored.has(id)).map(([id, v]) => ({ id, subject: v.text.subject }));
  out.candidatesNotLaidOut = missing.reduce((by, item) => { by[item.subject] = (by[item.subject] || 0) + 1; return by; }, {});
  out.excludedSubjects = manifest?.excludedSubjects || null;
  return out;
}

/** Stable, key-order independent text of a value (the batch text is compared with the candidates file by content, not by byte layout). */
const canonical = (value) => JSON.stringify(value, (key, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v));

export async function runAccept(args, { write = true } = {}) {
  const cfg = args.cfg || WAVE_CONFIGS.w2;
  const lib = await loadLib(args.root);
  const extras = await loadExtras(args, lib);
  extras.ctx.cfg = cfg;
  const sourceCandidates = loadSourceCandidates(args);
  const overriddenText = [];
  const rawDir = path.resolve(args.raw);
  const { batches, unexpected } = discover(rawDir, cfg);
  // Already-published or earlier candidates the duplicate screen compares against: wave 1 (both files) and, per wave config, later waves (wave 3 also checks wave 2's final candidates).
  const priorSources = [...[args.wave1Final, args.wave1Original].filter((file) => fs.existsSync(file)).map((file) => ({ from: 'wave1', file })),
    ...cfg.priorFiles.filter((entry) => fs.existsSync(entry.file))];
  const wave1 = priorSources.flatMap(({ from, file }) => (tryJson(file).value || []).map((c) => ({ ...c, _from: from })));
  const wave1Ids = new Map(wave1.map((c) => [c.id, c._from]));
  const wave1Stems = new Map(wave1.map((c) => [stemKey(c), { id: c.id, from: c._from }]));
  // A wave-2 question whose set is a wave-1 set completes that set (the group is already in the bank).
  const wave1Sets = new Map();
  for (const c of tryJson(path.resolve(args.wave1Final)).value || []) {
    if (!c.set_id) continue;
    const known = wave1Sets.get(c.set_id) || { n: 0, passage: c.passage_text, chapter: c.chapter };
    known.n += 1;
    wave1Sets.set(c.set_id, known);
  }

  // Wave 3 final: what the judges saw is the as-authored text; a reworded row was judged on the expert-repaired text by its fresh pass.
  if (cfg.finalInputs && sourceCandidates && extras.expert.verdicts.size) {
    for (const [id, v] of sourceCandidates.byId) extras.ctx.asjudged.set(id, extras.rewordIds.has(id) ? applyExpertRepair(v.text, extras.expert.verdicts.get(id)?.raw).q : v.text);
  }
  const subjects = [...new Set(batches.map((b) => b.subject))];
  const live = liveStemIndex(args.fixtures, subjects);
  const otherFlags = {};
  const blockingFlags = new Set(lib.agent.NTA_AGENT_BLOCKING_FLAGS);
  const cards = new Map();
  const facts = new Map();
  const files = [];
  const rows = [];
  const records = new Map();
  const candidates = [];
  const pool = [];

  for (const spec of batches) {
    const loaded = loadBatch(spec, lib);
    files.push(loaded.fileReport);
    if (!facts.has(spec.subject)) { facts.set(spec.subject, blueprintFacts(lib, spec.subject)); cards.set(spec.subject, facts.get(spec.subject) ? lib.scores.allowedCard(spec.subject) : null); }
    const ctx = { card: cards.get(spec.subject), facts: facts.get(spec.subject), otherFlags, blockingFlags, ...extras.ctx };
    for (const raw of loaded.questions) {
      const { q, overridden, repair } = extras.finalText(raw);
      if (overridden.length) overriddenText.push({ id: q.id, batch: loaded.batch, fields_set_to_the_fresh_pass_text: overridden });
      const { row, record } = evaluateQuestion(q, loaded, lib, ctx);
      if (overridden.length) (row.warnings ||= []).push(`batch_file_text_differs_from_the_fresh_pass_text:${overridden.join('+')}`);
      // Wave 3 final: a repair that cannot be applied cleanly holds the row; a fresh pass on text other than the expert's repaired text does not speak for the expert's review.
      if (repair?.problems.length) row.reasons.push(`expert_repair_${repair.problems.join('; ')}`);
      if (cfg.finalInputs && overridden.length) row.reasons.push(`reworded_text_is_not_the_expert_repaired_text:${overridden.join('+')}`);
      if (repair?.changed.length) { row.expert_repaired_fields = repair.changed; if (record) record.text.expert_repaired_fields = repair.changed; }
      if (sourceCandidates) {
        // The batch text the judges were given must be the assembled candidate's text (the _ marks are not in it), and the candidate carries its authoring verdict.
        const source = sourceCandidates.byId.get(q.id);
        if (!source) row.reasons.push('structural_id_not_in_source_candidates');
        else {
          if (canonical(Object.fromEntries(Object.entries(raw).filter(([key]) => !key.startsWith('_')))) !== canonical(source.text)) row.reasons.push('structural_text_differs_from_source_candidates');
          if (record) { record.text.authoring_verdict = source.verdict; if (source.marks._reworded) record.text.audit_repaired = true; }
        }
      }
      const setOfWave1 = q.set_id ? wave1Sets.get(q.set_id) : null;
      if (setOfWave1 && (setOfWave1.passage !== q.passage_text || setOfWave1.chapter !== q.chapter)) row.reasons.push('structural_set_of_wave1_but_passage_or_chapter_differs');
      const liveId = live.get(`${q.subject}|${normStem(q.stem)}`);
      if (liveId) (row.warnings ||= []).push(`stem_equals_live_question_in_13_oct_export:${liveId}`);
      pool.push({ q, row, record });
    }
  }

  // Duplicates, second pass. A question is a duplicate only of a copy that is itself accepted on its merits (or already in wave 1):
  // if the earlier copy failed the rule and the later one passed, the later one stands. The first accepted copy is kept.
  //  - exact: the same id, or the same subject, stem and passage start (wave 1's validateCandidates key);
  //  - probable: same subject and passage, the same correct answer text and stems whose character trigrams overlap at least 78 percent (Dice):
  //    the same question reworded, options shuffled. Different numbers or different words in the stem fall below that. The screen is
  //    conservative (it misses typographic rewrites such as 'int_0^1' against a unicode integral); a weaker match is only a warning
  //    (possible_duplicate_of: two single-answer items, same answer text, stems at 50 percent, at least three identical option texts).
  // Against the 13 Oct export of the live bank only a warning is given.
  const claimedIds = new Map();
  const claimedStems = new Map();
  const claimed = []; // { id, subject, gram, passage, answer, from }
  for (const c of wave1) claimed.push({ id: c.id, subject: c.subject, gram: grams(c.stem), passage: text(c.passage_text).slice(0, 80), answer: answerText(c), optionSet: optionSet(c), single: c.type === 'single_mcq', from: c._from });
  const fromPrefix = (from) => (from === cfg.label ? '' : `${from}_`); // an earlier wave's twin is named with its wave, this wave's own twin is not
  const liveClaims = liveRows(args.fixtures, subjects).map((r) => ({ id: r.id, subject: r.subject, gram: grams(r.stem), answer: r.answer }));
  for (const { q, row, record } of pool) {
    const key = stemKey(q);
    row.passed_rule_before_duplicate_screen = row.reasons.length === 0;
    if (wave1Ids.has(q.id)) { row.reasons.push(`duplicate_id_in_${wave1Ids.get(q.id)}`); }
    if (wave1Stems.has(key)) { row.reasons.push(`duplicate_stem_of_${wave1Stems.get(key).from}_${wave1Stems.get(key).id}`); }
    if (claimedIds.has(q.id)) row.reasons.push(`duplicate_id_of_${claimedIds.get(q.id)}`);
    if (claimedStems.has(key)) row.reasons.push(`duplicate_stem_of_${claimedStems.get(key)}`);
    const mine = { gram: grams(q.stem), passage: text(q.passage_text).slice(0, 80), answer: answerText(q), optionSet: optionSet(q), single: q.type === 'single_mcq' };
    if (row.passed_rule_before_duplicate_screen && !row.reasons.length) {
      const twin = claimed.find((other) => other.subject === q.subject && other.passage === mine.passage && answersEquivalent(other.answer, mine.answer)
        && dice(other.gram, mine.gram) >= 0.78);
      if (twin) { row.reasons.push(`duplicate_probable_of_${fromPrefix(twin.from)}${twin.id}`); row.near_duplicate = { of: twin.id, from: twin.from, dice: Math.round(dice(twin.gram, mine.gram) * 1000) / 1000, shared_option_texts: sharedOptions(twin.optionSet, mine.optionSet) }; }
    }
    if (row.passed_rule_before_duplicate_screen && !row.reasons.length) {
      const weak = claimed.find((other) => other.subject === q.subject && other.passage === mine.passage && other.single && mine.single && answersEquivalent(other.answer, mine.answer) && dice(other.gram, mine.gram) >= 0.5 && sharedOptions(other.optionSet, mine.optionSet) >= 3);
      if (weak) (row.warnings ||= []).push(`possible_duplicate_of:${fromPrefix(weak.from)}${weak.id}:dice_${Math.round(dice(weak.gram, mine.gram) * 100) / 100}`);
    }
    row.reasons = [...new Set(row.reasons)];
    row.accepted = row.reasons.length === 0;
    if (row.accepted) {
      claimedIds.set(q.id, q.id); claimedStems.set(key, q.id);
      claimed.push({ id: q.id, subject: q.subject, gram: mine.gram, passage: mine.passage, answer: mine.answer, optionSet: mine.optionSet, single: mine.single, from: cfg.label });
      const close = liveClaims.find((other) => other.subject === q.subject && dice(other.gram, mine.gram) >= 0.95 && (!other.answer || answersEquivalent(other.answer, mine.answer)));
      if (close) (row.warnings ||= []).push(`stem_close_to_live_question_in_13_oct_export:${close.id}`);
    }
    rows.push(row);
    if (row.accepted) {
      records.set(q.id, record);
      const completes = q.set_id ? wave1Sets.get(q.set_id) : null;
      candidates.push({
        id: q.id, subject: q.subject, unit: q.unit ?? null, chapter: q.chapter, type: q.type, stem: q.stem, options: q.options, correct_key: q.correct_key, explanation: q.explanation,
        passage_text: q.passage_text ?? null, set_id: q.set_id ?? null, difficulty_label: q.difficulty_label, ncert_ref: q.ncert_ref ?? null, source: q.source, _verdict: cfg.id !== 'w2' ? (sourceCandidates?.byId.get(q.id)?.verdict ?? null) : (extras.ctx.expert.get(q.id)?.verdict ?? sourceCandidates?.byId.get(q.id)?.verdict ?? null),
        ...(cfg.finalInputs && extras.ctx.expert.get(q.id) ? { _expert: extras.ctx.expert.get(q.id).verdict } : {}),
        ...(row.fresh_pass ? { _reworded: true } : {}),
        ...(sourceCandidates?.byId.get(q.id)?.marks || {}),
        ...(completes ? { _extends_set: { source: 'claude-authored-2026-10-14', existing_children: completes.n } } : {}),
      });
    }
  }

  // Per subject table.
  const bySubject = {};
  const order = [];
  for (const row of rows) {
    if (!bySubject[row.subject]) { bySubject[row.subject] = { written: 0, acceptedByJudgesAndSolvers: 0, accepted: 0, rejected: 0, batches: {}, byChapter: {}, byType: {}, rejectedByReason: Object.fromEntries(CATEGORIES.map((c) => [c, 0])), rejectedOnlyBy: Object.fromEntries(CATEGORIES.map((c) => [c, 0])), keyDistributionAccepted: { A: 0, B: 0, C: 0, D: 0 } }; order.push(row.subject); }
    const s = bySubject[row.subject];
    s.written += 1;
    if (row.passed_rule_before_duplicate_screen) s.acceptedByJudgesAndSolvers += 1;
    (s.batches[row.batch] ||= { written: 0, accepted: 0 }).written += 1;
    (s.byChapter[row.chapter] ||= { written: 0, accepted: 0 }).written += 1;
    (s.byType[row.type] ||= { written: 0, accepted: 0 }).written += 1;
    if (row.accepted) { s.accepted += 1; s.batches[row.batch].accepted += 1; s.byChapter[row.chapter].accepted += 1; s.byType[row.type].accepted += 1; }
    else {
      s.rejected += 1;
      const categories = [...new Set(row.reasons.map(categoryOf))];
      for (const category of categories) s.rejectedByReason[category] += 1;
      if (categories.length === 1) s.rejectedOnlyBy[categories[0]] += 1;
    }
  }
  for (const c of candidates) bySubject[c.subject].keyDistributionAccepted[c.correct_key] += 1;
  const total = { written: rows.length, acceptedByJudgesAndSolvers: rows.filter((row) => row.passed_rule_before_duplicate_screen).length, accepted: candidates.length, rejected: rows.length - candidates.length, rejectedByReason: Object.fromEntries(CATEGORIES.map((c) => [c, order.reduce((n, subject) => n + bySubject[subject].rejectedByReason[c], 0)])) };

  // Passage / case sets: a set the engine serves needs the blueprint's minimum number of eligible children.
  const setChildren = {};
  for (const row of rows) if (row.set_id) (setChildren[row.set_id] ||= { subject: row.subject, written: 0, accepted: 0 }), (setChildren[row.set_id].written += 1), (setChildren[row.set_id].accepted += row.accepted ? 1 : 0);

  const filesSummary = {
    batches: files.length,
    expectedResultFiles: files.length * ROLES.length,
    presentResultFiles: files.reduce((n, f) => n + Object.values(f.roles).filter((r) => r.state !== 'missing').length, 0),
    missing: files.flatMap((f) => Object.entries(f.roles).filter(([, r]) => r.state === 'missing').map(([role, r]) => ({ batch: f.batch, role, file: r.file }))),
    malformed: files.flatMap((f) => Object.entries(f.roles).filter(([, r]) => ['malformed', 'not_array'].includes(r.state)).map(([role, r]) => ({ batch: f.batch, role, file: r.file, state: r.state, error: r.error || null }))),
    recordIssues: files.flatMap((f) => Object.entries(f.roles).filter(([, r]) => r.issues?.length).map(([role, r]) => ({ batch: f.batch, role, file: r.file, issues: r.issues }))),
    batchLevelProblems: files.filter((f) => f.problems.length).map((f) => ({ batch: f.batch, problems: f.problems })),
    unexpectedFiles: unexpected,
    fitFlagsOutsideRubricList: otherFlags,
    ...(sourceCandidates ? { sourceCandidates: sourceCheck(sourceCandidates, batches, files, args, rows) } : {}),
  };
  const now = args.now || new Date().toISOString();
  const acceptance = {
    kind: `${cfg.kind}_acceptance`, source: cfg.source, date: args.date, built_at: now, models: cfg.models,
    note: cfg.acceptNote,
    rule: RULE,
    raw: rel(rawDir),
    ...(cfg.id === 'w2' ? {} : { wave: cfg.wave }),
    total, bySubject, files: filesSummary, sets: setChildren,
    questions: rows,
  };
  if (cfg.id === 'w4') acceptance.qualityMeanDistribution = qualityMeanDistribution(rows);
  if (cfg.id === 'w2') acceptance.final_pass_inputs = {
    expert_files: extras.expert.files, expert_conflicts: extras.expert.conflicts, asjudged: rel(path.resolve(args.asjudged)), fresh: args.fresh,
    fresh_pass_ids: extras.rewordIds.size, fresh_pass_partial: extras.ctx.freshPartial, text_set_to_the_fresh_pass: overriddenText,
    blind_resolve_files_present: extras.resolve.solvers.length, spot_check_rows: extras.ctx.spot.size, decisions: extras.decisions.state,
  };
  const outDir = path.resolve(args.out);
  const names = FILES(args.date, cfg);
  const candidatesFile = path.join(outDir, names.candidates);
  const built = { acceptance, candidates, records, rows, extras, lib, wave1, names, outDir, files, now, cfg };
  if (!write) return built;
  writeAcceptanceFiles(built, args);
  return { acceptance, out: { dir: rel(outDir), ...names } };
}

/**
 * The mean of the two quality judges per question (j1 and j2 scores), by subject: how many questions sit at each mean, how many are at 8 or more,
 * for every written question that has both scores and for the accepted ones. A question missing a judge's score is counted under "no_two_scores".
 */
function qualityMeanDistribution(rows) {
  const out = {};
  for (const row of rows) {
    const subject = (out[row.subject] ||= { written: 0, noTwoScores: 0, byMeanAll: {}, byMeanAccepted: {}, atLeast8All: 0, atLeast8Accepted: 0, accepted: 0, below8Accepted: 0 });
    subject.written += 1;
    const scores = row.quality.map((judge) => judge.score);
    if (scores.length !== 2 || scores.some((score) => !Number.isInteger(score))) { subject.noTwoScores += 1; continue; }
    const mean = (scores[0] + scores[1]) / 2;
    subject.byMeanAll[mean] = (subject.byMeanAll[mean] || 0) + 1;
    if (mean >= 8) subject.atLeast8All += 1;
    if (row.accepted) {
      subject.accepted += 1;
      subject.byMeanAccepted[mean] = (subject.byMeanAccepted[mean] || 0) + 1;
      if (mean >= 8) subject.atLeast8Accepted += 1; else subject.below8Accepted += 1;
    }
  }
  const sorted = (map) => Object.fromEntries(Object.entries(map).sort((a, b) => Number(a[0]) - Number(b[0])));
  for (const subject of Object.values(out)) { subject.byMeanAll = sorted(subject.byMeanAll); subject.byMeanAccepted = sorted(subject.byMeanAccepted); }
  const total = { written: 0, accepted: 0, atLeast8All: 0, atLeast8Accepted: 0, below8Accepted: 0 };
  for (const subject of Object.values(out)) for (const key of Object.keys(total)) total[key] += subject[key];
  return { note: 'mean of the two quality judges (j1, j2); the acceptance rule needs each judge at 7 or more, the publication rule of 17 Oct 2026 (wave 3) needs the mean at 8 or more', total, bySubject: out };
}

/** The acceptance file, the candidates the rule accepted and their entries (the pair is consistent: the entries name the candidates by sha256). */
function writeAcceptanceFiles(built, args) {
  const { acceptance, candidates, records, lib, names, outDir, now } = built;
  const cfg = built.cfg || WAVE_CONFIGS.w2;
  fs.mkdirSync(outDir, { recursive: true });
  const candidatesFile = path.join(outDir, names.candidates);
  fs.writeFileSync(path.join(outDir, names.acceptance), stableJson(acceptance, 1));
  fs.writeFileSync(candidatesFile, stableJson(candidates, 2));
  const entries = {
    kind: 'authored_score_entries', version: lib.scores.SCORES_VERSION, source: cfg.source, wave: cfg.wave, built_at: now, date: args.date, models: cfg.models,
    models_note: `The raw judge files do not record the model; ${cfg.modelNote}.`,
    note: cfg.entriesNote,
    candidates_file: rel(candidatesFile), candidates_sha256: sha256Text(candidatesFile),
    counts: { candidates: candidates.length, entries: records.size },
    entries: Object.fromEntries([...records.entries()]),
  };
  fs.writeFileSync(path.join(outDir, names.entries), stableJson(entries, 1));
}

// ---------------------------------------------------------------------------------------------
// final
// ---------------------------------------------------------------------------------------------

const PUBLISHABLE = ['ready', 'repaired'];
const DROP_CATEGORY_OF = [
  [/^repaired_without_resolve$/, 'held_repaired_text_needs_blind_resolve'], [/^resolve$/, 'blind_resolve_failed'], [/^expert_verdict$/, 'expert_verdict_not_publishable'], [/^duplicate$/, 'duplicate'],
];

/**
 * final: acceptance with the expert verdicts, the fresh pass and the hand decisions applied. Writes the acceptance files, the final candidates,
 * the final entries and the ledger of every drop. A question is published only if it passes the rule, has an expert verdict of ready or repaired,
 * is not a hand decision, and (if a repair changed what solvers see) has its blind re-solve.
 */
export async function runFinal(args) {
  if ((args.cfg || WAVE_CONFIGS.w2).finalInputs) return runFinalW3(args);
  if (!(args.cfg || WAVE_CONFIGS.w2).finalMode) throw new Error('--mode=final is a wave-2 mode (expert pass, fresh pass, hand decisions); wave 3 has none');
  const built = await runAccept(args, { write: false });
  const { acceptance, candidates, records, rows, extras, lib, names, outDir, now } = built;
  const decisions = extras.decisions.map;
  const asjudged = extras.ctx.asjudged;
  const firstPass = extras.ctx.firstPass;
  const candidateById = new Map(candidates.map((c) => [c.id, c]));
  const final = [];
  const dropped = [];
  const rowOf = new Map(rows.map((row) => [row.id, row]));
  const record = (id, category, reason, extra = {}) => {
    const row = rowOf.get(id);
    dropped.push({ id, subject: row?.subject ?? null, batch: row?.batch ?? null, chapter: row?.chapter ?? null, type: row?.type ?? null, set_id: row?.set_id ?? null, first_acceptance: firstPass.has(id) ? 'accepted_in_the_first_pass' : 'not_in_the_first_pass', category, reason, ...extra });
  };
  const unknownDecisions = [...decisions.keys()].filter((id) => !rowOf.has(id));
  for (const row of rows) {
    const candidate = candidateById.get(row.id);
    const decision = decisions.get(row.id);
    if (decision) { record(row.id, decision.category, decision.reason, { decided_by: decision.who || null }); continue; }
    if (!candidate) {
      // Not accepted in this run. It is a drop (and is listed) when it was accepted the first time or has an expert verdict; otherwise it is simply not accepted (see the acceptance file).
      const categories = [...new Set(row.reasons.map(categoryOf))];
      if (firstPass.has(row.id) || row.expert) {
        const category = DROP_CATEGORY_OF.find(([re]) => categories.some((c) => re.test(c)))?.[1] || 'no_longer_accepted';
        const verdict = extras.ctx.expert.get(row.id);
        const reason = row.expert && !PUBLISHABLE.includes(row.expert.verdict) ? `expert verdict ${row.expert.verdict}: ${verdict?.why || ''}` : row.reasons.join('; ');
        record(row.id, category, reason, row.repaired_after_solve ? { repaired_after_solve: row.repaired_after_solve } : {});
      }
      continue;
    }
    if (!PUBLISHABLE.includes(candidate._verdict)) { record(row.id, 'no_expert_verdict', 'accepted by the rule but no expert verdict of ready or repaired exists for it'); continue; }
    final.push(candidate);
  }
  // A set that lost children: fewer than two left is not a set (the wave-1 validator refuses it), so the rest are dropped with it.
  for (let changed = true; changed;) {
    changed = false;
    const bySet = new Map();
    for (const c of final) if (c.set_id && !c._extends_set) bySet.set(c.set_id, [...(bySet.get(c.set_id) || []), c]);
    for (const [setId, children] of bySet) {
      if (children.length >= 2) continue;
      for (const child of children) { final.splice(final.indexOf(child), 1); record(child.id, 'set_left_with_fewer_than_2_children', `the passage set ${setId} has ${children.length} question left after the drops`); }
      changed = true;
    }
  }
  const plan = lib.wave.planPublication(final);
  const problems = [...plan.problems, ...unknownDecisions.map((id) => ({ id, problem: 'decision_for_an_id_that_is_not_in_the_raw_files' }))];
  const finalIds = new Set(final.map((c) => c.id));
  const finalRecords = Object.fromEntries(final.map((c) => [c.id, records.get(c.id)]));
  const count = (list, key) => list.reduce((by, item) => { const k = key(item); by[k] = (by[k] || 0) + 1; return by; }, {});
  const bySubject = Object.fromEntries(Object.keys(count(rows, (row) => row.subject)).sort().map((subject) => [subject, {
    written: rows.filter((r) => r.subject === subject).length,
    accepted_by_the_rule: candidates.filter((c) => c.subject === subject).length,
    first_pass_accepted: [...asjudged.values()].filter((c) => c.subject === subject && !c._added_after_first_pass).length,
    final: final.filter((c) => c.subject === subject).length,
    dropped: dropped.filter((d) => d.subject === subject).length,
  }]));
  acceptance.final = {
    note: 'The final publication set: accepted by the rule, expert verdict ready or repaired, no hand decision, repair evidence in place.',
    final: final.length, dropped: dropped.length, droppedByCategory: count(dropped, (d) => d.category), bySubject,
    byVerdict: count(final, (c) => c._verdict), reworded: final.filter((c) => c._reworded).length,
    spotChecked: final.filter((c) => records.get(c.id)?.text.spot_check).length, supplementaryReview: final.filter((c) => records.get(c.id)?.text.supplementary_review).length,
    problems,
  };
  for (const row of acceptance.questions) row.final = finalIds.has(row.id) ? 'published' : (dropped.find((d) => d.id === row.id)?.category || 'not_accepted');
  const finalFile = path.join(outDir, names.candidatesFinal);
  writeAcceptanceFiles(built, args);
  fs.writeFileSync(finalFile, stableJson(final, 2));
  fs.writeFileSync(path.join(outDir, names.dropped), stableJson(dropped, 2));
  const entries = {
    kind: 'authored_score_entries', version: lib.scores.SCORES_VERSION, source: W2_SOURCE, wave: 2, built_at: now, date: args.date, models: MODELS,
    models_note: 'The raw judge files do not record the model; claude-haiku-5-5 for every solver and judge was stated by the orchestrator (14 Oct 2026).',
    note: 'One record per final wave-2 question, in the wave-1 entries format, built by scripts/authored-w2-accept.mjs --mode=final from the raw files (untracked scratch under tmp/authored-w2), the expert verdicts, the fresh pass on the reworded questions and the first-pass candidates. Tables are built from it by scripts/authored-scores-merge.mjs.',
    candidates_file: rel(finalFile), candidates_sha256: sha256Text(finalFile),
    fresh_passes: args.fresh,
    counts: {
      candidates: final.length, entries: Object.keys(finalRecords).length, problems: problems.length,
      repaired: final.filter((c) => c._verdict === 'repaired').length,
      judgedTextDiffers: Object.values(finalRecords).filter((r) => r.text.pre_repair).length,
      judgedOnFinalTextByFreshPass: Object.values(finalRecords).filter((r) => r.text.judged === 'final').length,
      rewordedAfterAcceptance: Object.values(finalRecords).filter((r) => r.text.reworded_after_acceptance).length,
      blindResolveOnFinalText: Object.values(finalRecords).filter((r) => r.blind_resolve_on_final_text).length,
      supplementaryReview: acceptance.final.supplementaryReview, spotChecked: acceptance.final.spotChecked,
    },
    entries: finalRecords,
  };
  fs.writeFileSync(path.join(outDir, names.entriesFinal), stableJson(entries, 1));
  return { acceptance, final, dropped, problems, plan, names, out: { dir: rel(outDir), ...names } };
}

// ---------------------------------------------------------------------------------------------
// final, wave 3 (17 Oct 2026)
// ---------------------------------------------------------------------------------------------

const mean = (values) => values.reduce((sum, v) => sum + v, 0) / values.length;
const round2 = (value) => Math.round(value * 100) / 100;

/**
 * Wave 3 final: the first-pass acceptance rule on the as-authored text, then the expert pass (verdicts ready / repaired / drop, repairs applied to the text),
 * the blind re-solve of every repair that changed what a solver sees (2 of 3 on the key, else held), the full fresh pass on the reworded rows (the same
 * rule on their own ten records), and the owner's publish rule of 17 Oct 2026 (quality mean 8 or more, fit median 8 or more). A missing or malformed role file
 * holds the row; nothing is invented. Writes the final acceptance, the publish set (candidates and entries), the held 7 to 7.9 set and the ledger of every drop.
 * The first-pass files (wave3-acceptance-, wave3-candidates-scored-, wave3-score-entries-) are not touched.
 */
async function runFinalW3(args) {
  const cfg = args.cfg;
  const inputs = cfg.finalInputs;
  const run = { ...args, expert: args.expert || inputs.expert, resolve: args.resolve || inputs.resolve, fresh: args.fresh.length ? args.fresh : [...inputs.fresh] };
  const built = await runAccept(run, { write: false });
  const { acceptance, candidates, records, rows, extras, lib, names, outDir, now } = built;
  const rule = cfg.publishRule;
  const source = loadSourceCandidates(run);
  const firstPass = tryJson(path.resolve(cfg.out, names.acceptance)); // the committed first-pass file, whatever --out says
  const firstPassAccepted = new Set((firstPass.state === 'ok' ? firstPass.value.questions || [] : []).filter((r) => r.accepted).map((r) => r.id));
  const candidateById = new Map(candidates.map((c) => [c.id, c]));
  const rowOf = new Map(rows.map((row) => [row.id, row]));
  const final = [];
  const held = [];
  const dropped = [];
  const drop = (id, category, reason, extra = {}) => {
    const row = rowOf.get(id);
    dropped.push({ id, subject: row?.subject ?? null, batch: row?.batch ?? null, chapter: row?.chapter ?? null, type: row?.type ?? null, first_pass: firstPassAccepted.has(id) ? 'accepted_in_the_first_pass' : 'not_accepted_in_the_first_pass', category, reason, ...extra });
  };
  for (const row of rows) {
    const candidate = candidateById.get(row.id);
    const verdict = extras.expert.verdicts.get(row.id);
    if (!candidate) {
      const categories = [...new Set(row.reasons.map(categoryOf))];
      const expertDrop = verdict && !PUBLISHABLE.includes(verdict.verdict);
      const category = expertDrop ? 'expert_drop' : (DROP_CATEGORY_OF.find(([re]) => categories.some((c) => re.test(c)))?.[1] || 'not_accepted_by_the_rule');
      const others = row.reasons.filter((r) => !r.startsWith('expert_verdict_'));
      const reason = expertDrop ? `expert verdict ${verdict.verdict}: ${verdict.why}${others.length ? ` (also: ${others.join('; ')})` : ''}` : row.reasons.join('; ');
      drop(row.id, category, reason, { ...(row.repaired_after_solve ? { repaired_after_solve: row.repaired_after_solve } : {}), ...(verdict?.raw?.syllabus_check ? { syllabus_check: verdict.raw.syllabus_check } : {}) });
      continue;
    }
    if (!PUBLISHABLE.includes(candidate._expert)) { drop(row.id, 'no_expert_verdict', 'accepted by the rule but no expert verdict of ready or repaired exists for it'); continue; }
    const record = records.get(row.id);
    const qualityScores = record.quality.map((judge) => judge.quality_score);
    const qualityMean = mean(qualityScores);
    const fitMedian = row.fit.median;
    const scores = { quality_scores: qualityScores, quality_mean: round2(qualityMean), fit_scores: row.fit.scores, fit_median: fitMedian };
    if (qualityMean >= rule.qualityMeanAtLeast && fitMedian >= rule.fitMedianAtLeast) final.push(candidate);
    else held.push({ candidate, record, ...scores, held_because: [...(qualityMean < rule.qualityMeanAtLeast ? [`quality_mean_${round2(qualityMean)}_below_${rule.qualityMeanAtLeast}`] : []), ...(fitMedian < rule.fitMedianAtLeast ? [`fit_median_${fitMedian}_below_${rule.fitMedianAtLeast}`] : [])] });
  }
  // A set that lost children: fewer than two left is not a set (the wave-1 validator refuses it). Wave 3 has none outside Hindi, which stays out; the rule is kept for safety.
  for (let changed = true; changed;) {
    changed = false;
    const bySet = new Map();
    for (const c of final) if (c.set_id && !c._extends_set) bySet.set(c.set_id, [...(bySet.get(c.set_id) || []), c]);
    for (const [setId, children] of bySet) {
      if (children.length >= 2) continue;
      for (const child of children) {
        final.splice(final.indexOf(child), 1);
        // Wave 4 (case sets): the child itself passed the 8-or-more rule; it is stranded because its siblings are held or out. The ledger says so and names the held siblings.
        const row = rowOf.get(child.id);
        const siblings = held.filter((h) => h.candidate.set_id === setId).map((h) => h.candidate.id);
        drop(child.id, 'set_left_with_fewer_than_2_children', `the passage set ${setId} has ${children.length} question left after the drops`, {
          stranded_by_set: { set_id: setId, passes_publish_rule_alone: true, quality_scores: row?.quality.map((j) => j.score) ?? null, fit_median: row?.fit.median ?? null, held_7_to_7_9_siblings: siblings },
        });
      }
      changed = true;
    }
  }
  const plan = lib.wave.planPublication(final);
  const problems = [...plan.problems];
  const finalIds = new Set(final.map((c) => c.id));
  const heldIds = new Set(held.map((h) => h.candidate.id));
  const count = (list, key) => list.reduce((by, item) => { const k = key(item); by[k] = (by[k] || 0) + 1; return by; }, {});
  // The expert files cover only the scored rows; Hindi has no verdicts and no rows.
  const expertBySubject = {};
  for (const row of rows) {
    const verdict = extras.expert.verdicts.get(row.id)?.verdict || 'none';
    const by = (expertBySubject[row.subject] ||= { ready: 0, repaired: 0, drop: 0, none: 0 });
    by[verdict] = (by[verdict] || 0) + 1;
  }
  const drafted = source ? count([...source.byId.values()], (v) => v.text.subject) : {};
  const resolveHeld = (row) => row.reasons.some((r) => /^(repaired_text_without_blind_resolve|resolve_|reworded_)/.test(r));
  const subjects = Object.keys(count(rows, (row) => row.subject)).sort();
  const bySubject = Object.fromEntries(subjects.map((subject) => [subject, {
    drafted: drafted[subject] ?? null,
    scored: rows.filter((r) => r.subject === subject).length,
    accepted_first_pass: rows.filter((r) => r.subject === subject && firstPassAccepted.has(r.id)).length,
    accepted_after_expert_and_resolve: candidates.filter((c) => c.subject === subject).length,
    expert: expertBySubject[subject],
    resolve_or_fresh_pass_held: rows.filter((r) => r.subject === subject && resolveHeld(r)).length,
    publish_8_plus: final.filter((c) => c.subject === subject).length,
    held_7_to_7_9: held.filter((h) => h.candidate.subject === subject).length,
    dropped_or_not_accepted: dropped.filter((d) => d.subject === subject).length,
  }]));
  const finalSummary = {
    note: 'Publication set under the owner rule of 17 Oct 2026: accepted by the first-pass rule (or the fresh pass for reworded rows), expert verdict ready or repaired, repair applied, blind re-solve where the text a solver sees changed, quality mean of the two judges 8 or more and fit median 8 or more. Rows that pass everything but score a quality mean of 7 to 7.9 are held for a later decision.',
    publish_rule: rule, publish: final.length, held_7_to_7_9: held.length, dropped: dropped.length, droppedByCategory: count(dropped, (d) => d.category),
    byVerdict: count(final, (c) => c._expert), reworded_with_fresh_pass: final.filter((c) => rowOf.get(c.id)?.fresh_pass).length,
    blindResolveOnFinalText: final.filter((c) => records.get(c.id)?.blind_resolve_on_final_text).length,
    judgeBlindAnswerCarriedOver: final.filter((c) => records.get(c.id)?.text.judge_blind_answer_carried_over).map((c) => c.id),
    bySubject, problems,
  };
  acceptance.final = finalSummary;
  for (const row of acceptance.questions) row.final = finalIds.has(row.id) ? 'publish' : heldIds.has(row.id) ? 'held_7_to_7_9' : (dropped.find((d) => d.id === row.id)?.category || 'not_accepted');
  // The final acceptance file: rows without the full judge records (those are in the entries file); the first-pass acceptance file stays as committed.
  const slim = acceptance.questions.map((row) => {
    const quality = row.quality.filter((j) => !j.missing).map((j) => j.score);
    return {
      id: row.id, subject: row.subject, batch: row.batch, chapter: row.chapter, type: row.type, accepted: row.accepted, final: row.final, reasons: row.reasons,
      expert: row.expert?.verdict ?? null, expert_repaired_fields: row.expert_repaired_fields ?? null, fresh_pass: row.fresh_pass?.batch ?? null,
      repaired_after_solve: row.repaired_after_solve ?? null, solvers: row.solvers, quality_scores: quality, quality_mean: quality.length === 2 ? round2(mean(quality)) : null,
      fit_scores: row.fit.scores, fit_median: row.fit.median, ...(row.warnings ? { warnings: row.warnings } : {}),
    };
  });
  const finalAcceptance = {
    kind: `${cfg.kind}_final_acceptance`, source: cfg.source, date: args.date, built_at: now, models: cfg.models, rule: RULE, publish_rule: rule,
    inputs: { expert: run.expert, resolve: run.resolve, fresh: run.fresh, raw: acceptance.raw, first_pass_acceptance: rel(path.resolve(cfg.out, names.acceptance)), expert_files: extras.expert.files, expert_conflicts: extras.expert.conflicts, blind_resolve_files_present: extras.resolve.solvers.length, fresh_pass_ids: extras.rewordIds.size, fresh_pass_partial: extras.ctx.freshPartial },
    note: `Wave-${cfg.wave} final acceptance, built by scripts/authored-w2-accept.mjs --wave=${cfg.id} --mode=final. Hindi is not in any file (no fluent reviewer). Repairs are applied from the expert verdicts (scripts/lib/authored-w3-repair.mjs); the batch files are unchanged.`,
    total: acceptance.total, final: finalSummary, files: acceptance.files, questions: slim,
  };
  fs.mkdirSync(outDir, { recursive: true });
  const finalFile = path.join(outDir, names.candidatesFinal);
  fs.writeFileSync(path.join(outDir, names.acceptanceFinal), stableJson(finalAcceptance, 1));
  fs.writeFileSync(finalFile, stableJson(final, 2));
  fs.writeFileSync(path.join(outDir, names.dropped), stableJson(dropped, 2));
  fs.writeFileSync(path.join(outDir, names.held), stableJson({
    kind: `${cfg.kind}_held_7_to_7_9`, source: cfg.source, date: args.date, built_at: now, rule,
    note: 'Questions that passed every gate (rule, expert verdict ready or repaired, repair applied, re-solve) but whose two quality judges average between 7 and 7.9. Held for a later owner decision: NOT in the publication set and NOT merged into any score table. Each item carries the candidate text and its full judge record, so it can be published with the same tooling.',
    count: held.length, bySubject: count(held, (h) => h.candidate.subject), items: held,
  }, 2));
  const finalRecords = Object.fromEntries(final.map((c) => [c.id, records.get(c.id)]));
  const entries = {
    kind: 'authored_score_entries', version: lib.scores.SCORES_VERSION, source: cfg.source, wave: cfg.wave, built_at: now, date: args.date, models: cfg.models,
    models_note: `The raw judge files do not record the model; ${cfg.modelNote}.`,
    note: `One record per question of the wave-${cfg.wave} publication set (quality mean 8 or more, fit median 8 or more), in the wave-1 entries format, built by scripts/authored-w2-accept.mjs --wave=${cfg.id} --mode=final from the raw files (${cfg.raw}), the expert verdicts, the blind re-solves and the fresh pass on the reworded rows. Tables are built from it by scripts/authored-scores-merge.mjs.`,
    candidates_file: rel(finalFile), candidates_sha256: sha256Text(finalFile),
    fresh_passes: run.fresh,
    counts: {
      candidates: final.length, entries: Object.keys(finalRecords).length, problems: problems.length,
      repaired: final.filter((c) => c._expert === 'repaired').length,
      judgedTextDiffers: Object.values(finalRecords).filter((r) => r.text.pre_repair).length,
      judgedOnFinalTextByFreshPass: Object.values(finalRecords).filter((r) => r.text.judged === 'final').length,
      blindResolveOnFinalText: Object.values(finalRecords).filter((r) => r.blind_resolve_on_final_text).length,
    },
    entries: finalRecords,
  };
  fs.writeFileSync(path.join(outDir, names.entriesFinal), stableJson(entries, 1));
  return { acceptance: finalAcceptance, final, held, dropped, problems, plan, names, out: { dir: rel(outDir), ...names } };
}

// ---------------------------------------------------------------------------------------------
// check
// ---------------------------------------------------------------------------------------------

function loadTable(dir, subject) {
  const res = tryJson(path.join(dir, `${subject}.json`));
  return res.state === 'ok' ? res.value : null;
}

// Plain-language diagnosis of an engine refusal. The refusal itself comes from the engine (ntaEligibility); these mirror the few rules behind the
// reasons seen in wave 2 (data/nta_question_selector.js optionsAreUsable and hasMalformedText, isPassageLinkedQuestion; data/nta_item_checks.js sequence checks)
// so a reviewer can see what to change. They are explanations, not a second check.
const comparable = (value) => text(value).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
export function explainRefusal(candidate, reasons, stemLabelsOf = null) {
  const out = [];
  const options = candidate.options || [];
  const set = new Set(reasons);
  if (set.has('options_invalid') || set.has('answer_guard_options_invalid') || set.has('answer_guard_near_duplicate_options')) {
    const letters = options.filter((option) => /^(option\s*)?[a-d]$/i.test(text(option.text).trim())).map((option) => option.key);
    if (letters.length) out.push(`option text is a single letter a-d (read as a placeholder): ${letters.join(', ')}`);
    const groups = new Map();
    for (const option of options) groups.set(comparable(option.text), [...(groups.get(comparable(option.text)) || []), option.key]);
    for (const [key, keys] of groups) if (keys.length > 1) out.push(`options ${keys.join(', ')} are identical once everything except letters and digits is dropped (${key ? `"${key}"` : 'nothing left'}): they differ only by symbols, signs, superscripts or brackets`);
    if (options.some((option) => text(option.text).length > 240)) out.push('an option is longer than 240 characters');
  }
  if (set.has('malformed_question_text')) out.push(`the stem or an option contains "[[" or "]]" (nested brackets, for example matrix notation): ${/\[\[|\]\]/.test(text(candidate.stem)) ? 'in the stem' : 'in an option'}`);
  if (set.has('orphan_passage_question')) {
    const hit = text(candidate.stem).match(/\b(according to|based on|as stated in|read the passage|read the excerpt|read the extract|read the text|the passage|the paragraph|the extract|the excerpt|the author|the narrator)\b/i);
    out.push(`the stem reads as passage-linked because of "${hit ? hit[0] : '?'}" but the row has no passage`);
  }
  if (set.has('sequence_key_is_listed_order')) out.push('the correct option lists the items in the same order as the stem prints them');
  // The three explanations below are given only when the caller passes stemLabels (wave 3); wave 2's committed reports have none for these codes.
  const found = stemLabelsOf ? [...stemLabelsOf(text(candidate.stem)).all] : null;
  const optionLabels = (candidate.options || []).flatMap((option) => [...text(option.text).matchAll(/\b(VI|IV|V|I{1,3}|[A-F]|[P-T]|[1-6])\b/g)].map((m) => m[1]));
  if (stemLabelsOf && set.has('sequence_options_not_orderings_of_stem_items')) out.push(`the options order the items by name (${text(candidate.options?.[0]?.text).slice(0, 60)}) and the stem labels ${found && found.length ? `only ${found.join(', ')}` : 'none of them'}; the engine's sequence check wants every option to be an ordering of at least three labelled items of the stem ((A), (B), (C) or 1, 2, 3)`);
  if (stemLabelsOf && set.has('statement_options_use_labels_not_in_stem')) out.push(`an option names statement labels the engine does not find in the stem (it finds ${found && found.length ? found.join(', ') : 'none'}; options use ${[...new Set(optionLabels)].join(', ')}): labels written inline ("I. ... S. II. ...") are lost when the text before them also ends in a label-like capital and a full stop; put each statement on its own line or in brackets, (I), (II), (III)`);
  if (stemLabelsOf && set.has('match_options_not_pairings')) out.push(`an option is not read as a set of pairs (${text(candidate.options?.[0]?.text)}): the engine reads pairs only as upper-case A-F with I-VI, 1-6 or P-T, and List I labels as upper-case (A)-(F); lower-case a, b, c, d are not recognised`);
  if (set.has('sequence_order_narrated_in_stem')) out.push('the stem itself narrates the order (two or more ordering cues)');
  return out;
}

// The engine's gate of a refusal reason (ntaGateOf, exported from r5.1; r5 has the same rule unexported): fit, quality, other (not a published bank row) or veto.
function gateOfReason(engine, reason) {
  if (typeof engine.ntaGateOf === 'function') return engine.ntaGateOf(reason);
  const code = String(reason || '');
  if (code.startsWith('fit_')) return 'fit';
  if (['no_score', 'question_changed_since_scored', 'blind_solver_key_missing', 'independent_solver_key_missing'].includes(code) || code.startsWith('score_') || code.startsWith('agent_score_')) return 'quality';
  if (['not_published', 'id_not_uuid', 'seed_or_demo_row'].includes(code)) return 'other';
  return 'veto';
}

export async function runCheck(args) {
  const cfg = args.cfg || WAVE_CONFIGS.w2;
  if (args.final && !cfg.finalMode && !cfg.finalInputs) throw new Error('--final needs a wave with a final mode');
  const lib = await loadLib(args.root);
  const { engine, scores, wave, evidence, items } = lib;
  const gateOf = (reason) => gateOfReason(engine, reason);
  const outDir = path.resolve(args.out);
  const names = FILES(args.date, cfg);
  const candidatesName = args.final ? names.candidatesFinal : names.candidates;
  const candidates = tryJson(path.join(outDir, candidatesName)).value;
  const entriesFile = tryJson(path.join(outDir, args.final ? names.entriesFinal : names.entries)).value;
  if (!Array.isArray(candidates) || !entriesFile?.entries) throw new Error(`run --mode=${args.final ? 'final' : 'accept'} first: ${candidatesName} and its entries file are needed in ${rel(outDir)}`);
  if (sha256Text(path.join(outDir, candidatesName)) !== entriesFile.candidates_sha256) throw new Error('the candidates file is not the one the entries were built from (sha256 differs); rebuild with --mode=accept or --mode=final');
  const wave1 = tryJson(path.resolve(args.wave1Final)).value || [];
  const now = args.now || new Date().toISOString();
  const header = { models: entriesFile.models, date: entriesFile.date };
  const policy = 'admit';

  // Rows exactly as the bank would hold them. A case set item typed single_mcq (geography) is mapped as a passage child, otherwise the
  // wave-1 mapping would drop its passage; its content hash then includes the passage, as the engine reads it.
  const wave1SetSizes = new Map();
  for (const c of wave1) if (c.set_id) wave1SetSizes.set(c.set_id, (wave1SetSizes.get(c.set_id) || 0) + 1);
  const nextOrder = new Map();
  // The final candidates are mapped by the wave tooling itself (case sets as passage children, a question that completes a wave-1 set in that set's
  // group); the first-pass candidates (no verdicts, so the validator would refuse them) keep this script's own mapping.
  const finalPlan = args.final ? wave.planPublication(candidates) : null;
  if (finalPlan?.problems.length) throw new Error(`final candidates do not validate: ${JSON.stringify(finalPlan.problems.slice(0, 5))}`);
  const finalRows = finalPlan ? new Map(finalPlan.rows.map((row) => [row.id, row])) : null;
  const planned = candidates.map((c) => {
    if (finalRows) {
      const row = finalRows.get(c.id);
      return { candidate: c, original: c, position: { groupId: row.passage_group_id, orderIndex: row.order_index }, row };
    }
    const isSet = Boolean(text(c.set_id).trim() && text(c.passage_text).trim());
    const mapped = isSet ? { ...c, type: 'passage_set_item' } : c;
    let position = {};
    if (isSet) {
      const order = (nextOrder.get(c.set_id) ?? wave1SetSizes.get(c.set_id) ?? 0) + 1;
      nextOrder.set(c.set_id, order);
      position = { groupId: cfg.id === 'w4' ? wave.groupIdOfCandidate(c) : wave.passageGroupIdOf(c.set_id), orderIndex: order };
    }
    return { candidate: mapped, original: c, position, row: wave.toQuestionRow(mapped, position) };
  });

  const bySubjectEntries = { agent: {}, fit: {} };
  for (const item of planned) {
    const record = entriesFile.entries[item.candidate.id];
    if (!record) throw new Error(`no entry record for ${item.candidate.id}`);
    const options = { policy, header, position: item.position };
    (bySubjectEntries.agent[item.candidate.subject] ||= {})[item.candidate.id] = scores.agentEntryFor(item.candidate.id, item.candidate, record, options);
    (bySubjectEntries.fit[item.candidate.subject] ||= {})[item.candidate.id] = scores.fitEntryFor(item.candidate.id, item.candidate, record, { ...options, engineTypeGuess: scores.engineTypeOf(item.candidate, item.row) });
  }
  const agentTables = {};
  const fitTables = {};
  const baseMissing = [];
  for (const subject of Object.keys(bySubjectEntries.agent)) {
    const agentBase = loadTable(path.join(args.root, 'data/nta_agent_scores'), subject);
    const fitBase = loadTable(path.join(args.root, 'data/nta_fit_scores'), subject);
    if (!agentBase) baseMissing.push(`agent:${subject}`);
    if (!fitBase) baseMissing.push(`fit:${subject}`);
    if (!agentBase || !fitBase) continue;
    agentTables[subject] = scores.mergeAgentTable(agentBase, bySubjectEntries.agent[subject], { subject, now, header, policy, source: cfg.source });
    fitTables[subject] = scores.mergeFitTable(fitBase, bySubjectEntries.fit[subject], { subject, now, header, policy, source: cfg.source });
  }
  if (baseMissing.length) throw new Error(`committed score tables missing: ${baseMissing.join(', ')}`);

  const reasonCounts = {};
  const gateCounts = {};
  const bySubject = {};
  const refused = [];
  const eligibleIds = new Set();
  const placementProblems = [];
  const typeDisagreements = [];
  const stored = new Map(entriesFile.entries ? Object.entries(entriesFile.entries) : []);
  for (const item of planned) {
    const { row, candidate, original } = item;
    const subject = candidate.subject;
    const verdict = engine.ntaEligibility({ ...row, evidence: null }, { subject, agentScores: agentTables, fitScores: fitTables });
    const s = (bySubject[subject] ||= { planned: 0, eligible: 0, ineligible: 0, reasons: {} });
    s.planned += 1;
    const batch = stored.get(candidate.id)?.batch ?? null;
    if (verdict.eligible) { s.eligible += 1; eligibleIds.add(candidate.id); } else {
      s.ineligible += 1;
      for (const reason of verdict.reasons) { reasonCounts[reason] = (reasonCounts[reason] || 0) + 1; s.reasons[reason] = (s.reasons[reason] || 0) + 1; }
      for (const gate of new Set(verdict.reasons.map(gateOf))) gateCounts[gate] = (gateCounts[gate] || 0) + 1;
      refused.push({ id: candidate.id, subject, batch, chapter: candidate.chapter, authored_type: original.type, engine_type: verdict.type, reasons: verdict.reasons, cause: explainRefusal(candidate, verdict.reasons, cfg.id === 'w2' ? null : items.stemLabels), stem: text(candidate.stem).slice(0, 140) });
    }
    if (verdict.type !== original.type && !(original.set_id && verdict.type === 'passage_set_item')) typeDisagreements.push({ id: candidate.id, subject, authored_type: original.type, engine_type: verdict.type });
    // Placement as the engine does it (prepareCandidates): the fit judges' chapter first, the database chapter otherwise.
    const facts = blueprintFacts(lib, subject);
    const tags = fitTables[subject].questions[candidate.id];
    const fitChapter = tags?.chapter || null;
    const place = [fitChapter, candidate.chapter].filter(Boolean).find((chapter) => facts.excluded.has(chapter) || facts.chapterUnits.has(chapter));
    if (!place) placementProblems.push({ id: candidate.id, subject, problem: 'chapter_not_in_this_paper', db_chapter: candidate.chapter, fit_chapter: fitChapter });
    else if (facts.excluded.has(place)) placementProblems.push({ id: candidate.id, subject, problem: 'chapter_out_of_syllabus', chapter: place });
    if (fitChapter && fitChapter !== candidate.chapter) typeDisagreements.push({ id: candidate.id, subject, note: 'fit judges majority chapter differs from the authored chapter', authored_chapter: candidate.chapter, fit_chapter: fitChapter });
  }

  // Sets: wave-2 sets, plus the wave-1 set that wave 2 tops up. The engine serves a set only with an in-range passage and
  // at least the blueprint's minimum of eligible, distinct children (data/nta_engine.js prepareCandidates).
  const setIds = [...new Set(planned.filter((item) => item.row.passage_group_id).map((item) => item.candidate.set_id))];
  const w1Plan = wave1.length ? wave.planPublication(wave1) : { rows: [] };
  const passageSets = setIds.map((setId) => {
    const subject = planned.find((item) => item.candidate.set_id === setId).candidate.subject;
    const sets = engine.getNtaBlueprint(subject).sets;
    const newRows = planned.filter((item) => item.candidate.set_id === setId).map((item) => item.row);
    const oldRows = w1Plan.rows.filter((row) => row.passage_group_id === wave.passageGroupIdOf(setId));
    const eligibleOld = oldRows.filter((row) => engine.ntaEligibility({ ...row, evidence: null }, { subject, agentScores: agentTables, fitScores: fitTables }).eligible);
    const eligibleNew = newRows.filter((row) => eligibleIds.has(row.id));
    const kept = [];
    for (const row of [...eligibleOld, ...eligibleNew]) {
      const features = items.itemFeatures(row, { english: subject === 'english', agentScores: agentTables });
      if (!kept.some((other) => items.conflictReason(features, other.features, { sameSet: true }))) kept.push({ row, features });
    }
    const words = items.passageWordCount((newRows[0] || oldRows[0]));
    return {
      set_id: setId, subject, chapter: (newRows[0] || oldRows[0]).chapter, passage_words: words, passage_words_range: sets.passageWords || null, min_children: sets.size.min,
      wave1_children: oldRows.length, wave1_children_eligible: eligibleOld.length, [`wave${cfg.wave}_children`]: newRows.length, [`wave${cfg.wave}_children_eligible`]: eligibleNew.length, distinct_eligible_children: kept.length,
      blueprint_serves_sets: sets.count.target > 0,
      servable: (sets.count.target > 0) && (!sets.passageWords || (words >= sets.passageWords.min && words <= sets.passageWords.max)) && kept.length >= sets.size.min,
    };
  });

  const engineFile = path.join(args.root, 'data/nta_engine.js');
  const report = {
    kind: `${cfg.kind}_engine_check`, label: args.label, source: cfg.source, at: now,
    engine: { root: args.root, file: 'data/nta_engine.js', version: engine.NTA_ENGINE_VERSION, sha256: sha256(fs.readFileSync(engineFile)), mtime: fs.statSync(engineFile).mtime.toISOString(), minScore: engine.NTA_MIN_SCORE, minFit: engine.NTA_MIN_FIT_SCORE },
    method: `ntaEligibility (quality gate with the agent scores, content gates, CUET-fit gate) on every accepted wave-${cfg.wave} question with the committed agent and fit tables of the named checkout plus the wave-${cfg.wave} entries merged in memory (policy admit). Nothing in data/ is written. Rows are mapped like the wave-1 publisher (toQuestionRow); case-set items typed single_mcq are mapped as passage children.`,
    candidatesSha256: entriesFile.candidates_sha256,
    planned: planned.length, engineEligible: eligibleIds.size, engineIneligible: refused.length,
    engineIneligibleReasons: Object.fromEntries(Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])),
    ineligibleByGate: gateCounts,
    bySubject,
    passageSets,
    placementProblems,
    informational: { authoredTypeVersusEngineType: typeDisagreements },
    refused,
  };
  fs.mkdirSync(outDir, { recursive: true });
  const target = path.join(outDir, names.engine(args.label));
  fs.writeFileSync(target, stableJson(report, 1));
  return { report, out: rel(target) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === 'accept') {
    const { acceptance, out } = await runAccept(args);
    console.log(JSON.stringify({ out, total: acceptance.total, bySubject: Object.fromEntries(Object.entries(acceptance.bySubject).map(([s, v]) => [s, { written: v.written, accepted: v.accepted, rejected: v.rejected, byReason: Object.fromEntries(Object.entries(v.rejectedByReason).filter(([, n]) => n)) }])), files: { ...acceptance.files, recordIssues: `${acceptance.files.recordIssues.length} (see the report)` } }, null, 1));
  } else if (args.mode === 'final') {
    const { acceptance, dropped, problems, out } = await runFinal(args);
    console.log(JSON.stringify({ out, final: acceptance.final, problems, dropped: dropped.length }, null, 1));
    if (problems.length) process.exit(1);
  } else if (args.mode === 'check') {
    const { report, out } = await runCheck(args);
    console.log(JSON.stringify({ out, engine: report.engine, planned: report.planned, engineEligible: report.engineEligible, engineIneligible: report.engineIneligible, reasons: report.engineIneligibleReasons, bySubject: Object.fromEntries(Object.entries(report.bySubject).map(([s, v]) => [s, { planned: v.planned, eligible: v.eligible, ineligible: v.ineligible }])), passageSets: report.passageSets, placementProblems: report.placementProblems.length }, null, 1));
  } else throw new Error(`unknown --mode=${args.mode}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error?.stack || error); process.exit(1); });
}
