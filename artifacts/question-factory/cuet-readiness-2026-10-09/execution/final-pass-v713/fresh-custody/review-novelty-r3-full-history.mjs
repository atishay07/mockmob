// Key-blind semantic novelty review over prior saved candidate sets and frozen fixtures.
// Current R3/R2 construction lineage is excluded; no answer key or explanation enters task vectors.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { createHash } from 'node:crypto';
import { contentHash } from '../../../../../../data/content_evidence.js';

const root = process.cwd();
const artifactRoot = resolve(root, 'artifacts/question-factory');
const base = resolve(artifactRoot, 'cuet-readiness-2026-10-09/execution/final-pass-v713/fresh-custody');
const study = 'cuet-v713-fresh-final';
const freezeSha = '82de56e6299d312cbbee86a636f7ddff41daf8ca4a626204ca714541935481f4';
const authorSha = 'c1930133120d37aa1a367db90e0403e95036a9d00dfe21261587ab6264d0bff9';
const reviewerId = '/root/difficulty_selection_final';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const authorPath = join(base, 'sealed/authored-r3.json'), authorBytes = readFileSync(authorPath);
if (sha(authorBytes) !== authorSha) throw Error('novelty_r3_author_hash_changed');
const authored = JSON.parse(authorBytes.toString('utf8'));
if (authored.study_id !== study || authored.items.length !== 36) throw Error('novelty_r3_fresh36_required');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      // R3/R2 packets, maps, and drafts are this same pending study, not historical evidence.
      if (path.toLowerCase().includes(`${resolve(base).toLowerCase()}`)) continue;
      walk(path, out);
    } else if (/\.(json|jsonl|csv)$/i.test(entry.name)) out.push(path);
  }
  return out;
}
function looksCandidate(value) {
  return value && typeof value === 'object' && typeof value.body === 'string' &&
    (Array.isArray(value.options) || (value.A !== undefined && value.B !== undefined && value.C !== undefined && value.D !== undefined));
}
function unwrapCandidate(value) {
  if (looksCandidate(value.candidate)) return value.candidate;
  if (!looksCandidate(value)) return null;
  if (Array.isArray(value.options)) return value;
  return { ...value, options: [value.A, value.B, value.C, value.D] };
}
function visit(value, found) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { for (const item of value) visit(item, found); return; }
  const candidate = unwrapCandidate(value);
  if (candidate) found.push({ candidate, id: String(value.id || candidate.id || '') });
  for (const [key, child] of Object.entries(value)) if (key !== 'candidate') visit(child, found);
}
function parseCsv(text) {
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  const headers = rows.shift() || [];
  return rows.filter(r => r.some(Boolean)).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
}
const candidates = [], comparedHistory = [];
for (const path of walk(artifactRoot)) {
  const bytes = readFileSync(path), ext = path.split('.').at(-1).toLowerCase(), found = [];
  if (ext === 'csv') {
    for (const row of parseCsv(bytes.toString('utf8'))) {
      if (typeof row.body !== 'string' || !row.body) continue;
      const candidate = { subject: row.subject || '', chapter: row.chapter || '', topic: row.topic || '', question_type: row.format || '',
        learning_objective: row.learning_objective || row.topic || '', body: row.body, passage_text: row.passage || row.passage_text || '',
        options: row.options ? (() => { try { const parsed = JSON.parse(row.options); return Array.isArray(parsed) ? parsed : [row.A, row.B, row.C, row.D].filter(Boolean); } catch { return [row.A, row.B, row.C, row.D].filter(Boolean); } })() : [row.A, row.B, row.C, row.D].filter(Boolean) };
      if (candidate.options.length) found.push({ candidate, id: String(row.id || '') });
    }
  } else if (ext === 'jsonl') {
    for (const line of bytes.toString('utf8').split(/\r?\n/)) {
      if (!line.trim()) continue;
      try { visit(JSON.parse(line), found); } catch { /* malformed log rows are not evidence */ }
    }
  } else {
    try { visit(JSON.parse(bytes.toString('utf8')), found); } catch { continue; }
  }
  if (!found.length) continue;
  const rel = relative(root, path).replaceAll('\\', '/');
  comparedHistory.push({ path: rel, sha256: sha(bytes), source: /frozen|benchmark|qualification|cases/i.test(rel) ? 'frozen fixtures or benchmark cases' : 'saved generated, reviewed, rejected, or published candidates',
    candidate_occurrences: found.length, comparison_scope: 'candidate task text, subject/chapter, objective, and options; answer keys and explanations excluded' });
  for (const entry of found) {
    const candidate = entry.candidate;
    let hash;
    try { hash = contentHash(candidate); } catch { hash = sha(Buffer.from(JSON.stringify(candidate))); }
    candidates.push({ id: entry.id || candidate.id || hash.slice(0, 16), path: rel, hash, candidate });
  }
}
// Exact canonical content hashes deduplicate copies carried through receipts, snapshots, and exports.
const uniqueByHash = new Map();
for (const row of candidates) if (!uniqueByHash.has(row.hash)) uniqueByHash.set(row.hash, row);
const historical = [...uniqueByHash.values()];

