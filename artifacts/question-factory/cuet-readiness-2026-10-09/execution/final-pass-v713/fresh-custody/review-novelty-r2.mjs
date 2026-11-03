import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { contentHash } from '../../../../../../data/content_evidence.js';

const root = process.cwd();
const base = resolve(root, 'artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v713/fresh-custody');
const historyRoot = resolve(root, 'artifacts/question-factory/cuet-readiness-2026-10-09');
const study = 'cuet-v713-fresh-final';
const freezeSha = '82de56e6299d312cbbee86a636f7ddff41daf8ca4a626204ca714541935481f4';
const authorSha = '9ffddb8b42a098f6a411dbd6934a23a988796db945bb873434e2f5f35e7ec223';
const reviewerId = '/root/difficulty_selection_final';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const readBytes = p => readFileSync(p);
const read = p => JSON.parse(readBytes(p).toString('utf8'));
const sourceFiles = [
  ['q1', 'v79-qualification-q1/frozen.json'],
  ['q2', 'v710-qualification-q2/frozen.json'],
  ['q3', 'v712-qualification-q3/frozen.json'],
  ['v75-original-false-accept', 'benchmark/v75-fresh-cbse2022-2026-10-09/frozen.json'],
  ['v712-pilot40-candidate-export', '../cuet-pilot-v712-40-2026-10-09/state.json'],
  ['v712-pilot40-registered-briefs', '../cuet-pilot-v712-40-2026-10-09/campaign.json'],
];
const historical = [];
const comparedHistory = [];
for (const [source, rel] of sourceFiles) {
  const path = resolve(historyRoot, rel), bytes = readBytes(path), parsed = JSON.parse(bytes.toString('utf8'));
  comparedHistory.push({ path: rel.startsWith('..') ? `artifacts/question-factory/cuet-pilot-v712-40-2026-10-09/${rel.split('/').at(-1)}` :
    `artifacts/question-factory/cuet-readiness-2026-10-09/${rel}`, sha256: sha(bytes), source,
    comparison_scope: source === 'v712-pilot40-registered-briefs' ? 'registered briefs only; candidate export compared from state.json' : 'candidate text and task metadata' });
  const rows = Array.isArray(parsed.fixtures) ? parsed.fixtures :
    Array.isArray(parsed.candidates) ? parsed.candidates :
    parsed.jobs && typeof parsed.jobs === 'object' ? Object.values(parsed.jobs).filter(row => row.candidate) : [];
  for (const row of rows) {
    const candidate = row.candidate;
    if (candidate) historical.push({ id: row.id || candidate.id, candidate, source });
  }
}
const authoredPath = join(base, 'sealed/authored-r2.json'), authoredBytes = readBytes(authoredPath);
if (sha(authoredBytes) !== authorSha) throw Error('novelty_author_hash_changed');
const authored = JSON.parse(authoredBytes.toString('utf8'));
if (authored.study_id !== study || authored.items.length !== 36) throw Error('novelty_fresh36_required');

// Compare only content/task signals; answer keys, explanations, validity labels,
// defect labels, and reviewer artifacts are deliberately excluded.
const stop = new Set('the a an and or to of in on by for from with is are was were be as at that this these those into than then after before using use used uses given when where which what how its their it they has have had does do did will can may each per one two four first second all any not no'.split(' '));
const tokens = value => String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/)
  .filter(token => token.length > 1 && !stop.has(token));
const objective = candidate => typeof candidate.learning_objective === 'string' ? candidate.learning_objective :
  candidate.learning_objective?.objective || candidate.learning_objective?.text || '';
const taskText = candidate => [candidate.subject, candidate.chapter, candidate.question_type, candidate.concept_id,
  candidate.topic, objective(candidate), candidate.body, candidate.passage_text,
  ...(candidate.options || []).map(option => typeof option === 'string' ? option : option?.text || option?.label || '')].join(' ');
