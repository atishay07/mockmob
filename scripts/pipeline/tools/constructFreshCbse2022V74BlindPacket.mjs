// Local question-only source construction. Never fetches official keys or calls a model.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { auditSHA as sha, locateAuditQuote, cachedTeachingExcerpt } from '../lib/manualSourceAuditSupport.mjs';
import { expectedReleaseBindingV74 } from '../lib/releaseEvidenceV74.mjs';

const prep = resolve('artifacts/question-factory/cuet-readiness-2026-10-08/execution/v74-source-prep');
const root = join(prep, 'acquisition-2022-23');
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const plan = read(join(prep, 'pre-acquisition-binding.json'));
const raw = read(join(root, 'raw16-locator-packet.json'));
const receipt = read(join(root, 'acquisition-receipt.json'));
const binding = expectedReleaseBindingV74();
if (JSON.stringify(plan.contract_binding) !== JSON.stringify(binding) || raw.prompt_binding.prompt_hash !== binding.prompt_hash || raw.prompt_binding.validation_contract_hash !== binding.validation_contract_hash) throw Error('frozen_v74_contract_changed');
const output = join(root, 'questions-blinded-v1.json');
if (existsSync(output)) throw Error('immutable_blind_packet_already_exists');
const files = new Map();
for (const item of receipt.files) {
  if (sha(readFileSync(join(root, item.file))) !== item.sha256 || sha(readFileSync(join(root, item.text_file))) !== item.text_sha256) throw Error('acquired_source_changed:' + item.file);
  const cachePath = join(root, item.file.replace('.pdf', '.pages-v1.json'));
  const data = read(cachePath);
  if (data.pdf_sha256 !== item.sha256 || sha(readFileSync(data.pdf_path)) !== data.pdf_sha256) throw Error('source_page_cache_identity_changed');
  files.set(item.file.split('-SQP')[0], { ...data, cache_path: cachePath, cache_sha256: sha(readFileSync(cachePath)) });
}
function paperSpans(paper, pages, start, end) {
  const data = files.get(paper), parts = pages.map(page => data.pages.find(p => p.page === page));
  if (parts.some(p => !p)) throw Error('source_page_missing');
  const text = parts.map(p => p.text).join('\n');
  let span;
  try { span = locateAuditQuote(text, start, end); }
  catch (error) { throw Error(`${error.message}:${paper}:${pages.join(',')}:${start}:${end}`); }
  let offset = 0; const spans = [];
  for (const page of parts) {
    const from = Math.max(0, span.quote_start - offset), to = Math.min(page.text.length, span.quote_end - offset);
    if (to > from) spans.push({ source_id: 'cbse-sqp-2022-23-' + paper.toLowerCase(), pdf_path: data.pdf_path, pdf_sha256: data.pdf_sha256, cache_path: data.cache_path, cache_sha256: data.cache_sha256, official_url: data.official_url, physical_pdf_page: page.page, page_text_sha256: sha(page.text), quote_start: from, quote_end: to, quote: page.text.slice(from, to), permission_basis: 'Brief attributed source excerpts for local educational verification; not an unrestricted redistribution licence' });
    offset += page.text.length + 1;
  }
  return spans;
}
const oldCache = resolve('artifacts/question-factory/cuet-readiness-2026-10-08/execution/cbse-independent-key-candidates/source-support-v3');
const currentCache = join(prep, 'teaching-cache-v1');
const teaching = (code, page, start, end) => cachedTeachingExcerpt(['leac205', 'leac206'].includes(code) ? currentCache : oldCache, code, page, start, end);
const q = (id, subject, chapter, paper, sourceNo, pages, start, end, body, choices, supportingExcerpts, adaptation = null) => ({ item_id: id, subject, chapter, source_question_no: sourceNo, body, options: choices.map((text, i) => ({ key: 'ABCD'[i], text })), source_spans: paperSpans(paper, pages, start, end), supporting_excerpts: supportingExcerpts, source_status: 'CBSE_sample_paper_derived_practice_reference_not_CUET_PYQ', adaptation_note: adaptation, targeted_source_edits_used: adaptation ? 1 : 0, maximum_additional_repairs: adaptation ? 0 : 1 });
const statements = ['Statement 1 is true and Statement 2 is false.', 'Statement 1 is false and Statement 2 is true.', 'Both statements are true.', 'Both statements are false.'];
const items = [
  q('v74-cbse22-acc-q27', 'accountancy', 'Financial Statements', 'Accountancy', '27', [10], 'Financial statements are prepared on certain basic assumptions', 'd) Basis of Accounting',
    'Financial statements are prepared on certain basic assumptions (pre-requisites). What are these assumptions called?', ['Provisions of the Companies Act, 2013', 'Accounting standards', 'Postulates', 'Basis of accounting'], [teaching('leac203', 2, '3. Postulates:', 'will be shown at')]),
  q('v74-cbse22-acc-q28', 'accountancy', 'Accounting Ratios', 'Accountancy', '28', [11], 'From the following calculate Interest coverage ratio', 'd) 5 times',
    'For one financial year, a company has net profit after tax of ₹12,00,000, 10% debentures of ₹1,00,00,000, and a tax rate of 40%. The debentures were outstanding throughout the year and are its only interest-bearing debt. Calculate its interest coverage ratio.', ['1.2 times', '3 times', '2 times', '5 times'], [teaching('leac205', 19, '5.7.5 Interest Coverage Ratio', '= 1.67 times.')], 'Made the annual interest period and complete interest-bearing-debt scope explicit; retained every source amount, rate and option.'),
  q('v74-cbse22-acc-q29', 'accountancy', 'Cash Flow Statement', 'Accountancy', '29', [11], 'Insurance Claim received by Albert Co.', 'Investing Activity also. Activities also.',
    'Albert Co. Ltd., a non-financial company, receives an insurance claim of ₹5,00,000 for machinery lost through theft. The receipt is included in net profit. When preparing cash flows by the indirect method, how should this receipt be treated?', ['Add it under operating activities as an extraordinary item and also subtract it from operating activities.', 'Subtract it under operating activities as an extraordinary item and also add it to operating activities.', 'Add it under operating activities as an extraordinary item and record an investing outflow.', 'Subtract it when adjusting operating profit for the extraordinary item and record an investing inflow.'], [teaching('leac206', 7, 'Extraordinary items are not the regular phenomenon', 'present and future cash flows of an enterprise.'), teaching('leac206', 11, 'All other items for which the cash effects', 'from the amount of net profit.'), teaching('leac206', 5, 'Cash Inflows from Investing Activities', 'Cash receipt from disposal of fixed assets including intangibles.')], 'Specified indirect preparation, inclusion of this receipt in net profit, and the non-financial enterprise scope; retained the fixed-asset theft receipt and four classifications.'),
  q('v74-cbse22-acc-q30', 'accountancy', 'Cash Flow Statement', 'Accountancy', '30', [11, 12], 'From the following information find out the inflow', 'd) ₹ 1,12,000',
    'Office equipment has a carrying amount of ₹3,00,000 on 31 March 2021 and ₹2,00,000 on 31 March 2022. During 2021–22, equipment costing ₹30,000 was purchased, depreciation of ₹40,000 was charged, and some equipment was sold at a profit of ₹12,000. These are the only changes in the equipment balance. What cash inflow arose from the sale?', ['₹1,00,000', '₹1,02,000', '₹90,000', '₹1,12,000'], [teaching('leac206', 19, 'During the year, a Machine costing', 'Net cash used in Investing Activities (22,000)'), teaching('leac206', 19, 'Machinery Account', '88,000 88,000')], 'Named the reported balances as carrying amounts and made the completeness of the listed asset movements explicit; retained all amounts and options.'),
  q('v74-cbse22-bs-q01', 'business_studies', 'Organising', 'BusinessStudies', '1', [1], 'Rishabh joined an entertainment company', 'd).Establishing Reporting Relationships',
    'Rishabh manages a creative unit. In organising its work, he has identified and divided the activities required by the plans. Which step should he perform next?', ['Identification and division of work', 'Departmentalisation', 'Assignment of duties', 'Establishing reporting relationships'], [teaching('lebs105', 3, 'From the above description', 'Such sets facilitate specialisation.'), teaching('lebs105', 4, '(iii) Assignment of duties:', 'helps in coordination amongst various departments.')]),
  q('v74-cbse22-bs-q02', 'business_studies', 'Business Environment', 'BusinessStudies', '2', [1], 'Which characteristic of the business environment is highlighted', 'd). Relativity',
    'Changes in the business environment occur so frequently that predicting future developments becomes difficult. Which characteristic is most directly highlighted?', ['Uncertainty', 'Complexity', 'Interrelatedness', 'Relativity'], [teaching('lebs103', 3, '(iii) Inter -relatedness:', 'difficult to grasp in its'), teaching('lebs103', 4, '(vii) Relativity:', 'non-existent in France.')]),
  q('v74-cbse22-bs-q03', 'business_studies', 'Organising', 'BusinessStudies', '3', [1], 'Aarohan Ltd. is a company manufacturing automobiles', 'd). Heads do not get training for top management positions.',
    'An automobile company divides work into production, purchase, marketing, accounts and personnel. Which of the following is a disadvantage of this organisation structure?', ['It may lead to an increase in cost.', 'Managers may gain power, assert independence and ignore organisational interests.', 'It ensures that different functions get due attention.', 'Heads do not get training for top management positions.'], [teaching('lebs105', 8, 'departments creates a functional structure.', 'narrow perspective and thus,'), teaching('lebs105', 9, 'have difficulty in appreciating', 'diverse areas.'), teaching('lebs105', 10, 'The divisional structure has certain disadvantages.', 'such a manager'), teaching('lebs105', 11, 'may gain power', 'ignore organisational interests.')]),
  q('v74-cbse22-bs-q04', 'business_studies', 'Business Environment', 'BusinessStudies', '4', [2], 'Identify the dimensions of the business environment illustrated', 'd. Social and legal',
    'A case illustrates increasing participation of women in the workforce through Sapna, a woman who recently joined a company and uses accounting software at work. Which two business-environment dimensions are highlighted?', ['Technological and social', 'Technological and political', 'Political and economic', 'Social and legal'], [teaching('lebs103', 9, 'Attitudes towards product innovations', 'Composition of family'), teaching('lebs103', 8, 'innovations which provide new ways', 'new methods and techniques of operating a business.'), teaching('lebs103', 9, '(iv) Political Environment:', 'obey the law')], 'Replaced the visually verified woman-at-computer image with text, and named the workforce-participation theme rather than assuming a social trend from an isolated hire.'),
  q('v74-cbse22-econ-q01', 'economics', 'Income Determination', 'Economics', '1', [1], 'Statement 1: The consumption curve', 'd) Both statements 1 and 2 are false',
    'Consider the NCERT two-sector income–expenditure model, with autonomous investment and a constant marginal propensity to consume strictly between 0 and 1. Statement 1: The consumption curve is an upward-sloping straight line because consumption rises with income at a constant rate. Statement 2: The aggregate-demand curve and consumption curve are parallel. Choose the correct option.', statements, [teaching('leec104', 2, '4.1.1. Consumption', 'inclusive of both values).'), teaching('leec104', 6, 'In a two sector model', 'level of income.'), teaching('leec104', 7, 'Aggregate Demand: Graphical Representation', 'ex ante demand.')], 'Named the autonomous-investment model and positive constant MPC range explicitly; retained the two source propositions and option ordering.'),
  q('v74-cbse22-econ-q03', 'economics', 'Money & Banking', 'Economics', '3', [1], 'is an institution that accept deposits', 'd) Government of India',
    'Which institution accepts deposits from the public for lending purposes?', ['Commercial banks', 'Life Insurance Corporation', 'Reserve Bank of India', 'Government of India'], [teaching('leec103', 3, 'Central bank Central Bank', 'basis for credit creation.'), teaching('leec103', 3, 'Commercial Banks Commercial banks', 'is explained below.')]),
  q('v74-cbse22-econ-q04', 'economics', 'Balance of Payments', 'Economics', '4', [2], 'Statement 1: Export of financial services', 'd) Both statements 1 and 2 are false',
    'Use the NCERT two-account balance-of-payments classification (current account and capital account). Statement 1: India’s export of financial services is recorded on the credit side of the current account. Statement 2: Foreign direct investment into India is recorded on the credit side of the capital account. Choose the correct option.', statements, [teaching('leec106', 2, '6.1 THE BALANCE OF PAYMENTS', 'grants.'), teaching('leec106', 4, 'of imports of invisibles', 'external borrowings and assistance.')], 'Identified the textbook’s two-account classification explicitly; did not assert that it is the only current international reporting framework.'),
  q('v74-cbse22-econ-q05', 'economics', 'National Income & Related Aggregates', 'Economics', '5', [2], 'Statement 1 - Net investment is a stock concept.', 'd) Both statements 1 and 2 are false',
    'Statement 1: Net investment is a stock concept. Statement 2: Capital is a flow concept. Choose the correct option.', statements, [teaching('leec102', 4, 'In contrast, capital goods', 'Net Investment = Gross investment – Depreciation')]),
];

