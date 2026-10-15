import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/art/hybrid/hybrid.dart';
import 'package:mockmob/core/theme/theme.dart';

final Map<Brightness, ThemeData> _themes = {};

Widget _app(Widget child, {bool reduced = false, Brightness brightness = Brightness.dark, bool tickers = true}) {
  return MaterialApp(
    theme: _themes.putIfAbsent(brightness, () => buildTheme(brightness)),
    home: MediaQuery(
      data: MediaQueryData(disableAnimations: reduced),
      child: TickerMode(enabled: tickers, child: Scaffold(body: Center(child: child))),
    ),
  );
}

void main() {
  group('reduced motion: the final pose, no travel', () {
    testWidgets('a settling compass, a ticking metronome and a stage stopwatch start no clock', (tester) async {
      await tester.pumpWidget(_app(
        const Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            HybridCompass(height: 84, arc: 0.4),
            HybridMetronome(height: 72, ticks: 5),
            HybridStopwatch(height: 64, stage: 1),
          ],
        ),
        reduced: true,
      ));
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('a searching compass holds still', (tester) async {
      await tester.pumpWidget(_app(const HybridCompass(height: 84, searching: true), reduced: true));
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('a bell asked to ring does not move', (tester) async {
      await tester.pumpWidget(_app(const HybridBell(height: 46), reduced: true));
      await tester.pumpWidget(_app(const HybridBell(height: 46, rings: 1), reduced: true));
      expect(tester.hasRunningAnimations, isFalse);
    });
  });

  group('full motion', () {
    testWidgets('the metronome ticks, then its clock stops', (tester) async {
      await tester.pumpWidget(_app(const HybridMetronome(height: 72, ticks: 3)));
      expect(tester.hasRunningAnimations, isTrue);
      await tester.pump(const Duration(seconds: 4));
      await tester.pump(const Duration(milliseconds: 100));
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('a bell rings once per rise of rings and is still after', (tester) async {
      await tester.pumpWidget(_app(const HybridBell(height: 46)));
      expect(tester.hasRunningAnimations, isFalse);
      await tester.pumpWidget(_app(const HybridBell(height: 46, rings: 1)));
      expect(tester.hasRunningAnimations, isTrue);
      await tester.pump(const Duration(seconds: 2));
      await tester.pump(const Duration(milliseconds: 100));
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('a muted bell never rings', (tester) async {
      await tester.pumpWidget(_app(const HybridBell(height: 46, muted: true)));
      await tester.pumpWidget(_app(const HybridBell(height: 46, rings: 1, muted: true)));
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('the stopwatch sweeps per stage and snaps to 12 when done', (tester) async {
      await tester.pumpWidget(_app(const HybridStopwatch(height: 64)));
      await tester.pump(const Duration(seconds: 1));
      expect(tester.hasRunningAnimations, isFalse);
      await tester.pumpWidget(_app(const HybridStopwatch(height: 64, stage: 1)));
      expect(tester.hasRunningAnimations, isTrue);
      await tester.pump(const Duration(seconds: 1));
      await tester.pumpWidget(_app(const HybridStopwatch(height: 64, stage: 2, mode: StopwatchMode.done)));
      expect(tester.hasRunningAnimations, isTrue);
      await tester.pump(const Duration(seconds: 2));
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('a compass that settles stops its clock; a searching one keeps going', (tester) async {
      await tester.pumpWidget(_app(const HybridCompass(height: 84)));
      await tester.pump(const Duration(seconds: 4));
      await tester.pump(const Duration(milliseconds: 100));
      expect(tester.hasRunningAnimations, isFalse);
      await tester.pumpWidget(_app(const HybridCompass(height: 84, searching: true)));
      await tester.pump(const Duration(seconds: 4));
      expect(tester.hasRunningAnimations, isTrue);
      await tester.pumpWidget(_app(const HybridCompass(height: 84)));
      await tester.pump(const Duration(seconds: 4));
      await tester.pump(const Duration(milliseconds: 100));
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('TickerMode off holds the clock', (tester) async {
      await tester.pumpWidget(_app(const HybridCompass(height: 84, searching: true), tickers: false));
      expect(tester.hasRunningAnimations, isFalse);
    });
  });

  testWidgets('the objects are decorative: nothing reaches the accessibility tree, in Night and Day', (tester) async {
    final handle = tester.ensureSemantics();
    for (final b in Brightness.values) {
      await tester.pumpWidget(_app(
        const Column(
          mainAxisSize: MainAxisSize.min,
          children: [HybridCompass(height: 84), HybridMetronome(height: 72, paused: true), HybridStopwatch(height: 64), HybridBell(height: 46, muted: true)],
        ),
        brightness: b,
        reduced: true,
      ));
      expect(find.bySemanticsLabel(RegExp('.+')), findsNothing);
      final size = tester.getSize(find.byType(HybridCompass));
      expect(size.height, 84);
      expect(size.width, closeTo(84 * HybridSpec.compass.aspect, 0.01));
    }
    handle.dispose();
  });
}
