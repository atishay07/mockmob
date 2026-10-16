import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/review/data/mistake_index.dart';
import 'package:mockmob/features/review/data/review_providers.dart';
import 'package:mockmob/features/review/screens/repair_ending_screen.dart';
import 'package:mockmob/features/review/screens/review_screen.dart';
import 'package:mockmob/features/review/data/repair_state.dart';
import 'package:mockmob/features/review/widgets/collapsible.dart';
import 'package:mockmob/features/review/widgets/foil_burst.dart';
import 'package:mockmob/features/review/widgets/life_row.dart';
import 'package:mockmob/features/review/widgets/mistake_map.dart';
import 'package:mockmob/features/review/widgets/run_track.dart';

import '../../golden/review/review_golden_support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/review_fixtures.dart';

List<BubbleState> _lifeBubbles(WidgetTester tester) => [
  for (final b in tester.widgetList<Bubble>(find.descendant(of: find.byType(LifeRow), matching: find.byType(Bubble)))) b.state,
];

void main() {
  setUpAll(loadAppFonts);

  group('the mistake map', () {
    final index = buildReviewIndex(allAttempts, const []);
    final clock = ReviewClock('Asia/Kolkata', () => eveningUtc);

    Future<void> pumpMap(WidgetTester tester, {int initialOpen = -1, bool animations = false}) => pumpMockmob(
      tester,
      SingleChildScrollView(
        child: MistakeMap(groups: index.openGroups, clock: clock, onOpen: (_) {}, initialOpen: initialOpen),
      ),
      size: const Size(384, 1600),
      disableAnimations: !animations,
      overrides: reviewOverrides(),
    );

    testWidgets('every chapter starts closed, and one tap opens only that chapter', (tester) async {
      await pumpMap(tester);
      expect(find.byType(MistakeRow), findsNothing);
      await tester.tap(find.text('Partnership: admission of a partner'));
      await tester.pumpAndSettle();
      // Partnership holds five open mistakes across two papers.
      expect(find.byType(MistakeRow), findsNWidgets(5));
      expect(find.text('Repair 3 from Mock 2'), findsOneWidget);
      expect(find.text('Repair 2 from Mock 1'), findsOneWidget);
    });

    testWidgets('opening a second chapter closes the first (one open at a time)', (tester) async {
      await pumpMap(tester, initialOpen: 0);
      expect(find.byType(MistakeRow), findsNWidgets(5));
      await tester.tap(find.text('Accounting ratios'));
      await tester.pumpAndSettle();
      expect(find.byType(MistakeRow), findsNWidgets(1));
    });

    testWidgets('it opens with a size animation, not a snap, and ends fully open', (tester) async {
      await pumpMap(tester, animations: true);
      await tester.tap(find.text('Accounting ratios'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 60));
      final partway = tester.getSize(find.byType(MmCollapsible).at(1)).height;
      await tester.pumpAndSettle();
      final full = tester.getSize(find.byType(MmCollapsible).at(1)).height;
      expect(partway, lessThan(full), reason: 'the section grows over 320 ms');
      expect(full, greaterThan(100));
    });

    test('the bars share one scale: the largest chapter', () {
      expect(mapScaleOf(index.openGroups), 5);
      expect(mapScaleOf(const []), 1);
    });

    testWidgets('a chapter row speaks its chapter, its counts and what a tap does', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpMap(tester);
      expect(find.bySemanticsLabel(RegExp(r'^Partnership: admission of a partner\. Accountancy\. 5 mistakes to repair\..*Show the questions$')), findsOneWidget);
      handle.dispose();
    });
  });

  group('the stage thread', () {
    testWidgets('a stage that completes draws the line, then inks the Repaired bubble', (tester) async {
      var stage = MistakeStage.found;
      late StateSetter set;
      await pumpMockmob(
        tester,
        StatefulBuilder(
          builder: (context, setState) {
            set = setState;
            return LifeRow(stage: stage);
          },
        ),
        overrides: reviewOverrides(),
      );
      expect(_lifeBubbles(tester), [BubbleState.wrong, BubbleState.hollow, BubbleState.blank, BubbleState.blank]);
      set(() => stage = MistakeStage.repaired);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 60));
      expect(_lifeBubbles(tester)[1], BubbleState.hollow, reason: 'the line is still drawing; the ink follows it');
      await tester.pump(const Duration(milliseconds: 400));
      expect(_lifeBubbles(tester)[1], BubbleState.filled);
      await tester.pumpAndSettle();
    });

    testWidgets('under reduced motion the finished thread shows at once', (tester) async {
      var stage = MistakeStage.found;
      late StateSetter set;
      await pumpMockmob(
        tester,
        StatefulBuilder(
          builder: (context, setState) {
            set = setState;
            return LifeRow(stage: stage);
          },
        ),
        disableAnimations: true,
        overrides: reviewOverrides(),
      );
      set(() => stage = MistakeStage.repaired);
      await tester.pump();
      expect(_lifeBubbles(tester)[1], BubbleState.filled);
    });

    testWidgets('Retested and Still right never fill, whatever the stage', (tester) async {
      await pumpMockmob(tester, const LifeRow(stage: MistakeStage.repaired), disableAnimations: true, overrides: reviewOverrides());
      final states = _lifeBubbles(tester);
      expect(states.sublist(2), [BubbleState.blank, BubbleState.blank]);
    });
  });

  group('the run track', () {
    testWidgets('draws one segment per mistake and carries no semantics of its own', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpMockmob(
        tester,
        const RunTrack(segments: [RunSegmentState.done, RunSegmentState.reviewed, RunSegmentState.current, RunSegmentState.setAside, RunSegmentState.upcoming]),
        disableAnimations: true,
        overrides: reviewOverrides(),
      );
      expect(tester.getSemantics(find.byType(RunTrack)).label, isEmpty);
      handle.dispose();
    });

    testWidgets('a segment that completes fills over 420 ms', (tester) async {
      var done = false;
      late StateSetter set;
      await pumpMockmob(
        tester,
        StatefulBuilder(
          builder: (context, setState) {
            set = setState;
            return RunTrack(segments: [done ? RunSegmentState.done : RunSegmentState.current, RunSegmentState.upcoming]);
          },
        ),
        overrides: reviewOverrides(),
      );
      set(() => done = true);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));
      await tester.pumpAndSettle();
    });
  });

  group('the foil burst', () {
    testWidgets('draws nothing until it plays, takes no touch and has no semantics', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpMockmob(tester, const SizedBox(width: 300, height: 300, child: FoilBurst(play: false)), overrides: reviewOverrides());
      expect(find.byType(FoilBurst), findsOneWidget);
      expect(tester.getSemantics(find.byType(FoilBurst)).label, isEmpty);
      handle.dispose();
    });

    testWidgets('the repair ending plays it once the rings have closed, and only with motion on', (tester) async {
      Future<void> pumpEnding({required bool animations}) => pumpMockmob(
        tester,
        const RepairEndingScreen(attemptId: 'm7'),
        size: const Size(384, 853),
        disableAnimations: !animations,
        wrapInScaffold: false,
        overrides: reviewOverrides(run: runOf(phase: RepairPhase.ending, outcomes: [explained, explained2], index: 1)),
      );
      await pumpEnding(animations: true);
      expect(find.byType(FoilBurst), findsOneWidget);
      // Let the screen's own timers (the review ask) run out before the test ends.
      await tester.pump(const Duration(seconds: 6));

      // A fresh screen: the celebration is decided once, when the screen opens.
      await tester.pumpWidget(const SizedBox());
      await pumpEnding(animations: false);
      expect(find.byType(FoilBurst), findsNothing, reason: 'reduced motion: everything at rest');
    });
  });

  testWidgets('the tab opens on the hero, then the map, with no nested cards in the map', (tester) async {
    await pumpMockmob(
      tester,
      const ReviewScreen(),
      size: const Size(384, 2400),
      disableAnimations: true,
      wrapInScaffold: false,
      overrides: reviewOverrides(records: [repairedRecord]),
    );
    expect(find.text('mistakes'), findsOneWidget, reason: 'the hero number carries its unit');
    expect(find.byType(MistakeMap), findsOneWidget);
    // One surface per chapter at most (the open one); closed chapters are bare rows.
    expect(find.byType(ChapterTrack), findsNWidgets(3), reason: 'one track a chapter row');
    expect(find.byType(MistakeBar), findsOneWidget, reason: 'the progress line keeps the segmented bar that teaches the colours');
  });
}
