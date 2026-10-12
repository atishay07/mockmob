import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/api/api.dart';
import 'package:mockmob/core/connectivity/connectivity.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/models/practice_quote.dart';
import 'package:mockmob/features/practice/data/practice_starter.dart';
import 'package:mockmob/features/practice/practice_routes.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart' show settleImages;
import '../../unit/practice/support/harness.dart';
import '../../unit/core_data/support/fixtures.dart';

List<GoRoute> _routes() => [
  GoRoute(path: '/practice', builder: (c, s) => practiceScreen(c, s)),
  GoRoute(path: '/practice/setup/:mode', builder: (c, s) => practiceSetupScreen(c, s)),
  GoRoute(path: '/practice/result/:attemptId', builder: (c, s) => practiceResultScreen(c, s)),
  stubRoute('/run/:sessionId'),
  stubRoute('/today'),
];

Future<void> _settle(WidgetTester tester, {int ms = 700}) async {
  for (var i = 0; i < 4; i++) {
    await tester.pump(Duration(milliseconds: ms ~/ 4));
  }
}

FakeQuoteRepository _tabQuotes() => FakeQuoteRepository((s, m, c, p) {
  if (m == 'full') return creditsQuote(cost: 50, balance: 120, mode: 'full', count: 50);
  if (m == 'nta') return proGate();
  return dailyFree();
});

AttemptDetail _detail(List<(String, V)> questions, {Map<String, dynamic>? reviews}) => AttemptDetail.fromJson({
  ...attemptJson(id: 'p1', mode: 'quick', subject: 'accountancy', questions: questions),
  'answerReviews': reviews ?? <String, dynamic>{},
  'answerReviewState': 'ready',
});

final _mixed = [
  for (var i = 0; i < 8; i++) ('Admission of a partner', V.right),
  ('Admission of a partner', V.wrong),
  ('Admission of a partner', V.blank),
];

Future<void> _shot(WidgetTester tester, String name, Brightness b) =>
    expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/${name}_${b.name}.png'));

