// F7 (spec 7.2 countdown_test): at every 20 ms frame of the countdown at most one numeral is visible
// with opacity over 0.05, and the numeral layer is above the stopwatch art in paint order. Also: the
// beats keep their times, the haptics fall on 3, 2, 1 and Go, the skip lands in 200 ms, and reduced
// motion cross-fades numerals in place.

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/features/social/v3/widgets/countdown_stopwatch.dart';

import '../../../unit/social/v3/run_test_kit.dart';

class _Driver implements HapticDriver {
  final List<String> calls = [];
  @override
  Future<void> selectionClick() async => calls.add('selection');
  @override
  Future<void> lightImpact() async => calls.add('light');
  @override
  Future<void> mediumImpact() async => calls.add('medium');
}

/// The numeral layers on screen now: (n, opacity).
List<(String, double)> _numerals(WidgetTester tester) => [
      for (final e in tester.widgetList<Opacity>(find.byWidgetPredicate((w) => w is Opacity && w.key is ValueKey<String> && (w.key! as ValueKey<String>).value.startsWith('cd-numeral-'))))
        ((e.key! as ValueKey<String>).value, e.opacity),
    ];

void main() {
  group('timeline (pure)', () {
    test('one numeral at a time: the next starts only after the last is gone', () {
      for (final reduced in [false, true]) {
        for (var t = 0.0; t <= CountdownTimeline.end; t += 1) {
          final n = CountdownTimeline.numeral(t, reduced: reduced);
          if (t >= CountdownTimeline.go) {
            expect(n, isNull);
            continue;
          }
          expect(n!.n, 3 - (t / 600).floor());
          // The last 1 ms before the next beat is nearly blank: the old numeral is gone first.
          final local = t % 600;
          if (local > 599) expect(n.opacity, lessThan(0.05), reason: 't=$t reduced=$reduced');
        }
      }
    });

    test('stamp in 0-180 from 1.25, hold, leave 460-600 to 0.92', () {
      expect(CountdownTimeline.numeral(0, reduced: false)!.scale, closeTo(1.25, 0.001));
      expect(CountdownTimeline.numeral(180, reduced: false)!.scale, 1);
      expect(CountdownTimeline.numeral(300, reduced: false)!.opacity, 1);
      expect(CountdownTimeline.numeral(460, reduced: false)!.opacity, 1);
      expect(CountdownTimeline.numeral(599.9, reduced: false)!.scale, closeTo(0.92, 0.002));
      // Reduced motion: no scale at all.
      for (var t = 0.0; t < 1800; t += 10) {
        expect(CountdownTimeline.numeral(t, reduced: true)!.scale, 1);
      }
    });

    test('Go stamps at 1800 from 1.4, one ring 0.6 to 1.6 over 420, the stage leaves at 2400', () {
      expect(CountdownTimeline.goTile(1799, reduced: false), isNull);
      expect(CountdownTimeline.goTile(1800, reduced: false)!.scale, closeTo(1.4, 0.001));
      expect(CountdownTimeline.ring(1800, reduced: false)!.scale, closeTo(0.6, 0.001));
      expect(CountdownTimeline.ring(2221, reduced: false), isNull);
      expect(CountdownTimeline.ring(1900, reduced: true), isNull);
      expect(CountdownTimeline.stage(2400, reduced: false), 1);
      expect(CountdownTimeline.stage(2700, reduced: false), 0);
      expect(CountdownTimeline.body(2700, reduced: false), 1);
      expect(CountdownTimeline.tiltDeg(600, reduced: false), closeTo(1.5, 0.001));
      expect(CountdownTimeline.tiltDeg(1200, reduced: false), closeTo(-1.5, 0.001));
      expect(CountdownTimeline.tiltDeg(900, reduced: true), 0);
      expect(CountdownTimeline.scrim(1800), closeTo(0.45, 0.001));
      expect(CountdownTimeline.arc(900, reduced: false), closeTo(0.5, 0.001));
      expect(CountdownTimeline.arc(900, reduced: true), closeTo(2 / 3, 0.001));
    });
  });

  for (final reduced in [false, true]) {
    testWidgets('F7 at every 20 ms frame at most one numeral shows (reduced: $reduced)', (tester) async {
      await pumpRun(tester, RecordingServer(), reduced: reduced);
      final end = CountdownTimeline.endFor(reduced: reduced).round();
      var seen = <String>{};
      for (var t = 0; t <= end; t += 20) {
        final visible = [for (final (k, o) in _numerals(tester)) if (o > 0.05) k];
        expect(visible.length, lessThanOrEqualTo(1), reason: 'frame $t ms: $visible');
        seen.addAll(visible);
        await tester.pump(const Duration(milliseconds: 20));
      }
      expect(seen, {'cd-numeral-3', 'cd-numeral-2', 'cd-numeral-1'});
      // The countdown has handed over to question 1.
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.byKey(const ValueKey('run-countdown')), findsNothing);
      expect(find.text('Question 1 of 5'), findsOneWidget);
    });
  }

  testWidgets('the numeral layer is above the art, and Go above both, in paint order', (tester) async {
    await pumpRun(tester, RecordingServer());
    await tester.pump(const Duration(milliseconds: 300));
    final stack = tester.widget<Stack>(find.byKey(const ValueKey('cd-layers')));
    final keys = [for (final c in stack.children) (c.key as ValueKey<String>?)?.value];
    expect(keys.indexOf('cd-art'), 0);
    expect(keys.indexOf('cd-numerals'), greaterThan(keys.indexOf('cd-art')));
    expect(keys.indexOf('cd-go'), greaterThan(keys.indexOf('cd-numerals')));
    // The pivot is part of the art (the image), never painted over the numeral.
    expect(find.descendant(of: find.byKey(const ValueKey('cd-art')), matching: find.byType(Image)), findsOneWidget);
    expect(find.descendant(of: find.byKey(const ValueKey('cd-numerals')), matching: find.byType(Image)), findsNothing);
  });

  testWidgets('haptics: selection on 3, 2 and 1, light on Go', (tester) async {
    final driver = _Driver();
    await pumpRun(tester, RecordingServer(), extra: [hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: driver))]);
    for (var t = 0; t <= 2000; t += 20) {
      await tester.pump(const Duration(milliseconds: 20));
    }
    expect(driver.calls, ['selection', 'selection', 'selection', 'light']);
    await tester.pump(const Duration(seconds: 1));
  });

  testWidgets('Skip lands question 1 within 200 ms, and any tap on the stage skips', (tester) async {
    await pumpRun(tester, RecordingServer());
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('Skip'), findsWidgets);
    await tester.tap(find.descendant(of: find.byKey(const ValueKey('run-countdown')), matching: find.text('Skip')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pump();
    expect(find.byKey(const ValueKey('run-countdown')), findsNothing);
    expect(find.text('Question 1 of 5'), findsOneWidget);

    // A tap anywhere on the stage does the same.
    await pumpRun(tester, RecordingServer());
    await tester.pump(const Duration(milliseconds: 700));
    await tester.tapAt(const Offset(180, 300));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 201));
    await tester.pump();
    expect(find.byKey(const ValueKey('run-countdown')), findsNothing);
  });

  testWidgets('the line under the heads names question 1 and the marks', (tester) async {
    await pumpRun(tester, RecordingServer());
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.text('Question 1 of 5 is next. +5 if right, -1 if wrong, 0 if you skip.'), findsOneWidget);
    expect(find.text('Riya'), findsWidgets);
    expect(find.text('You'), findsWidgets);
    await tester.pump(const Duration(seconds: 3));
  });
}
