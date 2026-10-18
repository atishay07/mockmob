import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/repositories/repair_local_repository.dart';
import 'package:mockmob/features/review/data/mistake_index.dart';
import 'package:mockmob/features/review/screens/mistakes_screen.dart';
import 'package:mockmob/features/review/screens/record_screen.dart';
import 'package:mockmob/features/review/screens/review_screen.dart';

import '../../golden/review/review_golden_support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/review_fixtures.dart';

const _partnership = 'Partnership: admission of a partner';

/// A 5-question Quick practice with two wrong answers: too short to carry tonight's repair.
final _short = Attempt.fromJson(
  mockJson(
    id: 'p5',
    completedAt: DateTime.utc(2026, 10, 12, 14, 30),
    mode: 'quick',
    count: 5,
    subject: 'economics',
    chapter: 'Money and banking',
    wrong: {1, 2},
  ),
);

/// A mock with every answer right: nothing to repair, nothing set aside.
final _clean = Attempt.fromJson(mockJson(id: 'ok', completedAt: DateTime.utc(2026, 10, 12, 14, 30)));

RepairLocalRecord _setAside(String attemptId, String questionId) => RepairLocalRecord(
  attemptId: attemptId,
  questionId: questionId,
  requestId: 'req-$questionId-000000',
  status: RepairLocalStatus.heldForRecheck,
  ackedAt: DateTime.utc(2026, 10, 12, 17, 38),
);

Future<void> _pump(
  WidgetTester tester,
  Widget screen, {
  List<Attempt>? attempts,
  RemoteState<List<Attempt>>? state,
  List<RepairLocalRecord> records = const [],
}) => pumpMockmob(
  tester,
  screen,
  size: const Size(384, 2400),
  disableAnimations: true,
  wrapInScaffold: false,
  overrides: reviewOverrides(attempts: attempts, attemptsState: state, records: records),
);

