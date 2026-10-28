// Compile the owner's one-off review. No provider calls, publication, label changes,
// or accounting writes. Independent answers and original judgments remain immutable.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { hashJSON } from '../../../data/question_factory_policy.mjs';

const dirIndex = process.argv.indexOf('--dir');
const dir = (dirIndex < 0 ? 'artifacts/question-factory/cuet-readiness-2026-10-08/execution/owner-127-review' : process.argv[dirIndex + 1]).replace(/[\\/]$/, '') + '/';
const hash = value => createHash('sha256').update(value).digest('hex');
const read = name => JSON.parse(readFileSync(dir + name, 'utf8'));
const manifest = read('manifest.json');
for (const file of manifest.files) {
  if (hash(readFileSync(dir + file.name)) !== file.sha256) throw Error('Frozen packet changed: ' + file.name);
}
for (const name of ['OWNER-127-REVIEW.json', 'OWNER-127-REVIEW.md', 'business_studies.review.json', 'economics.review.json', 'english.review.json']) {
  if (existsSync(dir + name)) throw Error('Review output already exists; preserve the dated result: ' + name);
}

const decisions = new Map();
const set = (id, disposition, codes, finding, next_action, extra = {}) => decisions.set(id, { disposition, codes, finding, next_action, ...extra });
const repair = (id, codes, finding, next, extra) => set(id, 'repair_needed', codes, finding, next, extra);
const uncertain = (id, codes, finding, next, extra) => set(id, 'quarantine_uncertain', codes, finding, next, extra);
const evidence = (id, codes, finding, next, extra) => set(id, 'evidence_refresh_needed', codes, finding, next, extra);
const fit = (id, finding, next) => set(id, 'cuet_fit_revision_needed', ['learning_objective_specificity'], finding, next);

// Accountancy: post-solve checking supersedes neither the frozen labels nor the
// first reviewer. The raw review's all-true gates are explicitly not certification.
uncertain('4115a8da29d5db85791e1ebac2a51510', ['nonunique_process_order'],
  'B-A-C-D is the intended accounting workflow. The balance is already stipulated; B-A-D-C can present it and then verify it. The source does not prescribe this verification order.',
  'Make C determine the resulting balance before preparing the balance sheet, then re-solve the changed content.', { alternative_options: ['B', 'D'] });
repair('7b4662c4e2166c62f863a6ae1da78ba6', ['nonunique_process_order'],
  'A-C-B-D can first infer the transaction allocation and then establish separate accounts; A-B-C-D is not the only coherent reasoning sequence.',
  'Ask about actual account-opening and posting dependencies, rather than a preferred reasoning order.', { alternative_options: ['A', 'B'] });
uncertain('20e278c61e343db83349eded6916c255', ['option_category_overlap'],
  'C is the most specific matching, but A also demonstrates more than one method; D lists methods that may yield different values. Broad inference categories do not firmly exclude option D.',
  'Ask for the most specifically illustrated rule or make the categories mutually exclusive.', { alternative_options: ['C', 'D'] });
repair('5bde762f1a36a3a7d894f0aa45f655e9', ['incorrect_journal_entry', 'source_internal_contradiction'],
  'List-II(ii) credits Premium for Goodwill on receipt but subsequently debits Goodwill. This leaves the credited premium account uncleared. NCERT printed page64 repeats the faulty entry; its worked example on page66 correctly debits Premium for Goodwill. Matching the faulty printed line is not independent accounting verification.',
  'Replace Goodwill A/c Dr. in List-II(ii) with Premium for Goodwill A/c Dr.; bind a new source excerpt to the page66 worked entry, invalidate old checks and independently revalidate.',
  { corroboration: { cached_pdf: 'data/question-factory-runtime/reference-downloads/leac102.pdf', printed_pages: [64, 66], visual_files: ['leac102-page64.png', 'leac102-page66.png'], worked_text_file: 'leac102-page66-worked-journal.txt' } });

