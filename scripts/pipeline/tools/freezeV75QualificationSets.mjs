// Construct the two registered v7.5 qualification studies (fresh + known-critical regression) for runFreshCuetReadinessV75.mjs.
// Pure local construction: no model provider, no Supabase, no ledger, no publication, no bank or source-registry write.
// The v7.5 contract is already frozen (v75-contract-freeze.json); this tool reads it and never edits it. A study directory is
// written once with the exclusive-create flag and the tool refuses to run if either target already exists.
//
//   node scripts/pipeline/tools/freezeV75QualificationSets.mjs --dry-run   # build + local checks, writes nothing
//   node scripts/pipeline/tools/freezeV75QualificationSets.mjs             # write both studies (refuses to overwrite)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { payloadHash } from '../lib/cuetFitBenchmark.mjs';
import { expectedReleaseBindingV75 } from '../lib/releaseEvidenceV75.mjs';
import { FACTORY_VERIFIER_VERSION_V75 } from '../lib/contractV75.mjs';
import { preparationValueV75 } from '../lib/preparationValueV75.mjs';
import { structureVerdict } from '../lib/evidencePipeline.mjs';
import { assertCustodySetV73, assertBenchmarkProvenanceV73, assertReleaseEvidenceRoleV73 } from '../lib/freshCuetReadinessV73Guards.mjs';
import { presentationLint } from '../../../data/question_presentation.mjs';
import { provenanceReasons, hashJSON } from '../../../data/question_factory_policy.mjs';

const dryRun = process.argv.includes('--dry-run');
const ROOT = resolve('artifacts/question-factory');
const SRC = join(ROOT, 'cuet-readiness-2026-10-08/execution/v74-source-prep/acquisition-2022-23');
const V74 = join(ROOT, 'cuet-readiness-2026-10-08/benchmark/v74-known-critical-regression-2026-10-08');
const OUT = join(ROOT, 'cuet-readiness-2026-10-09/benchmark');
const FRESH_ID = 'v75-fresh-cbse2022-2026-10-09', REG_ID = 'v75-known-critical-regression-2026-10-09';
const FRESH_DIR = join(OUT, FRESH_ID), REG_DIR = join(OUT, REG_ID);
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const sha256 = s => createHash('sha256').update(s).digest('hex');
const rel = p => p.replace(resolve('.') + '\\', '').replace(resolve('.') + '/', '').replace(/\\/g, '/');
if (!dryRun && (existsSync(FRESH_DIR) || existsSync(REG_DIR))) throw Error('immutable_v75_study_already_exists');

// ---------------------------------------------------------------- inputs and lineage
const packetPath = join(SRC, 'questions-blinded-v1.json');
const packet = read(packetPath), first = read(join(SRC, 'ROOT-FIRST-BLIND-SOLVE.json')), second = read(join(SRC, 'ROOT-SECOND-BLIND-SOLVE-v1.json'));
const custodyRef = read(join(SRC, 'REFERENCE-ANSWER-CUSTODY-v1.json')), comparison = read(join(SRC, 'OFFICIAL-KEY-COMPARISON-v1.json'));
const supplement = read(join(SRC, 'teaching-supplement-v1.json')), exposure = read(join(SRC, 'incidental-exposure-disclosure-v1.json'));
const pins = { packet: '65a1679f4a85b4c3ecba64dbe034c0cb91b4f9b5852bbdbcbbe3d4d3a55b5905', first: 'e4eceaf79c259450f5cfaff47b39d7c945e998d5842e5003cd203902dc94edba',
  second: '04a9fd02322bb9353dbd0034f40df55250b614f35da88fea99da413c91993ba7', custody: '8584967b0fee5c7f00d4908d7f3e70b37ed9c080f3494c7f64357425a0093bcc' };
if (sha(packetPath) !== pins.packet || sha(join(SRC, 'ROOT-FIRST-BLIND-SOLVE.json')) !== pins.first || sha(join(SRC, 'ROOT-SECOND-BLIND-SOLVE-v1.json')) !== pins.second ||
    sha(join(SRC, 'REFERENCE-ANSWER-CUSTODY-v1.json')) !== pins.custody || comparison.custody_record_sha256 !== pins.custody) throw Error('frozen_source_custody_changed');
if (packet.items.length !== 16 || comparison.roles.valid_positive !== 13 || comparison.roles.natural_defect_multiple_defensible !== 2 || comparison.roles.held_reference_conflict !== 1) throw Error('custody_roles_changed');
const freezeFile = join(ROOT, 'cuet-readiness-2026-10-09/v75-contract-freeze.json');
const registry = read('data/source_registry.json');
const binding = expectedReleaseBindingV75();
const freeze = read(freezeFile);
if (freeze.validation_contract_hash !== binding.validation_contract_hash || freeze.prompt_hash !== binding.prompt_hash) throw Error('v75_contract_freeze_does_not_match_current_binding');

const item = id => packet.items.find(i => i.item_id === id);
const cmp = id => comparison.items.find(i => i.item_id === id);
const roleOf = id => cmp(id).qualification_role;
const stimulus = packet.stimuli[0];
const lexical = word => packet.lexical_excerpts.find(l => l.word === word);

// ---------------------------------------------------------------- scratch registry overlay
const overlay = { sources: {}, families: {}, packs: {} };
const SYLLABUS = subject => ({ syllabus_version: registry.exam_specs[subject].syllabus_version, pattern_version: registry.exam_specs[subject].pattern_version });
const packOf = subject => 'v75-fresh-cbse2022-pack-' + subject;
function ensurePack(subject) {
  overlay.packs[packOf(subject)] ||= { id: packOf(subject), subject, version: 1, state: 'active', registered_at: '2026-10-09T00:00:00.000Z', document_ids: [] };
}
function addSource({ subject, chapter, text, url, title, identity, permission, kind = 'reference' }) {
  ensurePack(subject);
  const id = 'v75f-s-' + sha256(subject + '|' + chapter + '|' + text).slice(0, 12);
  if (!overlay.sources[id]) {
    overlay.sources[id] = { id, kind, state: 'active', version: 1, chapters: [chapter], url, title, identity_sha256: identity, extraction_sha256: sha256(text), extraction_checked: true, reuse_permitted: true,
      permission: { basis: permission, reference: url }, facts: { 'decisive-excerpt': { text } }, supports: { 'decisive-excerpt': hashJSON(text) }, source_pack_id: packOf(subject) };
    overlay.packs[packOf(subject)].document_ids.push(id);
  }
  return { id, version: 1, locator: 'decisive-excerpt', support_hash: hashJSON(text) };
}
const ncertText = (subject, chapter, s, text) => addSource({ subject, chapter, text, url: s.official_url, title: 'NCERT Class XII textbook excerpt', identity: s.pdf_sha256, permission: s.permission_basis });
// Provider input bound: the first build of the Business Studies Q3 fixture exceeded the runner's 33,024-byte bound by 178 bytes under the frozen
// v7.5 request. Its first functional-structure excerpt lists advantages (a)-(e) that bear on no option, so it is registered as two exact
// sub-spans of the packet span (the definition, and advantage (f) through the disadvantages), never edited or paraphrased.
const TRIM = { 'v74-cbse22-bs-q03': { 'ncert-lebs105|8|21': [[null, 'groups similar or related jobs together.'], ['(f) It ensures that different functions get due attention.', null]] } };
const TRIM_RECORD = [];
function ncert(subject, chapter, s, sourceId) {
  const spec = TRIM[sourceId]?.[`${s.source_id}|${s.physical_pdf_page}|${s.quote_start}`];
  if (!spec) return [ncertText(subject, chapter, s, s.quote)];
  const parts = spec.map(([from, to]) => { const a = from === null ? 0 : s.quote.indexOf(from), b = to === null ? s.quote.length : s.quote.indexOf(to) + to.length;
    if (a < 0 || b <= a || (to !== null && s.quote.indexOf(to) < 0)) throw Error('exact_subspan_boundaries_missing:' + sourceId); return { start: a, end: b, text: s.quote.slice(a, b) }; });
  TRIM_RECORD.push({ source_item_id: sourceId, parent: { source_id: s.source_id, physical_pdf_page: s.physical_pdf_page, quote_start: s.quote_start, quote_end: s.quote_end, parent_bytes: Buffer.byteLength(s.quote) },
    exact_subspans: parts.map(({ start, end, text }) => ({ start, end, bytes: Buffer.byteLength(text) })), omitted: 'advantages (a)-(e) of the functional structure, which bear on no option' });
  return parts.map(p => ncertText(subject, chapter, s, p.text));
}
const dictionary = (subject, chapter, word) => { const l = lexical(word); return addSource({ subject, chapter, text: l.quote, url: l.official_url, title: 'Cambridge Dictionary: ' + word, identity: l.quote_sha256, permission: l.permission_basis }); };
const passageSource = () => addSource({ subject: 'english', chapter: 'Factual Passage', text: stimulus.text, url: 'local://mockmob/v75-fresh/practice-passage', title: 'Practice passage (adapted)', identity: sha256(stimulus.text),
  permission: 'Original abridgment of a CBSE sample-paper stimulus for private educational verification; not an authentic CUET passage and never published' });
