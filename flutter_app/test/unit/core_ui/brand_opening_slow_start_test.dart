import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/brand/brand_opening.dart';

/// The cold start on a slow phone: the system splash covers the "mo" for seconds (a debug build
/// on a 2 GB phone drew its first frame after 5.9 s). The opening must hold the "mo" for as long
/// as that takes, then play in full from its first visible frame, and never hand off under the
/// splash (which showed as a held "mo", a cut to Today, and a ghost "mo" faded over it).

class _CountingHaptics implements HapticDriver {
  int light = 0;

  @override
  Future<void> lightImpact() async => light++;

  @override
  Future<void> mediumImpact() async {}

  @override
  Future<void> selectionClick() async {}
}

const MethodChannel _splash = MethodChannel('in.mockmob.app/splash');

Future<void> _pump(WidgetTester tester, Widget child, {bool reduced = false, _CountingHaptics? haptics}) async {
  tester.view.devicePixelRatio = 2;
  tester.view.physicalSize = const Size(384, 853) * 2;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: haptics ?? _CountingHaptics()))],
      child: MaterialApp(
        theme: buildTheme(Brightness.dark),
        builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: reduced), child: app!),
        home: child,
      ),
    ),
  );
}

/// Pumps [ms] in 16 ms frames.
Future<void> _run(WidgetTester tester, int ms) async {
  for (var left = ms; left > 0; left -= 16) {
    await tester.pump(Duration(milliseconds: left < 16 ? left : 16));
  }
}

