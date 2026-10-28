// Fresh CUET-fit benchmark 2 (authored 7 Oct 2026 AFTER the first benchmark's results were read and the v7.1 contract was written;
// never validated before its freeze). It targets the failure patterns benchmark 1 and the retained audit exposed: conditional answers,
// a second defensible option, plausible-but-unsupported claims, and properly supported poor-fit items.
// Oracles are the author's, from exact registered excerpts and explicit arithmetic, independent of every model.

export const PASSAGES = {
  'v7c-passage-well': { chapter: 'Factual Passage', text: 'The village of Kherwadi repaired its old well in April after a survey found that the water level had dropped by two metres in five years. A committee of eight residents was formed, and each household agreed to contribute ₹150 a year for upkeep. In the first season after the repair, the committee recorded that the well supplied water for 210 days without running dry, compared with 150 days in the previous year. The committee’s secretary pointed out that the monsoon was heavier than usual this year, so the longer supply could not be credited to the repair alone. The committee has therefore proposed to keep measuring the water level every month for three more years before deciding whether to dig a second well.' },
  'v7c-passage-bakery': { chapter: 'Para Jumbles', text: 'Farida opened a small bakery near the bus stop. At first only a few neighbours bought her bread. After she began offering free samples in the morning, more travellers stopped to buy. By the end of the year she had hired two helpers to meet the demand.' }
};