const refNote = (subject, chapter, text) => addSource({ subject, chapter, text, url: 'local://mockmob/v75-fresh/reference-note-' + sha256(text).slice(0, 8), title: 'Reference note', identity: sha256(text),
  permission: 'Original controlled reference note written for this qualification; never published' });

// ---------------------------------------------------------------- positive specifications
const U = {
  fs: 'Unit V: Analysis of Financial Statements', org: 'Unit V: Organising', env: 'Unit III: Business Environment', stock: 'Course II Unit I: Introduction and National Income Accounting',
  money: 'Course II Unit II: Money and Banking', income: 'Course II Unit III: Determination of Income and Employment', budget: 'Course II Unit IV: Government Budget and the Economy',
  open: 'Course II Unit V: Open Economy Macroeconomics', rc: 'Reading Comprehension: factual passage', va: 'Verbal Ability: Synonyms and Antonyms', admission: 'Unit II: Reconstitution of a Partnership firm'
};
const LO = (syllabus_unit, objective, why_answer_requires_it, target_term = '') => ({ syllabus_unit, objective, target_term, why_answer_requires_it });
// Each positive: construction choices only. Keys come from the agreed derivations (verified against the official comparison below).
const POSITIVES = {
  'v74-cbse22-acc-q27': { chapter: 'Financial Statements of Company', type: 'direct_mcq', route: 'conceptual', difficulty: 'easy',
    explanation: 'The NCERT chapter on financial statements states that they are prepared on certain basic assumptions (pre-requisites) known as postulates, for example the going concern, money measurement and realisation postulates. The provisions of the Companies Act, accounting standards and the basis of accounting are not the name the chapter gives to these basic assumptions.',
    lo: LO(U.fs, 'Name the term used for the basic assumptions on which financial statements are prepared.', 'The student must recall the textbook name for the pre-requisites of financial statements.') },
  'v74-cbse22-acc-q28': { chapter: 'Accounting Ratios', type: 'numerical_calculation', route: 'numerical', difficulty: 'medium',
    explanation: 'Interest coverage ratio = profit before interest and tax divided by interest on long-term debt. Interest = 10% of ₹1,00,00,000 = ₹10,00,000. Profit before tax = ₹12,00,000 × 100/(100 − 40) = ₹20,00,000. Profit before interest and tax = ₹20,00,000 + ₹10,00,000 = ₹30,00,000. Ratio = ₹30,00,000 / ₹10,00,000 = 3 times. Dividing profit after tax by interest gives 1.2 and dividing profit before tax by interest gives 2, because both leave out part of the profit available to cover interest.',
    lo: LO(U.fs, 'Calculate the interest coverage ratio from profit after tax, the tax rate and the interest on long-term debt.', 'The student must convert profit after tax into profit before interest and tax before dividing by interest.') },
  'v74-cbse22-acc-q29': { chapter: 'Cash Flow Statement', type: 'case_application', route: 'conceptual', difficulty: 'medium',
    explanation: 'The insurance claim for machinery lost by theft is an extraordinary item that is already included in net profit. NCERT says cash flows from extraordinary items are classified by their nature, that cash received on disposal of fixed assets is an investing inflow, and that investing incomes are deducted from net profit in the indirect method. So the receipt is subtracted when adjusting net profit to operating profit and is shown as an investing inflow, not as an outflow and not as an addition to operating activities.',
    lo: LO(U.fs, 'Apply the indirect-method rules for adjusting and classifying a non-operating receipt in a cash flow statement.', 'The student must apply both the adjustment to net profit and the correct cash flow category to one receipt.') },
  'v74-cbse22-acc-q30': { chapter: 'Cash Flow Statement', type: 'numerical_calculation', route: 'numerical', difficulty: 'medium',
    explanation: 'Carrying amount of the equipment sold = opening carrying amount ₹3,00,000 + purchases ₹30,000 − depreciation ₹40,000 − closing carrying amount ₹2,00,000 = ₹90,000. Sale proceeds = carrying amount ₹90,000 + profit on sale ₹12,000 = ₹1,02,000, which is the cash received from the sale (an investing inflow). ₹90,000 is only the carrying amount sold, and the other figures do not reconcile the whole movement.',
    lo: LO(U.fs, 'Find the cash received on the sale of an asset from opening and closing balances, purchases, depreciation and profit on sale.', 'The student must reconcile the asset account to the carrying amount sold and then add the profit on sale.') },
  'v74-cbse22-bs-q01': { chapter: 'Organising', type: 'case_application', route: 'conceptual', difficulty: 'easy',
    explanation: 'In the NCERT process of organising, identification and division of work is the first step. Once the work is divided into manageable activities, similar activities are grouped together into departments, which is departmentalisation. Assignment of duties and establishing reporting relationships follow only after departments have been formed.',
    lo: LO(U.org, 'Place a described managerial action in the correct step of the process of organising.', 'The student must know the order of the steps in the organising process.') },
  'v74-cbse22-bs-q02': { chapter: 'Business Environment', type: 'case_application', route: 'conceptual', difficulty: 'easy',
    explanation: 'NCERT describes uncertainty as the feature that the business environment is very difficult to predict, especially when changes take place too frequently. Complexity concerns many interrelated forces that are hard to comprehend at once, inter-relatedness concerns elements that affect each other, and relativity concerns differences from country to country and region to region.',
    lo: LO(U.env, 'Match a described situation to the feature of the business environment that it shows.', 'The student must know the textbook meaning of each feature of the business environment.') },
  'v74-cbse22-bs-q04': { chapter: 'Business Environment', type: 'case_application', route: 'conceptual', difficulty: 'easy',
    explanation: 'Increasing participation of women in the workforce is a social-environment element in NCERT, and using accounting software is a technological-environment element. The case supplies no government attitude (political), no economic variable and no legislation (legal), so the pairs containing political, economic or legal are not supported.',
    lo: LO(U.env, 'Identify the dimensions of the business environment that a described situation illustrates.', 'The student must link each detail in the case to a dimension of the business environment.') },
  'v74-cbse22-econ-q01': { chapter: 'Income Determination', type: 'statement_selection', route: 'conceptual', difficulty: 'medium',
    explanation: 'With a constant marginal propensity to consume c, consumption = autonomous consumption + cY rises with income at a constant rate, so it is an upward-sloping straight line and Statement 1 is true. In the two-sector model investment is autonomous, and aggregate demand is obtained by vertically adding that constant investment to consumption, so the aggregate demand function has the same slope c as the consumption function and the two are parallel; Statement 2 is true as well.',
    lo: LO(U.income, 'Compare the consumption function and the aggregate demand function in the two-sector model.', 'The student must connect a constant marginal propensity to consume with the slopes of both functions.') },
  'v74-cbse22-econ-q03': { chapter: 'Money & Banking', type: 'direct_mcq', route: 'conceptual', difficulty: 'easy',
    explanation: 'NCERT says that commercial banks accept deposits from the public and lend out part of these funds. The Reserve Bank of India is the central bank, which issues currency and acts as banker to the government and to the banking system. The excerpts do not describe the Life Insurance Corporation or the Government of India as accepting public deposits for lending.',
    lo: LO(U.money, 'Identify the institution that accepts public deposits in order to lend.', 'The student must distinguish commercial banks from the central bank and other institutions.') },
  'v74-cbse22-econ-q04': { chapter: 'Balance of Payments', type: 'statement_selection', route: 'conceptual', difficulty: 'easy',
    explanation: 'In the NCERT two-account classification, services such as banking are part of trade in services in the current account, and a sale of services to the rest of the world brings foreign exchange in, so it is a credit item. Capital account records international transactions in assets; a sale of assets, such as foreign direct investment into India, is a credit item there. Both statements are true.',
    lo: LO(U.open, 'Classify international transactions as credits or debits in the current and capital accounts.', 'The student must know which account records each transaction and whether it is a credit or a debit.') },
  'v74-cbse22-econ-q05': { chapter: 'National Income & Related Aggregates', type: 'statement_selection', route: 'conceptual', difficulty: 'easy',
    explanation: 'NCERT defines a stock at a particular point of time, and the capital goods in an economy are a stock. Changes in stock over a period are flows, and net investment (gross investment minus depreciation) is the new addition to the capital stock over a period, so it is a flow. Statement 1 calls net investment a stock and Statement 2 calls capital a flow, so both reverse the classification and both are false.',
    lo: LO(U.stock, 'Classify capital and net investment as stock or flow variables.', 'The student must know that stocks are measured at a point of time and flows over a period.') },
  'v74-cbse22-en-q1-iv': { chapter: 'Factual Passage', type: 'antonym', route: 'passage', difficulty: 'easy', english: true, words: ['negligible', 'unimpressive', 'monumental', 'exposing', 'threat'],
    explanation: 'Negligible means small and not important. Paragraph 2 calls the threat monumental, meaning very big or very great, which is the opposite of small and not important. Unimpressive means not making you feel admiration or respect, exposing means putting someone at risk, and threat means the possibility that something unwanted will happen; none of these is opposite in size or importance.',
    lo: LO(U.va, "Find the word in paragraph 2 that has the opposite meaning to a given word.", 'The student must know the meaning of the given word and recognise the word of opposite size or importance used in the paragraph.', 'negligible') },
  'v74-cbse22-en-q1-ix': { chapter: 'Factual Passage', type: 'reading_comprehension', route: 'passage', difficulty: 'easy', english: true, words: ['practical', 'presentable', 'popular', 'prejudiced'],
    explanation: 'Paragraph 5 proposes concrete measures: traceable ownership so that dumping can be fined, refundable deposits for returning or recycling nets, sonar reflectors to locate nets, and working with small-scale fisheries on more sustainable gear. These are measures that can be carried out successfully, which is what practical means. Presentable concerns looking suitable or good enough, popular means liked by many people and prejudiced means showing an unreasonable dislike; the paragraph supports none of these.',
    lo: LO(U.rc, "Characterise the writer's proposed solutions from the measures described in a paragraph.", 'The student must judge which descriptive word fits the measures listed in paragraph 5.') }
};
const NATURAL = {
  'v74-cbse22-bs-q03': { chapter: 'Organising', type: 'case_application', route: 'conceptual', difficulty: 'easy', key: 'D',
    explanation: 'Dividing work into production, purchase, marketing, accounts and personnel departments forms a functional structure. NCERT lists among its disadvantages that functional heads do not get training for top management positions because they cannot gather experience in diverse areas. Ensuring that different functions get due attention is an advantage of this structure.',
    lo: LO(U.org, 'Identify a disadvantage of a given organisation structure.', 'The student must recognise the structure from its departments and recall its listed disadvantages.'),
    basis: 'Both independent reviewers found the item contestable: the same functional-structure excerpt describes functional empires and departmental interests being pursued at the cost of organisational interests, so option B overlaps a functional-structure disadvantage while being worded like the divisional-structure one; the second reviewer also found option A defensible on a loose reading. The official key and the textbook-category key is D. Retained as a natural multiple-defensible defect (key shown is the official D).',
    oracleKey: 'multiple_correct_B_D' },
  'v74-cbse22-en-q1-v': { chapter: 'Factual Passage', type: 'reading_comprehension', route: 'passage', difficulty: 'medium', english: true, words: [], key: 'C',
    explanation: 'Paragraph 3 says that animals mistake microplastics for food, and that eating them can harm internal organs, prevent further feeding and expose animals to toxic chemicals. The writer would therefore not agree that disintegrating nets provide nutrition to marine animals. The other statements are consistent with the paragraph.',
    lo: LO(U.rc, 'Identify the statement that the writer would not agree with, based on one paragraph.', 'The student must test each statement against what paragraph 3 says.'),
    basis: 'Both reviewers found two statements the passage contradicts: a few years to disintegrate (the paragraph says nets last for centuries and only break into smaller plastic pieces) and nutrition from disintegration (the paragraph says microplastic eaten as food harms animals). The EXCEPT item therefore has no unique key; the first reviewer held it and the second abstained. The key shown is the official C on the original passage.',
    oracleKey: 'multiple_correct_A_C' }
};

