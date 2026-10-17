// The practice result in four layers (RESULT-1017, packet A1): what happened in one glance, the one next move, the
// mistakes with their repair inline, and everything else folded under plain names.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart' show ProviderScope;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/api/api.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/repositories/attempts_repository.dart' show attemptDetailProvider;
import 'package:mockmob/core/widgets/widgets.dart' show KeyButton, Mobi, MobiCharacter;
import 'package:mockmob/features/credits/data/credit_figures.dart' show CreditFigures;
import 'package:mockmob/features/practice/data/result_actions.dart';
import 'package:mockmob/features/practice/practice_result_screen.dart' show PracticeResultScreen;
import 'package:mockmob/features/practice/practice_routes.dart';
import 'package:mockmob/features/practice/widgets/numbered_sheet.dart' show NumberedSheet;
import 'package:mockmob/features/result/widgets/fold_section.dart' show FoldMemory;
import 'package:mockmob/features/result/widgets/mistake_row.dart' show MistakeRepairEntry, MistakeSummary;
import 'package:mockmob/features/result/widgets/result_head.dart' show ResultHead;

import '../../helpers/fonts.dart';
import '../core_data/support/fixtures.dart';
import 'support/harness.dart';

List<GoRoute> _routes() => [
  GoRoute(path: '/practice/result/:attemptId', builder: (c, s) => practiceResultScreen(c, s)),
  stubRoute('/today'),
  stubRoute('/practice'),
  stubRoute('/practice/setup/:mode'),
  stubRoute('/review/repair/:attemptId/:questionId'),
  stubRoute('/practice/start'),
  stubRoute('/you/credits'),
];

AttemptDetail detailOf(List<(String, V)> questions, {Map<String, dynamic>? reviews, String state = 'ready'}) => AttemptDetail.fromJson({
  ...attemptJson(id: 'p1', mode: 'quick', subject: 'accountancy', questions: questions),
  'answerReviews': reviews ?? <String, dynamic>{},
  'answerReviewState': state,
});

final _mixed = [
  for (var i = 0; i < 8; i++) ('Admission of a partner', V.right),
  ('Admission of a partner', V.wrong),
  ('Admission of a partner', V.blank),
];

Future<GoRouter> pumpResult(WidgetTester tester, List<dynamic> overrides) {
  FoldMemory.instance.reset();
  addTearDown(FoldMemory.instance.reset);
  return pumpRouted(tester, location: '/practice/result/p1', routes: _routes(), overrides: List.castFrom(overrides));
}

Finder get _page => find.byType(Scrollable).first;