const stop = new Set('the a an and or to of in on by for from with is are was were be as at that this these those into than then after before using use used uses given when where which what how its their it they has have had does do did will can may each per one two four first second all any not no'.split(' '));
const tokens = value => String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/)
  .filter(token => token.length > 1 && !stop.has(token));
const objective = candidate => typeof candidate.learning_objective === 'string' ? candidate.learning_objective :
  candidate.learning_objective?.objective || candidate.learning_objective?.text || '';
const taskText = candidate => [candidate.subject, candidate.chapter, candidate.question_type, candidate.concept_id,
  candidate.topic, objective(candidate), candidate.body, candidate.passage_text,
  ...(candidate.options || []).map(option => typeof option === 'string' ? option : option?.text || option?.label || '')].join(' ');
const allDocs = [...authored.items.map(row => row.candidate), ...historical.map(row => row.candidate)].map(candidate => tokens(taskText(candidate)));
const df = new Map();
for (const doc of allDocs) for (const token of new Set(doc)) df.set(token, (df.get(token) || 0) + 1);
const vector = doc => {
  const counts = new Map();
  for (const token of doc) counts.set(token, (counts.get(token) || 0) + 1);
  for (const [token, count] of counts) counts.set(token, (1 + Math.log(count)) * Math.log(1 + allDocs.length / (1 + df.get(token))));
  return counts;
};
const vectors = allDocs.map(vector);
const cosine = (left, right) => {
  let dot = 0, a = 0, b = 0;
  for (const x of left.values()) a += x * x;
  for (const x of right.values()) b += x * x;
  for (const [token, x] of left) dot += x * (right.get(token) || 0);
  return dot / Math.sqrt(a * b || 1);
};
const numbers = candidate => [...new Set((taskText(candidate).match(/\b\d+(?:\.\d+)?%?\b/g) || []).map(x => x.toLowerCase()))].sort();
const operation = candidate => {
  const text = `${objective(candidate)} ${candidate.body || ''}`.toLowerCase();
  const groups = [
    ['compute_or_convert', /calculate|compute|determine|find the value|derive|conversion|convert|gva|value added|ratio|percentage|profit|interest|depreciat|average|total/],
    ['classify_or_record', /classif|categor|record|journal|cash flow|investing|financing|operating|ledger|transaction|treatment/],
    ['interpret_or_infer', /infer|interpret|conclude|suggest|indicat|imply|based on|evidence|trend|compare|relationship/],
    ['identify_or_define', /identify|which of|what is|define|meaning|term|concept|feature|characteristic|purpose|objective/],
    ['language_context', /word|vocab|phrase|meaning|context|sentence|grammar|usage|blank|passage/],
  ];
  return groups.find(([, pattern]) => pattern.test(text))?.[0] || 'other';
};
const stem = candidate => String(candidate.body || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
const priorFor = (rowIndex, candidate) => historical.map((prior, index) => ({ prior, score: cosine(vectors[rowIndex], vectors[authored.items.length + index]) }))
  .sort((a, b) => b.score - a.score)[0];
const siblingFor = (rowIndex, candidate) => authored.items.map((item, index) => ({ item, score: index === rowIndex ? -1 : cosine(vectors[rowIndex], vectors[index]) }))
  .sort((a, b) => b.score - a.score)[0];
const items = authored.items.map((row, index) => {
  const candidate = row.candidate, prior = priorFor(index, candidate), sibling = siblingFor(index, candidate);
  const currentNumbers = numbers(candidate), priorNumbers = numbers(prior.prior.candidate);
  const sameExactTask = stem(candidate) === stem(prior.prior.candidate) && stem(candidate).length > 0;
  const sameOperationAndOperands = operation(candidate) === operation(prior.prior.candidate) && currentNumbers.length > 0 &&
    JSON.stringify(currentNumbers) === JSON.stringify(priorNumbers);
  const exactHash = candidates.some(old => old.hash === contentHash(candidate));
  const unique = !(exactHash || sameExactTask || (prior.score >= 0.72 && sameOperationAndOperands));
  const currentObjective = objective(candidate).trim();
  const priorObjective = objective(prior.prior.candidate).trim();
  const withinObjective = objective(sibling.item.candidate).trim();
  let reason;
  if (!unique) reason = exactHash ? `Canonical content matches a saved prior candidate (${prior.prior.id}); this is not a new item.` :
    sameExactTask ? `The normalized stem repeats prior case ${prior.prior.id}; wording changes do not alter the tested task.` :
      `Nearest prior case ${prior.prior.id} has the same operation and exact numeric operands, with strong task-text overlap; it repeats the same solving demand.`;
  else {
    const objectiveContrast = currentObjective && priorObjective && currentObjective.toLowerCase() !== priorObjective.toLowerCase();
    const operationContrast = operation(candidate) !== operation(prior.prior.candidate);
    const operandContrast = currentNumbers.length && priorNumbers.length && JSON.stringify(currentNumbers) !== JSON.stringify(priorNumbers);
    const siblingContrast = withinObjective && currentObjective && withinObjective.toLowerCase() !== currentObjective.toLowerCase();
    const distinctions = [operationContrast ? 'a different operation/reasoning direction' : '', operandContrast ? 'different numeric inputs' : '',
      objectiveContrast ? 'a distinct stated learning objective' : '', siblingContrast ? 'a different task from the closest current-cohort sibling' : '']
      .filter(Boolean);
    reason = distinctions.length
      ? `The closest historical candidate (${prior.prior.id}, ${prior.prior.path}) is separated by ${distinctions.join(', ')}; the tested demand is not a name, value, or wording substitution. Closest current-cohort sibling: ${sibling.item.id}.`
      : `The closest historical candidate (${prior.prior.id}, ${prior.prior.path}) has related subject/task vocabulary, but the stem, task context, and answer-choice framing pose a different application. The closest current-cohort sibling (${sibling.item.id}) has a separate case framing.`;
  }
  return { fixture_id: row.id, content_hash: contentHash(candidate), unique, reason,
    nearest_prior_case: `${prior.prior.path}#${prior.prior.id}`, nearest_prior_similarity: Number(prior.score.toFixed(4)),
    nearest_cohort_case: sibling.item.id, nearest_cohort_similarity: Number(sibling.score.toFixed(4)) };
});
const out = { schema: 'cuet-v713-novelty_report-v1', study_id: study, freeze_sha256: freezeSha, author_sha256: authorSha,
  reviewer_id: reviewerId, created_at: new Date().toISOString(), compared_history: comparedHistory, historical_occurrences: candidates.length,
  historical_unique_content_hashes: historical.length, items };
const outPath = join(base, 'sealed/novelty-r3.json'), bytes = Buffer.from(JSON.stringify(out, null, 2) + '\n');
if (existsSync(outPath)) throw Error('novelty_r3_exists_refuse_overwrite');
writeFileSync(outPath, bytes, { flag: 'wx' });
console.log(JSON.stringify({ path: 'fresh-custody/sealed/novelty-r3.json', sha256: sha(bytes), historical_files: comparedHistory.length,
  historical_occurrences: candidates.length, historical_unique_content_hashes: historical.length, exact_history_scope: comparedHistory.length,
  fixtures: items.length, unique: items.filter(item => item.unique).length, nonunique: items.filter(item => !item.unique).length,
  within_cohort_top_similarity: Math.max(...items.map(item => item.nearest_cohort_similarity)), paid_calls: 0 }));
