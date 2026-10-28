// Fresh CUET-fit benchmark (authored 7 Oct 2026, before any paid validation of these items).
// Oracles are established by the author from exact registered excerpts plus explicit arithmetic, independently of
// every generator and validator model. Defects are controlled mutations of a valid base and carry the reason they are defects.
// Items judged "valid but poor CUET fit" are author judgments and are reported separately from correctness defects.

export const PASSAGES = {
  'v7b-passage-returns': { chapter: 'Factual Passage', text: 'The Greenfield Municipal Library placed a book-return box outside its main door in March. Before that, readers could return books only during opening hours, from 10 a.m. to 5 p.m. In the six months before the box, the library recorded an average of 420 late returns a month. In the six months after it, the monthly average fell to 270. The librarian noted that the box was emptied each morning and that fines were still charged from the date of actual return, not from the date the box was emptied. A reminder-text service was also started in June, and the librarian said that it may have contributed to the fall. The library has therefore decided to continue both measures and to compare returns again after a full year.' },
  'v7b-passage-map': { chapter: 'Para Jumbles', text: 'Maya found an old map folded inside a library book. It showed a narrow path that led to the hill behind her school. The next morning she followed the path with her brother. At the top they found a small garden that no one had tended for years.' }
};

// Each base: id, subject, chapter, route, type, difficulty, body, options, key, explanation, refs [[sourceId, locator]], must (phrases that
// must appear in the cited excerpts, checked at build time), variants {category: override}.
export const BASES = [
  // ---------- Accountancy ----------
  { id: 'acc-inv-turnover', subject: 'accountancy', chapter: 'Accounting Ratios', route: 'numerical', type: 'numerical_calculation', difficulty: 'medium',
    body: 'A trader’s cost of revenue from operations for the year is ₹12,00,000. Opening inventory is ₹1,10,000 and closing inventory is ₹1,30,000. Taking average inventory as the arithmetic average of opening and closing inventory, what is the inventory turnover ratio?',
    options: ['9.23 times', '10 times', '10.91 times', '0.10 times'], key: 'B',
    explanation: 'Average inventory = (₹1,10,000 + ₹1,30,000) ÷ 2 = ₹1,20,000. Inventory turnover ratio = cost of revenue from operations ÷ average inventory = ₹12,00,000 ÷ ₹1,20,000 = 10 times. 9.23 times uses closing inventory alone and 10.91 times uses opening inventory alone.',
    refs: [['ncert-leac205', 'pdf-page-20']], must: ['Cost of Revenue from Operations / Average Inventory'],
    variants: {
      wrong_key: { key: 'A' },
      numerical_fault: { body: 'A trader’s cost of revenue from operations for the year is ₹12,00,000. Opening inventory is ₹1,16,000 and closing inventory is ₹1,30,000. Taking average inventory as the arithmetic average of opening and closing inventory, what is the inventory turnover ratio?', why: 'Average inventory becomes ₹1,23,000 and the ratio about 9.76 times, which is not an option.' },
      unsupported_explanation: { explanation: 'Average inventory = (₹1,10,000 + ₹1,30,000) ÷ 2 = ₹1,20,000, so the ratio is 10 times. A ratio above 8 times is mandatory for every manufacturer under Schedule III of the Companies Act, 2013.', why: 'The legal requirement is invented.' },
      multiple_correct: { options: ['10.0 times', '10 times', '10.91 times', '0.10 times'], why: '10.0 times and 10 times are the same correct value.' } } },
  { id: 'acc-new-ratio', subject: 'accountancy', chapter: 'Admission of Partner', route: 'numerical', type: 'numerical_calculation', difficulty: 'medium',
    body: 'A and B share profits in the ratio 3 : 2. C is admitted for a 1/5 share in future profits. The partnership deed states that C will take his share from A and B in the ratio 2 : 1. What is the new profit-sharing ratio of A, B and C?',
    options: ['12 : 8 : 5', '9 : 6 : 5', '7 : 5 : 3', '3 : 2 : 1'], key: 'C',
    explanation: 'C’s share is 1/5 = 3/15. C takes it from A and B in the ratio 2 : 1, so A sacrifices 2/15 and B sacrifices 1/15. A’s new share is 3/5 − 2/15 = 7/15 and B’s new share is 2/5 − 1/15 = 5/15, so the new ratio is 7 : 5 : 3. Taking C’s share in the old ratio 3 : 2 would give 12 : 8 : 5.',
    refs: [['ncert-leac102', 'span-72d2f4711e2e'], ['ncert-leac102', 'span-aa617840faf0']], must: ['nothing is specified', 'sacrificing ratio'],
    variants: {
      wrong_key: { key: 'A' },
      missing_assumption: { body: 'A and B share profits in the ratio 3 : 2. C is admitted for a 1/5 share in future profits. What is the new profit-sharing ratio of A, B and C?', why: 'With no statement of how C acquires the share, the textbook default (old ratio 3 : 2) gives 12 : 8 : 5, so the keyed 7 : 5 : 3 is unsupported.' },
      unsupported_explanation: { explanation: 'C’s share of 3/15 is taken from A and B in the ratio 2 : 1, giving 7 : 5 : 3. Section 37 of the Indian Partnership Act, 1932 requires an incoming partner to take his share equally from each existing partner.', why: 'Section 37 does not say this; it contradicts the stated ratio.' } } },
  { id: 'acc-cash-flow-interest', subject: 'accountancy', chapter: 'Cash Flow Statement', route: 'conceptual', type: 'case_application', difficulty: 'easy',
    body: 'Meridian Ltd, a company that is not a financial enterprise, paid ₹60,000 as interest on its debentures during the year. In its cash flow statement prepared as per AS-3, this payment is shown under:',
    options: ['Operating activities', 'Investing activities', 'Financing activities', 'Cash and cash equivalents'], key: 'C',
    explanation: 'For a non-financial enterprise AS-3 classifies payment of interest as a financing activity, so it is shown under financing activities. A financial enterprise, whose main business is lending and borrowing, classifies interest paid as an operating activity.',
    refs: [['ncert-leac206', 'span-b0864c4bffe7']], must: ['non-financial enterprise', 'financing activities'],
    variants: {
      wrong_key: { key: 'A' },
      missing_assumption: { body: 'Meridian Ltd paid ₹60,000 as interest on its debentures during the year. In its cash flow statement prepared as per AS-3, this payment is shown under:', why: 'Interest paid is operating for a financial enterprise and financing for a non-financial one; the status is not given.' },
      multiple_correct: { options: ['Financing activities, as per AS-3', 'Investing activities', 'Financing activities', 'Operating activities'], why: 'Options A and C both state the correct classification.' },
      unsupported_explanation: { explanation: 'For a non-financial enterprise AS-3 classifies interest paid as a financing activity. The classification is compulsory only for companies whose paid-up capital exceeds ₹50 crore.', why: 'The ₹50 crore condition is invented.' } } },
  { id: 'acc-deed-silent', subject: 'accountancy', chapter: 'Partnership Fundamentals', route: 'conceptual', type: 'case_application', difficulty: 'easy',
    body: 'A and B are partners. Their partnership deed is silent about the profit-sharing ratio and about interest on capital. A contributed ₹3,00,000 and B contributed ₹1,00,000 as capital. The firm earned a profit of ₹80,000. How will the profit be shared?',
    options: ['A ₹60,000 and B ₹20,000', 'A ₹40,000 and B ₹40,000', 'A ₹48,000 and B ₹32,000', 'A ₹80,000 and B nil'], key: 'B',
    explanation: 'When the deed is silent, partners share profits equally irrespective of their capital contribution, and no interest on capital is allowed. Each partner therefore receives ₹40,000.',
    refs: [['ncert-leac101', 'quality-v4-63927dc5d1aa']], must: ['equally', 'No interest on capital'],
    variants: {
      wrong_key: { key: 'A' },
      missing_assumption: { body: 'A and B are partners. A contributed ₹3,00,000 and B contributed ₹1,00,000 as capital. The firm earned a profit of ₹80,000. How will the profit be shared?', why: 'Without the deed’s silence the sharing ratio and interest on capital are unknown, so the key is unsupported.' },
      multiple_correct: { options: ['A ₹60,000 and B ₹20,000', 'A ₹40,000 and B ₹40,000', 'A ₹40,000 and B ₹40,000 (equal shares)', 'A ₹80,000 and B nil'], why: 'Options B and C are the same correct answer.' },
      unsupported_explanation: { explanation: 'When the deed is silent, partners share profits equally and no interest on capital is allowed. This equal-sharing rule was introduced by the Companies Act, 2013 for every business firm.', why: 'The Companies Act does not govern partnership firms; the claim is invented.' } } },
  { id: 'acc-goodwill-avg', subject: 'accountancy', chapter: 'Goodwill Valuation', route: 'numerical', type: 'numerical_calculation', difficulty: 'medium',
    body: 'The profits of a firm for the last three years were ₹2,00,000, ₹2,50,000 and ₹3,00,000. Goodwill is to be valued at two years’ purchase of the average profits of these three years. What is the value of goodwill?',
    options: ['₹2,50,000', '₹5,00,000', '₹7,50,000', '₹15,00,000'], key: 'B',
    explanation: 'Average profit = (₹2,00,000 + ₹2,50,000 + ₹3,00,000) ÷ 3 = ₹2,50,000. Goodwill = average profit × number of years’ purchase = ₹2,50,000 × 2 = ₹5,00,000. ₹2,50,000 omits the years’ purchase and ₹7,50,000 is the total profit.',
    refs: [['ncert-leac102', 'span-ae361e8a3770']], must: ['years’ purchase'],
    variants: {
      wrong_key: { key: 'C' },
      numerical_fault: { body: 'The profits of a firm for the last three years were ₹2,00,000, ₹2,50,000 and ₹3,00,000. Goodwill is to be valued at four years’ purchase of the average profits of these three years. What is the value of goodwill?', why: 'Four years’ purchase gives ₹10,00,000, which is not an option.' },
      missing_assumption: { body: 'The profits of a firm for the last three years were ₹2,00,000, ₹2,50,000 and ₹3,00,000. Goodwill is to be valued by the average profits method. What is the value of goodwill?', why: 'The number of years’ purchase is not given, so ₹5,00,000 is unsupported.' },
      unsupported_explanation: { explanation: 'Average profit is ₹2,50,000 and two years’ purchase gives ₹5,00,000. Schedule III of the Companies Act, 2013 fixes the goodwill of every partnership firm at exactly two years’ purchase.', why: 'The schedule says nothing of the kind; the claim is invented.' } } },
  // ---------- Business Studies ----------
  { id: 'bs-unity-command', subject: 'business_studies', chapter: 'Principles of Management', route: 'conceptual', type: 'case_application', difficulty: 'easy',
    body: 'Ravi, a sales executive, receives instructions about his monthly targets from the Regional Manager and, at the same time, different instructions from the Marketing Head. Which principle of management is being violated?',
    options: ['Unity of command', 'Division of work', 'Scalar chain', 'Equity'], key: 'A',
    explanation: 'According to Fayol there should be one and only one boss for every employee. If an employee gets orders from two superiors at the same time, the principle of unity of command is violated.',
    refs: [['ncert-lebs102', 'pdf-page-27']], must: ['unity of command is violated'],
    variants: {
      wrong_key: { key: 'C' },
      multiple_correct: { options: ['Unity of command', 'Division of work', 'Scalar chain', 'Having only one boss for every employee'], why: 'Option D restates the unity of command principle, so A and D are both correct.' },
      unsupported_explanation: { explanation: 'An employee who gets orders from two superiors at the same time violates unity of command. The Factories Act, 1948 makes this principle legally binding on every Indian company.', why: 'The Factories Act does not do this; the claim is invented.' } } },
  { id: 'bs-planning-primary', subject: 'business_studies', chapter: 'Planning', route: 'conceptual', type: 'conceptual_mcq', difficulty: 'easy',
    body: 'A company sets its objectives for the year before it decides how to organise work, staff its departments, direct employees and control performance. This sequence shows that planning is:',
    options: ['a function that managers perform only after control is complete', 'the primary function of management', 'needed only by very large organisations', 'a substitute for the other functions of management'], key: 'B',
    explanation: 'Objectives have to be set before the other functions can be carried out, which is why planning is described as the primary function of management.',
    refs: [['ncert-lebs104', 'pdf-page-5']], must: ['planning is the primary function of management'],
    variants: {
      wrong_key: { key: 'D' },
      unsupported_explanation: { explanation: 'Objectives are set first, so planning is the primary function of management. A study by the Reserve Bank of India in 2019 found that every firm that planned lost no revenue.', why: 'The study is invented.' } } },
  { id: 'bs-consumer-rights', subject: 'business_studies', chapter: 'Consumer Protection', route: 'conceptual', type: 'conceptual_mcq', difficulty: 'easy',
    body: 'Which of the following is NOT one of the six consumer rights listed in the textbook summary of the Consumer Protection Act, 1986?',
    options: ['Right to safety', 'Right to be informed', 'Right to a free replacement of every product', 'Right to consumer education'], key: 'C',
    explanation: 'The six rights are the right to safety, the right to be informed, the right to choose, the right to be heard, the right to seek redressal and the right to consumer education. A right to a free replacement of every product is not among them.',
    refs: [['ncert-lebs203', 'p14-c0']], must: ['Right to safety', 'Right to consumer education'],
    variants: {
      wrong_key: { key: 'B' },
      multiple_correct: { options: ['Right to safety', 'Right to a refund of every purchase', 'Right to a free replacement of every product', 'Right to consumer education'], why: 'Options B and C are both outside the six rights, so two options satisfy the NOT stem.' },
      unsupported_explanation: { explanation: 'The six rights are safety, being informed, choice, being heard, redressal and consumer education. A seventh right to free replacement was added by the 2021 amendment of the Act.', why: 'The 2021 amendment is invented.' } } },
  { id: 'bs-debt-equity', subject: 'business_studies', chapter: 'Financial Management', route: 'numerical', type: 'numerical_calculation', difficulty: 'easy',
    body: 'A company’s capital structure consists of ₹6,00,000 of debt and ₹4,00,000 of equity. Its debt-equity ratio is:',
    options: ['0.67 : 1', '1.5 : 1', '0.6 : 1', '2.5 : 1'], key: 'B',
    explanation: 'Capital structure is the mix of owners’ and borrowed funds. The debt-equity ratio is debt divided by equity: ₹6,00,000 ÷ ₹4,00,000 = 1.5 : 1.',
    refs: [['ncert-lebs201', 'pdf-page-13']], must: ['Capital structure refers to the mix'],
    variants: {
      wrong_key: { key: 'C' },
      numerical_fault: { body: 'A company’s capital structure consists of ₹6,00,000 of debt and ₹5,00,000 of equity. Its debt-equity ratio is:', why: 'The ratio becomes 1.2 : 1, which is not an option.' },
      missing_assumption: { body: 'A company’s capital structure consists of ₹6,00,000 of debt. Its debt-equity ratio is:', why: 'The equity amount is not given, so the ratio cannot be determined.' },
      unsupported_explanation: { explanation: 'The debt-equity ratio is debt divided by equity, which is 1.5 : 1 here. SEBI requires every listed company to keep this ratio above 1 : 1.', why: 'The SEBI requirement is invented.' } } },
  { id: 'bs-recruitment', subject: 'business_studies', chapter: 'Staffing', route: 'conceptual', type: 'conceptual_mcq', difficulty: 'easy',
    body: 'Which of the following best describes recruitment?',
    options: ['Locating potential employees and inviting them to apply for the vacancies', 'Fixing the salaries of the employees who have been selected', 'Evaluating employees for the purpose of promotion', 'Ending the services of surplus employees'], key: 'A',
    explanation: 'Recruitment locates available people for the jobs and invites them to apply, so that an adequate number of suitable candidates with the necessary qualifications is available.',
    refs: [['ncert-lebs106', 'p11-c0']], must: ['It locates available people'],
    variants: {
      wrong_key: { key: 'B' },
      multiple_correct: { options: ['Locating potential employees and inviting them to apply for the vacancies', 'Fixing the salaries of the employees who have been selected', 'Searching for people for the jobs and inviting applications from them', 'Ending the services of surplus employees'], why: 'Options A and C both describe recruitment.' },
      unsupported_explanation: { explanation: 'Recruitment locates people for the jobs and invites them to apply. Under the Industrial Disputes Act, 1947, a firm must advertise every vacancy in two national newspapers.', why: 'The legal requirement is invented.' } } },
  // ---------- Economics ----------
  { id: 'eco-multiplier', subject: 'economics', chapter: 'Income Determination', route: 'numerical', type: 'numerical_calculation', difficulty: 'medium',
    body: 'In a simple economy with a fixed price level and no government sector, autonomous expenditure increases by ₹20 crore. If the marginal propensity to consume is 0.75, the total increase in equilibrium output is:',
    options: ['₹15 crore', '₹26.67 crore', '₹60 crore', '₹80 crore'], key: 'D',
    explanation: 'The autonomous expenditure multiplier is 1 ÷ (1 − MPC) = 1 ÷ 0.25 = 4. The increase in equilibrium output is 4 × ₹20 crore = ₹80 crore. ₹15 crore multiplies by the MPC only and ₹26.67 crore divides by the MPC.',
    refs: [['ncert-leec104', 'pdf-page-10']], must: ['1 – 0.8'],
    variants: {
      wrong_key: { key: 'B' },
      numerical_fault: { body: 'In a simple economy with a fixed price level and no government sector, autonomous expenditure increases by ₹25 crore. If the marginal propensity to consume is 0.75, the total increase in equilibrium output is:', why: 'The correct increase is ₹100 crore, which is not an option.' },
      missing_assumption: { body: 'In a simple economy with a fixed price level and no government sector, autonomous expenditure increases by ₹20 crore. The total increase in equilibrium output is:', why: 'The marginal propensity to consume is not given.' },
      unsupported_explanation: { explanation: 'The multiplier is 1 ÷ (1 − MPC) = 4, so output rises by ₹80 crore. The multiplier is always capped at 4 by a rule of the International Monetary Fund.', why: 'The IMF rule is invented.' } } },
  { id: 'eco-marginal-product', subject: 'economics', chapter: 'Production & Costs', route: 'numerical', type: 'numerical_calculation', difficulty: 'easy',
    body: 'With capital held fixed, the total product of labour is 40 units with 3 workers and 52 units with 4 workers. What is the marginal product of the fourth worker?',
    options: ['12 units', '13 units', '40 units', '92 units'], key: 'A',
    explanation: 'Marginal product of the fourth worker = TP with 4 workers − TP with 3 workers = 52 − 40 = 12 units. 13 units is the average product of four workers.',
    refs: [['ncert-leec203', 'p5-c0']], must: ['MP = (TP at L units) – (TP at L – 1 unit)'],
    variants: {
      wrong_key: { key: 'B' },
      numerical_fault: { body: 'With capital held fixed, the total product of labour is 40 units with 3 workers and 54 units with 4 workers. What is the marginal product of the fourth worker?', why: 'The marginal product becomes 14 units, which is not an option.' },
      missing_assumption: { body: 'With capital held fixed, the total product of labour is 52 units with 4 workers. What is the marginal product of the fourth worker?', why: 'The total product with 3 workers is not given.' },
      unsupported_explanation: { explanation: 'MP of the fourth worker = 52 − 40 = 12 units. Marginal product must by law fall by at least one unit with every additional worker.', why: 'No such law exists; the claim is invented.' } } },
  { id: 'eco-mr-price', subject: 'economics', chapter: 'Theory of Firms under Perfect Competition', route: 'numerical', type: 'numerical_calculation', difficulty: 'medium',
    body: 'A firm in a perfectly competitive market sells its output at the market price of ₹25 per unit. When it raises output from 40 to 48 units, what is the increase in its total revenue?',
    options: ['₹25', '₹200', '₹1,200', '₹8'], key: 'B',
    explanation: 'For a price-taking firm marginal revenue equals the market price, so each extra unit adds ₹25 to total revenue. Eight extra units add 8 × ₹25 = ₹200.',
    refs: [['ncert-leec204', 'p4-c0']], must: ['MR=AR=p'],
    variants: {
      wrong_key: { key: 'C' },
      numerical_fault: { body: 'A firm in a perfectly competitive market sells its output at the market price of ₹25 per unit. When it raises output from 40 to 46 units, what is the increase in its total revenue?', why: 'The increase is ₹150, which is not an option.' },
      unsupported_explanation: { explanation: 'Marginal revenue equals the price, so 8 extra units add ₹200. A perfectly competitive firm must also pay the Competition Commission 5 per cent of any increase in revenue.', why: 'The payment rule is invented.' } } },
  { id: 'eco-credit-creation', subject: 'economics', chapter: 'Money & Banking', route: 'numerical', type: 'numerical_calculation', difficulty: 'medium',
    body: 'The cash reserve ratio is 20 per cent. Assume that banks lend out everything above the required reserves and that the public holds no currency. Fresh reserves of ₹200 can then create total deposits of at most:',
    options: ['₹40', '₹200', '₹800', '₹1,000'], key: 'D',
    explanation: 'With a CRR of 20 per cent the money multiplier is 1 ÷ 0.20 = 5. Reserves of ₹200 therefore create deposits of at most 5 × ₹200 = ₹1,000.',
    refs: [['ncert-leec103', 'pdf-page-7']], must: ['CRR of 20 per cent', 'money multiplier'],
    variants: {
      wrong_key: { key: 'C' },
      numerical_fault: { body: 'The cash reserve ratio is 25 per cent. Assume that banks lend out everything above the required reserves and that the public holds no currency. Fresh reserves of ₹200 can then create total deposits of at most:', why: 'The maximum is ₹800, but the options are keyed for the 20 per cent case: ₹800 is option C, so the keyed D is wrong.' },
      unsupported_explanation: { explanation: 'The multiplier is 1 ÷ 0.20 = 5, so ₹200 of reserves create ₹1,000. The Reserve Bank has fixed 20 per cent as the CRR permanently since 1991.', why: 'The permanent-since-1991 claim is invented.' } } },
  { id: 'eco-bop', subject: 'economics', chapter: 'Balance of Payments', route: 'conceptual', type: 'case_application', difficulty: 'medium',
    body: 'A country has a current account deficit of $30 billion and there are no official reserve movements. For its balance of payments to be in equilibrium, its capital account must show:',
    options: ['a net capital inflow of $30 billion', 'a net capital outflow of $30 billion', 'a net capital inflow of $60 billion', 'a capital account deficit of $30 billion'], key: 'A',
    explanation: 'The current account and the capital account together must sum to zero in this case, so a current account deficit must be financed by a capital account surplus, that is, a net capital inflow of $30 billion.',
    refs: [['ncert-leec106', 'pdf-page-5']], must: ['must be financed by a capital account surplus'],
    variants: {
      wrong_key: { key: 'B' },
      multiple_correct: { options: ['a net capital inflow of $30 billion', 'a net capital outflow of $30 billion', 'a capital account surplus of $30 billion', 'a capital account deficit of $30 billion'], why: 'Options A and C both state the required $30 billion surplus (inflow).' },
      unsupported_explanation: { explanation: 'The deficit must be financed by a net capital inflow of $30 billion. Under WTO rules the capital account may never exceed the current account by more than 10 per cent.', why: 'The WTO rule is invented.' } } },
  // ---------- English ----------
  { id: 'eng-synonym-meticulous', subject: 'english', chapter: 'Vocabulary', route: 'conceptual', type: 'synonym', difficulty: 'easy',
    body: 'Choose the word that is closest in meaning to “meticulous”.',
    options: ['Careless', 'Thorough', 'Hasty', 'Doubtful'], key: 'B',
    explanation: '“Meticulous” means paying careful attention to every detail, so “thorough” is closest in meaning. “Careless” and “hasty” suggest the opposite.',
    refs: [['oxford-quality-meticulous', 'definition']], must: ['paying careful attention to every detail'],
    variants: {
      wrong_key: { key: 'A' },
      multiple_correct: { options: ['Careless', 'Thorough', 'Careful about every detail', 'Doubtful'], why: 'Option C is also a correct meaning of the word.' },
      unsupported_explanation: { explanation: '“Meticulous” means paying careful attention to every detail, so “thorough” fits. The word comes from the Greek word metikos meaning “a measuring rod”.', why: 'The etymology is invented.' } } },
  { id: 'eng-antonym-conspicuous', subject: 'english', chapter: 'Vocabulary', route: 'conceptual', type: 'antonym', difficulty: 'medium',
    body: 'Choose the word that is most nearly opposite in meaning to “conspicuous”.',
    options: ['Obvious', 'Prominent', 'Unnoticeable', 'Famous'], key: 'C',
    explanation: '“Conspicuous” means easy to see or notice. The opposite is “unnoticeable”; “obvious” and “prominent” are close in meaning to “conspicuous”.',
    refs: [['oxford-quality-conspicuous', 'definition']], must: ['easy to see or notice'],
    variants: {
      wrong_key: { key: 'B' },
      multiple_correct: { options: ['Obvious', 'Hidden from view', 'Unnoticeable', 'Famous'], why: 'Options B and C are both opposites of conspicuous.' },
      unsupported_explanation: { explanation: '“Conspicuous” means easy to notice, so “unnoticeable” is opposite. The word is used only in legal contracts written before 1900.', why: 'The usage claim is invented.' } } },
  { id: 'eng-usage-sporadic', subject: 'english', chapter: 'Correct Word Usage', route: 'conceptual', type: 'correct_word_usage', difficulty: 'medium',
    body: 'Choose the sentence in which the word “sporadic” is used correctly.',
    options: ['The sporadic rainfall fell steadily every day of the monsoon.', 'Sporadic power cuts occurred only occasionally, at irregular intervals, during the week.', 'She gave a sporadic speech that explained every point in detail.', 'The sporadic road was wide, smooth and crowded with vehicles.'], key: 'B',
    explanation: '“Sporadic” means happening only occasionally or at intervals that are not regular. Only the second sentence uses it in that sense; rainfall that falls steadily every day is not sporadic.',
    refs: [['oxford-quality-sporadic', 'definition']], must: ['happening only occasionally'],
    variants: {
      wrong_key: { key: 'A' },
      multiple_correct: { options: ['The sporadic rainfall fell steadily every day of the monsoon.', 'Sporadic power cuts occurred only occasionally, at irregular intervals, during the week.', 'Sporadic visits by the inspector happened now and then, at no fixed times.', 'The sporadic road was wide, smooth and crowded with vehicles.'], why: 'Options B and C both use “sporadic” correctly.' },
      unsupported_explanation: { explanation: '“Sporadic” means happening only occasionally or at irregular intervals. It is a technical term borrowed from Scottish law courts.', why: 'The origin claim is invented.' } } },
  { id: 'eng-match-words', subject: 'english', chapter: 'Match the Following', route: 'conceptual', type: 'matching', difficulty: 'medium',
    body: 'Match the words with their meanings.\nList-I: (A) Frugal (B) Sparse (C) Tranquil\nList-II: (I) Quiet and peaceful (II) Using only as much money as is necessary (III) Present only in small amounts\nChoose the correct matching.',
    options: ['(A)-(I), (B)-(II), (C)-(III)', '(A)-(II), (B)-(III), (C)-(I)', '(A)-(III), (B)-(I), (C)-(II)', '(A)-(II), (B)-(I), (C)-(III)'], key: 'B',
    explanation: 'Frugal means using only as much money as is necessary, sparse means present only in small amounts and tranquil means quiet and peaceful. The matching is A-II, B-III, C-I.',
    refs: [['oxford-quality-frugal', 'definition'], ['oxford-quality-sparse', 'definition'], ['oxford-quality-tranquil', 'definition']], must: ['using only as much money', 'only present in small amounts', 'quiet and peaceful'],
    variants: {
      wrong_key: { key: 'D' },
      unsupported_explanation: { explanation: 'Frugal means using only as much money as is necessary, sparse means present in small amounts and tranquil means peaceful. These pairs were set as the standard matching in the 2022 NCERT English reader.', why: 'The NCERT claim is invented.' } } },
  { id: 'eng-rc-fines', subject: 'english', chapter: 'Factual Passage', route: 'passage', type: 'reading_comprehension', difficulty: 'easy', passage: 'v7b-passage-returns',
    body: 'According to the passage, how were fines charged for books left in the return box?',
    options: ['From the date of actual return, not the date the box was emptied', 'From the date the box was emptied each morning', 'No fines were charged for books left in the box', 'Only from 5 p.m. on the day of return'], key: 'A',
    explanation: 'The librarian noted that fines were still charged from the date of actual return, not from the date the box was emptied.',
    refs: [['v7b-passage-returns', 'stimulus']], must: ['not from the date the box was emptied'],
    variants: {
      wrong_key: { key: 'B' },
      unsupported_explanation: { explanation: 'The passage says fines were charged from the date of actual return. The library collected ₹1.2 lakh in fines in the six months after the box was introduced.', why: 'The ₹1.2 lakh figure is not in the passage.' } } },
  { id: 'eng-rc-inference', subject: 'english', chapter: 'Factual Passage', route: 'passage', type: 'reading_comprehension', difficulty: 'medium', passage: 'v7b-passage-returns',
    body: 'Which statement is best supported by the passage?',
    options: ['The return box alone caused the fall in late returns.', 'The fall in late returns cannot be credited to the box alone, because a reminder service started during the period.', 'The reminder service was started before the return box was placed.', 'Late returns rose after the box was placed.'], key: 'B',
    explanation: 'The box was placed in March and the reminder-text service began in June, and the librarian said the service may have contributed to the fall. The passage therefore does not allow the whole fall to be credited to the box.',
    refs: [['v7b-passage-returns', 'stimulus']], must: ['may have contributed to the fall'],
    variants: {
      wrong_key: { key: 'A' },
      multiple_correct: { options: ['The return box alone caused the fall in late returns.', 'The fall in late returns cannot be credited to the box alone, because a reminder service started during the period.', 'The reminder service was started before the return box was placed.', 'The reminder service may also have contributed to the fall in late returns.'], why: 'Options B and D are both supported.' } } },
  { id: 'eng-paraj-map', subject: 'english', chapter: 'Para Jumbles', route: 'conceptual', type: 'sequence_ordering', difficulty: 'easy', passage: 'v7b-passage-map', stimulusOnly: true,
    body: 'Arrange the following sentences in the correct order.\n(A) At the top they found a small garden that no one had tended for years.\n(B) Maya found an old map folded inside a library book.\n(C) The next morning she followed the path with her brother.\n(D) It showed a narrow path that led to the hill behind her school.\nChoose the correct sequence from the options given below:',
    options: ['(B)-(C)-(D)-(A)', '(B)-(D)-(C)-(A)', '(B)-(D)-(A)-(C)', '(D)-(B)-(C)-(A)'], key: 'B',
    explanation: 'The map is introduced first (B). “It showed a narrow path” refers back to the map (D). The next morning she follows the path (C), and at the top they find the garden (A). The order is B-D-C-A.',
    refs: [['v7b-passage-map', 'stimulus']], must: ['It showed a narrow path'],
    variants: {
      wrong_key: { key: 'A' },
      multiple_correct: { options: ['(B)-(C)-(D)-(A)', '(B)-(D)-(C)-(A)', '(B), (D), (C), (A)', '(D)-(B)-(C)-(A)'], why: 'Options B and C are the same sequence.' } } }
];