// ---------------------------------------------------------------- fixture construction
const fixtures = [];
const opaque = (role, source, category) => 'v75f-' + sha256(`${FRESH_ID}|${role}|${source}|${category}`).slice(0, 10);
const familyOf = source => 'v75f-fam-' + sha256(`${FRESH_ID}|family|${source}`).slice(0, 8);
const keyOf = sourceId => { const a = first.items.find(i => i.item_id === sourceId)?.solved_key, b = second.items.find(i => i.item_id === sourceId)?.solved_key, c = cmp(sourceId).official_key_mapped_to_packet; return { a, b, c }; };

function buildCandidate(sourceId, spec, id, key) {
  const q = item(sourceId), subject = q.subject, family = familyOf(sourceId);
  ensurePack(subject);
  const refs = [];
  if (spec.english) {
    refs.push(passageSource());
    for (const w of spec.words) refs.push(dictionary(subject, spec.chapter, w));
  } else {
    const supp = [...q.supporting_excerpts];
    if (sourceId === 'v74-cbse22-bs-q04') for (const s of supplement.items.find(i => i.item_id === sourceId).supporting_excerpts) supp.push(s);
    for (const s of supp) refs.push(...ncert(subject, spec.chapter, s, sourceId));
  }
  overlay.families[family] = { state: 'active', version: 1, kind: 'original_practice', source_pack_id: packOf(subject) };
  return { id, subject, chapter: spec.chapter, concept_id: null, body: q.body, options: structuredClone(q.options).map(o => ({ key: o.key, text: o.text })), correct_answer: key, explanation: spec.explanation,
    route: spec.route, difficulty: spec.difficulty, question_type: spec.type, passage_text: spec.english ? stimulus.text : '', family_id: family, source_refs: refs, learning_objective: spec.lo,
    provenance: { kind: 'original_practice', anchor_id: null, adaptation_family: family, adaptation_type: null, ...SYLLABUS(subject), source_pack_id: packOf(subject), source_pack_version: 1 } };
}
const custodyRecord = (sourceId, extra = {}) => { const q = item(sourceId), c = cmp(sourceId), cu = custodyRef.items.find(i => i.item_id === sourceId);
  return { source_item_id: sourceId, subject: q.subject, first_source_key: c.first, independent_second_key: c.second, official_comparison_key: c.official_key_mapped_to_packet, official_agrees: c.official_agrees, qualification_role: c.qualification_role,
    custody_status: cu.status, hold_basis: cu.hold_basis, source_status: q.source_status, source_spans: q.source_spans.map(s => ({ source_id: s.source_id, official_url: s.official_url, pdf_sha256: s.pdf_sha256, cache_sha256: s.cache_sha256, physical_pdf_page: s.physical_pdf_page, quote_start: s.quote_start, quote_end: s.quote_end, quote: s.quote })),
    adaptation_note: q.adaptation_note, targeted_source_edits_used: q.targeted_source_edits_used, ...extra }; };

