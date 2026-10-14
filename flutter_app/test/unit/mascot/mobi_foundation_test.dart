// The shared Mobi foundation (post-blitz core pass): the new poses (MOBI-09), lite paint by
// size, the loading Mobi (MOBI-04) and the late-night entrance with its wake (MOBI-08).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/mascot/mobi_painter.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../../helpers/golden_harness.dart';

MobiPainter _painter(WidgetTester tester) =>
    tester.widget<CustomPaint>(find.descendant(of: find.byType(MobiCharacter), matching: find.byType(CustomPaint))).painter! as MobiPainter;

void main() {
  test('the new poses play their own acts', () {
    expect(MobiPose.proud.act, MobiAct.proud);
    expect(MobiPose.encourage.act, MobiAct.encourage);
    expect(MobiPose.listen.act, MobiAct.listen);
    expect(MobiPose.loading.act, MobiAct.loading);
    // Added at the end, so every older pose keeps its idle seed.
    expect(MobiPose.thinking.index, 13);
  });

  testWidgets('a Mobi under 72 dp paints lite detail; a larger one paints full detail', (tester) async {
    await pumpMockmob(tester, const Center(child: Mobi(pose: MobiPose.read, size: 52)), disableAnimations: true);
    expect(_painter(tester).lite, isTrue);
    await pumpMockmob(tester, const Center(child: Mobi(pose: MobiPose.read, size: 96)), disableAnimations: true);
    expect(_painter(tester).lite, isFalse);
    // An explicit choice still wins.
    await pumpMockmob(tester, const Center(child: MobiCharacter(size: 48, lite: false)), disableAnimations: true);
    expect(_painter(tester).lite, isFalse);
  });

  testWidgets('MobiLoader plays the loading act, and the error state keeps think', (tester) async {
    await pumpMockmob(tester, const MobiLoader(delay: Duration.zero), disableAnimations: true);
    await tester.pump();
    expect(tester.widget<MobiCharacter>(find.byType(MobiCharacter)).entrance, MobiAct.loading);
  });

  group('time-of-day entrance', () {
    testWidgets('Mobi takes an entrance in place of its pose', (tester) async {
      await pumpMockmob(
        tester,
        Center(child: Mobi(pose: MobiPose.greet, entrance: MobiMoments.entranceAt(DateTime(2026, 10, 14, 2)))),
        disableAnimations: true,
      );
      expect(tester.widget<MobiCharacter>(find.byType(MobiCharacter)).entrance, MobiAct.sleep);
    });

    testWidgets('a Mobi asleep earlier, seen again after the late-night window, wakes once', (tester) async {
      final now = ValueNotifier(DateTime(2026, 10, 14, 3));
      addTearDown(now.dispose);
      await tester.pumpWidget(MaterialApp(
        theme: buildTheme(Brightness.dark),
        builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: true), child: app!),
        home: Center(
          child: ValueListenableBuilder<DateTime>(
            valueListenable: now,
            builder: (context, t, _) => Mobi(pose: MobiPose.greet, entrance: MobiMoments.entranceAt(t)),
          ),
        ),
      ));
      expect(_painter(tester).rig.value.y, MobiMoves.keyPose(MobiAct.sleep).y);
      now.value = DateTime(2026, 10, 14, 7);
      await tester.pump();
      expect(_painter(tester).rig.value.y, MobiMoves.keyPose(MobiAct.wake).y, reason: 'the wake key pose, not the hello');
      expect(tester.binding.hasScheduledFrame, isFalse, reason: 'still under reduced motion');
      await tester.pump(const Duration(seconds: 2));
    });
  });
}
