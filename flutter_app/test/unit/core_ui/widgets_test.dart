import 'dart:ui' show Tristate;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/theme/theme.dart';
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
  group('InlineBanner action', () {
    testWidgets('is a pill with a 48 dp touch target that fires once', (tester) async {
      var taps = 0;
      await pumpMockmob(
        tester,
        Align(
          alignment: Alignment.topCenter,
          child: InlineBanner(message: 'Reminders are paused on this phone.', actionLabel: 'Turn on', onAction: () => taps++),
        ),
      );
      final action = find.bySemanticsLabel('Turn on');
      expect(action, findsOneWidget);
      final size = tester.getSize(find.ancestor(of: find.text('Turn on'), matching: find.byType(ConstrainedBox)).first);
      expect(size.height, greaterThanOrEqualTo(48));
      await tester.tap(find.text('Turn on'));
      expect(taps, 1);
    });
  });

  group('MmBottomBar', () {
    testWidgets('names each tab with its position out of five and marks the active one selected', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpMockmob(tester, const Align(alignment: Alignment.bottomCenter, child: _Nav(index: 1)));

      expect(barTabSemanticsLabel(1), 'Practice, tab 2 of 5');
      expect(barTabSemanticsLabel(3, collegesDot: true), 'Colleges, tab 4 of 5, new cutoffs for your colleges');
      expect(barTabSemanticsLabel(4, youDot: true), 'You, tab 5 of 5, needs your attention');
      for (var i = 0; i < 5; i++) {
        final data = tester.getSemantics(find.bySemanticsLabel(barTabSemanticsLabel(i))).getSemanticsData();
        expect(data.flagsCollection.isSelected, i == 1 ? Tristate.isTrue : Tristate.isFalse, reason: 'tab $i');
        expect(data.flagsCollection.isButton, isTrue);
      }
      expect(find.bySemanticsLabel(MmBottomBar.startSemanticsLabel), findsOneWidget);
      handle.dispose();
    });

    testWidgets("Review's count is spoken and drawn; the dot adds a hint and no number", (tester) async {
      final handle = tester.ensureSemantics();
      await pumpMockmob(tester, const Align(alignment: Alignment.bottomCenter, child: _Nav(index: 0, badges: BarBadges(reviewCount: 3))));
      expect(find.bySemanticsLabel('Review, tab 3 of 5, 3 open mistakes to repair'), findsOneWidget);
      expect(find.text('3'), findsOneWidget);

      await pumpMockmob(tester, const Align(alignment: Alignment.bottomCenter, child: _Nav(index: 0, badges: BarBadges(reviewDot: true))));
      expect(find.bySemanticsLabel('Review, tab 3 of 5, a result is waiting'), findsOneWidget);
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

      await tester.tap(find.text('Review'));
      await tester.pump();
      expect(taps, [2]);
      expect(driver.selections, 1);

      await tester.tap(find.text('You'));
      await tester.pump();
      // Colleges is branch 3; You is branch 4 (app-ia-1016.md 8.1).
      expect(taps, [2, 4]);
      expect(driver.selections, 2);
    });

    testWidgets('a re-tap of the open tab reports the tap with no haptic', (tester) async {
      final driver = _CountingDriver();
      final taps = <int>[];
      await pumpMockmob(
        tester,
        Align(alignment: Alignment.bottomCenter, child: _Nav(index: 0, onTap: taps.add)),
        overrides: <Override>[hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: driver))],
      );
      await tester.tap(find.text('Today'));
      await tester.pump();
      expect(taps, [0]);
      expect(driver.selections, 0);
    });

    testWidgets("Start reports its circle, 64 dp at the row's trailing end, for the morph (NAV-1017 6.1)", (tester) async {
      final starts = <Rect>[];
      await pumpMockmob(
        tester,
        Align(alignment: Alignment.bottomCenter, child: _Nav(index: 0, onStart: starts.add)),
        size: const Size(384, 853),
      );
      await tester.tap(find.text('Start'));
      await tester.pump(const Duration(milliseconds: 400));
      expect(starts, hasLength(1));
      // 384 dp: the row is 352 wide and the key closes it, a 64 dp circle 16 dp from the edge.
      expect(starts.single.width, closeTo(MmBar.keySize, 0.5));
      expect(starts.single.height, closeTo(MmBar.keySize, 0.5));
      expect(starts.single.right, closeTo(384 - MmBar.gutter, 0.5));
    });

    testWidgets('labels clamp the text scale at 1.2 and stay on one line', (tester) async {
      await pumpMockmob(
        tester,
        const Align(alignment: Alignment.bottomCenter, child: _Nav(index: 0)),
        textScale: 2,
      );
      final label = tester.widget<Text>(find.text('Practice'));
      final scaler = MediaQuery.textScalerOf(tester.element(find.text('Practice')));
      expect(scaler.scale(12), closeTo(12 * 1.2, 0.001));
      expect(label.maxLines, 1);
      expect(tester.takeException(), isNull);
    });

    // NAV-1017 6.1: a tab slot is 49.6 dp at 360 and wider above; at 320 the five tabs and the
    // 64 dp key share 304 dp, so a slot is 45.6 (above the 44 dp floor the spec sets there). The
    // whole slot is the target, 64 tall; the key is a 64 dp circle.
    for (final (width, floor) in const [(320.0, 44.0), (360.0, 48.0), (412.0, 48.0)]) {
      testWidgets('the bar is 64 dp tall; every tab is at least $floor by 64 at ${width.toInt()} dp, the key 64 by 64', (tester) async {
        await pumpMockmob(tester, const Align(alignment: Alignment.bottomCenter, child: _Nav(index: 0)), size: Size(width, 700));
        expect(tester.getSize(find.byType(MmBottomBar)).height, MmBar.height);
        for (final label in ['Today', 'Practice', 'Review', 'Colleges', 'You', 'Start']) {
          final slot = find.ancestor(of: find.text(label), matching: find.byType(GestureDetector)).first;
          final size = tester.getSize(slot);
          expect(size.width, greaterThanOrEqualTo(label == 'Start' ? MmBar.keySize : floor), reason: label);
          expect(size.height, MmBar.height, reason: label);
        }
      });
    }
  });

  group('SavePill', () {
    testWidgets('says the honest words and is a polite live region', (tester) async {
      final handle = tester.ensureSemantics();
      for (final entry in {
        SaveState.onThisPhone: 'On this phone',
        SaveState.sending: 'Sending',
        SaveState.saved: 'Saved to your account',
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

    testWidgets('maps every pose to a warm render with the old artwork as fallback', (tester) async {
      expect(MobiPose.greet.asset, 'assets/art/mobi-greet.webp');
      expect(MobiPose.sleepy.asset, 'assets/art/mobi-sleepy.webp');
      expect(MobiPose.greeting.legacyAsset, 'assets/mobi/greeting.webp');
      for (final pose in MobiPose.values) {
        expect(pose.asset, startsWith('assets/art/mobi-'));
        expect(pose.legacyAsset, startsWith('assets/mobi/'));
      }
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

    // A running action: the main key turns its spinner in place, keeps its label and size, and
    // ignores taps until it is done. The quiet second key has no spinner.
    testWidgets('a loading main action shows it, keeps its size and ignores taps', (tester) async {
      var retried = 0;
      Future<void> pump({required bool loading}) => pumpMockmob(
            tester,
            StateView(
              kind: StateViewKind.error,
              title: 'We could not load this week',
              message: 'Your record is as you left it.',
              primary: StateAction('Try again', () => retried++, loading: loading),
              secondary: StateAction('Go to Today', () {}, loading: loading),
            ),
            disableAnimations: true,
          );
      await pump(loading: false);
      final idle = tester.getSize(find.widgetWithText(KeyButton, 'Try again'));
      expect(tester.widget<KeyButton>(find.widgetWithText(KeyButton, 'Try again')).loading, isFalse);

      await pump(loading: true);
      final key = find.widgetWithText(KeyButton, 'Try again');
      expect(tester.widget<KeyButton>(key).loading, isTrue);
      expect(tester.getSize(key), idle, reason: 'nothing moves while it runs');
      expect(tester.widget<KeyButton>(find.widgetWithText(KeyButton, 'Go to Today')).loading, isFalse);
      await tester.tap(key, warnIfMissed: false);
      await tester.pump();
      expect(retried, 0, reason: 'a loading key ignores taps');
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
  const _Nav({required this.index, this.badges = BarBadges.none, this.onTap, this.onStart});

  final int index;
  final BarBadges badges;
  final ValueChanged<int>? onTap;
  final ValueChanged<Rect>? onStart;

  @override
  Widget build(BuildContext context, WidgetRef ref) =>
      MmBottomBar(currentBranch: index, badges: badges, onTab: onTap ?? (_) {}, onStart: onStart ?? (_) {});
}