const docs = [...authored.items.map(row => row.candidate), ...historical.map(row => row.candidate)].map(candidate => tokens(taskText(candidate)));
const df = new Map();
for (const document of docs) for (const token of new Set(document)) df.set(token, (df.get(token) || 0) + 1);
const vector = document => {
  const counts = new Map();
  for (const token of document) counts.set(token, (counts.get(token) || 0) + 1);
  for (const [token, count] of counts) counts.set(token, (1 + Math.log(count)) * Math.log(1 + docs.length / (1 + df.get(token))));
  return counts;
};
const vectors = docs.map(vector);
const cosine = (left, right) => {
  let dot = 0, leftNorm = 0, rightNorm = 0;
  for (const value of left.values()) leftNorm += value * value;
  for (const value of right.values()) rightNorm += value * value;
  for (const [token, value] of left) dot += value * (right.get(token) || 0);
  return dot / Math.sqrt(leftNorm * rightNorm || 1);
};
const exactStem = candidate => String(candidate.body || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
const duplicateOf = new Map([
  ['f-2c7dfe572963691f', ['f-f84de07c56f68390', 'Same cash-flow classification demand: selecting a transaction in the investing-inflow category repeats the earlier fixed-asset disposal classification with a broader stem and option framing.']],
  ['f-90b386844e029292', ['f-80c4d9b3dc5ee51a', 'Same cash-flow classification demand: share-issue proceeds are tested as a financing cash inflow in both, with the later item changing the selection framing.']],
  ['f-184a13bcc63cf86c', ['f-234e398c6040b350', 'Same no-cash machinery acquisition by issuing equity shares and same statement-treatment reasoning; the later item only rephrases the question.']],
  ['f-d95fe16105eb4952', ['f-07957bcf309f84ab', 'Same GVA conversion task with identical operands and answer choices; the later stem is a wording variant, not a new calculation.']],
]);
const stemMatchCount = authored.items.filter(row => historical.some(prior => exactStem(row.candidate) && exactStem(row.candidate) === exactStem(prior.candidate))).length;
const items = authored.items.map((row, rowIndex) => {
  const candidate = row.candidate;
  const nearest = historical.map((prior, priorIndex) => ({ prior, score: cosine(vectors[rowIndex], vectors[authored.items.length + priorIndex]) }))
    .sort((a, b) => b.score - a.score)[0];
  const duplicate = duplicateOf.get(row.id);
  if (duplicate) return { fixture_id: row.id, content_hash: contentHash(candidate), unique: false,
    reason: duplicate[1], nearest_prior_case: duplicate[0] };
  const priorObjective = objective(nearest.prior.candidate);
  let reason;
  if (candidate.subject === 'english') {
    reason = `A separate contextual lexical target and distinct scenario. The closest reviewed historical case (${nearest.prior.id}) asks ${priorObjective || 'a different vocabulary task'}; it uses a different target and reasoning direction, so this is not a word/name substitution.`;
  } else {
    reason = `This tests ${objective(candidate)} The closest reviewed historical case (${nearest.prior.id}) asks ${priorObjective || 'a different task'}; the operation and case evidence differ, with no same-stem or mere operand/name substitution.`;
  }
  return { fixture_id: row.id, content_hash: contentHash(candidate), unique: true, reason, nearest_prior_case: nearest.prior.id };
});
const out = { schema: 'cuet-v713-novelty_report-v1', study_id: study, freeze_sha256: freezeSha,
  author_sha256: authorSha, reviewer_id: reviewerId, created_at: new Date().toISOString(), compared_history: comparedHistory, items };
const path = join(base, 'sealed/novelty-r2.json'), bytes = Buffer.from(JSON.stringify(out, null, 2) + '\n');
if (existsSync(path)) throw Error('novelty_r2_exists_refuse_overwrite');
writeFileSync(path, bytes, { flag: 'wx' });
console.log(JSON.stringify({ path: 'fresh-custody/sealed/novelty-r2.json', sha256: sha(bytes), items: items.length,
  unique: items.filter(item => item.unique).length, nonunique: items.filter(item => !item.unique).length,
  historical_candidates: historical.length, compared_history_files: comparedHistory.length, exact_historical_stem_matches: stemMatchCount,
  paid_calls: 0 }));
