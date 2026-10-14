import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/models/practice_quote.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/practice/copy.dart';
import 'package:mockmob/features/practice/data/practice_starter.dart';
import 'package:mockmob/features/practice/model/finish_reaction.dart';
import 'package:mockmob/features/practice/practice_routes.dart';
import 'package:mockmob/features/practice/practice_start_screen.dart';
import 'package:mockmob/features/practice/widgets/choice_deck.dart';
import 'package:mockmob/features/practice/widgets/choice_glyphs.dart';
import 'package:mockmob/features/practice/widgets/composer_ticket.dart';
import 'package:mockmob/features/practice/widgets/finish_ceremony.dart';
import 'package:mockmob/features/practice/widgets/finish_stage.dart';
import 'package:mockmob/core/widgets/widgets.dart' show QuestionCell;
import 'package:mockmob/features/rhythm/rhythm.dart' show CelebrationMode, celebrationModeProvider;

import '../../helpers/fonts.dart';
import 'support/harness.dart';

List<GoRoute> _routes() => [
  GoRoute(path: '/practice/start', builder: (c, s) => practiceStartScreen(c, s)),
  GoRoute(path: '/practice/setup/:mode', builder: (c, s) => practiceSetupScreen(c, s)),
  stubRoute('/run/:sessionId'),
  stubRoute('/learn'),
  stubRoute('/review'),
  stubRoute('/practice'),
];

/// Whether the start screen's own back guard lets back through (its PopScope is the outermost).
bool _startScreenCanPop(WidgetTester tester) {
  final scope = find.descendant(of: find.byType(PracticeStartScreen), matching: find.byWidgetPredicate((w) => w is PopScope));
  return (tester.widget(scope.first) as PopScope).canPop;
}

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 150));
  }
}

/// A deck with one pair, counting each choice's starts.
Widget _deck(Map<String, int> taps) => ProviderScope(
  overrides: [hapticsProvider.overrideWithValue(const Haptics(enabled: false))],
  child: MaterialApp(
  theme: buildTheme(Brightness.dark),
  home: Scaffold(
    body: Padding(
      padding: const EdgeInsets.all(16),
      child: ChoiceDeck(
        animateIn: false,
        rows: [
          ChoiceRow.pair(
            ChoiceOption(id: 'quick', glyph: ChoiceGlyphKind.quick, title: 'Quick 10', note: 'Ten questions', onTap: () => taps.update('quick', (n) => n + 1, ifAbsent: () => 1)),
            ChoiceOption(id: 'mock', glyph: ChoiceGlyphKind.mock, title: 'Full mock', note: 'Fifty questions', onTap: () => taps.update('mock', (n) => n + 1, ifAbsent: () => 1)),
          ),
        ],
      ),
    ),
  ),
  ),
);

/// The finish moment alone, with the Celebrations setting [mode].
Widget _finish({required CelebrationMode mode, required FinishTone tone, bool fresh = true}) => ProviderScope(
  overrides: [
    celebrationModeProvider.overrideWithValue(mode),
    ...practiceOverrides(),
  ],
  child: MaterialApp(
    theme: buildTheme(Brightness.dark),
    home: Scaffold(
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: FinishStage(
          marks: const FinishMarks(correct: 9, wrong: 1, blank: 0, total: 10),
          cells: [for (var i = 0; i < 10; i++) i == 6 ? QuestionCell.wrong : QuestionCell.right],
          tone: tone,
          recordedAt: DateTime(2026, 10, 14, 21, 30),
          fresh: fresh,
          subject: 'Accountancy',
        ),
      ),
    ),
  ),
);