// Business Studies: don't invent a universal order from a list of considerations.
repair('f29bdfa666f5575a28dfe749ec329a45', ['option_category_overlap'],
  'Filing an individual complaint can be both the specifically named filing role and legal assistance. C is intended, but B is not firmly excluded by the broadly phrased case.',
  'Ask for the most specifically listed role or replace the overlapping legal-assistance option.', { alternative_options: ['B', 'C'] });
repair('5f649f52cbfb1439a77ef9b48ba42e8b', ['nonunique_process_order', 'unsupported_explanation_order'],
  'A-B-C-D and A-B-D-C can respectively report before analysis or analyse before escalation. The selected controlling excerpt does not require reporting before analysis.',
  'Supply an explicit workflow dependency or ask for the controlling principle instead of an unsupported order.', { alternative_options: ['A', 'D'] });
repair('9ea83c0e4f7dc6c133f9a1bb16bee6a7', ['nonunique_process_order'],
  'The food-bank example and a general statement of management pervasiveness can appear in either reasoning order. D-B-C-A and D-C-B-A are coherent.',
  'Introduce specific textual dependencies, or replace the reasoning-order task with a concept application.', { alternative_options: ['B', 'C'] });
repair('e8a06388bc4cc402576482908fd381f8', ['nonunique_process_order'],
  'Financial planning requires amounts, timing and sources, but the cited description does not require deciding timing before sources. B-D-A-C and B-A-D-C are reasonable.',
  'Ask which considerations belong to financial planning, or specify an actual dependent procedure.', { alternative_options: ['A', 'C'] });
evidence('30c559b7cee4ab97a2a9c9c85ca4bd30', ['format_metadata_mismatch'],
  'The key and controlling rule are supported, but the task is a direct conceptual MCQ, not the stored statement-selection format.',
  'Correct the format metadata, produce a new content/evidence identity as required, and revalidate without changing the answer.');
evidence('90ec25792703058c191b0275f1912a44', ['format_metadata_mismatch'],
  'The discipline example is supported and has a defensible key. It contains no ordering task despite a sequence-ordering tag.',
  'Correct the assigned format to the actual conceptual task and refresh its verification.');
evidence('89cfa7dc25a1ec3a95e633660a40ce0d', ['duplicated_option_presentation'],
  'The consumer-exclusion matching is supported, but all four choices are printed both inside the stem and in the option array.',
  'Remove the duplicate choice block from the stem and revalidate the changed presentation.');
fit('296e6c135c976583eb0f54b193502fef',
  'The answer is logically supported, but the matches mostly repeat supplied reward/expectation wording without identifying a specific Directing learning objective. This is a CUET relevance concern, not a wrong-key finding.',
  'Rewrite around a named motivation or incentive concept from the official unit; establish fit against the subject/format examples.');

// Economics: full excerpts corrected several mistaken first-review source gaps.
repair('3dce0344d7ad78f4346cd451c509983e', ['nonunique_process_order'],
  'A reader can collect all chosen-price quantities before summing them, or read/sum one price at a time. The source supports market-supply aggregation, not a unique reading workflow.',
  'Make the repetition step explicitly repeat both reading and summation before plotting, with a new blind solve.');
repair('0de322e27637f76ac593c99028e4cafa', ['missing_decisive_assumption'],
  'An intended inventory addition is not necessarily realised. The calculation treats the planned120000 addition as actual, although the stem only says it is planned.',
  'State that120000 was actually added, then35000 sold, with no other inventory movements.');
repair('559f599c8fa9caddcb113a5b81282e96', ['nonunique_process_order'],
  'The employment conclusions admit more than one coherent exposition. The unstated chapter order is not a self-contained dependency.',
  'Provide a passage with genuine textual links or ask for the economic conclusion instead of a preferred exposition order.');
