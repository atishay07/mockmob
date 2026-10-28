// Fresh CUET-fit benchmark 3 (authored 8 Oct 2026 AFTER the v7.1 effort policy was fixed from benchmark 2 and the regression set; never validated before its freeze).
// Benchmarks 1 and 2 informed the effort policy, so only this set is fresh evidence for the policy-v1 dual_blind release decision.
// Oracles are the author's, from exact registered excerpts and explicit arithmetic. A "clear" conditional answer is one where an alternative reading yields
// another LISTED option and no textbook default in the cited excerpt supplies the missing condition.

export const PASSAGES = {
  'v7d-passage-fares': { chapter: 'Factual Passage', text: 'A bus company in the hill town of Raniveri cut its fares by 20 per cent in January. Over the next three months, the number of daily passengers rose from 1,200 to 1,500. The company’s accountant noted that total daily fare income stayed at ₹30,000, because the extra passengers only just made up for the lower fare on each ticket. The town council also opened a new market near the bus station in February, which the accountant said might have drawn more shoppers onto the buses. The company has decided to keep the lower fares until June and then compare the figures again.' },
  'v7d-passage-trip': { chapter: 'Para Jumbles', text: 'Rohan packed his bag the night before the trip. In the morning he checked the train timetable once more. He reached the station ten minutes early. The train arrived exactly on time.' }
};