void main() {
  setUpAll(loadAppFonts);

  group('today-01: a choice starts once however fast it is tapped', () {
    testWidgets('a second tap inside the guard is the same intent', (tester) async {
      final taps = <String, int>{};
      await tester.pumpWidget(_deck(taps));
      await tester.tap(find.text('Quick 10'));
      await tester.pump(const Duration(milliseconds: 80));
      await tester.tap(find.text('Quick 10'));
      await tester.pump(const Duration(milliseconds: 80));
      expect(taps['quick'], 1);
      // Once the guard has passed, a new tap is a new start.
      // The guard runs on the wall clock, which a pump does not move.
      await tester.runAsync(() => Future<void>.delayed(ChoiceDeck.tapGuard + const Duration(milliseconds: 100)));
      await tester.tap(find.text('Quick 10'));
      await tester.pump();
      expect(taps['quick'], 2);
    });

    testWidgets('a choice on a page that is no longer on top ignores taps (a sheet leaving or opening)', (tester) async {
      final taps = <String, int>{};
      await tester.pumpWidget(_deck(taps));
      final navigator = tester.state<NavigatorState>(find.byType(Navigator));
      // A route goes over the deck; the deck's own route is not current any more.
      unawaited(navigator.push(PageRouteBuilder<void>(opaque: false, pageBuilder: (_, _, _) => const SizedBox.shrink())));
      await tester.pump();
      await tester.tap(find.text('Full mock'), warnIfMissed: false);
      await tester.pump();
      expect(taps['mock'], isNull);
    });
  });

  group('practice-08: leaving the auto-start while the session is being created', () {
    testWidgets('back is held only while the start request is out, then lets go', (tester) async {
      final starter = FakeStarter()..hold = Completer<void>();
      final router = await pumpRouted(
        tester,
        location: '/practice/start?mode=quick&subject=accountancy&count=10',
        routes: _routes(),
        overrides: practiceOverrides(quotes: FakeQuoteRepository((s, m, c, p) => dailyFree()), starter: starter),
      );
      bool canPop() => _startScreenCanPop(tester);
      await _settle(tester);
      expect(starter.started, hasLength(1));
      // The server is creating the session: back must not drop it on the floor.
      expect(canPop(), isFalse);
      starter.hold!.complete();
      await _settle(tester);
      expect(router.state.uri.path, '/run/sess-1');
    });

    testWidgets('a failed start frees back again', (tester) async {
      final starter = FakeStarter(const StartFailed(StartFailure.generic));
      await pumpRouted(
        tester,
        location: '/practice/start?mode=quick&subject=accountancy&count=10',
        routes: _routes(),
        overrides: practiceOverrides(quotes: FakeQuoteRepository((s, m, c, p) => dailyFree()), starter: starter),
      );
      await _settle(tester);
      expect(_startScreenCanPop(tester), isTrue);
    });
  });

  testWidgets('MOTION P1-7: a start still waiting after 12 s says so in words', (tester) async {
    final quote = Completer<PracticeQuote>();
    await pumpRouted(
      tester,
      location: '/practice/start?mode=quick&subject=accountancy&count=10',
      routes: _routes(),
      overrides: practiceOverrides(quotes: FakeQuoteRepository((s, m, c, p) => quote.future)),
    );
    await _settle(tester);
    expect(find.text(PracticeCopy.gettingReadyNote), findsOneWidget);
    await tester.pump(PracticeStartScreen.slowAfter);
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text(PracticeCopy.gettingReadySlow), findsOneWidget);
    quote.complete(dailyFree());
    await _settle(tester);
  });

  testWidgets('practice-09: a default subject that settles late keeps the length the student set', (tester) async {
    // Attempts never load (null): the setup page follows the default subject and has not settled.
    await pumpRouted(
      tester,
      location: '/practice/setup/quick',
      routes: _routes(),
      overrides: practiceOverrides(quotes: FakeQuoteRepository((s, m, c, p) => dailyFree()), attempts: null),
    );
    await _settle(tester);
    await tester.tap(find.bySemanticsLabel('20 questions'));
    await _settle(tester);
    expect(tester.widget<ComposerTicket>(find.byType(ComposerTicket)).count, 20);
    await tester.tap(find.text('English').first);
    await _settle(tester);
    final ticket = tester.widget<ComposerTicket>(find.byType(ComposerTicket));
    expect(ticket.subject, 'English');
    expect(ticket.count, 20);
  });

  group('MOTION P0-5 and P0-6: the practice finish is a T2 moment and reads Celebrations', () {
    test('the burst is 14 pieces and the stamp settles inside 420 ms', () {
      expect(StampPainter.pieces, 14);
      expect(FinishCeremony.figureScale(FinishCeremony.settleEnd), 1);
      expect(FinishCeremony.stampDuration.inMilliseconds * FinishCeremony.settleEnd, closeTo(420, 1));
      // The whole moment for ten questions: 200 in place, 400 of ink, then the stamp.
      expect(FinishStage.durationFor(10) + FinishCeremony.stampDuration, lessThanOrEqualTo(const Duration(milliseconds: 1500)));
    });

    testWidgets('Full: a great set gets the ring and the burst', (tester) async {
      await tester.pumpWidget(_finish(mode: CelebrationMode.full, tone: FinishTone.great));
      await tester.pump();
      expect(tester.widget<StampedFigure>(find.byType(StampedFigure)).burst, isTrue);
      await tester.pump(const Duration(seconds: 3));
    });

    testWidgets('Quiet: the stamp alone, no ring or shards', (tester) async {
      await tester.pumpWidget(_finish(mode: CelebrationMode.quiet, tone: FinishTone.great));
      await tester.pump();
      expect(tester.widget<StampedFigure>(find.byType(StampedFigure)).burst, isFalse);
      await tester.pump(const Duration(seconds: 3));
    });

    testWidgets('A mixed set never bursts, even on Full', (tester) async {
      await tester.pumpWidget(_finish(mode: CelebrationMode.full, tone: FinishTone.mixed));
      await tester.pump();
      expect(tester.widget<StampedFigure>(find.byType(StampedFigure)).burst, isFalse);
      await tester.pump(const Duration(seconds: 3));
    });

    testWidgets('Off: words only, the end state at once', (tester) async {
      await tester.pumpWidget(_finish(mode: CelebrationMode.off, tone: FinishTone.great));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      // The figure shows the final count with no ink to wait for, and the counts line is there.
      expect(find.text(PracticeCopy.countsLine(9, 1, 0)), findsOneWidget);
      expect(tester.widget<StampedFigure>(find.byType(StampedFigure)).stamp.value, 0);
      await tester.pump(const Duration(seconds: 3));
    });
  });
}
