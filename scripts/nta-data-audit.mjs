// NTA data audit. READ-ONLY: select queries only, with the service role, against the project in
// .env.local (production). It never inserts, updates, deletes or creates a session and calls no model.
//
//   node --use-system-ca scripts/nta-data-audit.mjs <out.json>
//
// Writes one JSON file with, per supported CUET subject: live inventory, score coverage and thresholds,
// unscored counts, question-type mix, passage-set sizes, syllabus coverage, difficulty labels and a
// sequential "N papers without repeats" simulation with the real NTA selector under four pool rules.
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv(path = '.env.local') {
  return Object.fromEntries(
    fs.readFileSync(path, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }),
  );
}
const env = loadEnv();
// Only the evidence signing key is copied into the process; .env.local also sets MOCK_AI=true, which would
// make every question ineligible, so it is deliberately not loaded.
process.env.CUET_EVIDENCE_SIGNING_KEY = env.CUET_EVIDENCE_SIGNING_KEY || '';
process.env.MOCK_AI = 'false';

const { CUET_PUBLIC_ALLOWED_SUBJECTS, toInternalSubjectId } = await import('../data/cuet_controls.js');
const { getCanonicalSubject } = await import('../data/canonical_syllabus.js');
const { publicationEligibility, eligibilitySnapshot } = await import('../data/evidence_registry.js');
const { verifyAnswerIntegrity } = await import('../data/answer_integrity.js');
const { selectNtaQuestionSet, qualityGateNtaQuestion } = await import('../data/nta_question_selector.js');
const { excludeRepeatedFamilies } = await import('../data/mock_question_selector.js');
const { legacyPracticeVisible } = await import('../data/practice_availability.js');

const out = process.argv[2];
if (!out) throw new Error('usage: node scripts/nta-data-audit.mjs <out.json>');
const sb = createClient(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const timings = {};
async function fetchLive() {
  const rows = [];
  for (let o = 0; ; o += 200) {
    const { data, error } = await sb.from('questions').select('*').eq('status', 'live').eq('is_deleted', false).order('id').range(o, o + 199);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 200) break;
  }
  return rows;
}
let t0 = Date.now();
const live = await fetchLive();
timings.fetchAllLiveRowsMs = Date.now() - t0;
const { data: groups, error: groupError } = await sb.from('passage_groups').select('id, subject, chapter, title, passage_text, passage_type, status, discoverable');
if (groupError) throw groupError;
const groupById = new Map(groups.filter((g) => g.status === 'live' && g.discoverable !== false).map((g) => [g.id, g]));
for (const row of live) {
  const g = groupById.get(row.passage_group_id);
  if (g) Object.assign(row, { passage_text: row.passage_text || g.passage_text, passage_id: row.passage_id || g.id, passage_type: row.passage_type || g.passage_type });
}
const { data: nonLive } = await sb.from('questions').select('id,subject,status,is_deleted,evidence').neq('status', 'live');

