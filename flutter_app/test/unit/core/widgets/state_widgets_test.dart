import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mockmob/core/copy/state_words.dart';
import 'package:mockmob/core/motion/motion.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../motion/motion_harness.dart';

const _art = ValueKey('art');
const _slowArt = ValueKey('slow-art');
const _skeleton = ValueKey('skeleton');
const _content = ValueKey('content');

/// The opacity [key] shows: every [Opacity] above it, multiplied (0 when it is not there).
double _shown(WidgetTester tester, Key key) {
  final finder = find.byKey(key);
  if (finder.evaluate().isEmpty) return 0;
  var o = 1.0;
  for (final w in tester.widgetList<Opacity>(find.ancestor(of: finder, matching: find.byType(Opacity)))) {
    o *= w.opacity;
  }
  return o;
}

Widget _state({required bool loading, VoidCallback? onSlow}) {
  return StateView(
    kind: StateViewKind.empty,
    title: 'Nothing saved yet',
    message: 'Questions you save show here.',
    primary: StateAction('Try again', () {}, loading: loading),
    art: const SizedBox(key: _art, width: 40, height: 40),
    slowArt: const SizedBox(key: _slowArt, width: 40, height: 40),
    onSlow: onSlow,
  );
}

void main() {
  group('StateView', () {
    testWidgets('a long wait swaps the Mobi slot to the slow art and says so, then swaps back', (tester) async {
      var slow = 0;
      await tester.pumpWidget(motionApp(_state(loading: true, onSlow: () => slow++)));
      await tester.pump(const Duration(seconds: 1));
      expect(find.byKey(_art), findsOneWidget);
      expect(find.byKey(_slowArt), findsNothing);

      await tester.pump(StateView.slowAfter);
      await pumpFrames(tester, const Duration(milliseconds: 400));
      expect(slow, 1, reason: 'told once as the words change');
      expect(find.byKey(_slowArt), findsOneWidget);
      expect(find.byKey(_art), findsNothing, reason: 'the old picture has gone once the new one is in');
      expect(find.text(StateView.slowWords), findsOneWidget);

      await tester.pumpWidget(motionApp(_state(loading: false, onSlow: () => slow++)));
      await pumpFrames(tester, const Duration(milliseconds: 400));
      expect(find.byKey(_art), findsOneWidget);
      expect(find.byKey(_slowArt), findsNothing);
      expect(find.text('Questions you save show here.'), findsOneWidget);
      expect(slow, 1);
    });

    testWidgets('the slot swap never shows a blank frame', (tester) async {
      await tester.pumpWidget(motionApp(_state(loading: true)));
      await tester.pump(StateView.slowAfter);
      var least = 2.0;
      for (var i = 0; i < 40; i++) {
        await tester.pump(const Duration(milliseconds: 8));
        final sum = _shown(tester, _art) + _shown(tester, _slowArt);
        if (sum < least) least = sum;
      }
      expect(least, greaterThanOrEqualTo(MmOverlapSwitcher.floor - 1e-6));
    });
  });

  group('MmSkeletonSwitcher', () {
    Widget at({required bool loading, bool reduced = false}) => motionApp(
          Align(
            alignment: Alignment.topLeft,
            child: SizedBox(
              width: 300,
              child: MmSkeletonSwitcher(
                loading: loading,
                skeleton: const SizedBox(key: _skeleton, height: 80),
                child: const SizedBox(key: _content, height: 80),
              ),
            ),
          ),
          reduced: reduced,
        );

    testWidgets('skeleton to content with no blank frame, both full width', (tester) async {
      await tester.pumpWidget(at(loading: true));
      expect(tester.getSize(find.byKey(_skeleton)).width, 300, reason: 'passthrough: the parent width reaches the skeleton');
      await tester.pumpWidget(at(loading: false));
      var least = 2.0;
      for (var i = 0; i < 40; i++) {
        final sum = _shown(tester, _skeleton) + _shown(tester, _content);
        if (sum < least) least = sum;
        await tester.pump(const Duration(milliseconds: 8));
      }
      expect(least, greaterThanOrEqualTo(MmOverlapSwitcher.floor - 1e-6));
      await tester.pumpAndSettle();
      expect(find.byKey(_skeleton), findsNothing);
      expect(_shown(tester, _content), 1);
    });

    testWidgets('a cache hit shows the content at once; reduced motion swaps in a short fade', (tester) async {
      await tester.pumpWidget(at(loading: false));
      expect(_shown(tester, _content), 1);
      expect(find.byKey(_skeleton), findsNothing);

      await tester.pumpWidget(at(loading: true, reduced: true));
      await pumpFrames(tester, Motion.reducedFade + const Duration(milliseconds: 120));
      expect(find.byKey(_content), findsNothing, reason: 'the short fade and the 90 ms hand-off are over');
      expect(_shown(tester, _skeleton), 1);
      expect(tester.hasRunningAnimations, isFalse);
    });
  });

  group('SkeletonGroup', () {
    Widget at({required bool reduced}) => motionApp(
          const SkeletonGroup(shimmer: true, child: Skeleton(width: 200)),
          reduced: reduced,
        );

    testWidgets('the light sweeps a few times and then rests', (tester) async {
      await tester.pumpWidget(at(reduced: false));
      expect(tester.hasRunningAnimations, isTrue);
      await tester.pump((Motion.shimmerSweep + Motion.shimmerRest) * Motion.shimmerSweeps);
      await tester.pump(const Duration(milliseconds: 16));
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('reduced motion is still from the start, and stops a sweep already running', (tester) async {
      await tester.pumpWidget(at(reduced: true));
      expect(tester.hasRunningAnimations, isFalse);

      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(at(reduced: false));
      await tester.pump(const Duration(milliseconds: 300));
      expect(tester.hasRunningAnimations, isTrue);
      await tester.pumpWidget(at(reduced: true));
      await tester.pump(const Duration(milliseconds: 16));
      expect(tester.hasRunningAnimations, isFalse, reason: 'Reduce motion turned on mid-sweep stops the light');
    });
  });

  group('ReceiptLine', () {
    testWidgets('slides in over 160 ms and comes to rest', (tester) async {
      await tester.pumpWidget(motionApp(const ReceiptLine(text: 'Recorded at 9:41 PM.')));
      expect(_shownText(tester, 'Recorded at 9:41 PM.'), lessThan(0.5), reason: 'it arrives, not appears');
      await tester.pump(ReceiptLine.arrive);
      await tester.pumpAndSettle();
      expect(_shownText(tester, 'Recorded at 9:41 PM.'), 1);
    });

    testWidgets('pending to recorded swaps glyph and words in place with no blank frame', (tester) async {
      await tester.pumpWidget(motionApp(const ReceiptLine.pending()));
      await tester.pumpAndSettle();
      expect(find.byIcon(LucideIcons.smartphone), findsOneWidget);

      await tester.pumpWidget(motionApp(const ReceiptLine(text: 'Recorded at 9:41 PM.')));
      await tester.pump(const Duration(milliseconds: 16));
      expect(find.byIcon(LucideIcons.smartphone), findsOneWidget, reason: 'the old glyph holds while the new one comes in');
      var least = 2.0;
      for (var i = 0; i < 40; i++) {
        final sum = _shownText(tester, Receipts.notRecordedYet) + _shownText(tester, 'Recorded at 9:41 PM.');
        if (sum < least) least = sum;
        await tester.pump(const Duration(milliseconds: 8));
      }
      expect(least, greaterThanOrEqualTo(MmOverlapSwitcher.floor - 1e-6));
      await tester.pumpAndSettle();
      expect(find.byIcon(LucideIcons.smartphone), findsNothing);
      expect(find.text(Receipts.notRecordedYet), findsNothing);
      expect(find.text('Recorded at 9:41 PM.'), findsOneWidget);
    });

    testWidgets('reduced motion: simply there', (tester) async {
      await tester.pumpWidget(motionApp(const ReceiptLine(text: 'Recorded at 9:41 PM.'), reduced: true));
      expect(_shownText(tester, 'Recorded at 9:41 PM.'), 1);
      expect(tester.hasRunningAnimations, isFalse);
    });
  });
}

double _shownText(WidgetTester tester, String text) {
  final finder = find.text(text);
  if (finder.evaluate().isEmpty) return 0;
  var o = 1.0;
  for (final w in tester.widgetList<Opacity>(find.ancestor(of: finder, matching: find.byType(Opacity)))) {
    o *= w.opacity;
  }
  return o;
}
