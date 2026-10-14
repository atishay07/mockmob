// Today in use, UI phase 2 (MOTION.md 4.3 and P0-9, P0-4; SPACING.md 4.1; audit T1, T3, T6):
// the hero's object arrives where it rests and is never cropped by the card's top edge, the pull
// is the app's own (no stock spinner) and refreshes once, the offline line never changes the
// header's height, and the week's key only takes a row when a mark needs words.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/art/art.dart' show EmblemArrive, SubjectEmblem;
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/motion/motion.dart' show MmPullRefresh;
import 'package:mockmob/features/rhythm/logic/plan_week.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/screens/today_body.dart';
import 'package:mockmob/features/today/widgets/hero_stage.dart';
import 'package:mockmob/features/today/widgets/move_hero.dart';
import 'package:mockmob/features/today/widgets/today_header.dart';
import 'package:mockmob/features/today/widgets/week_ledger.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/today_fixtures.dart';

void main() {
  setUpAll(loadAppFonts);

  final auth = authSnapshotProvider.overrideWithBuild(
    (ref, notifier) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u', name: 'Asha Verma'),
  );

  TodayCallbacks callbacks({Future<void> Function()? onRefresh}) =>
      TodayCallbacks(onAction: (_) {}, onTarget: (_) {}, onMinutes: (_) {}, onShowMe: (_) {}, onWeek: () {}, onRefresh: onRefresh);

  Future<void> pumpToday(WidgetTester tester, {bool reduced = false, bool offline = false, Future<void> Function()? onRefresh, Brightness brightness = Brightness.dark}) =>
      pumpMockmob(
        tester,
        TodayBody(
          view: buildToday(ashaInputs(offline: offline, attemptsAge: offline ? const Duration(hours: 3) : const Duration(minutes: 70))),
          callbacks: callbacks(onRefresh: onRefresh),
          skeletonDelay: Duration.zero,
        ),
        size: const Size(384, 1400),
        brightness: brightness,
        disableAnimations: reduced,
        overrides: [auth],
      );

  Rect emblemRect(WidgetTester tester) =>
      tester.getRect(find.descendant(of: find.byType(MoveHeroCard), matching: find.byType(SubjectEmblem)).first);

  for (final brightness in Brightness.values) {
    testWidgets('the hero object rests on the card, beside the band, from 580 ms on (P0-9, T1), ${brightness.name}', (tester) async {
      await pumpToday(tester, brightness: brightness);
      // pumpMockmob has played 640 ms: the arrival (160 ms wait, 420 ms move) is over.
      final atRest = emblemRect(tester);
      await tester.pump(const Duration(seconds: 2));
      expect(emblemRect(tester), atRest, reason: 'after it lands the object never moves');

      final card = tester.getRect(find.byType(HeroStage).first);
      expect(atRest.top, greaterThanOrEqualTo(card.top), reason: 'never cropped by the top edge');
      expect(atRest.right, lessThanOrEqualTo(card.right + 0.5), reason: 'it ends on the right edge, not past it');
      expect(atRest.width, closeTo(heroEmblemSize, 0.5));
      // Within the slight parallax (0.05 of the box, about 8 dp over the viewport).
      expect(atRest.top - card.top, closeTo(heroArtTop + (heroArtHeight - heroEmblemSize) / 2, 4), reason: 'on the band, not the corner');
    });
  }

  testWidgets('the object arrives through EmblemArrive: it scales about its centre, no sideways glide', (tester) async {
    await pumpToday(tester);
    expect(find.descendant(of: find.byType(HeroArtView), matching: find.byType(EmblemArrive)), findsOneWidget);
  });

  testWidgets('reduced motion: the object is in place on the first frame', (tester) async {
    await pumpToday(tester, reduced: true);
    final rest = emblemRect(tester);
    await tester.pump(const Duration(seconds: 1));
    expect(emblemRect(tester), rest);
  });

  group('the pull is the app\'s own (P0-4)', () {
    testWidgets('no stock spinner; a pull past the threshold refreshes once', (tester) async {
      var refreshes = 0;
      await pumpToday(tester, onRefresh: () async => refreshes++);
      expect(find.byType(RefreshIndicator), findsNothing);
      expect(find.byType(MmPullRefresh), findsOneWidget);

      final before = tester.getRect(find.byType(HeroStage).first);
      final gesture = await tester.startGesture(const Offset(192, 300));
      for (var i = 0; i < 12; i++) {
        await gesture.moveBy(const Offset(0, 12));
        await tester.pump(const Duration(milliseconds: 16));
      }
      expect(tester.getRect(find.byType(HeroStage).first).top, closeTo(before.top, 0.5), reason: 'the content does not move on a pull');
      await gesture.up();
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(refreshes, 1);
    });

  });

  testWidgets('the offline line takes the date line\'s place: the header keeps its height (T6)', (tester) async {
    await pumpToday(tester, reduced: true);
    final online = tester.getSize(find.byType(TodayHeader));
    await pumpToday(tester, reduced: true, offline: true);
    expect(find.textContaining('You are offline'), findsOneWidget);
    expect(tester.getSize(find.byType(TodayHeader)).height, online.height);
  });

  test('the week key only takes a row when a mark needs words (T3)', () {
    PlanDay day(PlanDayMark mark) => PlanDay(index: 0, mark: mark);
    expect(WeekLedger.needsKey([day(PlanDayMark.done), day(PlanDayMark.planned)]), isFalse);
    expect(WeekLedger.needsKey([day(PlanDayMark.done), day(PlanDayMark.rest)]), isTrue);
    expect(WeekLedger.needsKey([day(PlanDayMark.open)]), isTrue);
  });
}