// ---------- derived fields ----------
// Two independent 0-10 integer judge scores sit in every factory evidence record: Luna (checks.exam_fit, the value
// the other Luna stages repeat) and Gemini (checks.independent_evaluation). Publication required both >= 7.
const judge = (row, check) => { const s = row.evidence?.record?.checks?.[check]?.item_quality_score; return s !== null && s !== undefined && Number.isFinite(Number(s)) ? Number(s) : null; };
const lunaOf = (row) => judge(row, 'exam_fit');
const geminiOf = (row) => judge(row, 'independent_evaluation');
// The audit's working score is the mean of the two judges (half points, so the owner's 8.5 exists); min and each judge are reported alongside.
const scoreOf = (row) => { const l = lunaOf(row), g = geminiOf(row); if (l === null && g === null) return null; if (l === null) return g; if (g === null) return l; return (l + g) / 2; };
const minOf = (row) => { const l = lunaOf(row), g = geminiOf(row); return l === null || g === null ? null : Math.min(l, g); };
const craftOf = (row) => {
  const c = row.evidence?.record?.checks?.exam_fit?.craft_scores;
  const v = c ? Object.values(c).map(Number).filter(Number.isFinite) : [];
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const tagType = (row) => (row.tags || []).find((t) => String(t).startsWith('question_type:'))?.slice(14) || '';
const isPassage = (row) => Boolean(row.passage_group_id || row.passage_id || (row.passage_text && String(row.passage_text).trim()));

function classify(row) {
  if (isPassage(row)) return { cls: 'passage_set', via: 'column' };
  const t = String(row.question_type || tagType(row) || '').toLowerCase();
  const via = row.question_type ? 'column' : tagType(row) ? 'tag' : 'heuristic';
  const body = String(row.body || row.question || '');
  const byType = (x) => {
    if (/assertion/.test(x)) return 'assertion_reason';
    if (/match/.test(x)) return 'match_the_following';
    if (/statement/.test(x)) return 'statement_based';
    if (/sequence|jumble|ordering/.test(x)) return 'sequence_ordering';
    if (/numer|calcul/.test(x)) return 'numerical';
    if (/case/.test(x)) return 'case_based';
    if (/vocab|synonym|antonym|word|meaning|idiom/.test(x)) return 'vocabulary_language';
    if (/inference|central|tone|purpose|detail|reading|literary/.test(x)) return 'reading_type_standalone';
    return null;
  };
  if (t) return { cls: byType(t) || 'single_mcq_direct_or_application', via };
  if (/\bassertion\b[\s\S]{0,500}\breason\b/i.test(body)) return { cls: 'assertion_reason', via };
  if (/\bmatch\b[\s\S]{0,80}(list|column|following|items)|\blist[- ]?i\b|\bcolumn[- ]?(i|a)\b/i.test(body)) return { cls: 'match_the_following', via };
  if (/consider the following statements|\bstatement[s]?\s*\(?(i{1,3}|[1-3]|a|b)\)?\s*[:.)]/i.test(body)) return { cls: 'statement_based', via };
  if (/\barrange\b|correct (chronological )?(order|sequence)|chronological order/i.test(body)) return { cls: 'sequence_ordering', via };
  return { cls: 'single_mcq_direct_or_application', via };
}

const norm = (s) => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 260);
const count = (arr, f) => { const m = {}; for (const x of arr) { const k = f(x); m[k] = (m[k] || 0) + 1; } return m; };
const THRESH = [7, 7.5, 8, 8.5, 9];
const atLeast = (vals, t) => vals.filter((v) => v >= t).length;

