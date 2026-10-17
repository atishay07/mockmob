// The v15 result (spec 3, the restore of N12): the weak-chapters list, Mobi's reveal, the open analysis, the mistakes list with
// paper and 12-hour time, saved repairs, the try before the key, and Scores by session. Plus the same list on the record page
// and the trap and the try-first line on Review's mistakes.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/models/models.dart' show Attempt, AttemptDetail;
import 'package:mockmob/core/repositories/repair_local_repository.dart' show RepairLocalRecord, RepairLocalStatus;
import 'package:mockmob/core/widgets/widgets.dart' show KeyButton, KeyVariant, Mobi, MobiPose;
import 'package:mockmob/features/insights/data/insights_models.dart' show ChapterLine;
import 'package:mockmob/features/insights/widgets/record_sections.dart' show ChaptersSection;
import 'package:mockmob/features/result/data/result_providers.dart';
import 'package:mockmob/features/result/layers_copy.dart';
import 'package:mockmob/features/result/model/move_inputs.dart';
import 'package:mockmob/features/result/model/next_move.dart';
import 'package:mockmob/features/result/model/weak_chapters.dart';
import 'package:mockmob/features/result/widgets/mistake_row.dart' show MistakeSummary, RightAnswersRow;
import 'package:mockmob/features/result/widgets/weak_chapters_list.dart' show WeakChapterRow, WeakChaptersList;

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart' show pumpMockmob;
import 'support/fixtures.dart';
import 'support/harness.dart';

/// Scrolls [target] to the middle of the page, clear of the bar above and the foot below.
Future<void> _middle(WidgetTester tester, Finder target) async {
  await Scrollable.ensureVisible(tester.element(target), alignment: 0.4, duration: Duration.zero);
  await tester.pumpAndSettle();
}

MoveRow _row(int n, String chapter, RowVerdict v, {String? qid}) => MoveRow(qid: qid ?? 'q$n', number: n, chapter: chapter, verdict: v, givenIndex: v == RowVerdict.wrong ? 1 : null);

