// UI phase 2 on Review: the hero at the gutter with one object, the moments weighted to the
// optical centre, the celebration ladder caps and the Celebrations setting, the accordion's lift,
// the Day selected surface, and the regression for "Not today" reaching the Start sheet.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/art/art.dart' show SubjectEmblem;
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/motion/motion.dart';
import 'package:mockmob/core/repositories/dismissal_repository.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/review/copy.dart';
import 'package:mockmob/features/review/data/mistake_index.dart';
import 'package:mockmob/features/review/data/repair_state.dart';
import 'package:mockmob/features/review/data/review_providers.dart';
import 'package:mockmob/features/review/screens/repair_ending_screen.dart';
import 'package:mockmob/features/review/screens/repair_screen.dart';
import 'package:mockmob/features/review/screens/review_screen.dart';
import 'package:mockmob/features/review/widgets/foil_burst.dart';
import 'package:mockmob/features/review/widgets/life_row.dart';
import 'package:mockmob/features/review/widgets/mistake_map.dart';
import 'package:mockmob/features/review/widgets/mistake_view.dart' show StageMoment;
import 'package:mockmob/features/review/widgets/question_panel.dart';
import 'package:mockmob/features/review/widgets/page_header.dart' show ReviewTabHeader;
import 'package:mockmob/features/review/widgets/review_layout.dart';
import 'package:mockmob/features/review/widgets/review_status.dart' show RepairsProgress;
import 'package:mockmob/features/review/widgets/chapter_hero.dart';
import 'package:mockmob/features/review/widgets/tonight_card.dart';
import 'package:mockmob/features/review/model/review_chapters.dart';
import 'package:mockmob/features/review/model/review_record_adapter.dart';
import 'package:mockmob/features/rhythm/rhythm.dart' show CelebrationMode;
import 'package:mockmob/features/today/data/today_providers.dart' show todayDismissalsProvider;
import 'package:mockmob/features/today/logic/move_builder.dart' show dismissalKeyFor;

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

/// The costliest chapter of the fixtures, as the tab's lead names it.
ChapterRow chaptersLead() {
  final index = buildReviewIndex(allAttempts, [repairedRecord]);
  return chapterRows(reviewRecordOf(index, now: eveningUtc)).first;
}

/// The hero's key: "Repair 3 mistakes, 10 min" (the count and the minutes depend on the fixture).
Finder _repairKey() => find.byWidgetPredicate((w) => w is KeyButton && RegExp(r'^Repair \d+ mistakes?, \d+ min$').hasMatch(w.label));

