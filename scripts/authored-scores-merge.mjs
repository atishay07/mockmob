#!/usr/bin/env node
// Authored wave: turns the raw judge files into the NTA engine's agent-score and CUET-fit tables.
// OFFLINE: reads files, writes files. No database, no network, no model.
//
//   node scripts/authored-scores-merge.mjs --mode=entries --quality-model=<id> --fit-model=<id> --solver-model=<id> [--date=2026-10-14]
//        [--candidates=docs/brain/reports/authored/wave1-candidates-final-2026-10-14.json] [--raw=tmp/authored]
//        [--fresh=<dir> ...] [--out=docs/brain/reports/authored/wave1-score-entries-final-2026-10-14.json]
//   node scripts/authored-scores-merge.mjs --mode=check --repaired-text=admit|hold [--entries=<file>] [--candidates=<file>]
//        [--agent-dir=data/nta_agent_scores] [--fit-base=data/nta_fit_scores] [--report=<file>] [--impact=tmp/nta-fixtures]
//   node scripts/authored-scores-merge.mjs --mode=merge --repaired-text=admit|hold ... [--agent-out=<dir>] [--fit-out=<dir>]
//   node scripts/authored-scores-merge.mjs --mode=rejudge-list [--entries=<file>] [--candidates=<file>] [--out=<file>]
//   node scripts/authored-scores-merge.mjs --mode=candidates-final --reword=<rw-01-final.json> [--drop=<dropped.json>] [--out=<final candidates>]
//
// entries  raw judge files (tmp/authored/<subject>/verify/<batch>__j1|j2|h1|h2|h3|s1-s5.json, the batch texts, the
//          expert verdicts and the blind re-solves of the repaired text) -> one durable record per question. The
//          record keeps every judge's result, the expert verdict, and the pre-repair text where a repair changed it.
//          The raw files are untracked scratch; this file is what git keeps. The judge models are not recorded in the
//          raw files, so they are required arguments: say who judged. --fresh=<dir> adds a later judge pass on the final
//          text (same <batch>__j1|j2|h1|h2|h3.json names); it replaces the original results for the ids it covers.
// check    builds the table entries from the records (nothing is written), then runs the NTA engine's own
//          eligibility check (data/nta_engine.js ntaEligibility) offline on every planned row, and prints the counts.
//          --impact=<dir> also builds three NTA papers in a row per subject from a local export of the bank (scripts/nta-fixture-export.mjs),
//          without and with the authored rows. English is skipped: its pool carries factory evidence, which needs the signing key.
// merge    check, then writes data/nta_agent_scores/<subject>.json and data/nta_fit_scores/<subject>.json with the
//          authored entries added. Every other question's entry is left exactly as it is.
//
// candidates-final  the wave-1 candidates (--original-candidates, kept as they were) minus the questions in --drop, with the questions of
//          --reword replaced by their reworded text (same ids). Writes the final candidates file the other modes default to.
// rejudge-list  the questions whose judged text differs from the final text in a way the content hash covers (the ones that
//          would need a fresh judge pass), with the fields that were repaired. Writes a JSON array.
//
// --repaired-text is a decision, not a default. For the repaired questions whose stem, options or explanation changed
// (60 of the 138 in wave 1) the judges scored the text before the repair:
//   admit  the table binds the scores to the final text's hash; the engine accepts them, provenance says what was scored;
//   hold   the table binds them to the pre-repair hash; the engine refuses them until a fresh pass on the final text.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { assembleNtaPaper, getNtaBlueprint, ntaEligibility } from '../data/nta_engine.js';
import { conflictReason, itemFeatures, passageWordCount } from '../data/nta_item_checks.js';
import { contentHash } from '../data/content_evidence.js';
import { AUTHORED_SOURCE, AUTHORED_SUBJECTS, buildFinalCandidates, planPublication } from './lib/authored-wave.mjs';
import {
  FIT_JUDGES, NTA_MIN_FIT_SCORE, SCORES_VERSION, agentEntryFor, buildEntries, engineTypeOf, fitEntryFor, fitGateReasons, hashesOf, mergeAgentTable, mergeFitTable, positionsOf,
} from './lib/authored-scores.mjs';