export const BASES = [
  // ---------- Accountancy ----------
  { id: 'acc-loan-interest', subject: 'accountancy', chapter: 'Partnership Fundamentals', route: 'numerical', type: 'numerical_calculation', difficulty: 'easy',
    body: 'A partner has advanced a loan of ₹2,00,000 to the firm for business purposes. The partnership deed says nothing about interest on partners’ loans. How much interest is the partner entitled to for one year?',
    options: ['₹6,000', '₹12,000', '₹20,000', 'Nil'], key: 'B',
    explanation: 'When a partner has advanced a loan to the firm for business, he or she is entitled to interest at 6 per cent per annum. For one year this is 6% of ₹2,00,000 = ₹12,000. “Nil” applies to interest on capital, not to a loan.',
    refs: [['ncert-leac101', 'quality-v4-63927dc5d1aa']], must: ['at the rate of 6 per cent per annum', 'no interest on capital is payable if the partnership deed is silent'],
    variants: {
      conditional_answer: { body: 'A partner has advanced a loan of ₹2,00,000 to the firm for business purposes. The partnership deed provides for interest on partners’ loans. How much interest is the partner entitled to for one year?', why: 'The deed’s rate is not given, so 6 per cent is only one of several possible rates and the keyed ₹12,000 is unsupported.' },
      wrong_key: { key: 'A' },
      numerical_fault: { body: 'A partner has advanced a loan of ₹2,50,000 to the firm for business purposes. The partnership deed says nothing about interest on partners’ loans. How much interest is the partner entitled to for one year?', why: 'The interest becomes ₹15,000, which is not an option.' },
      embedded_unsupported: { explanation: 'A partner who has advanced a loan for business is entitled to interest at 6 per cent per annum, so ₹12,000 for one year. This interest is payable only if the loan exceeds ₹1,00,000.', why: 'The ₹1,00,000 threshold is invented.' } } },
  { id: 'acc-dividend-investing', subject: 'accountancy', chapter: 'Cash Flow Statement', route: 'conceptual', type: 'case_application', difficulty: 'easy',
    body: 'Kavya Ltd, a company that is not a financial enterprise, received a dividend of ₹40,000 on shares it holds in another company. In its cash flow statement prepared as per AS-3, this receipt is shown under:',
    options: ['Operating activities', 'Investing activities', 'Financing activities', 'Cash and cash equivalents'], key: 'B',
    explanation: 'For a non-financial enterprise, AS-3 classifies receipt of interest and dividends as investing activities, so the dividend is shown under investing activities.',
    refs: [['ncert-leac206', 'span-b0864c4bffe7']], must: ['non-financial enterprise', 'receipt of interest and dividends are classified as investing activities'],
    variants: {
      conditional_answer: { body: 'Kavya Ltd received a dividend of ₹40,000 on shares it holds in another company. In its cash flow statement prepared as per AS-3, this receipt is shown under:', why: 'A financial enterprise shows dividends received as operating; a non-financial one as investing; the status is not given.' },
      wrong_key: { key: 'C' },
      second_defensible: { options: ['Operating activities', 'Investing activities', 'Financing activities', 'Investing activities, as the company is not a financial enterprise'], why: 'Options B and D state the same correct classification.' },
      embedded_unsupported: { explanation: 'For a non-financial enterprise, AS-3 classifies receipt of dividends as an investing activity. Dividends received above ₹25,000 must instead be disclosed under operating activities.', why: 'The ₹25,000 rule is invented.' } } },
  { id: 'acc-payables-turnover', subject: 'accountancy', chapter: 'Accounting Ratios', route: 'numerical', type: 'numerical_calculation', difficulty: 'medium',
    body: 'Net purchases for the year are ₹9,60,000 and average trade payables are ₹1,60,000. What is the trade payables turnover ratio?',
    options: ['0.17 times', '6 times', '9.6 times', '1.6 times'], key: 'B',
    explanation: 'Trade payables turnover ratio = purchases ÷ average trade payables = ₹9,60,000 ÷ ₹1,60,000 = 6 times.',
    refs: [['ncert-leac205', 'pdf-page-26'], ['ncert-leac205', 'pdf-page-27']], must: ['Trade Payables Turnover Ratio', 'Purchases'],
    variants: {
      wrong_key: { key: 'C' },
      numerical_fault: { body: 'Net purchases for the year are ₹10,00,000 and average trade payables are ₹1,60,000. What is the trade payables turnover ratio?', why: 'The ratio becomes 6.25 times, which is not an option.' },
      explanation_arithmetic: { explanation: 'Trade payables turnover ratio = purchases ÷ average trade payables = ₹9,60,000 ÷ ₹1,60,000 = 8 times, so the answer is 6 times.', why: 'The key is right but the explanation states 8 times.' } } },
  // ---------- Business Studies ----------
  { id: 'bs-transfer', subject: 'business_studies', chapter: 'Staffing', route: 'conceptual', type: 'conceptual_mcq', difficulty: 'easy',
    body: 'Shifting an employee from one department to another without a substantive change in his responsibilities and status is called:',
    options: ['promotion', 'transfer', 'placement', 'retrenchment'], key: 'B',
    explanation: 'A transfer involves shifting an employee from one job to another, or from one department or shift to another, without a substantive change in responsibilities and status.',
    refs: [['ncert-lebs106', 'p11-c0']], must: ['Transfers', 'without a substantive'],
    variants: {
      wrong_key: { key: 'A' },
      second_defensible: { options: ['promotion', 'transfer', 'placement', 'moving an employee to another job or shift with no substantive change in responsibility'], why: 'Option D restates a transfer, so B and D are both correct.' },
      embedded_unsupported: { explanation: 'A transfer shifts an employee from one department to another without a substantive change in responsibilities. A transfer is valid only with the employee’s written consent under the Industrial Employment Act.', why: 'The consent rule is invented.' } } },
  { id: 'bs-cost-of-debt', subject: 'business_studies', chapter: 'Financial Management', route: 'conceptual', type: 'statement_selection', difficulty: 'medium',
    body: 'Consider the following statements about debt and equity:\n(A) The cost of debt is lower than the cost of equity because the lender’s risk is lower than the equity shareholder’s risk.\n(B) Interest on debt is a deductible expense in computing tax liability, whereas dividends are paid out of after-tax profit.\n(C) Equity shareholders earn an assured return and repayment of capital.\n(D) Increased use of debt is certain to raise the overall cost of capital of the firm.\nChoose the correct answer from the options given below:',
    options: ['(A) and (B) only', '(A) and (C) only', '(B) and (D) only', '(C) and (D) only'], key: 'A',
    explanation: 'The cost of debt is lower than the cost of equity because lenders bear less risk, and interest is tax deductible while dividends are paid from after-tax profit. It is lenders, not equity shareholders, who earn an assured return, and increased use of debt is likely to lower the overall cost of capital, not certain to raise it. Only (A) and (B) are correct.',
    refs: [['ncert-lebs201', 'pdf-page-13']], must: ['The cost of debt is lower than the cost of equity', 'deductible expense', 'assured return'],
    variants: {
      second_defensible: { body: 'Consider the following statements about debt and equity:\n(A) The cost of debt is lower than the cost of equity because the lender’s risk is lower than the equity shareholder’s risk.\n(B) Interest on debt is a deductible expense in computing tax liability, whereas dividends are paid out of after-tax profit.\n(C) Lenders earn an assured return and repayment of capital.\n(D) Increased use of debt is certain to raise the overall cost of capital of the firm.\nChoose the correct answer from the options given below:', why: 'Statement C is now true, so (A), (B) and (C) are correct and the keyed “(A) and (B) only” excludes C.' },
      wrong_key: { key: 'D' },
      embedded_unsupported: { explanation: 'The cost of debt is lower because lenders bear less risk, and interest is tax deductible while dividends are paid from after-tax profit. Under SEBI rules a listed company may not borrow more than twice its equity.', why: 'The SEBI limit is invented.' } } },
  { id: 'bs-capital-structure', subject: 'business_studies', chapter: 'Financial Management', route: 'conceptual', type: 'conceptual_mcq', difficulty: 'easy',
    body: 'Capital structure of a company refers to the mix between:',
    options: ['owners’ funds and borrowed funds', 'fixed assets and current assets', 'revenue receipts and capital receipts', 'short-term and long-term investments'], key: 'A',
    explanation: 'Capital structure refers to the mix between owners’ funds (equity) and borrowed funds (debt).',
    refs: [['ncert-lebs201', 'pdf-page-13']], must: ['Capital structure refers to the mix between owners and borrowed funds'],
    variants: {
      wrong_key: { key: 'B' },
      second_defensible: { options: ['owners’ funds and borrowed funds', 'fixed assets and current assets', 'equity and debt', 'short-term and long-term investments'], why: 'Equity and debt are owners’ funds and borrowed funds; A and C are the same.' },
      embedded_unsupported: { explanation: 'Capital structure is the mix of owners’ funds and borrowed funds. A debt-equity ratio of exactly 2 : 1 is required for every company by the Companies Act.', why: 'The 2 : 1 requirement is invented.' } } },
  // ---------- Economics ----------
  { id: 'eco-sac-sum', subject: 'economics', chapter: 'Production & Costs', route: 'numerical', type: 'numerical_calculation', difficulty: 'easy',
    body: 'At 4 units of output a firm’s average fixed cost is ₹5 and its average variable cost is ₹12. What is its short run average cost at this output?',
    options: ['₹7', '₹17', '₹68', '₹2.40'], key: 'B',
    explanation: 'Short run average cost is the sum of average fixed cost and average variable cost: ₹5 + ₹12 = ₹17.',
    refs: [['ncert-leec203', 'p9-c1856']], must: ['AFC is Rs 20 and AVC is Rs 10. Adding them, we get the SAC'],
    variants: {
      wrong_key: { key: 'A' },
      numerical_fault: { body: 'At 4 units of output a firm’s average fixed cost is ₹6.50 and its average variable cost is ₹12. What is its short run average cost at this output?', why: 'The short run average cost becomes ₹18.50, not an option.' },
      explanation_arithmetic: { explanation: 'Short run average cost is the sum of average fixed cost and average variable cost: ₹5 + ₹12 = ₹15, so the answer is ₹17.', why: 'The key is right but the explanation states ₹15.' },
      second_defensible: { options: ['₹7', '₹17', '₹68', '₹17 per unit'], why: 'Options B and D are the same value.' } } },
  { id: 'eco-bop-balance', subject: 'economics', chapter: 'Balance of Payments', route: 'conceptual', type: 'case_application', difficulty: 'medium',
    body: 'A country’s capital account shows a net capital inflow of $50 billion, and there are no official reserve movements. For its balance of payments to be in equilibrium, its current account must show:',
    options: ['a deficit of $50 billion', 'a surplus of $50 billion', 'a deficit of $100 billion', 'a deficit larger than $50 billion'], key: 'A',
    explanation: 'The current account and the capital account together sum to zero in this case, so a net capital inflow of $50 billion finances a current account deficit of exactly $50 billion.',
    refs: [['ncert-leec106', 'pdf-page-5']], must: ['Current account + Capital account', 'without any reserve movements'],
    variants: {
      conditional_answer: { body: 'A country’s capital account shows a net capital inflow of $50 billion. For its balance of payments to be in equilibrium, its current account must show:', why: 'The country could also use its reserves, so a deficit larger than $50 billion is possible; the stem no longer fixes the answer.' },
      wrong_key: { key: 'B' },
      second_defensible: { options: ['a deficit of $50 billion', 'a surplus of $50 billion', 'a deficit of $100 billion', 'a deficit equal to the capital inflow'], why: 'Options A and D are the same answer.' },
      embedded_unsupported: { explanation: 'A net capital inflow of $50 billion finances a current account deficit of $50 billion. The IMF requires every member to keep its current account deficit below 3 per cent of GDP.', why: 'The IMF rule is invented.' } } },
  { id: 'eco-price-taker', subject: 'economics', chapter: 'Theory of Firms under Perfect Competition', route: 'conceptual', type: 'conceptual_mcq', difficulty: 'easy',
    body: 'A firm in a perfectly competitive market behaves as a price taker because it believes that it:',
    options: ['can sell as many units as it wants at the market price', 'can raise its price without losing any buyers', 'faces a downward sloping demand curve', 'can sell only one unit at a time'], key: 'A',
    explanation: 'In a perfectly competitive market a firm believes it can sell as many units as it wants by setting a price less than or equal to the market price, so it has no reason to set a different price: it takes the market price as given.',
    refs: [['ncert-leec204', 'p2-c1929']], must: ['can sell as many units of the good as it wants'],
    variants: {
      wrong_key: { key: 'C' },
      second_defensible: { options: ['can sell as many units as it wants at the market price', 'can raise its price without losing any buyers', 'faces a downward sloping demand curve', 'can sell any quantity it chooses at the going price'], why: 'Options A and D are the same statement.' },
      embedded_unsupported: { explanation: 'A competitive firm believes it can sell as many units as it wants at the market price, so it is a price taker. Price takers in India must register with the Competition Commission each year.', why: 'The registration rule is invented.' } } },
  // ---------- English ----------
  { id: 'eng-synonym-resilient', subject: 'english', chapter: 'Vocabulary', route: 'conceptual', type: 'synonym', difficulty: 'easy',
    body: 'Choose the word that is closest in meaning to “resilient”.',
    options: ['Quick to recover', 'Likely to complain', 'Slow to react', 'Easy to break'], key: 'A',
    explanation: '“Resilient” means able to recover quickly after something unpleasant such as a shock or injury, so “quick to recover” is closest in meaning.',
    refs: [['oxford-quality-resilient', 'definition']], must: ['able to recover quickly'],
    variants: {
      wrong_key: { key: 'C' },
      second_defensible: { options: ['Quick to recover', 'Likely to complain', 'Slow to react', 'Able to bounce back'], why: 'Options A and D both mean resilient.' },
      embedded_unsupported: { explanation: '“Resilient” means able to recover quickly, so “quick to recover” is closest. It entered English from Latin in the 1620s through the writings of Francis Bacon.', why: 'The history is invented.' } } },
  { id: 'eng-antonym-candid', subject: 'english', chapter: 'Vocabulary', route: 'conceptual', type: 'antonym', difficulty: 'medium',
    body: 'Choose the word that is most nearly opposite in meaning to “candid”.',
    options: ['Guarded', 'Honest', 'Frank', 'Open'], key: 'A',
    explanation: '“Candid” means saying what you think openly and honestly, not hiding your thoughts. The opposite is “guarded”, which hides thoughts; “honest”, “frank” and “open” are close to “candid”.',
    refs: [['oxford-quality-candid', 'definition']], must: ['not hiding your thoughts'],
    variants: {
      wrong_key: { key: 'B' },
      second_defensible: { options: ['Guarded', 'Honest', 'Frank', 'Reserved'], why: 'Guarded and reserved are both opposites of candid.' },
      embedded_unsupported: { explanation: '“Candid” means open and honest, so “guarded” is its opposite. The word is used in British courts only for statements made under oath.', why: 'The courts claim is invented.' } } },
  { id: 'eng-rc-fares-detail', subject: 'english', chapter: 'Factual Passage', route: 'passage', type: 'reading_comprehension', difficulty: 'easy', passage: 'v7d-passage-fares',
    body: 'What happened to the company’s total daily fare income after the fares were cut?',
    options: ['It stayed at ₹30,000', 'It rose by ₹7,500', 'It fell by ₹6,000', 'It rose by 20 per cent'], key: 'A',
    explanation: 'The accountant noted that total daily fare income stayed at ₹30,000, because the extra passengers only just made up for the lower fare on each ticket.',
    refs: [['v7d-passage-fares', 'stimulus']], must: ['stayed at ₹30,000'],
    variants: {
      wrong_key: { key: 'B' },
      passage_unanswerable: { body: 'How many buses does the company run on the hill route?', why: 'The passage does not give the number of buses.' } } },
  { id: 'eng-rc-fares-inference', subject: 'english', chapter: 'Factual Passage', route: 'passage', type: 'reading_comprehension', difficulty: 'medium', passage: 'v7d-passage-fares',
    body: 'Why does the passage suggest that the rise in passengers cannot be credited to the lower fares alone?',
    options: ['Because a new market opened near the bus station and may also have drawn passengers', 'Because the council raised the bus fares again in February', 'Because the company stopped running buses in the afternoon', 'Because the accountant disliked the lower fares'], key: 'A',
    explanation: 'The town council opened a new market near the bus station in February, and the accountant said it might have drawn more shoppers onto the buses, so the rise cannot be credited to the lower fares alone.',
    refs: [['v7d-passage-fares', 'stimulus']], must: ['might have drawn more shoppers'],
    variants: {
      wrong_key: { key: 'B' },
      second_defensible: { options: ['Because a new market opened near the bus station and may also have drawn passengers', 'Because the council raised the bus fares again in February', 'Because shoppers going to the new market may also have taken the buses', 'Because the accountant disliked the lower fares'], why: 'Options A and C state the same supported reason.' } } },
  { id: 'eng-paraj-trip', subject: 'english', chapter: 'Para Jumbles', route: 'conceptual', type: 'sequence_ordering', difficulty: 'easy', passage: 'v7d-passage-trip', stimulusOnly: true,
    body: 'Arrange the following sentences in the correct order.\n(A) The train arrived exactly on time.\n(B) He reached the station ten minutes early.\n(C) Rohan packed his bag the night before the trip.\n(D) In the morning he checked the train timetable once more.\nChoose the correct sequence from the options given below:',
    options: ['(C)-(D)-(B)-(A)', '(C)-(B)-(D)-(A)', '(D)-(C)-(B)-(A)', '(C)-(D)-(A)-(B)'], key: 'A',
    explanation: 'Rohan packs the night before (C). In the morning he checks the timetable (D). He then reaches the station early (B), and the train arrives on time (A). The order is C-D-B-A.',
    refs: [['v7d-passage-trip', 'stimulus']], must: ['packed his bag the night before'],
    variants: {
      wrong_key: { key: 'C' },
      second_defensible: { options: ['(C)-(D)-(B)-(A)', '(C)-(B)-(D)-(A)', '(C), (D), (B), (A)', '(C)-(D)-(A)-(B)'], why: 'Options A and C are the same sequence.' } } }
];

