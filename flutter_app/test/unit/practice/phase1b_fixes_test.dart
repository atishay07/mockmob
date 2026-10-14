// Phase 1B design fixes for practice: the credits-low setup says why Start is dead and shows no
// stale "Free"; offline lives in the lit card; the finish staging holds the answers back until
// the moment ends; one word for a blank; the failure notice is flat.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/api/api.dart';
import 'package:mockmob/core/connectivity/connectivity.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/practice/copy.dart';
import 'package:mockmob/features/practice/model/finish_reaction.dart';
import 'package:mockmob/features/practice/practice_routes.dart';
import 'package:mockmob/features/practice/widgets/plain_notice.dart';

import '../../helpers/fonts.dart';
import '../core_data/support/fixtures.dart';
import 'support/harness.dart';

List<GoRoute> _routes() => [
  GoRoute(path: '/practice', builder: (c, s) => practiceScreen(c, s)),
  GoRoute(path: '/practice/setup/:mode', builder: (c, s) => practiceSetupScreen(c, s)),
  GoRoute(path: '/practice/result/:attemptId', builder: (c, s) => practiceResultScreen(c, s)),
  stubRoute('/practice/start'),
  stubRoute('/run/:sessionId'),
  stubRoute('/learn'),
  stubRoute('/review'),
  stubRoute('/today'),
];

AttemptDetail _detail(List<(String, V)> questions) => AttemptDetail.fromJson({
  ...attemptJson(id: 'p1', mode: 'quick', subject: 'accountancy', questions: questions),
  'answerReviews': <String, dynamic>{},
  'answerReviewState': 'ready',
});

void main() {
  setUpAll(loadAppFonts);

  testWidgets('credits low: the reason sits above the dead Start, and no ticket claims "Free"', (tester) async {
    final quotes = FakeQuoteRepository((s, m, c, p) => lowCredits());
    await pumpRouted(
      tester,
      location: '/practice/setup/quick?subject=accountancy&count=15',
      routes: _routes(),
      overrides: practiceOverrides(quotes: quotes),
    );
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.text('Needs 10 credits. You have 8.'), findsOneWidget);
    expect(find.text('What you get'), findsNothing);
    expect(find.text('Free'), findsNothing);
    expect(find.text('Free today'), findsNothing);
    final start = tester.widget<KeyButton>(find.widgetWithText(KeyButton, 'Start practice'));
    expect(start.onPressed, isNull);
  });

  testWidgets('a failed quote is a flat notice with a text key, not a card', (tester) async {
    final quotes = FakeQuoteRepository((s, m, c, p) => throw const ApiError(kind: ApiErrorKind.server, code: 'server_error'));
    await pumpRouted(
      tester,
      location: '/practice/setup/quick?subject=economics',
      routes: _routes(),
      overrides: practiceOverrides(quotes: quotes),
    );
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.byType(PlainNotice), findsOneWidget);
    expect(find.byType(InlineBanner), findsNothing);
    expect(find.text(PracticeCopy.quoteFailed), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
  });

  testWidgets('offline on the tab: the lit card says it and its Start is quiet, with no banner above it', (tester) async {
    await pumpRouted(
      tester,
      location: '/practice',
      routes: _routes(),
      overrides: practiceOverrides(quotes: FakeQuoteRepository((s, m, c, p) => dailyFree()), attempts: const [], network: NetworkStatus.offline),
    );
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text(PracticeCopy.offlineStart), findsOneWidget);
    expect(find.byType(PlainNotice), findsNothing);
    final start = tester.widgetList<KeyButton>(find.widgetWithText(KeyButton, PracticeCopy.startKey)).first;
    expect(start.onPressed, isNull);
  });

  testWidgets('a fresh result holds the answers back until the moment ends, then brings them in', (tester) async {
    final pending = FakePendingResults()..receivedAt = DateTime(2026, 10, 12, 23, 51);
    await pumpRouted(
      tester,
      location: '/practice/result/p1',
      routes: _routes(),
      overrides: resultOverrides(
        attemptId: 'p1',
        detail: _detail([for (var i = 0; i < 6; i++) ('Goodwill', V.right), ('Goodwill', V.wrong), ('Goodwill', V.wrong)]),
        pending: pending,
      ),
    );
    await tester.pump();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    double listOpacity() => tester
        .widget<AnimatedOpacity>(find.ancestor(of: find.text('Wrong answers (2)', skipOffstage: false), matching: find.byType(AnimatedOpacity)).first)
        .opacity;
    expect(listOpacity(), 0);
    for (var i = 0; i < 40; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    expect(listOpacity(), 1);
  });

  test('one word for a question left out: not attempted, everywhere in practice', () {
    const m = FinishMarks(correct: 4, wrong: 2, blank: 1, total: 7);
    expect(PracticeCopy.countsLine(4, 2, 1), '4 right, 2 wrong, 1 not attempted');
    expect(PracticeCopy.finishLine(FinishTone.mixed, m), contains('1 not attempted'));
    expect(PracticeCopy.finishLine(FinishTone.mixed, m), isNot(contains('blank')));
    expect(PracticeCopy.marksLine(const FinishMarks(correct: 4, wrong: 0, blank: 2, total: 6)), contains('2 questions not attempted'));
    expect(PracticeCopy.markingValue, '+5 right, −1 wrong, 0 not attempted');
    expect(PracticeCopy.finished(DateTime(2026, 10, 12, 23, 51)), PracticeCopy.recorded(DateTime(2026, 10, 12, 23, 51)));
  });
}
