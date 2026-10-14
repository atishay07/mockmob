import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/router/splash_screen.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/brand/brand_logo.dart';
import 'package:mockmob/core/widgets/brand/brand_opening.dart';

/// The launch screen of a slow start (the session is still being read): the opening's last frame,
/// with Mobi's idle blink carried on, so a long wait is never a still picture and never a spinner.

const Size _phone = Size(384, 853);

Future<void> _pump(WidgetTester tester, {bool reduced = false}) async {
  tester.view.devicePixelRatio = 2;
  tester.view.physicalSize = _phone * 2;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        theme: buildTheme(Brightness.dark),
        builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: reduced), child: app!),
        home: const SplashScreen(),
      ),
    ),
  );
}

/// How closed Mobi's eyes are in the frame the screen would paint now.
double _blink(WidgetTester tester) {
  final painter = tester
      .widgetList<CustomPaint>(find.descendant(of: find.byType(SplashScreen), matching: find.byType(CustomPaint)))
      .map((c) => c.painter)
      .whereType<BrandLogoPainter>()
      .first;
  return painter.poseOf!(_phone).mobi.blink;
}

void main() {
  tearDown(() => SplashScreen.idleEnabled = false);

  test('the launch pose is the opening\'s word, with the eyes open except in a blink', () {
    final still = OpeningTimeline.wordPose(_phone);
    final open = OpeningTimeline.launchPoseAt(_phone, 0);
    expect(open.view, still.view);
    expect(open.mobi.blink, 0);
    expect(open.mobi.detail, still.mobi.detail);
    expect(OpeningTimeline.launchPoseAt(_phone, 60).mobi.blink, closeTo(1, 1e-6));
    expect(OpeningTimeline.launchPoseAt(_phone, OpeningTimeline.blinkMs).mobi.blink, 0);
  });

  testWidgets('by default it is a still frame: no blink, nothing running (tests and goldens)', (tester) async {
    await _pump(tester);
    await tester.pump(const Duration(seconds: 6));
    expect(_blink(tester), 0);
  });

  testWidgets('a slow start: Mobi blinks where the opening\'s idle would, then every 2.8 s', (tester) async {
    SplashScreen.idleEnabled = true;
    await _pump(tester);
    await tester.pump(const Duration(milliseconds: 1800));
    expect(_blink(tester), 0, reason: 'eyes open until the first idle blink');
    // The timer fires at 1.9 s; the blink's own clock starts on the next frame.
    await tester.pump(const Duration(milliseconds: 160));
    await tester.pump(const Duration(milliseconds: 60));
    expect(_blink(tester), greaterThan(0.5), reason: 'the first blink, at about 1.9 s');
    await tester.pump(const Duration(milliseconds: 200));
    expect(_blink(tester), 0, reason: 'a blink is 160 ms');
    await tester.pump(const Duration(milliseconds: 2380));
    expect(_blink(tester), 0);
    await tester.pump(const Duration(milliseconds: 120));
    await tester.pump(const Duration(milliseconds: 60));
    expect(_blink(tester), greaterThan(0.5), reason: 'the next, 2.8 s after the first');
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 6));
  });

  testWidgets('it asks for no frames between blinks', (tester) async {
    SplashScreen.idleEnabled = true;
    await _pump(tester);
    await tester.pump(const Duration(milliseconds: 1000));
    expect(tester.binding.hasScheduledFrame, isFalse, reason: 'a held launch screen is a still picture between blinks');
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 6));
  });

  testWidgets('reduced motion: he does not blink', (tester) async {
    SplashScreen.idleEnabled = true;
    await _pump(tester, reduced: true);
    await tester.pump(const Duration(milliseconds: 1900));
    await tester.pump(const Duration(milliseconds: 120));
    await tester.pump(const Duration(milliseconds: 60));
    expect(_blink(tester), 0);
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 6));
  });

  testWidgets('leaving the launch screen before the first blink leaves no timer behind', (tester) async {
    SplashScreen.idleEnabled = true;
    await _pump(tester);
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 6));
    expect(tester.takeException(), isNull);
  });
}