uncertain('8ae5b51a291e1e4af741fed6b275739c', ['primary_deficit_definition_scope'],
  'The first blind solver chose720000 using fiscal deficit minus interest payments. The FULL selected excerpt also gives gross primary deficit as gross fiscal deficit minus NET interest liabilities (payments minus receipts), supporting the stored740000. The earlier categorical wrong-key finding was not justified.',
  'Specify gross fiscal/primary deficit and the net-interest convention explicitly. Preserve the first blind disagreement; do not relabel the old key as definitely wrong.');
repair('a79e5e82cbf1f836af8fb5c7428f666e', ['incomplete_referenced_condition'],
  'The5% arithmetic is correct, but the question refers to a stated condition for unproductiveness without stating it or identifying the human-capital perspective. The source distinguishes that perspective from human development.',
  'Name the human-capital perspective and include the output-based condition before asking whether it is met.');
repair('ea0352db044b73bb7158800c58be188d', ['missing_decisive_assumption', 'unsupported_generalization'],
  'No claim on government is insufficient to classify every non-tax receipt as revenue. An asset-sale receipt can be non-debt capital. The FULL cached chapter separately says receipts reducing financial assets are capital receipts.',
  'State that neither receipt creates a liability NOR reduces a government asset, or name a supported non-tax revenue example; correct the explanation.',
  { corroboration: { cached_text: 'data/question-factory-runtime/reference-downloads/leec105.normalized.txt', section: 'Capital Receipts', rule: 'Receipts that create liability or reduce financial assets are capital receipts.' } });
fit('5d2cf0d217e3ccb43730a4b1eecdab61',
  'The90 worker-months calculation is correct, but it mainly tests a supplied fraction and multiplication; the connection to an official Employment learning objective is weak.',
  'Use a recognised employment measure or economic inference, rather than adding difficulty to the arithmetic.');
fit('75ec5aa6e1c81eda20121fb91aa2db43',
  'The task asks for a textbook three-part presentation order that the student is not given. Chapter layout is not itself an Economics learning objective.',
  'Ask about the environmental functions, crisis or sustainability relationship supported by the chapter.');
evidence('f5c7d0572d7d7222effd5b40f5f8a117', ['duplicated_option_presentation'],
  'The historical facts and matching are explicitly supported; simple recall/comprehension is permissible. The stem unnecessarily repeats the four choices.',
  'Remove duplicate choices from the stem and retain its easy-level label on revalidation.');
evidence('b26c48b73d3af972154a476ba7d8f802', ['duplicated_option_presentation'],
  'The organic-farming matching is supported, but the choices appear twice.',
  'Remove duplicated choices from the stem, then revalidate the new presentation.');
uncertain('feb840a6e49b6592386adcc5fd2bf8a2', ['source_name_discrepancy', 'learning_objective_specificity'],
  'The FULL selected NCERT excerpt includes the attribution and year, so it is not a missing-citation failure. However it spells the name Vruce; National Library of Scotland records identify Victor Alexander Bruce. The matching mostly paraphrases the supplied quotation rather than testing colonial economic policy.',
  'Remove the unnecessary personal attribution or corroborate the correct identity, and ask an in-unit economic interpretation. Do not silently correct a frozen source.',
  { corroboration: { source_title: 'National Library of Scotland annual report supplementary acquisitions', url: 'https://www.nls.uk/media-u4/22509/areport00-sup.pdf', supporting_fact: 'Identifies Victor Alexander Bruce as the9th Earl of Elgin.', additional_url: 'https://catalogue.nrscotland.gov.uk/nrasregister/details.aspx?reference=NRAS3955/76' } });

// English: retain genuine text dependencies; flag uncertainty and duplicate ideas.
uncertain('b7b7e9358ed2fc2a03d80893a060d198', ['ambiguous_text_reference'],
  'Arrangement ready can mean the seating plan is ready or the physical chairs are ready. Checking it before or after positioning chairs yields a plausible second reading.',
  'Specify that the volunteers have finished positioning the chairs before the final check.', { alternative_options: ['C', 'D'] });