void main() {
  setUpAll(loadAppFonts);

  group('review-01: the all-clear is never shown above open mistakes', () {
    testWidgets('open mistakes in a 5-question practice are in the lead, never the all-clear', (tester) async {
      await _pump(tester, const ReviewScreen(), attempts: [_short]);
      expect(find.text('Nothing waiting to repair'), findsNothing);
      expect(find.textContaining("Every mistake you've found is repaired"), findsNothing);
      // The chapter that lost the marks leads, and its two mistakes are rows with the one action.
      expect(find.text('Money and banking'), findsWidgets);
      expect(find.text('2 mistakes to repair'), findsOneWidget);
      expect(find.text('Repair'), findsNWidgets(2));
    });

    testWidgets('with nothing open the all-clear shows', (tester) async {
      await _pump(tester, const ReviewScreen(), attempts: [_clean]);
      expect(find.text('Nothing waiting to repair'), findsOneWidget);
      expect(find.text('Nothing to repair tonight'), findsNothing);
      // Past results read "250 of 250" too; the progress line is "N repaired, M found".
      expect(find.textContaining(RegExp(r'\d+ repaired, \d+ found')), findsNothing, reason: 'nothing was found, so there is no repairs progress line');
    });

    testWidgets('questions that are only set aside are not called repaired', (tester) async {
      await _pump(
        tester,
        const ReviewScreen(),
        attempts: [mock6],
        records: [_setAside('m6', 'm6-q5'), _setAside('m6', 'm6-q20')],
      );
      expect(find.text('Nothing waiting to repair'), findsOneWidget);
      expect(find.textContaining('2 questions are set aside'), findsOneWidget);
      expect(find.textContaining("Every mistake you've found is repaired"), findsNothing);
      expect(find.text('Nothing to repair tonight'), findsNothing);
    });
  });

  group('review-02: a group key counts the steps its run holds', () {
    test('a chapter spanning two papers splits open mistakes by paper, newest first', () {
      final index = buildReviewIndex(allAttempts, const []);
      final group = index.openGroups.firstWhere((g) => g.chapter == _partnership);
      expect(group.openCount, 5);
      final papers = group.openByPaper;
      expect([for (final p in papers) (p.attemptId, p.source, p.items.length)], [('m7', 'Mock 2', 3), ('m6', 'Mock 1', 2)]);
      // Each paper's count is exactly what RepairRun.open builds for its first mistake.
      for (final p in papers) {
        final run = [p.items.first, ...index.openIn(p.attemptId, _partnership).where((i) => i.questionId != p.items.first.questionId)];
        expect(run.length, p.items.length);
      }
    });

    testWidgets('the Mistakes page shows one key per paper, each with its own count', (tester) async {
      await _pump(tester, const MistakesScreen(), attempts: [mock7, mock6]);
      expect(find.text('Repair 3 from Mock 2'), findsOneWidget);
      expect(find.text('Repair 2 from Mock 1'), findsOneWidget);
      expect(find.text('Repair these 5'), findsNothing);
    });

    testWidgets('a chapter in one paper keeps the plain key', (tester) async {
      await _pump(tester, const MistakesScreen(), attempts: [mock7]);
      expect(find.text('Repair these 3'), findsOneWidget);
      expect(find.textContaining(' from Mock'), findsNothing);
    });
  });

  group('review-03: Set aside is its own section, never under Repaired', () {
    testWidgets('a chapter that is only set aside has its own heading and no Repaired heading', (tester) async {
      await _pump(
        tester,
        const MistakesScreen(),
        attempts: [mock6],
        records: [_setAside('m6', 'm6-q5'), _setAside('m6', 'm6-q20')],
      );
      expect(find.text('Set aside while the key is checked'), findsOneWidget);
      expect(find.text('Repaired'), findsNothing);
      expect(find.textContaining('2 set aside'), findsOneWidget);
    });

    testWidgets('a chapter with one repaired and one set aside shows a card under each heading', (tester) async {
      await _pump(
        tester,
        const MistakesScreen(),
        attempts: [mock6],
        records: [repairedRecord, _setAside('m6', 'm6-q20')],
      );
      expect(find.text('Repaired'), findsOneWidget);
      expect(find.text('Set aside while the key is checked'), findsOneWidget);
      // Each card speaks only of its own questions.
      expect(find.textContaining('1 of 1 repaired'), findsOneWidget);
      expect(find.textContaining('1 set aside'), findsOneWidget);
    });

    test('splitting by stage keeps the chapter and drops the other stages', () {
      final index = buildReviewIndex([mock6], [repairedRecord, _setAside('m6', 'm6-q20')]);
      final group = index.groups.single;
      expect(group.onlyStage(MistakeStage.repaired)!.items.map((i) => i.questionId), ['m6-q5']);
      expect(group.onlyStage(MistakeStage.setAside)!.items.map((i) => i.questionId), ['m6-q20']);
      expect(group.onlyStage(MistakeStage.reviewed), isNull);
    });
  });

  group('review-06: the record is on this phone, and the tab shows real progress', () {
    testWidgets('the record says this phone only and promises no sync', (tester) async {
      await _pump(tester, const RecordScreen(), records: [repairedRecord]);
      expect(find.textContaining('on this phone only'), findsOneWidget);
      expect(find.textContaining('sync'), findsNothing);
    });

    testWidgets('the tab says how many of the mistakes found are repaired', (tester) async {
      await _pump(tester, const ReviewScreen(), records: [repairedRecord]);
      // Mock 7 has 5 wrong answers and 3 skipped, Mock 6 has 2 and the Quick practice 1; one is repaired.
      // 8 wrong x 6 + 3 blank x 5 = 63 marks, and the sentence says so with the one repaired.
      expect(find.text('Your 3 papers lost 63 marks: 8 wrong answers and 3 left blank. 1 is repaired.'), findsOneWidget);
      // What is left is the chapters' own rows: 8 found less 1 repaired is 7, in the lead and More chapters together.
      final index = buildReviewIndex(allAttempts, [repairedRecord]);
      expect(index.openCount, 7);
    });

    testWidgets('no mistakes found, no lead line', (tester) async {
      await _pump(tester, const ReviewScreen(), attempts: [_clean]);
      expect(find.textContaining(RegExp(r'\d+ repaired, \d+ found')), findsNothing);
      // The past result writes its marks as the rest of the app does.
      expect(find.text('12 October, 250 of 250'), findsOneWidget);
      expect(find.textContaining(' / '), findsNothing);
    });
  });

  group('a11y-perf-01: a full-page loader is announced', () {
    testWidgets('the Mistakes page names its spinner for TalkBack as a live region', (tester) async {
      final handle = tester.ensureSemantics();
      await _pump(tester, const MistakesScreen(), state: const RemoteState(loading: true));
      final node = tester.getSemantics(find.bySemanticsLabel('Loading your mistakes'));
      expect(node.flagsCollection.isLiveRegion, isTrue);
      handle.dispose();
    });

    testWidgets('the record page names its spinner too', (tester) async {
      final handle = tester.ensureSemantics();
      await _pump(tester, const RecordScreen(), state: const RemoteState(loading: true));
      expect(find.bySemanticsLabel('Loading your repair record'), findsOneWidget);
      handle.dispose();
    });
  });
}
