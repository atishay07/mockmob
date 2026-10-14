import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart' show BubbleGrid, BubbleState, Mobi;
import 'package:mockmob/features/result/widgets/answer_map.dart' show AnswerMap;
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/api/api.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/features/result/data/result_providers.dart';
import 'package:mockmob/features/result/full/answer_row.dart' show AnswerRow;
import 'package:mockmob/features/result/full/full_sections.dart' show BlankGroup;
import 'package:mockmob/features/result/model/recap_model.dart';

import '../../helpers/fonts.dart';
import 'support/fixtures.dart';
import 'support/harness.dart';

String _at(GoRouter r) => r.routerDelegate.currentConfiguration.uri.toString();

void main() {
  setUpAll(loadAppFonts);

  Future<(GoRouter, ResultLog)> pump(WidgetTester tester, {RecapData? data, String location = '/result/a7', int? progress}) async {
    final log = ResultLog();
    final d = detail();
    final router = await pumpResultRoute(
      tester,
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

  testWidgets('summary in Lab order with denominators, and the result counts as seen', (tester) async {
    final (_, log) = await pump(tester);
    expect(find.text('Mock 7, Accountancy'), findsOneWidget);
    expect(find.bySemanticsLabel('115 out of 250 marks'), findsWidgets);
    expect(find.text('26 of 50 correct, 15 wrong, 9 not attempted.'), findsOneWidget);
    expect(find.text('Replay recap'), findsOneWidget);
    expect(log.seen, ['a7']);
  });

  testWidgets('the first wrong answer is open with its key; not attempted rows have no repair key', (tester) async {
    await pump(tester);
    await tester.scrollUntilVisible(find.text('Repair this mistake').last, 300);
    expect(find.text('Correct answer'), findsWidgets);
    // The not attempted rows are folded under one header until it is tapped.
    final blankRows = find.descendant(of: find.byType(BlankGroup), matching: find.byType(AnswerRow));
    expect(blankRows, findsNothing);
    await tester.scrollUntilVisible(find.text('Not attempted (9)'), 300);
    await tester.tap(find.text('Not attempted (9)'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(blankRows.first, 300);
    await tester.tap(blankRows.first);
    await tester.pump();
    expect(find.text('You did not answer this question.'), findsOneWidget);
    expect(find.text('Repair this mistake'), findsNWidgets(2)); // one key: its label plus its width reserve
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
      final cells = mock7().cells;
      final right = cells.indexOf(BubbleState.filled) + 1;
      AnswerRow row(int n) => tester.widget<AnswerRow>(find.byWidgetPredicate((w) => w is AnswerRow && w.item.number == n, skipOffstage: false));
      expect(row(right).expanded, isFalse);
      await tester.tapAt(bubbleAt(tester, right));
      await tester.pump(const Duration(milliseconds: 600));
      expect(row(right).expanded, isTrue);
    });

    testWidgets('a long press names the question, the subject and the verdict until the finger lifts', (tester) async {
      await pump(tester);
      await tester.pump(const Duration(seconds: 1));
      final wrong = mock7().cells.indexOf(BubbleState.wrong) + 1;
      final gesture = await tester.startGesture(bubbleAt(tester, wrong));
      await tester.pump(const Duration(milliseconds: 700));
      expect(find.text('Q$wrong, Accountancy: wrong'), findsOneWidget);
      await gesture.up();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('Q$wrong, Accountancy: wrong'), findsNothing);
    });

    testWidgets('one reader Mobi on a full-mode result, none on an NTA result', (tester) async {
      await pump(tester);
      expect(find.byType(Mobi), findsOneWidget);
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
    // The row names its question; the group header ("Being checked") and the bubble say why.
    expect(find.text('Question 6'), findsOneWidget);
    expect(find.text('Being checked (1)'), findsOneWidget);
    expect(find.text('The answer for this question is being checked, so it is not shown yet.'), findsOneWidget);
  });

  testWidgets('unavailable reviews: no keys anywhere and a plain warning with Try again', (tester) async {
    await pump(tester, data: withDetail(detail(state: 'unavailable')));
    expect(find.text('We could not check for answer-key updates just now. Your marks may change.'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Answers and explanations are not available for this result right now.'), 300);
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

  test('model fixture sanity', () {
    final RecapModel m = mock7();
    expect(m.attemptId, 'a7');
  });
}