uncertain('9bd2d77281ddf33604855c9a579c0c71', ['ambiguous_text_reference', 'duplicate_idea'],
  'It repeats the other seating-plan/chair-positioning idea and the ready-arrangement ambiguity.',
  'Resolve the reference and retain only one distinct question idea.', { alternative_options: ['B', 'D'], duplicate_of: 'b7b7e9358ed2fc2a03d80893a060d198' });
set('21ffdb2198b350582fa6e53d8a820211', 'duplicate_hold', ['duplicate_idea'],
  'The parcel-receive/check/open/count/record sequence repeats6e65669238f8a31b656dbe0e711a7e70, despite changed sentence labels. The key can be right without producing a unique new idea.',
  'Keep the earlier distinct parcel item as the reconsideration candidate; withhold this duplicate from unique yield.', { duplicate_of: '6e65669238f8a31b656dbe0e711a7e70' });
fit('379191f2d6fa6e4844bf6a8b159f1a10',
  'The classification is answerable, but the target word obsolete is absent from the task. The question mostly categorises supplied scenarios rather than testing a defined English vocabulary objective.',
  'Ask directly about contextual word meaning or usage, with appropriate distractors.');
uncertain('246b07ecc64527cc6bb4f40f5c47d6b6', ['contextual_option_overlap_uncertain'],
  'Diligent is the strongest definition match for care and effort. Vigilant can nevertheless be natural in audit duties that involve noticing errors. This is a possible contextual overlap, not proof of two equally good dictionary answers.',
  'Use a disjoint distractor or a context that decisively separates sustained effort from watchfulness.');

const notes = {
  '774fae6c1244e20f676a2f110fcb1c31': 'The first reviewer recommended a signed-flow clarification. Post-review treats the selected net-increase/decrease accounting convention as supporting C; no established wrong key. Optional wording improvement must not be reported as an accuracy failure.',
  '20cc88e8ab11b76d9e44bd28a36ac435': 'The first reviewer saved A with the reversed debit/credit reasoning. The later review called this a letter typo, which was inaccurate: both text and letter were reversed. A sacrifices1/5 and is CREDITED; B gains1/5 and is DEBITED. Stored D and its explanation are correct. Preserve the original reviewer error.',
  'ea1434b63fed9b916708438120026842': 'The first reviewer included primary-sector mining and chose70%. The stem explicitly restricts non-farm work to secondary plus tertiary:44/80=55%, stored B. Preserve the original blind error rather than calling this an original-question error.',
  'dcfd6f830603113f3ee7e5b4e151d092': 'The actual selected p3-c0 excerpt supports extraction not exceeding regeneration. Three months regenerate96 lakh; existing43 leaves53; proposed58 exceeds it by5. A shortened reviewer quote was not the full evidence.',
  '625a65a8ebc2b5d43ffecf1736ec00f9': 'The actual p16-c0 recap explicitly gives China1978, Pakistan1988, India1991. Earlier short-quote source-gap speculation is withdrawn.',
  'c8a1c42c391a251f2d76b33be6319236': 'The full pdf-page-5 excerpt explicitly gives aggregate output growth below2%, per-capita growth half-percent, no sincere government estimate, and Rao. Earlier short-quote source-gap speculation is withdrawn.',
  'af5aa1c337402262a710eace8dc504ab': 'The selected p9-c1863 excerpt gives3 lakh in1951 and35 crore in2022. The question explicitly tells the student to use those stated counts.3497 lakh=34 crore97 lakh; the approximate wording does not make35 crore the requested exact subtraction.',
  'c9557cd208cfc88032d6349e0e5ced8c': 'The full selected trade excerpt supports the stated unequal-access criticism. The question is explicitly hypothetical; it does not establish a current WTO legal rule.',
  '9081a9c01da9a7634cfc78b889b8129f': 'The complete short original passage is the primary answer evidence. A downloaded textbook is not required to establish its internal events. It remains linked atomically with7c93ba5270b262b8aba33c51780d0ea0.',
  '7c93ba5270b262b8aba33c51780d0ea0': 'This was an eligible passage sibling retained in the127 denominator by group closure. Its answer is supported by the passage; evaluate and republish the group together. Related interpretation objectives are close, so bank-wide novelty is not proven.',
  '11a1cd0da911c0091e9884629edb5165': 'The qualification about a particular project is awkward but not itself an unsupported universal claim. This is a craft note; it is not used to manufacture a hard rejection.',
  'a16e39232c7d786caacf29f78cc35ffb': 'The source explicitly supports all four physical-distribution functions. The hard label overstates an ordinary easy/medium matching task; this is a difficulty-label concern, not a wrong key.',
  'ed7bb5598ff5e89266efbdd5501f84a2': 'Four independent deviations are correct: output−30; time+.5min; defects6 per1000, deviation0; cost+9000. Unit conversion and benchmark comparison are actual Controlling applications.',
};

