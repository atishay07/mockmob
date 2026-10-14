import 'dart:async';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart' show ByteData, FontLoader;
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/api/api.dart';
import 'package:mockmob/core/connectivity/connectivity.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/models/practice_quote.dart';
import 'package:mockmob/features/practice/data/practice_starter.dart';
import 'package:mockmob/features/practice/practice_routes.dart';
import 'package:mockmob/features/runner/runner_routes.dart' show ntaInstructionsScreen;

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart' show settleImages;
import '../../unit/core_data/support/fixtures.dart';
import '../../unit/learn/support/learn_fixtures.dart';
import '../../unit/practice/support/harness.dart';

/// The Night Sheet frame: 384 by 853 logical px at DPR 2.
const Size _size = Size(384, 853);

List<GoRoute> _routes() => [
  GoRoute(path: '/practice', builder: (c, s) => practiceScreen(c, s)),
  GoRoute(path: '/practice/setup/:mode', builder: (c, s) => practiceSetupScreen(c, s)),
  GoRoute(path: '/practice/start', builder: (c, s) => practiceStartScreen(c, s)),
  GoRoute(path: '/practice/result/:attemptId', builder: (c, s) => practiceResultScreen(c, s)),
  GoRoute(path: '/exam/nta', builder: (c, s) => ntaInstructionsScreen(c, s)),
  stubRoute('/run/:sessionId'),
  stubRoute('/today'),
];

FakeQuoteRepository _tabQuotes() => FakeQuoteRepository((s, m, c, p) {
  if (m == 'full') return creditsQuote(cost: 50, balance: 120, mode: 'full', count: 50);
  if (m == 'nta') return proGate();
  return dailyFree(count: c ?? 10);
});

final DateTime _evening = DateTime(2026, 10, 12, 20, 10);

Attempt _mock() => attemptOf(
  id: 'm7',
  completedAt: _evening.subtract(const Duration(days: 1)).millisecondsSinceEpoch,
  questions: [
    ...chapterOf('Admission of a partner', right: 2, wrong: 3, blank: 1),
    ...chapterOf('Goodwill', right: 5, wrong: 1),
    ...chapterOf('Issue of shares', right: 6),
  ],
);

AttemptDetail _detail(List<(String, V)> questions, {Map<String, dynamic>? reviews}) => AttemptDetail.fromJson({
  ...attemptJson(id: 'p1', mode: 'quick', subject: 'accountancy', questions: questions),
  'answerReviews': reviews ?? <String, dynamic>{},
  'answerReviewState': 'ready',
});

final _mixed = [
  for (var i = 0; i < 7; i++) ('Admission of a partner', V.right),
  ('Admission of a partner', V.wrong),
  ('Goodwill', V.wrong),
  ('Admission of a partner', V.blank),
];

Future<void> _settle(WidgetTester tester, {int ms = 900}) async {
  for (var i = 0; i < 6; i++) {
    await tester.pump(Duration(milliseconds: ms ~/ 6));
  }
  await settleImages(tester);
}

/// Mobi's line types in after the reaction; wait it out so the golden shows the whole sentence.
Future<void> _typed(WidgetTester tester) async {
  for (var i = 0; i < 12; i++) {
    await tester.pump(const Duration(milliseconds: 250));
  }
}

Future<void> _shot(WidgetTester tester, String name, Brightness b) async {
  final tag = b == Brightness.dark ? 'night' : 'day';
  await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/${name}_$tag.png'));
  final dir = Platform.environment['MM_PREVIEW_DIR'];
  if (dir == null || dir.isEmpty) return;
  final boundary = previewBoundary.currentContext!.findRenderObject()! as RenderRepaintBoundary;
  await tester.runAsync(() async {
    final image = await boundary.toImage(pixelRatio: 2);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();
    await File('$dir/practice_${name}_$tag.png').writeAsBytes(bytes!.buffer.asUint8List());
  });
}

Future<void> _pump(WidgetTester tester, String location, Brightness b, List<Override> overrides, {Size size = _size, double textScale = 1}) =>
    pumpRouted(tester, location: location, routes: _routes(), brightness: b, size: size, overrides: overrides, textScale: textScale);

/// Opens a sheet from the tab and lets it rise and its quote arrive.
Future<void> _open(WidgetTester tester, String label) async {
  // The modes can sit below the fold on a short phone, and the list builds rows lazily: scroll the
  // page to them (the first scrollable is the page, not the tile strip).
  await tester.scrollUntilVisible(find.text(label), 200, scrollable: find.byType(Scrollable).first);
  await tester.pump();
  await tester.tap(find.text(label).first);
  await _settle(tester);
}

/// The NTA exam skin asks for Arial (Roboto on a phone, which has no Arial). The test machine has
/// neither, so the golden would draw the exam headline as solid blocks; give it Hanken, the
/// nearest bundled face, so the screen is judged on layout and words.
Future<void> _loadExamFace() async {
  final loader = FontLoader('Arial');
  for (final f in ['Regular', 'Bold']) {
    final bytes = await File('assets/fonts/HankenGrotesk-$f.ttf').readAsBytes();
    loader.addFont(Future.value(ByteData.sublistView(bytes)));
  }
  await loader.load();
}