export const BASES = [
  // ---------- Accountancy ----------
  { id: 'acc-deed-statements', subject: 'accountancy', chapter: 'Partnership Fundamentals', route: 'conceptual', type: 'statement_selection', difficulty: 'medium',
    body: 'Consider the following statements about the provisions of the Indian Partnership Act that apply when a partnership deed is silent:\n(A) Profits and losses are shared equally by the partners irrespective of their capital contributions.\n(B) A partner is entitled to claim interest on capital as a matter of right.\n(C) No interest is charged on the drawings of the partners.\n(D) Every partner is entitled to a salary for taking part in the conduct of the business.\nChoose the correct answer from the options given below:',
    options: ['(A) and (B) only', '(A) and (C) only', '(B) and (D) only', '(C) and (D) only'], key: 'B',
    explanation: 'When the deed is silent, profits and losses are shared equally irrespective of capital, and no interest is charged on drawings. No partner can claim interest on capital as of right, and no partner is entitled to salary or remuneration unless the deed provides for it. Only statements (A) and (C) are correct.',
    refs: [['ncert-leac101', 'quality-v4-63927dc5d1aa']], must: ['shared equally', 'No interest is to be charged on the drawings', 'No partner is entitled to claim any interest on the amount of capital', 'No partner is entitled to get salary'],
    variants: {
      second_defensible: { body: 'Consider the following statements about the provisions of the Indian Partnership Act that apply when a partnership deed is silent:\n(A) Profits and losses are shared equally by the partners irrespective of their capital contributions.\n(B) A partner who has advanced a loan to the firm is entitled to interest on it at 6 per cent per annum.\n(C) No interest is charged on the drawings of the partners.\n(D) Every partner is entitled to a salary for taking part in the conduct of the business.\nChoose the correct answer from the options given below:', why: 'Statement B is now also true, so (A), (B) and (C) are correct and the keyed “(A) and (C) only” wrongly excludes B.' },
      wrong_key: { key: 'C' },
      embedded_unsupported: { explanation: 'When the deed is silent, profits and losses are shared equally and no interest is charged on drawings. No partner can claim interest on capital as of right, and no salary is payable unless the deed provides for it. The equal-sharing rule has been applied by Indian courts since the Privy Council decision of 1887 in Lakshmi v. Narayan.', why: 'Three correct claims plus an invented case citation.' } } },
  { id: 'acc-forfeiture-shares', subject: 'accountancy', chapter: 'Share Capital', route: 'numerical', type: 'numerical_calculation', difficulty: 'medium',
    body: 'A company forfeited fully called-up equity shares of ₹10 each, issued at a premium of ₹2 per share that had been received in full. On every forfeited share the only amount unpaid was the final call of ₹3. The total amount credited to Share Forfeiture Account was ₹4,200. How many shares were forfeited?',
    options: ['420 shares', '600 shares', '525 shares', '1,400 shares'], key: 'B',
    explanation: 'Because the premium was received in full, Securities Premium Account is not debited on forfeiture and the premium is not part of the amount forfeited. The amount paid per share on share capital is ₹10 − ₹3 = ₹7, so the number of shares is ₹4,200 ÷ ₹7 = 600.',
    refs: [['ncert-leac201', 'pdf-page-39']], must: ['securities premium account is not to be debited at the time of forfeiture'],
    variants: {
      conditional_answer: { body: 'A company forfeited fully called-up equity shares of ₹10 each. The holders had not paid the final call of ₹3 per share, but the issue premium of ₹2 per share had been received in full. The total amount credited to Share Forfeiture Account on forfeiture was ₹4,200. How many shares were forfeited?', why: 'The audited original stem: 600 holds only if the final call is the sole unpaid amount; if a further ₹4 instalment were also unpaid, 1,400 shares would fit.' },
      wrong_key: { key: 'D' },
      numerical_fault: { body: 'A company forfeited fully called-up equity shares of ₹10 each, issued at a premium of ₹2 per share that had been received in full. On every forfeited share the only amount unpaid was the final call of ₹3. The total amount credited to Share Forfeiture Account was ₹4,500. How many shares were forfeited?', why: '₹4,500 ÷ ₹7 is not a whole number and no option fits.' } } },
  { id: 'acc-collection-period', subject: 'accountancy', chapter: 'Accounting Ratios', route: 'numerical', type: 'numerical_calculation', difficulty: 'medium',
    body: 'Net credit revenue from operations for the year is ₹12,00,000 and average trade receivables are ₹2,40,000. Taking 365 days in a year, what is the average collection period?',
    options: ['5 days', '72 days', '73 days', '1,460 days'], key: 'C',
    explanation: 'Trade receivables turnover ratio = net credit revenue from operations ÷ average trade receivables = ₹12,00,000 ÷ ₹2,40,000 = 5 times. Average collection period = 365 ÷ turnover ratio = 365 ÷ 5 = 73 days.',
    refs: [['ncert-leac205', 'pdf-page-26'], ['ncert-leac205', 'pdf-page-27']], must: ['Net Credit Revenue from operation', 'Average Collection Period = 365'],
    variants: {
      conditional_answer: { body: 'Net credit revenue from operations for the year is ₹12,00,000 and average trade receivables are ₹2,40,000. What is the average collection period?', why: 'The number of days in the year is not given; 360 days gives 72 days, 365 gives 73, and both are options.' },
      wrong_key: { key: 'B' },
      explanation_arithmetic: { explanation: 'Trade receivables turnover ratio = net credit revenue from operations ÷ average trade receivables = ₹12,00,000 ÷ ₹2,40,000 = 6 times. Average collection period = 365 ÷ turnover ratio = 365 ÷ 5 = 73 days.', why: 'The key is right but the explanation states an incorrect intermediate ratio (6 times).' } } },
  // ---------- Business Studies ----------
  { id: 'bs-scalar-chain', subject: 'business_studies', chapter: 'Principles of Management', route: 'conceptual', type: 'conceptual_mcq', difficulty: 'easy',
    body: 'The formal lines of authority from the highest to the lowest ranks of an organisation are known as:',
    options: ['unity of direction', 'scalar chain', 'esprit de corps', 'centralisation'], key: 'B',
    explanation: 'An organisation consists of superiors and subordinates, and the formal lines of authority from the highest to the lowest ranks are known as the scalar chain.',
    refs: [['ncert-lebs102', 'pdf-page-29']], must: ['formal lines of authority from highest to lowest ranks are known as scalar chain'],
    variants: {
      second_defensible: { options: ['unity of direction', 'scalar chain', 'esprit de corps', 'the chain of authority and communication that runs from top to bottom'], why: 'Option D restates the scalar chain, so B and D are both correct.' },
      wrong_key: { key: 'A' },
      embedded_unsupported: { explanation: 'The formal lines of authority from the highest to the lowest ranks are known as the scalar chain. Fayol stated that a scalar chain should never have more than seven levels.', why: 'The seven-level claim is invented.' } } },
  { id: 'bs-economic-objectives', subject: 'business_studies', chapter: 'Nature & Significance of Management', route: 'conceptual', type: 'conceptual_mcq', difficulty: 'easy',
    body: 'Which of the following is NOT one of the economic objectives of a business named in the textbook?',
    options: ['Survival', 'Profit', 'Growth', 'Social service to society'], key: 'D',
    explanation: 'The textbook names survival, profit and growth as the economic objectives of a business. Social service is not among the three.',
    refs: [['ncert-lebs101', 'quality-v4-1cf5c10664d2']], must: ['These are survival, profit and growth'],
    variants: {
      wrong_key: { key: 'B' },
      second_defensible: { options: ['Survival', 'Profit', 'Social service to society', 'Employee recreation'], why: 'Options C and D are both outside the three economic objectives, so the NOT stem has two correct answers.' },
      embedded_unsupported: { explanation: 'Survival, profit and growth are the economic objectives. A business must also reinvest at least 30 per cent of its profit under the Companies Act to count growth as an objective.', why: 'The 30 per cent rule is invented.' } } },
  { id: 'bs-planning-meaning', subject: 'business_studies', chapter: 'Planning', route: 'conceptual', type: 'conceptual_mcq', difficulty: 'easy',
    body: 'Which of the following best describes planning?',
    options: ['Setting objectives and targets and formulating an action plan to achieve them', 'Comparing actual performance with the standards set', 'Assigning duties to employees and grouping activities', 'Guiding and motivating employees to work towards the goals'], key: 'A',
    explanation: 'Planning means setting objectives and targets and formulating an action plan to achieve them.',
    refs: [['ncert-lebs104', 'pdf-page-3']], must: ['planning means setting objectives and targets and formulating an action plan to achieve them'],
    variants: {
      wrong_key: { key: 'B' },
      second_defensible: { options: ['Setting objectives and targets and formulating an action plan to achieve them', 'Comparing actual performance with the standards set', 'Deciding beforehand the targets and the plan of action by which to reach them', 'Guiding and motivating employees to work towards the goals'], why: 'Options A and C both describe planning.' },
      embedded_unsupported: { explanation: 'Planning means setting objectives and targets and formulating an action plan. Planning was first formalised as a separate function by Taylor in the 1911 Dartmouth Conference.', why: 'The conference is invented.' } } },
  { id: 'bs-internal-recruitment', subject: 'business_studies', chapter: 'Staffing', route: 'conceptual', type: 'conceptual_mcq', difficulty: 'easy',
    body: 'Which of the following is an internal source of recruitment?',
    options: ['Advertisement in newspapers', 'Promotion of an existing employee', 'Private placement agencies', 'Campus recruitment'], key: 'B',
    explanation: 'The two important sources of internal recruitment are transfers and promotions, so the promotion of an existing employee is an internal source.',
    refs: [['ncert-lebs106', 'p11-c0']], must: ['transfers and promotions'],
    variants: {
      wrong_key: { key: 'A' },
      second_defensible: { options: ['Advertisement in newspapers', 'Promotion of an existing employee', 'Private placement agencies', 'Transfer of an employee from one department to another'], why: 'Both promotion and transfer are internal sources.' },
      embedded_unsupported: { explanation: 'Transfers and promotions are the two internal sources of recruitment, so promotion of an existing employee is internal. Internal recruitment is banned for public-sector undertakings by the Public Services Act.', why: 'The ban is invented.' } } },
  // ---------- Economics ----------
  { id: 'eco-pc-features', subject: 'economics', chapter: 'Theory of Firms under Perfect Competition', route: 'conceptual', type: 'statement_selection', difficulty: 'medium',
    body: 'Consider the following statements about a perfectly competitive market:\n(A) The market consists of a large number of buyers and sellers.\n(B) Each firm sells a differentiated product.\n(C) Entry into and exit from the market are free for firms.\n(D) A single firm produces a significant share of the total market output.\nChoose the correct answer from the options given below:',
    options: ['(A) and (B) only', '(A) and (C) only', '(B) and (D) only', '(C) and (D) only'], key: 'B',
    explanation: 'A perfectly competitive market has a large number of buyers and sellers, a homogeneous product, and free entry and exit. Statements (A) and (C) are correct; products are not differentiated and no single firm has a significant share.',
    refs: [['ncert-leec204', 'p1-c0']], must: ['large number of buyers and sellers', 'homogenous product', 'free for firms'],
    variants: {
      second_defensible: { body: 'Consider the following statements about a perfectly competitive market:\n(A) The market consists of a large number of buyers and sellers.\n(B) Each firm sells a differentiated product.\n(C) Entry into and exit from the market are free for firms.\n(D) The product of one firm cannot be differentiated from the product of any other firm.\nChoose the correct answer from the options given below:', why: 'Statement D is now true, so (A), (C) and (D) are correct and the keyed “(A) and (C) only” excludes D.' },
      wrong_key: { key: 'D' },
      embedded_unsupported: { explanation: 'A perfectly competitive market has many buyers and sellers, a homogeneous product, and free entry and exit, so (A) and (C) are correct. Empirically, fewer than 2 per cent of Indian industries meet all these conditions.', why: 'The 2 per cent figure is invented.' } } },
  { id: 'eco-capital-receipt', subject: 'economics', chapter: 'Government Budget & the Economy', route: 'conceptual', type: 'conceptual_mcq', difficulty: 'easy',
    body: 'Which of the following is a capital receipt of the government?',
    options: ['Income tax collected during the year', 'Proceeds from the sale of shares of a public sector undertaking', 'Corporation tax collected during the year', 'Excise duty collected during the year'], key: 'B',
    explanation: 'Receipts that create a liability or reduce the financial assets of the government are capital receipts. The sale of shares of a public sector undertaking (disinvestment) reduces the government’s financial assets. Taxes are revenue receipts, which do not lead to a claim on the government.',
    refs: [['ncert-leec105', 'quality-v4-28dc3b745963'], ['ncert-leec105', 'quality-v3-pdf-page-3-681bdd9372']], must: ['create liability or reduce financial assets are termed as capital receipts', 'do not lead to a claim on the government'],
    variants: {
      wrong_key: { key: 'A' },
      stem_wording: { body: 'All those receipts which create a liability and also decrease the assets of the government are known as capital receipts. Which of the following is a capital receipt of the government?', why: 'The textbook definition is “create liability OR reduce financial assets”; the stem narrows it to AND, under which proceeds from sale of shares (no new liability) would not qualify.' },
      embedded_unsupported: { explanation: 'Disinvestment reduces the financial assets of the government, so it is a capital receipt, while taxes are revenue receipts. Revenue receipts are also never allowed to exceed 40 per cent of capital receipts under the FRBM Act.', why: 'The FRBM claim is invented.' } } },
  { id: 'eco-multiplier-assumption', subject: 'economics', chapter: 'Income Determination', route: 'numerical', type: 'numerical_calculation', difficulty: 'medium',
    body: 'In a simple economy with a fixed price level, no government sector and no taxes, autonomous expenditure increases by ₹50 crore. If the marginal propensity to consume is 0.8, the total increase in equilibrium output is:',
    options: ['₹40 crore', '₹62.5 crore', '₹250 crore', '₹400 crore'], key: 'C',
    explanation: 'The autonomous expenditure multiplier is 1 ÷ (1 − MPC) = 1 ÷ 0.2 = 5. The increase in equilibrium output is 5 × ₹50 crore = ₹250 crore.',
    refs: [['ncert-leec104', 'pdf-page-10']], must: ['1 – 0.8'],
    variants: {
      conditional_answer: { body: 'Autonomous expenditure in an economy increases by ₹50 crore. If the marginal propensity to consume is 0.8, the total increase in equilibrium output is:', why: 'Without “no government and no taxes” a proportional tax or leakage changes the multiplier, and the stem is not a simple economy.' },
      stem_leakage: { body: 'In an economy with a fixed price level and a proportional income tax of 25 per cent, autonomous expenditure increases by ₹50 crore. If the marginal propensity to consume is 0.8, the total increase in equilibrium output is:', why: 'With a 25 per cent tax the multiplier is 1 ÷ (1 − 0.8 × 0.75) = 2.5 and the output rise is ₹125 crore, not the keyed ₹250 crore.' },
      wrong_key: { key: 'B' } } },
  { id: 'eco-afc-total-cost', subject: 'economics', chapter: 'Production & Costs', route: 'numerical', type: 'numerical_calculation', difficulty: 'easy',
    body: 'In the short run a firm’s total cost of producing 4 units is ₹130 and its total cost of producing 5 units is ₹148. What is the short run marginal cost of the fifth unit?',
    options: ['₹18', '₹26', '₹29.6', '₹148'], key: 'A',
    explanation: 'Short run marginal cost is the change in total cost per unit change in output: (₹148 − ₹130) ÷ (5 − 4) = ₹18. ₹29.6 is the average cost of 5 units.',
    refs: [['ncert-leec203', 'p9-c1856']], must: ['marginal cost (SMC) is defined as the change in total cost per unit of change in output'],
    variants: {
      numerical_fault: { body: 'In the short run a firm’s total cost of producing 4 units is ₹130 and its total cost of producing 5 units is ₹150. What is the short run marginal cost of the fifth unit?', why: 'The marginal cost becomes ₹20, which is not an option.' },
      wrong_key: { key: 'B' },
      explanation_arithmetic: { explanation: 'Short run marginal cost is the change in total cost per unit change in output: (₹148 − ₹130) ÷ (5 − 4) = ₹22. ₹29.6 is the average cost of 5 units.', why: 'The key is right but the explanation states ₹22.' } } },
  // ---------- English ----------
  { id: 'eng-antonym-elated', subject: 'english', chapter: 'Vocabulary', route: 'conceptual', type: 'antonym', difficulty: 'easy',
    body: 'Choose the word that is most nearly opposite in meaning to “elated”.',
    options: ['Dejected', 'Excited', 'Thrilled', 'Cheerful'], key: 'A',
    explanation: '“Elated” means very happy and excited because of something good. The opposite is “dejected”; “excited”, “thrilled” and “cheerful” are close to it in meaning.',
    refs: [['oxford-quality-elated', 'definition']], must: ['very happy and excited'],
    variants: {
      wrong_key: { key: 'C' },
      second_defensible: { options: ['Dejected', 'Excited', 'Thrilled', 'Downcast'], why: 'Dejected and downcast are both opposites of elated.' },
      embedded_unsupported: { explanation: '“Elated” means very happy and excited, so “dejected” is its opposite. The word comes from the Latin elatus, first recorded in English in 1570 in the plays of Marlowe.', why: 'The first-record claim is invented.' } } },
  { id: 'eng-usage-vigilant', subject: 'english', chapter: 'Correct Word Usage', route: 'conceptual', type: 'correct_word_usage', difficulty: 'easy',
    body: 'Choose the sentence in which the word “vigilant” is used correctly.',
    options: ['The vigilant soup was hot and tasty.', 'The vigilant guard noticed the stranger at the gate at once.', 'She was vigilant to eat a large lunch.', 'The vigilant river was wide and brown.'], key: 'B',
    explanation: '“Vigilant” means very careful to notice any signs of danger or trouble. A guard who notices a stranger at the gate at once is vigilant; soup and a river cannot be vigilant.',
    refs: [['oxford-quality-vigilant', 'definition']], must: ['very careful to notice any signs of danger'],
    variants: {
      wrong_key: { key: 'D' },
      second_defensible: { options: ['The vigilant soup was hot and tasty.', 'The vigilant guard noticed the stranger at the gate at once.', 'The vigilant nurse watched for any change in the patient’s condition.', 'The vigilant river was wide and brown.'], why: 'The nurse sentence is also correct.' } } },
  { id: 'eng-match-definitions-2', subject: 'english', chapter: 'Match the Following', route: 'conceptual', type: 'matching', difficulty: 'medium',
    body: 'Match the words with their meanings.\nList-I: (A) Gregarious (B) Feeble (C) Resolute\nList-II: (I) Very weak (II) Strong and determined (III) Liking to be with other people\nChoose the correct matching.',
    options: ['(A)-(I), (B)-(II), (C)-(III)', '(A)-(III), (B)-(I), (C)-(II)', '(A)-(II), (B)-(III), (C)-(I)', '(A)-(III), (B)-(II), (C)-(I)'], key: 'B',
    explanation: 'Gregarious means liking to be with other people, feeble means very weak and resolute means strong and determined. The matching is A-III, B-I, C-II.',
    refs: [['oxford-quality-gregarious', 'definition'], ['oxford-quality-feeble', 'definition'], ['oxford-quality-resolute', 'definition']], must: ['liking to be with other people', 'very weak', 'strong and determined'],
    variants: {
      wrong_key: { key: 'D' },
      embedded_unsupported: { explanation: 'Gregarious means liking to be with other people, feeble means very weak and resolute means strong and determined, so the matching is A-III, B-I, C-II. “Feeble” is derived from the Old French word fleible, meaning “to weep”.', why: 'The derivation is invented.' } } },
  { id: 'eng-rc-well-detail', subject: 'english', chapter: 'Factual Passage', route: 'passage', type: 'reading_comprehension', difficulty: 'easy', passage: 'v7c-passage-well',
    body: 'For how many days did the repaired well supply water in the first season after the repair?',
    options: ['150 days', '210 days', '365 days', '60 days'], key: 'B',
    explanation: 'The committee recorded that the well supplied water for 210 days in the first season after the repair, compared with 150 days in the previous year.',
    refs: [['v7c-passage-well', 'stimulus']], must: ['210 days'],
    variants: {
      wrong_key: { key: 'A' },
      passage_unanswerable: { body: 'How much did the committee spend on repairing the well?', why: 'The passage gives the households’ contribution for upkeep but not the cost of the repair.' } } },
  { id: 'eng-rc-well-inference', subject: 'english', chapter: 'Factual Passage', route: 'passage', type: 'reading_comprehension', difficulty: 'medium', passage: 'v7c-passage-well',
    body: 'Why has the committee proposed to keep measuring the water level for three more years?',
    options: ['Because the longer supply this year cannot be credited to the repair alone', 'Because the heavy monsoon has damaged the second well', 'Because each household has refused to contribute', 'Because the repair has failed to improve the supply'], key: 'A',
    explanation: 'The secretary pointed out that the monsoon was heavier than usual, so the longer supply could not be credited to the repair alone. The committee wants more measurements before deciding whether to dig a second well.',
    refs: [['v7c-passage-well', 'stimulus']], must: ['could not be credited to the repair alone'],
    variants: {
      wrong_key: { key: 'D' },
      second_defensible: { options: ['Because the longer supply this year cannot be credited to the repair alone', 'Because the heavy monsoon has damaged the second well', 'Because the committee wants more evidence on how much the repair, rather than the rain, improved the supply', 'Because the repair has failed to improve the supply'], why: 'Options A and C both state the supported reason.' } } },
  { id: 'eng-paraj-bakery', subject: 'english', chapter: 'Para Jumbles', route: 'conceptual', type: 'sequence_ordering', difficulty: 'easy', passage: 'v7c-passage-bakery', stimulusOnly: true,
    body: 'Arrange the following sentences in the correct order.\n(A) By the end of the year she had hired two helpers to meet the demand.\n(B) After she began offering free samples in the morning, more travellers stopped to buy.\n(C) Farida opened a small bakery near the bus stop.\n(D) At first only a few neighbours bought her bread.\nChoose the correct sequence from the options given below:',
    options: ['(C)-(D)-(B)-(A)', '(C)-(B)-(D)-(A)', '(D)-(C)-(B)-(A)', '(C)-(D)-(A)-(B)'], key: 'A',
    explanation: 'Farida opens the bakery first (C). At first only a few neighbours buy (D). After she offers free samples, more travellers buy (B). By the end of the year she hires helpers (A). The order is C-D-B-A.',
    refs: [['v7c-passage-bakery', 'stimulus']], must: ['After she began offering free samples'],
    variants: {
      wrong_key: { key: 'B' },
      second_defensible: { options: ['(C)-(D)-(B)-(A)', '(C)-(B)-(D)-(A)', '(C), (D), (B), (A)', '(C)-(D)-(A)-(B)'], why: 'Options A and C are the same sequence.' } } }
];