void main() {
  setUpAll(loadAppFonts);

  group('"Not today" on Today also hides the Start shortcut (today-02)', () {
    final index = buildReviewIndex(allAttempts, const []);
    final tonight = index.tonight!;
    final key = dismissalKeyFor(index.attempt(tonight.attemptId)!);

    ProviderContainer containerWith(Stream<Set<DismissalKey>> dismissals) {
      final container = ProviderContainer(
        overrides: [reviewIndexProvider.overrideWithValue(index), todayDismissalsProvider.overrideWith((ref) => dismissals)],
      );
      addTearDown(container.dispose);
      // A provider nobody listens to is paused, so its stream would never deliver to a bare read.
      container.listen(todayDismissalsProvider, (_, _) {});
      return container;
    }

    test('with nothing dismissed, Start offers the repair', () async {
      final container = containerWith(Stream.value(const {}));
      await container.read(todayDismissalsProvider.future);
      expect(container.read(quickRepairFromReviewProvider), isNotNull);
    });

    test("a dismissed repair is not offered by Start, and neither is its 10-minute shortcut", () async {
      final container = containerWith(Stream.value({key}));
      await container.read(todayDismissalsProvider.future);
      expect(container.read(quickRepairFromReviewProvider), isNull);
    });

    test('a dismissal of another paper does not hide it', () async {
      final other = DismissalKey(kind: 'repair', subject: 'accountancy', sourceAttemptId: 'someone-else');
      final container = containerWith(Stream.value({other}));
      await container.read(todayDismissalsProvider.future);
      expect(container.read(quickRepairFromReviewProvider), isNotNull);
    });

    test('once the dismissal expires (4 AM) the stream empties and Start offers it again', () async {
      final live = StreamController<Set<DismissalKey>>();
      addTearDown(live.close);
      final container = containerWith(live.stream);
      final seen = <bool>[];
      container.listen(quickRepairFromReviewProvider, (_, next) => seen.add(next != null), fireImmediately: true);
      live.add({key});
      await Future<void>.delayed(Duration.zero);
      expect(container.read(quickRepairFromReviewProvider), isNull);
      live.add(const {});
      await Future<void>.delayed(Duration.zero);
      expect(container.read(quickRepairFromReviewProvider), isNotNull);
    });

    test('the dismissal hides only the Start offer: Review still names tonight', () {
      expect(index.tonight, isNotNull);
      expect(repairDismissedForToday(index, {key}, tonight.attemptId), isTrue);
      expect(repairDismissedForToday(index, const {}, tonight.attemptId), isFalse);
      expect(repairDismissedForToday(index, {key}, 'unknown'), isFalse);
    });
  });

  group('the hero is one card at the gutter with one object', () {
    Future<void> pumpTab(WidgetTester tester, {Brightness brightness = Brightness.light, double textScale = 1}) => pumpMockmob(
      tester,
      const ReviewScreen(),
      size: const Size(384, 2400),
      brightness: brightness,
      textScale: textScale,
      disableAnimations: true,
      wrapInScaffold: false,
      overrides: reviewOverrides(records: [repairedRecord]),
    );

    Finder practiseKey() => find.byWidgetPredicate((w) => w is KeyButton && w.label == ReviewCopy.practiseOnChapter(10));

    testWidgets('its edge, its text and the list under it share the spacing system', (tester) async {
      await pumpTab(tester);
      final card = tester.getRect(find.byType(MmSurface).first);
      expect(card.left, 16, reason: 'the hero is a card at the screen gutter, not a bleed');
      expect(card.right, 384 - 16);
      final lead = tester.getTopLeft(find.text(ReviewCopy.loseMost));
      expect(lead.dx, 16 + ReviewSpace.heroPad, reason: 'hero text starts one hero padding inside the card');
      // The chapter's own heading under the hero ("N to repair in <chapter>"), not the strip's caption at the top.
      final heading = tester.getTopLeft(find.textContaining(' to repair in ').first);
      expect(heading.dx, 16, reason: 'section headings sit on the gutter, E0');
      expect(heading.dy - card.bottom, greaterThanOrEqualTo(ReviewSpace.group), reason: 'a group gap under the hero');
    });

    testWidgets('the emblem is never cropped by the card and the title keeps clear of it', (tester) async {
      await pumpTab(tester);
      final card = tester.getRect(find.byType(MmSurface).first);
      final emblem = tester.getRect(find.descendant(of: find.byType(ChapterHero), matching: find.byType(SubjectEmblem)));
      expect(emblem.size, const Size(136, 136));
      expect(emblem.top, greaterThanOrEqualTo(card.top), reason: 'not cropped by the top edge');
      expect(emblem.right, lessThanOrEqualTo(card.right), reason: 'its ink ends on the card edge');
      final lead = chaptersLead();
      final title = tester.getRect(find.descendant(of: find.byType(ChapterHero), matching: find.text(lead.name)));
      expect(title.right, lessThanOrEqualTo(emblem.left - 12), reason: '12 dp of air between the title and the object');
      final number = tester.getRect(find.byType(MonumentalNumber));
      expect(number.right, lessThanOrEqualTo(emblem.left), reason: 'the number stays beside the object, not under it');
      // Everything under the number starts below the object.
      final scope = tester.getRect(find.textContaining('questions in').first);
      expect(scope.top, greaterThanOrEqualTo(emblem.top + 130));
    });

    testWidgets('the key is the one volt key, full width, and there is no second character', (tester) async {
      await pumpTab(tester);
      final card = tester.getRect(find.byType(MmSurface).first);
      final key = tester.getRect(practiseKey());
      expect(key.left, card.left + ReviewSpace.heroPad);
      expect(key.right, card.right - ReviewSpace.heroPad);
      expect(key.height, greaterThanOrEqualTo(56));
      final hero = find.byType(ChapterHero);
      expect(find.descendant(of: hero, matching: find.byType(Mobi)), findsNothing, reason: 'a hero carries an object or Mobi, never both');
      expect(find.descendant(of: hero, matching: find.byType(MobiCharacter)), findsNothing);
      // The one Mobi on the tab is the 24 dp face in the Ask Mobi pill.
      expect(find.byType(MobiCharacter), findsOneWidget);
      // The only volt fill in the content is that key.
      expect(find.byWidgetPredicate((w) => w is KeyButton && w.variant == KeyVariant.primary), findsOneWidget);
    });

    testWidgets('it is the same height in Night and Day', (tester) async {
      await pumpTab(tester);
      final day = tester.getRect(find.byType(MmSurface).first).height;
      expect(day, lessThan(480));
      await tester.pumpWidget(const SizedBox());
      await pumpTab(tester, brightness: Brightness.dark);
      expect(tester.getRect(find.byType(MmSurface).first).height, day);
    });

    testWidgets('at 130% text the emblem gives way and nothing overflows', (tester) async {
      await pumpTab(tester, textScale: 1.3);
      expect(tester.takeException(), isNull);
      expect(tester.getRect(find.descendant(of: find.byType(ChapterHero), matching: find.byType(SubjectEmblem))).width, lessThan(136));
    });

    testWidgets('the Start key records the card for the container transform before it opens the repair', (tester) async {
      final pick = buildReviewIndex(allAttempts, const []).tonight!;
      var opened = 0;
      await pumpMockmob(
        tester,
        SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: TonightCard(pick: pick, now: DateTime(2026, 10, 12, 21), onRepair: () => opened++, onShowMe: () {}),
          ),
        ),
        size: const Size(384, 1200),
        disableAnimations: true,
        overrides: reviewOverrides(),
      );
      MmLaunchRect.take();
      await tester.tap(_repairKey());
      await tester.pump();
      expect(opened, 1);
      final rect = MmLaunchRect.take();
      expect(rect, isNotNull);
      expect(rect!.left, 16);
      expect(rect.width, 384 - 32, reason: 'the page grows out of the whole hero card');
    });
  });

  group('the moments sit at the optical centre above a pinned key', () {
    testWidgets('the repair entry: one volt key, full width, on the moment gutter, and no second character', (tester) async {
      await pumpMockmob(
        tester,
        const RepairScreen(attemptId: 'm7', questionId: 'm7-q0'),
        size: const Size(384, 853),
        disableAnimations: true,
        wrapInScaffold: false,
        overrides: reviewOverrides(run: runOf(phase: RepairPhase.entry), credits: credits(9)),
      );
      final key = tester.getRect(find.widgetWithText(KeyButton, 'Begin'));
      expect(key.left, ReviewSpace.moment);
      expect(key.right, 384 - ReviewSpace.moment);
      expect(find.byType(Mobi), findsNothing);
      final title = tester.getTopLeft(find.text('Partnership: admission of a partner'));
      expect(title.dx, ReviewSpace.moment, reason: 'the headline is on the moment gutter');
      // What Repair gives is stated before any call, and the cost with the balance sits directly above the key that spends it.
      expect(find.text(ReviewCopy.givesHeading), findsOneWidget);
      final credit = tester.getRect(find.text('Uses 1 credit per mistake. You have 9.'));
      expect(key.top - credit.bottom, lessThanOrEqualTo(40), reason: 'the cost line sits directly above the key');
      expect(credit.bottom, lessThanOrEqualTo(key.top), reason: 'the cost line never sits under the key');
    });

    testWidgets('the ending keeps its receipt directly under the thread and pins only the keys', (tester) async {
      await pumpMockmob(
        tester,
        const RepairEndingScreen(attemptId: 'm7'),
        size: const Size(384, 853),
        disableAnimations: true,
        wrapInScaffold: false,
        overrides: reviewOverrides(run: runOf(phase: RepairPhase.ending, outcomes: [explained, explained2], index: 1)),
      );
      final caption = tester.getRect(find.text(ReviewCopy.lifeCaption));
      final receipt = tester.getRect(find.textContaining('Repair finished. Recorded at'));
      expect(receipt.top - caption.bottom, lessThanOrEqualTo(ReviewSpace.group + 4), reason: 'the receipt follows the thread, no hole');
      final key = tester.getRect(find.widgetWithText(KeyButton, 'Repair 1 more mistake'));
      expect(key.left, ReviewSpace.moment);
      expect(key.right, 384 - ReviewSpace.moment);
    });
  });

  group('the repair ending is a T2 moment', () {
    test('its beat, from the first ring to the end of the burst, stays inside 1200 ms', () {
      expect(RepairEndingTiming.moment, lessThanOrEqualTo(const Duration(milliseconds: 1200)));
      expect(RepairEndingTiming.numberLands, RepairEndingTiming.numberDelay + Motion.numberRoll);
      expect(RepairEndingTiming.end, RepairEndingTiming.numberLands + FoilBurst.duration);
      expect(RepairEndingTiming.moment, RepairEndingTiming.end - RepairEndingTiming.ringsStart);
      expect(RepairEndingTiming.maxRingTicks, lessThanOrEqualTo(3));
      expect(FoilBurst.flecks, 14);
    });

    testWidgets('the rings tick at most three times and the burst opens only when the number has landed', (tester) async {
      final driver = _Driver();
      await pumpMockmob(
        tester,
        const RepairEndingScreen(attemptId: 'm7'),
        size: const Size(384, 853),
        wrapInScaffold: false,
        overrides: [
          ...reviewOverrides(run: runOf(phase: RepairPhase.ending, outcomes: [explained, explained2], index: 1)),
          hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: driver)),
        ],
      );
      // pumpMockmob has already played about 640 ms (the arrival, the rings, part of the roll).
      FoilBurst burst() => tester.widget<FoilBurst>(find.byType(FoilBurst));
      expect(burst().play, isFalse, reason: 'the number is still rolling');
      await tester.pump(RepairEndingTiming.numberLands);
      expect(burst().play, isTrue, reason: 'it opens as the number lands');
      await tester.pump(const Duration(seconds: 6));
      expect(driver.selection, inInclusiveRange(1, RepairEndingTiming.maxRingTicks));
    });

    for (final mode in [CelebrationMode.quiet, CelebrationMode.off]) {
      testWidgets('with Celebrations ${mode.name} there is no burst and no Mobi hop, only the words', (tester) async {
        await pumpMockmob(
          tester,
          const RepairEndingScreen(attemptId: 'm7'),
          size: const Size(384, 853),
          wrapInScaffold: false,
          overrides: reviewOverrides(
            celebration: mode,
            run: runOf(phase: RepairPhase.ending, outcomes: [explained, explained2], index: 1),
          ),
        );
        await tester.pump(const Duration(seconds: 3));
        expect(find.byType(FoilBurst), findsNothing);
        expect(find.textContaining('Repair finished. Recorded at'), findsOneWidget);
        await tester.pump(const Duration(seconds: 6));
      });
    }

    testWidgets('no sweep crosses the sheet: nothing paints over it as the rings close', (tester) async {
      await pumpMockmob(
        tester,
        const RepairEndingScreen(attemptId: 'm7'),
        size: const Size(384, 853),
        wrapInScaffold: false,
        overrides: reviewOverrides(run: runOf(phase: RepairPhase.ending, outcomes: [explained, explained2], index: 1)),
      );
      // The sheet's stack holds the paper, the lamp, the grain and its content, and nothing else.
      final sheet = find.byType(MmClip).first;
      final painters = find.descendant(of: sheet, matching: find.byType(CustomPaint));
      final names = [for (final p in tester.widgetList<CustomPaint>(painters)) p.painter.runtimeType.toString()];
      expect(names.where((n) => n.contains('Sweep')), isEmpty);
      await tester.pump(const Duration(seconds: 6));
    });
  });

  group('the accordion and its thread', () {
    final index = buildReviewIndex(allAttempts, const []);
    final clock = ReviewClock('Asia/Kolkata', () => eveningUtc);

    testWidgets('an opening chapter lifts onto the raised surface and its rows arrive 30 ms apart', (tester) async {
      await pumpMockmob(
        tester,
        SingleChildScrollView(
          child: MistakeMap(groups: index.openGroups, clock: clock, onOpen: (_) {}),
        ),
        size: const Size(384, 1600),
        overrides: reviewOverrides(),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Partnership: admission of a partner'));
      await tester.pump();
      // The chapter's content fades in over the back two thirds of its 320 ms opening; by 200 ms
      // the first row (30 ms apart, 160 ms fade) is whole and the fifth is still arriving.
      await tester.pump(const Duration(milliseconds: 200));
      double opacity(int row) {
        final fade = find.ancestor(of: find.byType(MistakeRow).at(row), matching: find.byType(FadeTransition));
        // Every ancestor fade multiplies: the section's own, then the row's.
        return tester.widgetList<FadeTransition>(fade).fold(1.0, (a, f) => a * f.opacity.value);
      }

      expect(opacity(0), greaterThan(opacity(4)), reason: 'rows arrive in order, the first before the fifth');
      await tester.pumpAndSettle();
      expect(opacity(4), 1);
      final lift = tester.widgetList<AnimatedOpacity>(find.byType(AnimatedOpacity)).where((o) => o.opacity == 1);
      expect(lift, isNotEmpty, reason: 'the opened chapter sits on its own surface');
    });

    testWidgets('the bars draw over 420 ms, 45 ms apart, in both directions of a rebuild', (tester) async {
      await pumpMockmob(
        tester,
        SingleChildScrollView(
          child: MistakeMap(groups: index.openGroups, clock: clock, onOpen: (_) {}),
        ),
        size: const Size(384, 1600),
        overrides: reviewOverrides(),
      );
      // The map is already mid-draw after the harness's settle (640 ms): 420 + 3 * 45 = 555 ms.
      await tester.pump(const Duration(milliseconds: 600));
      expect(tester.hasRunningAnimations, isFalse, reason: 'the whole draw is over by 555 ms');
    });
  });

  group('the work layer', () {
    testWidgets('a repair acknowledged after the explanation landed still completes the stage', (tester) async {
      final repaired = ValueNotifier(false);
      addTearDown(repaired.dispose);
      await pumpMockmob(
        tester,
        ValueListenableBuilder<bool>(valueListenable: repaired, builder: (_, v, _) => StageMoment(repaired: v)),
        overrides: reviewOverrides(),
      );
      expect(tester.widget<LifeRow>(find.byType(LifeRow)).stage, MistakeStage.found);
      repaired.value = true;
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));
      expect(tester.widget<LifeRow>(find.byType(LifeRow)).stage, MistakeStage.repaired);
    });

    test('the selected surface lifts on Night and stays white on Day', () {
      expect(selectedSurfaceOf(MmColors.dark), MmColors.dark.raised2);
      expect(selectedSurfaceOf(MmColors.light), MmColors.light.raised);
      expect(MmColors.light.raised2, isNot(selectedSurfaceOf(MmColors.light)), reason: 'Day raised2 is darker than the page and reads as disabled');
    });

    testWidgets('the correct option is white with a 2 px ink border in Day, never the taupe raised2', (tester) async {
      await pumpMockmob(
        tester,
        const MarkedOption(letter: 'B', text: '5:3:2', mark: OptionMark.correct),
        overrides: reviewOverrides(),
      );
      final box = tester.widget<DecoratedBox>(find.descendant(of: find.byType(MarkedOption), matching: find.byType(DecoratedBox)).first);
      final shape = box.decoration as ShapeDecoration;
      expect(shape.color, MmColors.light.raised);
      expect((shape.shape as OutlinedBorder).side.width, 2);
    });
  });

  group('the tab: Ask in the header, the app pull, a count that rolls on', () {
    Future<void> pumpTab(WidgetTester tester) => pumpMockmob(
      tester,
      const ReviewScreen(),
      size: const Size(384, 853),
      disableAnimations: true,
      wrapInScaffold: false,
      overrides: reviewOverrides(records: [repairedRecord]),
    );

    testWidgets('Ask Mobi sits in the header row, on the right, with a 48 dp target (DOCK 6)', (tester) async {
      await pumpTab(tester);
      final ask = find.text('Ask Mobi');
      expect(ask, findsOneWidget);
      final title = tester.getRect(find.text(ReviewCopy.title).first);
      final pill = tester.getRect(find.ancestor(of: ask, matching: find.byType(DecoratedBox)).first);
      expect(pill.center.dy, closeTo(title.center.dy, 12), reason: 'on the title row');
      expect(pill.right, closeTo(384 - 16, 0.5), reason: 'on the right gutter');
      expect(pill.height, 40);
      expect(tester.getSemantics(find.bySemanticsLabel(RegExp('^Ask Mobi'))).rect.height, greaterThanOrEqualTo(48));
    });

    testWidgets('the header calls onAsk when the pill is tapped', (tester) async {
      var asked = 0;
      await pumpMockmob(
        tester,
        Padding(padding: const EdgeInsets.all(16), child: ReviewTabHeader(title: 'Review', onAsk: () => asked++)),
        disableAnimations: true,
        overrides: reviewOverrides(),
      );
      await tester.tap(find.text('Ask Mobi'));
      await tester.pump();
      expect(asked, 1);
    });

    testWidgets('no stock refresh spinner: the page pulls with MmPullRefresh', (tester) async {
      await pumpTab(tester);
      expect(find.byType(RefreshIndicator), findsNothing);
      expect(find.byType(MmPullRefresh), findsOneWidget);
    });

    testWidgets('the repaired count rolls on from the number it showed, never from zero', (tester) async {
      Widget at(int repaired) => Padding(
        padding: const EdgeInsets.all(16),
        child: RepairsProgress(repaired: repaired, found: 8),
      );
      await pumpMockmob(tester, at(1), overrides: reviewOverrides());
      expect(find.text('1 repaired, 8 found'), findsOneWidget, reason: 'first show: no count from zero');
      await pumpMockmob(tester, at(3), overrides: reviewOverrides());
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));
      final mid = tester.widget<Text>(find.textContaining(', 8 found')).data!;
      expect(mid, isNot(startsWith('0 ')), reason: 'rolls from 1, not from 0');
      await tester.pump(const Duration(seconds: 2));
      expect(find.text('3 repaired, 8 found'), findsOneWidget);
    });
  });
}
