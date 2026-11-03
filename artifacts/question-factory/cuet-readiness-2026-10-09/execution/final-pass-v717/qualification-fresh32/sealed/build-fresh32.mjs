import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const base = resolve(here, '..');
const root = resolve(base, '../../../../../../');
const freezePath = resolve(root, 'artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v717/V717-FINAL-EXECUTION-FREEZE.json');
const registryPath = resolve(base, 'source-registry.json');
const freezeRaw = readFileSync(freezePath);
const freeze = JSON.parse(freezeRaw);
const registryRaw = readFileSync(registryPath);
const registry = JSON.parse(registryRaw);
const sha = b => createHash('sha256').update(b).digest('hex');
const freezeHash = sha(freezeRaw), registryHash = sha(registryRaw);
if (freezeHash !== '0f578d06f5efc8e42c5a1db598ef6b09495b051addf271c517da486f030682bd') throw Error('freeze hash mismatch');
if (freeze.contract_hash !== '045cf8d93ece2742fbd651fb3f272532b8ff96cb554fed92230f788dbb66e533') throw Error('contract mismatch');
if (freeze.scorecard_prompt_hash !== 'd51311949ff24aa226cd11726c4ee3fcaa5fb4eb826879de6c01ba883c547246') throw Error('prompt mismatch');

const createdAt = new Date().toISOString();
if (Date.parse(createdAt) < Date.parse(freeze.created_at)) throw Error('authoring predates freeze');
const itemRows = [];
function add(subject, slot, expectedValid, answerKey, chapter, concept, type, difficulty, body, options, explanation, sources, syllabusUnit, objective, extra = {}) {
  const candidate = { chapter, concept, question_type: type, difficulty, ...extra.candidateFields, body, options, key: answerKey, explanation, sources, syllabus_unit: syllabusUnit, objective };
  const item = { id: `v717-fresh32-${slot.toLowerCase().replaceAll('_','-')}`, slot, family_id: extra.family_id || `v717-fresh32-${slot}`, subject, expected_valid: expectedValid };
  if (!expectedValid) Object.assign(item, { defect_class: extra.defect_class, defect_note: extra.defect_note, answer_set: extra.answer_set });
  item.candidate = candidate;
  item.option_permutation = { new_position_to_original_index: [0,1,2,3] };
  item.provenance = { source_registry_sha256: registryHash, source_refs: sources, syllabus_ref: [`cuet2026-${subject}-syllabus`,'full-syllabus'], created_at: createdAt, freeze_sha256: freezeHash };
  itemRows.push(item);
}

// Accountancy: comparative statements, common-size percentages and trend analysis.
const AC='ncertcol-leac204-v1';
add('accountancy','A_V1',true,'A','Analysis of Financial Statements','trend-percentage-from-base-year','numerical_calculation','medium',
  'A company selected 2021 as the base year for trend analysis. Revenue was ₹80 lakh in 2021 and ₹100 lakh in 2023. What is the 2023 trend percentage?',
  ['125%','80%','20%','180%'],
  'Trend percentage compares an item in each year with the same item in the base year. Thus ₹100 lakh ÷ ₹80 lakh × 100 = 125%.',[[AC,'p5-c0-g1-s0']],
  'Unit V: Analysis of Financial Statements','Compute a trend percentage using the same item in a stated base year.');
add('accountancy','A_V2',true,'B','Analysis of Financial Statements','comparative-statement-relative-change','numerical_calculation','medium',
  'A comparative balance sheet shows reserves and surplus of ₹4 lakh in the earlier year and ₹3 lakh in the later year. What is the percentage change, using the earlier year as the base?',
  ['20% decrease','25% decrease','33⅓% decrease','25% increase'],
  'The absolute change is ₹3 lakh − ₹4 lakh = −₹1 lakh. Relative to the earlier ₹4 lakh, the decrease is ₹1 lakh ÷ ₹4 lakh × 100 = 25%. Comparative statements use absolute and relative changes between the two periods.',[[AC,'p6-c0-g1-s0'],[AC,'p9-c0-g1-s0']],
  'Unit V: Analysis of Financial Statements','Interpret and calculate a relative change from a two-period balance-sheet comparison.');