void main() {
  setUpAll(loadAppFonts);

  for (final b in Brightness.values) {
    group('practice, ${b.name}', () {
      testWidgets('tab with quotes loaded', (tester) async {
        await pumpRouted(
          tester,
          location: '/practice',
          routes: _routes(),
          brightness: b,
          overrides: practiceOverrides(quotes: _tabQuotes()),
        );
        await _settle(tester);
        await _shot(tester, 'tab_loaded', b);
      });

      testWidgets('tab while the quote is slow', (tester) async {
        final gate = Completer<PracticeQuote>();
        await pumpRouted(
          tester,
          location: '/practice',
          routes: _routes(),
          brightness: b,
          overrides: practiceOverrides(quotes: FakeQuoteRepository((s, m, c, p) => gate.future)),
        );
        await _settle(tester, ms: 600);
        await _shot(tester, 'tab_slow_quote', b);
        gate.complete(dailyFree());
        await tester.pump();
      });

      testWidgets('tab with a mock still running', (tester) async {
        final endsAt = testNow.add(const Duration(minutes: 47)).millisecondsSinceEpoch;
        final draft = draftOf(sessionId: 'sess-7', count: 50, mode: 'full', endsAtWallMs: endsAt, mockNumber: 7);
        await pumpRouted(
          tester,
          location: '/practice',
          routes: _routes(),
          brightness: b,
          overrides: practiceOverrides(quotes: _tabQuotes(), draft: draft),
        );
        await _settle(tester);
        await _shot(tester, 'tab_mock_running', b);
      });

      testWidgets('quick setup with the daily practice free', (tester) async {
        await pumpRouted(
          tester,
          location: '/practice/setup/quick?subject=accountancy',
          routes: _routes(),
          brightness: b,
          overrides: practiceOverrides(quotes: FakeQuoteRepository((s, m, c, p) => dailyFree(count: c ?? 10))),
        );
        await _settle(tester);
        await _shot(tester, 'setup_quick_free', b);
      });

      testWidgets('quick setup with credits', (tester) async {
        await pumpRouted(
          tester,
          location: '/practice/setup/quick?subject=english&count=15',
          routes: _routes(),
          brightness: b,
          overrides: practiceOverrides(quotes: FakeQuoteRepository((s, m, c, p) => creditsQuote(count: c ?? 10))),
        );
        await _settle(tester);
        await _shot(tester, 'setup_quick_credits', b);
      });

      testWidgets('quick setup while the quote is slow', (tester) async {
        final gate = Completer<PracticeQuote>();
        await pumpRouted(
          tester,
          location: '/practice/setup/quick?subject=accountancy',
          routes: _routes(),
          brightness: b,
          overrides: practiceOverrides(quotes: FakeQuoteRepository((s, m, c, p) => gate.future)),
        );
        await _settle(tester, ms: 600);
        await _shot(tester, 'setup_quick_slow_quote', b);
        gate.complete(dailyFree());
        await tester.pump();
      });

      testWidgets('credits low', (tester) async {
        final quotes = FakeQuoteRepository((s, m, c, p) => c == 10 ? dailyFree() : lowCredits());
        await pumpRouted(
          tester,
          location: '/practice/setup/quick?subject=accountancy&count=15',
          routes: _routes(),
          brightness: b,
          overrides: practiceOverrides(quotes: quotes),
        );
        await _settle(tester);
        await _shot(tester, 'setup_credits_low', b);
      });

      testWidgets('chapter practice with a chapter chosen', (tester) async {
        await pumpRouted(
          tester,
          location: '/practice/setup/chapter?subject=accountancy&chapter=Admission%20of%20a%20partner',
          routes: _routes(),
          brightness: b,
          overrides: practiceOverrides(quotes: FakeQuoteRepository((s, m, c, p) => creditsQuote(count: c ?? 10))),
        );
        await _settle(tester);
        await _shot(tester, 'setup_chapter_chosen', b);
      });

      testWidgets('chapter practice, picking a chapter', (tester) async {
        await pumpRouted(
          tester,
          location: '/practice/setup/chapter?subject=accountancy',
          routes: _routes(),
          brightness: b,
          overrides: practiceOverrides(quotes: FakeQuoteRepository((s, m, c, p) => creditsQuote(count: c ?? 10))),
        );
        await _settle(tester);
        await tester.tap(find.text('Choose a chapter').first);
        await _settle(tester, ms: 900);
        await _shot(tester, 'chapter_sheet', b);
      });

      testWidgets('Full mock setup', (tester) async {
        await pumpRouted(
          tester,
          location: '/practice/setup/full?subject=accountancy',
          routes: _routes(),
          brightness: b,
          overrides: practiceOverrides(
            quotes: FakeQuoteRepository((s, m, c, p) => creditsQuote(cost: 50, balance: 120, mode: 'full', count: 50)),
          ),
        );
        await _settle(tester);
        await _shot(tester, 'setup_full_mock', b);
      });

      testWidgets('pre-start sheet for a mock', (tester) async {
        await pumpRouted(
          tester,
          location: '/practice/setup/full?subject=accountancy',
          routes: _routes(),
          brightness: b,
          overrides: practiceOverrides(
            quotes: FakeQuoteRepository((s, m, c, p) => creditsQuote(cost: 50, balance: 120, mode: 'full', count: 50)),
          ),
        );
        await _settle(tester);
        await tester.tap(find.text('Start mock'));
        await _settle(tester, ms: 900);
        await _shot(tester, 'mock_sheet', b);
      });

      testWidgets('Pro-gated mode', (tester) async {
        await pumpRouted(
          tester,
          location: '/practice/setup/nta?subject=accountancy',
          routes: _routes(),
          brightness: b,
          overrides: practiceOverrides(quotes: FakeQuoteRepository((s, m, c, p) => proGate())),
        );
        await _settle(tester);
        await _shot(tester, 'setup_pro_gate', b);
      });

      testWidgets('offline', (tester) async {
        await pumpRouted(
          tester,
          location: '/practice/setup/quick?subject=accountancy',
          routes: _routes(),
          brightness: b,
          overrides: practiceOverrides(network: NetworkStatus.offline),
        );
        await _settle(tester);
        await _shot(tester, 'setup_offline', b);
      });

      testWidgets('not enough questions', (tester) async {
        await pumpRouted(
          tester,
          location: '/practice/setup/quick?subject=accountancy',
          routes: _routes(),
          brightness: b,
          overrides: practiceOverrides(
            quotes: FakeQuoteRepository((s, m, c, p) => creditsQuote()),
            starter: FakeStarter(const StartFailed(StartFailure.notEnoughQuestions)),
          ),
        );
        await _settle(tester);
        await tester.tap(find.text('Start practice'));
        await _settle(tester);
        await _shot(tester, 'setup_not_enough_questions', b);
      });

      testWidgets('practice result, mixed', (tester) async {
        await pumpRouted(
          tester,
          location: '/practice/result/p1',
          routes: _routes(),
          brightness: b,
          overrides: resultOverrides(attemptId: 'p1', detail: _detail(_mixed), chapter: 'Admission of a partner'),
        );
        await _settle(tester, ms: 900);
        await _shot(tester, 'result_mixed', b);
      });

      testWidgets('practice result, scrolled to the lists', (tester) async {
        await pumpRouted(
          tester,
          location: '/practice/result/p1',
          routes: _routes(),
          brightness: b,
          overrides: resultOverrides(attemptId: 'p1', detail: _detail(_mixed), chapter: 'Admission of a partner'),
        );
        await _settle(tester, ms: 900);
        await tester.drag(find.byType(Scrollable).first, const Offset(0, -420));
        await _settle(tester, ms: 400);
        await tester.tap(find.text('Question 10, Not attempted'));
        await _settle(tester, ms: 400);
        await _shot(tester, 'result_blank_open', b);
      });

      testWidgets('practice result, nothing wrong', (tester) async {
        final all = [for (var i = 0; i < 10; i++) ('Goodwill', V.right)];
        await pumpRouted(
          tester,
          location: '/practice/result/p1',
          routes: _routes(),
          brightness: b,
          overrides: resultOverrides(attemptId: 'p1', detail: _detail(all), chapter: 'Goodwill'),
        );
        await _settle(tester, ms: 900);
        await _shot(tester, 'result_all_correct', b);
      });

      testWidgets('practice result, answers still loading', (tester) async {
        final cached = Attempt.fromJson(attemptJson(id: 'p1', mode: 'quick', subject: 'accountancy', questions: _mixed));
        await pumpRouted(
          tester,
          location: '/practice/result/p1',
          routes: _routes(),
          brightness: b,
          overrides: resultOverrides(
            attemptId: 'p1',
            loading: true,
            cachedAttempt: cached,
          ),
        );
        await _settle(tester, ms: 900);
        await _shot(tester, 'result_loading_keys', b);
      });

      testWidgets('practice result, load failed', (tester) async {
        await pumpRouted(
          tester,
          location: '/practice/result/p1',
          routes: _routes(),
          brightness: b,
          overrides: resultOverrides(
            attemptId: 'p1',
            error: const ApiError(kind: ApiErrorKind.server, code: 'server_error', status: 500),
          ),
        );
        await _settle(tester);
        await settleImages(tester);
        await _shot(tester, 'result_error', b);
      });
    });
  }

  group('large text', () {
    testWidgets('setup at 200 percent text', (tester) async {
      await pumpRouted(
        tester,
        location: '/practice/setup/chapter?subject=accountancy&chapter=Retirement%20and%20death%20of%20a%20partner',
        routes: _routes(),
        textScale: 2,
        size: const Size(360, 640),
        overrides: practiceOverrides(quotes: FakeQuoteRepository((s, m, c, p) => lowCredits())),
      );
      await _settle(tester);
      expect(tester.takeException(), isNull);
      await _shot(tester, 'setup_text_200', Brightness.light);
    });

    testWidgets('result at 200 percent text', (tester) async {
      await pumpRouted(
        tester,
        location: '/practice/result/p1',
        routes: _routes(),
        textScale: 2,
        size: const Size(360, 640),
        overrides: resultOverrides(attemptId: 'p1', detail: _detail(_mixed), chapter: 'Retirement and death of a partner'),
      );
      await _settle(tester, ms: 900);
      expect(tester.takeException(), isNull);
      await _shot(tester, 'result_text_200', Brightness.light);
    });
  });
}
