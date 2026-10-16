import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/models/swot.dart';
import 'package:mockmob/core/repositories/repair_local_repository.dart';
import 'package:mockmob/core/widgets/widgets.dart' show KeyButton;
import 'package:mockmob/features/review/again/review_again_screen.dart';
import 'package:mockmob/features/review/data/repair_state.dart';
import 'package:mockmob/features/review/screens/repair_screen.dart';
import 'package:mockmob/features/review/screens/review_screen.dart';

import '../../unit/review/support/review_fixtures.dart';
import 'review_golden_support.dart';

/// The Review screens the owner's ledger items L12 to L15 touch, on a 390 dp phone (the width the
/// owner's phone and the emulator use), Night and Day: the tab with its new key and the empty and
/// error states, the History side with the next step from the latest mock, the repair's entry and
/// try step, and Review again. Same fixtures as the 384 set; only the width differs.
const _phone = Size(390, 844);

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

Widget _repair() => const RepairScreen(attemptId: 'm7', questionId: 'm7-q0');

final _again = [
  RepairLocalRecord(attemptId: 'm6', questionId: 'm6-q5', requestId: 'req-m6-q5-000000000000', status: RepairLocalStatus.explained, ackedAt: DateTime.utc(2026, 10, 4, 17, 38)),
  RepairLocalRecord(attemptId: 'm7', questionId: 'm7-q0', requestId: 'req-m7-q0-000000000000', status: RepairLocalStatus.explained, ackedAt: DateTime.utc(2026, 10, 12, 17, 38)),
];

Future<void> _tapKey(WidgetTester tester, String label) async {
  // A key ignores a second tap inside its tap lock, and the test clock only moves when told to.
  await tester.pump(const Duration(seconds: 1));
  final key = find.byWidgetPredicate((w) => w is KeyButton && w.label == label);
  await tester.ensureVisible(key);
  await tester.tap(key);
  await tester.pumpAndSettle();
}

Future<void> _pickAndCheck(WidgetTester tester, String option) async {
  await tester.tap(find.textContaining(option).first);
  await tester.pumpAndSettle();
  await _tapKey(tester, 'Check');
}

/// Answers whichever question is showing with its key (the key is option B in every fixture).
Future<void> _answerRight(WidgetTester tester) async {
  const keys = ['5:3:2', '40,000', 'Operating activities', 'Securities premium account', 'Realisation account', 'Accepting deposits from the public'];
  await _pickAndCheck(tester, keys.firstWhere((k) => find.textContaining(k).evaluate().isNotEmpty));
}

void main() {
  reviewGolden('r390_tab', () => const ReviewScreen(), size: _phone, overrides: () => reviewOverrides(records: [repairedRecord]));
  reviewGolden('r390_tab_full', () => const ReviewScreen(), size: const Size(390, 2300), overrides: () => reviewOverrides(records: [repairedRecord]));
  reviewGolden('r390_tab_empty', () => const ReviewScreen(), size: _phone, overrides: () => reviewOverrides(attempts: const []));
  reviewGolden(
    'r390_tab_history',
    () => const ReviewScreen(),
    size: const Size(390, 1300),
    overrides: _withSwot,
    after: (tester) async {
      await tester.tap(find.text('History'));
      await tester.pumpAndSettle();
    },
  );
  reviewGolden('r390_repair_entry', _repair, size: _phone, overrides: () => reviewOverrides(run: runOf(phase: RepairPhase.entry), credits: credits(9)));
  reviewGolden(
    'r390_repair_try',
    _repair,
    size: const Size(390, 1100),
    overrides: () => reviewOverrides(run: runOf(tries: [TryStage.open, TryStage.open, TryStage.open], picks: [0]), credits: credits(43)),
  );
  reviewGolden(
    'r390_repair_verdict',
    _repair,
    size: const Size(390, 1500),
    overrides: () => reviewOverrides(
      run: runOf(outcomes: [explained], tries: [TryStage.done, TryStage.open, TryStage.open], picks: [0]),
      credits: credits(42),
    ),
  );
  reviewGolden('r390_again_question', () => const ReviewAgainScreen(), size: _phone, overrides: () => reviewOverrides(records: _again));
  // The first option is a miss in the fixtures: the verdict names the key and the rule.
  reviewGolden(
    'r390_again_verdict',
    () => const ReviewAgainScreen(),
    size: const Size(390, 1300),
    overrides: () => reviewOverrides(records: _again),
    after: (tester) => _pickAndCheck(tester, '2:1:1'),
  );
  reviewGolden(
    'r390_again_end',
    () => const ReviewAgainScreen(),
    size: const Size(390, 1300),
    overrides: () => reviewOverrides(records: _again),
    after: (tester) async {
      await _answerRight(tester);
      await _tapKey(tester, 'Next question');
      await _answerRight(tester);
      await _tapKey(tester, 'See how it went');
    },
  );
  reviewGolden('r390_again_empty', () => const ReviewAgainScreen(), size: _phone, overrides: () => reviewOverrides());
}