add('accountancy','A_V3',true,'C','Analysis of Financial Statements','common-size-balance-sheet-component','numerical_calculation','medium',
  'A company reports total assets of ₹40 lakh, including inventory of ₹8 lakh. In a common-size balance sheet, what percentage of total assets is inventory?',
  ['12.5%','15%','20%','25%'],
  'A common-size balance sheet expresses each asset as a percentage of total assets. Inventory is ₹8 lakh ÷ ₹40 lakh × 100 = 20%.',[[AC,'p12-c0-g2-s0']],
  'Unit V: Analysis of Financial Statements','Apply the common-size percentage basis to one asset using a supplied total.');
add('accountancy','A_V4',true,'D','Analysis of Financial Statements','comparative-versus-common-size-tools','conceptual_mcq','easy',
  'Which statement is NOT correct?',
  ['A comparative statement presents figures for two periods.','Comparative statements can show absolute and relative changes.','Common-size statements express items as percentages of a relevant aggregate.','A comparative statement of profit and loss necessarily expresses each expense as a percentage of revenue.'],
  'The first three statements describe the tools. Expressing each profit-and-loss item as a percentage of revenue is a common-size presentation, not a necessary feature of every comparative statement.',[[AC,'p6-c0-g1-s0'],[AC,'p12-c0-g2-s0']],
  'Unit V: Analysis of Financial Statements','Distinguish the purpose of comparative statements from common-size statements.');
add('accountancy','A_V5',true,'A','Analysis of Financial Statements','comparative-profit-after-tax-growth','numerical_calculation','medium',
  'A comparative statement reports profit after tax of ₹3.6 lakh in the earlier year and ₹5.4 lakh in the later year. What is the percentage increase over the earlier year?',
  ['50%','25%','40%','60%'],
  'The increase is ₹5.4 lakh − ₹3.6 lakh = ₹1.8 lakh. Relative to the earlier amount, ₹1.8 lakh ÷ ₹3.6 lakh × 100 = 50%.',[[AC,'p6-c0-g1-s0'],[AC,'p8-c0-g3-s0']],
  'Unit V: Analysis of Financial Statements','Calculate and interpret a percentage increase from a comparative statement.');
add('accountancy','A_D1',false,'A','Analysis of Financial Statements','comparative-revenue-percent-defective-key','numerical_calculation','medium',
  'Revenue from operations rose from ₹16 lakh to ₹20 lakh. What was the percentage increase over the earlier year?',
  ['20%','25%','₹4 lakh','125%'],
  'The increase is ₹4 lakh. Dividing it by the later ₹20 lakh gives 20%, so option A is the increase.',[[AC,'p6-c0-g1-s0'],[AC,'p8-c0-g3-s0']],
  'Unit V: Analysis of Financial Statements','Calculate relative change from two reported periods; the keyed result incorrectly uses the later value as denominator.',
  {defect_class:'wrong_key',defect_note:'The percentage increase must use the earlier-year amount as the base: (20−16)/16 × 100 = 25%. The candidate keys 20%, obtained by dividing by the later amount.',answer_set:['B']} );
add('accountancy','A_D2',false,'B','Analysis of Financial Statements','trend-percentage-missing-base-value','numerical_calculation','medium',
  'The 2023 revenue of a company is ₹100 lakh. What is its 2023 trend percentage if 2021 is the base year?',
  ['80%','125%','100%','20%'],
  'A trend percentage is the year’s value divided by the same item’s base-year value, multiplied by 100. The 2021 revenue is not supplied here, so the percentage cannot be calculated from the printed information.',[[AC,'p5-c0-g1-s0']],
  'Unit V: Analysis of Financial Statements','Recognise that a base-year amount is decisive for a trend-percentage calculation.',
  {defect_class:'missing_decisive_input',defect_note:'The item’s 2021 base-year revenue is omitted. The 2023 value alone cannot determine its trend percentage.',answer_set:[]} );
add('accountancy','A_D3',false,'C','Analysis of Financial Statements','trend-explanation-uses-wrong-base','numerical_calculation','medium',
  'Revenue was ₹80 lakh in the 2021 base year, ₹90 lakh in 2022 and ₹100 lakh in 2023. What is the 2023 trend percentage?',
  ['80%','111.11%','125%','20%'],
  'Trend analysis compares 2023 with the immediately preceding year: ₹100 lakh ÷ ₹90 lakh × 100 = 111.11%. Therefore option C is correct.',[[AC,'p5-c0-g1-s0']],
  'Unit V: Analysis of Financial Statements','Calculate a trend percentage from a named base year; the keyed value is correct but the explanation substitutes the preceding year.',
  {defect_class:'false_explanation',defect_note:'The correct trend percentage is 125% using the stated 2021 base year, but the explanation says to use 2022 and computes 111.11%. The source defines the denominator as the same item in the base year.',answer_set:['C']} );

