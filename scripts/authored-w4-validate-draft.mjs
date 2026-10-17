#!/usr/bin/env node
// Checks one wave-4 author draft against its job in the plan and against the NTA engine's content gates. OFFLINE: reads files, writes nothing.
//
//   node scripts/authored-w4-validate-draft.mjs --job=w4-phys-01 --file=<draft json> [--plan=docs/brain/reports/authored-w4/wave4-plan-2026-10-17.json]
//
// An author runs this on the file it wrote and fixes the file until it prints "OK". Errors stop the draft; warnings are for the author to look at.
// It reuses the engine's own gates (data/nta_item_checks.js, data/answer_integrity.js, data/nta_question_selector.js) on the exact row the publisher would write
// (scripts/lib/authored-wave.mjs toQuestionRow), so a question that passes here is not refused for layout, wording, answer-guard or listed-order reasons later.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { verifyAnswerIntegrity } from '../data/answer_integrity.js';
import { classifyNtaType, getNtaBlueprint } from '../data/nta_engine.js';
import {
  conflictReason, corruptedWordingReasons, isNumericalItem, itemFeatures, listedOrderKeyReasons, shuffleBlockers, structuralReasons, wordingReasons,
} from '../data/nta_item_checks.js';
import { qualityGateNtaQuestion } from '../data/nta_question_selector.js';
import { toQuestionRow } from './lib/authored-wave.mjs';

