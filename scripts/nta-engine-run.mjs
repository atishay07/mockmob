// NTA engine run on production data. READ-ONLY: select queries only, with the service role, against
// the project in .env.local. It never inserts, updates or deletes, never creates a session, never
// records a shortfall row and calls no model.
//
//   node --use-system-ca scripts/nta-engine-run.mjs [docs/brain/NTA-ENGINE-RUN.md]
//
// For every NTA subject it builds three papers in a row for one simulated student, with the same loader
// and engine the website uses (data/nta_pool.js, data/nta_engine.js): paper 2 leaves out paper 1's
// questions and paper 3 leaves out papers 1 and 2 (previousPaperIds), falling back to treating them as
// seen only when the pool cannot serve a paper without them, as a student's next NTA paper does. It
// prints structure, deviations, timing, cross-paper repeats and where the answer keys sit after the
// per-session option order.
// It also counts what the pool would hold at other score thresholds, checks five fresh papers per
// serving subject for repeated concepts, and times the slim read the index path would make.
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv(path = '.env.local') {
  return Object.fromEntries(fs.readFileSync(path, 'utf8').split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
}
const env = loadEnv();
// Only the evidence signing key is copied in: the engine needs it to verify scores.
process.env.CUET_EVIDENCE_SIGNING_KEY = env.CUET_EVIDENCE_SIGNING_KEY || '';

const { CUET_PUBLIC_ALLOWED_SUBJECTS, toInternalSubjectId } = await import('../data/cuet_controls.js');
const { NTA_MIN_SCORE, NTA_ENGINE_VERSION, NTA_MIN_SERVE_QUESTIONS, assembleNtaPaper, getNtaBlueprint, ntaEligibility } = await import('../data/nta_engine.js');
const { buildNtaPaper, loadNtaPool, attachPassages, loadOpenDisputes, loadHeldFamilies, NTA_SLIM_COLUMNS } = await import('../data/nta_pool.js');
const { contentTokens, jaccard, isNumericalItem, objectiveTagOf, ntaDifficultyOf } = await import('../data/nta_item_checks.js');
const { getQuestionText, normalizeOptions } = await import('../data/nta_question_selector.js');
const { ntaAgentTable, ntaAgentAdmissibleIds, NTA_AGENT_RUBRIC_VERSION } = await import('../data/nta_agent_scores.js');
const keyDisputesFile = JSON.parse(fs.readFileSync('data/nta_key_disputes.json', 'utf8'));
const difficultyFile = JSON.parse(fs.readFileSync('data/nta_difficulty.json', 'utf8'));
const objectivesFile = JSON.parse(fs.readFileSync('data/nta_objectives.json', 'utf8'));

// Gates added by the 13 Oct reviews (data/nta_item_checks.js, quarantine, fail-closed scores, the
// expert review's seed rows, corrupted connectives, listed-order keys and blocking flags on any source).
const REVIEW_GATES = new Set([
  'id_not_uuid', 'seed_or_demo_row', 'wording_corrupted_connective', 'sequence_key_is_listed_order', 'match_key_is_listed_order', 'agent_blocking_flag',
  'options_repeated_in_stem', 'sequence_options_not_orderings_of_stem_items', 'match_list_two_missing', 'match_options_not_pairings',
  'match_options_use_labels_not_in_stem', 'statement_options_use_labels_not_in_stem', 'stem_states_rule_for_this_question',
  'stem_cites_unstated_condition', 'stem_cites_source_text', 'stem_defines_what_is_tested', 'stem_hedges_options', 'stem_refers_to_options',
  'sequence_order_given_in_stem', 'sequence_order_narrated_in_stem', 'sequence_of_study_material', 'explanation_cites_item_not_concept',
  'nta_quarantined', 'score_needs_both_judges', 'blind_solver_key_missing', 'independent_solver_key_missing', 'score_unsigned',
]);
const fullText = (row) => contentTokens(`${getQuestionText(row)} ${normalizeOptions(row.options, row).map((option) => option.text).join(' ')}`);

const outMd = process.argv[2] || 'docs/brain/NTA-ENGINE-RUN.md';
const outJson = outMd.replace(/\.md$/, '.json').replace('docs/brain/', 'docs/brain/reports/');
const db = createClient(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const projectRef = new URL(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];

const runs = [];
for (const subject of CUET_PUBLIC_ALLOWED_SUBJECTS) {
  const internal = toInternalSubjectId(subject);
  const bp = getNtaBlueprint(subject);
  const papers = [];
  const seen = new Set();
  for (let i = 1; i <= 3; i += 1) {
    const previous = new Set(seen);
    const result = await buildNtaPaper(db, internal, { seenIds: new Set(seen), previousPaperIds: previous, seed: `engine-run-${subject}-${i}`, cache: false });
    const keys = { A: 0, B: 0, C: 0, D: 0 };
    for (const row of result.rows) { const letter = 'ABCD'[row.correct_index]; if (letter) keys[letter] += 1; }
    const repeated = result.paper.filter((entry) => previous.has(entry.id)).length;
    for (const entry of result.paper) seen.add(entry.id);
    papers.push({
      paper: i,
      status: result.status,
      questions: result.paper.length,
      structure: result.structure,
      deviations: result.deviations.map(({ kind, key, expected, actual }) => ({ kind, key, expected, actual })),
      notice: result.notice,
      refusal: result.refusal,
      pool: result.pool,
      timings: result.timings,
      order: result.paper.map((entry) => ({ q: entry.position, section: entry.sectionIndex, type: entry.type, chapter: entry.chapter, difficulty: entry.difficulty, set: entry.setIndex, seen: entry.item.seen })),
      numerical: result.paper.filter((entry) => isNumericalItem(entry.row)).length,
      keys,
      repeated,
      crossPaper: result.structure.crossPaper || null,
      optionShuffle: result.structure.optionShuffle || null,
    });
  }
  // The same paper again from the in-memory pool cache, as a second student start would get it.
  const warm = await buildNtaPaper(db, internal, { seenIds: new Set(), seed: `engine-run-${subject}-warm` });
  const cachedStart = await buildNtaPaper(db, internal, { seenIds: new Set(), seed: `engine-run-${subject}-cached` });
  const cachedMs = cachedStart.timings.endToEndMs;
  void warm;

  // Thresholds: same pool and gates, different bar.
  const pool = await attachPassages(db, await loadNtaPool(db, internal));
  const disputedIds = await loadOpenDisputes(db);
  const heldFamilies = await loadHeldFamilies(db, pool);
  // What the review gates removed: questions at the bar that pass the old gates but fail a new one.
  const reviewGateCounts = {};
  let atBarOldGates = 0;
  let keptOut = 0;
  for (const row of pool) {
    const verdict = ntaEligibility(row, { subject: internal, disputedIds, heldFamilies });
    if (verdict.score === null || verdict.score < NTA_MIN_SCORE) continue;
    const others = verdict.reasons.filter((reason) => !REVIEW_GATES.has(reason));
    if (others.length) continue;
    atBarOldGates += 1;
    if (verdict.reasons.length) keptOut += 1;
    for (const reason of verdict.reasons) reviewGateCounts[reason] = (reviewGateCounts[reason] || 0) + 1;
  }
  // Five fresh papers (no seen questions): what is left of repeated concepts.
  const fresh = [];
  for (let i = 1; i <= 5; i += 1) {
    const trial = assembleNtaPaper(pool, { subject, disputedIds, heldFamilies, seed: `fresh-${subject}-${i}` });
    if (trial.status === 'refused') { fresh.push({ status: trial.status }); continue; }
    const tokens = trial.paper.map((entry) => fullText(entry.row));
    let near04 = 0;
    let near05 = 0;
    for (let a = 0; a < tokens.length; a += 1) for (let b = a + 1; b < tokens.length; b += 1) {
      const score = jaccard(tokens[a], tokens[b]);
      if (score >= 0.4) near04 += 1;
      if (score >= 0.5) near05 += 1;
    }
    const tags = new Map();
    for (const entry of trial.paper) { const tag = objectiveTagOf(entry.row); if (tag) tags.set(tag, (tags.get(tag) || 0) + 1); }
    fresh.push({ status: trial.status, near04, near05, repeatedTags: [...tags.values()].filter((n) => n > 1).length,
      duplicates: trial.deviations.filter((deviation) => deviation.kind === 'duplicate').length,
      numerical: trial.paper.filter((entry) => isNumericalItem(entry.row)).length, types: trial.structure.types });
  }
  // The index path's read: the same questions without the evidence column (select only).
  const slimStarted = Date.now();
  let slimBytes = 0;
  const ids = pool.map((row) => row.id);
  for (let i = 0; i < ids.length; i += 300) {
    const { data, error } = await db.from('questions').select(NTA_SLIM_COLUMNS).in('id', ids.slice(i, i + 300));
    if (error) throw error;
    slimBytes += Buffer.byteLength(JSON.stringify(data || []));
  }
  const slimRead = { ms: Date.now() - slimStarted, bytes: slimBytes, fullBytes: Buffer.byteLength(JSON.stringify(pool)), rows: ids.length };
  const thresholds = {};
  for (const minScore of [7, 7.5, 8, 8.5, 9]) {
    const eligible = pool.filter((row) => ntaEligibility(row, { subject: internal, minScore, disputedIds, heldFamilies }).eligible).length;
    const trial = assembleNtaPaper(pool, { subject, minScore, disputedIds, heldFamilies, seed: `threshold-${minScore}` });
    thresholds[minScore] = { eligible, status: trial.status, questions: trial.paper.length, completeSets: trial.pool.completeSets };
  }
  const { count: liveCount } = await db.from('questions').select('id', { count: 'exact', head: true }).eq('subject', internal).eq('status', 'live').eq('is_deleted', false);
  // The agent pass for this subject: what the committed table holds and what the engine took from it.
  const agentTable = ntaAgentTable(subject);
  const agentIds = new Set(Object.keys(agentTable?.questions || {}));
  const agent = {
    calibration: agentTable?.calibration?.status || 'missing',
    threshold: agentTable?.calibration?.threshold ?? null,
    rubric: agentTable?.rubric_version || null,
    models: agentTable?.models || [],
    judged: agentIds.size,
    judgedByBoth: agentTable?.measures?.judged_by_both ?? 0,
    admissibleBeforeRowChecks: ntaAgentAdmissibleIds(subject).length,
    agentRowsRead: pool.agentRows || 0,
    eligibleAgentScored: papers[0].pool.eligibleBySource?.agent_scored || 0,
    eligibleFactory: (papers[0].pool.eligibleBySource?.evidence_judges || 0) + (papers[0].pool.eligibleBySource?.nta_index || 0),
    keyDisputes: Object.values(keyDisputesFile.questions || {}).filter((entry) => entry.subject === subject).length,
    // Corrections in the file for this subject, and the ones that change a loaded row's label now (the stored label may have moved on).
    difficultyCorrectionsInFile: Object.values(difficultyFile.questions || {}).filter((entry) => entry.subject === subject).length,
    difficultyCorrections: pool.filter((row) => ntaDifficultyOf(row) !== (String(row.difficulty || '').trim().toLowerCase() || 'medium')).length,
    objectiveTags: [...agentIds].filter((id) => (objectivesFile.agent_questions || {})[id]).length,
    measures: agentTable?.measures || null,
  };
  runs.push({ subject, internal, blueprintVersion: bp.blueprintVersion, kind: bp.kind, live: liveCount, loadedWithScoreSource: pool.length, papers, thresholds, reviewGateCounts, atBarOldGates, keptOut, fresh, slimRead, cachedMs, agent });
  console.log(subject.padEnd(18), papers.map((p) => `${p.status}:${p.questions}:${p.timings.endToEndMs}ms`).join('  '));
}

// ---------- report ----------
const ms = (value) => `${Math.round(value)} ms`;
const label = (status) => ({ exact: 'exact match', closest: 'closest valid paper', refused: 'refused' }[status] || status);
const lines = [];
lines.push('# NTA engine run on production data');
lines.push('');
lines.push(`Generated by \`scripts/nta-engine-run.mjs\` on ${new Date().toISOString().slice(0, 10)} against the production project \`${projectRef}\`, read-only (select queries only; no session, no shortfall row and no model call). Engine \`${NTA_ENGINE_VERSION}\`, blueprints \`${runs[0].blueprintVersion}\`. Score bar: mean judge score ${NTA_MIN_SCORE} or more out of 10 (\`NTA_MIN_SCORE\` in \`data/nta_engine.js\`). A paper below 50 questions is served only from ${NTA_MIN_SERVE_QUESTIONS}.`);
lines.push('');
lines.push('Each subject gets three papers for one simulated student: paper 2 leaves out paper 1, paper 3 leaves out papers 1 and 2 (falling back to treating them as seen when the pool is too small). Timings are measured on this machine against the production database; "end to end" covers the pool read, passage, dispute and hold lookups, the gates and assembly.');
lines.push('');
lines.push('## Summary');
lines.push('');
lines.push('| Subject | Live questions | Eligible at the bar (factory / agent) | Can it start | Paper 1 | Paper 2 | Paper 3 | Structure match | Slowest end to end | Main shortfall |');
lines.push('|---|---:|---:|---|---|---|---|---|---:|---|');
for (const run of runs) {
  const p = run.papers;
  const main = p[0].status === 'refused' ? p[0].refusal.reason.replace(/_/g, ' ') : (p[0].notice.items[0] || 'none');
  const starts = p.filter((x) => x.status !== 'refused').length;
  const canStart = starts === 3 ? 'yes, 3 of 3' : starts ? `partly, ${starts} of 3` : 'no';
  const structure = p.map((x) => (x.status === 'refused' ? '-' : x.status === 'exact' ? 'exact' : `${x.deviations.length} dev`)).join(' / ');
  lines.push(`| ${run.subject} | ${run.live} | ${p[0].pool.eligible} (${run.agent.eligibleFactory} / ${run.agent.eligibleAgentScored}) | ${canStart} | ${label(p[0].status)} (${p[0].questions}) | ${label(p[1].status)} (${p[1].questions}) | ${label(p[2].status)} (${p[2].questions}) | ${structure} | ${ms(Math.max(...p.map((x) => x.timings.endToEndMs)))} | ${main.replace(/\|/g, '/')} |`);
}
lines.push('');
lines.push('"Eligible at the bar" counts questions that pass every gate at the current bar: score, signed and unchanged score record from both judges, both blind solvers on the stored key, answer-key guard, content gate, publication, no open dispute, no family hold, chapter in the 2026 syllabus, NTA quarantine, the structural gate (options fit the stem) and the wording gate (no rule stated, no option pointed at, no narrated order, no "the excerpt").');
lines.push('');
lines.push('"Structure match" is per paper: exact means the paper matches its blueprint in sections, types, chapters, difficulty and sets; "n dev" is the number of differences the student is told about; "-" is a refusal.');
lines.push('');
lines.push('## Cross-paper repeats and answer positions');
lines.push('');
lines.push('Paper 2 leaves out paper 1\'s questions and paper 3 leaves out papers 1 and 2 whenever the rest of the pool still serves a paper; otherwise the engine builds from the whole pool, uses earlier questions only where nothing new fits, and records why (`structure.crossPaper`). Keys are counted after the per-session option order (`data/nta_item_checks.js ntaServedRow`); "kept in place" counts questions whose options must keep their stored order (they name other options, or are error-spotting parts).');
lines.push('');
lines.push('| Subject | Paper 2 repeats of paper 1 | Paper 3 repeats of 1-2 | Fallback (reason) | Keys A/B/C/D, paper 1 | Options kept in place, paper 1 |');
lines.push('|---|---:|---:|---|---|---:|');
for (const run of runs) {
  const [p1, p2, p3] = run.papers;
  const fallback = [p2, p3].map((paper) => (paper.crossPaper?.fallback ? `paper ${paper.paper}: ${paper.crossPaper.reason.replace(/_/g, ' ')} (without them ${paper.crossPaper.withoutPrevious?.built ?? '-'} questions)` : null)).filter(Boolean).join('; ') || 'none';
  lines.push(`| ${run.subject} | ${p2.status === 'refused' ? '-' : p2.repeated} | ${p3.status === 'refused' ? '-' : p3.repeated} | ${fallback} | ${p1.status === 'refused' ? '-' : ['A', 'B', 'C', 'D'].map((letter) => p1.keys[letter]).join('/')} | ${p1.optionShuffle?.keptInPlace ?? '-'} |`);
}
lines.push('');
lines.push('## Agent pass');
lines.push('');
const agentTotals = runs.reduce((sum, run) => ({ judged: sum.judged + run.agent.judged, both: sum.both + run.agent.judgedByBoth, eligible: sum.eligible + run.agent.eligibleAgentScored, disputes: sum.disputes + run.agent.keyDisputes }), { judged: 0, both: 0, eligible: 0, disputes: 0 });
lines.push(`Agent scores come from \`data/nta_agent_scores/<subject>.json\` (merged by \`scripts/nta-pass-merge.mjs\` from two judges per question, rubric \`${NTA_AGENT_RUBRIC_VERSION}\`, \`docs/brain/NTA-AGENT-RUBRIC.md\`). The engine admits an agent-scored question only when the subject's table is calibrated, both judges are at or above the calibrated threshold, both blind answers equal the stored key, neither judge raised a blocking flag, and the question still has the scored content hash (\`data/nta_agent_scores.js\`). Factory evidence always takes precedence. Questions where a judge's blind answer differs from the key are listed in \`data/nta_key_disputes.json\` and kept out whatever their source. This run: ${agentTotals.judged} questions judged, ${agentTotals.both} by both judges, ${agentTotals.eligible} eligible through the agent source, ${agentTotals.disputes} key disputes.`);
if (!agentTotals.judged) lines.push('', 'No agent result has been merged yet (`scripts/nta-pass-merge.mjs` found no result files), and every table is pending calibration, so the agent source admits nothing and this run equals a factory-only run.');
lines.push('');
lines.push('| Subject | Calibration | Judged (both judges) | Pass row-free checks | Read for NTA | Eligible via agent | Key disputes | Difficulty corrections | Objective tags |');
lines.push('|---|---|---:|---:|---:|---:|---:|---:|---:|');
for (const run of runs) {
  const a = run.agent;
  const calibrationCell = a.calibration === 'calibrated' ? `calibrated, threshold ${a.threshold}` : a.calibration;
  lines.push(`| ${run.subject} | ${calibrationCell} | ${a.judged} (${a.judgedByBoth}) | ${a.admissibleBeforeRowChecks} | ${a.agentRowsRead} | ${a.eligibleAgentScored} | ${a.keyDisputes} | ${a.difficultyCorrections} | ${a.objectiveTags} |`);
}
lines.push('');
lines.push('## Review fixes: what each gate removed');
lines.push('');
lines.push('Questions at the bar that pass every earlier gate, and how many of them each review gate now keeps out (one question can fail several).');
lines.push('');
lines.push('| Subject | At the bar, old gates | Kept out by review gates | Reasons |');
lines.push('|---|---:|---:|---|');
for (const run of runs) {
  if (!run.atBarOldGates) continue;
  const reasons = Object.entries(run.reviewGateCounts).sort((a, b) => b[1] - a[1]).map(([reason, count]) => `${reason.replace(/_/g, ' ')} ${count}`).join('; ');
  lines.push(`| ${run.subject} | ${run.atBarOldGates} | ${run.keptOut} | ${reasons || 'none'} |`);
}
lines.push('');
lines.push('## Five fresh papers per subject');
lines.push('');
lines.push('No seen questions; seeds fresh-<subject>-1..5. "Text pairs" counts question pairs whose stem and options share at least 40% / 50% of their content words (the review measured these). "Repeated tags" counts learning objectives that appear twice. The engine refuses any paper its own duplicate check flags, so that column is a self-check.');
lines.push('');
lines.push('| Subject | Status | Text pairs >= 0.4 | Text pairs >= 0.5 | Repeated tags | Duplicates flagged | Numerical | Statement-based |');
lines.push('|---|---|---|---|---|---|---|---|');
for (const run of runs) {
  if (run.fresh.every((paper) => paper.status === 'refused')) continue;
  const cell = (key) => run.fresh.map((paper) => (paper.status === 'refused' ? '-' : paper[key])).join('/');
  lines.push(`| ${run.subject} | ${run.fresh.map((paper) => paper.status).join('/')} | ${cell('near04')} | ${cell('near05')} | ${cell('repeatedTags')} | ${cell('duplicates')} | ${cell('numerical')} | ${run.fresh.map((paper) => paper.types?.statement_based ?? '-').join('/')} |`);
}
lines.push('');
lines.push('## Pool read: full versus index');
lines.push('');
lines.push('The full read (used until supabase/migrations/20261013190000_nta_question_index.sql is applied and scripts/nta-index-build.mjs has run) carries each evidence record. The index path reads the signed slim index rows and the questions without evidence; this run times that question read directly (select only). "Cached start" is a second start of the same subject served from the in-memory pool cache (5 minutes).');
lines.push('');
lines.push('| Subject | Rows | Full payload | Slim payload | Slim read | Cached start end to end |');
lines.push('|---|---:|---:|---:|---:|---:|');
for (const run of runs) {
  if (!run.slimRead.rows) continue;
  lines.push(`| ${run.subject} | ${run.slimRead.rows} | ${(run.slimRead.fullBytes / 1e6).toFixed(2)} MB | ${(run.slimRead.bytes / 1e6).toFixed(2)} MB | ${ms(run.slimRead.ms)} | ${ms(run.cachedMs)} |`);
}
lines.push('');
lines.push('## Other score bars (same gates)');
lines.push('');
lines.push('| Subject | 7 | 7.5 | 8 | 8.5 | 9 |');
lines.push('|---|---|---|---|---|---|');
for (const run of runs) {
  const cell = (t) => `${run.thresholds[t].eligible} eligible, ${run.thresholds[t].status}${run.thresholds[t].status === 'refused' ? '' : ` (${run.thresholds[t].questions})`}`;
  lines.push(`| ${run.subject} | ${[7, 7.5, 8, 8.5, 9].map(cell).join(' | ')} |`);
}
lines.push('');
for (const run of runs) {
  lines.push(`## ${run.subject}`);
  lines.push('');
  const first = run.papers[0];
  const excluded = Object.entries(first.pool.excluded || {}).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([reason, count]) => `${reason} ${count}`).join(', ');
  lines.push(`Pool: ${run.live} live questions; ${first.pool.loaded} carry a score source; ${first.pool.scored} have a score; ${first.pool.eligible} pass every gate; ${first.pool.completeSets} complete passage or case sets. Main exclusions: ${excluded || 'none'}.`);
  lines.push('');
  for (const paper of run.papers) {
    lines.push(`### Paper ${paper.paper}: ${label(paper.status)}, ${paper.questions} questions`);
    lines.push('');
    const t = paper.timings;
    lines.push(`Timing: read ${ms(t.readMs)}, all lookups ${ms(t.loadMs)}, gates ${ms(t.gatesMs)}, assembly ${ms(t.assembleMs)}, end to end ${ms(t.endToEndMs)} (budget ${ms(t.budgetMs)}). Relaxation used: ${paper.structure.relaxation || 'none'}. Seen questions used: ${paper.structure.seenUsed}.`);
    lines.push('');
    if (paper.status === 'refused') {
      lines.push(`Student sees: "${paper.notice.summary}"`);
      for (const item of paper.notice.items) lines.push(`- ${item}`);
      lines.push('');
      continue;
    }
    lines.push(`Sections: ${paper.structure.sections.map((s) => `${s.id} ${s.questions}/${s.expected}`).join(', ')}. Sets: ${paper.structure.sets.length ? paper.structure.sets.map((s) => `${s.chapter} x${s.size} at Q${s.positions[0]}-${s.positions[1]}`).join('; ') : 'none'}.`);
    lines.push('');
    const bp = getNtaBlueprint(run.subject);
    lines.push(`Types (standalone, actual / blueprint min-max): ${Object.entries(bp.typeQuotas).map(([type, r]) => `${type} ${paper.structure.types[type] || 0}/${r.min}-${r.max}`).join(', ')}.`);
    lines.push('');
    lines.push(`Units: ${paper.structure.units.map((u) => `${u.section}:${u.unit} ${u.questions} (${u.range})`).join('; ')}.`);
    lines.push('');
    lines.push(`Difficulty: ${['easy', 'medium', 'hard'].map((key) => `${key} ${paper.structure.difficulty[key] || 0}`).join(', ')}. Numerical questions: ${paper.numerical}.`);
    lines.push('');
    lines.push(`Order: ${paper.order.map((o) => `${o.q}${o.set !== null ? `[S${o.set + 1}]` : ''}:${o.type.replace(/_.*/, '')}`).join(' ')}`);
    lines.push('');
    if (paper.notice.items.length) {
      lines.push('Student is told:');
      for (const item of paper.notice.items) lines.push(`- ${item}`);
      lines.push('');
    } else {
      lines.push('No differences from the blueprint.');
      lines.push('');
    }
  }
}
fs.mkdirSync('docs/brain/reports', { recursive: true });
fs.writeFileSync(outMd, `${lines.join('\n')}\n`);
fs.writeFileSync(outJson, JSON.stringify({ generatedAt: new Date().toISOString(), project: projectRef, engine: NTA_ENGINE_VERSION, minScore: NTA_MIN_SCORE, runs }, null, 1));
console.log(`wrote ${outMd} and ${outJson}`);