// Syllabus mismatch (v2): excluded topics and clearly out-of-baseline content, each academically correct.
export const OUT_OF_SYLLABUS = [
  { id: 'oos2-acc-receipts-payments', subject: 'accountancy', chapter: 'Partnership Fundamentals', ref: ['ncert-leac101', 'pdf-page-5'],
    body: 'A club’s receipts and payments account shows opening cash of ₹10,000, receipts of ₹90,000 and payments of ₹70,000. What is the closing cash balance?', options: ['₹10,000', '₹20,000', '₹30,000', '₹70,000'], key: 'C', explanation: 'Closing cash = opening cash + receipts − payments = 10,000 + 90,000 − 70,000 = ₹30,000.' },
  { id: 'oos2-acc-surplus-capital', subject: 'accountancy', chapter: 'Dissolution of Partnership', ref: ['ncert-leac104', null],
    body: 'In the piecemeal distribution of cash on dissolution under the surplus capital method, which item is paid first from the cash available?', options: ['Partners’ capital', 'Partners’ loans', 'Realisation expenses and outside liabilities', 'Partners’ drawings'], key: 'C', explanation: 'Under the surplus capital method, cash is first applied to realisation expenses and outside liabilities.' },
  { id: 'oos2-acc-purchase-consideration', subject: 'accountancy', chapter: 'Dissolution of Partnership Firm', ref: ['ncert-leac104', null],
    body: 'A firm is sold to a company for assets taken over at ₹8,00,000 and liabilities taken over at ₹2,00,000. What is the purchase consideration under the net payment method?', options: ['₹2,00,000', '₹6,00,000', '₹8,00,000', '₹10,00,000'], key: 'B', explanation: 'Purchase consideration = assets taken over − liabilities taken over = ₹8,00,000 − ₹2,00,000 = ₹6,00,000.' },
  { id: 'oos2-acc-insolvent-partner', subject: 'accountancy', chapter: 'Dissolution of Partnership', ref: ['ncert-leac104', null],
    body: 'A partner is declared insolvent with a deficiency of ₹30,000. The solvent partners X and Y have fixed capitals of ₹60,000 and ₹40,000. Under Garner v. Murray, how much of the deficiency does X bear?', options: ['₹12,000', '₹15,000', '₹18,000', '₹20,000'], key: 'C', explanation: 'The deficiency is shared in the ratio of fixed capitals 3 : 2, so X bears 3/5 × ₹30,000 = ₹18,000.' },
  { id: 'oos2-bs-entrepreneurship', subject: 'business_studies', chapter: 'Entrepreneurship Development', ref: ['ncert-lebs101', null],
    body: 'Which of the following is a characteristic feature of an entrepreneur?', options: ['Avoiding every risk', 'Willingness to take calculated risks', 'Relying only on routine', 'Never innovating'], key: 'B', explanation: 'Entrepreneurs are characterised by a willingness to take calculated risks.' },
  { id: 'oos2-eco-mean', subject: 'economics', chapter: 'Production & Costs', ref: ['ncert-leec203', 'p5-c0'],
    body: 'The monthly sales (in ₹ thousand) of a shop over five months are 10, 12, 14, 16 and 18. What is the arithmetic mean of the sales?', options: ['12', '13', '14', '15'], key: 'C', explanation: 'The mean is (10 + 12 + 14 + 16 + 18) ÷ 5 = 70 ÷ 5 = 14.' },
  { id: 'oos2-eco-is-lm', subject: 'economics', chapter: 'Income Determination', ref: ['ncert-leec104', 'pdf-page-10'],
    body: 'In the IS-LM framework, an increase in the money supply with an unchanged IS curve shifts the:', options: ['LM curve to the right', 'IS curve to the right', 'LM curve to the left', 'IS curve to the left'], key: 'A', explanation: 'An increase in the money supply shifts the LM curve to the right.' },
  { id: 'oos2-eco-regression', subject: 'economics', chapter: 'Money & Banking', ref: ['ncert-leec103', 'pdf-page-7'],
    body: 'In the simple regression line Y = a + bX, what does the coefficient b measure?', options: ['The change in Y for a unit change in X', 'The value of X when Y is zero', 'The mean of X', 'The correlation between X and Y squared'], key: 'A', explanation: 'The slope b measures the change in Y for a unit change in X.' }
];