// Business Studies: normal financial-management applications and source-bounded defects.
const BS='ncertcol-lebs201-v1';
add('business_studies','B_V1',true,'A','Financial Management','capital-budgeting-long-term-investment-case','case_application','medium',
  'A company is deciding whether to replace an old production line with a costly new machine. The outlay is large, the choice affects earning capacity for many years and reversing it later would be expensive. Which financial decision is central?',
  ['Capital budgeting','Dividend declaration','Short-term cash budgeting','Working-capital collection'],
  'A long-term investment in a new machine is a capital-budgeting decision. Such decisions involve large amounts, affect long-run earning capacity and are difficult to reverse except at high cost.',[[BS,'p5-c0-g1-s0']],
  'Unit IX: Business Finance','Classify a long-term, difficult-to-reverse investment decision in a business case.');
add('business_studies','B_V2',true,'B','Financial Management','compare-project-returns-at-equal-risk','numerical_application','medium',
  'Two investment proposals have the same assessed risk. Proposal P is expected to return 9% and proposal Q 13%. Under normal circumstances, which proposal should be selected on the stated comparison?',
  ['Proposal P','Proposal Q','Both must be selected because risk is equal','Neither can be compared without dividend data'],
  'When risk is the same, the proposal with the higher expected return is preferred under normal circumstances. Q offers 13% compared with P’s 9%.',[[BS,'p6-c0-g1-s0']],
  'Unit IX: Business Finance','Compare expected returns when the risk of two investment proposals is stated to be equal.');
add('business_studies','B_V3',true,'C','Financial Management','cash-flow-position-financing-choice','case_based_mcq','medium',
  'A firm has a stronger cash-flow position and is comparing debt financing with equity financing. Which inference is supported by the stated financing factor?',
  ['Equity must always be chosen because it has no repayment date.','Strong cash flow rules out borrowing.','Debt financing may be more viable than equity financing.','The firm should declare a dividend before assessing finance.'],
  'The source states that a stronger cash-flow position may make debt financing more viable than funding through equity. It does not make debt compulsory.',[[BS,'p8-c0-g1-s0']],
  'Unit IX: Business Finance','Apply a stated cash-flow determinant to a financing choice without treating it as an absolute rule.');
add('business_studies','B_V4',true,'D','Financial Management','short-versus-long-term-financial-planning','conceptual_mcq','medium',
  'Which statement about financial planning is NOT supported?',
  ['It considers growth, investments and the requirement for funds.','It includes short-term and long-term planning.','A plan for one year or less is termed a budget.','Long-term planning focuses on detailed action for a period of one year or less.'],
  'Financial planning considers growth, performance, investments and fund requirements. The source distinguishes long-term plans for growth and capital expenditure from short-term budgets for one year or less; it does not define long-term plans as detailed action for one year or less.',[[BS,'p11-c0-g1-s0']],
  'Unit IX: Business Finance','Distinguish long-term financial planning from short-term budgets in a NOT-stem item.');
add('business_studies','B_V5',true,'A','Financial Management','growth-opportunity-dividend-policy-case','case_application','medium',
  'A company has good growth opportunities and expects to finance new investment from its earnings. Which dividend-policy tendency is supported by this condition?',
  ['Retain more earnings, with a relatively smaller dividend.','Pay a larger dividend because growth opportunities guarantee cash.','Keep the dividend unchanged regardless of investment needs.','Treat cash availability as irrelevant to dividend payment.'],
  'Companies with good growth opportunities retain more of their earnings to finance required investment; their dividends are therefore smaller than those of non-growth companies, other relevant conditions aside.',[[BS,'p9-c0-g1-s0']],
  'Unit IX: Business Finance','Apply the growth-opportunity factor to a stated dividend-policy situation.');
add('business_studies','B_D1',false,'A','Financial Management','same-risk-return-comparison-key-mismatch','numerical_application','medium',
  'Two projects have the same assessed risk. Project A is expected to return 10% and Project B 12%. Which should normally be selected on the stated comparison?',
  ['Project A','Project B','Both are equally preferable because risk is equal','Neither; return is irrelevant when risk is equal'],
  'Project A is the correct choice because equal risk makes its lower 10% return preferable to 12%.',[[BS,'p6-c0-g1-s0']],
  'Unit IX: Business Finance','Compare expected returns at equal risk; the keyed project contradicts the stated criterion.',
  {defect_class:'wrong_key',defect_note:'At equal risk, the source-supported comparison favors the 12% Project B, not the keyed 10% Project A.',answer_set:['B']} );
