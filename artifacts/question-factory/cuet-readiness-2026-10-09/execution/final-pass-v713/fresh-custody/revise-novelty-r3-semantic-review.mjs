// Preserve the full-history lexical index and write a separate human-reviewed semantic report.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { contentHash } from '../../../../../../data/content_evidence.js';

const root = process.cwd();
const base = resolve(root, 'artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v713/fresh-custody');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const lexicalPath = join(base, 'sealed/novelty-r3.json');
const bytes = readFileSync(lexicalPath);
const lexical = JSON.parse(bytes.toString('utf8'));
const authoredBytes = readFileSync(join(base, 'sealed/authored-r3.json'));
if (sha(authoredBytes) !== 'c1930133120d37aa1a367db90e0403e95036a9d00dfe21261587ab6264d0bff9' ||
    lexical.author_sha256 !== sha(authoredBytes) || lexical.items.length !== 36 || lexical.compared_history.length < 300) throw Error('full_history_review_input_invalid');
const authored = JSON.parse(authoredBytes.toString('utf8'));

// These cases repeat the same task/objective in saved prior material, sometimes as a component
// of a larger match-list item. Similarity is judged by the reasoning demand, not numeric/text identity.
const repeated = new Map([
  ['f-245cd38b73b4511b', 'The task asks for the plan type used for a one-time, nonrecurring event, matching the same plan-identification demand in the prior case; the scenario wording does not change the objective.'],
  ['f-d9454913816921de', 'The task classifies a one-time branch-opening programme as a single-use plan, repeating the prior one-time-event versus recurring-activity classification despite the added company scenario.'],
  ['f-f84de07c56f68390', 'The task classifies cash proceeds from disposal of a long-term asset, which is also the decisive classification tested in the prior customer-receipts and asset-disposal case.'],
  ['f-184a13bcc63cf86c', 'The task asks for the indirect method starting point, which is explicitly one of the tested prompts in the prior direct/indirect-method match-list item. Isolating that subpart does not create a different reasoning demand.'],
  ['f-5b234a758a448dc8', 'The task distinguishes methods for operating cash flows, a demand already tested directly by the prior direct/indirect-method match-list item.']
]);
const items = lexical.items.map(item => {
  const candidate = authored.items.find(row => row.id === item.fixture_id)?.candidate;
  if (!candidate || item.content_hash !== contentHash(candidate)) throw Error('review_item_hash_mismatch');
  const reason = repeated.get(item.fixture_id);
  return reason ? { ...item, unique: false, reason } : item;
});
const reviewed = { ...lexical, items, semantic_review: 'Human review of the lexical nearest-case shortlist; repeated tasks are marked non-unique. No answer keys or explanations were used in the report.' };
const outPath = join(base, 'sealed/novelty-r3-full-history.json');
if (existsSync(outPath)) throw Error('reviewed_novelty_r3_exists_refuse_overwrite');
const outBytes = Buffer.from(JSON.stringify(reviewed, null, 2) + '\n');
writeFileSync(outPath, outBytes, { flag: 'wx' });
console.log(JSON.stringify({ path: 'fresh-custody/sealed/novelty-r3-full-history.json', sha256: sha(outBytes),
  author_sha256: reviewed.author_sha256, historical_files: reviewed.compared_history.length,
  historical_occurrences: reviewed.historical_occurrences, historical_unique_content_hashes: reviewed.historical_unique_content_hashes,
  items: items.length, unique: items.filter(item => item.unique).length, nonunique: items.filter(item => !item.unique).length,
  nonunique_ids: items.filter(item => !item.unique).map(item => item.fixture_id) }));