// Syllabus mismatch: academically valid questions on topics excluded from the 2026 syllabus baseline.
export const OUT_OF_SYLLABUS = [
  { id: 'oos-acc-nfp-receipts', subject: 'accountancy', chapter: 'Partnership Fundamentals', ref: ['ncert-leac101', 'pdf-page-5'],
    body: 'A sports club received subscriptions of ₹80,000 during the year, of which ₹10,000 related to the previous year and ₹5,000 related to the next year. Subscriptions outstanding at the end of the year are ₹6,000. What amount of subscription income is shown in the club’s income and expenditure account?', options: ['₹71,000', '₹80,000', '₹86,000', '₹89,000'], key: 'A',
    explanation: 'Subscription income = 80,000 − 10,000 (previous year) − 5,000 (next year) + 6,000 (outstanding) = ₹71,000.' },
  { id: 'oos-acc-piecemeal', subject: 'accountancy', chapter: 'Dissolution of Partnership', ref: ['ncert-leac104', null],
    body: 'In the piecemeal distribution of cash among partners on the dissolution of a firm, under the proportionate capital method cash is distributed among the partners in which ratio?', options: ['Their profit-sharing ratio', 'The ratio of their capitals', 'Equally', 'The ratio of their drawings'], key: 'B',
    explanation: 'Under the proportionate capital method, cash available for distribution is paid to partners in the ratio of their capitals.' },
  { id: 'oos-acc-sale-company', subject: 'accountancy', chapter: 'Dissolution of Partnership Firm', ref: ['ncert-leac104', null],
    body: 'A firm sells its business to a company for a purchase consideration of ₹9,00,000, payable ₹4,00,000 in cash and the rest in fully paid equity shares of ₹10 each issued at ₹12. How many shares are issued to the firm, to the nearest share?', options: ['41,667', '50,000', '75,000', '90,000'], key: 'A',
    explanation: 'The shares form ₹5,00,000 of the consideration. At an issue price of ₹12 each, 5,00,000 ÷ 12 = 41,667 shares (to the nearest share).' },
  { id: 'oos-acc-insolvency', subject: 'accountancy', chapter: 'Dissolution of Partnership', ref: ['ncert-leac104', null],
    body: 'When a partner is declared insolvent, under the rule in Garner v. Murray the solvent partners bear the deficiency of the insolvent partner’s capital in which ratio?', options: ['Their profit-sharing ratio', 'Their last agreed (fixed) capital ratio', 'Equally', 'The ratio of their drawings'], key: 'B',
    explanation: 'Under Garner v. Murray the solvent partners bear the deficiency in the ratio of their last agreed (fixed) capitals.' },
  { id: 'oos-acc-nfp-ie', subject: 'accountancy', chapter: 'Partnership Fundamentals', ref: ['ncert-leac101', 'pdf-page-5'],
    body: 'In the books of a hospital run on a not-for-profit basis, the receipt of a legacy of ₹2,00,000 with no stated purpose is treated as:', options: ['Revenue income', 'Capital receipt', 'Expenditure', 'Contingent liability'], key: 'B',
    explanation: 'A legacy with no stated purpose is treated as a capital receipt and is added to the capital fund.' },
  { id: 'oos-bs-entrepreneurship', subject: 'business_studies', chapter: 'Entrepreneurship Development', ref: ['ncert-lebs101', null],
    body: 'Which step of the entrepreneurial process involves converting a business idea into a viable plan by estimating funds and market size?', options: ['Opportunity scanning', 'Business planning', 'Franchising', 'Venture exit'], key: 'B',
    explanation: 'Business planning converts the idea into a viable plan, estimating funds required and the size of the market.' },
  { id: 'oos-eco-statistics-median', subject: 'economics', chapter: 'Production & Costs', ref: ['ncert-leec203', 'p5-c0'],
    body: 'The monthly incomes (in ₹ thousand) of five households are 12, 15, 18, 20 and 35. What is the median income?', options: ['15', '18', '20', '35'], key: 'B',
    explanation: 'Arranged in order, the middle (third) value of the five incomes is 18.' },
  { id: 'oos-eco-correlation', subject: 'economics', chapter: 'Market Equilibrium & Simple Applications', ref: ['ncert-leec205', null],
    body: 'If the Karl Pearson coefficient of correlation between two variables is −1, the variables are:', options: ['Unrelated', 'Perfectly positively correlated', 'Perfectly negatively correlated', 'Weakly negatively correlated'], key: 'C',
    explanation: 'A coefficient of −1 indicates perfect negative correlation.' }
];

