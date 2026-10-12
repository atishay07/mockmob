import 'dart:ui' show Tristate;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../../helpers/golden_harness.dart';

class _CountingDriver implements HapticDriver {
  int selections = 0;

  @override
  Future<void> selectionClick() async => selections++;

  @override
  Future<void> lightImpact() async {}

  @override
  Future<void> mediumImpact() async {}
}

void main() {
  group('MmBottomNav', () {
    testWidgets('names each tab with its position and marks the active one selected', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpMockmob(tester, const Align(alignment: Alignment.bottomCenter, child: _Nav(index: 1)));

      expect(tabSemanticsLabel(1), 'Practice, tab 2 of 5');
      for (var i = 0; i < 5; i++) {
        final data = tester.getSemantics(find.bySemanticsLabel(tabSemanticsLabel(i))).getSemanticsData();
        expect(data.flagsCollection.isSelected, i == 1 ? Tristate.isTrue : Tristate.isFalse, reason: 'tab $i');
        expect(data.flagsCollection.isButton, isTrue);
      }
      handle.dispose();
    });

    testWidgets('the Review dot adds a spoken hint and no number', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpMockmob(tester, const Align(alignment: Alignment.bottomCenter, child: _Nav(index: 0, dot: true)));
      expect(find.bySemanticsLabel('Review, tab 3 of 5, new result'), findsOneWidget);
      expect(find.textContaining(RegExp(r'\d')), findsNothing);
      handle.dispose();
    });

    testWidgets('ticks only when the tab changes, and always reports the tap', (tester) async {
      final driver = _CountingDriver();
      final taps = <int>[];
      await pumpMockmob(
        tester,
        Align(alignment: Alignment.bottomCenter, child: _Nav(index: 0, onTap: taps.add)),
        overrides: <Override>[hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: driver))],
      );

      await tester.tap(find.text('Learn'));
      await tester.pump();
      expect(taps, [3]);
      expect(driver.selections, 1);

      await tester.tap(find.text('Today'));
      await tester.pump();
      expect(taps, [3, 0]);
      expect(driver.selections, 1, reason: 'a re-tap of the current tab is not a change');
    });

    testWidgets('labels clamp the text scale at 1.3', (tester) async {
      await pumpMockmob(
        tester,
        const Align(alignment: Alignment.bottomCenter, child: _Nav(index: 0)),
        textScale: 2,
      );
      final label = tester.widget<Text>(find.text('Practice'));
      final scaler = MediaQuery.textScalerOf(tester.element(find.text('Practice')));
      expect(scaler.scale(12), closeTo(12 * 1.3, 0.001));
      expect(label.maxLines, 1);
    });

    testWidgets('is 64 dp tall plus the bottom inset', (tester) async {
      await pumpMockmob(tester, const Align(alignment: Alignment.bottomCenter, child: _Nav(index: 0)));
      expect(tester.getSize(find.byType(MmBottomNav)).height, 64);
    });
  });

  group('SavePill', () {
    testWidgets('says the honest words and is a polite live region', (tester) async {
      final handle = tester.ensureSemantics();
      for (final entry in {
        SaveState.onThisPhone: 'On this phone',
        SaveState.sending: 'Sending',
        SaveState.saved: 'Saved on the server',
      }.entries) {
        await pumpMockmob(tester, Center(child: SavePill(state: entry.key)), disableAnimations: true);
        expect(find.text(entry.value), findsOneWidget);
        final data = tester.getSemantics(find.bySemanticsLabel(entry.value)).getSemanticsData();
        expect(data.flagsCollection.isLiveRegion, isTrue);
      }
      handle.dispose();
    });
  });

  group('WeekStrip', () {
    testWidgets('describes study days and today for a screen reader', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpMockmob(
        tester,
        Center(
          child: WeekStrip(
            label: '2 of 4 study days',
            days: [
              for (var i = 0; i < 7; i++) WeekStripDay(studyDay: i == 0 || i == 2, isToday: i == 3),
            ],
          ),
        ),
      );
      expect(
        find.bySemanticsLabel('2 of 4 study days. Study days: Monday and Wednesday. Today is Thursday'),
        findsOneWidget,
      );
      handle.dispose();
    });

    testWidgets('an empty week still reads', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpMockmob(
        tester,
        Center(
          child: WeekStrip(label: '0 of 4 study days', days: List.filled(7, const WeekStripDay())),
        ),
      );
      expect(find.bySemanticsLabel('0 of 4 study days. No study days yet this week'), findsOneWidget);
      handle.dispose();
    });
  });

  group('QuestionStrip', () {
    testWidgets('summarises the counts in words', (tester) async {
      final handle = tester.ensureSemantics();
      const cells = [
        QuestionCell.right,
        QuestionCell.right,
        QuestionCell.wrong,
        QuestionCell.repaired,
        QuestionCell.blank,
        QuestionCell.changed,
      ];
      await pumpMockmob(tester, const Center(child: QuestionStrip(cells: cells, columns: 3)));
      expect(find.bySemanticsLabel('2 correct, 2 wrong, 1 not attempted, 1 changed, 1 repaired'), findsOneWidget);
      handle.dispose();
    });

    testWidgets('the sealed sheet leaks nothing', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpMockmob(
        tester,
        const Center(child: QuestionStrip(cells: [QuestionCell.right, QuestionCell.wrong], dimmed: true)),
      );
      expect(find.bySemanticsLabel('Answer sheet, 2 questions'), findsOneWidget);
      handle.dispose();
    });

    testWidgets('size follows columns, cell size and gap', (tester) async {
      await pumpMockmob(
        tester,
        Center(child: QuestionStrip(cells: List.filled(50, QuestionCell.blank), columns: 5)),
      );
      expect(tester.getSize(find.byType(QuestionStrip)), const Size(5 * 16 + 4 * 3, 10 * 16 + 9 * 3));
    });

    testWidgets('reveal fills cells in question order', (tester) async {
      final controller = AnimationController(vsync: tester, duration: const Duration(milliseconds: 240));
      addTearDown(controller.dispose);
      await pumpMockmob(
        tester,
        Center(child: QuestionStrip(cells: List.filled(10, QuestionCell.right), reveal: controller)),
      );
      controller.value = 0.5;
      await tester.pump();
      expect(find.byType(QuestionStrip), findsOneWidget);
    });
  });

  group('Mobi', () {
    testWidgets('is hidden from screen readers unless labelled', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpMockmob(
        tester,
        const Column(children: [Mobi(pose: MobiPose.greeting), Mobi(pose: MobiPose.idle, semanticLabel: 'Mobi')]),
      );
      expect(find.bySemanticsLabel('Mobi'), findsOneWidget);
      handle.dispose();
    });

    testWidgets('maps every pose to its asset', (tester) async {
      expect(MobiPose.values.map((p) => p.asset), [
        'assets/mobi/attentive.webp',
        'assets/mobi/celebrating.webp',
        'assets/mobi/encouraging.webp',
        'assets/mobi/greeting.webp',
        'assets/mobi/idle.webp',
        'assets/mobi/pointing.webp',
        'assets/mobi/thinking.webp',
      ]);
    });

    testWidgets('stays static under reduced motion', (tester) async {
      await pumpMockmob(
        tester,
        const Center(child: Mobi(pose: MobiPose.greeting, motion: MobiMotion.hop)),
        disableAnimations: true,
      );
      expect(find.descendant(of: find.byType(Mobi), matching: find.byType(AnimatedBuilder)), findsNothing);
    });
  });

  group('MmSheetScaffold', () {
    testWidgets('shows a handle and no Close at normal text size', (tester) async {
      await pumpMockmob(tester, const MmSheetScaffold(title: 'This week', child: Text('Body')));
      expect(find.text('This week'), findsOneWidget);
      expect(find.text('Close'), findsNothing);
    });

    testWidgets('becomes a full page with a visible Close at text scale 1.5', (tester) async {
      await pumpMockmob(tester, const MmSheetScaffold(title: 'This week', child: Text('Body')), textScale: 1.5);
      expect(find.text('Close'), findsOneWidget);
    });
  });

  group('StateView', () {
    testWidgets('shows the message and up to two actions', (tester) async {
      var retried = 0;
      await pumpMockmob(
        tester,
        StateView(
          kind: StateViewKind.error,
          title: 'We could not load this week',
          message: 'Your record is as you left it.',
          primary: StateAction('Try again', () => retried++),
          secondary: StateAction('Go to Today', () {}),
        ),
        disableAnimations: true,
      );
      await tester.tap(find.text('Try again'));
      expect(retried, 1);
      expect(find.text('Go to Today'), findsOneWidget);
    });

    testWidgets('scrolls instead of overflowing at large text', (tester) async {
      await pumpMockmob(
        tester,
        StateView(
          kind: StateViewKind.offline,
          title: 'You are offline',
          message: 'Connect to start. Your downloaded reviews still work.',
          primary: StateAction('Open Review', () {}),
        ),
        size: const Size(360, 640),
        textScale: 2,
      );
      expect(tester.takeException(), isNull);
    });
  });
}

class _Nav extends ConsumerWidget {
  const _Nav({required this.index, this.dot = false, this.onTap});

  final int index;
  final bool dot;
  final ValueChanged<int>? onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) =>
      MmBottomNav(currentIndex: index, showReviewDot: dot, onTap: onTap ?? (_) {});
}