const positiveIdOf = {};
for (const [sourceId, spec] of Object.entries(POSITIVES)) {
  if (roleOf(sourceId) !== 'valid_positive') throw Error('positive_role_required:' + sourceId);
  const k = keyOf(sourceId); if (!/^[ABCD]$/.test(k.a) || k.a !== k.b || k.a !== k.c) throw Error('agreed_key_required:' + sourceId);
  const id = opaque('valid', sourceId, 'valid'); positiveIdOf[sourceId] = id;
  const candidate = buildCandidate(sourceId, spec, id, k.a);
  fixtures.push({ id, group: 'authored_valid', category: 'valid', expected_valid: true, candidate,
    oracle: { key: k.a, basis: `Agreed key ${k.a}: first blind derivation (${first.reviewer}) and second independent blind derivation (${second.reviewer}) both solved ${k.a} before the official marking scheme was opened, and the official CBSE 2022-23 marking scheme maps to ${k.a} (${comparison.schema}). First: ${first.items.find(i => i.item_id === sourceId).derivation} Second: ${second.items.find(i => i.item_id === sourceId).reasoning}`, source_refs: candidate.source_refs },
    provenance_label: 'source_keyed_non_cuet', source_custody: custodyRecord(sourceId), construction_repairs_used: 0, maximum_additional_repairs: 0 });
}
for (const [sourceId, spec] of Object.entries(NATURAL)) {
  if (roleOf(sourceId) !== 'natural_defect_multiple_defensible') throw Error('natural_role_required:' + sourceId);
  const id = opaque('natural', sourceId, 'multiple_correct');
  const candidate = buildCandidate(sourceId, spec, id, spec.key);
  fixtures.push({ id, group: 'controlled_defect', category: 'multiple_correct', expected_valid: false, defect_origin: 'natural', candidate,
    oracle: { key: spec.oracleKey, basis: spec.basis, source_refs: candidate.source_refs }, provenance_label: 'source_keyed_non_cuet', source_custody: custodyRecord(sourceId, { natural_defect: true }),
    construction_repairs_used: 0, maximum_additional_repairs: 0 });
}

// Seeded controlled defects: one objectively verifiable change each, applied to a clone of the root's candidate.
const SEEDED = [];
function seed(rootSource, category, mutate, basis, { key, mutation }) {
  const root = fixtures.find(f => f.id === positiveIdOf[rootSource]);
  if (!root) throw Error('positive_root_required:' + rootSource);
  const id = opaque('seeded', rootSource, category), c = structuredClone(root.candidate); c.id = id;
  const out = mutate(c) || {};
  fixtures.push({ id, group: 'controlled_defect', category, expected_valid: false, defect_origin: 'seeded', derived_from: root.id, candidate: c,
    oracle: { key: key ?? root.oracle.key, correct_key_of_base: root.oracle.key, basis, source_refs: c.source_refs }, mutation: { kind: category, description: mutation },
    provenance_label: 'source_keyed_non_cuet', source_custody: { ...root.source_custody, derived_from_source_item: rootSource, root_fixture_id: root.id, seeded_from_valid_positive: true },
    construction_repairs_used: 0, maximum_additional_repairs: 0, ...(out.extra || {}) });
  SEEDED.push({ id, root: root.id, rootSource, category, subject: c.subject });
}
const subjectOf = s => item(s).subject;