export const SOURCE = 'claude-authored-2026-10-17-w4';
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
const KEYS = ['A', 'B', 'C', 'D'];
const TYPES = ['single_mcq', 'statement_based', 'sequence_ordering', 'match_the_following', 'assertion_reason'];
const FIELDS = ['id', 'subject', 'unit', 'chapter', 'type', 'stem', 'options', 'correct_key', 'explanation', 'passage_text', 'set_id', 'difficulty_label', 'ncert_ref', 'source'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const words = (value) => String(value || '').trim().split(/\s+/).filter(Boolean).length;
const norm = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const MARKUP = /\\\(|\\\)|\\\[|\\\]|\\frac|\\sqrt|\\times|\\pi|\$\$|\{\\|<\/?[a-z][^>]*>|\*\*|^#+\s|\\text|\\mathrm/i;
const HEDGE = /\b(?:assume that|for this question|in this item|the stated (?:condition|rule|principle)|is stipulated|as defined here|used to mean|the excerpt|options? [A-D]\s*(?:-|to)\s*[A-D])\b/i;
const ORPHAN = /\b(?:according to|based on|as per|as stated in|as given in)\b/i;
// Topics outside the 2026 syllabus lists: a hit is a warning for the author to check, never proof.
const WATCH = {
  physics: [/logic gate|\bNAND\b|\bNOR gate|\bOR gate|\bAND gate|transistor|\bZener\b|\bLED\b|photodiode|solar cell|communication system|modulation|half-life|radioactiv|decay constant|\balpha decay|\bbeta decay/i, 'outside the 2026 Physics syllabus lists (Communication Systems, logic gates, transistors, radioactivity are not listed)'],
  chemistry: [/unit cell|close packing|packing efficiency|adsorption|colloid|emulsion|polymer|nylon|bakelite|detergent|antacid|analgesic|antiseptic|metallurgy|smelting|froth flotation|interhalogen|\bXeF|oxoacid|Haber process|contact process/i, 'outside the 2026 Chemistry syllabus (Solid State, Surface Chemistry, Isolation of Elements, p-Block, Polymers, Chemistry in Everyday Life are excluded)'],
  biology: [/binary fission|\bbudding\b|vegetative propagation|eutrophication|ozone|greenhouse|acid rain|solid waste|radioactive waste|photosynthesis|cell cycle|mitosis|meiosis/i, 'possibly outside the 2026 Biology syllabus (Reproduction in Organisms and Environmental Issues are excluded; Class 11 content is not examined)'],
  mathematics: [/trigonometric (?:equation|identity)|conic|hyperbola|permutation|combination|binomial theorem|complex number|\bsequence and series\b/i, 'Class 11 content is not in the 2026 Mathematics syllabus'],
  general_test: [/\blatest\b|\brecent(?:ly)?\b|\bcurrently\b|\bnewly\b|\bthis year\b|\bat present\b|\bas of today\b/i, 'time-relative wording goes stale; write the year instead'],
};

export function validate(draft, job, { earlier = [], file = '' } = {}) {
  const errors = [];
  const warnings = [];
  const err = (i, message) => errors.push(`${i === null ? 'file' : `#${i + 1}`}: ${message}`);
  const warn = (i, message) => warnings.push(`${i === null ? 'file' : `#${i + 1}`}: ${message}`);
  if (!draft || Array.isArray(draft) || typeof draft !== 'object') return { errors: ['the file must be a JSON object { batch, subject, questions: [...] }'], warnings, summary: null };
  if (draft.batch !== job.job) err(null, `batch must be "${job.job}", got ${JSON.stringify(draft.batch)}`);
  if (draft.subject !== job.subject) err(null, `subject must be "${job.subject}", got ${JSON.stringify(draft.subject)}`);
  const questions = Array.isArray(draft.questions) ? draft.questions : null;
  if (!questions) return { errors: [...errors, 'questions must be an array'], warnings, summary: null };
  if (questions.length !== job.count) err(null, `${questions.length} questions, the job needs exactly ${job.count}`);

  const bp = getNtaBlueprint(job.subject);
  const allowedTypes = bp ? Object.keys(bp.typeQuotas) : undefined;
  const chapterPlan = new Map(job.chapters.map((c) => [c.chapter, c]));
  const counts = { chapter: {}, type: {}, difficulty: {}, key: { A: 0, B: 0, C: 0, D: 0 } };
  const bump = (bucket, key) => { counts[bucket][key] = (counts[bucket][key] || 0) + 1; };
  const ids = new Set();
  const rows = [];
  const longestKey = { n: 0, of: 0 };
  let numerical = 0;
  const setChildren = new Map();
  const chapterOrder = [];
  const passageRange = (job.sets || []).map((s) => ({ chapter: s.chapter, ...(() => { const m = String(s.words).match(/(\d+)\D+(\d+)/); return { min: Number(m[1]), max: Number(m[2]) }; })() }));

  questions.forEach((q, i) => {
    for (const field of FIELDS) if (!(field in q)) err(i, `missing field ${field}`);
    for (const field of Object.keys(q)) if (!FIELDS.includes(field)) err(i, `unexpected field ${field} (the draft shape has exactly: ${FIELDS.join(', ')})`);
    if (!UUID.test(String(q.id))) err(i, 'id is not a UUID (use crypto.randomUUID())');
    if (ids.has(q.id)) err(i, 'duplicate id'); ids.add(q.id);
    if (q.source !== SOURCE) err(i, `source must be ${SOURCE}`);
    if (q.subject !== job.subject) err(i, `subject must be ${job.subject}`);
    const plan = chapterPlan.get(q.chapter);
    if (!plan) err(i, `chapter "${q.chapter}" is not one of this job's chapters`);
    else {
      bump('chapter', q.chapter);
      if (q.unit !== plan.unit) err(i, `unit must be "${plan.unit}" for chapter "${q.chapter}", got "${q.unit}"`);
      if (!chapterOrder.length || chapterOrder[chapterOrder.length - 1] !== q.chapter) chapterOrder.push(q.chapter);
    }
    if (!TYPES.includes(q.type)) err(i, `type "${q.type}" is not one of ${TYPES.join(', ')}`); else bump('type', q.type);
    if (!['easy', 'medium', 'hard'].includes(q.difficulty_label)) err(i, 'difficulty_label must be easy, medium or hard'); else bump('difficulty', q.difficulty_label);
    if (!KEYS.includes(q.correct_key)) err(i, 'correct_key must be A, B, C or D'); else counts.key[q.correct_key] += 1;
    const options = Array.isArray(q.options) ? q.options : [];
    if (options.length !== 4 || options.some((o, k) => o?.key !== KEYS[k] || !norm(o?.text))) err(i, 'options must be four objects { key, text } keyed A to D in order, none empty');
    for (const o of options) {
      if (norm(o?.text).length > 240) err(i, `option ${o.key} is over 240 characters`);
      if (/^(?:option\s*)?[a-d]$/i.test(norm(o?.text))) err(i, `option ${o.key} is a bare letter`);
      if (/^(?:\([A-D]\)|[A-D][.):])\s/.test(norm(o?.text)) && q.type !== 'match_the_following' && q.type !== 'sequence_ordering') err(i, `option ${o.key} starts with a letter label of its own ("${norm(o.text).slice(0, 12)}"); the option text carries no label`);
      if (MARKUP.test(String(o?.text))) err(i, `option ${o.key} has raw markup or LaTeX`);
      if (/\b(?:all of the above|none of the above|both [a-d] and [a-d]|any of these)\b/i.test(norm(o?.text))) err(i, `option ${o.key} refers to other options`);
    }
    if (MARKUP.test(String(q.stem)) || MARKUP.test(String(q.explanation)) || MARKUP.test(String(q.passage_text))) err(i, 'raw markup or LaTeX in the stem, explanation or passage');
    if (HEDGE.test(String(q.stem)) || HEDGE.test(String(q.explanation))) err(i, 'hedge wording or a pointer to options or an excerpt (assume that, for this question, the stated rule, the excerpt, options B-D)');
    if (norm(q.explanation).length < 70) err(i, 'explanation is too short to teach anything (say why the key is right and why the strongest wrong option is wrong)');
    if (/\b(?:option|choice)\s*\(?[A-D]\)?\b|\b(?:the answer|the correct (?:answer|option)) is\s*\(?[A-D]\)?\b/i.test(String(q.explanation)) && q.type !== 'assertion_reason') err(i, 'the explanation names an option letter; explain with the content, not the letter');
    if (!norm(q.ncert_ref) || norm(q.ncert_ref).length < 12) err(i, 'ncert_ref is missing or too vague (book, chapter or syllabus unit, and the idea)');
    if (q.type === 'assertion_reason') {
      const expected = ['Both A and R are true, and R correctly explains A', 'Both A and R are true, but R does not explain A', 'A is true, but R is false', 'A is false, but R is true'];
      options.forEach((o, k) => { if (norm(o?.text).replace(/[.,]/g, '').toLowerCase() !== expected[k].replace(/[.,]/g, '').toLowerCase()) err(i, `assertion_reason option ${KEYS[k]} must be the standard wording: "${expected[k]}"`); });
      if (!/Assertion\s*(?:\(A\))?\s*:/i.test(String(q.stem)) || !/Reason\s*(?:\(R\))?\s*:/i.test(String(q.stem))) err(i, 'assertion_reason stem needs "Assertion:" and "Reason:" lines');
    }
    const watch = WATCH[job.subject];
    if (watch && watch[0].test(`${q.stem} ${options.map((o) => o?.text).join(' ')}`)) warn(i, `check the syllabus: ${watch[1]}`);

    // longest-option giveaway (single_mcq only: layout items have fixed-length options)
    if (q.type === 'single_mcq' && options.length === 4 && KEYS.includes(q.correct_key)) {
      const lengths = options.map((o) => norm(o.text).length);
      const keyLength = lengths[KEYS.indexOf(q.correct_key)];
      longestKey.of += 1;
      if (lengths.filter((l) => l === Math.max(...lengths)).length === 1 && keyLength === Math.max(...lengths)) longestKey.n += 1;
    }

    const passageText = q.passage_text === null || q.passage_text === undefined ? '' : String(q.passage_text);
    const inSet = Boolean(norm(q.set_id));
    if (inSet !== Boolean(norm(passageText))) err(i, 'set_id and passage_text must both be set (set child) or both null (standalone)');
    if (inSet) setChildren.set(q.set_id, [...(setChildren.get(q.set_id) || []), { q, i }]);
    if (!inSet && ORPHAN.test(String(q.stem))) err(i, 'a standalone stem may not say "according to", "based on" or "as per" (the engine reads it as a missing passage); ask the question directly');
    if (!inSet && /\bthe (?:passage|paragraph|excerpt|extract|author|narrator)\b/i.test(String(q.stem))) err(i, 'a standalone stem points at a passage or an author that is not there');

    // the engine's own gates on the exact row the publisher writes
    if (options.length === 4 && KEYS.includes(q.correct_key) && TYPES.includes(q.type)) {
      const row = toQuestionRow(q, { groupId: inSet ? `pg_${String(q.set_id)}` : null, orderIndex: inSet ? (setChildren.get(q.set_id).length) : null });
      if (inSet) { row.passage_group_id = `pg_${q.set_id}`; row.passage_id = `pg_${q.set_id}`; row.passage_text = passageText; row.order_index = setChildren.get(q.set_id).length; row.question_type = 'case_based'; }
      rows.push({ i, row, q });
      const integrity = verifyAnswerIntegrity(row);
      for (const reason of integrity.reasons) err(i, `answer guard: ${reason}`);
      const content = qualityGateNtaQuestion(row, { subjectId: row.subject });
      for (const reason of content.reasons || []) err(i, `content gate: ${reason}`);
      const heuristic = classifyNtaType({ ...row, passage_text: null, passage_group_id: null, passage_id: null }, job.subject, allowedTypes);
      if (q.type !== 'single_mcq' && heuristic !== q.type) err(i, `the engine reads this ${q.type} item as ${heuristic} (the stem or options do not look like the type: label the items (A) to (D), print List-I and List-II, and give options in the type's form)`);
      if (q.type === 'single_mcq' && heuristic !== 'single_mcq') err(i, `declared single_mcq, but the engine reads it as ${heuristic} (options or stem look like that type)`);
      const typeForGates = q.type;
      for (const reason of structuralReasons(row, typeForGates)) err(i, `layout: ${reason}`);
      for (const reason of wordingReasons(row, typeForGates)) err(i, `wording: ${reason}`);
      for (const reason of corruptedWordingReasons(row)) err(i, `wording: ${reason}`);
      for (const reason of listedOrderKeyReasons(row, typeForGates)) err(i, `giveaway: ${reason} (the keyed option may not be the listed order)`);
      for (const reason of shuffleBlockers(row)) warn(i, `option order is pinned (${reason}); fine for a layout item, avoid it for a plain one`);
      if (isNumericalItem(row)) numerical += 1;
    }
  });

  // exact counts
  for (const c of job.chapters) if ((counts.chapter[c.chapter] || 0) !== c.n) err(null, `chapter "${c.chapter}": ${counts.chapter[c.chapter] || 0} questions, the job needs ${c.n}`);
  for (const [type, n] of Object.entries(job.types)) if ((counts.type[type] || 0) !== n) err(null, `type ${type}: ${counts.type[type] || 0}, the job needs ${n}`);
  for (const [level, n] of Object.entries(job.difficulty)) if ((counts.difficulty[level] || 0) !== n) err(null, `difficulty ${level}: ${counts.difficulty[level] || 0}, the job needs ${n}`);
  for (const key of KEYS) if (counts.key[key] !== job.keys[key]) err(null, `key ${key}: ${counts.key[key]}, the job needs ${job.keys[key]}`);
  const wantedOrder = job.chapters.map((c) => c.chapter);
  if (JSON.stringify(chapterOrder) !== JSON.stringify(wantedOrder)) err(null, `chapters must appear together in this order: ${wantedOrder.join(' | ')}; found ${chapterOrder.join(' | ')}`);
  if (numerical < job.numericalMin) warn(null, `${numerical} numerical items detected (stem with figures and three or more figure options), the job asks for at least ${job.numericalMin}`);
  const longestLimit = Math.ceil(longestKey.of / 4);
  if (longestKey.n > longestLimit) err(null, `the key is the single longest option in ${longestKey.n} of ${longestKey.of} single_mcq items (limit ${longestLimit}); shorten the key or lengthen the distractors`);
  // key runs
  const keySequence = questions.map((q) => q.correct_key).join('');
  if (/(.)\1\1/.test(keySequence)) warn(null, `three equal key letters in a row (${keySequence})`);
  if (/(ABCD){2}|(DCBA){2}/.test(keySequence)) err(null, `the key letters repeat a cycle (${keySequence})`);

  // sets
  for (const s of job.sets || []) {
    const children = [...setChildren.entries()].filter(([, list]) => list[0].q.chapter === s.chapter);
    if (children.length !== 1) err(null, `chapter "${s.chapter}" needs exactly one set, found ${children.length}`);
    for (const [setId, list] of children) {
      if (setId !== `${job.job}-set-1`) err(null, `set_id must be "${job.job}-set-1", got "${setId}"`);
      if (list.length !== s.size) err(null, `set ${setId} has ${list.length} children, the job needs ${s.size}`);
      if (new Set(list.map((c) => c.q.passage_text)).size !== 1) err(null, `set ${setId}: the children carry different passage_text`);
      const idx = list.map((c) => c.i);
      if (idx.some((v, k) => k && v !== idx[k - 1] + 1)) err(null, `set ${setId}: the children are not consecutive in the file`);
      const range = passageRange.find((r) => r.chapter === s.chapter);
      const w = words(list[0].q.passage_text);
      if (range && (w < range.min || w > range.max)) err(null, `set ${setId}: passage is ${w} words, the job asks for ${range.min} to ${range.max}`);
      const setTypes = list.map((c) => c.q.type).sort().join(',');
      const wantTypes = s.itemTypes === '5 single_mcq' ? Array(5).fill('single_mcq').sort().join(',') : [...Array(4).fill('single_mcq'), 'statement_based'].sort().join(',');
      if (setTypes !== wantTypes) err(null, `set ${setId}: item types ${setTypes}, the job needs ${s.itemTypes}`);
    }
  }
  if (!(job.sets || []).length) for (const [setId] of setChildren) err(null, `set ${setId}: this job has no set`);

  // duplicates inside the draft and against waves 1-3 (same subject)
  const feats = rows.map(({ row }) => itemFeatures(row));
  const HARD = new Set(['same_stem', 'near_duplicate_stem', 'near_duplicate_text', 'near_duplicate_stem_chars']);
  const SOFT = new Set(['same_key_answer', 'same_figures', 'same_concept', 'same_concept_words']);
  for (let a = 0; a < rows.length; a += 1) for (let b = a + 1; b < rows.length; b += 1) {
    const sameSet = Boolean(rows[a].q.set_id && rows[a].q.set_id === rows[b].q.set_id);
    const reason = conflictReason(feats[a], feats[b], { sameSet });
    if (!reason) continue;
    if (HARD.has(reason) || reason === 'same_answer_in_set') err(rows[a].i, `${reason} with #${rows[b].i + 1}`);
    else if (SOFT.has(reason)) warn(rows[a].i, `${reason} with #${rows[b].i + 1} (two questions on one idea; change one)`);
  }
  const earlierSame = earlier.filter((c) => c.subject === job.subject).map((c) => ({ c, f: itemFeatures(toQuestionRow(c)) }));
  rows.forEach(({ i }, k) => {
    for (const { c, f } of earlierSame) {
      const reason = conflictReason(feats[k], f, { sameSet: false });
      if (!reason) continue;
      if (HARD.has(reason)) err(i, `${reason} with an earlier authored question ${c.id.slice(0, 8)}`);
      else if (SOFT.has(reason)) warn(i, `${reason} with an earlier authored question ${c.id.slice(0, 8)}: "${norm(c.stem).slice(0, 70)}"`);
    }
  });

  const summary = { file, job: job.job, questions: questions.length, chapters: counts.chapter, types: counts.type, difficulty: counts.difficulty, keys: counts.key, keyIsLongest: `${longestKey.n}/${longestKey.of}`, numericalDetected: numerical, errors: errors.length, warnings: warnings.length };
  return { errors, warnings, summary };
}

function loadEarlier() {
  const files = ['docs/brain/reports/authored/wave1-candidates-final-2026-10-14.json', 'docs/brain/reports/authored-w2/wave2-candidates-final-2026-10-14.json', 'docs/brain/reports/authored-w3/wave3-candidates-final-2026-10-17.json'];
  return files.filter((f) => fs.existsSync(f)).flatMap((f) => readJson(f));
}

export function main(argv = process.argv.slice(2)) {
  const args = Object.fromEntries(argv.map((a) => a.match(/^--([\w-]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]]));
  const planFile = args.plan || 'docs/brain/reports/authored-w4/wave4-plan-2026-10-17.json';
  const job = readJson(planFile).jobs.find((j) => j.job === args.job);
  if (!job) { console.error(`unknown job ${args.job}`); process.exit(2); }
  if (!args.file) { console.error('--file=<draft json> is required'); process.exit(2); }
  let draft;
  try { draft = readJson(args.file); } catch (error) { console.error(`cannot read ${args.file}: ${error.message}`); process.exit(1); }
  const { errors, warnings, summary } = validate(draft, job, { earlier: loadEarlier(), file: args.file });
  for (const w of warnings) console.log(`WARN  ${w}`);
  for (const e of errors) console.log(`ERROR ${e}`);
  console.log(JSON.stringify(summary));
  console.log(errors.length ? `FAILED: ${errors.length} errors, ${warnings.length} warnings` : `OK ${job.job}: ${summary.questions} questions, ${warnings.length} warnings`);
  process.exit(errors.length ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