void main() {
  setUpAll(loadAppFonts);

  group('the weak chapters', () {
    test('ranked by marks lost: 6 for a wrong answer, 5 for a blank, then more wrong answers, then paper order', () {
      final a = MoveAnalysis([
        _row(1, 'Goodwill', RowVerdict.wrong),
        _row(2, 'Goodwill', RowVerdict.correct),
        _row(3, 'Ratios', RowVerdict.skipped),
        _row(4, 'Ratios', RowVerdict.skipped),
        _row(5, 'Ratios', RowVerdict.wrong),
        _row(6, 'Funds', RowVerdict.correct),
      ]);
      final w = weakChapters(a);
      expect([for (final c in w) c.chapter], ['Ratios', 'Goodwill'], reason: 'Funds lost nothing, so it is not listed');
      expect(w.first.lost, 16);
      expect(w.first.available, 15);
      expect(w.last.lost, 6);
      expect(w.last.available, 10);
    });

    test('a tie goes to the chapter with more wrong answers, then to the one that comes first', () {
      final a = MoveAnalysis([
        _row(1, 'A', RowVerdict.skipped),
        _row(2, 'A', RowVerdict.skipped),
        _row(3, 'A', RowVerdict.skipped),
        _row(4, 'A', RowVerdict.skipped),
        _row(5, 'A', RowVerdict.skipped),
        _row(6, 'A', RowVerdict.skipped),
        _row(7, 'B', RowVerdict.wrong),
        _row(8, 'B', RowVerdict.wrong),
        _row(9, 'B', RowVerdict.wrong),
        _row(10, 'B', RowVerdict.wrong),
        _row(11, 'B', RowVerdict.wrong),
        _row(12, 'C', RowVerdict.wrong),
        _row(13, 'C', RowVerdict.wrong),
        _row(14, 'C', RowVerdict.wrong),
        _row(15, 'C', RowVerdict.wrong),
        _row(16, 'C', RowVerdict.wrong),
      ]);
      expect([for (final c in weakChapters(a)) c.chapter], ['B', 'C', 'A'], reason: '30 each for A and B, B has wrong answers; B and C tie at 30, B comes first');
    });

    test('a question whose key is held or corrected leaves the loss out', () {
      final a = MoveAnalysis([_row(1, 'A', RowVerdict.wrong), _row(2, 'A', RowVerdict.wrong), _row(3, 'A', RowVerdict.correct)]);
      final w = weakChapters(a, reviews: {'q1': 'under_review'});
      expect(w.single.lost, 6);
      expect(w.single.questions, 3, reason: 'the question still counts as part of the chapter');
      expect(weakChapters(a, reviews: {'q1': 'corrected', 'q2': 'withdrawn'}), isEmpty);
    });

    test('it says the marks as a student says them, never "53 of 50"', () {
      final a = MoveAnalysis([for (var i = 0; i < 10; i++) _row(i + 1, 'A', RowVerdict.wrong)]);
      final c = weakChapters(a).single;
      expect(c.lost, 60);
      expect(c.available, 50);
      expect(c.overdrawn, isTrue);
      expect(c.share, 1);
      expect(c.marksLine, 'All 50 marks lost, 10 more taken off');
      final d = weakChapters(MoveAnalysis([_row(1, 'B', RowVerdict.wrong), _row(2, 'B', RowVerdict.correct)])).single;
      expect(d.marksLine, '6 of 10 marks lost');
      expect(d.counts, '1 wrong, of 2 questions.');
    });

    test('rows with no chapter are not a chapter', () {
      expect(weakChapters(MoveAnalysis([const MoveRow(qid: 'q1', number: 1, verdict: RowVerdict.wrong)])), isEmpty);
    });

    testWidgets('each row has its marks, its counts and a Practise key; more than four hide behind Show all', (tester) async {
      final chapters = [
        for (var i = 0; i < 6; i++) WeakChapter(chapter: 'Chapter $i', questions: 10, right: 5, wrong: 5 - i ~/ 2, blank: i ~/ 2),
      ];
      final opened = <String>[];
      await pumpMockmob(
        tester,
        SingleChildScrollView(child: WeakChaptersList(chapters: chapters, onPractise: (c) => opened.add(c.chapter))),
        size: const Size(384, 1800),
        overrides: const [],
      );
      expect(find.byType(WeakChapterRow), findsNWidgets(4));
      expect(find.byType(KeyButton), findsNWidgets(4));
      expect(find.text('Practise'), findsWidgets);
      expect(find.text('Show all 6 chapters'), findsOneWidget);
      await tester.tap(find.byType(KeyButton).first);
      expect(opened, ['Chapter 0']);
      for (final k in tester.widgetList<KeyButton>(find.byType(KeyButton))) {
        expect(k.variant, isNot(KeyVariant.primary), reason: 'the page keeps its one volt in the foot');
      }
      await tester.tap(find.text('Show all 6 chapters'));
      await tester.pumpAndSettle();
      expect(find.byType(WeakChapterRow), findsNWidgets(6));
      expect(find.text('Show fewer'), findsOneWidget);
    });
  });

  group('the result page', () {
    Future<GoRouter> pump(
      WidgetTester tester, {
      AttemptDetail? d,
      String location = '/result/a7',
      List<RepairLocalRecord> repairs = const [],
      List<Attempt> attempts = const [],
      int? progress,
    }) async {
      final det = d ?? detail();
      final router = await pumpResultRoute(
        tester,
        location: location,
        overrides: resultOverrides(
          attemptId: 'a7',
          data: RecapData(model: mock7(withDetail: det), attempt: det.attempt, detail: det),
          progress: progress,
          repairRecords: repairs,
          reviewAttempts: attempts,
        ),
      );
      await tester.pump(const Duration(seconds: 1));
      return router;
    }

    testWidgets('the weak chapters list is open under "Where your marks went", and its Practise key opens a set on that chapter', (tester) async {
      await pump(tester);
      expect(find.text(LayersCopy.sectionMarksWent), findsOneWidget);
      expect(find.byType(WeakChaptersList), findsOneWidget);
      // The old second ranking is gone.
      expect(find.textContaining('marks left open'), findsNothing);
      final page = find.byType(Scrollable).first;
      await tester.scrollUntilVisible(find.byType(WeakChapterRow).first, 200, scrollable: page);
      await _middle(tester, find.byType(WeakChapterRow).first);
      await tester.tap(find.descendant(of: find.byType(WeakChapterRow).first, matching: find.byType(KeyButton)));
      await tester.pumpAndSettle();
      expect(find.textContaining('AT /practice/start?mode=chapter&subject=accountancy&count=10&chapter='), findsOneWidget);
    });

    testWidgets('every mistake says its paper, date and 12-hour time', (tester) async {
      await pump(tester);
      final page = find.byType(Scrollable).first;
      await tester.scrollUntilVisible(find.byType(MistakeSummary).first, 200, scrollable: page);
      expect(find.textContaining('Mock 7, 12 Oct, 10:44'), findsNWidgets(4), reason: 'one line on each of the first four mistakes');
      expect(find.textContaining('PM'), findsWidgets);
      expect(find.textContaining(' AM'), findsNothing);
    });

    testWidgets('the right answers sit folded under one row, and a tap opens them', (tester) async {
      await pump(tester);
      final page = find.byType(Scrollable).first;
      final row = find.text(LayersCopy.rightRow(26));
      await tester.scrollUntilVisible(row, 300, scrollable: page);
      expect(find.descendant(of: find.byType(RightAnswersRow), matching: find.text('Question 1')), findsNothing);
      await tester.tap(row);
      await tester.pumpAndSettle();
      expect(find.bySemanticsLabel(LayersCopy.answeredRightSpoken(26, open: true)), findsOneWidget);
    });

    testWidgets('a mistake keeps its answer back until it is tried again or asked for', (tester) async {
      await pump(tester);
      final page = find.byType(Scrollable).first;
      await tester.scrollUntilVisible(find.byType(MistakeSummary).first, 200, scrollable: page);
      await tester.tap(find.byType(MistakeSummary).first);
      await tester.pumpAndSettle();
      expect(find.text('Try it again before you see the answer'), findsOneWidget);
      expect(find.text('Try it again'), findsWidgets);
      expect(find.text('Correct answer'), findsNothing);
      expect(find.text('Explanation'), findsNothing);
      await tester.tap(find.text('Show the answer'));
      await tester.pumpAndSettle();
      expect(find.text('Correct answer'), findsOneWidget);
    });

    testWidgets('a linked question is shown with its key: the student asked for that one', (tester) async {
      await pump(tester, location: '/result/a7?q=6');
      await tester.pumpAndSettle();
      expect(find.text('Try it again before you see the answer'), findsNothing);
      expect(find.text('Correct answer'), findsWidgets);
    });

    testWidgets('a saved repair opens free and shows no try-first: its key is already known', (tester) async {
      // The first wrong answer in the fixture is the next move's target; repair it.
      final d = detail();
      final first = moveAnalysisOf(d.attempt).mistakes.first;
      await pump(
        tester,
        d: d,
        repairs: [RepairLocalRecord(attemptId: 'a7', questionId: first.qid, requestId: 'req-${first.qid}-000000000000', status: RepairLocalStatus.explained, ackedAt: DateTime.utc(2026, 10, 12, 17, 38))],
      );
      final page = find.byType(Scrollable).first;
      await tester.scrollUntilVisible(find.text('Check it held').first, 200, scrollable: page);
      await _middle(tester, find.text('Check it held').first);
      await tester.tap(find.ancestor(of: find.text('Check it held').first, matching: find.byType(MistakeSummary)));
      await tester.pumpAndSettle();
      expect(find.text(LayersCopy.repairedLine), findsOneWidget);
      expect(find.text('Try it again before you see the answer'), findsNothing);
      await _middle(tester, find.text(LayersCopy.openRepair).first);
      await tester.tap(find.text(LayersCopy.openRepair).first);
      await tester.pumpAndSettle();
      expect(find.text('AT /review/repair/a7/${first.qid}'), findsOneWidget);
    });

    testWidgets("Mobi's reveal: one beside the line on a first open, the reader by the answer sheet; none on an NTA paper", (tester) async {
      await pump(tester);
      expect(find.byType(Mobi), findsNWidgets(2));
      final poses = [for (final m in tester.widgetList<Mobi>(find.byType(Mobi))) m.pose];
      expect(poses, isNot(contains(MobiPose.sleepy)), reason: 'never sleepy, whatever the hour');
      await pump(tester, d: detail(attemptBody: attemptJson(mode: 'nta')));
      expect(find.byType(Mobi), findsNothing);
    });

    testWidgets('a reopened result keeps Mobi at rest: it acts on the first open only', (tester) async {
      await pump(tester, progress: 4);
      final poses = [for (final m in tester.widgetList<Mobi>(find.byType(Mobi))) m.pose];
      expect(poses.first, MobiPose.rest);
    });

    testWidgets('Scores by session draws this paper\'s format once there are earlier sessions, and nothing without them', (tester) async {
      await pump(tester);
      expect(find.text(LayersCopy.sectionScores), findsNothing);
      final d = detail();
      final earlier = [
        attempt(id: 'e1', completedAt: DateTime.utc(2026, 9, 20, 15)),
        attempt(id: 'e2', completedAt: DateTime.utc(2026, 10, 5, 15)),
      ];
      await pump(tester, d: d, attempts: [...earlier, d.attempt]);
      final page = find.byType(Scrollable).first;
      await tester.scrollUntilVisible(find.text(LayersCopy.sectionScores), 300, scrollable: page);
      expect(find.text(LayersCopy.sectionScores), findsOneWidget);
    });

    testWidgets('the open analysis comes in the owner\'s order, with nothing folded', (tester) async {
      await pump(tester);
      double top(String t) => tester.getTopLeft(find.text(t).first).dy;
      final page = find.byType(Scrollable).first;
      // Everything is built (not lazily), so the offsets are the page's own.
      expect(top(LayersCopy.analysis) < top(LayersCopy.sectionAnswerSheet), isTrue);
      expect(top(LayersCopy.sectionAnswerSheet) < top(LayersCopy.sectionMarksWent), isTrue);
      expect(top(LayersCopy.sectionMarksWent) < top('Your 15 mistakes'), isTrue);
      expect(find.text(LayersCopy.more), findsNothing);
      expect(page, findsOneWidget);
    });
  });

  group('the record page', () {
    testWidgets('chapters costing you the most marks: the same row, a Practise key, the subject under the name', (tester) async {
      final opened = <String>[];
      const lines = [
        ChapterLine(subject: 'accountancy', subjectName: 'Accountancy', chapter: 'Share Capital', right: 1, wrong: 6, skip: 3, n: 10, open: 51),
        ChapterLine(subject: 'accountancy', subjectName: 'Accountancy', chapter: 'Goodwill', right: 2, wrong: 4, skip: 4, n: 10, open: 44),
      ];
      await pumpMockmob(
        tester,
        SingleChildScrollView(child: ChaptersSection(ranked: lines, thin: const [], pro: true, onPractise: (c) => opened.add(c.chapter))),
        size: const Size(384, 900),
        overrides: const [],
      );
      expect(find.byType(WeakChapterRow), findsNWidgets(2));
      expect(find.text('Accountancy'), findsNWidgets(2));
      expect(find.text('51 of 50 marks lost'), findsNothing);
      expect(find.text('All 50 marks lost, 1 more taken off'), findsOneWidget);
      await tester.tap(find.byType(KeyButton).last);
      expect(opened, ['Goodwill']);
    });
  });
}