void main() {
  testWidgets('a slow start holds the "mo" under the splash, then plays the whole opening', (tester) async {
    final haptics = _CountingHaptics();
    final glass = Completer<void>();
    final events = <String>[];
    await _pump(
      tester,
      BrandOpening(
        shown: glass.future,
        onPrepaint: () => events.add('paint'),
        onReveal: () => events.add('reveal'),
        onDone: () => events.add('done'),
      ),
      haptics: haptics,
    );
    // The app is ready, but the splash is still up for 6 s: nothing plays or hands off under it.
    await _run(tester, 6000);
    expect(events, isEmpty, reason: 'nothing hands off under the splash');
    expect(haptics.light, 0, reason: 'the ink has not played out of sight');

    glass.complete();
    await tester.pump();
    final seen = <String, int>{};
    for (var ms = 0; ms <= 1600; ms += 10) {
      await tester.pump(const Duration(milliseconds: 10));
      if (haptics.light > 0) seen.putIfAbsent('ink', () => ms);
      for (final e in events) {
        seen.putIfAbsent(e, () => ms);
      }
    }
    // The hold, the ink, the unfold and the hand-off, on the nominal timeline from the first
    // visible frame (to a frame or so): the app waits about 1.3 s for it, no more.
    expect(seen['ink'], inInclusiveRange(OpeningTimeline.hapticAt - 20, OpeningTimeline.hapticAt + 20));
    expect(seen['paint'], inInclusiveRange(830, 870));
    expect(seen['reveal'], inInclusiveRange(OpeningTimeline.settledAt - 20, OpeningTimeline.settledAt + 20));
    expect(seen['done'], lessThanOrEqualTo(OpeningTimeline.settledAt + OpeningTimeline.fadeMs + 40));
    expect(events, ['paint', 'reveal', 'done']);
  });

  testWidgets('a long start never runs the clock out: it still hands off once the app is ready', (tester) async {
    final glass = Completer<void>();
    var done = 0;
    final opening = GlobalKey();
    Widget build(bool ready) => BrandOpening(key: opening, ready: ready, shown: glass.future, onDone: () => done++);
    await _pump(tester, build(false));
    await _run(tester, 5000);
    glass.complete();
    await tester.pump();
    // The word holds while the app loads, past where a bounded clock would have stopped.
    await _run(tester, 6000);
    expect(done, 0);
    await _pump(tester, build(true));
    await _run(tester, 500);
    expect(done, 1);
  });

  testWidgets('the safety net waits out any splash, and then lifts the splash with no fade', (tester) async {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    final asked = <Object?>[];
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(_splash, (call) async {
      asked.add(call.arguments);
      return true;
    });
    try {
      final haptics = _CountingHaptics();
      var done = 0;
      await _pump(tester, BrandOpening(shown: Completer<void>().future, onDone: () => done++), haptics: haptics);
      // Longer than the slowest start seen plus Android's own 3 s hold.
      await _run(tester, 9000);
      expect(haptics.light, 0);
      expect(done, 0);
      await _run(tester, 2600);
      expect(haptics.light, 1, reason: 'a platform that never answers cannot hold the app for good');
      expect(done, 1);
      expect(asked, [false], reason: 'a splash Android never reported gone is taken off at once');
    } finally {
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(_splash, null);
      debugDefaultTargetPlatformOverride = null;
    }
  });

  testWidgets('a confirmed splash is never asked to go again', (tester) async {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    final asked = <Object?>[];
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(_splash, (call) async {
      asked.add(call.arguments);
      return true;
    });
    try {
      var done = 0;
      await _pump(tester, BrandOpening(shown: Future<void>.value(), onDone: () => done++));
      await _run(tester, 1500);
      expect(done, 1);
      expect(asked, isEmpty);
    } finally {
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(_splash, null);
      debugDefaultTargetPlatformOverride = null;
    }
  });

  testWidgets('an answer after the net restarts the opening at the "mo" if it has not handed off', (tester) async {
    final haptics = _CountingHaptics();
    final glass = Completer<void>();
    await _pump(tester, BrandOpening(ready: false, shown: glass.future, onDone: () {}), haptics: haptics);
    await _run(tester, 10000);
    await _run(tester, 300);
    expect(haptics.light, 0);
    glass.complete();
    await tester.pump();
    await _run(tester, 360);
    expect(haptics.light, 0, reason: 'the hold plays again where it can be seen');
    await _run(tester, 60);
    expect(haptics.light, 1);
  });

  testWidgets('reduced motion on a slow start: nothing under the splash, then the short crossfade', (tester) async {
    final glass = Completer<void>();
    var done = 0;
    await _pump(tester, BrandOpening(shown: glass.future, onDone: () => done++), reduced: true);
    await _run(tester, 6000);
    expect(done, 0);
    glass.complete();
    await tester.pump();
    await _run(tester, 150);
    expect(done, 0);
    await _run(tester, 300);
    expect(done, 1);
  });

  testWidgets('asking Android to lift the splash gives up on a silent channel', (tester) async {
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(_splash, (call) => Completer<Object?>().future);
    try {
      bool? answered;
      unawaited(OpeningGlass.release().then((ok) => answered = ok));
      await tester.pump(OpeningGlass.answerCap - const Duration(milliseconds: 100));
      expect(answered, isNull);
      await tester.pump(const Duration(milliseconds: 200));
      expect(answered, isFalse, reason: 'a release nobody answered is not a splash that is gone');
    } finally {
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(_splash, null);
    }
  });

  testWidgets('a release that Android answers says so', (tester) async {
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(_splash, (call) async => true);
    try {
      expect(await OpeningGlass.release(), isTrue);
    } finally {
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(_splash, null);
    }
  });

  testWidgets('a release that Android never answers still hands off, and lifts the splash at once', (tester) async {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    OpeningGlass.debugFirstFrameDrawn = true;
    final asked = <Object?>[];
    // Android answers the lift-now ask (it carries an argument) but sits on the fade-off ask.
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(_splash, (call) {
      asked.add(call.arguments);
      return call.arguments == null ? Completer<Object?>().future : Future<Object?>.value(true);
    });
    try {
      var done = 0;
      await _pump(tester, BrandOpening(onDone: () => done++));
      // The platform asks for the fade-off and is not answered, so it is not confirmed.
      await _run(tester, OpeningGlass.answerCap.inMilliseconds + 200);
      expect(asked, [null], reason: 'only the fade-off was asked so far');
      expect(done, 0);
      // The "mo" starts after the cap; the hand-off must not trust an answer that never came.
      await _run(tester, 1500);
      expect(done, 1);
      expect(asked, [null, false], reason: 'an unanswered release is lifted with no fade, never faded over the first screen');
    } finally {
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(_splash, null);
      debugDefaultTargetPlatformOverride = null;
      OpeningGlass.debugFirstFrameDrawn = false;
    }
  });

  testWidgets('a release that Android answers is never asked to lift again at the hand-off', (tester) async {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    OpeningGlass.debugFirstFrameDrawn = true;
    final asked = <Object?>[];
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(_splash, (call) async {
      asked.add(call.arguments);
      return true;
    });
    try {
      var done = 0;
      await _pump(tester, BrandOpening(onDone: () => done++));
      await _run(tester, 1700);
      expect(done, 1);
      expect(asked, [null], reason: 'one ask, answered; nothing left to lift');
    } finally {
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(_splash, null);
      debugDefaultTargetPlatformOverride = null;
      OpeningGlass.debugFirstFrameDrawn = false;
    }
  });
}
