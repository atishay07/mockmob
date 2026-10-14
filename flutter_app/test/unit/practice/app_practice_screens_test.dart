// Phase 2, the Practice packet, on whole screens: the resume card's count follows the live draft
// like the capsule does (FINDINGS 28), the start screen's three stages and its held nod, the
// pull that asks everything again (and says so when it cannot), the chapter cap's shake, and the
// finish figure's gentle stamp and long press.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/api/api.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/mascot/mascot.dart' show MobiRation;
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/core/repositories/session_draft_repository.dart';
import 'package:mockmob/core/router/quick_start.dart' show resumeOfferProvider;
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/question_strip.dart' show QuestionCell;
import 'package:mockmob/features/practice/copy.dart';
import 'package:mockmob/features/practice/model/finish_reaction.dart';
import 'package:mockmob/features/practice/practice_routes.dart';
import 'package:mockmob/features/practice/practice_screen.dart' show PracticeScreen;
import 'package:mockmob/features/practice/widgets/chapter_picker.dart';
import 'package:mockmob/features/practice/widgets/finish_stage.dart';
import 'package:mockmob/features/practice/widgets/numbered_sheet.dart';
import 'package:mockmob/features/practice/widgets/suggestion_hero.dart' show draftSummaryProvider;

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart' show FileAssetBundle;
import '../core_data/support/fixtures.dart';
import 'support/harness.dart';

class _Recorder implements HapticDriver {
  final List<String> calls = [];

  @override
  Future<void> lightImpact() async => calls.add('light');

  @override
  Future<void> mediumImpact() async => calls.add('medium');

  @override
  Future<void> selectionClick() async => calls.add('selection');
}

/// A draft repository whose stored rows are empty (as the demo's in-memory drafts are) and whose
/// counts are whatever [answered] says: the card must read the live draft, not the stored one.
class _FakeDrafts implements SessionDraftRepository {
  _FakeDrafts(this.answered);

  int Function() answered;

  @override
  Future<SessionDraft?> bySessionId(String sessionId) async => null;