add('business_studies','B_D2',false,'B','Financial Management','two-independent-debt-favoring-factors','conceptual_mcq','medium',
  'Which single factor can make debt financing more viable?',
  ['A stronger cash-flow position','Lower fixed operating costs','High fixed operating costs','A weak cash-flow position'],
  'Lower fixed operating costs can make debt more viable because the business can bear the fixed financing cost. A stronger cash-flow position also makes debt more viable, so both A and B are supported.',[[BS,'p8-c0-g1-s0']],
  'Unit IX: Business Finance','Identify a financing determinant; two different printed options independently support greater debt viability.',
  {defect_class:'multiple_defensible_answers',defect_note:'Both a stronger cash-flow position and lower fixed operating costs can support debt financing according to the source; the single-answer stem has two defensible options.',answer_set:['A','B']} );
add('business_studies','B_D3',false,'C','Financial Management','loan-covenant-explanation-contradiction','case_application','medium',
  'A company’s loan agreement places a condition on dividend payments. What should management do before declaring a dividend?',
  ['Ignore the agreement because dividends are independent of borrowing.','Declare the dividend first and review the agreement later.','Ensure the proposed dividend does not violate the loan-agreement terms.','Treat the restriction as applying only to equity issues.'],
  'Loan agreements may impose restrictions on dividend payments, and companies are required to ensure that a dividend does not violate those terms. The agreement therefore must be checked before declaration.',[[BS,'p10-c0-g1-s0']],
  'Unit IX: Business Finance','Apply a loan-agreement restriction to dividend planning; the keyed answer is supported but the explanation denies the source rule.',
  {defect_class:'false_explanation',defect_note:'The key is the source-supported covenant check, but the explanation states that loan-agreement restrictions never affect dividend declarations, directly contradicting the source.',answer_set:['C']} );

// Economics: production functions and short-run costs, with inputs printed in every calculation.
const EC='ncertcol-leec203-v1';
add('economics','E_V1',true,'C','Production & Costs','marginal-product-from-total-product-schedule','numerical_calculation','medium',
  'With all other inputs held constant, a firm’s total output is 10 units with 1 worker, 22 with 2 workers, 37 with 3 workers and 48 with 4 workers. What is the marginal product of the fourth worker?',
  ['10 units','15 units','11 units','48 units'],
  'Marginal product is the change in output per additional unit of the variable input, with other inputs held constant. For the fourth worker, output changes from 37 to 48, so MP = 11 units.',[[EC,'p4-c0-g3-s16']],
  'Course I, Unit II: Production and Costs','Calculate marginal product from adjacent total-product observations.');
add('economics','E_V2',true,'D','Production & Costs','average-product-from-marginal-products','numerical_calculation','medium',
  'The marginal products of the first three units of labour are 8, 12 and 10 units. What is the average product at the third unit of labour?',
  ['8 units','9 units','12 units','10 units'],
  'Average product at a level of employment is the average of all marginal products up to that level. (8 + 12 + 10) ÷ 3 = 10 units.',[[EC,'p5-c0-g2-s0']],
  'Course I, Unit II: Production and Costs','Compute average product from the marginal products up to the stated employment level.');
add('economics','E_V3',true,'A','Production & Costs','variable-proportions-marginal-product-pattern','conceptual_mcq','medium',
  'Which pattern is consistent with the source’s description of marginal product under the law of variable proportions?',
  ['Marginal product initially rises and, after a level of employment, starts falling.','Marginal product falls at every successive unit from the outset.','Marginal product remains constant at every level of employment.','Marginal product continues to rise at every higher level of employment.'],
  'The source describes marginal product as initially rising and then falling after a certain level of employment. The other choices describe continuous decline, no change or continuous rise.',[[EC,'p6-c0-g2-s20']],
  'Course I, Unit II: Production and Costs','Interpret the stated marginal-product pattern in a four-option conceptual item.');
add('economics','E_V4',true,'B','Production & Costs','marginal-cost-adjacent-output-schedule','numerical_calculation','medium',
  'A firm’s total cost is ₹44 when output is 3 units and ₹49 when output is 4 units. What is the marginal cost of increasing output from 3 to 4 units?',
  ['₹4','₹5','₹6','₹8'],
  'The extra cost of increasing output from 3 to 4 units is ₹49 − ₹44 = ₹5. This matches the marginal-cost entry for that output change in the registered schedule.',[[EC,'p10-c0-g3-s0']],
  'Course I, Unit II: Production and Costs','Compute marginal cost from the change in total cost between adjacent output levels.');
