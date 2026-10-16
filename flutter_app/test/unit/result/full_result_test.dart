import 'dart:convert';
import 'dart:io';

import 'package:flutter/widgets.dart' show Scrollable;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart' show BubbleGrid, BubbleState, Mobi;
import 'package:mockmob/features/result/widgets/answer_map.dart' show AnswerMap;
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/api/api.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/features/result/data/result_providers.dart';
import 'package:mockmob/features/result/full/answer_row.dart' show AnswerRow;
import 'package:mockmob/features/result/full/full_sections.dart' show BlankGroup;
import 'package:mockmob/features/result/full/lab_ledger_section.dart' show LabLedgerSection;
import 'package:mockmob/features/result/model/time_decisions.dart' show TimeCopy;
import 'package:mockmob/features/result/model/recap_model.dart';

import '../../helpers/fonts.dart';
import 'support/fixtures.dart';
import 'support/harness.dart';
import 'support/lab_fixtures.dart' show labContract;

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
    // The bar: the paper's name on one line, its subject on a second.
    expect(find.text('Mock 7'), findsWidgets);
    expect(find.bySemanticsLabel('Mock 7, Accountancy'), findsWidgets);
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

  group('the Mistake Lab sits right under the score (Mistake Lab v4, spec 3)', () {
    /// The spec paper with a device record (one visit and one pick a question, a minute each, and one
    /// changed answer), the website's lab contract and its SWOT read.
    Map<String, dynamic> withLabAndSwot() {
      final a = attemptJson();
      final qs = (a['questionsSnapshot'] as List).cast<Map<String, dynamic>>();
      final ds = (a['details'] as List).cast<Map<String, dynamic>>();
      final changed = ds.indexWhere((d) => d['isCorrect'] == false);
      final ev = <Map<String, dynamic>>[];
      final changes = <Map<String, dynamic>>[];
      var seq = 1;
      for (var i = 0; i < qs.length; i++) {
        final qid = qs[i]['id'] as String;
        final at = i * 60000;
        final given = ds[i]['givenIndex'] as int?;
        ev.add({'seq': seq++, 'qid': qid, 'at': at, 'type': 'visit'});
        if (i == changed) {
          final key = qs[i]['correctIndex'] as int;
          ev.add({'seq': seq++, 'qid': qid, 'at': at + 10000, 'type': 'answer', 'answer': key});
          ev.add({'seq': seq++, 'qid': qid, 'at': at + 40000, 'type': 'answer', 'answer': given});
          changes.add({'qid': qid, 'at': at + 40000, 'before': key, 'after': given, 'markEffect': -6});
        } else if (given != null) {
          ev.add({'seq': seq++, 'qid': qid, 'at': at + 30000, 'type': 'answer', 'answer': given});
        }
      }
      ev.add({'seq': seq++, 'qid': qs.last['id'], 'at': qs.length * 60000, 'type': 'visit'});
      (a['selectionMeta'] as Map<String, dynamic>)['recovery'] = {
        'telemetry': 'self_reported',
        'timeline': ev,
        'observed': {'answerChanges': changes},
      };
      final swot = (jsonDecode(File('test/fixtures/swot_contract_v1.json').readAsStringSync()) as Map<String, dynamic>)['swot'];
      return {...a, 'lab': labContract('ready'), 'swot': swot};
    }

    setUp(LabLedgerSection.debugResetSeen);

    testWidgets('order: summary, the Lab, After this mock, Time and decisions, the first fix, the answers', (tester) async {
      await pump(tester, data: withDetail(detail(attemptBody: withLabAndSwot())));
      await tester.pumpAndSettle();
      expect(find.byType(LabLedgerSection), findsOneWidget);
      double top(String t) => tester.getTopLeft(find.text(t).first).dy;
      expect(top('26 of 50 correct, 15 wrong, 9 not attempted.') < top('Mistake Lab'), isTrue);
      // After this mock sits right under where the marks went: what to do next is the second thing
      // a mock's result says (Result owner's move, app-practice-review-1016.md L15).
      expect(top('Mistake Lab') < top('After this mock'), isTrue);
      expect(top('After this mock') < top(TimeCopy.title), isTrue);
      expect(top(TimeCopy.title) < top('The first thing to fix'), isTrue);
      expect(top('The first thing to fix') < top('Answer by answer'), isTrue);
      // The old title is gone from the full result.
      expect(find.text('Where the marks went'), findsNothing);
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

    testWidgets('without a lab the result keeps the breakdown, under the name Mistake Lab', (tester) async {
      await pump(tester);
      expect(find.byType(LabLedgerSection), findsNothing);
      expect(find.text('Mistake Lab'), findsOneWidget);
      expect(find.text('How others answered'), findsNothing);
    });
  });


  test('model fixture sanity', () {
    final RecapModel m = mock7();
    expect(m.attemptId, 'a7');
  });
}