const DEFAULTS = {
  // The final candidates: the wave-1 candidates (kept as they were, for history) minus the questions that failed the fresh pass,
  // with the engine-refused ones reworded (mode=candidates-final).
  candidates: 'docs/brain/reports/authored/wave1-candidates-final-2026-10-14.json',
  originalCandidates: 'docs/brain/reports/authored/wave1-candidates-2026-10-14.json',
  drop: 'docs/brain/reports/authored/wave1-dropped-2026-10-14.json',
  reword: null,
  raw: 'tmp/authored',
  entries: 'docs/brain/reports/authored/wave1-score-entries-final-2026-10-14.json',
  agentDir: 'data/nta_agent_scores',
  fitBase: 'data/nta_fit_scores',
};
const AGENT_RUBRIC = 'docs/brain/NTA-AGENT-RUBRIC.md';
const FIT_RUBRIC = 'docs/brain/NTA-CUET-FIT-RUBRIC.md';

export function parseArgs(argv) {
  const out = { mode: 'check', fresh: [], ...DEFAULTS, repairedText: null, models: {}, date: '2026-10-14', agentOut: null, fitOut: null, report: null, now: null, impact: null, out: null };
  for (const arg of argv) {
    const m = arg.match(/^--([\w-]+)=(.*)$/);
    if (!m) continue;
    const [, name, value] = m;
    if (name === 'mode') out.mode = value;
    else if (name === 'fresh') out.fresh.push(path.resolve(value));
    else if (name === 'candidates') out.candidates = value;
    else if (name === 'original-candidates') out.originalCandidates = value;
    else if (name === 'drop') out.drop = value;
    else if (name === 'reword') out.reword = value;
    else if (name === 'raw') out.raw = value;
    else if (name === 'out') out.out = value;
    else if (name === 'entries') out.entries = value;
    else if (name === 'agent-dir') out.agentDir = value;
    else if (name === 'agent-out') out.agentOut = value;
    else if (name === 'fit-base') out.fitBase = value;
    else if (name === 'fit-out') out.fitOut = value;
    else if (name === 'report') out.report = value;
    else if (name === 'repaired-text') out.repairedText = value;
    else if (name === 'quality-model') out.models.quality = value;
    else if (name === 'fit-model') out.models.fit = value;
    else if (name === 'solver-model') out.models.solver = value;
    else if (name === 'date') out.date = value;
    else if (name === 'now') out.now = value;
    else if (name === 'impact') out.impact = value;
  }
  return out;
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = (file, { normalizeEol = false } = {}) => {
  if (!fs.existsSync(file)) return null;
  const raw = normalizeEol ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : fs.readFileSync(file);
  return createHash('sha256').update(raw).digest('hex');
};
const stable = (value, indent) => `${JSON.stringify(value, null, indent)}\n`;

/**
 * mode=candidates-final: the wave-1 candidates with the dropped questions removed and the reworded ones replaced (same ids).
 * --drop is a JSON array of { id, reason }; --reword is a batch file ({ questions }) or an array of candidates.
 */
export function runFinalCandidates(args, { write = true } = {}) {
  const base = readJson(args.originalCandidates);
  const drops = args.drop && fs.existsSync(args.drop) ? readJson(args.drop) : [];
  const rewordFile = args.reword ? readJson(args.reword) : [];
  const reworded = Array.isArray(rewordFile) ? rewordFile : rewordFile.questions;
  const { candidates, dropped, problems } = buildFinalCandidates(base, reworded, drops);
  if (problems.length) return { ok: false, problems };
  const plan = planPublication(candidates);
  if (plan.problems.length) return { ok: false, problems: plan.problems };
  const target = args.out || args.candidates;
  if (write) { fs.mkdirSync(path.dirname(path.resolve(target)), { recursive: true }); fs.writeFileSync(target, stable(candidates, 2)); }
  return {
    ok: true, out: target, from: args.originalCandidates, count: candidates.length, dropped: dropped.map(({ id, subject, set_id: setId, reason }) => ({ id, subject, setId, reason })),
    reworded: reworded.length, bySubject: plan.summary.bySubject, passageChildrenBySet: plan.summary.passageChildrenBySet, passageSetsBelowNtaMinimum: plan.summary.passageSetsBelowNtaMinimum,
  };
}

/** mode=entries: raw judge files to the durable per-question records. Writes the entries file unless dryRun. */
export function runEntries(args, { write = true } = {}) {
  for (const role of ['quality', 'fit', 'solver']) if (!args.models[role]) throw new Error(`--${role}-model is required: the raw judge files do not record which model judged`);
  const candidates = readJson(args.candidates);
  // The wave-1 text of each question, so a reworded one records what was reworded.
  const originals = fs.existsSync(args.originalCandidates) ? new Map(readJson(args.originalCandidates).map((c) => [c.id, c])) : null;
  const { entries, problems, counts } = buildEntries(candidates, { rawDir: path.resolve(args.raw), freshDirs: args.fresh, originals, models: args.models, date: args.date });
  if (problems.length) return { ok: false, problems: problems.slice(0, 40), problemCount: problems.length, counts };
  const header = {
    kind: 'authored_score_entries', version: SCORES_VERSION, source: AUTHORED_SOURCE,
    built_at: args.now || new Date().toISOString(), date: args.date, models: args.models,
    models_note: 'Supplied on the command line when the entries were built: the raw judge files do not record which model judged. Confirm it before the tables are merged (the agent threshold was calibrated on claude-haiku-5-5).',
    note: 'One record per question from the raw judge files (untracked scratch under tmp/authored). The tables in data/ are built from this file by scripts/authored-scores-merge.mjs.',
    candidates_file: args.candidates, candidates_sha256: sha(args.candidates),
    fresh_passes: args.fresh.map((dir) => path.relative(process.cwd(), dir)),
    counts,
  };
  const target = args.out || args.entries;
  if (write) { fs.mkdirSync(path.dirname(path.resolve(target)), { recursive: true }); fs.writeFileSync(target, stable({ ...header, entries }, 1)); }
  return { ok: true, header, entriesFile: target, counts };
}

function loadTable(dir, subject) {
  const file = path.join(dir, `${subject}.json`);
  return fs.existsSync(file) ? readJson(file) : null;
}

/**
 * Builds the merged tables in memory and checks them against the engine: { tables, fitTables, report }.
 * Nothing is written here.
 */
export function runCheck(args) {
  if (!['admit', 'hold'].includes(args.repairedText)) throw new Error('--repaired-text=admit|hold is required (see the header of this script)');
  const file = readJson(args.entries);
  if (file.kind !== 'authored_score_entries' || file.version !== SCORES_VERSION) throw new Error(`${args.entries} is not an authored_score_entries file of version ${SCORES_VERSION}`);
  const candidates = readJson(args.candidates);
  if (sha(args.candidates) !== file.candidates_sha256) throw new Error('the candidates file is not the one the entries were built from (sha256 differs); rebuild the entries');
  const plan = planPublication(candidates);
  if (plan.problems.length) throw new Error(`candidates do not validate: ${JSON.stringify(plan.problems.slice(0, 5))}`);
  const positions = positionsOf(plan.rows);
  const rowById = new Map(plan.rows.map((row) => [row.id, row]));
  const header = { models: file.models, date: file.date };
  const now = args.now || new Date().toISOString();
  const agentRubricSha = sha(AGENT_RUBRIC);
  const fitRubricSha = sha(FIT_RUBRIC, { normalizeEol: true });

  const agentBySubject = {};
  const fitBySubject = {};
  for (const candidate of candidates) {
    const record = file.entries[candidate.id];
    if (!record) throw new Error(`no entry record for ${candidate.id}`);
    const position = positions.get(candidate.id);
    const options = { policy: args.repairedText, header, position };
    (agentBySubject[candidate.subject] ||= {})[candidate.id] = agentEntryFor(candidate.id, candidate, record, options);
    (fitBySubject[candidate.subject] ||= {})[candidate.id] = fitEntryFor(candidate.id, candidate, record, { ...options, engineTypeGuess: engineTypeOf(candidate, rowById.get(candidate.id)) });
  }

  const agentTables = {};
  const fitTables = {};
  const fitBaseMissing = [];
  for (const subject of AUTHORED_SUBJECTS) {
    agentTables[subject] = mergeAgentTable(loadTable(args.agentDir, subject), agentBySubject[subject] || {}, { subject, now, header, policy: args.repairedText, rubricSha256: agentRubricSha });
    const base = loadTable(args.fitBase, subject);
    if (!base) fitBaseMissing.push(subject);
    fitTables[subject] = mergeFitTable(base, fitBySubject[subject] || {}, { subject, now, header, policy: args.repairedText, rubricSha256: fitRubricSha });
  }

  // The engine's own gates, offline, on the exact rows the publish script would write.
  const reasonCounts = {};
  const bySubject = {};
  const ineligible = [];
  const eligibleIds = new Set();
  const fitReasonCounts = {};
  let fitPass = 0;
  let both = 0;
  for (const row of plan.rows) {
    const verdict = ntaEligibility({ ...row, evidence: null }, { subject: row.subject, agentScores: agentTables });
    const subjectCounts = (bySubject[row.subject] ||= { planned: 0, eligible: 0, fitPass: 0, both: 0 });
    subjectCounts.planned += 1;
    if (verdict.eligible) { subjectCounts.eligible += 1; eligibleIds.add(row.id); }
    else {
      ineligible.push({ id: row.id, subject: row.subject, chapter: row.chapter, reasons: verdict.reasons });
      for (const reason of verdict.reasons) reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    }
    const fitEntry = fitTables[row.subject].questions[row.id];
    const fitReasons = fitGateReasons(fitEntry, contentHash(row));
    if (!fitReasons.length) { fitPass += 1; subjectCounts.fitPass += 1; }
    for (const reason of fitReasons) fitReasonCounts[reason] = (fitReasonCounts[reason] || 0) + 1;
    if (verdict.eligible && !fitReasons.length) { both += 1; subjectCounts.both += 1; }
  }
  // English passage sets: the engine serves a set only with its passage length inside the blueprint's range and at least the
  // blueprint's minimum number of eligible children (data/nta_engine.js prepareCandidates).
  const sets = getNtaBlueprint('english').sets;
  const passageSets = [...new Set(plan.rows.map((row) => row.passage_group_id).filter(Boolean))].map((groupId) => {
    const children = plan.rows.filter((row) => row.passage_group_id === groupId);
    const words = passageWordCount(children[0]);
    // The engine serves one child of two that ask the same thing (distinctChildren); the stem-wording weights need the whole pool, so this is the check without them.
    const kept = [];
    for (const row of children.filter((child) => eligibleIds.has(child.id))) {
      const features = itemFeatures(row, { english: true, agentScores: agentTables });
      if (!kept.some((other) => conflictReason(features, other.features, { sameSet: true }))) kept.push({ row, features });
    }
    const eligibleChildren = kept.length;
    return { groupId, chapter: children[0].chapter, words, children: children.length, eligibleChildren, servable: words >= sets.passageWords.min && words <= sets.passageWords.max && eligibleChildren >= sets.size.min };
  });
  const authoredEntries = Object.values(agentBySubject).flatMap((entries) => Object.values(entries));
  const report = {
    kind: 'authored_scores_check', version: SCORES_VERSION, source: AUTHORED_SOURCE, repairedTextPolicy: args.repairedText, at: now,
    planned: plan.rows.length,
    agentEntries: authoredEntries.length,
    hashChangedByRepair: authoredEntries.filter((entry) => entry.provenance.hash_changed_by_repair).length,
    heldForFreshPass: authoredEntries.filter((entry) => entry.provenance.engine_acceptance.startsWith('held')).length,
    engineEligible: plan.rows.length - ineligible.length,
    engineIneligible: ineligible.length,
    engineIneligibleReasons: reasonCounts,
    fitGate: { mirror: 'data/nta_fit_scores.js on wip/cuet-fit (ntaFitGateReasons + the content-hash check)', minFit: NTA_MIN_FIT_SCORE, pass: fitPass, reasons: fitReasonCounts, baseTablesMissing: fitBaseMissing },
    qualityAndFitBoth: both,
    passageSets: { servable: passageSets.filter((set) => set.servable).length, of: passageSets.length, blueprint: { passageWords: sets.passageWords, minChildren: sets.size.min }, sets: passageSets },
    ...(args.impact ? { impact: { export: args.impact, subjects: impactOf(args.impact, { plan, tables: agentTables, args }) } } : {}),
    bySubject,
    ineligible,
  };
  return { tables: agentTables, fitTables, report, plan };
}

/**
 * What the authored rows add, offline: eligible rows and three papers in a row (each leaving out the earlier papers'
 * questions), per subject, from a local export of the bank, with the committed agent tables and with the merged ones.
 * Only subjects whose exported rows carry no factory evidence are faithful (the engine cannot verify evidence without the
 * signing key); the five short subjects of wave 1 have none.
 */
function impactOf(dir, { plan, tables, args }) {
  const out = {};
  for (const subject of AUTHORED_SUBJECTS.filter((name) => name !== 'english')) {
    const file = path.join(dir, `${subject}.json`);
    if (!fs.existsSync(file)) { out[subject] = { skipped: 'no export file' }; continue; }
    const existing = readJson(file).filter((row) => row.status === 'live' && !row.is_deleted);
    const withEvidence = existing.filter((row) => row.evidence).length;
    const authored = plan.rows.filter((row) => row.subject === subject);
    const before = { [subject]: loadTable(args.agentDir, subject) };
    const after = { [subject]: tables[subject] };
    const eligible = (rows, agentScores) => rows.filter((row) => ntaEligibility({ ...row, evidence: row.evidence ?? null }, { subject, agentScores }).eligible).length;
    const papers = (rows, agentScores) => {
      const previous = new Set();
      return [1, 2, 3].map((n) => {
        const paper = assembleNtaPaper(rows, { subject, seed: `authored-impact-${n}`, agentScores, previousPaperIds: previous, seenIds: new Set() });
        for (const row of paper.rows) previous.add(row.id);
        return { status: paper.status, questions: paper.rows.length };
      });
    };
    out[subject] = {
      exportRows: existing.length, exportRowsWithEvidence: withEvidence,
      faithful: withEvidence === 0,
      eligibleWithout: eligible(existing, before), eligibleWith: eligible([...existing, ...authored], after),
      papersWithout: papers(existing, before), papersWith: papers([...existing, ...authored], after),
    };
  }
  return out;
}

/** mode=rejudge-list: the questions a fresh judge pass on the final text would cover. */
export function runRejudgeList(args, { write = true } = {}) {
  const file = readJson(args.entries);
  const candidates = readJson(args.candidates);
  const plan = planPublication(candidates);
  if (plan.problems.length) throw new Error(`candidates do not validate: ${JSON.stringify(plan.problems.slice(0, 5))}`);
  const positions = positionsOf(plan.rows);
  const list = candidates.flatMap((candidate) => {
    const record = file.entries[candidate.id];
    if (!record?.text.pre_repair) return [];
    const hashes = hashesOf(candidate, record, positions.get(candidate.id));
    return hashes.hashChanged ? [{ id: candidate.id, subject: candidate.subject, chapter: candidate.chapter, batch: record.batch, repaired_fields: Object.keys(record.text.pre_repair), expert_issue: record.text.expert_issue }] : [];
  });
  const out = args.out || 'docs/brain/reports/authored/wave1-needs-fresh-judging-2026-10-14.json';
  if (write) { fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true }); fs.writeFileSync(out, stable(list, 1)); }
  return { list, out, count: list.length };
}