const dimensions = [
  ['syllabus_entitlement', true], ['source_support', true], ['independently_solved_key', true],
  ['one_correct_answer', true], ['option_non_overlap', true], ['explicit_decisive_assumptions', true],
  ['numerical_accuracy', true], ['boundary_cases_where_relevant', true], ['explanation_correctness', true],
  ['explanation_support', true], ['passage_answerability', true], ['completeness', true],
  ['cuet_format', false], ['language_clarity', false], ['distractor_plausibility', false],
  ['difficulty_suitability', false], ['novelty', false], ['presentation', true], ['source_provenance_integrity', true],
].map(([name, mandatory]) => ({ name, mandatory }));

const files = readdirSync(dir).filter(f => f.endsWith('.blind.json')).sort();
const records = [], custody = [];
for (const file of files) {
  const blind = read(file), independentFile = file.replace('.blind.', '.independent.'), originalFile = file.replace('.blind.', '.comparison.');
  const independent = read(independentFile), original = read(originalFile);
  const storedBlindHash = independent.input_sha256 || independent.blind_packet_sha256 || independent.blind_input?.sha256;
  if (storedBlindHash !== hash(readFileSync(dir + file))) throw Error('Independent answer bound to different blind packet: ' + file);
  if (independent.comparison_opened === true || independent.comparison_files_opened === true) throw Error('Not saved blind: ' + independentFile);
  custody.push({ blind_file: file, independent_file: independentFile, independent_sha256: hash(readFileSync(dir + independentFile)), original_file: originalFile, before_comparison: true });
  const solved = independent.cases || independent.items;
  for (const item of blind.cases) {
    const first = solved.find(s => (s.id || s.case_id) === item.id), prior = original.cases.find(s => s.id === item.id);
    if (!first || !prior || (first.content_hash || first.blind_content_hash) !== item.content_hash || prior.content_hash !== item.content_hash) throw Error('Missing/mismatched item: ' + item.id);
    const firstKey = first.defensible_option || first.independent_key || first.independent_answer || first.independent_correct_option;
    const sources = item.source_keys.map(k => ({ key: k, ...blind.sources[k] }));
    if (sources.some(s => !s.text || hashJSON(s.text) !== s.support_hash || !s.excerpt_matches_saved_support_hash)) throw Error('Source hash mismatch: ' + item.id);
    const decision = decisions.get(item.id) || {
      disposition: 'reconsider_unchanged', codes: [],
      finding: 'No specific mandatory defect was identified in this source/calculation and option review. This is a provisional reconsideration recommendation, not current automated eligibility or publication approval.',
      next_action: 'Retain unchanged content as a reconsideration candidate; obtain current source-bound automated evidence after the validator qualifies. Do not erase the prior rejection.',
    };
    records.push({
      id: item.id, subject: blind.subject, content_hash: item.content_hash, metadata: item.metadata,
      original_question: item.question, original_key: prior.key, original_explanation: prior.explanation,
      original_assessment: prior.prior_assessment, withholding_group: prior.withholding_group,
      supporting_excerpts: sources,
      independent: { file: independentFile, first_key: firstKey, first_key_matches_stored: firstKey === prior.key, original_record: first },
      adjudication: { ...decision, note: notes[item.id] || null },
      criteria: dimensions.map(d => ({ ...d, status: criterionStatus(d.name, item, decision), basis: criterionBasis(d.name, item, decision) })),
      cuet_fit: { status: decision.disposition === 'cuet_fit_revision_needed' ? 'learning_objective_needs_revision' : 'provisional_ungraded', numeric_score: null, current_exemplar_calibrated_release: false, easy_is_not_a_defect: true },
      original_labels_preserved: true, manual_publication_authorization: false, current_release_qualified: false,
    });
  }
}
function criterionStatus(name, item, decision) {
  const codes = decision.codes;
  if (name === 'independently_solved_key') return 'answer_saved_before_original_key';
  if (name === 'novelty') return codes.includes('duplicate_idea') ? 'duplicate_idea_identified' : 'bank_wide_not_established';
  if (name === 'cuet_format') return codes.includes('format_metadata_mismatch') ? 'metadata_mismatch' : 'recognised_task_format_provisional';
  if (name === 'difficulty_suitability') return 'qualitative_only_not_recalibrated';
  if (name === 'boundary_cases_where_relevant') return 'reviewed_where_applicable_no_general_proof';
  if (name === 'source_provenance_integrity') return codes.includes('source_internal_contradiction') || codes.includes('source_name_discrepancy') ? 'source_conflict_requires_resolution' : 'frozen_excerpt_identity_checked_not_new_document_authentication';
  if (name === 'presentation' && codes.includes('duplicated_option_presentation')) return 'duplicate_choices_need_cleanup';
  if (name === 'completeness' && codes.includes('incomplete_referenced_condition')) return 'missing_referenced_condition';
  if (['one_correct_answer','option_non_overlap'].includes(name) && codes.some(c => /order|overlap|reference|definition_scope|incorrect_journal/.test(c))) return decision.disposition === 'quarantine_uncertain' ? 'uncertain_withhold' : 'identified_defect_withhold';
  if (name === 'explicit_decisive_assumptions' && codes.some(c => /assumption|condition|definition_scope/.test(c))) return 'needs_explicit_decisive_condition';
  if (['source_support','explanation_correctness','explanation_support'].includes(name) && codes.some(c => /journal|unsupported|source_internal|source_name/.test(c))) return 'defect_or_conflict_requires_resolution';
  if (name === 'passage_answerability') return item.question.passage ? 'complete_passage_reviewed' : 'not_a_passage_item';
  return 'no_specific_defect_identified_provisional';
}
function criterionBasis(name, item, decision) {
  if (name === 'novelty') return 'Duplicate-idea inspection is confined to this127-item set; no claim that the entire bank is unique.';
  if (name === 'source_provenance_integrity') return 'Selected excerpt text/hash, source identity, permission and registry match are retained. Citation existence is not entailment.';
  if (name === 'independently_solved_key') return 'Original blind derivation is preserved; post-comparison corrections are separately disclosed.';
  if (['source_support','explanation_support'].includes(name)) return 'Full selected excerpts and unchanged explanation retained for inspection; do not treat the first reviewer\'s shortened/paraphrased quote as a newly verified exact quotation.';
  if (['cuet_format','difficulty_suitability','distractor_plausibility'].includes(name)) return 'Qualitative owner-requested review. No fabricated numerical rating or fresh matched-PYQ calibration.';
  return decision.finding;
}
if (records.length !== 127 || new Set(records.map(r => r.id)).size !== 127) throw Error('Full127 denominator not retained.');
for (const id of decisions.keys()) if (!records.some(r => r.id === id)) throw Error('Adjudication refers to absent case: ' + id);
const counts = rows => Object.fromEntries([...new Set(rows.map(r => r.adjudication.disposition))].map(k => [k, rows.filter(r => r.adjudication.disposition === k).length]));
const db = new DatabaseSync('data/pipeline-budget.sqlite', { readOnly: true });
const costs = db.prepare("SELECT COUNT(*) requests, SUM(CASE WHEN state='settled' THEN COALESCE(actual,0) ELSE 0 END) settled, SUM(CASE WHEN state='settled' THEN 0 ELSE MAX(COALESCE(reserved,0),COALESCE(actual,0)) END) held FROM requests").get();
db.close();
const at = new Date().toISOString(), campaign = JSON.parse(readFileSync('artifacts/question-factory/cuet-readiness-cost-source-c-100-2026-10-08/batch-report.json'));
const summary = {
  schema: 'owner-127-post-solve-adjudication-v1', at, denominator: 127, reviewed: 127, pending_review: 0,
  counts: counts(records), counts_by_subject: Object.fromEntries(Object.keys(manifest.counts).map(s => [s, { reviewed: records.filter(r => r.subject === s).length, ...counts(records.filter(r => r.subject === s)) }])),
  blind_first_key_agreement: { matches: records.filter(r => r.independent.first_key_matches_stored).length, denominator: 127, basis: 'Agreement with original stored key, not independently measured correctness.' },
  new_current_release_qualified: 0, new_publications: 0, paid_factory_calls: 0, accounting_writes: 0, original_label_changes: 0,
  classification: 'owner-authorized one-off diagnostic; previously inspected bank, not fresh validator-release evidence',
  limits: [
    'Subagent first reviews made errors; the raw all-true gates are not accepted as certification.',
    'A source can itself be faulty. The journal contradiction was verified visually and by the worked example, not by majority vote.',
    'Reconsideration means no specific mandatory defect found in this review, not independently measured CUET readiness.',
    'No arbitrary10/10 ratings assigned. No bank-wide uniqueness, timing study or current release inferred.',
    'Production remained unchanged; the dated deployed-feed proof showed all127 still served. Staging withholding is separate.',
  ],
  contract: { review_dimensions: dimensions, mandatory_gates_cannot_be_offset_by_scores: true, source_and_verifier_changes_require_new_evidence: true, at_most_one_targeted_repair: true },
  custody, frozen_manifest_sha256: hash(readFileSync(dir + 'manifest.json')),
  lifetime: { at, settled_usd: costs.settled / 1e6, held_usd: costs.held / 1e6, committed_usd: (costs.settled + costs.held) / 1e6, remaining_of50_usd: (50e6 - costs.settled - costs.held) / 1e6, provider_invoice_obtained: false },
  campaign_c_snapshot: { report_at: campaign.at, denominator: campaign.denominator, eligible: campaign.approved_unique, rejected: campaign.rejected, pending: campaign.pending, cost: campaign.cost, provider_processing_complete: campaign.provider_processing_complete },
  records,
};
writeFileSync(dir + 'OWNER-127-REVIEW.json', JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
for (const subject of ['business_studies', 'economics', 'english']) {
  const items = records.filter(r => r.subject === subject);
  writeFileSync(dir + subject + '.review.json', JSON.stringify({ schema: summary.schema, at, subject, denominator: items.length, counts: counts(items), publication_authorization: false, items }, null, 2) + '\n', { flag: 'wx' });
}
const rows = records.map(r => `| ${r.subject} | ${r.id} | ${r.adjudication.disposition} | ${r.adjudication.codes.join(', ') || 'No specific mandatory defect identified'} |`).join('\n');
const report = `# Owner-requested review of127 flagged bank questions\n\nCompleted ${at}. All127 unchanged IDs and frozen first answers are retained. This is a one-off diagnostic, not a fresh benchmark or a publication approval. No factory model calls, original-label changes, accounting writes or production writes were made by this compiler.\n\n## Result\n\n${Object.entries(summary.counts).map(([k,v]) => `- ${k}: ${v}`).join('\n')}\n\nReconsideration is not current qualification: **zero** questions acquire current release-qualified evidence from this audit. First blind key agreement was ${summary.blind_first_key_agreement.matches}/127; stored-key agreement does not establish truth. The first reviews missed a real journal fault and made debit/credit and non-farm arithmetic errors. Their uncorrected records remain available.\n\n## Decisive findings\n\n- NCERT printed page64's goodwill entry conflicts with its worked journal on page66. The item copying it needs repair; verified citations are insufficient. Both pages were rendered and visually inspected.\n- Several ordering items prescribe a preferred reasoning order without a unique dependency. Consumer-role and goodwill-inference categories can overlap. Unresolved alternatives remain withheld.\n- The inventory problem treats a plan as an actual addition. The non-tax-receipt explanation omits asset-reducing capital receipts. The human-capital question refers to a condition it does not supply.\n- The gross/net primary-deficit definitions explain the first solver's disagreement; the stored740000 is supported under the selected gross-primary formula. Explicit wording is required; a confident wrong-key claim is withdrawn.\n- Full registered excerpts DO support the reform years, colonial output estimates, motor-vehicle counts, sustainable extraction and trade-access criticism. Prior shortened quotes cannot establish missing support.\n- The English parcel sequence is a repeated idea. Seating-arrangement references and the diligent/vigilant context remain uncertain. Simple supported questions are not rejected merely for being easy.\n\n## Release and money\n\nLifetime at ${at}: USD${summary.lifetime.settled_usd.toFixed(6)} settled + USD${summary.lifetime.held_usd.toFixed(6)} conservative holds = USD${summary.lifetime.committed_usd.toFixed(6)} committed; USD${summary.lifetime.remaining_of50_usd.toFixed(6)} remains under50. No provider invoice obtained. Campaign C report at ${campaign.at}: ${campaign.approved_unique} eligible, ${campaign.rejected} rejected, ${campaign.pending} unfinished of100; provider-complete=${campaign.provider_processing_complete}. These are in-flight figures, not final cost/yield.\n\nThe production feed proof is separately dated13:54UTC:662 factory questions served, including all127 flagged items. Staging serves535 retained and none of127 held. This audit does not silently change either environment. Current v7.4 runtime/build/dashboard checks are completed separately, but academic qualification and actual current-profile publication remain open.\n\n## Reproduce\n\nThe frozen packet was prepared by prepareOwner127Review.mjs. Independent records were saved before opening the matching comparison files. This compiler checks every manifest hash, blind-answer binding, original ID/hash and source excerpt hash using the established hashJSON contract; it refuses to overwrite an existing dated audit. For a separate copy, run node scripts/pipeline/tools/compileOwner127Review.mjs --dir PATH_TO_COPIED_REVIEW after preserving the original files and removing only the copied compiled outputs. Inspect OWNER-127-REVIEW.json for every question, key, explanation, full selected excerpt, original judgment, blind derivation,19-dimension status and prospective correction. No source quote in a first review is promoted to an exact quote merely because a reviewer called it exact.\n\n| Subject | Item ID | Disposition | Finding code |\n| --- | --- | --- | --- |\n${rows}\n`;
writeFileSync(dir + 'OWNER-127-REVIEW.md', report, { flag: 'wx' });
console.log(JSON.stringify({ at, reviewed: 127, counts: summary.counts, counts_by_subject: summary.counts_by_subject, first_key_agreement: summary.blind_first_key_agreement, lifetime: summary.lifetime, publication_writes: 0, paid_factory_calls: 0 }, null, 2));