add('economics','E_V5',true,'C','Production & Costs','short-run-average-cost-from-schedule','numerical_calculation','medium',
  'At an output of 5 units, a firm has total fixed cost ₹20 and total variable cost ₹33. What is its short-run average cost?',
  ['₹9.83','₹10','₹10.60','₹12.25'],
  'Total cost is TFC + TVC = ₹20 + ₹33 = ₹53. Short-run average cost is total cost per unit: ₹53 ÷ 5 = ₹10.60.',[[EC,'p9-c0-g0-s0'],[EC,'p10-c0-g3-s0']],
  'Course I, Unit II: Production and Costs','Combine fixed and variable costs, then compute total cost per unit.');
add('economics','E_D1',false,'C','Production & Costs','source-marginal-cost-key-mismatch','numerical_calculation','medium',
  'According to the registered short-run cost schedule, what is marginal cost when output rises from 3 units to 4 units?',
  ['₹6','₹5','₹8','₹10'],
  'The schedule gives total cost ₹44 at output 3 and ₹49 at output 4, so marginal cost is ₹5 (option B).',[[EC,'p10-c0-g3-s0']],
  'Course I, Unit II: Production and Costs','Read the marginal-cost row for adjacent output levels; the keyed result differs from the source schedule.',
  {defect_class:'wrong_key',defect_note:'The registered schedule reports total cost of ₹44 at output 3 and ₹49 at output 4, so marginal cost is ₹5 at option B. The candidate key is C, whose option text is ₹8.',answer_set:['B']} );
add('economics','E_D2',false,'A','Production & Costs','least-cost-input-bundle-missing-factor-prices','case_application','medium',
  'A firm can produce 50 units using any one of these input bundles: (L=6, K=3), (L=4, K=4) or (L=3, K=6). Which bundle is the least-cost choice?',
  ['(L=6, K=3)','(L=4, K=4)','(L=3, K=6)','All three necessarily have the same cost'],
  'The source says the least-cost input combination is selected given factor prices and technology. Factor prices are not supplied, so the least-cost bundle cannot be identified from the printed information.',[[EC,'p8-c0-g2-s0']],
  'Course I, Unit II: Production and Costs','Recognise that factor prices are decisive in choosing among physically equivalent input bundles.',
  {defect_class:'missing_decisive_input',defect_note:'All three printed bundles can produce 50 units, but no factor prices are given. The source makes least-cost choice depend on input prices and technology.',answer_set:[]} );
add('economics','E_D3',false,'D','Production & Costs','average-cost-explanation-misstates-marginal-cost','numerical_calculation','medium',
  'At output 9, total variable cost is ₹75 and the registered schedule reports marginal cost of ₹15. What is marginal cost at that output?',
  ['₹8.33','₹10.55','₹13','₹15'],
  'Marginal cost is total variable cost divided by output: ₹75 ÷ 9 = ₹8.33. The keyed answer is D, ₹15.',[[EC,'p10-c0-g3-s0']],
  'Course I, Unit II: Production and Costs','Read a marginal-cost value from the schedule; the answer is correct but the explanation substitutes average variable cost.',
  {defect_class:'false_explanation',defect_note:'The key ₹15 is the schedule’s marginal cost at output 9. The explanation instead divides TVC by output, an average-cost calculation, and obtains ₹8.33.',answer_set:['D']} );

// English: two contextual lexical items and three controls over one unused registered factual passage.
const EN='mockmob-original-stimulus-factual-passage';
const passage=registry.sources[EN].facts.stimulus.text;
add('english','L_V1',true,'D','Vocabulary','contextual-vocabulary-prudent','correct_word_usage','medium',
  'Before accepting a supplier’s offer, Leena compared the warranty, delivery record and total cost, checking the risks before deciding. Her approach was:',
  ['benevolent','conspicuous','inevitable','prudent'],
  'Prudent means sensible and careful in making judgements or decisions, while avoiding unnecessary risks. Leena checked relevant conditions before deciding.',[['oxford-quality-prudent','definition']],
  'Verbal Ability: Choosing the correct word','Use a verified lexical sense in a decision-making context.',{candidateFields:{target_term:'prudent'}});