// Accountancy
seed('v74-cbse22-acc-q27', 'wrong_key', c => { c.correct_answer = 'B'; }, 'The NCERT excerpt names the basic assumptions postulates (C). B, accounting standards, is not the name the chapter gives them, so the stored key is wrong.', { mutation: 'Stored key changed from C to B; stem, options and explanation unchanged.' });
seed('v74-cbse22-acc-q28', 'numerical_fault', c => { c.body = c.body.replace('₹12,00,000', '₹13,50,000'); if (!c.body.includes('₹13,50,000')) throw Error('mutation_failed'); }, 'With profit after tax of ₹13,50,000 the profit before tax is ₹22,50,000, profit before interest and tax is ₹32,50,000 and the ratio is 3.25 times, which is not among 1.2, 3, 2 and 5 times. No option is correct.', { key: 'none', mutation: 'Profit after tax in the stem changed from ₹12,00,000 to ₹13,50,000; options, key and explanation unchanged.' });
seed('v74-cbse22-acc-q30', 'missing_assumptions', c => { c.body = c.body.replace('depreciation of ₹40,000 was charged', 'depreciation was charged'); if (c.body.includes('₹40,000')) throw Error('mutation_failed'); }, 'The amount of depreciation is removed. The carrying amount sold is 1,30,000 minus the unknown depreciation, so the sale proceeds cannot be determined and no option follows; the stem no longer gives a decisive datum.', { key: 'indeterminate', mutation: 'The depreciation amount (₹40,000) is removed from the stem; options, key and explanation unchanged.' });
// Business Studies
seed('v74-cbse22-bs-q01', 'multiple_correct', c => { c.options[3].text = 'Grouping similar activities into departments'; }, 'Option D now restates departmentalisation (grouping similar activities into departments), which is also option B. Two options are correct for the same step.', { key: 'multiple_correct_B_D', mutation: 'Option D text replaced by a restatement of option B.' });
seed('v74-cbse22-bs-q02', 'unsupported_explanation', c => { c.explanation += ' NCERT also states that uncertainty means a business environment that differs from country to country and even from region to region.'; }, 'The appended rule is false: NCERT attributes differences between countries and regions to relativity, not uncertainty. The key (uncertainty) remains correct.', { mutation: 'One false sentence about the definition of uncertainty appended to the explanation; key unchanged.' });
{
  const note = 'In a Joint Hindu Family business, the business is owned and carried on by the members of a Hindu undivided family. The eldest member, called the karta, manages the business and has unlimited liability, while the other members, called coparceners, have limited liability up to their share in the joint property.';
  seed('v74-cbse22-bs-q04', 'out_of_syllabus', c => {
    c.body = 'In a Joint Hindu Family business, which member manages the business and has unlimited liability?';
    c.options = ['Coparcener', 'Karta', 'Nominal partner', 'Sleeping partner'].map((text, i) => ({ key: 'ABCD'[i], text }));
    c.correct_answer = 'B'; c.explanation = 'The reference note says that the eldest member, called the karta, manages the business and has unlimited liability, while the coparceners have limited liability up to their share in the joint property.';
    c.question_type = 'direct_mcq'; c.difficulty = 'easy';
    c.source_refs = [refNote('business_studies', c.chapter, note)];
    c.learning_objective = LO(U.env, 'Identify the member who manages a Joint Hindu Family business.', 'The student must recall which member of the family manages the business.');
  }, 'Joint Hindu Family business is a Class XI Business Studies topic (forms of business organisation); it is outside the CUET Class XII Business Studies units. The item is otherwise well formed, with a supported key B, and the assigned chapter label cannot confer entitlement on another topic.', { key: 'B', mutation: 'Whole item replaced by a well-formed Class XI-only Business Studies question under the same assigned chapter label.' });
}
// Economics
seed('v74-cbse22-econ-q03', 'wrong_key', c => { c.correct_answer = 'C'; }, 'NCERT says commercial banks accept deposits from the public and lend out part of them (A). The Reserve Bank of India is the central bank, so C is a wrong key.', { mutation: 'Stored key changed from A to C; stem, options and explanation unchanged.' });
seed('v74-cbse22-econ-q04', 'unsupported_explanation', c => { c.explanation += ' NCERT adds that transfer payments such as gifts, remittances and grants are recorded in the capital account.'; }, 'The appended rule is false: NCERT places transfer payments in the current account. The key (both statements true) remains correct.', { mutation: 'One false sentence about transfer payments appended to the explanation; key unchanged.' });
{
  const note = 'A histogram presents a continuous frequency distribution as adjacent rectangles whose widths are the class intervals and whose heights are the class frequencies. A pie diagram divides a circle into sectors to show the shares of a total. An ogive plots cumulative frequencies. A time series graph plots a variable against time.';
  seed('v74-cbse22-econ-q05', 'out_of_syllabus', c => {
    c.body = 'In Statistics for Economics, which diagram presents a continuous frequency distribution using rectangles whose widths follow the class intervals?';
    c.options = ['Pie diagram', 'Time series graph', 'Histogram', 'Ogive'].map((text, i) => ({ key: 'ABCD'[i], text }));
    c.correct_answer = 'C'; c.explanation = 'The reference note says that a histogram presents a continuous frequency distribution as adjacent rectangles whose widths are the class intervals. A pie diagram shows shares of a total, a time series graph plots a variable against time and an ogive plots cumulative frequencies.';
    c.question_type = 'direct_mcq'; c.difficulty = 'easy';
    c.source_refs = [refNote('economics', c.chapter, note)];
    c.learning_objective = LO(U.stock, 'Choose the diagram that presents a continuous frequency distribution.', 'The student must recall which diagram uses class-interval widths for a continuous distribution.');
  }, 'Statistics for Economics (presentation of data) is a Class XI topic; the CUET Economics syllabus lists only Introductory Microeconomics, Introductory Macroeconomics and Indian Economic Development. The item is otherwise well formed, with a supported key C.', { key: 'C', mutation: 'Whole item replaced by a well-formed Class XI Statistics question under the same assigned chapter label.' });
}
// English
seed('v74-cbse22-en-q1-iv', 'wrong_key', c => { c.correct_answer = 'A'; }, 'Negligible means small and not important; monumental (very big or very great) is the opposite (B). Unimpressive (A) is not the opposite, so the stored key is wrong.', { mutation: 'Stored key changed from B to A; stem, options and explanation unchanged.' });
seed('v74-cbse22-en-q1-iv', 'unsupported_explanation', c => { c.explanation += ' Paragraph 2 also reports that ninety per cent of all ghost nets are found in the Pacific Ocean.'; }, 'The appended statistic appears nowhere in the supplied passage or dictionary excerpts; it is a deliberate fabrication. The key (B) remains correct.', { mutation: 'One fabricated sentence about a statistic in paragraph 2 appended to the explanation; key unchanged.' });
seed('v74-cbse22-en-q1-ix', 'multiple_correct', c => { c.options[1].text = 'workable'; }, 'Option B (workable) now means the same as practical (able to be done successfully), so both A and B describe the paragraph-5 measures.', { key: 'multiple_correct_A_B', mutation: "Option B text 'presentable' replaced by 'workable', a synonym of the keyed word." });

fixtures.sort((a, b) => a.id.localeCompare(b.id));

// ---------------------------------------------------------------- local checks (same predicates the runner/verifier apply before any paid call)
const SUBJECTS = ['accountancy', 'business_studies', 'economics', 'english'];
const CATEGORIES = ['wrong_key', 'multiple_correct', 'missing_assumptions', 'unsupported_explanation', 'out_of_syllabus', 'numerical_fault'];
const fullRegistry = { ...registry, sources: { ...registry.sources, ...overlay.sources }, families: { ...registry.families, ...overlay.families }, packs: { ...registry.packs, ...overlay.packs } };
function localReport(list, reg = fullRegistry) {
  return list.map(f => ({ id: f.id, expected_valid: f.expected_valid, category: f.category, structure: structureVerdict(f.candidate).reasons, presentation: presentationLint(f.candidate), provenance: provenanceReasons(f.candidate, reg),
    preparation: preparationValueV75(f.candidate).findings.map(x => (x.blocking ? '!' : '') + x.code) }));
}
const positives = fixtures.filter(f => f.expected_valid), defects = fixtures.filter(f => !f.expected_valid), seeded = defects.filter(f => f.defect_origin === 'seeded'), natural = defects.filter(f => f.defect_origin === 'natural');
if (positives.length !== 13 || natural.length !== 2 || seeded.length !== 12 || new Set(fixtures.map(f => f.id)).size !== fixtures.length) throw Error('fixed_fresh_denominator_changed');
for (const s of SUBJECTS) if (seeded.filter(f => f.candidate.subject === s).length !== 3) throw Error('three_controlled_defects_per_subject_required:' + s);
for (const c of CATEGORIES) if (!seeded.some(f => f.category === c)) throw Error('defect_category_not_covered:' + c);
for (const f of seeded) { const base = positives.find(p => p.id === f.derived_from); if (!base || JSON.stringify(base.candidate) === JSON.stringify(f.candidate)) throw Error('seeded_defect_must_differ_from_root:' + f.id); }

