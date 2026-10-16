import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/models/swot.dart';
import 'package:mockmob/core/repositories/repair_local_repository.dart';
import 'package:mockmob/core/widgets/widgets.dart' show KeyButton;
import 'package:mockmob/features/review/again/review_again_screen.dart';
import 'package:mockmob/features/review/screens/review_screen.dart';

import '../../unit/review/support/review_fixtures.dart';
import 'review_golden_support.dart';

RepairLocalRecord _repaired(String attempt, String qid, DateTime at) =>
    RepairLocalRecord(attemptId: attempt, questionId: qid, requestId: 'req-$qid-000000000000', status: RepairLocalStatus.explained, ackedAt: at);

final _records = [
  _repaired('m6', 'm6-q5', DateTime.utc(2026, 10, 4, 17, 38)),
  _repaired('m7', 'm7-q0', DateTime.utc(2026, 10, 12, 17, 38)),
];

/// Mock 7's detail with the post-mock read: its first weakness and the first row of its plan.
final _swot = Swot.fromJson({
  'version': 1,
  'state': 'ready',
  'basis': {'line': 'From 49 of 50 questions in this paper and 212 earlier answers in Accountancy across 6 papers.'},
  'quadrants': [
    {
      'id': 'weakness',
      'label': 'Weaknesses',
      'items': [
        {
          'id': 'w1',
          'kind': 'chapter',
          'title': 'Partnership: admission is where the most marks went.',
          'detail': '18 of 50 marks lost here, across 5 questions.',
          'chapter': 'Partnership: admission of a partner',
        },
      ],
    },
  ],
  'plan': [
    {
      'id': 'p1',
      'label': 'Practise 10, Partnership: admission',
      'reason': 'It cost you 18 of 50 marks in Mock 2.',
      'practice': {'subject': 'accountancy', 'mode': 'chapter', 'count': 10, 'chapter': 'Partnership: admission of a partner'},
    },
  ],
});

List<Override> _withSwot() => reviewOverrides(records: [repairedRecord], details: {'m7': AttemptDetail(attempt: mock7, swot: _swot)});

Future<void> _tapKey(WidgetTester tester, String label) async {
  final key = find.byWidgetPredicate((w) => w is KeyButton && w.label == label);
  await tester.ensureVisible(key);
  await tester.tap(key);
  await tester.pumpAndSettle();
}

Future<void> _answer(WidgetTester tester, String option, String key) async {
  await tester.tap(find.textContaining(option).first);
  await tester.pumpAndSettle();
  await tester.tap(find.text(key));
  await tester.pumpAndSettle();
}

/// Answers whichever question is showing with its key (the key is option B in every fixture).
Future<void> _answerRight(WidgetTester tester, String key) async {
  const keys = ['5:3:2', '40,000', 'Operating activities', 'Securities premium account', 'Realisation account', 'Accepting deposits from the public'];
  final shown = keys.firstWhere((k) => find.textContaining(k).evaluate().isNotEmpty);
  await _answer(tester, shown, key);
}

void main() {
  // The History side opens with what to do after the latest mock (L15).
  reviewGolden(
    'review_tab_history_next',
    () => const ReviewScreen(),
    size: const Size(384, 1300),
    overrides: _withSwot,
    after: (tester) async {
      await tester.tap(find.text('History'));
      await tester.pumpAndSettle();
    },
  );

  // The tab with Review again as its first row (L14).
  reviewGolden(
    'review_tab_rows',
    () => const ReviewScreen(),
    size: const Size(384, 2300),
    overrides: () => reviewOverrides(records: [repairedRecord]),
  );

  // A repaired question, answered before its key shows.
  reviewGolden(
    'review_again_question',
    () => const ReviewAgainScreen(),
    overrides: () => reviewOverrides(records: _records),
  );

  // The key is option B in the fixtures, so the first option is a miss.
  reviewGolden(
    'review_again_verdict',
    () => const ReviewAgainScreen(),
    size: const Size(384, 1300),
    overrides: () => reviewOverrides(records: _records),
    after: (tester) => _answer(tester, '2:1:1', 'Check'),
  );

  reviewGolden(
    'review_again_end',
    () => const ReviewAgainScreen(),
    size: const Size(384, 1300),
    overrides: () => reviewOverrides(records: _records),
    after: (tester) async {
      await _answerRight(tester, 'Check');
      await _tapKey(tester, 'Next question');
      // ignore: avoid_print
      print('DBG ${find.byType(Text).evaluate().map((e) => (e.widget as Text).data).whereType<String>().toList()}');
      await _answerRight(tester, 'Check');
      await _tapKey(tester, 'See how it went');
    },
  );

  reviewGolden(
    'review_again_empty',
    () => const ReviewAgainScreen(),
    overrides: () => reviewOverrides(),
  );
}