// Valid, supported, but a poor fit for CUET (author judgment, reported separately from correctness).
export const POOR_FIT = [
  { id: 'poor2-bs-trivial-survival', subject: 'business_studies', chapter: 'Nature & Significance of Management', route: 'conceptual', type: 'conceptual_mcq', difficulty: 'easy', ref: ['ncert-lebs101', 'quality-v4-1cf5c10664d2'], weakness: 'trivial: absurd distractors let the key be found without subject knowledge',
    body: 'To survive, a business must earn enough revenue to:', options: ['cover its costs', 'pay no one at all', 'close on the first day', 'stop all its customers from buying'], key: 'A', explanation: 'In order to survive, an organisation must earn enough revenues to cover costs.' },
  { id: 'poor2-eco-trivial-demand', subject: 'economics', chapter: 'Introduction & Theory of Consumer Behaviour', route: 'conceptual', type: 'conceptual_mcq', difficulty: 'easy', ref: ['ncert-leec202', 'p20-c0'], weakness: 'trivial: absurd distractors let the key be found without subject knowledge',
    body: 'As the price of a good rises, other things unchanged, its quantity demanded normally:', options: ['moves in the opposite direction', 'doubles every hour', 'stays fixed for ever whatever the price', 'turns into a different good'], key: 'A', explanation: 'The demand for a good moves in the opposite direction of its price.' },
  { id: 'poor2-acc-overlong', subject: 'accountancy', chapter: 'Admission of Partner', route: 'numerical', type: 'numerical_calculation', difficulty: 'hard', ref: ['ncert-leac102', 'span-72d2f4711e2e'], weakness: 'time-unsuitable: about nine separate steps, far beyond the 72-second average',
    body: 'X and Y share profits in the ratio 3 : 2 with capitals of ₹6,00,000 and ₹4,00,000. Z is admitted for a 1/5 share, taking 1/10 from X and 1/10 from Y. Z brings ₹3,00,000 as capital and ₹50,000 as premium for goodwill, which is credited to X and Y in the sacrificing ratio and withdrawn by them at once. A reserve of ₹1,00,000 exists. Assets are revalued downward by ₹20,000 and an unrecorded liability of ₹5,000 is found. The capitals of X and Y are then made proportionate to the new profit-sharing ratio on the basis of Z’s capital, with differences settled in cash. How much cash must Y bring in or withdraw?',
    options: ['Bring in ₹20,000', 'Bring in ₹45,000', 'Withdraw ₹20,000', 'Bring in ₹70,000'], key: 'A', explanation: 'New ratio 5 : 3 : 2. Reserve ₹1,00,000 shared 3 : 2 gives X ₹60,000 and Y ₹40,000. The revaluation loss ₹25,000 shared 3 : 2 gives X ₹15,000 and Y ₹10,000. The goodwill premium is credited and withdrawn, so it does not change capitals. Y’s capital = 4,00,000 + 40,000 − 10,000 = ₹4,30,000. Z’s ₹3,00,000 is 2/10, so total capital is ₹15,00,000 and Y’s share (3/10) is ₹4,50,000. Y brings in ₹20,000.' },
  { id: 'poor2-bs-trivia-planning', subject: 'business_studies', chapter: 'Planning', route: 'conceptual', type: 'direct_mcq', difficulty: 'easy', ref: ['ncert-lebs104', 'pdf-page-5'], weakness: 'peripheral trivia: a figure from the chapter’s opening illustration, not a learning objective',
    body: 'In the Planning chapter’s opening illustration, the objective of the year was to increase capacity by how many more professionals?', options: ['1,500 to 2,000', '150 to 200', '15,000 to 20,000', '500 to 800'], key: 'A', explanation: 'The illustration states the objective of increasing capacity by 1,500 to 2,000 more professionals.' },
  { id: 'poor2-eco-trivia-table', subject: 'economics', chapter: 'Production & Costs', route: 'conceptual', type: 'direct_mcq', difficulty: 'easy', ref: ['ncert-leec203', 'p5-c0'], weakness: 'peripheral trivia: reading one cell of a textbook table, not a learning objective',
    body: 'In Table 3.2 of the chapter, what is the total product of labour at 3 units of labour?', options: ['40', '14', '24', '10'], key: 'A', explanation: 'In Table 3.2 the total product at 3 units of labour is 40.' }
];
