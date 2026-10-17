
import 'package:flutter/widgets.dart' show Scrollable;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart' show BubbleGrid, BubbleState, Mobi;
import 'package:mockmob/features/result/widgets/answer_map.dart' show AnswerMap;
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/api/api.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/features/result/data/result_providers.dart';
import 'package:mockmob/features/result/full/answer_row.dart' show AnswerRow;
import 'package:mockmob/features/result/layers_copy.dart';
import 'package:mockmob/features/result/widgets/mistake_row.dart' show LeftBlankRow, MistakeRepairEntry, MistakeSummary;
import 'package:mockmob/features/result/widgets/next_move_panel.dart' show NextMovePanel;
import 'package:mockmob/features/result/full/lab_ledger_section.dart' show LabLedgerSection;
import 'package:mockmob/features/result/model/time_decisions.dart' show TimeCopy;
import 'package:mockmob/features/result/model/recap_model.dart';

import '../../helpers/fonts.dart';
import 'support/fixtures.dart';
import 'support/harness.dart';
import 'support/lab_fixtures.dart' show attemptWithLabAndSwot, labContract;

String _at(GoRouter r) => r.routerDelegate.currentConfiguration.uri.toString();

void main() {
  setUpAll(loadAppFonts);

  Future<(GoRouter, ResultLog)> pump(WidgetTester tester, {RecapData? data, String location = '/result/a7', int? progress}) async {
    final log = ResultLog();
    final d = detail();
    final router = await pumpResultRoute(
      tester,
      openFolds: true,
      location: location,
      overrides: resultOverrides(
        attemptId: 'a7',
        data:
            data ??
            RecapData(
              model: mock7(withDetail: d),
              attempt: d.attempt,
              detail: d,
            ),
        progress: progress,
        log: log,
      ),
    );
    await tester.pump(const Duration(milliseconds: 300));
    return (router, log);
  }

  RecapData withDetail(AttemptDetail d) => RecapData(
    model: mock7(withDetail: d),
    attempt: d.attempt,
    detail: d,
  );

  testWidgets('what happened in one glance: one receipt, the marks with their denominator, the counts, and the result counts as seen', (tester) async {
    final (_, log) = await pump(tester);
    // The arrival lands in under a second.
    await tester.pump(const Duration(seconds: 1));
    // The bar: the paper's name on one line, its subject on a second.
    expect(find.text('Mock 7'), findsWidgets);
    expect(find.bySemanticsLabel('Mock 7, Accountancy'), findsWidgets);
    expect(find.bySemanticsLabel('115 of 250 marks'), findsWidgets);
    expect(find.bySemanticsLabel('26 right, 15 wrong, 9 blank'), findsOneWidget);
    expect(find.textContaining('Accountancy full mock. Recorded '), findsOneWidget);
    // The submission is said once, as that receipt (F11: "Submission is there, and the add submission is there").
    expect(find.textContaining('Submitted'), findsNothing);
    expect(find.textContaining('Session complete'), findsNothing);
    expect(find.text('Replay recap'), findsOneWidget);
    expect(log.seen, ['a7']);
  });

  testWidgets('a mistake opens to its key and its repair, priced before paying; blank rows have no repair key', (tester) async {
    await pump(tester);
    final page = find.byType(Scrollable).first;
    expect(find.text('Your 15 mistakes'), findsOneWidget);
    expect(find.byType(MistakeSummary), findsNWidgets(4), reason: 'the first four show; "Show all 15" opens the rest');
    expect(find.text('Show all 15'), findsOneWidget);
    await tester.scrollUntilVisible(find.byType(MistakeSummary).first, 200, scrollable: page);
    await tester.tap(find.byType(MistakeSummary).first);
    await tester.pumpAndSettle();
    // The free part shows the key at once; the try before the key belongs to the repair (one action per mistake, D15).
    expect(find.text('Try it again before you see the answer'), findsNothing);
    expect(find.text('Correct answer'), findsWidgets);
    expect(find.textContaining('then a new question to check it held'), findsOneWidget);
    // The blank rows are folded under one row until it is tapped.
    final blankRows = find.descendant(of: find.byType(LeftBlankRow), matching: find.byType(AnswerRow));
    expect(blankRows, findsNothing);
    final blanks = find.text('9 left blank, 45 marks not earned');
    await tester.scrollUntilVisible(blanks, 300, scrollable: page);
    await tester.tap(blanks);
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(blankRows.first, 300, scrollable: page);
    await tester.tap(blankRows.first);
    await tester.pumpAndSettle();
    expect(find.text('You did not answer this question.'), findsOneWidget);
    expect(find.descendant(of: find.byType(LeftBlankRow), matching: find.byType(MistakeRepairEntry)), findsNothing);
  });

  group('the answer map and the reader Mobi', () {
    Offset bubbleAt(WidgetTester tester, int number) {
      final grid = find.byType(BubbleGrid);
      final tl = tester.getTopLeft(grid);
      final w = tester.getSize(grid).width;
      const b = 20.0, numberSpace = 16.0, rowGap = 10.0;
      final i = number - 1;
      final x = (i % 10) * (w - b) / 9 + b / 2;
      final y = (i ~/ 10) * (b + numberSpace + rowGap) + numberSpace + b / 2;
      return tl + Offset(x, y);
    }

    testWidgets('a tap on a bubble opens that answer', (tester) async {
      await pump(tester);
      await tester.pump(const Duration(seconds: 1));
      await tester.ensureVisible(find.byType(BubbleGrid));
      await tester.pumpAndSettle();
      final cells = mock7().cells;
      final right = cells.indexOf(BubbleState.filled) + 1;
      AnswerRow row(int n) => tester.widget<AnswerRow>(find.byWidgetPredicate((w) => w is AnswerRow && w.item.number == n, skipOffstage: false));
      // The right answers sit folded under their row until a bubble opens them.
      expect(find.byWidgetPredicate((w) => w is AnswerRow && w.item.number == right, skipOffstage: false), findsNothing);
      await tester.tapAt(bubbleAt(tester, right));
      await tester.pump(const Duration(milliseconds: 600));
      expect(row(right).expanded, isTrue);
    });

    testWidgets('a long press names the question, the subject and the verdict until the finger lifts', (tester) async {
      await pump(tester);
      await tester.pump(const Duration(seconds: 1));
      await tester.ensureVisible(find.byType(BubbleGrid));
      await tester.pumpAndSettle();
      final wrong = mock7().cells.indexOf(BubbleState.wrong) + 1;
      final gesture = await tester.startGesture(bubbleAt(tester, wrong));
      await tester.pump(const Duration(milliseconds: 700));
      expect(find.text('Q$wrong, Accountancy: wrong'), findsOneWidget);
      await gesture.up();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('Q$wrong, Accountancy: wrong'), findsNothing);
    });

    testWidgets('a full-mode result has Mobi back: the reveal beside the line, and the reader by the answer sheet (N12)', (tester) async {
      await pump(tester);
      expect(find.byType(Mobi), findsNWidgets(2));
    });

    testWidgets('an NTA result has no Mobi at all', (tester) async {
      final d = detail(attemptBody: attemptJson(mode: 'nta'));
      await pump(tester, data: RecapData(model: mock7(withDetail: d), attempt: d.attempt, detail: d));
      expect(find.byType(Mobi), findsNothing);
      expect(find.byType(AnswerMap), findsOneWidget, reason: 'the map itself is not Mobi');
    });
  });

  testWidgets('a held answer shows no key and no explanation', (tester) async {
    // q6 is a wrong answer in the fixture; hold it.
    final d = detail(
      reviews: {
        'q6': {'state': 'under_review'},
      },
    );
    await pump(tester, data: withDetail(d), location: '/result/a7?q=6');
    await tester.pump(const Duration(milliseconds: 300));
    // The row sits under its own heading, says so on its chip, and the head carries the one notice line.
    expect(find.text('1 answer key being re-checked'), findsOneWidget);
    expect(find.text('Key being re-checked'), findsOneWidget);
    expect(find.text("Q6's answer key is being re-checked. It is left out of repairs until the check ends."), findsOneWidget);
    expect(find.text('The answer for this question is being checked, so it is not shown yet.'), findsOneWidget);
  });

  testWidgets('unavailable reviews: no keys anywhere and a plain warning with Try again', (tester) async {
    await pump(tester, data: withDetail(detail(state: 'unavailable')));
    expect(find.text('We could not check for answer-key updates just now. Your marks may change.'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
    final page = find.byType(Scrollable).first;
    await tester.scrollUntilVisible(find.byType(MistakeSummary).first, 200, scrollable: page);
    await tester.tap(find.byType(MistakeSummary).first);
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Answers and explanations are not available for this result right now.'), 300, scrollable: page);
    expect(find.text('Correct answer'), findsNothing);
  });

  testWidgets('an unfinished recap offers to continue where it stopped', (tester) async {
    final (router, _) = await pump(tester, progress: 3);
    await tester.tap(find.text('Continue recap, card 3 of 4').last);
    await tester.pumpAndSettle();
    expect(_at(router), '/result/a7/recap/3');
  });

  testWidgets('loading, then a failed read with nothing cached', (tester) async {
    await pump(tester, data: const RecapData(loading: true));
    expect(find.bySemanticsLabel('Loading your result'), findsOneWidget);
  });

  testWidgets('a failed read says the result was recorded and offers Try again', (tester) async {
    await pump(
      tester,
      data: const RecapData(
        error: ApiError(kind: ApiErrorKind.server, code: 'x'),
      ),
    );
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('We could not load this result. Your result was recorded. Try again.'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
  });

  group('the Mistake Lab sits right under the score (Mistake Lab v4, spec 3)', () {
    Map<String, dynamic> withLabAndSwot() => attemptWithLabAndSwot();

    setUp(LabLedgerSection.debugResetSeen);

    testWidgets('order (v15 spec 3.1): the reveal, the next move, the open analysis, then the mistakes', (tester) async {
      await pump(tester, data: withDetail(detail(attemptBody: withLabAndSwot())));
      await tester.pumpAndSettle();
      expect(find.byType(LabLedgerSection), findsOneWidget);
      double top(String t) => tester.getTopLeft(find.text(t).first).dy;
      final panel = tester.getTopLeft(find.byType(NextMovePanel)).dy;
      expect(panel < top(LayersCopy.analysis), isTrue, reason: 'the next move comes before the analysis');
      expect(top(LayersCopy.analysis) < top(LayersCopy.sectionAnswerSheet), isTrue);
      expect(top(LayersCopy.sectionAnswerSheet) < top(LayersCopy.sectionMarksWent), isTrue);
      expect(top(LayersCopy.sectionMarksWent) < top(LayersCopy.marksSplitTitle), isTrue);
      expect(top(LayersCopy.marksSplitTitle) < top(LayersCopy.sectionTime), isTrue);
      expect(top(LayersCopy.sectionTime) < top(TimeCopy.title), isTrue);
      expect(top(TimeCopy.title) < top(LayersCopy.sectionStrengths), isTrue);
      expect(top(LayersCopy.sectionStrengths) < top('Your 15 mistakes'), isTrue, reason: 'the mistakes list closes the page');
      // Nothing is folded away: no "More from this paper", no fold for the answers.
      expect(find.text(LayersCopy.more), findsNothing);
      expect(find.text('Every answer, all 50'), findsNothing);
      // No jargon heading: the SWOT is "Strengths and weaknesses".
      expect(find.text('SWOT'), findsNothing);
      // The old second volt key ("The first thing to fix") is gone; the next move is the one volt.
      expect(find.text('The first thing to fix'), findsNothing);
    });

    testWidgets('a Q chip in the ledger opens that answer, and "See every change" reaches the changes', (tester) async {
      await pump(tester, data: withDetail(detail(attemptBody: withLabAndSwot())));
      await tester.pumpAndSettle();
      // The headline group (never opened, Q45 to Q50) starts open; Q45 is in the fixture paper.
      await tester.scrollUntilVisible(find.text('Q45'), 200);
      await tester.tap(find.text('Q45'));
      await tester.pumpAndSettle();
      expect(find.text('Question 45'), findsWidgets);
      final scrollable = find.byType(Scrollable).first;
      await tester.scrollUntilVisible(find.text('See every change'), -200, scrollable: scrollable);
      await tester.tap(find.text('See every change'));
      await tester.pumpAndSettle();
      final changes = tester.getTopLeft(find.text(TimeCopy.changesTitle)).dy;
      expect(changes >= 0 && changes < 300, isTrue, reason: 'the list of changes is near the top: $changes');
    });

    testWidgets('an opened answer shows how others answered from the lab', (tester) async {
      // q17 is not the first wrong answer: link straight to it.
      await pump(tester, data: withDetail(detail(attemptBody: withLabAndSwot())), location: '/result/a7?q=17');
      await tester.pumpAndSettle();
      final line = (labContract('ready')['byQuestion'] as Map)['q17']['others']['line'] as String;
      expect(find.text('How others answered'), findsWidgets);
      expect(find.text(line), findsOneWidget);
    });

    testWidgets('without a lab the result keeps the breakdown, under "How the marks split"', (tester) async {
      await pump(tester);
      expect(find.byType(LabLedgerSection), findsNothing);
      expect(find.text(LayersCopy.marksSplitTitle), findsOneWidget);
      expect(find.text('How others answered'), findsNothing);
    });
  });


  test('model fixture sanity', () {
    final RecapModel m = mock7();
    expect(m.attemptId, 'a7');
  });
}