add('english','L_V2',true,'A','Vocabulary','contextual-vocabulary-conspicuous','correct_word_usage','medium',
  'The bright orange evacuation sign was easy to see from the far end of the crowded corridor. The sign was:',
  ['conspicuous','authentic','inevitable','prudent'],
  'Conspicuous means easy to see or notice, or likely to attract attention. The sign’s colour and visibility match that meaning.',[['oxford-quality-conspicuous','definition']],
  'Verbal Ability: Choosing the correct word','Apply a source-verified word meaning to a concrete context.',{candidateFields:{target_term:'conspicuous'}});
add('english','L_V3',true,'B','Factual Passage','factual-passage-record-limitation-inference','reading_comprehension','medium',
  'Why did the librarian propose discussing some of the students’ notes before deciding whether to continue the programme?',
  ['To grade every note and rank the students.','To supplement return counts with evidence about students’ experience.','To determine exactly how carefully each book had been read from the return totals.','To require students to borrow more than two books at a time.'],
  'The passage says the records showed when books were returned, not how carefully they were read, and the librarian proposed discussing notes before deciding. The discussion would add evidence about students’ experience to the numerical record.',[[EN,'stimulus']],
  'Reading Comprehension: Factual Passage','Infer why the proposed discussion complements the limits of the numerical records.',{family_id:'v717-fresh32-english-factual-passage',candidateFields:{passage_text:passage}});
add('english','L_V4',true,'C','Factual Passage','factual-passage-not-supported-control','reading_comprehension','medium',
  'Which statement is NOT supported by the passage?',
  ['The trial lasted four weeks.','Students could borrow two books at a time.','The librarian graded the students’ notes.','Returns increased during the second and third weeks before decreasing slightly in the fourth.'],
  'The passage explicitly says the librarian did not grade the notes. The other choices restate printed details.',[[EN,'stimulus']],
  'Reading Comprehension: Factual Passage','Identify a claim that contradicts a stated detail in a factual passage.',{family_id:'v717-fresh32-english-factual-passage',candidateFields:{passage_text:passage}});
add('english','L_V5',true,'D','Factual Passage','factual-passage-proposed-next-step-detail','reading_comprehension','medium',
  'Before deciding whether to continue the programme, what did the librarian propose?',
  ['To stop recording returns.','To grade every note.','To increase the borrowing limit immediately.','To discuss a few notes with students.'],
  'The passage says the librarian proposed discussing a few notes with students before deciding whether to continue.',[[EN,'stimulus']],
  'Reading Comprehension: Factual Passage','Retrieve and interpret the proposed next step from the factual passage.',{family_id:'v717-fresh32-english-factual-passage',candidateFields:{passage_text:passage}});
add('english','L_D1',false,'D','Vocabulary','benevolent-context-wrong-key','correct_word_usage','medium',
  'A group of neighbours regularly donated food and spent time helping families after a flood. Their actions were:',
  ['benevolent','inevitable','conspicuous','prudent'],
  'The neighbours’ actions are benevolent, meaning sensible and careful when making decisions. Therefore option D is correct.',[['oxford-quality-benevolent','definition']],
  'Verbal Ability: Choosing the correct word','Choose the verified lexical sense in a new context; the key conflicts with the source definition.',
  {defect_class:'wrong_key',defect_note:'The context describes kindness and generosity, which matches the registered definition of benevolent at option A. The candidate keys D, whose meaning is not supported by that source.',answer_set:['A'],candidateFields:{target_term:'benevolent'}} );
add('english','L_D2',false,'A','Factual Passage','factual-passage-count-unanswerable','reading_comprehension','medium',
  'How many books in total were returned during the four-week trial?',
  ['48','52','56','60'],
  'The passage does not provide a total count or weekly counts. It gives only the pattern of change, so no listed number can be established.',[[EN,'stimulus']],
  'Reading Comprehension: Factual Passage','Detect an unanswerable numerical question when the passage gives a trend but no counts.',
  {defect_class:'passage_not_answerable',defect_note:'The passage reports only that returns rose in weeks two and three and decreased slightly in week four; it supplies no numerical count from which a four-week total could be calculated.',answer_set:[],family_id:'v717-fresh32-english-factual-passage',candidateFields:{passage_text:passage}} );
add('english','L_D3',false,'B','Factual Passage','factual-passage-explanation-contradicts-text','reading_comprehension','medium',
  'What did the librarian say the borrowing records showed?',
  ['How carefully each book had been read.','When books were returned.','Which students had written the best notes.','How many notes received high grades.'],
  'The records showed how carefully books had been read, so option A is the correct interpretation.',[[EN,'stimulus']],
  'Reading Comprehension: Factual Passage','Read a stated limitation; the keyed detail is correct but the explanation reverses the passage.',
  {defect_class:'false_explanation',defect_note:'Option B is the passage-supported answer. The explanation asserts that records measured reading care, while the passage says they showed return timing rather than how carefully books had been read.',answer_set:['B'],family_id:'v717-fresh32-english-factual-passage',candidateFields:{passage_text:passage}} );