const passage = `(1) A ghost net is a fishing net lost or abandoned in the ocean. Although fishers no longer use it, it keeps working, trapping marine life. Abandoned fishing gear creates a wider problem known as ghost fishing.

(2) Ghost nets entangle turtles, dolphins, birds, sharks, seals and fish. They restrict movement, cause injuries and prevent mammals and birds from reaching air. Hundreds of animals can be caught in one net, making the threat monumental. Nets also break corals, exposing them to disease and blocking needed sunlight.

(3) Most modern nets contain nylon or other plastics that can last for centuries. Ghost nets contribute to the Great Pacific Garbage Patch. When they break down, they become smaller plastic pieces rather than disappearing. Animals mistake these microplastics for food. Eating them can harm internal organs, prevent further feeding and expose animals to toxic chemicals.

(4) Removing ghost nets requires commitment, cooperation and innovation. Conservation groups work with local fishers and governments to locate abandoned gear and remove it from the sea.

(5) Preventing abandonment also matters. Conservation organisations suggest traceable ownership so people dumping nets can be fined, and refundable deposits to encourage returning or recycling nets. Sonar reflectors can help locate lost nets. Working with small-scale fisheries can develop more sustainable gear and practices. Tackling the problem from several sides, with conservation partners, fishers and supporters, can help protect the oceans.`;
const glossaryRows = [
  ['monumental', 'https://dictionary.cambridge.org/dictionary/english/monumental', 'very big or very great'],
  ['negligible', 'https://dictionary.cambridge.org/dictionary/learner-english/negligible', 'small and not important'],
  ['unimpressive', 'https://dictionary.cambridge.org/dictionary/english/unimpressive', 'not making you feel admiration or respect'],
  ['exposing', 'https://dictionary.cambridge.org/dictionary/english/exposing', 'to put someone at risk from something harmful or unpleasant'],
  ['threat', 'https://dictionary.cambridge.org/us/dictionary/english/threat', 'the possibility that something unwanted will happen'],
  ['practical', 'https://dictionary.cambridge.org/dictionary/learner-english/practical', 'able to be done successfully'],
  ['presentable', 'https://dictionary.cambridge.org/dictionary/english/presentable', 'looking suitable or good enough, especially in the way you are dressed'],
  ['popular', 'https://dictionary.cambridge.org/dictionary/learner-english/popular', 'liked by many people'],
  ['prejudiced', 'https://dictionary.cambridge.org/dictionary/english/prejudiced', 'showing an unreasonable dislike for something or someone'],
];
const glossary = glossaryRows.map(([word, official_url, quote]) => ({ word, official_url, quote, quote_sha256: sha(quote), publisher: 'Cambridge University Press & Assessment', acquisition_method: 'Primary publisher definition returned by web search; direct page retrieval returned 403 for three pages. No raw HTML is claimed.', acquired_at: '2026-10-08', permission_basis: 'Short attributed lexical excerpts for local educational verification; not unrestricted dictionary republication' }));
const english = [
  ['i', [2], 'Ghost nets have been named so because they', 'D. act as a snare for all animals in oceans.', 'According to paragraph 1, ghost nets have been named so because they', ['cause much harm to marine life.', 'are functional though no longer used by fishers.', 'are not owned by anyone.', 'act as a snare for all animals in the oceans.']],
  ['iv', [2], 'Select the option that conveys the opposite', 'D. threat', 'Select the option that conveys the opposite of “negligible”, using a word from paragraph 2.', ['unimpressive', 'monumental', 'exposing', 'threat']],
  ['v', [2], 'The writer would agree with the given statements', 'D. Ghost nets can curtail freedom of marine animals.', 'The writer would agree with the following statements based on paragraph 3, EXCEPT:', ['Most ghost nets take a few years to completely disintegrate.', 'Ghost nets contribute to the Great Pacific Garbage Patch.', 'Most ghost nets provide nutrition to marine animals upon disintegration.', 'Ghost nets can curtail the freedom of marine animals.']],
  ['ix', [3], 'How can the solutions, suggested in paragraph five', 'D. prejudiced', 'How can the solutions suggested in paragraph 5 best be described?', ['practical', 'presentable', 'popular', 'prejudiced']],
];
for (const [no, pages, start, end, body, choices] of english) {
  const item = q('v74-cbse22-en-q1-' + no, 'english', 'Factual Passage', 'EnglishCore', '1-' + no, pages, start, end, body, choices, [], 'Re-solve against the disclosed abridged stimulus. Retained source option ordering; removed historical percentages, dates and tonnage from the stimulus without inventing replacement figures.');
  item.stimulus_id = 'v74-cbse22-ghost-nets-adapted';
  item.lexical_source_words = no === 'iv' ? ['negligible', 'unimpressive', 'monumental', 'exposing', 'threat'] : no === 'ix' ? ['practical', 'presentable', 'popular', 'prejudiced'] : [];
  items.push(item);
}
const words = passage.split(/\s+/).filter(Boolean).length;
if (words > 300 || items.length !== 16 || new Set(items.map(i => i.item_id)).size !== 16 || raw.cases.some(c => !items.some(i => i.item_id === c.case_id))) throw Error('raw16_denominator_or_passage_limit_failed');
for (const item of items) if (item.options.length !== 4 || new Set(item.options.map(o => o.text)).size !== 4 || !item.source_spans.length) throw Error('incomplete_blind_source_item:' + item.item_id);
const result = { schema: 'v74-cbse-2022-23-four-subject-blind-construction-v1', at: new Date().toISOString(), contract_binding: binding, raw_locator_packet_sha256: sha(readFileSync(join(root, 'raw16-locator-packet.json'))), acquisition_receipt_sha256: sha(readFileSync(join(root, 'acquisition-receipt.json'))), raw_denominator: 16, raw_per_subject: 4, contains_proposed_answers: false, contains_explanations: false, paid_calls: 0, stimuli: [{ stimulus_id: 'v74-cbse22-ghost-nets-adapted', text: passage, words, adaptation: 'Original abridgment/paraphrase of the CBSE/WWF stimulus with paragraph numbering retained; not an authentic CUET passage.', source_spans: paperSpans('EnglishCore', [1, 2], 'Ghost nets aren’t supernatural', 'banish ghost nets and protect our oceans.') }], lexical_excerpts: glossary, items, locator_errata: [{ case_id: 'v74-cbse22-acc-q30', actual_pages: [11, 12], note: 'Source question and table continue onto physical page12.' }, { case_id: 'v74-cbse22-en-q1-ix', actual_pages: [3], note: 'Printed subpart ix is on physical page3, not page2.' }, { case_id: 'v74-cbse22-bs-q04', actual_pages: [2], note: 'Source image and question are on physical page2.' }, { case_ids: ['v74-cbse22-econ-q04', 'v74-cbse22-econ-q05'], actual_pages: [2], note: 'These source items begin on physical page2.' }], construction_rule: 'All16 raw IDs are retained; two independent derivations must be saved before any official marking-scheme comparison. Genuine raw/adapted defects are reported, never silently replaced.', limitations: ['CBSE reference cases test current-format practice; these are not authenticated CUET PYQs.', 'Passage siblings and paired controls are correlated; this small set cannot prove perfect accuracy.', 'Question construction reads source items; no validator prompt was changed after source acquisition.', 'Official keys have not been opened; no answer is inherited without solving the adapted item.', 'Textbook quotation integrity is not independent proof of semantic correctness.'], release: false, publication: false };
writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, sha256: sha(readFileSync(output)), raw_denominator: 16, english_passage_words: words, independent_solves_pending: 2, paid_calls: 0 }));