/** mode=merge: runCheck, then writes the tables. */
export function runMerge(args) {
  const { tables, fitTables, report } = runCheck(args);
  const agentOut = args.agentOut || args.agentDir;
  const fitOut = args.fitOut || args.fitBase;
  // This checkout may have no fit tables (the fit gate is on wip/cuet-fit). Authored-only fit files would clash with the full
  // tables on merge, so they are written only when the base exists or --fit-out is given.
  const writeFit = fs.existsSync(args.fitBase) || Boolean(args.fitOut);
  fs.mkdirSync(agentOut, { recursive: true });
  for (const subject of AUTHORED_SUBJECTS) fs.writeFileSync(path.join(agentOut, `${subject}.json`), stable(tables[subject], 2));
  if (writeFit) {
    fs.mkdirSync(fitOut, { recursive: true });
    for (const subject of AUTHORED_SUBJECTS) fs.writeFileSync(path.join(fitOut, `${subject}.json`), stable(fitTables[subject], 1));
  }
  return { report, agentOut, fitOut: writeFit ? fitOut : null, fitTablesWritten: writeFit, ...(writeFit ? {} : { fitNote: `no fit tables at ${args.fitBase} in this checkout: the fit entries were not written. Merge the branch that has data/nta_fit_scores first, or pass --fit-base and --fit-out.` }) };
}

export { FIT_JUDGES };

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let result;
  if (args.mode === 'entries') result = runEntries(args);
  else if (args.mode === 'check') result = { report: runCheck(args).report };
  else if (args.mode === 'merge') result = runMerge(args);
  else if (args.mode === 'candidates-final') result = runFinalCandidates(args);
  else if (args.mode === 'rejudge-list') { const listed = runRejudgeList(args); result = { count: listed.count, out: listed.out, bySubject: listed.list.reduce((by, item) => ({ ...by, [item.subject]: (by[item.subject] || 0) + 1 }), {}) }; }
  else throw new Error(`unknown --mode=${args.mode}`);
  const printable = result.report ? { ...result, report: { ...result.report, ineligible: `${result.report.ineligible.length} rows (see --report)` } } : result;
  if (args.report && result.report) { fs.mkdirSync(path.dirname(path.resolve(args.report)), { recursive: true }); fs.writeFileSync(args.report, stable(result.report, 1)); }
  console.log(JSON.stringify(printable, null, 1));
  if (result.ok === false) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error?.message || error); process.exit(1); });
}
