import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/art/art.dart' show SubjectEmblem;
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/motion/motion.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/review/data/mistake_index.dart';
import 'package:mockmob/features/review/data/repair_state.dart';
import 'package:mockmob/features/review/data/review_providers.dart';
import 'package:mockmob/features/review/screens/repair_ending_screen.dart';
import 'package:mockmob/features/review/screens/repair_screen.dart';
import 'package:mockmob/features/review/screens/review_screen.dart';
import 'package:mockmob/features/review/widgets/review_rows.dart';
import 'package:mockmob/features/review/widgets/tonight_card.dart';

import '../../golden/review/review_golden_support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/review_fixtures.dart';

class _Driver implements HapticDriver {
  int selection = 0;
  int light = 0;
  int medium = 0;

  @override
  Future<void> selectionClick() async => selection++;

  @override
  Future<void> lightImpact() async => light++;

  @override
  Future<void> mediumImpact() async => medium++;
}

void main() {
  setUpAll(loadAppFonts);

  group('the student clock', () {
    ReviewClock at(int utcHour, int utcMinute) => ReviewClock('Asia/Kolkata', () => DateTime.utc(2026, 10, 12, utcHour, utcMinute));

    test('late night is 11 PM to 5 AM in the student zone, through the shared window', () {
      // Kolkata is UTC+5:30: 17:29 UTC is 10:59 PM, 17:30 UTC is 11:00 PM.
      expect(at(17, 29).isLateNight, isFalse);
      expect(at(17, 30).isLateNight, isTrue);
      // 23:29 UTC is 4:59 AM, 23:30 UTC is 5:00 AM.
      expect(at(23, 29).isLateNight, isTrue);
      expect(at(23, 30).isLateNight, isFalse);
    });
  });

  group('the hero art', () {
    testWidgets('the tab shows the subject emblem once, at 136, settling in and then still', (tester) async {
      await pumpMockmob(
        tester,
        const ReviewScreen(),
        size: const Size(384, 2400),
        disableAnimations: true,
        wrapInScaffold: false,
        overrides: reviewOverrides(records: [repairedRecord]),
      );
      final emblems = tester.widgetList<SubjectEmblem>(find.byType(SubjectEmblem)).toList();
      final hero = emblems.where((e) => e.size == 136);
      expect(hero, hasLength(1), reason: 'one object in the hero, drawn at 136 inside its 156 box');
      expect(hero.single.animate, isFalse, reason: 'it glides in once and does not loop on a resting screen');
      expect(find.byType(ArtImage), findsNothing, reason: 'the raster object is gone from the hero');
    });

    testWidgets('the repair entry carries the same emblem at 136, and no Mobi', (tester) async {
      await pumpMockmob(
        tester,
        const RepairScreen(attemptId: 'm7', questionId: 'm7-q0'),
        size: const Size(384, 853),
        disableAnimations: true,
        wrapInScaffold: false,
        overrides: reviewOverrides(run: runOf(phase: RepairPhase.entry)),
      );
      final emblem = tester.widget<SubjectEmblem>(find.byType(SubjectEmblem));
      expect(emblem.size, 136);
      expect(emblem.animate, isFalse);
      expect(find.byType(ArtImage), findsNothing);
      expect(find.byType(MobiCharacter), findsNothing);
      expect(find.byType(Mobi), findsNothing, reason: 'a moment with an object has no second character');
    });
  });

  group('the tab arrives', () {
    testWidgets('the hero fades in on first show and is fully there after the stagger', (tester) async {
      await pumpMockmob(
        tester,
        const ReviewScreen(),
        size: const Size(384, 2400),
        wrapInScaffold: false,
        overrides: reviewOverrides(records: [repairedRecord]),
      );
      // pumpMockmob has already let the first frames run; build a fresh tab and look at frame one.
      await tester.pumpWidget(const SizedBox());
      await pumpMockmob(
        tester,
        const ReviewScreen(),
        size: const Size(384, 2400),
        wrapInScaffold: false,
        overrides: reviewOverrides(records: [repairedRecord]),
      );
      final fade = find.ancestor(of: find.byType(TonightCard), matching: find.byType(FadeTransition)).first;
      await tester.pump(const Duration(seconds: 2));
      expect(tester.widget<FadeTransition>(fade).opacity.value, 1);
    });

    testWidgets('reduced motion shows the hero at once', (tester) async {
      await pumpMockmob(
        tester,
        const ReviewScreen(),
        size: const Size(384, 2400),
        disableAnimations: true,
        wrapInScaffold: false,
        overrides: reviewOverrides(records: [repairedRecord]),
      );
      final fade = find.ancestor(of: find.byType(TonightCard), matching: find.byType(FadeTransition)).first;
      expect(tester.widget<FadeTransition>(fade).opacity.value, 1);
    });

    testWidgets('while the attempts load, the tab shows the hero and row skeletons, not an empty page', (tester) async {
      await pumpMockmob(
        tester,
        const ReviewScreen(),
        size: const Size(384, 853),
        disableAnimations: true,
        wrapInScaffold: false,
        overrides: reviewOverrides(attemptsState: const RemoteState(loading: true)),
      );
      expect(find.byType(Skeleton), findsWidgets);
      expect(find.byType(MmSkeletonRows), findsOneWidget);
      expect(find.byType(TonightCard), findsNothing);
    });
  });

  group('the feel', () {
    testWidgets("tonight's number lands with one selection tick", (tester) async {
      final driver = _Driver();
      final pick = buildReviewIndex(allAttempts, const []).tonight!;
      await pumpMockmob(
        tester,
        SingleChildScrollView(
          child: TonightCard(pick: pick, now: DateTime(2026, 10, 12, 21), onRepair: () {}, onShowMe: () {}),
        ),
        size: const Size(384, 1200),
        overrides: [...reviewOverrides(), hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: driver))],
      );
      // The harness has already played the entrance and the roll (delay and all).
      await tester.pump(Motion.enterDuration + Motion.numberRoll);
      expect(driver.selection, 1);
      await tester.pump(const Duration(seconds: 2));
      expect(driver.selection, 1, reason: 'one tick for one landing');
    });

    testWidgets('a past result row gives a selection tick and opens', (tester) async {
      final driver = _Driver();
      var opened = 0;
      final index = buildReviewIndex(allAttempts, const []);
      final attempt = index.mocks.first;
      await pumpMockmob(
        tester,
        PastResultRow(
          attempt: attempt,
          label: sourceLabel(index.attempts, attempt),
          clock: ReviewClock('Asia/Kolkata', () => eveningUtc),
          onOpen: () => opened++,
          onReplay: () {},
        ),
        disableAnimations: true,
        overrides: [...reviewOverrides(), hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: driver))],
      );
      await tester.tap(find.byType(PastResultRow));
      await tester.pump();
      expect(opened, 1);
      expect(driver.selection, 1);
    });

    testWidgets('the repair ending stands Mobi proud, and the thread stays honest', (tester) async {
      final store = MemoryPrefsStore()..values['rhythm_hidden_u1'] = true;
      await pumpMockmob(
        tester,
        const RepairEndingScreen(attemptId: 'm7'),
        size: const Size(384, 2400),
        disableAnimations: true,
        wrapInScaffold: false,
        overrides: reviewOverrides(
          run: runOf(phase: RepairPhase.ending, outcomes: [explained, explained2], index: 1),
          rhythmStore: store,
        ),
      );
      final mobi = tester.widget<MobiCharacter>(find.byType(MobiCharacter));
      expect(mobi.entrance, MobiAct.proud);
    });
  });
}