// Move every Business Studies key one letter forward so the full cohort and
// each label stratum meet the predeclared balanced-position allocation.
for (const item of itemRows.filter(x=>x.subject==='business_studies')) {
  item.candidate.options=[item.candidate.options[3],item.candidate.options[0],item.candidate.options[1],item.candidate.options[2]];
  const next={A:'B',B:'C',C:'D',D:'A'};
  item.candidate.key=next[item.candidate.key];
  if(item.answer_set)item.answer_set=item.answer_set.map(k=>next[k]);
  item.option_permutation={new_position_to_original_index:[3,0,1,2]};
}

const items = itemRows;
const counts = {total:items.length, per_subject:{}, valid_key_counts:{A:0,B:0,C:0,D:0}, defect_key_counts:{A:0,B:0,C:0,D:0}, overall_key_counts:{A:0,B:0,C:0,D:0}, valid:0, controlled_defects:0};
for (const sub of ['accountancy','business_studies','economics','english']) {
  const xs=items.filter(x=>x.subject===sub), v=xs.filter(x=>x.expected_valid), d=xs.filter(x=>!x.expected_valid);
  counts.per_subject[sub]={total:xs.length,valid:v.length,defects:d.length,valid_keys:Object.fromEntries(['A','B','C','D'].map(k=>[k,v.filter(x=>x.candidate.key===k).length])),defect_keys:Object.fromEntries(['A','B','C','D'].map(k=>[k,d.filter(x=>x.candidate.key===k).length]))};
}
for(const i of items){const k=i.candidate.key;counts.overall_key_counts[k]++;if(i.expected_valid){counts.valid++;counts.valid_key_counts[k]++;}else{counts.controlled_defects++;counts.defect_key_counts[k]++;}}
const expValid={A:5,B:5,C:5,D:5}, expDef={A:3,B:3,C:3,D:3};
if(items.length!==32||counts.valid!==20||counts.controlled_defects!==12)throw Error('denominator/labels mismatch');
if(new Set(items.map(i=>i.id)).size!==32)throw Error('duplicate item id');
if(JSON.stringify(counts.valid_key_counts)!==JSON.stringify(expValid)||JSON.stringify(counts.defect_key_counts)!==JSON.stringify(expDef)||Object.values(counts.overall_key_counts).some(n=>n!==8))throw Error('key balance mismatch '+JSON.stringify(counts));
for(const [sub,n] of Object.entries(counts.per_subject))if(n.total!==8||n.valid!==5||n.defects!==3)throw Error('subject counts mismatch '+sub);

