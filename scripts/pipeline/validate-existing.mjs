#!/usr/bin/env node
/**
 * Question validation pipeline for the existing question bank.
 *
 * What it does
 * ------------
 *   1. Pulls live questions in pages from Supabase (skipping is_deleted=true).
 *   2. Sends each batch to Gemini with the canonical CUET 2026 syllabus as
 *      reference. Gets back per-question classification:
 *        - is_ncert_relevant       (bool)
 *        - is_cuet_syllabus        (bool)
 *        - topic                   (canonical chapter name from syllabus)
 *        - difficulty              (easy|medium|hard)
 *        - validation_confidence   (0..1)
 *        - reason                  (short string, why)
 *   3. Decides per question:
 *        confidence < REJECT_THRESHOLD       -> reject  (soft delete)
 *        REJECT <= confidence < FLAG         -> flag
 *        confidence >= FLAG_THRESHOLD        -> keep
 *      Rejections also fire when is_cuet_syllabus is false OR
 *      topic falls outside the canonical syllabus for the subject.
 *   4. For kept questions, optionally shuffles option order per question
 *      (no dataset-level rebalance) so the correct-answer position is not
 *      biased toward whatever the original author wrote (typically "A").
 *      Updates correct_answer to the new key holding the original text.
 *   5. In dry-run / sample modes, writes a JSON report and a markdown
 *      summary under scripts/pipeline/data/validation_reports/. In apply
 *      mode, ALSO writes the classification + shuffled options back to the
 *      DB and soft-deletes rejected rows.
 *
 * Usage
 * -----
 *   # Inspect 50 random questions, no DB writes:
 *   node --env-file=.env.local scripts/pipeline/validate-existing.mjs \
 *     --mode=sample --sample-size=50
 *
 *   # Full dry-run across all 7k+ questions, no DB writes:
 *   node --env-file=.env.local scripts/pipeline/validate-existing.mjs \
 *     --mode=dry-run
 *
 *   # Apply for real (writes to DB, including soft-delete + shuffle):
 *   node --env-file=.env.local scripts/pipeline/validate-existing.mjs \
 *     --mode=apply
 *
 *   # Constrain to one subject:
 *   node --env-file=.env.local scripts/pipeline/validate-existing.mjs \
 *     --mode=dry-run --subject=biology
 *
 *   # Skip the per-question shuffle on apply:
 *   node --env-file=.env.local scripts/pipeline/validate-existing.mjs \
 *     --mode=apply --no-shuffle
 *
 * Env (all optional, with safe defaults)
 * --------------------------------------
 *   GEMINI_API_KEY                (required — same as autonomous worker)
 *   SUPABASE_URL                  (or NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY     (required for writes; reads still work)
 *   VALIDATE_THRESHOLD_REJECT     default 0.6   (< this -> reject)
 *   VALIDATE_THRESHOLD_FLAG       default 0.75  (>= this -> keep)
 *   VALIDATE_BATCH_SIZE           default 8     (questions per LLM call)
 *   VALIDATE_CONCURRENCY          default 4     (parallel batches)
 *   VALIDATE_MODEL                default gemini-3-flash
 *
 * Re-runnability
 * --------------
 *   The script is idempotent. By default it skips rows where validated_at
 *   is set (incremental). Pass --revalidate to re-classify everything.
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CANONICAL_SYLLABUS,
  TOP_SUBJECTS,
  isValidCanonicalChapter,
  isValidTopSyllabusPair,
} from '../../data/canonical_syllabus.js';

// ---------------------------------------------------------------------------
// Config — env-driven, with conservative defaults.
// ---------------------------------------------------------------------------
const REJECT_THRESHOLD = Number(process.env.VALIDATE_THRESHOLD_REJECT ?? 0.6);
const FLAG_THRESHOLD   = Number(process.env.VALIDATE_THRESHOLD_FLAG   ?? 0.75);
const BATCH_SIZE       = Math.max(1, Number(process.env.VALIDATE_BATCH_SIZE  ?? 8));
const CONCURRENCY      = Math.max(1, Number(process.env.VALIDATE_CONCURRENCY ?? 4));
const MODEL_NAME       = process.env.VALIDATE_MODEL || 'gemini-3-flash';
const TOP_SUBJECT_SET  = new Set(TOP_SUBJECTS);
const REPORT_DIR       = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'data',
  'validation_reports',
);

// ---------------------------------------------------------------------------
// CLI args. Lightweight parser — no external dep.
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const out = {
    mode: 'sample',
    sampleSize: 50,
    subject: null,
    limit: null,
    shuffle: true,
    revalidate: false,
  };
  for (const arg of argv.slice(2)) {
    if (arg === '--no-shuffle') { out.shuffle = false; continue; }
    if (arg === '--revalidate') { out.revalidate = true; continue; }
    const m = arg.match(/^--([\w-]+)=(.+)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (k === 'mode')         out.mode = v;
    if (k === 'sample-size')  out.sampleSize = Math.max(1, Number(v));
    if (k === 'subject')      out.subject = v;
    if (k === 'limit')        out.limit = Math.max(1, Number(v));
  }
  if (!['sample', 'dry-run', 'apply'].includes(out.mode)) {
    throw new Error(`--mode must be sample | dry-run | apply (got "${out.mode}")`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Clients.
// ---------------------------------------------------------------------------
function makeSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function makeGemini() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is required.');
  const client = new GoogleGenerativeAI(key);
  return client.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: { responseMimeType: 'application/json', temperature: 0 },
  });
}

// ---------------------------------------------------------------------------
// Question fetcher. Streams pages so memory stays flat at ~1k rows.
// ---------------------------------------------------------------------------
async function* fetchQuestions(supabase, opts) {
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    let query = supabase
      .from('questions')
      .select('id, subject, chapter, body, question, options, correct_answer, correct_index, difficulty, validated_at, is_deleted')
      .in('subject', TOP_SUBJECTS)
      .eq('is_deleted', false)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (opts.subject) query = TOP_SUBJECT_SET.has(opts.subject)
      ? query.eq('subject', opts.subject)
      : query.eq('subject', '__skip_non_top_subject__');
    if (!opts.revalidate) query = query.is('validated_at', null);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return;
    for (const row of data) yield row;
    if (data.length < pageSize) return;
  }
}

async function fetchSampleQuestions(supabase, opts, sampleSize) {
  // Randomized sampling without a server-side RPC: pull a wide window then
  // shuffle in memory. OK for the 7k scale we're targeting.
  const rows = [];
  for await (const row of fetchQuestions(supabase, opts)) {
    rows.push(row);
    if (rows.length >= 5000) break;
  }
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }
  return rows.slice(0, sampleSize);
}

// ---------------------------------------------------------------------------
// Question normalization. The DB carries both legacy (`question`,
// `correct_index`, options-as-strings) and Phase-1 (`body`, `correct_answer`,
// options-as-{key,text}) shapes. Normalize to one shape before LLM.
// ---------------------------------------------------------------------------
function normalizeOptions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((o, i) => {
    const key = (o && typeof o === 'object' && o.key) ? String(o.key)
              : String.fromCharCode(65 + i);
    const text = (o && typeof o === 'object') ? String(o.text ?? '')
              : String(o ?? '');
    return { key, text };
  }).filter((o) => o.text.trim().length > 0);
}

function normalizeQuestion(row) {
  const body = String(row.body || row.question || '').trim();
  const options = normalizeOptions(row.options);
  let correctKey = (row.correct_answer || '').toString().trim().toUpperCase();
  if (!correctKey && Number.isInteger(row.correct_index) && options[row.correct_index]) {
    correctKey = options[row.correct_index].key;
  }
  return {
    id: row.id,
    subject: row.subject,
    chapter: row.chapter,
    body,
    options,
    correctKey,
    difficulty: row.difficulty || null,
  };
}

// ---------------------------------------------------------------------------
// Per-question shuffle. Keeps keys A/B/C/D in their canonical positions but
// reassigns option text. Re-points correct_answer to whichever key now
// carries the originally-correct text.
//
// Safe for historical attempts: attempts.details[].isCorrect is computed at
// submit time and stored, so changing future option order does not retro-
// invalidate any past attempt. In-flight tests (loaded but not submitted)
// are the only thing that breaks — run during a quiet window.
// ---------------------------------------------------------------------------
function shuffleOptions(question) {
  const original = question.options;
  if (original.length < 2) {
    return { options: original, correctKey: question.correctKey, changed: false };
  }
  const correct = original.find((o) => o.key === question.correctKey);
  if (!correct) {
    // Inconsistent question — leave alone, surface in the report.
    return { options: original, correctKey: question.correctKey, changed: false };
  }
  const indices = original.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const reordered = indices.map((origIdx, newIdx) => ({
    key: String.fromCharCode(65 + newIdx),  // A, B, C, D…
    text: original[origIdx].text,
  }));
  const newCorrectIdx = indices.findIndex((origIdx) => original[origIdx].key === correct.key);
  const newCorrectKey = String.fromCharCode(65 + newCorrectIdx);
  const sameOrder = indices.every((origIdx, newIdx) => origIdx === newIdx);
  return {
    options: reordered,
    correctKey: newCorrectKey,
    changed: !sameOrder,
  };
}

// ---------------------------------------------------------------------------
// LLM classifier. Sends a batch of N questions in a single Gemini call
// with the canonical syllabus for the relevant subject as reference.
// Returns a result array aligned by index to the input.
// ---------------------------------------------------------------------------
function syllabusContext(subjectId) {
  if (!TOP_SUBJECT_SET.has(subjectId)) return null;
  const subject = CANONICAL_SYLLABUS.find((s) => s.subject_id === subjectId);
  if (!subject) return null;
  return {
    subject_id: subject.subject_id,
    subject_name: subject.subject_name,
    units: subject.units.map((u) => ({
      unit: u.name,
      chapters: u.chapters.map((c) => c.name || c),
    })),
  };
}

function buildClassificationPrompt(batch, syllabus) {
  const compact = batch.map((q, i) => ({
    i,
    chapter: q.chapter,
    body: q.body.slice(0, 1200),
    options: q.options.map((o) => `${o.key}) ${o.text}`).slice(0, 6),
    correct: q.correctKey,
  }));

  const isGat = syllabus.subject_id === 'gat';

  return `You are a STRICT CUET 2026 question validator. CUET is a school-level entrance exam derived almost entirely from NCERT Class 11/12 textbooks. You are auditing existing questions; your job is to throw out anything that does not look like an actual CUET paper item.

WHAT CUET IS: A school-leaving entrance test. Questions are NCERT-familiarity checks. A student who has read their NCERT textbook carefully should be able to answer. CUET is NOT a test of deep reasoning, proof-writing, or graduate-level abstraction.

CANONICAL CUET 2026 SYLLABUS for subject "${syllabus.subject_name}" (these are the ONLY valid topics):
${JSON.stringify(syllabus.units, null, 0)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONCRETE EXAMPLES — THESE MUST BE REJECTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ABSTRACT MATHEMATICS / LINEAR ALGEBRA (college-level, not NCERT Class 12):
✗ "Let V be a vector space over field F. Which of the following is NOT a subspace of V?"
✗ "The determinant viewed as a multilinear alternating functional satisfies which property?"
✗ "Prove that the kernel of a linear transformation is a subspace."
✗ "Which of the following sets forms a group under matrix multiplication?"
→ CUET Class 12 Maths covers basic matrices/determinants operations only — NOT vector space theory, NOT abstract algebra, NOT functional analysis.

OVERLY THEORETICAL ASSERTION-REASON:
✗ "Assertion (A): Every continuous function on a closed interval attains its bounds. Reason (R): By the Heine-Borel theorem, every closed bounded set in ℝ is compact."
✗ "Assertion (A): The rank of a matrix equals the dimension of its column space. Reason (R): The rank-nullity theorem states that rank + nullity = number of columns."
→ CUET assertion-reason uses simple NCERT statements, NOT theorems named after mathematicians, NOT abstract definitions.

MULTI-STEP / PROOF-STYLE REASONING:
✗ "Using Cayley-Hamilton theorem, find A⁵ for the given matrix A."
✗ "Show that the function f(x) = x³ − 3x is strictly monotonic on [−∞, −1]."
✗ "Find the area bounded by the curve y = x² and the line y = x using integration. Then determine whether this area is greater or less than 0.5 sq. units."
→ CUET numericals are ONE-STEP: plug into formula, read from table, or recall a value.

JEE / COLLEGE-LEVEL QUESTIONS THAT FEEL WRONG FOR CUET:
✗ "A particle moves along x-axis with velocity v = 3t² − 12t + 9. Find acceleration when velocity is zero." (JEE-style kinematics with calculus)
✗ "Using the concept of activity series and electrode potential, explain why SHE is assigned zero potential." (too theoretical for CUET Chemistry MCQ)
✗ "In the context of B.Com accounting, discuss the implications of AS-9 Revenue Recognition on matching principle." (graduate-level standard, not NCERT)
✗ "Which of the following is a correct derivation of Fisher's Quantity Theory of Money using the equation of exchange?" (derivation-based, not CUET Economics)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONCRETE EXAMPLES — THESE ARE GOOD CUET QUESTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DIRECT NCERT FACTUAL / CONCEPTUAL MCQ:
✓ "Which of the following is NOT a characteristic of a company? (a) Perpetual succession (b) Common seal (c) Unlimited liability (d) Separate legal entity" — Correct: (c)
✓ "The main objective of the IMF is: (a) Providing long-term loans (b) Stabilising exchange rates (c) Promoting free trade (d) Controlling inflation"
✓ "Assertion (A): Stomata open during the day. Reason (R): Guard cells become turgid due to active transport of K⁺ ions." — simple, NCERT-phrased

SIMPLE ONE-STEP APPLICATION:
✓ "If the cost price is ₹800 and profit percentage is 25%, what is the selling price?" (one formula: SP = CP × 1.25)
✓ "The slope of the demand curve is negative because of the: (a) Law of demand (b) Engel's Law (c) Supply elasticity (d) Giffen paradox"
✓ "Identify the CORRECT journal entry for goods withdrawn by the owner for personal use." (direct NCERT accounting rule)

STRAIGHTFORWARD DEFINITIONS / BUSINESS & ACCOUNTS:
✓ "Trade discount is deducted from: (a) Invoice price (b) Cash price (c) Market price (d) Cost price"
✓ "Which type of account follows the rule 'Debit what comes in, Credit what goes out'?" — Real Account
✓ "According to NCERT, 'Management is the process of...' — which of the following completes the definition correctly?"

BASIC NUMERICAL WITH 1-STEP LOGIC:
✓ "Current ratio = 3:1, Current Liabilities = ₹40,000. Find Current Assets." (one multiplication)
✓ "If GDP = ₹500 cr and NDP = ₹480 cr, what is depreciation?" (one subtraction)
✓ "A lends ₹10,000 at 5% p.a. simple interest for 2 years. What is the total interest?" (SI = PRT/100)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REJECTION BIAS RULE — APPLY THIS ALWAYS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
If a question looks EVEN SLIGHTLY like the rejected examples above → REJECT IT.
When in doubt, reject. CUET is about NCERT familiarity, not deep reasoning.
A CUET student should answer from textbook memory + one simple step — nothing more.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STANDARD REJECT CRITERIA (as before)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Anything beyond NCERT Class 11/12 scope: graduate/MBA concepts, professional certifications, niche research findings, advanced derivations not in the textbook.
- Abstract or purely theoretical questions that read like a college viva, not a CUET MCQ.
- Numerical problems that require multi-step calculation a CUET candidate would not be expected to do in ~45 seconds.
- Direct textbook copy with no rewording (CUET tests understanding, not transcription).
- Weak distractors (one obviously right answer, three filler options) — this is a CUET pattern violation.
- Ambiguity, multiple defensible answers, or factually-wrong "correct" option.
- Assertion-Reason items that are overly intricate (more than two clauses per side, nested conditionals, or where the reason is unrelated to standard NCERT phrasing).
- Anything covering a subject area not in the syllabus block above.

ACCEPT only when the item is recognisably a CUET-style MCQ:
- Direct or lightly rephrased NCERT content${isGat ? ' (GAT subject is the only exception — general aptitude / current-affairs items are allowed without NCERT mapping)' : ''}.
- Recall, definition, single-step application, simple data-interpretation, standard match-the-following, basic assertion-reason with clean clauses.
- Four plausible options with close distractors that punish a careless reader.
- A clear single correct answer that aligns with NCERT.

For EACH question return STRICT JSON in an array, ONE entry per input index, with fields:
  i: integer (matches input index)
  is_ncert_relevant: boolean (true ONLY if the content is squarely in NCERT Class 11/12 for this subject${isGat ? '; for GAT this may be false and still acceptable' : ''})
  is_cuet_syllabus:  boolean (true ONLY if the topic appears in the syllabus above)
  is_typical_cuet_pattern: boolean (true ONLY if the item reads like a real CUET MCQ — see ACCEPT/REJECT rules above)
  abstract_beyond_ncert: boolean (true if too theoretical / college-level / outside NCERT scope)
  assertion_reason_complexity: "none" | "simple" | "complex" ("none" if not an A-R item; "complex" = reject)
  topic: string | null (the SINGLE best canonical chapter from the syllabus, spelled EXACTLY as above; null if out-of-syllabus)
  difficulty: "easy" | "medium" | "hard"
  validation_confidence: number 0..1 — strictness signal, NOT a safety net.
      0.90+  only if you are highly sure this is a clean, in-syllabus CUET-style item that matches the GOOD EXAMPLES above.
      0.75-0.90  in-syllabus and CUET-style but with minor concerns (light textbook copy, slightly weak distractor).
      0.60-0.75  borderline — uncertain about scope, pattern, or correctness. Will be flagged.
      <0.60  any clear failure (out of scope, wrong pattern, ambiguous, factually wrong). Will be rejected.

AUTOMATIC CONFIDENCE CAPS — apply these BEFORE setting any score:
  • Assertion-reason present (assertion_reason_complexity != "none") → cap confidence at 0.80 maximum. Even "simple" A-R items carry uncertainty; only raise above 0.80 if the clauses are verbatim NCERT sentences.
  • Any abstraction present (vector space, subspace, proof, functional, theorem named after a person, group/ring/field, basis/dimension in abstract sense, derivation) → set abstract_beyond_ncert=true, cap confidence at 0.55, set is_typical_cuet_pattern=false.
  • Multi-step numerical (more than one formula application required) → cap confidence at 0.65.
  • JEE/college exam style detected (calculus applied to physics/chemistry problems, graduate accounting standards, econometrics) → cap confidence at 0.50.

  out_of_syllabus_reason: string | null (one short phrase when out-of-scope; e.g. "MBA-level concept", "graduate research finding", "not in NCERT", "abstract algebra not in Class 12 NCERT")
  pattern_violation_reason: string | null (one short phrase when is_typical_cuet_pattern=false; e.g. "multi-step heavy numerical", "nested assertion-reason", "weak distractors", "direct textbook copy", "proof-style question", "JEE-style derivation")
  notes: string | null (other quality issues; null if none)

Hard rules:
- DO NOT default to keep. If anything about the item gives you pause — scope, phrasing, distractor quality, NCERT fit — lower the confidence and explain why.
- Confidence reflects HOW SURE YOU ARE THE ITEM IS A REAL CUET QUESTION, not how safe it is to keep. An item you are unsure about gets <0.75 even if it is "probably fine".
- ${isGat ? 'For GAT (subject_id=gat), is_ncert_relevant may be false; do not penalise that. Still enforce CUET pattern rules.' : 'For non-GAT subjects, is_ncert_relevant=false should drive confidence below 0.6.'}
- "topic" MUST be one of the canonical chapter strings exactly. If the item is in-syllabus but you cannot find an exact chapter match, pick the closest and drop confidence to 0.65–0.75 (this will flag for review).
- Return ONLY the JSON array. No prose, no markdown fence.

QUESTIONS:
${JSON.stringify(compact)}`;
}

function safeParseArray(text) {
  if (!text) return null;
  let trimmed = text.trim();
  // Strip ```json fences if the model adds them despite instructions.
  if (trimmed.startsWith('```')) {
    trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  }
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function classifyBatch(model, batch) {
  const subjectId = batch[0].subject;
  const syllabus = syllabusContext(subjectId);
  if (!syllabus) {
    // Subject not in canonical syllabus at all — every question is OOS.
    return batch.map((_, i) => ({
      i,
      is_ncert_relevant: false,
      is_cuet_syllabus: false,
      topic: null,
      difficulty: 'medium',
      validation_confidence: 0.99,
      out_of_syllabus_reason: `subject "${subjectId}" is not in the CUET 2026 canonical syllabus`,
      notes: null,
    }));
  }

  const prompt = buildClassificationPrompt(batch, syllabus);
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await model.generateContent(prompt);
      const text = result?.response?.text?.() ?? '';
      const parsed = safeParseArray(text);
      if (!parsed || parsed.length !== batch.length) {
        throw new Error(`bad classifier response: got ${parsed?.length ?? 'null'} entries, expected ${batch.length}`);
      }
      // Re-align by index in case the model reordered.
      const byIndex = new Map(parsed.map((p) => [p.i, p]));
      return batch.map((_, i) => byIndex.get(i) ?? null);
    } catch (err) {
      lastError = err;
      const backoff = 800 * (attempt + 1) + Math.random() * 400;
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  console.warn(`[classify] batch failed after retries: ${lastError?.message}`);
  return batch.map(() => null);
}

// ---------------------------------------------------------------------------
// Decision. Maps a classifier result to a kept|flagged|rejected bucket and
// surfaces the reason. Conservative: when classifier failed, always flag.
// ---------------------------------------------------------------------------
// GAT (general aptitude / current affairs) is the one CUET subject where
// NCERT relevance is not required — everything else must be NCERT-rooted.
const NCERT_EXEMPT_SUBJECTS = new Set(['gat']);

function decide(question, classification) {
  if (!classification) {
    return { bucket: 'flagged', reason: 'classifier_failed', confidence: null };
  }
  const c = Number(classification.validation_confidence);
  const conf = Number.isFinite(c) ? Math.max(0, Math.min(1, c)) : 0.4;

  // Hard rejects — explicit failure signals from the classifier override
  // the confidence number entirely. These mirror the strict prompt rules.
  if (classification.is_cuet_syllabus === false) {
    return {
      bucket: 'rejected',
      reason: classification.out_of_syllabus_reason || 'out_of_syllabus',
      confidence: conf,
    };
  }
  if (classification.is_typical_cuet_pattern === false) {
    return {
      bucket: 'rejected',
      reason: classification.pattern_violation_reason || 'not_typical_cuet_pattern',
      confidence: conf,
    };
  }
  if (classification.abstract_beyond_ncert === true) {
    return {
      bucket: 'rejected',
      reason: 'abstract_beyond_ncert',
      confidence: conf,
    };
  }
  if (classification.assertion_reason_complexity === 'complex') {
    return {
      bucket: 'rejected',
      reason: 'overly_complex_assertion_reason',
      confidence: conf,
    };
  }
  if (
    classification.is_ncert_relevant === false
    && !NCERT_EXEMPT_SUBJECTS.has(question.subject)
  ) {
    return {
      bucket: 'rejected',
      reason: 'non_ncert_content',
      confidence: conf,
    };
  }

  // Topic mismatch (LLM picked a topic not in the canonical syllabus) is
  // usually a spelling drift, not a quality failure — flag, don't reject.
  if (classification.topic && !isValidCanonicalChapter(question.subject, classification.topic)) {
    return {
      bucket: 'flagged',
      reason: `topic "${classification.topic}" not in canonical syllabus`,
      confidence: conf,
    };
  }

  // Confidence-based fallthrough. Strictness lives in the prompt: any
  // doubt the classifier had about scope/pattern/correctness already
  // landed here as a sub-0.75 number.
  if (conf < REJECT_THRESHOLD) {
    return { bucket: 'rejected', reason: 'low_confidence', confidence: conf };
  }
  if (conf < FLAG_THRESHOLD) {
    return { bucket: 'flagged', reason: 'borderline_confidence', confidence: conf };
  }
  return { bucket: 'kept', reason: null, confidence: conf };
}

// ---------------------------------------------------------------------------
// DB writes. Only invoked in --mode=apply.
// ---------------------------------------------------------------------------
async function applyDecision(supabase, question, classification, decision, opts) {
  const updates = {
    validated_at: new Date().toISOString(),
  };
  if (classification) {
    updates.is_ncert_relevant     = classification.is_ncert_relevant ?? null;
    updates.is_cuet_syllabus      = classification.is_cuet_syllabus ?? null;
    updates.validation_confidence = decision.confidence;
    updates.topic                 = classification.topic ?? null;
    if (classification.difficulty) updates.difficulty = classification.difficulty;
  }
  if (decision.bucket === 'rejected') {
    updates.is_deleted = true;
    updates.verification_state = 'rejected';
  } else if (decision.bucket === 'flagged') {
    updates.verification_state = 'flagged';
  } else {
    updates.verification_state = 'verified';
  }

  // Per-question shuffle (only on kept rows).
  if (decision.bucket === 'kept' && opts.shuffle && question.options.length >= 2) {
    const shuffled = shuffleOptions(question);
    if (shuffled.changed) {
      updates.options = shuffled.options;
      updates.correct_answer = shuffled.correctKey;
      // Keep correct_index in sync if present in legacy schema.
      const idx = shuffled.options.findIndex((o) => o.key === shuffled.correctKey);
      if (idx >= 0) updates.correct_index = idx;
    }
  }

  const { error } = await supabase.from('questions').update(updates).eq('id', question.id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Concurrency primitive — simple bounded parallel runner.
// ---------------------------------------------------------------------------
async function parallelMap(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// ---------------------------------------------------------------------------
// Report builder. Writes both a machine-readable JSON dump and a markdown
// summary that's easy to skim — kept/flagged/rejected counts, top reasons,
// and 10 examples from each bucket showing before/after where applicable.
// ---------------------------------------------------------------------------
function summarize(rows) {
  const buckets = { kept: 0, flagged: 0, rejected: 0 };
  const reasons = new Map();
  const topicHist = new Map();
  let oosCount = 0;
  for (const r of rows) {
    buckets[r.decision.bucket] += 1;
    if (r.decision.reason) {
      reasons.set(r.decision.reason, (reasons.get(r.decision.reason) || 0) + 1);
    }
    if (r.classification?.is_cuet_syllabus === false) oosCount += 1;
    const topic = r.classification?.topic;
    if (topic) topicHist.set(topic, (topicHist.get(topic) || 0) + 1);
  }
  const total = rows.length || 1;
  return {
    total: rows.length,
    buckets,
    pct: {
      kept:     +(buckets.kept     / total * 100).toFixed(1),
      flagged:  +(buckets.flagged  / total * 100).toFixed(1),
      rejected: +(buckets.rejected / total * 100).toFixed(1),
    },
    out_of_syllabus_count: oosCount,
    top_reject_flag_reasons: [...reasons.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([reason, count]) => ({ reason, count })),
    top_topics: [...topicHist.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 15)
      .map(([topic, count]) => ({ topic, count })),
  };
}

function pickExamples(rows, bucket, n) {
  const filtered = rows.filter((r) => r.decision.bucket === bucket);
  // Spread examples across subjects when we can.
  const seen = new Map();
  const picked = [];
  for (const r of filtered) {
    const k = r.question.subject;
    const c = seen.get(k) || 0;
    if (c < Math.max(1, Math.ceil(n / 6))) {
      picked.push(r);
      seen.set(k, c + 1);
      if (picked.length >= n) break;
    }
  }
  for (const r of filtered) {
    if (picked.length >= n) break;
    if (!picked.includes(r)) picked.push(r);
  }
  return picked.slice(0, n);
}

function fmtQuestion(r) {
  const q = r.question;
  const opts = q.options.map((o) => `    ${o.key === q.correctKey ? '✔' : ' '} ${o.key}) ${o.text}`).join('\n');
  const cls = r.classification;
  const tag = `[${q.subject} :: ${q.chapter}]`;
  const verdict = `${r.decision.bucket.toUpperCase()} (conf=${r.decision.confidence ?? 'n/a'}${r.decision.reason ? `, ${r.decision.reason}` : ''})`;
  const llm = cls
    ? [
        `topic="${cls.topic ?? '—'}"`,
        `ncert=${cls.is_ncert_relevant}`,
        `cuet=${cls.is_cuet_syllabus}`,
        `pattern=${cls.is_typical_cuet_pattern}`,
        `abstract=${cls.abstract_beyond_ncert}`,
        `ar=${cls.assertion_reason_complexity ?? 'none'}`,
        `diff=${cls.difficulty}`,
        cls.pattern_violation_reason ? `pattern_issue="${cls.pattern_violation_reason}"` : null,
        cls.notes ? `notes="${cls.notes}"` : null,
      ].filter(Boolean).join(', ')
    : 'classifier returned no result';
  return `### ${tag} — ${verdict}\n**id**: \`${q.id}\`\n**body**: ${q.body}\n${opts}\n**llm**: ${llm}\n`;
}

async function writeReport(rows, opts) {
  await fs.mkdir(REPORT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const tag = `${opts.mode}${opts.subject ? `-${opts.subject}` : ''}-${stamp}`;
  const jsonPath = path.join(REPORT_DIR, `${tag}.json`);
  const mdPath   = path.join(REPORT_DIR, `${tag}.md`);

  const summary = summarize(rows);
  await fs.writeFile(jsonPath, JSON.stringify({
    summary,
    config: {
      reject_below: REJECT_THRESHOLD,
      flag_below: FLAG_THRESHOLD,
      model: MODEL_NAME,
      mode: opts.mode,
      subject: opts.subject,
    },
    rows: rows.map((r) => ({
      id: r.question.id,
      subject: r.question.subject,
      chapter: r.question.chapter,
      bucket: r.decision.bucket,
      reason: r.decision.reason,
      confidence: r.decision.confidence,
      classification: r.classification,
      shuffled: r.shuffled || null,
    })),
  }, null, 2));

  const md = [];
  md.push(`# Question validation report\n`);
  md.push(`- mode: \`${opts.mode}\`${opts.subject ? `, subject: \`${opts.subject}\`` : ''}`);
  md.push(`- model: \`${MODEL_NAME}\`, reject<${REJECT_THRESHOLD}, flag<${FLAG_THRESHOLD}`);
  md.push(`- total: **${summary.total}**`);
  md.push(`- kept: **${summary.buckets.kept}** (${summary.pct.kept}%)`);
  md.push(`- flagged: **${summary.buckets.flagged}** (${summary.pct.flagged}%)`);
  md.push(`- rejected: **${summary.buckets.rejected}** (${summary.pct.rejected}%)`);
  md.push(`- out-of-syllabus: **${summary.out_of_syllabus_count}**\n`);

  md.push(`## Top reject / flag reasons\n`);
  for (const r of summary.top_reject_flag_reasons) md.push(`- \`${r.reason}\` × ${r.count}`);
  md.push('');

  md.push(`## Top topics (kept + flagged)\n`);
  for (const t of summary.top_topics) md.push(`- ${t.topic} × ${t.count}`);
  md.push('');

  for (const bucket of ['rejected', 'flagged', 'kept']) {
    const examples = pickExamples(rows, bucket, 10);
    md.push(`\n## Examples — ${bucket} (${examples.length})\n`);
    for (const r of examples) md.push(fmtQuestion(r));
  }

  await fs.writeFile(mdPath, md.join('\n'));
  return { jsonPath, mdPath, summary };
}

// ---------------------------------------------------------------------------
// Main.
// ---------------------------------------------------------------------------
async function main() {
  const opts = parseArgs(process.argv);
  console.log(`[validate] mode=${opts.mode} subject=${opts.subject || 'all'} sample=${opts.mode === 'sample' ? opts.sampleSize : 'n/a'} batch=${BATCH_SIZE} concurrency=${CONCURRENCY} model=${MODEL_NAME}`);
  console.log(`[validate] thresholds: reject<${REJECT_THRESHOLD}, flag<${FLAG_THRESHOLD}`);

  const supabase = makeSupabase();
  const model    = makeGemini();

  // 1. Pull questions.
  console.log('[validate] fetching questions…');
  let raw;
  if (opts.mode === 'sample') {
    raw = await fetchSampleQuestions(supabase, opts, opts.sampleSize);
  } else {
    raw = [];
    for await (const row of fetchQuestions(supabase, opts)) {
      raw.push(row);
      if (opts.limit && raw.length >= opts.limit) break;
    }
  }
  console.log(`[validate] pulled ${raw.length} questions`);
  if (raw.length === 0) {
    console.log('[validate] nothing to do.');
    return;
  }

  // 2. Normalize + group into batches by subject (so syllabus context fits one prompt).
  const normalized = raw
    .map(normalizeQuestion)
    .filter((question) => isValidTopSyllabusPair(question.subject, question.chapter));
  const bySubject = new Map();
  for (const q of normalized) {
    if (!bySubject.has(q.subject)) bySubject.set(q.subject, []);
    bySubject.get(q.subject).push(q);
  }
  const batches = [];
  for (const [, list] of bySubject) {
    for (let i = 0; i < list.length; i += BATCH_SIZE) {
      batches.push(list.slice(i, i + BATCH_SIZE));
    }
  }
  console.log(`[validate] ${batches.length} batches across ${bySubject.size} subjects`);

  // 3. Classify in parallel.
  let done = 0;
  const tick = setInterval(() => {
    process.stdout.write(`\r[validate] classified ${done}/${batches.length} batches`);
  }, 1500);

  const classified = await parallelMap(batches, CONCURRENCY, async (batch) => {
    const out = await classifyBatch(model, batch);
    done += 1;
    return { batch, out };
  });
  clearInterval(tick);
  process.stdout.write('\n');

  // 4. Decide + (optionally) apply.
  const rows = [];
  for (const { batch, out } of classified) {
    for (let i = 0; i < batch.length; i += 1) {
      const question = batch[i];
      const classification = out[i];
      const decision = decide(question, classification);
      let shuffled = null;
      if (decision.bucket === 'kept' && opts.shuffle && question.options.length >= 2) {
        const s = shuffleOptions(question);
        if (s.changed) shuffled = { newCorrectKey: s.correctKey };
      }
      rows.push({ question, classification, decision, shuffled });
    }
  }

  if (opts.mode === 'apply') {
    console.log('[validate] applying updates to DB…');
    let written = 0;
    for (const row of rows) {
      try {
        await applyDecision(supabase, row.question, row.classification, row.decision, opts);
        written += 1;
      } catch (err) {
        console.warn(`[validate] write failed for ${row.question.id}: ${err.message}`);
      }
    }
    console.log(`[validate] wrote ${written}/${rows.length} rows`);
  }

  // 5. Report.
  const { jsonPath, mdPath, summary } = await writeReport(rows, opts);
  console.log('');
  console.log(`[validate] kept ${summary.buckets.kept} (${summary.pct.kept}%) · flagged ${summary.buckets.flagged} (${summary.pct.flagged}%) · rejected ${summary.buckets.rejected} (${summary.pct.rejected}%)`);
  console.log(`[validate] out-of-syllabus: ${summary.out_of_syllabus_count}`);
  console.log(`[validate] report:    ${mdPath}`);
  console.log(`[validate] raw json:  ${jsonPath}`);
  if (opts.mode !== 'apply') {
    console.log('[validate] dry mode — no DB writes performed. Re-run with --mode=apply when ready.');
  }
}

main().catch((err) => {
  console.error('[validate] fatal:', err);
  process.exit(1);
});