// ---------------------------------------------------------------- fresh study documents
const created = '2026-10-09T00:00:00.000Z';
const perSubject = list => Object.fromEntries(SUBJECTS.map(s => [s, list.filter(f => f.candidate.subject === s).length]));
const countBy = (list, key) => list.reduce((m, f) => (m[f[key]] = (m[f[key]] || 0) + 1, m), {});
const freshFrozen = {
  id: FRESH_ID, created_at: created, fixtures, payload_hash: payloadHash(fixtures), denominator: fixtures.length, valid_roots: positives.length, controlled_defects: defects.length,
  contract_binding: binding, verifier_version: FACTORY_VERIFIER_VERSION_V75,
  release_eligibility: { scope: 'full_cuet_release', classification: 'fresh', approved_before_evaluation: true, previously_read: false, tuned_on: false, preregistration_id: FRESH_ID },
  construction_disclosure: {
    raw_reference_denominator: 16, source_packet_sha256: pins.packet, provenance_label: 'source_keyed_non_cuet',
    provenance: 'CBSE Class XII 2022-23 sample-paper items, adapted. Not authenticated CUET PYQs; fixtures carry provenance.kind original_practice and the label source_keyed_non_cuet.',
    roles: { valid_positive: positives.length, natural_defect: natural.length, seeded_controlled_defect: seeded.length, held_reference_conflict: 1 },
    runner_field_note: `frozen.controlled_defects (${defects.length}) is the runner's count of every expected-invalid fixture: ${seeded.length} seeded controlled defects plus ${natural.length} natural defects. Natural defects use group controlled_defect so that the release assessor counts them as false accepts; defect_origin distinguishes them.`,
    by_subject: { valid: perSubject(positives), natural: perSubject(natural), seeded: perSubject(seeded), total: perSubject(fixtures) },
    seeded_by_category: countBy(seeded, 'category'),
    exact_subspan_trims: TRIM_RECORD,
    held_not_a_fixture: [{ source_item_id: 'v74-cbse22-en-q1-i', role: 'held_reference_conflict', note: cmp('v74-cbse22-en-q1-i').note, first: 'B', second: 'B', official_key_mapped_to_packet: 'C', treatment: 'Retained and held: not a fixture, not a positive and not a defect. Excluded from survival; counted only in the raw 16 reference denominator. Never forced to a key.' }],
    constructor_exposure: 'The constructor read the 16 items, the supplied teaching excerpts, both blind derivations and the official CBSE 2022-23 marking-scheme comparison before authoring the fixtures. v7.5 prompts, deterministic checks and thresholds were frozen earlier (v75-contract-freeze.json, 2026-10-08T19:14:52Z), before any fixture existed, and nothing in them was derived from these items. No validator or provider has seen any fixture.',
    incidental_source_exposure: exposure.observation,
    reviewers: { first: first.reviewer, second: second.reviewer, official_comparison: 'Claude Haiku subagent extracted option letters from the official marking schemes; mapped to packet options by printed letter and text' },
    deviations_and_decisions: [
      'Fixture ids are opaque hashes (v75f-...) and source ids are content hashes. V73/V74 fixtures put the root id and the defect category in the id, which the blind view forwards as candidate_id; that would tell a validator which items are controls.',
      'Source references are the NCERT supporting excerpts, the teaching-supplement excerpt (Business Studies Q4), the 230-word adapted stimulus and the cached dictionary definitions. The CBSE question spans are recorded exact, with hashes, in each fixture source_custody and are NOT supplied to validators: for a seeded defect the printed original would reveal the change by comparison.',
      'The original CBSE passage spans are recorded in the packet but not registered as a source: the adapted 230-word stimulus is the item stimulus and the original contains figures that the adaptation deliberately removed.',
      'Provider input bound: the first build of the Business Studies Q3 natural-defect fixture was 33,202 bytes against the runner bound of 33,024 under the frozen v7.5 request (preflight rejected it before any call). Its long functional-structure excerpt is now two exact sub-spans (definition; advantage (f) through the disadvantages); advantages (a)-(e) bear on no option. Stem, options, key, oracle and the divisional-structure excerpts are unchanged. The superseded first build is kept in construction-history-v1/.',
      'Business Studies Q4 uses three packet excerpts plus the separately located left-column definition from teaching-supplement-v1.json.',
      'Accountancy Q27 chapter is the canonical label Financial Statements of Company; the other chapter labels are the canonical labels of the packet.',
      "English item ix ('best described') is labelled reading_comprehension with an empty target_term: the only word it could name is the keyed word, and the v7.5 blind view forwards target_term to the solver, which would hand over the answer. Item iv (antonym) names its target word, negligible.",
      'Difficulty: easy for single-recall items; medium for the three multi-step Accountancy items (interest coverage: four linked calculations, labelled medium because definitions allow hard only for three or more linked steps and a medium label cannot be flagged as overstated; cash flow classification; equipment reconciliation) and for Economics Q1 and the EXCEPT item. No item is labelled hard.',
      'Seeded defects carry valid learning objectives so the measured rejection is the intended defect. The two out_of_syllabus items keep the root chapter label and unit, and state their true objective.',
      'Each seeded defect is one change to a clone of its root; explanations are deliberately left as written by the root where only the stem, key or an option changes (wrong_key, numerical_fault, missing_assumptions), as in the V73 precedent.'
    ],
    limitations: [
      'Two model-assisted derivations agreeing and an official key agreeing is not proof of correctness.',
      'English contributes only two valid positives (en-q1-iv, en-q1-ix; en-q1-i is held and en-q1-v is a natural defect). The pooled English valid denominator with the regression set is 3, so one loss leaves 0.667, below the 0.70 per-subject floor.',
      'The four English items share one 230-word stimulus, and seeded defects share a root with their positive; paired controls are correlated and this set cannot prove accuracy beyond its sample.'
    ],
    publication: 'never'
  },
  lineage: { source_packet_sha256: pins.packet, first_blind_solve_sha256: pins.first, second_blind_solve_sha256: pins.second, reference_custody_sha256: pins.custody, official_key_comparison_sha256: sha(join(SRC, 'OFFICIAL-KEY-COMPARISON-v1.json')),
    teaching_supplement_sha256: sha(join(SRC, 'teaching-supplement-v1.json')), incidental_exposure_disclosure_sha256: sha(join(SRC, 'incidental-exposure-disclosure-v1.json')), contract_freeze_sha256: sha(freezeFile),
    contract_frozen_at: freeze.frozen_at, plan_sha256: sha(join(ROOT, 'cuet-readiness-2026-10-09/V75-QUALIFICATION-PLAN.md')), source_registry_sha256: sha('data/source_registry.json'), global_source_registry_unchanged: true }
};
const freshCustody = {
  at: created, complete: true, positive_ids: positives.map(f => f.id), problems: [], raw_reference_denominator: 16,
  source_item_map: Object.fromEntries(fixtures.filter(f => f.defect_origin !== 'seeded').map(f => [f.id, f.source_custody.source_item_id])),
  source_key_records: positives.map(f => ({ id: f.id, ...f.source_custody })),
  natural_defect_ids: natural.map(f => f.id), held_reference_conflict_ids: ['v74-cbse22-en-q1-i'], withheld_source_item_ids: ['v74-cbse22-en-q1-i'],
  independent_derivations: { first: { reviewer: first.reviewer, sha256: pins.first }, second: { reviewer: second.reviewer, sha256: pins.second }, official_comparison_sha256: sha(join(SRC, 'OFFICIAL-KEY-COMPARISON-v1.json')),
    official_marking_scheme_opened_after_both_derivations: true, official_key_extraction: comparison.extraction },
  all_raw_comparison: comparison, validator_results_seen: false,
  limitation: 'Selection uses only pre-validation source and key evidence; all 16 raw cases, the held item and the 12 seeded mutations remain auditable. CBSE sample-paper derived, not authenticated CUET PYQs.'
};
const freshPrereg = `# v75-fresh-cbse2022-2026-10-09: preregistration

Frozen ${created}, before any v7.5 evaluation of these fixtures. Written under \`V75-QUALIFICATION-PLAN.md\` (9 October 2026) and the frozen contract \`v75-contract-freeze.json\` (frozen 2026-10-08T19:14:52Z, validator \`${FACTORY_VERIFIER_VERSION_V75}\`, contract \`${binding.validation_contract_hash}\`). Nothing in this study may change any v7.5 prompt, deterministic check, threshold or category after dispatch (operating rule 13): a failure is reported, not tuned around.

## Source and provenance
The 16-item CBSE Class XII 2022-23 sample-paper packet (\`questions-blinded-v1.json\`, sha256 ${pins.packet}), built for v7.4 on 8 October 2026 and never sent to any validator. Provenance label: \`source_keyed_non_cuet\`. These are not authenticated CUET PYQs; fixtures carry \`provenance.kind = original_practice\`.

## Denominator (${fixtures.length} fixtures)
| Role | Count | Accountancy | Business Studies | Economics | English |
|---|---|---|---|---|---|
| Valid positives (\`expected_valid: true\`) | ${positives.length} | ${perSubject(positives).accountancy} | ${perSubject(positives).business_studies} | ${perSubject(positives).economics} | ${perSubject(positives).english} |
| Natural defects (\`multiple_correct\`) | ${natural.length} | ${perSubject(natural).accountancy} | ${perSubject(natural).business_studies} | ${perSubject(natural).economics} | ${perSubject(natural).english} |
| Seeded controlled defects | ${seeded.length} | ${perSubject(seeded).accountancy} | ${perSubject(seeded).business_studies} | ${perSubject(seeded).economics} | ${perSubject(seeded).english} |

Held and excluded: \`v74-cbse22-en-q1-i\` (\`held_reference_conflict\`: both derivations chose B on the adapted passage, the official key maps to C on the original passage). It is not a fixture; it stays in the raw 16 denominator and is never forced to a key.

Positives: the 13 items where two independent blind derivations and the official CBSE marking-scheme comparison agree. Natural defects: \`bs-q03\` and \`en-q1-v\`, where both reviewers found more than one defensible answer. Seeded defects: exactly 12, three per subject, each a single objectively verifiable change to a clone of one valid positive. Categories: ${Object.entries(countBy(seeded, 'category')).map(([k, v]) => `${k} ${v}`).join(', ')}.

## Decision rule (unchanged \`RELEASE_POLICY_V7\`, \`cuet-fit-release-v2\`, topology \`dual_blind\`)
- Fresh false accepts: at most 0 (every expected-invalid fixture, natural or seeded, counts). Regression false accepts: at most 0.
- Valid survival at least 0.85 overall and at least 0.70 per subject, pooled over this set and the regression set. Abstention, provider error and quarantine all count against survival.
- Cost cap: USD 4 for both sets together, enforced by the persistent ledger (reserve before every call; failed or uncertain calls stay held at their maximum).
- No threshold, validator, prompt or category changes after dispatch. A defect label may not be reclassified after the result; a spent set becomes regression evidence.
- Pooled per-subject valid denominators with the regression positives: Accountancy 5, Business Studies 4, Economics 5, English 3. English therefore needs all 3 to clear the 0.70 floor.

## Disclosures
The constructor read the 16 items, the supplied teaching excerpts, both blind derivations and the official marking-scheme comparison before constructing the fixtures; v7.5 was frozen earlier and nothing in it was derived from these items. No validator or provider has seen any fixture. An authoritative-source search incidentally returned an official Accountancy 2022-23 marking-scheme snippet for non-selected question 34 on 8 October (\`incidental-exposure-disclosure-v1.json\`); selected questions 27-30 keys were opened only for the comparison after both derivations. Source families are correlated: the four English items share one 230-word stimulus and seeded defects share a root with their positive. A zero-false-accept result is a measurement on this sample, not proof of perfect accuracy. Fixture ids are opaque so that an id cannot reveal a control; the mapping to source items is in \`independent-key-custody.json\`. Full construction decisions are in \`frozen.json\` \`construction_disclosure\`. No generation, repair, publication, bank write or source-registry mutation is involved.
`;