  @override
  Future<DraftSummary> summaryOf(SessionDraft draft) async =>
      DraftSummary(answered: answered(), acknowledgedAnswered: answered(), total: draft.view.questions.length);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _ManyChapters extends FakeCatalog {
  @override
  Future<ChapterCatalog> chapters(String subjectId) async => ChapterCatalog(
    units: [
      ChapterUnit(id: 'u', name: '', chapters: [for (var i = 1; i <= 13; i++) ChapterEntry(id: 'c$i', name: 'Chapter $i')]),
    ],
  );
}

List<GoRoute> _routes() => [
  GoRoute(path: '/practice', builder: (c, s) => practiceScreen(c, s)),
  GoRoute(path: '/practice/start', builder: (c, s) => practiceStartScreen(c, s)),
  stubRoute('/practice/setup/:mode'),
  stubRoute('/practice/result/:attemptId'),
  stubRoute('/result/:attemptId'),
  stubRoute('/run/:sessionId'),
  stubRoute('/learn'),
  stubRoute('/learn/:unitId'),
  stubRoute('/review'),
];

Future<void> _pull(WidgetTester tester) async {
  final gesture = await tester.startGesture(const Offset(192, 300));
  for (var i = 0; i < 14; i++) {
    await gesture.moveBy(const Offset(0, 12));
    await tester.pump(const Duration(milliseconds: 16));
  }
  await gesture.up();
  await tester.pump();
  await tester.pump(const Duration(seconds: 1));
}

void main() {
  setUpAll(loadAppFonts);
  setUp(MobiRation.reset);

  group('the resume card counts like the capsule (FINDINGS 28)', () {
    test('its figure follows the live draft, even when the stored row cannot be found', () async {
      var answers = 0;
      final live = StreamController<SessionDraft?>();
      addTearDown(live.close);
      final container = ProviderContainer(
        overrides: [
          latestSessionDraftProvider.overrideWith((ref) => live.stream),
          sessionDraftRepositoryProvider.overrideWithValue(_FakeDrafts(() => answers)),
          nowProvider.overrideWithValue(() => DateTime(2026, 10, 12, 23)),
        ],
      );
      addTearDown(container.dispose);
      final sub = container.listen(draftSummaryProvider('sess-1'), (_, _) {});
      addTearDown(sub.close);
      // The bar's Resume capsule reads the same draft through its own provider.
      final capsule = container.listen(resumeOfferProvider, (_, _) {});
      addTearDown(capsule.close);
      final endsAt = DateTime(2026, 10, 12, 23, 30).millisecondsSinceEpoch;
      SessionDraft draft() => draftOf(sessionId: 'sess-1', count: 10, mode: 'quick', endsAtWallMs: endsAt, mockNumber: null);

      // The paper opens with nothing answered: the card says 0 of 10.
      live.add(draft());
      await pumpEventQueue();
      expect(sub.read().value?.answered, 0);
      expect(sub.read().value?.total, 10);
      expect(capsule.read().value?.answered, 0);

      // All ten answered, the paper is left and its draft is written again: the card follows at
      // once, the way the capsule does, and does not keep what it read while the paper was opening.
      answers = 10;
      live.add(draft());
      await pumpEventQueue();
      expect(sub.read().value?.answered, 10);
      expect(capsule.read().value?.answered, sub.read().value?.answered, reason: 'the card and the capsule say the same number');
    });
  });

  group('the start screen', () {
    Future<(GoRouter, FakeStarter)> openStart(WidgetTester tester) async {
      final starter = FakeStarter()..hold = Completer<void>();
      final router = await pumpRouted(
        tester,
        location: '/practice/start?mode=quick&subject=accountancy&count=10',
        routes: _routes(),
        overrides: practiceOverrides(quotes: FakeQuoteRepository((s, m, c, p) => dailyFree(count: c ?? 10)), starter: starter),
      );
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 500));
      return (router, starter);
    }

    testWidgets('the three stages tick as the work really moves, and the paper opens a beat after the server says yes', (tester) async {
      final handle = tester.ensureSemantics();
      final (router, starter) = await openStart(tester);
      // The start request is out and waiting: the cost is checked, the questions are being drawn.
      expect(starter.started, hasLength(1));
      // The stage rows are one live region for TalkBack; each row names its state in it.
      expect(find.bySemanticsLabel(RegExp('Checking the cost, done')), findsOneWidget);
      expect(find.bySemanticsLabel(RegExp('Drawing your questions(?!, done)')), findsOneWidget);
      expect(find.bySemanticsLabel(RegExp('Opening your paper(?!, done)')), findsOneWidget);
      expect(router.state.uri.path, '/practice/start', reason: 'nothing opens before the server answers');

      starter.hold!.complete();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 260));
      expect(find.bySemanticsLabel(RegExp('Drawing your questions, done')), findsOneWidget);
      expect(find.bySemanticsLabel(RegExp('Opening your paper, done')), findsOneWidget);
      expect(router.state.uri.path, '/practice/start', reason: 'the nod is held for a beat');
      await tester.pump(const Duration(milliseconds: 300));
      expect(router.state.uri.path, '/run/sess-1');
      handle.dispose();
    });

    testWidgets('under reduced motion the paper opens at once, with no beat to wait for', (tester) async {
      tester.platformDispatcher.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(disableAnimations: true);
      addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
      final (router, starter) = await openStart(tester);
      starter.hold!.complete();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      expect(router.state.uri.path, '/run/sess-1');
    });
  });

  group('the pull on the Practice tab', () {
    testWidgets('asks the three quotes again; when none can be read it says so with a Retry, and the page stays', (tester) async {
      var fail = false;
      final quotes = FakeQuoteRepository((s, m, c, p) {
        if (fail) throw const ApiError(kind: ApiErrorKind.server, code: 'server_error');
        return dailyFree(count: c ?? 10);
      });
      await pumpRouted(tester, location: '/practice', routes: _routes(), overrides: practiceOverrides(quotes: quotes, attempts: const []));
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 600));
      final before = quotes.calls.length;
      expect(find.text(PracticeCopy.refreshFailed), findsNothing);

      await _pull(tester);
      expect(quotes.calls.length - before, 3, reason: 'full, exam day and smart are asked again');
      expect(find.text(PracticeCopy.refreshFailed), findsNothing);

      fail = true;
      await _pull(tester);
      // A failing read is tried again in the background and never completes; the pull stops
      // waiting after its bound and says so.
      await tester.pump(PracticeScreen.refreshTimeout);
      await tester.pump(const Duration(seconds: 1));
      expect(find.text(PracticeCopy.refreshFailed), findsOneWidget);
      expect(find.text(PracticeCopy.retry), findsOneWidget);
      expect(find.text(PracticeCopy.chooseOwn), findsOneWidget, reason: 'what was on screen stays');

      fail = false;
      await tester.tap(find.text(PracticeCopy.retry));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(find.text(PracticeCopy.refreshFailed), findsNothing);
      // Nothing is left running for the next test.
      await tester.pumpAndSettle(const Duration(milliseconds: 100), EnginePhase.sendSemanticsUpdate, const Duration(seconds: 30));
    });
  });

  group('the chapter cap', () {
    testWidgets('a tap past twelve adds nothing, and the limit line shakes with the refusal haptic', (tester) async {
      tester.view.physicalSize = const Size(384, 1400) * 2;
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      final haptics = _Recorder();
      final chosen = ValueNotifier<List<String>>([for (var i = 1; i <= 12; i++) 'Chapter $i']);
      addTearDown(chosen.dispose);
      final multi = ValueNotifier<bool>(true);
      addTearDown(multi.dispose);
      await tester.pumpWidget(
        ProviderScope(
          overrides: practiceOverrides(catalog: _ManyChapters()),
          // The recording haptics sit in the inner scope, over the harness's silent ones.
          child: ProviderScope(
            overrides: [hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: haptics))],
            child: DefaultAssetBundle(
              bundle: FileAssetBundle(),
              child: MaterialApp(
                theme: buildTheme(Brightness.dark),
                home: Scaffold(
                  body: SingleChildScrollView(
                    child: ChapterList(subjectId: 'accountancy', chosen: chosen, multi: multi, onSingle: (_) {}),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('Chapter 13'), findsOneWidget);

      await tester.tap(find.text('Chapter 13'));
      await tester.pump(const Duration(milliseconds: 60));
      expect(chosen.value, hasLength(12));
      expect(chosen.value, isNot(contains('Chapter 13')));
      expect(tester.hasRunningAnimations, isTrue, reason: 'the line that says why is shaking');
      await tester.pump(const Duration(milliseconds: 400));
      expect(haptics.calls, ['light', 'light'], reason: 'the kit\'s refusal haptic, once');
      expect(tester.hasRunningAnimations, isFalse);

      // A chapter already chosen still comes off, and then a new one goes on.
      await tester.tap(find.text('Chapter 1'));
      await tester.pump();
      expect(chosen.value, hasLength(11));
      await tester.tap(find.text('Chapter 13'));
      await tester.pump();
      expect(chosen.value, contains('Chapter 13'));
    });
  });

  group('the finish figure', () {
    Future<_Recorder> pumpFinish(
      WidgetTester tester, {
      bool reduced = false,
      VoidCallback? onReplay,
      FinishTone tone = FinishTone.mixed,
    }) async {
      tester.view.physicalSize = const Size(384, 1400) * 2;
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      final haptics = _Recorder();
      const cells = [QuestionCell.right, QuestionCell.wrong, QuestionCell.blank, QuestionCell.right];
      await tester.pumpWidget(
        ProviderScope(
          overrides: practiceOverrides(),
          child: ProviderScope(
            overrides: [hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: haptics))],
            child: DefaultAssetBundle(
              bundle: FileAssetBundle(),
              child: MaterialApp(
                theme: buildTheme(Brightness.dark),
                builder: (context, child) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: reduced), child: child!),
                home: Scaffold(
                  body: SafeArea(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.all(16),
                      child: FinishStage(
                        marks: const FinishMarks(correct: 2, wrong: 1, blank: 1, total: 4),
                        cells: cells,
                        tone: tone,
                        recordedAt: DateTime(2026, 10, 12, 23, 51),
                        // A result opened again: the moment is at its end, the figure can be touched.
                        fresh: false,
                        subject: 'Accountancy',
                        chapter: 'Goodwill',
                        onStampReplay: onReplay,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));
      return haptics;
    }

    testWidgets('a tap on the settled figure stamps it again, gently, with a light haptic', (tester) async {
      var replays = 0;
      final haptics = await pumpFinish(tester, onReplay: () => replays++);
      await tester.tap(find.byKey(const ValueKey('finish-figure')));
      await tester.pump(const Duration(milliseconds: 100));
      expect(replays, 1);
      expect(haptics.calls, contains('light'));
      await tester.pump(const Duration(seconds: 2));
      expect(tester.takeException(), isNull);
      // And again, once it has finished.
      await tester.tap(find.byKey(const ValueKey('finish-figure')));
      await tester.pump();
      expect(replays, 2);
    });

    testWidgets('under reduced motion the settled figure holds still', (tester) async {
      var replays = 0;
      await pumpFinish(tester, reduced: true, onReplay: () => replays++);
      await tester.tap(find.byKey(const ValueKey('finish-figure')));
      await tester.pump(const Duration(milliseconds: 100));
      expect(replays, 0);
    });

    testWidgets('a long press on a bubble has Mobi point at it and say what it was', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpFinish(tester);
      // The sheet's second bubble is the wrong one.
      final box = tester.getRect(find.byType(NumberedSheet));
      final g = NumberedSheet.geometry(4, box.width);
      await tester.longPressAt(Offset(box.left + g.left + 1 * (g.cell + g.gap) + g.cell / 2, box.top + g.cell / 2));
      await tester.pump(const Duration(seconds: 3));
      expect(find.bySemanticsLabel(PracticeCopy.cellSays(2, QuestionCell.wrong)), findsWidgets);
      await tester.pump(const Duration(seconds: 5));
      handle.dispose();
    });
  });
}