export const OUT_OF_SYLLABUS = [
  { id: 'oos3-acc-subscription', subject: 'accountancy', chapter: 'Partnership Fundamentals', ref: ['ncert-leac101', 'pdf-page-5'],
    body: 'A club received ₹12,000 as subscriptions for the next year during the current year. In its income and expenditure account for the current year this amount is:', options: ['credited as income of the current year', 'not shown as income of the current year', 'debited as an expense', 'shown as a fixed asset'], key: 'B', explanation: 'Subscriptions received in advance belong to the next year and are not income of the current year.' },
  { id: 'oos3-acc-sale-company', subject: 'accountancy', chapter: 'Dissolution of Partnership Firm', ref: ['ncert-leac104', null],
    body: 'On the sale of a firm to a company, the purchase consideration is ₹9,00,000. The company pays ₹3,00,000 in cash and the rest in equity shares of ₹100 each at par. How many shares are issued?', options: ['3,000', '6,000', '9,000', '12,000'], key: 'B', explanation: 'Shares are issued for ₹6,00,000 at ₹100 each, which gives 6,000 shares.' },
  { id: 'oos3-bs-entrepreneurship-msme', subject: 'business_studies', chapter: 'Entrepreneurship Development', ref: ['ncert-lebs101', null],
    body: 'Which of the following is a step in the process of setting up a new venture as an entrepreneur?', options: ['Developing a business idea', 'Preparing a balance sheet of a competitor', 'Auditing a government department', 'Closing every existing business'], key: 'A', explanation: 'Developing a business idea is the first step in setting up a new venture.' },
  { id: 'oos3-eco-std-dev', subject: 'economics', chapter: 'Production & Costs', ref: ['ncert-leec203', 'p5-c0'],
    body: 'What is the range of the values 4, 9, 13 and 20?', options: ['9', '13', '16', '20'], key: 'C', explanation: 'The range is the largest value minus the smallest: 20 − 4 = 16.' }
];

export const POOR_FIT = [];
export const PYQ_SELECTION = {};