// ---------------------------------------------------------------- regression study (re-bound v7.4 known-critical set)
const prevFrozen = read(V74 + '/frozen.json'), prevOverlay = read(V74 + '/scratch-registry-overlay.json'), prevCustody = read(V74 + '/independent-key-custody.json');
const RLO = {
  'cbse24-ac-q04': LO(U.admission, 'Record the treatment of a bad-debt write-off on the admission of a partner.', 'The student must know how a bad-debt write-off interacts with an existing provision on revaluation.'),
  'cbse24-bs-q02': LO(U.org, 'Identify which step of the organising process a described managerial action performs.', 'The student must distinguish the steps of the organising process.'),
  'cbse24-eco-q02': LO(U.budget, 'Match a described budget policy to the budgetary objective it illustrates.', 'The student must know the objectives of a government budget.'),
  'cbse24-eng-q01': LO(U.rc, 'Answer a direct comprehension question about one paragraph of a passage.', 'The student must read paragraph 1 to find what the notifications do.'),
  'cbse24-eco-q06': LO(U.budget, 'Identify the deficit measure that a given set of budget figures defines.', 'The student must know how each measure of government deficit is calculated.'),
  'cbse24-eco-q04': LO(U.open, 'Find the median of a small set of ordered observations.', 'The student must apply a stated definition of the median to the data.'),
  'known-bank-5bde762f1a36a3a7d894f0aa45f655e9': LO(U.admission, 'Match goodwill-premium situations on the admission of a partner with their accounting treatment.', 'The student must know how each way of receiving a goodwill premium is recorded.'),
  'known-bank-ea0352db044b73bb7158800c58be188d': LO(U.budget, 'Classify government receipts as revenue or capital receipts.', 'The student must know the test that separates revenue receipts from capital receipts.')
};
// Provider input bound: known-bank-5bde... was 33,583 bytes against the runner bound of 33,024 under the frozen v7.5 request (v7.4: 31,597). One of its
// three references (NCERT Admission of a Partner, 2.5.4 'Methods of Valuation of Goodwill') bears on neither the stem, the options nor the key (the
// item concerns the treatment of a premium brought in by a new partner), so that reference alone is removed from the candidate and its oracle.
const DROPPED_REF = { fixture: 'known-bank-5bde762f1a36a3a7d894f0aa45f655e9', source: 'ncert-leac102', locator: 'span-ae361e8a3770' };
const dropped = [];
const regFixtures = structuredClone(prevFrozen.fixtures).map(f => {
  const root = f.id.split('--')[0], lo = RLO[root];
  if (!lo) throw Error('regression_learning_objective_missing:' + f.id);
  f.candidate.learning_objective = structuredClone(lo);
  f.v75_additions = ['learning_objective'];
  if (f.id === DROPPED_REF.fixture) {
    const before = f.candidate.source_refs.length, hit = r => r.id === DROPPED_REF.source && r.locator === DROPPED_REF.locator;
    f.candidate.source_refs = f.candidate.source_refs.filter(r => !hit(r)); f.oracle.source_refs = f.oracle.source_refs.filter(r => !hit(r));
    if (f.candidate.source_refs.length !== before - 1) throw Error('dropped_reference_not_found');
    f.v75_additions.push('irrelevant_oversized_source_reference_removed'); dropped.push({ ...DROPPED_REF, refs_before: before, refs_after: f.candidate.source_refs.length });
  }
  return f;
});
if (regFixtures.length !== prevFrozen.fixtures.length || regFixtures.length !== 12) throw Error('regression_fixture_set_changed');
const regFrozen = {
  ...prevFrozen, id: REG_ID, created_at: created, fixtures: regFixtures, payload_hash: payloadHash(regFixtures), denominator: regFixtures.length,
  valid_roots: regFixtures.filter(f => f.expected_valid).length, controlled_defects: regFixtures.filter(f => !f.expected_valid).length, contract_binding: binding, verifier_version: FACTORY_VERIFIER_VERSION_V75,
  release_eligibility: { scope: 'regression', classification: 'regression', approved_before_evaluation: true, previously_read: true, tuned_on: true, preregistration_id: REG_ID },
  construction_disclosure: {
    summary: 'The twelve fixtures of v74-known-critical-regression-2026-10-08 (four previously observed positives, six previously observed controlled failures and two real bank failures), all kept, re-bound to the frozen v7.5 contract binding. Regression evidence only, never fresh reliability evidence.',
    unchanged: 'Fixture ids, stems, options, keys, explanations, oracle keys and source_custody are byte-identical to the v7.4 set, and so are the source references of eleven of the twelve fixtures. The scratch registry overlay is the v7.4 overlay unchanged.',
    source_reference_change: { ...dropped[0], reason: 'Provider input bound. Under the frozen v7.5 request this fixture was 33,583 bytes against the runner bound of 33,024 (v7.4: 31,597 bytes); the runner preflight rejected it before any call. The removed reference is the NCERT 2.5.4 Methods of Valuation of Goodwill excerpt, which bears on neither the stem, the options nor the key. The two premium-treatment references and the corroborating worked entry are kept. The superseded first build is kept in construction-history-v1/.' },
    additions: 'v7.5 requires a stated learning_objective for every original_practice candidate (deterministic check learning_objective_missing). Without it all twelve would be quarantined before any paid call, for a reason unrelated to correctness. A learning_objective {syllabus_unit, objective, target_term "", why_answer_requires_it} was added to each of the twelve fixtures (defect variants carry their root objective). This is the only change to any candidate. The objectives were written from the stems and do not state any keyed answer.',
    out_of_syllabus_note: 'cbse24-eco-q04 (median) keeps the root chapter label and unit and states its true objective, as in v7.4.',
    id_note: 'Ids are unchanged from v7.4 and still name the root and defect category (they were observed under those ids); this set is regression evidence, not blind fresh evidence.',
    previous_v74_evidence: 'Accepted v7.4 request ids and conservative holds are untouched. v7.5 requests carry new v7.5-scoped keys.',
    publication: 'never'
  },
  lineage: { previous_frozen_sha256: sha(V74 + '/frozen.json'), previous_overlay_sha256: sha(V74 + '/scratch-registry-overlay.json'), previous_custody_sha256: sha(V74 + '/independent-key-custody.json'), contract_freeze_sha256: sha(freezeFile),
    plan_sha256: sha(join(ROOT, 'cuet-readiness-2026-10-09/V75-QUALIFICATION-PLAN.md')), original_bank_unchanged: true, global_source_registry_unchanged: true }
};
const regCustody = { ...prevCustody, at: created, lineage: regFrozen.lineage, positive_ids: regFixtures.filter(f => f.expected_valid).map(f => f.id), fresh_evidence: false, rebound_from: prevFrozen.id,
  known_failures: prevCustody.known_failures };
