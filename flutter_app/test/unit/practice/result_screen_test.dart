import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/api/api.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/features/practice/practice_routes.dart';

import '../../helpers/fonts.dart';
import '../core_data/support/fixtures.dart';
import 'support/harness.dart';

List<GoRoute> _routes() => [
  GoRoute(path: '/practice/result/:attemptId', builder: (c, s) => practiceResultScreen(c, s)),
  stubRoute('/today'),
  stubRoute('/practice'),
  stubRoute('/practice/setup/:mode'),
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
    expect(find.text('Chapter: Admission of a partner.'), findsOneWidget);
    expect(find.text('Practice finished. Recorded at 11:51 PM.'), findsOneWidget);
    expect(find.text('Review 1 wrong answer'), findsWidgets);
    expect(find.text('Finish for now'), findsWidgets);
    expect(find.text('Wrong answers (1)'), findsOneWidget);
    expect(find.text('Not attempted (1)'), findsOneWidget);
    expect(find.text('Correct (8)'), findsOneWidget);
    semantics.dispose();
  });

  testWidgets('the first wrong answer is open with its key and explanation; no Mobi, no celebration', (tester) async {
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

  testWidgets('with no wrong answer the primary key is Practise another chapter', (tester) async {
    final all = [for (var i = 0; i < 10; i++) ('Goodwill', V.right)];
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(all)));
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('Practise another chapter'), findsWidgets);
    expect(find.textContaining('Review'), findsNothing);
    expect(find.text('10 right. Nothing wrong, nothing left blank.'), findsOneWidget);
  });

  testWidgets('Finish for now ends with one plain line, then returns to Today', (tester) async {
    final router = await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed)));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.tap(find.text('Finish for now'));
    await tester.pump();
    expect(find.text('Practice recorded at 11:51 PM.'), findsOneWidget);
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
}