const sourceIds=[...new Set(items.flatMap(i=>i.candidate.sources.map(s=>s[0])))];
const packBinding={};
for(const [id,p] of Object.entries(registry.packs))if(['cuet2024-accountancy-bookA','cuet2024-business_studies-bookA','cuet2024-economics-bookA','cuet2024-english-bookA','original-english-reference-v1'].includes(id))packBinding[id]={version:p.version,state:p.state};
const authored={schema:'cuet-v717-authored-v1',study_id:'cuet-v717-one-bounded-qualification',author_id:'/root/fresh_construction_r3',author:'/root/fresh_construction_r3; authored after V717 execution freeze from registered source facts only; no native model evaluation informed construction',created_at:createdAt,started_at:createdAt,freeze_sha256:freezeHash,contract_sha256:freeze.contract_hash,scorecard_prompt_sha256:freeze.scorecard_prompt_hash,source_registry_path:'artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v717/qualification-fresh32/source-registry.json',source_registry_sha256:registryHash,source_packs:packBinding,source_ids:sourceIds,counts,construction_note:'One fixed 32-case qualification construction. Prior inspected drafts were used only for exclusion/novelty screening, never as answer templates; no native-model outputs or paid/API results informed any item. Expected labels and answers are sealed here.',items};
const registrySnapshot={schema:'cuet-v717-benchmark-source-registry-binding-v1',created_at:createdAt,registry_path:'artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v717/qualification-fresh32/source-registry.json',registry_sha256:registryHash,freeze_sha256:freezeHash,source_packs:packBinding,sources:Object.fromEntries(sourceIds.map(id=>[id,{version:registry.sources[id].version,state:registry.sources[id].state,identity_sha256:registry.sources[id].identity_sha256,extraction_sha256:registry.sources[id].extraction_sha256,source_pack_id:registry.sources[id].source_pack_id,extraction_checked:registry.sources[id].extraction_checked}])),original_stimulus:{id:EN,locator:'stimulus',identity_sha256:registry.sources[EN].identity_sha256,extraction_sha256:registry.sources[EN].extraction_sha256,permission:registry.sources[EN].permission}};
const syllabusSources={accountancy:'cuet2026-accountancy-syllabus',business_studies:'cuet2026-business_studies-syllabus',economics:'cuet2026-economics-syllabus',english:'cuet2026-english-syllabus'};
function syllabusSlice(subject,unit){
 const srcId=syllabusSources[subject],s=registry.sources[srcId],full=s.facts['full-syllabus'].text;
 if(subject==='english') return {source_id:srcId,locator:'full-syllabus',text:full.slice(full.indexOf('Questions from the Language Section'))};
 const startTerm=subject==='accountancy'?'Unit V:  Analysis of Financial Statements':subject==='business_studies'?'Unit IX:  Business Finance':'Unit II: Production and Costs.';
 const idx=full.indexOf(startTerm);
 if(idx<0) return {source_id:srcId,locator:'full-syllabus',text:full};
 const tail=full.slice(idx+startTerm.length);
 const markers=[tail.indexOf('\nUnit '),tail.indexOf('\n\nPAGE '),tail.indexOf('\r\nUnit '),tail.indexOf('\r\n\r\nPAGE ')].filter(n=>n>=0);
 const end=markers.length?idx+startTerm.length+Math.min(...markers):full.length;
 return {source_id:srcId,locator:'full-syllabus',text:full.slice(idx,end).trim()};
}
const opaqueMap={};
const blindItems=items.map(i=>{
 const c=i.candidate,opaqueId='q717-'+sha(Buffer.from(i.id)).slice(0,24);opaqueMap[opaqueId]=i.id;
 const excerptRefs=c.sources.map(([source_id,locator])=>{
   const src=registry.sources[source_id];if(!src||src.state!=='active'||!src.extraction_checked)throw Error('inactive/unchecked source '+source_id);
   const fact=src.facts?.[locator];if(!fact?.text)throw Error('missing decisive excerpt '+source_id+' '+locator);
   return {source_id,source_version:src.version,source_pack_id:src.source_pack_id,locator,text:fact.text};
 });
 const sl=syllabusSlice(i.subject,c.syllabus_unit),sySource=registry.sources[sl.source_id];
 if(!sySource||sySource.state!=='active'||!sySource.extraction_checked)throw Error('syllabus source missing');
 excerptRefs.push({source_id:sl.source_id,source_version:sySource.version,source_pack_id:sySource.source_pack_id,locator:sl.locator,text:sl.text,kind:'official_syllabus'});
 return {opaque_id:opaqueId,subject:i.subject,chapter:c.chapter,syllabus_unit:c.syllabus_unit,question:c.body,passage:c.passage_text||null,options:c.options.map((text,index)=>({key:'ABCD'[index],text})),excerpts:excerptRefs,family_id:i.family_id,source_registry_sha256:registryHash};
});
const blind={schema:'cuet-v717-blind-packet-v1',study_id:authored.study_id,created_at:createdAt,freeze_sha256:freezeHash,source_registry_sha256:registryHash,instructions:'Solve each item independently from the printed question, passage, registered excerpts and syllabus excerpts only. For an answerable item, identify the best option and reasoning. If the printed information does not support one unique answer, state that. For English passage items, use only the included passage.',items:blindItems};
const mapping={schema:'cuet-v717-sealed-blind-id-map-v1',created_at:createdAt,study_id:authored.study_id,items:opaqueMap};
const out=(rel,obj)=>{const p=resolve(base,rel);mkdirSync(dirname(p),{recursive:true});writeFileSync(p,JSON.stringify(obj,null,2)+'\n','utf8');return {path:p,sha256:sha(readFileSync(p))};};
const outputs=[out('sealed/authored.json',authored),out('sealed/source-registry-binding.json',registrySnapshot),out('sealed/blind-id-map.json',mapping),out('blind/packet.json',blind)];
console.log(JSON.stringify({outputs,counts,freeze_sha256:freezeHash,source_registry_sha256:registryHash,created_at:createdAt},null,2));
