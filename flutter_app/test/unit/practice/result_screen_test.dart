import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart' show ProviderScope;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/api/api.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/repositories/attempts_repository.dart' show attemptDetailProvider;
import 'package:mockmob/core/widgets/widgets.dart' show KeyButton, MobiCharacter, QuestionStrip;
import 'package:mockmob/features/practice/practice_result_screen.dart' show PracticeResultScreen;
import 'package:mockmob/features/practice/widgets/finish_stage.dart';
import 'package:mockmob/features/practice/data/result_actions.dart';
import 'package:mockmob/features/practice/practice_routes.dart';

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

Future<GoRouter> pumpResult(WidgetTester tester, List<dynamic> overrides) =>
    pumpRouted(tester, location: '/practice/result/p1', routes: _routes(), overrides: List.castFrom(overrides));

void main() {
  setUpAll(loadAppFonts);

  testWidgets('shows 8 of 10 correct, wrong and not attempted apart, the chapter and the receipt', (tester) async {
    final semantics = tester.ensureSemantics();
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed), chapter: 'Admission of a partner'));
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.bySemanticsLabel(RegExp('8 of 10 correct')), findsWidgets);
    expect(find.text('8 right, 1 wrong, 1 not attempted'), findsOneWidget);
    expect(find.text('Accountancy practice, Admission of a partner'), findsOneWidget);
    expect(find.text('Practice finished. Recorded at 11:51 PM.'), findsOneWidget);
    // 8 right, 1 wrong: 39 of 50; the wrong answer cost 6 of the 11 marks missed.
    expect(find.text('39 of 50 marks. 1 wrong answer cost 6 of the 11 marks you missed.'), findsOneWidget);
    expect(find.text('Repair this one'), findsWidgets);
    expect(find.text('Finish for now'), findsWidgets);
    expect(find.text('Wrong answers (1)'), findsOneWidget);
    expect(find.text('Not attempted (1)'), findsOneWidget);
    expect(find.text('Correct (8)'), findsOneWidget);
    semantics.dispose();
  });

  testWidgets('the receipt waits for the time the server acknowledged; it never shows the attempt time meanwhile', (tester) async {
    final gate = Completer<DateTime?>();
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed), receivedLater: gate.future));
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.textContaining('Recorded at'), findsNothing);
    gate.complete(DateTime(2026, 10, 12, 23, 53));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Practice finished. Recorded at 11:53 PM.'), findsOneWidget);
  });

  testWidgets('the first wrong answer is open with its key and explanation, with no raster art', (tester) async {
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed)));
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('Question 9, Wrong'), findsOneWidget);
    expect(find.text('Your answer'), findsOneWidget);
    expect(find.text('Correct answer'), findsOneWidget);
    expect(find.text('Because 8.'), findsOneWidget);
    expect(find.byType(Image), findsNothing);
  });

  testWidgets('a held review shows no key and no explanation', (tester) async {
    final detail = detailOf(
      _mixed,
      reviews: {
        'p1-q9': {'state': 'under_review'},
      },
    );
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detail));
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('The answer for this question is being checked, so it is not shown yet.'), findsOneWidget);
    expect(find.text('Correct answer'), findsNothing);
    expect(find.text('Because 8.'), findsNothing);
  });

  testWidgets('unavailable reviews mean no keys at all', (tester) async {
    await pumpResult(
      tester,
      resultOverrides(
        attemptId: 'p1',
        detail: detailOf(_mixed, state: 'unavailable'),
      ),
    );
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('Answers and explanations are not available for this result right now.'), findsOneWidget);
    expect(find.text('Correct answer'), findsNothing);
  });

  testWidgets('not attempted questions are listed apart with Try it again, never a repair key', (tester) async {
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed)));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.ensureVisible(find.text('Question 10, Not attempted'));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.tap(find.text('Question 10, Not attempted'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('You did not answer this question.'), findsOneWidget);
    expect(find.text('Try it again'), findsWidgets);
    expect(find.text('Correct answer'), findsNWidgets(1)); // only the open wrong row shows its key
    await tester.ensureVisible(find.text('Try it again').first);
    await tester.pump(const Duration(milliseconds: 300));
    await tester.tap(find.text('Try it again').first);
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('This try stays on your phone.'), findsOneWidget);
  });

  testWidgets('with no wrong answer the primary key is Practice another chapter', (tester) async {
    final all = [for (var i = 0; i < 10; i++) ('Goodwill', V.right)];
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(all)));
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('Practice another chapter'), findsWidgets);
    expect(find.textContaining('Review'), findsNothing);
    expect(find.text('10 right. Nothing wrong, nothing left out.'), findsOneWidget);
  });

  testWidgets('Finish for now ends with one plain line, then returns to Today', (tester) async {
    final router = await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed)));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.tap(find.text('Finish for now'));
    await tester.pump();
    expect(find.text('Practice finished. Recorded at 11:51 PM.'), findsOneWidget);
    expect(find.text('Review 1 wrong answer'), findsNothing);
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

  testWidgets('every row is a labelled 44 dp or larger target', (tester) async {
    final semantics = tester.ensureSemantics();
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed)));
    await tester.pump(const Duration(milliseconds: 500));
    final row = find.bySemanticsLabel(RegExp(r'^Question 9, Wrong'));
    expect(row, findsOneWidget);
    expect(tester.getSize(row).height, greaterThanOrEqualTo(44));
    semantics.dispose();
  });

  testWidgets('straight after the submit the sheet inks in, the figure counts up and Mobi reacts; a tap skips', (tester) async {
    final pending = FakePendingResults()..receivedAt = DateTime(2026, 10, 12, 23, 51);
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed), pending: pending));
    await tester.pump();
    await tester.pump();
    // At the start nothing is inked yet and Mobi has not spoken.
    expect(find.text('0'), findsOneWidget);
    expect(find.textContaining('Most of this set'), findsNothing);
    await tester.pump(const Duration(milliseconds: 420));
    await tester.pump(const Duration(milliseconds: 420));
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text('8'), findsOneWidget);
    // Opened once: the result is marked opened only after the moment read that it was fresh.
    expect(pending.opened, ['p1']);
  });

  testWidgets('a tap on the moment skips to the end', (tester) async {
    final pending = FakePendingResults()..receivedAt = DateTime(2026, 10, 12, 23, 51);
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed), pending: pending));
    await tester.pump();
    await tester.pump();
    await tester.tap(find.text('8 right, 1 wrong, 1 not attempted'));
    await tester.pump();
    expect(find.text('8'), findsOneWidget);
  });

  testWidgets('a wrong answer offers Repair, which opens Mistake Repair for this set', (tester) async {
    final router = await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed)));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.tap(find.text('Repair this one'));
    await tester.pump(const Duration(milliseconds: 500));
    expect(router.state.uri.path, '/review/repair/p1/p1-q9');
    expect(router.state.uri.queryParameters['count'], '1');
  });

  testWidgets('5 wrong answers across chapters: the key names the one run it opens and says where the rest are', (tester) async {
    // The demo's paper: wrong answers in three chapters. A repair run covers one chapter of one
    // paper, so the key counts that chapter (Planning, 2) and the caption says the other 3 stay in Review.
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
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('Repair these 2'), findsWidgets);
    expect(find.text('Repair these 5'), findsNothing);
    expect(find.text('Planning. The other 3 are in Review.'), findsOneWidget);
    await tester.tap(find.text('Repair these 2'));
    await tester.pump(const Duration(milliseconds: 500));
    expect(router.state.uri.path, '/review/repair/p1/p1-q4');
    expect(router.state.uri.queryParameters['count'], '2');
  });

  testWidgets('with fresh questions ready the Prove step starts 5 in that chapter for this attempt', (tester) async {
    const replay = ReplayInventory(supported: true, chapters: [ReplayChapter(chapter: 'Admission of a partner', available: true)]);
    final router = await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed), replay: replay));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.scrollUntilVisible(find.text('Prove the repair'), 200, scrollable: find.byType(Scrollable).first);
    await tester.drag(find.byType(Scrollable).first, const Offset(0, -200));
    await tester.pump();
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

  testWidgets('no fresh set ready, or an unsupported subject: no Prove step and no promise', (tester) async {
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed), replay: const ReplayInventory(supported: false)));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.scrollUntilVisible(find.text('One question not attempted'), 200, scrollable: find.byType(Scrollable).first);
    expect(find.text('Prove the repair'), findsNothing);
  });

  testWidgets('blanks are named with the questions behind them, and Show me opens the first', (tester) async {
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed)));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.scrollUntilVisible(find.text('One question not attempted'), 200, scrollable: find.byType(Scrollable).first);
    expect(find.text('What this set shows'), findsOneWidget);
    expect(find.text('Question 10'), findsOneWidget);
    // Sentence case, like the rest of the page: no tracked capitals (walk-through P3-5).
    expect(find.text('Not attempted'), findsOneWidget);
    expect(find.text('BLANKS'), findsNothing);
  });

  testWidgets('the answer sheet of ten bubbles sits in the middle of its card (walk-through P3-7)', (tester) async {
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed)));
    await tester.pump(const Duration(milliseconds: 500));
    final strip = tester.getRect(find.byType(QuestionStrip).first);
    final card = tester.getRect(find.ancestor(of: find.byType(QuestionStrip).first, matching: find.byType(DecoratedBox)).first);
    const pad = 16.0;
    expect(strip.left - card.left, closeTo(pad, 0.5), reason: 'the first bubble starts at the card padding');
    expect(card.right - strip.right, closeTo(pad, 0.5), reason: 'and the last one ends at the same distance from the right');
  });

  group('the finish moment never waits on a blank band (owner: "it is just loading the score")', () {
    /// The attempt as the submit cached it, before any per-question rows are known.
    Attempt countsOnly() {
      final json = attemptJson(id: 'p1', mode: 'quick', subject: 'accountancy', questions: _mixed)
        ..remove('details')
        ..remove('questionsSnapshot');
      return Attempt.fromJson(json);
    }

    testWidgets('with nothing on the phone yet, Mobi reads the sheet instead of a skeleton', (tester) async {
      await pumpResult(tester, resultOverrides(attemptId: 'p1', loading: true));
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('Reading your sheet'), findsOneWidget);
      expect(find.byType(MobiCharacter), findsOneWidget);
      expect(find.text('Loading your answers'), findsNothing);
    });

    testWidgets('a fresh result with the rows in the cache plays at once, without waiting for the result read', (tester) async {
      final pending = FakePendingResults()..receivedAt = DateTime(2026, 10, 12, 23, 51);
      final cached = Attempt.fromJson(attemptJson(id: 'p1', mode: 'quick', subject: 'accountancy', questions: _mixed));
      await pumpResult(tester, resultOverrides(attemptId: 'p1', loading: true, cachedAttempt: cached, pending: pending));
      await tester.pump();
      await tester.pump();
      expect(find.byType(FinishStage), findsOneWidget);
      expect(find.text('Reading your sheet'), findsNothing);
      await tester.pump(const Duration(milliseconds: 1500));
      expect(find.text('8'), findsOneWidget);
    });

    testWidgets('a fresh result without rows waits with Mobi, then inks the real sheet from 0 when the rows arrive', (tester) async {
      final pending = FakePendingResults()..receivedAt = DateTime(2026, 10, 12, 23, 51);
      await pumpResult(tester, resultOverrides(attemptId: 'p1', loading: true, cachedAttempt: countsOnly(), pending: pending));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));
      // No moment on an empty sheet: Mobi has not reacted and nothing has inked.
      expect(find.byType(FinishStage), findsNothing);
      expect(find.text('Reading your sheet'), findsOneWidget);
      expect(find.textContaining('Most of this set'), findsNothing);

      final container = ProviderScope.containerOf(tester.element(find.byType(PracticeResultScreen)));
      (container.read(attemptDetailProvider('p1').notifier) as FakeDetail).deliver(detailOf(_mixed));
      await tester.pump();
      await tester.pump();
      expect(find.byType(FinishStage), findsOneWidget);
      expect(find.text('0'), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 420));
      await tester.pump(const Duration(milliseconds: 420));
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.text('8'), findsOneWidget);
    });

    testWidgets('opened again later with the rows in the cache, the end state shows at once', (tester) async {
      final cached = Attempt.fromJson(attemptJson(id: 'p1', mode: 'quick', subject: 'accountancy', questions: _mixed));
      await pumpResult(tester, resultOverrides(attemptId: 'p1', loading: true, cachedAttempt: cached));
      await tester.pump();
      await tester.pump();
      expect(find.byType(FinishStage), findsOneWidget);
      expect(find.text('8'), findsOneWidget);
    });

    testWidgets('opened again before the rows arrive, Mobi reads and no empty stage mounts; the full stage then shows at once', (tester) async {
      await pumpResult(tester, resultOverrides(attemptId: 'p1', loading: true, cachedAttempt: countsOnly()));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.byType(FinishStage), findsNothing);
      expect(find.text('Reading your sheet'), findsOneWidget);

      final container = ProviderScope.containerOf(tester.element(find.byType(PracticeResultScreen)));
      (container.read(attemptDetailProvider('p1').notifier) as FakeDetail).deliver(detailOf(_mixed));
      await tester.pump();
      await tester.pump();
      final stage = tester.widget<FinishStage>(find.byType(FinishStage));
      expect(stage.cells, hasLength(10));
      expect(stage.fresh, isFalse);
      expect(find.text('8'), findsOneWidget);
    });
  });
}