// Valid but poor CUET fit (author judgment). Expected not to be approved by the CUET-fit gate.
export const POOR_FIT = [
  { id: 'poor-bs-trivial', subject: 'business_studies', chapter: 'Nature & Significance of Management', route: 'conceptual', type: 'conceptual_mcq', difficulty: 'easy', ref: ['ncert-lebs101', null], weakness: 'trivial: the key is the only sensible option without any subject knowledge',
    body: 'A business that wants to survive for many years should most sensibly:', options: ['sell what customers want at a price that covers its costs', 'give away all its products free for ever', 'refuse to sell anything to anyone', 'close down on the first day'], key: 'A', explanation: 'A business survives only if customers want what it sells and the price covers costs.' },
  { id: 'poor-eco-trivial', subject: 'economics', chapter: 'Introduction & Theory of Consumer Behaviour', route: 'conceptual', type: 'conceptual_mcq', difficulty: 'easy', ref: ['ncert-leec202', null], weakness: 'trivial: absurd distractors let the key be found without subject knowledge',
    body: 'When the price of a good rises and everything else stays the same, a consumer will normally buy:', options: ['less of the good', 'an infinite quantity of the good', 'exactly the same quantity at every price', 'a negative quantity of the good'], key: 'A', explanation: 'By the law of demand a rise in price reduces the quantity demanded.' },
  { id: 'poor-acc-overlong', subject: 'accountancy', chapter: 'Admission of Partner', route: 'numerical', type: 'numerical_calculation', difficulty: 'hard', ref: ['ncert-leac102', 'span-72d2f4711e2e'], weakness: 'time-unsuitable: a multi-step calculation that needs far more than the 72-second average',
    body: 'A and B share profits in the ratio 3 : 2 with capitals of ₹7,00,000 and ₹4,00,000. C is admitted for a 1/4 share, taking it from A and B in their old ratio, and brings ₹5,00,000 as capital and ₹1,00,000 as premium for goodwill, which is credited to A and B in the sacrificing ratio and retained in the business. Assets are revalued upward by ₹50,000 and an unrecorded liability of ₹10,000 is found. The capitals of A and B are then to be made proportionate to the new profit-sharing ratio on the basis of C’s capital, with the difference settled in cash. How much cash must A bring in or withdraw?',
    options: ['Bring in ₹1,16,000', 'Bring in ₹1,40,000', 'Withdraw ₹16,000', 'Bring in ₹2,00,000'], key: 'A', explanation: 'Net revaluation gain ₹40,000 is shared 3 : 2 (A ₹24,000, B ₹16,000). The goodwill premium ₹1,00,000 is shared in the sacrificing ratio 3 : 2 (A ₹60,000, B ₹40,000). A’s capital becomes ₹7,84,000. C’s ₹5,00,000 is 1/4, so total capital is ₹20,00,000 and A’s share (9/20) is ₹9,00,000. A brings in ₹9,00,000 − ₹7,84,000 = ₹1,16,000.' },
  { id: 'poor-bs-trivia', subject: 'business_studies', chapter: 'Staffing', route: 'conceptual', type: 'direct_mcq', difficulty: 'easy', ref: ['ncert-lebs106', 'p1-c0'], weakness: 'peripheral trivia: a name from the chapter’s opening illustration, not a learning objective',
    body: 'In the opening illustration of the Staffing chapter, which leader is described as the public image of Infosys?', options: ['Narayana Murthy', 'N. R. Rao', 'Azim Premji', 'Nandan Nilekani'], key: 'A', explanation: 'The chapter’s opening illustration names Narayana Murthy as the public image of Infosys.' }
];

export const PYQ_SELECTION = { accountancy: 6, business_studies: 6, economics: 6, english: 3 };
