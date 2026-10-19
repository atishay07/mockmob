// Lives outside lib/features/social on purpose: question text names rupee amounts and "years' purchase", which the Mob's no-selling scan would read as copy.
// The fixture server's question bank: 24 Accountancy questions on Goodwill (CUET UG Accountancy, Unit
// "Accounting for Partnership Firms"). Only the fixture server reads the correct index and the
// explanation, after close, exactly as the real server does (F1). Used in fixture mode and tests only.

class BankQuestion {
  const BankQuestion(this.stem, this.options, this.correct, this.explanation);

  final String stem;
  final List<String> options;
  final int correct;
  final String explanation;
}

const List<BankQuestion> mobV3Bank = [
  BankQuestion(
    "Goodwill is three years' purchase of the average profit of the last four years: ₹40,000, ₹50,000, ₹60,000 and ₹70,000. What is the goodwill?",
    ['₹1,50,000', '₹1,65,000', '₹1,80,000', '₹2,10,000'],
    1,
    'The average profit is ₹2,20,000 ÷ 4 = ₹55,000. Three years\' purchase means 3 × ₹55,000 = ₹1,65,000.',
  ),
  BankQuestion(
    'A firm earns an average profit of ₹60,000. Its capital employed is ₹5,00,000 and the normal rate of return is 10%. What is its super profit?',
    ['₹6,000', '₹10,000', '₹50,000', '₹60,000'],
    1,
    'Normal profit is 10% of ₹5,00,000 = ₹50,000. Super profit is ₹60,000 − ₹50,000 = ₹10,000.',
  ),
  BankQuestion(
    "The super profit of a firm is ₹12,000. What is the goodwill at four years' purchase of the super profit?",
    ['₹12,000', '₹36,000', '₹48,000', '₹60,000'],
    2,
    "Four years' purchase of the super profit is 4 × ₹12,000 = ₹48,000.",
  ),
  BankQuestion(
    'A firm earns a super profit of ₹15,000, and the normal rate of return is 10%. What is the goodwill by capitalising the super profit?',
    ['₹15,000', '₹1,00,000', '₹1,50,000', '₹1,65,000'],
    2,
    'Capitalising the super profit means dividing it by the normal rate: ₹15,000 × 100 ÷ 10 = ₹1,50,000. ₹1,00,000 comes from dividing by 15%, which is not the normal rate here.',
  ),
  BankQuestion(
    'Goodwill is which kind of asset?',
    ['A fictitious asset', 'An intangible asset', 'A current asset', 'A liquid asset'],
    1,
    'Goodwill has value but no physical form, so it is an intangible asset. It is not fictitious, because it can be sold with the business.',
  ),
  BankQuestion(
    'Which of these does not affect the goodwill of a firm?',
    ['The nature of the business', 'A favourable location', "The owner's personal expenses", 'Efficient management'],
    2,
    "Goodwill comes from the firm's ability to earn more than normal. The owner's personal expenses are not the firm's, so they do not affect it.",
  ),
  BankQuestion(
    'Profits for three years were ₹20,000, ₹30,000 and ₹40,000, with weights 1, 2 and 3. What is the weighted average profit?',
    ['₹30,000', '₹33,333', '₹35,000', '₹40,000'],
    1,
    'The weighted total is ₹20,000 + ₹60,000 + ₹1,20,000 = ₹2,00,000. Divided by the total weight of 6, that is ₹33,333.',
  ),
  BankQuestion(
    'A and B have capitals of ₹1,20,000 and ₹80,000. C brings ₹80,000 for a quarter share. What is the hidden goodwill?',
    ['₹20,000', '₹40,000', '₹80,000', '₹1,20,000'],
    1,
    'C\'s ₹80,000 for a quarter values the firm at ₹3,20,000. The capitals add up to ₹2,80,000, so the hidden goodwill is ₹40,000.',
  ),
  BankQuestion(
    "When goodwill is three years' purchase of the average profit, what does \"purchase\" mean?",
    ['The cost of buying goodwill', "The number of years' profits paid for", 'The rate of interest', "The last year's profit"],
    1,
    "\"Years' purchase\" is how many years of profit a buyer pays for the business's reputation.",
  ),
  BankQuestion(
    'Capital employed is ₹4,00,000 and the normal rate of return is 12%. What is the normal profit?',
    ['₹40,000', '₹48,000', '₹52,000', '₹4,80,000'],
    1,
    'Normal profit is 12% of ₹4,00,000 = ₹48,000.',
  ),
  BankQuestion(
    'Goodwill brought in cash by a new partner is shared by the old partners in which ratio?',
    ['Their capital ratio', 'Their sacrificing ratio', 'Their gaining ratio', 'The new profit ratio'],
    1,
    'The old partners give up part of their share to the new partner, so they are paid for it in the sacrificing ratio.',
  ),
  BankQuestion(
    "On a partner's retirement, the remaining partners are debited with goodwill in which ratio?",
    ['The gaining ratio', 'The sacrificing ratio', 'The old ratio', 'The capital ratio'],
    0,
    'The remaining partners gain the retiring partner\'s share, so they pay for it in the gaining ratio.',
  ),
  BankQuestion(
    'Under AS 26, goodwill that a firm builds itself is:',
    ['Recorded in the books', 'Not recorded in the books', 'Recorded at cost', 'Written off every year'],
    1,
    'AS 26 allows only purchased goodwill in the books. Self-generated goodwill is never recorded.',
  ),
  BankQuestion(
    'Capital employed was ₹2,00,000 at the start of the year and ₹2,40,000 at the end. What is the average capital employed?',
    ['₹2,00,000', '₹2,20,000', '₹2,40,000', '₹4,40,000'],
    1,
    'The average is (₹2,00,000 + ₹2,40,000) ÷ 2 = ₹2,20,000.',
  ),
  BankQuestion(
    "Average profit is ₹75,000 and normal profit is ₹60,000. What is the goodwill at two years' purchase of the super profit?",
    ['₹15,000', '₹30,000', '₹60,000', '₹1,50,000'],
    1,
    "The super profit is ₹15,000, and two years' purchase is 2 × ₹15,000 = ₹30,000.",
  ),
  BankQuestion(
    "While finding the average profit, an abnormal loss in one year is:",
    ["Deducted from that year's profit", "Added back to that year's profit", 'Ignored', 'Spread over all years'],
    1,
    'An abnormal loss will not recur, so it is added back to show the normal earning power.',
  ),
  BankQuestion(
    'Average profit is ₹30,000, the normal rate is 10%, and net assets are ₹2,50,000. What is the goodwill by capitalising the average profit?',
    ['₹25,000', '₹50,000', '₹2,50,000', '₹3,00,000'],
    1,
    'The capitalised value is ₹30,000 × 100 ÷ 10 = ₹3,00,000. Less net assets of ₹2,50,000 leaves goodwill of ₹50,000.',
  ),
  BankQuestion(
    'On admission, goodwill already in the old balance sheet is written off among the old partners in which ratio?',
    ['The old ratio', 'The new ratio', 'The sacrificing ratio', 'The gaining ratio'],
    0,
    'That goodwill was built while the old ratio applied, so it is written off in the old ratio.',
  ),
  BankQuestion(
    'A new partner cannot bring his share of goodwill in cash. His share is:',
    ["Debited to his current account", 'Credited to his capital account', 'Ignored', 'Debited to the goodwill account'],
    0,
    "His share is debited to his current (or capital) account and credited to the sacrificing partners.",
  ),
  BankQuestion(
    'A and B share profits 3:2. C joins and the new ratio is 2:2:1. Who gave up C\'s share?',
    ['A and B equally', 'Only A', 'Only B', 'Neither of them'],
    1,
    'A goes from 3/5 to 2/5 and B stays at 2/5, so only A gave up a share.',
  ),
  BankQuestion(
    "Profits were ₹30,000, ₹40,000 and ₹50,000. What is the goodwill at two years' purchase of the average profit?",
    ['₹40,000', '₹80,000', '₹1,20,000', '₹60,000'],
    1,
    "The average profit is ₹40,000, and two years' purchase is ₹80,000.",
  ),
  BankQuestion(
    'Capital employed is ₹2,00,000, the normal rate is 15%, and the average profit is ₹40,000. What is the super profit?',
    ['₹10,000', '₹30,000', '₹40,000', '₹25,000'],
    0,
    'Normal profit is 15% of ₹2,00,000 = ₹30,000, so the super profit is ₹40,000 − ₹30,000 = ₹10,000.',
  ),
  BankQuestion(
    'Goodwill is valued at ₹60,000 and a new partner gets a quarter share. What is his share of goodwill?',
    ['₹12,000', '₹15,000', '₹20,000', '₹60,000'],
    1,
    'A quarter of ₹60,000 is ₹15,000.',
  ),
  BankQuestion(
    'Which method values goodwill by dividing the super profit by the normal rate of return?',
    ['The average profit method', "The super profit method", 'The capitalisation of super profit method', 'The weighted average method'],
    2,
    'Dividing the super profit by the normal rate is capitalising it, so it is the capitalisation of super profit method.',
  ),
];