void main() {
  setUpAll(() async {
    await loadAppFonts();
    await _loadExamFace();
  });

  for (final b in [Brightness.dark, Brightness.light]) {
    group('practice, ${b.name}', () {
      testWidgets('tab, a new student, evening', (tester) async {
        await _pump(tester, '/practice', b, practiceOverrides(quotes: _tabQuotes(), attempts: const [], now: _evening));
        await _settle(tester);
        await _shot(tester, 'tab_new', b);
      });

      testWidgets('tab, the chapter from the last mock, late at night', (tester) async {
        await _pump(tester, '/practice', b, practiceOverrides(quotes: _tabQuotes(), attempts: [_mock()]));
        await _settle(tester);
        await _shot(tester, 'tab_chapter_late', b);
      });

      testWidgets('tab, scrolled to choose your own and the concepts shelf', (tester) async {
        await _pump(tester, '/practice', b, practiceOverrides(quotes: _tabQuotes(), attempts: [_mock()], learn: catalog(due: 4), now: _evening));
        await _settle(tester);
        await tester.drag(find.byType(Scrollable).first, const Offset(0, -560));
        await _settle(tester, ms: 600);
        await _shot(tester, 'tab_choose_concepts', b);
      });

      testWidgets('tab, a mock still running', (tester) async {
        final endsAt = testNow.add(const Duration(minutes: 47)).millisecondsSinceEpoch;
        final draft = draftOf(sessionId: 'sess-7', count: 50, mode: 'full', endsAtWallMs: endsAt, mockNumber: 7, subject: 'economics');
        await _pump(tester, '/practice', b, practiceOverrides(quotes: _tabQuotes(), draft: draft, answered: 23));
        await _settle(tester);
        await _shot(tester, 'tab_resume', b);
      });

      testWidgets('tab offline', (tester) async {
        await _pump(tester, '/practice', b, practiceOverrides(quotes: _tabQuotes(), attempts: const [], network: NetworkStatus.offline, now: _evening, auth: signedIn(subjects: const ['english', 'accountancy'])));
        await _settle(tester);
        await _shot(tester, 'tab_offline', b);
      });

      testWidgets('confirm, quick practice free today', (tester) async {
        await _pump(tester, '/practice', b, practiceOverrides(quotes: _tabQuotes(), attempts: const [], now: _evening));
        await _settle(tester);
        await _open(tester, 'Quick practice');
        await _shot(tester, 'confirm_quick_free', b);
      });

      testWidgets('confirm on a 360 by 640 phone at 1.3x text: Start and Not now pinned in the footer', (tester) async {
        await _pump(tester, '/practice', b, practiceOverrides(quotes: _tabQuotes(), attempts: const [], now: _evening), size: const Size(360, 640), textScale: 1.3);
        await _settle(tester);
        await _open(tester, 'Quick practice');
        await _shot(tester, 'confirm_quick_small_large_text', b);
      });

      testWidgets('confirm, a long subject name on the ticket at 1.3x on a 360 by 640 phone', (tester) async {
        await _pump(
          tester,
          '/practice/setup/quick?subject=political_science&count=20',
          b,
          practiceOverrides(quotes: _tabQuotes(), attempts: const [], now: _evening),
          size: const Size(360, 640),
          textScale: 1.3,
        );
        await _settle(tester);
        await _shot(tester, 'setup_long_subject_large_text', b);
      });

      testWidgets('confirm, a link asked for a length the mode does not offer', (tester) async {
        final quotes = FakeQuoteRepository((s, m, c, p) => creditsQuote(cost: 10, balance: 90, count: c ?? 10, mode: m));
        await _pump(tester, '/practice/setup/smart?subject=accountancy&count=5', b, practiceOverrides(quotes: quotes));
        await _settle(tester);
        await _shot(tester, 'setup_length_changed', b);
      });

      testWidgets('confirm, chapter practice with credits', (tester) async {
        final quotes = FakeQuoteRepository((s, m, c, p) => creditsQuote(cost: 10, balance: 90, count: c ?? 10));
        await _pump(tester, '/practice', b, practiceOverrides(quotes: quotes, attempts: [_mock()], now: _evening));
        await _settle(tester);
        await _open(tester, 'Start');
        await _shot(tester, 'confirm_chapter_credits', b);
      });

      testWidgets('confirm, full mock', (tester) async {
        await _pump(tester, '/practice', b, practiceOverrides(quotes: _tabQuotes(), attempts: const [], now: _evening));
        await _settle(tester);
        await _open(tester, 'Full mock');
        await _shot(tester, 'confirm_mock', b);
      });

      testWidgets('NTA mode opens its instructions, which say it comes with Pro', (tester) async {
        await _pump(tester, '/practice', b, practiceOverrides(quotes: _tabQuotes(), attempts: const [], now: _evening));
        await _settle(tester);
        await _open(tester, 'NTA mode');
        await _shot(tester, 'nta_instructions_pro', b);
      });

      testWidgets('confirm, credits low', (tester) async {
        final quotes = FakeQuoteRepository((s, m, c, p) => c == 10 ? dailyFree() : lowCredits());
        await _pump(tester, '/practice/setup/quick?subject=accountancy&count=15', b, practiceOverrides(quotes: quotes, learn: catalog(due: 2)));
        await _settle(tester);
        await _shot(tester, 'setup_credits_low', b);
      });

      testWidgets('confirm, the quote failed', (tester) async {
        final quotes = FakeQuoteRepository((s, m, c, p) => throw const ApiError(kind: ApiErrorKind.server, code: 'server_error'));
        await _pump(tester, '/practice/setup/quick?subject=economics', b, practiceOverrides(quotes: quotes));
        await _settle(tester);
        await _shot(tester, 'setup_quote_failed', b);
      });

      testWidgets('confirm, still checking', (tester) async {
        final gate = Completer<PracticeQuote>();
        await _pump(tester, '/practice/setup/chapter?subject=english&chapter=Reading%20comprehension', b, practiceOverrides(quotes: FakeQuoteRepository((s, m, c, p) => gate.future)));
        await _settle(tester);
        await _shot(tester, 'setup_checking', b);
        gate.complete(dailyFree());
        await tester.pump();
      });

      testWidgets('confirm, offline, with a start failure', (tester) async {
        await _pump(tester, '/practice/setup/quick?subject=accountancy', b, practiceOverrides(network: NetworkStatus.offline));
        await _settle(tester);
        await _shot(tester, 'setup_offline', b);
      });

      testWidgets('confirm, not enough questions after Start', (tester) async {
        final starter = FakeStarter(const StartFailed(StartFailure.notEnoughQuestions));
        await _pump(tester, '/practice/setup/quick?subject=accountancy', b, practiceOverrides(quotes: FakeQuoteRepository((s, m, c, p) => creditsQuote()), starter: starter));
        await _settle(tester);
        await tester.ensureVisible(find.text('Start practice'));
        await tester.tap(find.text('Start practice'));
        await _settle(tester, ms: 400);
        await _shot(tester, 'setup_start_failed', b);
      });

      testWidgets('chapter picker', (tester) async {
        await _pump(tester, '/practice', b, practiceOverrides(quotes: _tabQuotes(), attempts: const [], now: _evening));
        await _settle(tester);
        await _open(tester, 'By chapter');
        await _shot(tester, 'chapter_picker', b);
      });

      testWidgets('getting the questions ready', (tester) async {
        final starter = FakeStarter()..hold = Completer<void>();
        await _pump(tester, '/practice/start?mode=quick&subject=accountancy&count=10', b, practiceOverrides(quotes: FakeQuoteRepository((s, m, c, p) => dailyFree()), starter: starter));
        await _settle(tester, ms: 700);
        await _shot(tester, 'start_ready', b);
        starter.hold!.complete();
        await tester.pump();
      });

      testWidgets('result, mixed', (tester) async {
        await _pump(tester, '/practice/result/p1', b, resultOverrides(attemptId: 'p1', detail: _detail(_mixed), chapter: 'Admission of a partner'));
        await _settle(tester);
        await _typed(tester);
        await _shot(tester, 'result_mixed', b);
      });

      testWidgets('result, all correct', (tester) async {
        await _pump(tester, '/practice/result/p1', b, resultOverrides(attemptId: 'p1', detail: _detail([for (var i = 0; i < 10; i++) ('Goodwill', V.right)])));
        await _settle(tester);
        await _typed(tester);
        await _shot(tester, 'result_all_correct', b);
      });

      testWidgets('result, answers failed to load', (tester) async {
        final cached = attemptOf(id: 'p1', mode: 'quick', questions: _mixed);
        await _pump(tester, '/practice/result/p1', b, resultOverrides(attemptId: 'p1', cachedAttempt: cached, error: const ApiError(kind: ApiErrorKind.server, code: 'server_error')));
        await _settle(tester);
        await _typed(tester);
        await _shot(tester, 'result_keys_failed', b);
      });

      testWidgets('result, loading', (tester) async {
        await _pump(tester, '/practice/result/p1', b, resultOverrides(attemptId: 'p1', loading: true));
        await _settle(tester, ms: 300);
        await _shot(tester, 'result_loading', b);
      });

      testWidgets('getting the questions ready, offline: starts by itself when back', (tester) async {
        await _pump(tester, '/practice/start?mode=quick&subject=accountancy&count=10', b, practiceOverrides(network: NetworkStatus.offline));
        await _settle(tester, ms: 700);
        await _shot(tester, 'start_offline', b);
      });

      testWidgets('result, offline with nothing cached', (tester) async {
        await _pump(tester, '/practice/result/p1', b, resultOverrides(attemptId: 'p1', error: const ApiError(kind: ApiErrorKind.network, code: 'network')));
        await _settle(tester);
        await _shot(tester, 'result_offline', b);
      });
    });
  }
}