const regPrereg = `# v75-known-critical-regression-2026-10-09: preregistration

Frozen ${created}. Regression evidence only (\`previously_read\`, \`tuned_on\`): never fresh reliability evidence. Written under \`V75-QUALIFICATION-PLAN.md\` and the frozen v7.5 contract (\`${FACTORY_VERIFIER_VERSION_V75}\`, contract \`${binding.validation_contract_hash}\`).

The complete denominator is the twelve fixtures of \`v74-known-critical-regression-2026-10-08\`, none dropped: four previously observed positives (Accountancy, Business Studies, Economics, English), six previously observed controlled failures and two real bank failures independently diagnosed in the owner review. Every critical failure must remain unavailable (zero regression false accepts); positive losses are preserved and reported. Valid survival (pooled with the fresh set) must be at least 0.85 overall and 0.70 per subject.

Re-binding: contract binding is \`expectedReleaseBindingV75()\`. Candidate changes: (1) an added \`learning_objective\` on every fixture (v7.5 makes it mandatory for original_practice; without it all would be quarantined before any paid call for a reason unrelated to correctness); (2) for \`known-bank-5bde762f1a36a3a7d894f0aa45f655e9\` only, one irrelevant source reference (NCERT 2.5.4 Methods of Valuation of Goodwill) is removed because the fixture otherwise exceeds the provider input bound under the v7.5 request (33,583 against 33,024 bytes; preflight rejected it before any call). Stems, options, keys, explanations and oracle keys are unchanged. Haiku is excluded from this regression set; Luna and Gemini retain every publication-validation stage. Accepted v7.4 request ids and conservative holds are untouched; v7.5 requests use new v7.5-scoped keys, so no uncertain accepted key is resent. Cost cap USD 4 across both sets, enforced by the persistent ledger. No generation, repair, publication, source-registry mutation or relabelling.
`;

// ---------------------------------------------------------------- checks, report, write
const fullRegistryReg = { ...registry, sources: { ...registry.sources, ...prevOverlay.sources }, families: { ...registry.families, ...prevOverlay.families }, packs: { ...registry.packs, ...prevOverlay.packs } };
const fresh = localReport(fixtures), reg = localReport(regFixtures, fullRegistryReg);
assertReleaseEvidenceRoleV73(freshFrozen.release_eligibility); assertReleaseEvidenceRoleV73(regFrozen.release_eligibility);
assertBenchmarkProvenanceV73(fixtures, 'fresh'); assertBenchmarkProvenanceV73(regFixtures, 'regression');
assertCustodySetV73({ fixtureIds: fixtures.map(f => f.id), positiveIds: positives.map(f => f.id), custody: freshCustody });
assertCustodySetV73({ fixtureIds: regFixtures.map(f => f.id), positiveIds: regFixtures.filter(f => f.expected_valid).map(f => f.id), custody: regCustody });
const bad = list => list.filter(r => r.structure.length || r.presentation.length || r.provenance.length);
const summary = { dry_run: dryRun, fresh: { id: FRESH_ID, denominator: fixtures.length, positives: perSubject(positives), natural: perSubject(natural), seeded: perSubject(seeded), seeded_by_category: countBy(seeded, 'category'), payload_hash: freshFrozen.payload_hash,
    local_structural_failures: bad(fresh), preparation_value: fresh.filter(r => r.preparation.length).map(r => ({ id: r.id, expected_valid: r.expected_valid, category: r.category, findings: r.preparation })) },
  regression: { id: REG_ID, denominator: regFixtures.length, positives: regFixtures.filter(f => f.expected_valid).length, defects: regFixtures.filter(f => !f.expected_valid).length, payload_hash: regFrozen.payload_hash, local_structural_failures: bad(reg),
    preparation_value: reg.filter(r => r.preparation.length).map(r => ({ id: r.id, expected_valid: r.expected_valid, category: r.category, findings: r.preparation })) }, paid_calls: 0 };
if (dryRun) { console.log(JSON.stringify(summary, null, 1)); process.exit(0); }

const save = (dir, name, value) => writeFileSync(join(dir, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
mkdirSync(FRESH_DIR, { recursive: true }); mkdirSync(REG_DIR, { recursive: true });
save(FRESH_DIR, 'frozen.json', freshFrozen); save(FRESH_DIR, 'scratch-registry-overlay.json', overlay); save(FRESH_DIR, 'independent-key-custody.json', freshCustody); save(FRESH_DIR, 'PREREGISTRATION.md', freshPrereg);
save(REG_DIR, 'frozen.json', regFrozen); save(REG_DIR, 'scratch-registry-overlay.json', prevOverlay); save(REG_DIR, 'independent-key-custody.json', regCustody); save(REG_DIR, 'PREREGISTRATION.md', regPrereg);
console.log(JSON.stringify({ ...summary, written: [rel(FRESH_DIR), rel(REG_DIR)], publication_writes: 0 }));