/// Real frames, so a fold or a row that opens has grown to its full height.
Future<void> frames(WidgetTester tester, {int ms = 500}) async {
  for (var t = 0; t < ms; t += 16) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

/// Scrolls [finder] into the middle of the list, clear of the pinned foot.
Future<void> bringIn(WidgetTester tester, Finder finder) async {
  await tester.scrollUntilVisible(finder.first, 200, scrollable: _page);
  await Scrollable.ensureVisible(tester.element(finder.first), alignment: 0.3);
  await tester.pump(const Duration(milliseconds: 100));
}

/// Taps the closed face of mistake [number] open.
Future<void> openMistake(WidgetTester tester, int number) async {
  final row = find.byWidgetPredicate((w) => w is MistakeSummary && w.number == number);
  await bringIn(tester, row);
  await tester.tap(row);
  await frames(tester);
}

void main() {
  setUpAll(loadAppFonts);

  testWidgets('one glance: one receipt, the marks with their denominator, the counts, the costliest chapter, and no Mobi', (tester) async {
    final semantics = tester.ensureSemantics();
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed), chapter: 'Admission of a partner'));
    await tester.pump(const Duration(milliseconds: 900));
    // The one receipt: no "Practice finished", no "Saved", no second submitted line (F11).
    expect(find.text('Accountancy practice. Recorded 11:51 PM.'), findsOneWidget);
    expect(find.textContaining('finished'), findsNothing);
    expect(find.textContaining('Submitted'), findsNothing);
    // 8 right, 1 wrong: 39 of 50 marks.
    expect(find.bySemanticsLabel('39 of 50 marks'), findsWidgets);
    expect(find.bySemanticsLabel('8 right, 1 wrong, 1 blank'), findsOneWidget);
    expect(find.text('Admission of a partner cost 11 of the 11 marks you missed.'), findsOneWidget);
    expect(find.text('1 wrong and 1 left blank, of 10 questions.'), findsOneWidget);
    // No Mobi on the result: no sleepy one, no speech bubble, no reader.
    expect(find.byType(Mobi), findsNothing);
    expect(find.byType(MobiCharacter), findsNothing);
    expect(find.text('Finish for now'), findsWidgets);
    semantics.dispose();
  });

  testWidgets('one next move: the foot key, why, what a repair gives and its cost before paying, and the late hour in words', (tester) async {
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed), credits: const CreditFigures(ai: 68, practice: 40)));
    await tester.pump(const Duration(milliseconds: 900));
    expect(find.widgetWithText(KeyButton, 'Repair Q9'), findsOneWidget);
    expect(find.text('Why Q9 first'), findsOneWidget);
    expect(find.text('Admission of a partner. You picked B.'), findsOneWidget);
    // No check question is promised until the Lab says one is ready (RESULT-1017 4.4).
    expect(find.textContaining('A repair gives you why B looked right, the trap'), findsOneWidget);
    expect(find.text('1 AI credit. You have 68. No charge if the repair cannot be written.'), findsOneWidget);
    // 11 PM: one plain line, never a sleeping figure.
    expect(find.text('It is late. One repair is enough for tonight.'), findsOneWidget);
    expect(find.text('Practise 10 on Admission of a partner instead'), findsOneWidget);
  });

  testWidgets('the receipt waits for the time the server acknowledged; it never shows the attempt time meanwhile', (tester) async {
    final gate = Completer<DateTime?>();
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed), receivedLater: gate.future));
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.textContaining('Recorded'), findsNothing);
    gate.complete(DateTime(2026, 10, 12, 23, 53));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Accountancy practice. Recorded 11:53 PM.'), findsOneWidget);
  });

  testWidgets('the mistakes: in paper order, priced in marks, each opening to its key, explanation and repair entry', (tester) async {
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed)));
    await tester.pump(const Duration(milliseconds: 900));
    expect(find.text('Your 1 mistake'), findsOneWidget);
    expect(find.text('−6 marks'), findsOneWidget);
    expect(find.text('In paper order. Repaired ones say whether the fix held.'), findsOneWidget);
    expect(find.text('Repair first'), findsOneWidget, reason: 'the volt key\'s target wears its chip');
    // Closed until tapped: the key opens it.
    expect(find.text('Your answer'), findsNothing);
    await openMistake(tester, 9);
    expect(find.text('Your answer'), findsOneWidget);
    expect(find.text('Correct answer'), findsOneWidget);
    expect(find.text('Because 8.'), findsOneWidget);
    expect(find.textContaining('then a new question to check it held'), findsOneWidget);
    expect(find.byType(Image), findsNothing);
  });

  testWidgets('a held review shows no key, no explanation and no repair, and the head says so once', (tester) async {
    final detail = detailOf(
      _mixed,
      reviews: {
        'p1-q9': {'state': 'under_review'},
      },
    );
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detail));
    await tester.pump(const Duration(milliseconds: 900));
    expect(find.text("Q9's answer key is being re-checked. It is left out of repairs until the check ends."), findsOneWidget);
    expect(find.text('Key being re-checked'), findsOneWidget);
    expect(find.widgetWithText(KeyButton, 'Repair Q9'), findsNothing);
    await openMistake(tester, 9);
    expect(find.text('The answer for this question is being checked, so it is not shown yet.'), findsOneWidget);
    expect(find.text('Correct answer'), findsNothing);
    expect(find.text('Because 8.'), findsNothing);
  });

  testWidgets('unavailable reviews mean no keys at all', (tester) async {
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed, state: 'unavailable')));
    await tester.pump(const Duration(milliseconds: 900));
    await openMistake(tester, 9);
    expect(find.text('Answers and explanations are not available for this result right now.'), findsOneWidget);
    expect(find.text('Correct answer'), findsNothing);
  });

  testWidgets('blanks fold under one priced row, open with Try it again, and never offer a repair', (tester) async {
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed)));
    await tester.pump(const Duration(milliseconds: 900));
    final blanks = find.text('1 left blank, 5 marks not earned');
    await bringIn(tester, blanks);
    expect(find.text('Question 10, Not attempted'), findsNothing);
    await tester.tap(blanks);
    await frames(tester);
    await bringIn(tester, find.text('Question 10, Not attempted'));
    await tester.tap(find.text('Question 10, Not attempted'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('You did not answer this question.'), findsOneWidget);
    expect(find.byType(MistakeRepairEntry), findsNothing);
    await tester.ensureVisible(find.text('Try it again').first);
    await tester.pump(const Duration(milliseconds: 300));
    await tester.tap(find.text('Try it again').first);
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('This try stays on your phone.'), findsOneWidget);
  });

  testWidgets('every question right: a harder set is the move, and the mistakes say there are none', (tester) async {
    final all = [for (var i = 0; i < 10; i++) ('Goodwill', V.right)];
    final router = await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(all)));
    await tester.pump(const Duration(milliseconds: 900));
    expect(find.text('Every question right.'), findsOneWidget);
    expect(find.text('No mistakes to repair.'), findsOneWidget);
    expect(find.widgetWithText(KeyButton, 'Practise 10 harder in Accountancy'), findsOneWidget);
    await tester.tap(find.widgetWithText(KeyButton, 'Practise 10 harder in Accountancy'));
    await tester.pump(const Duration(milliseconds: 500));
    expect(router.state.uri.path, '/practice/start');
    expect(router.state.uri.queryParameters['difficulty'], 'hard');
  });

  testWidgets('a weak set: a chapter set before single repairs, with its cost and balance', (tester) async {
    final weak = [
      ('Goodwill', V.right),
      ('Goodwill', V.right),
      for (var i = 0; i < 6; i++) ('Goodwill', V.wrong),
      ('Admission of a partner', V.wrong),
      ('Admission of a partner', V.blank),
    ];
    final router = await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(weak), credits: const CreditFigures(ai: 68, practice: 40)));
    await tester.pump(const Duration(milliseconds: 900));
    expect(find.widgetWithText(KeyButton, 'Practise 10 on Goodwill'), findsOneWidget);
    expect(find.text('Why this chapter first'), findsOneWidget);
    expect(find.text('Goodwill: most answers in this chapter were wrong, so a chapter set comes before repairing single mistakes.'), findsOneWidget);
    expect(find.text('This set uses 10 practice credits. You have 40.'), findsOneWidget);
    await tester.tap(find.widgetWithText(KeyButton, 'Practise 10 on Goodwill'));
    await tester.pump(const Duration(milliseconds: 500));
    expect(router.state.uri.path, '/practice/start');
    expect(router.state.uri.queryParameters, {'mode': 'chapter', 'subject': 'accountancy', 'count': '10', 'chapter': 'Goodwill'});
  });

  testWidgets('Finish for now ends with one plain line, then returns to Today', (tester) async {
    final router = await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed)));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.tap(find.text('Finish for now'));
    await tester.pump();
    expect(find.text('Practice finished. Recorded at 11:51 PM.'), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 1700));
    await tester.pump(const Duration(milliseconds: 300));
    expect(router.state.uri.path, '/today');
  });

  testWidgets('the result of another account says so', (tester) async {
    await pumpResult(
      tester,
      resultOverrides(
        attemptId: 'p1',
        error: const ApiError(kind: ApiErrorKind.notFound, code: 'not_found', status: 404),
      ),
    );
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('We could not find this result. It may belong to another account.'), findsOneWidget);
  });

  testWidgets('a failed read with nothing cached offers Try again', (tester) async {
    await pumpResult(
      tester,
      resultOverrides(
        attemptId: 'p1',
        error: const ApiError(kind: ApiErrorKind.server, code: 'server_error', status: 500),
      ),
    );
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('We could not load this result. Try again.'), findsOneWidget);
    expect(find.text('Try again'), findsWidgets);
  });

  testWidgets('a stale cached result says when it was last loaded', (tester) async {
    await pumpResult(
      tester,
      resultOverrides(
        attemptId: 'p1',
        detail: detailOf(_mixed),
        error: const ApiError(kind: ApiErrorKind.network, code: 'network'),
        fetchedAt: DateTime(2026, 10, 12, 22, 44),
      ),
    );
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('Showing what was last loaded at 10:44 PM.'), findsOneWidget);
  });

  testWidgets('every mistake row is a labelled 48 dp or larger target', (tester) async {
    final semantics = tester.ensureSemantics();
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed)));
    await tester.pump(const Duration(milliseconds: 900));
    final row = find.bySemanticsLabel(RegExp(r'^Question 9, Admission of a partner, B yours'));
    expect(row, findsOneWidget);
    expect(tester.getSize(row).height, greaterThanOrEqualTo(48));
    semantics.dispose();
  });

  testWidgets('straight after the submit the score counts up and the layers below arrive after it', (tester) async {
    final pending = FakePendingResults()..receivedAt = DateTime(2026, 10, 12, 23, 51);
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed), pending: pending));
    await tester.pump();
    await tester.pump();
    expect(find.text('0'), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 420));
    await tester.pump(const Duration(milliseconds: 420));
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text('39'), findsOneWidget);
    // Opened once: the result is marked opened only after the arrival read that it was fresh.
    expect(pending.opened, ['p1']);
  });

  testWidgets('the foot key opens that one repair; the alternative starts the chapter set', (tester) async {
    final questions = <(String, V)>[
      ('Nature of management', V.right),
      ('Principles of management', V.wrong),
      ('Nature of management', V.right),
      ('Planning', V.wrong),
      ('Staffing', V.wrong),
      ('Nature of management', V.right),
      ('Planning', V.wrong),
      ('Staffing', V.wrong),
      ('Nature of management', V.right),
      ('Nature of management', V.right),
    ];
    final router = await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(questions)));
    await tester.pump(const Duration(milliseconds: 900));
    // Planning and Staffing each cost 12; Planning comes first in the paper, so its first mistake leads.
    expect(find.text('Planning cost 12 of the 30 marks you missed.'), findsOneWidget);
    expect(find.widgetWithText(KeyButton, 'Repair Q4'), findsOneWidget);
    expect(find.text('All 5 repairs take about 15 minutes.'), findsOneWidget);
    expect(find.text('Your 5 mistakes'), findsOneWidget);
    expect(find.byType(MistakeSummary), findsNWidgets(4), reason: 'four show; "Show all 5" opens the last');
    expect(find.text('Show all 5'), findsOneWidget);
    expect(find.text('Practise 10 on Planning instead'), findsOneWidget);
    await tester.tap(find.widgetWithText(KeyButton, 'Repair Q4'));
    await tester.pump(const Duration(milliseconds: 500));
    expect(router.state.uri.path, '/review/repair/p1/p1-q4');
    expect(router.state.uri.queryParameters['count'], '1');
  });

  testWidgets('with fresh questions ready the proof fold starts 5 in that chapter for this attempt', (tester) async {
    const replay = ReplayInventory(supported: true, chapters: [ReplayChapter(chapter: 'Admission of a partner', available: true)]);
    final router = await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed), replay: replay));
    await tester.pump(const Duration(milliseconds: 900));
    final fold = find.text('Your rule and proof it stuck');
    await bringIn(tester, fold);
    expect(find.text('Five new questions on Admission of a partner show whether a fix held.'), findsOneWidget);
    await tester.tap(fold);
    await frames(tester);
    await bringIn(tester, find.widgetWithText(KeyButton, 'Try 5 fresh questions'));
    // A key that has just come into view takes taps after its short lock.
    await tester.pump(const Duration(seconds: 1));
    await tester.tap(find.widgetWithText(KeyButton, 'Try 5 fresh questions').first);
    await tester.pump(const Duration(milliseconds: 500));
    expect(router.state.uri.path, '/practice/start');
    expect(router.state.uri.queryParameters, {
      'mode': 'chapter',
      'subject': 'accountancy',
      'count': '5',
      'chapter': 'Admission of a partner',
      'recoveryFrom': 'p1',
    });
  });

  testWidgets('no fresh set ready, or an unsupported subject: no proof fold and no promise', (tester) async {
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed), replay: const ReplayInventory(supported: false)));
    await tester.pump(const Duration(milliseconds: 900));
    await tester.scrollUntilVisible(find.text('Every answer, all 10'), 200, scrollable: _page);
    expect(find.text('Your rule and proof it stuck'), findsNothing);
  });

  testWidgets('what this set shows sits in its fold, and Show me opens the question it names', (tester) async {
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed)));
    await tester.pump(const Duration(milliseconds: 900));
    final fold = find.text('Where the marks went');
    await bringIn(tester, fold);
    expect(find.text('8 of 9 answered were right.'), findsOneWidget);
    await tester.tap(fold);
    await frames(tester);
    await tester.scrollUntilVisible(find.text('One question not attempted'), 200, scrollable: _page);
    expect(find.text('What this set shows'), findsOneWidget);
    expect(find.text('BLANKS'), findsNothing);
  });

  testWidgets('every answer: the sheet and the right answers, nothing lost', (tester) async {
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed)));
    await tester.pump(const Duration(milliseconds: 900));
    final fold = find.text('Every answer, all 10');
    await bringIn(tester, fold);
    expect(find.text('8 right, 1 wrong, 1 blank. Tap a bubble to open its question.'), findsOneWidget);
    await tester.tap(fold);
    await frames(tester);
    expect(find.byType(NumberedSheet), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Right answers (8)'), 200, scrollable: _page);
    expect(find.text('Right answers (8)'), findsOneWidget);
  });

  group('the arrival never waits on a blank band (owner: "it is just loading the score")', () {
    /// The attempt as the submit cached it, before any per-question rows are known.
    Attempt countsOnly() {
      final json = attemptJson(id: 'p1', mode: 'quick', subject: 'accountancy', questions: _mixed)
        ..remove('details')
        ..remove('questionsSnapshot');
      return Attempt.fromJson(json);
    }

    testWidgets('with nothing on the phone yet, a skeleton shaped like the result waits; no Mobi before it exists', (tester) async {
      await pumpResult(tester, resultOverrides(attemptId: 'p1', loading: true));
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('Reading your sheet'), findsOneWidget);
      expect(find.byType(MobiCharacter), findsNothing);
    });

    testWidgets('a fresh result with the rows in the cache plays at once, without waiting for the result read', (tester) async {
      final pending = FakePendingResults()..receivedAt = DateTime(2026, 10, 12, 23, 51);
      final cached = Attempt.fromJson(attemptJson(id: 'p1', mode: 'quick', subject: 'accountancy', questions: _mixed));
      await pumpResult(tester, resultOverrides(attemptId: 'p1', loading: true, cachedAttempt: cached, pending: pending));
      await tester.pump();
      await tester.pump();
      expect(find.byType(ResultHead), findsOneWidget);
      expect(find.text('Reading your sheet'), findsNothing);
      await tester.pump(const Duration(milliseconds: 1500));
      expect(find.text('39'), findsOneWidget);
    });

    testWidgets('a fresh result without rows waits, then counts the real score from 0 when the rows arrive', (tester) async {
      final pending = FakePendingResults()..receivedAt = DateTime(2026, 10, 12, 23, 51);
      await pumpResult(tester, resultOverrides(attemptId: 'p1', loading: true, cachedAttempt: countsOnly(), pending: pending));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.byType(ResultHead), findsNothing);
      expect(find.text('Reading your sheet'), findsOneWidget);

      final container = ProviderScope.containerOf(tester.element(find.byType(PracticeResultScreen)));
      (container.read(attemptDetailProvider('p1').notifier) as FakeDetail).deliver(detailOf(_mixed));
      await tester.pump();
      await tester.pump();
      expect(find.byType(ResultHead), findsOneWidget);
      expect(find.text('0'), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 1500));
      expect(find.text('39'), findsOneWidget);
    });

    testWidgets('opened again later with the rows in the cache, the end state shows at once', (tester) async {
      final cached = Attempt.fromJson(attemptJson(id: 'p1', mode: 'quick', subject: 'accountancy', questions: _mixed));
      await pumpResult(tester, resultOverrides(attemptId: 'p1', loading: true, cachedAttempt: cached));
      await tester.pump();
      await tester.pump();
      expect(find.byType(ResultHead), findsOneWidget);
      expect(find.text('39'), findsOneWidget);
    });

    testWidgets('opened again before the rows arrive, nothing empty mounts; the full head then shows at once', (tester) async {
      await pumpResult(tester, resultOverrides(attemptId: 'p1', loading: true, cachedAttempt: countsOnly()));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.byType(ResultHead), findsNothing);
      expect(find.text('Reading your sheet'), findsOneWidget);

      final container = ProviderScope.containerOf(tester.element(find.byType(PracticeResultScreen)));
      (container.read(attemptDetailProvider('p1').notifier) as FakeDetail).deliver(detailOf(_mixed));
      await tester.pump();
      await tester.pump();
      expect(tester.widget<ResultHead>(find.byType(ResultHead)).arrival, isFalse);
      expect(find.text('39'), findsOneWidget);
    });
  });
}
