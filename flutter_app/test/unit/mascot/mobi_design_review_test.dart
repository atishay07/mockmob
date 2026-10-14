import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/mascot/mascot.dart';
import 'package:mockmob/core/mascot/mobi_details.dart';
import 'package:mockmob/core/mascot/mobi_palette.dart';

import '../../helpers/golden_harness.dart';

/// Pixels of a drawing (design units scaled 4x) for which [test] is true.
Future<int> countPixels(WidgetTester tester, void Function(Canvas) draw, bool Function(int r, int g, int b, int a) test) async {
  late int count;
  await tester.runAsync(() async {
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    canvas.scale(4);
    draw(canvas);
    final image = await recorder.endRecording().toImage(640, 640);
    final data = (await image.toByteData())!;
    count = 0;
    for (var i = 0; i < data.lengthInBytes; i += 4) {
      if (test(data.getUint8(i), data.getUint8(i + 1), data.getUint8(i + 2), data.getUint8(i + 3))) count++;
    }
    image.dispose();
  });
  return count;
}

bool lit(int r, int g, int b, int a) => a > 128 && r > 200 && g > 190 && b > 140;

void main() {
  group('design review fixes', () {
    testWidgets('the smile is a filled dome, clearly heavier than the happy arc', (tester) async {
      // The eyes sit on the visor at (70, 82) in design units; draw the face at that offset.
      Future<int> face(MobiEye e) => countPixels(tester, (c) {
            c.translate(-30, -60);
            MobiDetails.eyes(c, MobiRig(eyeL: e, eyeR: e));
          }, lit);
      final smile = await face(const MobiEye(smile: 0.6));
      final happy = await face(const MobiEye(happy: 1));
      expect(smile, greaterThan(happy * 1.4), reason: 'smile reads as a solid dome, happy as a thin arc');
    });

    testWidgets('the right-answer bubble is a volt disc with a dark tick, and is gone outside its time', (tester) async {
      Future<int> volt(double progress) => countPixels(tester, (c) {
            c.translate(-90, -10);
            MobiDetails.answerBubble(c, progress, MobiPalette.dayPalette);
          }, (r, g, b, a) => a > 200 && r > 180 && g > 220 && b < 60);
      Future<int> ink(double progress) => countPixels(tester, (c) {
            c.translate(-90, -10);
            MobiDetails.answerBubble(c, progress, MobiPalette.dayPalette);
          }, (r, g, b, a) => a > 200 && r < 60 && g < 60 && b < 40);
      expect(await volt(-1), 0);
      expect(await volt(1.2), 0);
      // 13 units radius is about 530 square units; at 4x that is about 8,500 px of disc.
      expect(await volt(0.5), greaterThan(6000));
      expect(await ink(0.5), greaterThan(300), reason: 'the tick is inked inside the disc');
      expect(await ink(0.02), 0, reason: 'nothing before it pops in');
    });

    test('listen leans clearly and cups a mitten beside the head', () {
      final rig = MobiMoves.stance(MobiStance.listen);
      expect(rig.tilt, lessThanOrEqualTo(-0.1));
      expect(rig.armL.front, 1, reason: 'the cupped mitten is drawn over the body');
      expect(rig.armL.angle, greaterThan(2.0));
      expect(MobiMoves.stance(MobiStance.stand).tilt, 0);
    });

    test('loading lights the bulb brightly at the top of its pulse', () {
      final lo = MobiMoves.loadingLoop(0.64, MobiMoves.stance(MobiStance.loading), 1).glow;
      final hi = MobiMoves.loadingLoop(0.2125, MobiMoves.stance(MobiStance.loading), 1).glow;
      expect(hi, greaterThan(0.85));
      expect(hi - lo, greaterThan(0.35), reason: 'a pulse that can be seen');
      expect(MobiMoves.keyPose(MobiAct.loading).glow, closeTo(hi, 0.02));
    });

    test('fidget beats differ by more than a few pixels', () {
      const rest = MobiRig();
      final nod = MobiMoves.fidget(0, 0.4, rest);
      expect(nod.y, greaterThanOrEqualTo(2.4));
      expect(nod.eyeL.smile, greaterThan(0.7));
      final shift = MobiMoves.fidget(1, 0.5, rest);
      expect(shift.bootL.dy, lessThanOrEqualTo(-3.5), reason: 'a boot clearly off the floor');
      expect(shift.x, greaterThan(2));
      var swing = 0.0;
      for (var t = 0.0; t < MobiMoves.fidgetLength; t += 0.02) {
        final a = MobiMoves.fidget(2, t, rest).antenna;
        if (a.abs() > swing.abs()) swing = a;
      }
      expect(swing, greaterThan(0.45), reason: 'the antenna whips');
      expect(MobiMoves.fidget(2, 0.5, rest).antenna, lessThan(-0.2), reason: 'and snaps back past rest');
    });

    test('the pointing stance shifts its weight away so the reach stays inside the paint box', () {
      expect(MobiMoves.stance(MobiStance.point).x, lessThan(-5));
      expect(MobiMoves.stance(MobiStance.point, pointSide: -1).x, greaterThan(5));
      expect(MobiMoves.stance(MobiStance.point).armR.reach, lessThanOrEqualTo(1.15));
    });

    test('sleep keeps the boots close to the body', () {
      final rig = MobiMoves.stance(MobiStance.sleep);
      expect(rig.bootL.dx.abs(), lessThanOrEqualTo(8));
      expect(rig.bootR.dx.abs(), lessThanOrEqualTo(8));
    });

    testWidgets('a line can sit without a card', (tester) async {
      const speech = MobiSpeech('Where am I losing marks?', id: 1);
      int paints() => find.descendant(of: find.byType(MobiBubble), matching: find.byType(CustomPaint)).evaluate().length;
      await pumpMockmob(tester, const Center(child: MobiBubble(speech: speech)), disableAnimations: true);
      expect(paints(), greaterThan(0));
      await pumpMockmob(tester, const Center(child: MobiBubble(speech: speech, boxed: false)), disableAnimations: true);
      expect(find.text('Where am I losing marks?', findRichText: true), findsOneWidget);
      expect(paints(), 0);
    });
  });
}
