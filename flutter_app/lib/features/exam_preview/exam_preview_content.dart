import '../../core/models/question.dart';

/// One section of the sample paper: a tab on the exam screen with its own palette.
class PreviewSection {
  const PreviewSection({required this.id, required this.name, required this.questions});

  final String id;
  final String name;
  final List<SessionQuestion> questions;
}

List<QuestionOption> _opts(List<String> texts) => [
  for (var i = 0; i < texts.length; i++) QuestionOption(key: String.fromCharCode(65 + i), text: texts[i]),
];

SessionQuestion _q(String id, String subject, String chapter, String difficulty, String question, List<String> options) =>
    SessionQuestion(id: id, subject: subject, chapter: chapter, difficulty: difficulty, question: question, options: _opts(options));

/// The sample paper (CUET shape: a language, a domain subject, the General Test). Fifteen short,
/// correct questions, five to a section. It carries no answer key: the preview never scores.
final List<PreviewSection> kPreviewSections = [
  PreviewSection(
    id: 'english',
    name: 'English',
    questions: [
      _q('pe1', 'english', 'Vocabulary', 'easy', 'Choose the option nearest in meaning to CANDID:', ['Hidden', 'Frank', 'Careful', 'Sweet']),
      _q('pe2', 'english', 'Spelling', 'easy', 'Choose the correctly spelt word:', ['Accomodate', 'Acommodate', 'Accommodate', 'Accommadate']),
      _q('pe3', 'english', 'Vocabulary', 'medium', 'Choose the opposite of ABUNDANT:', ['Plentiful', 'Scarce', 'Ample', 'Generous']),
      _q('pe4', 'english', 'Grammar', 'medium', 'Complete the sentence: Neither of the answers ___ correct.', ['are', 'were', 'is', 'have']),
      _q('pe5', 'english', 'Idioms', 'medium', 'Choose the meaning of "a blessing in disguise":', [
        'An unexpected benefit',
        'An obvious problem',
        'A secret promise',
        'A hurried decision',
      ]),
    ],
  ),
  PreviewSection(
    id: 'accountancy',
    name: 'Accountancy',
    questions: [
      _q('pa1', 'accountancy', 'Accounting basics', 'easy', 'Which of these is a current asset?', ['Cash in hand', 'Land', 'Machinery', 'Goodwill']),
      _q('pa2', 'accountancy', 'Trial balance', 'medium', 'A trial balance is prepared to check that:', [
        'Total debits equal total credits',
        'Profit is as high as possible',
        'All assets are valued at market price',
        'Every bill has been paid',
      ]),
      _q('pa3', 'accountancy', 'Depreciation', 'easy', 'Depreciation is charged on:', ['Fixed assets', 'Current assets', 'Closing stock', 'Debtors']),
      _q('pa4', 'accountancy', 'Journal entries', 'medium', 'Goods are sold for cash. Which account is credited?', [
        'Sales account',
        'Cash account',
        'Purchases account',
        'Capital account',
      ]),
      _q('pa5', 'accountancy', 'Accounting basics', 'easy', 'The accounting equation is:', [
        'Assets = Liabilities + Capital',
        'Assets = Capital − Liabilities',
        'Liabilities = Assets + Capital',
        'Capital = Assets + Liabilities',
      ]),
    ],
  ),
  PreviewSection(
    id: 'general_test',
    name: 'General Test',
    questions: [
      _q('pg1', 'general_test', 'Number series', 'easy', 'What comes next: 3, 6, 12, 24, ?', ['30', '36', '42', '48']),
      _q('pg2', 'general_test', 'Speed', 'medium', 'A train covers 120 km in 2 hours. Its average speed is:', ['40 km/h', '60 km/h', '80 km/h', '240 km/h']),
      _q('pg3', 'general_test', 'Analogies', 'easy', 'Pen is to write as knife is to:', ['Cut', 'Eat', 'Sharp', 'Kitchen']),
      _q('pg4', 'general_test', 'Percentages', 'easy', 'What is 15% of 200?', ['15', '20', '30', '45']),
      _q('pg5', 'general_test', 'Number sense', 'medium', 'Which of these is a prime number?', ['21', '27', '29', '33']),
    ],
  ),
];