const snapshot = eligibilitySnapshot();
function hashUnit(id) { let h = 2166136261; for (const c of String(id)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; }
const setKey = (r) => r.passage_group_id || r.passage_id || norm(r.passage_text).slice(0, 80);
function setSizeHistogram(rows) {
  const by = new Map();
  for (const r of rows.filter(isPassage)) by.set(setKey(r), (by.get(setKey(r)) || 0) + 1);
  return count([...by.values()], (n) => n);
}
const ID = (s) => toInternalSubjectId(s);

function simulate(subjectId, pool, maxPapers = 10) {
  let remaining = pool.slice();
  const papers = [];
  for (let i = 0; i < maxPapers; i += 1) {
    const start = Date.now();
    const { selectedRows, diagnostics } = selectNtaQuestionSet(excludeRepeatedFamilies(remaining), 50, { subjectId, seed: `audit:${subjectId}:${i}` });
    const ms = Date.now() - start;
    const sets = new Set(selectedRows.filter((r) => r.passage_group_id).map((r) => r.passage_group_id));
    papers.push({
      n: selectedRows.length, ms,
      chaptersCovered: new Set(selectedRows.map((r) => r.chapter)).size,
      passageSets: sets.size,
      longestPassageRun: diagnostics.pattern?.longestPassageRun ?? null,
      shortfall: diagnostics.pattern?.shortfall ?? null,
      topRejects: (diagnostics.poolStats?.topRejectReasons || []).slice(0, 3),
    });
    // A paper counts only if it has 50 questions AND meets the repo's own pattern (no shortfall flag).
    if (selectedRows.length < 50 || diagnostics.pattern?.shortfall) break;
    const used = new Set(selectedRows.map((r) => r.id));
    remaining = remaining.filter((r) => !used.has(r.id));
  }
  const full = papers.filter((p) => p.n === 50 && !p.shortfall).length;
  return { poolSize: pool.length, fullPapers: full, cappedAt: maxPapers, lastPaperQuestions: papers.at(-1)?.n ?? 0, firstPaperMs: papers[0]?.ms ?? 0, papers };
}

const result = { generatedAt: new Date().toISOString(), project: 'production (.env.local)', liveRowsTotal: live.length, timings, subjects: {} };
result.signingKeyPresent = Boolean(process.env.CUET_EVIDENCE_SIGNING_KEY);

for (const publicSubject of CUET_PUBLIC_ALLOWED_SUBJECTS) {
  const subject = ID(publicSubject);
  const rows = live.filter((r) => r.subject === subject);
  const canonical = getCanonicalSubject(subject);
  const chaptersCanon = (canonical?.units || []).flatMap((u) => u.chapters.map((c) => ({ unit: u.unit_name, chapter: c })));
  const canonSet = new Set(chaptersCanon.map((c) => c.chapter));

  const scored = rows.filter((r) => scoreOf(r) !== null);
  const scoreVals = scored.map(scoreOf);
  const craftVals = scored.map(craftOf).filter((v) => v !== null);

  // Pools as the production code would see them.
  const tp = Date.now();
  const readable = rows.filter((r) => String(r.body ?? r.question ?? '').trim() && Number(r.score ?? 0) >= -2 && verifyAnswerIntegrity(r).accepted);
  const failedIntegrity = rows.filter((r) => !readable.includes(r));
  const eligibleByRow = new Map();
  for (const r of readable) eligibleByRow.set(r.id, publicationEligibility(r, snapshot));
  const eligible = readable.filter((r) => eligibleByRow.get(r.id).eligible);
  const eligibilityMs = Date.now() - tp;
  const evidenceRows = rows.filter((r) => r.evidence);
  const failReasons = count(evidenceRows.filter((r) => !eligibleByRow.get(r.id)?.eligible), (r) => (eligibleByRow.get(r.id)?.reasons || ['not_readable']).join('+'));
  const ceilingPool = readable.filter((r) => eligibleByRow.get(r.id).eligible || legacyPracticeVisible(r));

  const e8 = eligible.filter((r) => scoreOf(r) >= 8);
  const e9 = eligible.filter((r) => scoreOf(r) >= 8.5);

  // type mix (live) and for scored
  const typed = rows.map((r) => ({ r, ...classify(r) }));
  const mix = count(typed, (x) => x.cls);
  const mixVia = count(typed, (x) => x.via);
  const mixScored = count(typed.filter((x) => scoreOf(x.r) !== null), (x) => x.cls);
  const rawTypes = count(rows.filter((r) => r.question_type || tagType(r)), (r) => r.question_type || tagType(r));

  // passage sets
  const bySet = new Map();
  for (const r of rows.filter(isPassage)) { const k = r.passage_group_id || r.passage_id || norm(r.passage_text).slice(0, 80); bySet.set(k, [...(bySet.get(k) || []), r]); }
  const setSizes = [...bySet.values()].map((v) => v.length).sort((a, b) => a - b);
  const bySetScored = new Map();
  for (const r of eligible.filter(isPassage)) { const k = r.passage_group_id || r.passage_id || norm(r.passage_text).slice(0, 80); bySetScored.set(k, [...(bySetScored.get(k) || []), r]); }
  const setSizesEligible = [...bySetScored.values()].map((v) => v.length).sort((a, b) => a - b);

  // chapters
  const chapterRows = chaptersCanon.map(({ unit, chapter }) => {
    const cr = rows.filter((r) => r.chapter === chapter);
    const ce = eligible.filter((r) => r.chapter === chapter);
    return { unit, chapter, live: cr.length, readable: cr.filter((r) => readable.includes(r)).length, scoredEligible: ce.length, scoredGte8: ce.filter((r) => scoreOf(r) >= 8).length, scoredGte8_5: ce.filter((r) => scoreOf(r) >= 8.5).length };
  });
  const nonCanonical = count(rows.filter((r) => !canonSet.has(r.chapter)), (r) => r.chapter || '(none)');

  // duplicates
  const stems = count(rows, (r) => norm(`${r.body || r.question} ${(Array.isArray(r.options) ? r.options : []).map((o) => o?.text ?? o).join(' ')}`));
  const dupExtra = Object.values(stems).reduce((a, n) => a + (n > 1 ? n - 1 : 0), 0);
  const families = new Set(eligible.map((r) => r.family_id).filter(Boolean));

  const gateResults = ceilingPool.map((r) => qualityGateNtaQuestion(r, { subjectId: subject }));
  const ntaGate = {
    passed: gateResults.filter((g) => g.accepted).length,
    rejected: gateResults.filter((g) => !g.accepted).length,
    rejectReasons: count(gateResults.filter((g) => !g.accepted).flatMap((g) => g.reasons), (x) => x),
    passedWithValidSyllabusChapter: gateResults.filter((g) => g.accepted && g.normalized.chapterValid).length,
  };
  const eligibleGateResults = eligible.map((r) => qualityGateNtaQuestion(r, { subjectId: subject }));
  const eligibleGate = { passed: eligibleGateResults.filter((g) => g.accepted).length, rejectReasons: count(eligibleGateResults.filter((g) => !g.accepted).flatMap((g) => g.reasons), (x) => x) };
  const unreadableDetail = failedIntegrity.map((r) => { const v = verifyAnswerIntegrity(r); return Object.keys(v).length ? { id: r.id, accepted: v.accepted, reasons: v.reasons, keys: Object.keys(v) } : { id: r.id }; }).slice(0, 5);
  const authenticPattern = {
    note: 'CUET UG 2024 Booklet A (registered in data/source_registry.json): English = 4 passages x 6 questions + 26 verbal; Accountancy and Business Studies = 2 case sets x 5 (q41-50); Economics = 2 case sets x 5 (q28-37).',
    ceilingPassageSetSizes: setSizeHistogram(ceilingPool),
    eligiblePassageSetSizes: setSizeHistogram(eligible),
  };
  const sims = {};
  const simStart = Date.now();
  sims.A_current_rule_evidence_pool = simulate(subject, eligible);
  sims.B_mean_gte8 = e8.length === eligible.length ? { ...sims.A_current_rule_evidence_pool, note: 'identical pool' } : simulate(subject, e8);
  sims.C_mean_gte8_5 = simulate(subject, e9);
  sims.D_ceiling_all_readable_live_if_all_scored_ok = simulate(subject, ceilingPool, 10);
  // Sensitivity: if only a share of the unscored bank reaches the threshold (the factory's own live yield at
  // score >= 8 is 61%: 404 of 666 records), a deterministic subsample of the ceiling pool.
  sims.E_ceiling_60pct_of_unscored_plus_scored_gte8 = simulate(subject, ceilingPool.filter((r) => scoreOf(r) !== null ? scoreOf(r) >= 8 : hashUnit(r.id) < 0.6));
  sims.F_ceiling_40pct_of_unscored_plus_scored_gte8 = simulate(subject, ceilingPool.filter((r) => scoreOf(r) !== null ? scoreOf(r) >= 8 : hashUnit(r.id) < 0.4));
  const simMs = Date.now() - simStart;

  const evStatus = count(nonLive.filter((r) => r.subject === subject && r.evidence), (r) => r.status);
  result.subjects[publicSubject] = {
    internalId: subject,
    live: rows.length,
    liveWithEvidenceRecord: evidenceRows.length,
    liveWithQualityScoreColumnAbove0: rows.filter((r) => Number(r.quality_score) > 0).length,
    liveWithAiScore: rows.filter((r) => r.ai_score !== null && r.ai_score !== undefined).length,
    liveWithValidationConfidence: rows.filter((r) => r.validation_confidence !== null && r.validation_confidence !== undefined).length,
    scored: scored.length,
    unscored: rows.length - scored.length,
    unscoredCreatedMonths: count(rows.filter((r) => scoreOf(r) === null), (r) => String(r.created_at).slice(0, 7)),
    scoreDistribution: count(scoreVals, (v) => v),
    thresholds: Object.fromEntries(THRESH.map((t) => [`gte_${t}`, atLeast(scoreVals, t)])),
    strictlyAbove8: scoreVals.filter((v) => v > 8).length,
    judges: {
      luna: { dist: count(scored.map(lunaOf), (v) => v), ...Object.fromEntries(THRESH.map((t) => [`gte_${t}`, atLeast(scored.map(lunaOf).filter((v) => v !== null), t)])) },
      gemini: { dist: count(scored.map(geminiOf), (v) => v), ...Object.fromEntries(THRESH.map((t) => [`gte_${t}`, atLeast(scored.map(geminiOf).filter((v) => v !== null), t)])) },
      min: { dist: count(scored.map(minOf), (v) => v), ...Object.fromEntries(THRESH.map((t) => [`gte_${t}`, atLeast(scored.map(minOf).filter((v) => v !== null), t)])) },
      exactAgreement: scored.filter((r) => lunaOf(r) === geminiOf(r)).length,
    },
    craftMeanThresholds: Object.fromEntries([7.5, 8, 8.5].map((t) => [`gte_${t}`, atLeast(craftVals, t)])),
    expiresAt: { min: scored.map((r) => r.evidence.record.expires_at).sort()[0] || null, max: scored.map((r) => r.evidence.record.expires_at).sort().at(-1) || null },
    unreadable: { total: failedIntegrity.length, reasons: count(failedIntegrity, (r) => verifyAnswerIntegrity(r).reasons?.slice(0, 2).join('+') || 'unknown') },
    readable: readable.length,
    eligibleNowEvidence: eligible.length,
    eligibleScoredGte8: e8.length,
    eligibleScoredGte8_5: e9.length,
    eligibleMinJudgeGte8: eligible.filter((r) => minOf(r) >= 8).length,
    evidenceRowsNotEligible: failReasons,
    ceilingPool: ceilingPool.length,
    nonLiveWithEvidenceByStatus: evStatus,
    typeMix: { liveByClass: mix, classifiedVia: mixVia, scoredByClass: mixScored, rawTypeValues: rawTypes },
    passageSets: { liveSets: setSizes.length, liveSetSizes: count(setSizes, (n) => n), liveQuestionsInSets: setSizes.reduce((a, b) => a + b, 0), eligibleSets: setSizesEligible.length, eligibleSetSizes: count(setSizesEligible, (n) => n) },
    difficulty: { live: count(rows, (r) => r.difficulty), eligible: count(eligible, (r) => r.difficulty), difficultyWeightTagPresent: rows.filter((r) => r.difficulty_weight != null).length },
    syllabus: { canonicalChapters: chaptersCanon.length, canonicalUnits: (canonical?.units || []).length, chapters: chapterRows, liveNotInCanonicalSyllabus: nonCanonical, chaptersWithLive: chapterRows.filter((c) => c.live > 0).length, chaptersWithEligible: chapterRows.filter((c) => c.scoredEligible > 0).length },
    duplicates: { liveExtraCopiesByStemAndOptions: dupExtra, distinctFamiliesInEligible: families.size },
    ntaGate,
    eligibleGate,
    unreadableDetail,
    authenticPattern,
    simulation: sims,
    timingMs: { eligibility: eligibilityMs, simulations: simMs },
  };
  console.error(`${publicSubject}: live ${rows.length} scored ${scored.length} eligible ${eligible.length} ceiling ${ceilingPool.length} | papers A=${sims.A_current_rule_evidence_pool.fullPapers} D=${sims.D_ceiling_all_readable_live_if_all_scored_ok.fullPapers}`);
}
fs.writeFileSync(out, JSON.stringify(result, null, 1));
console.error('written', out);
