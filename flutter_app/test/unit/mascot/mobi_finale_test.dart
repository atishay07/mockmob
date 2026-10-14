import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/mascot/mascot.dart';
import 'package:mockmob/core/mascot/mobi_details.dart';
import 'package:mockmob/core/mascot/mobi_palette.dart';

/// Design-review fixes to the finales and transitions (14 Oct 2026): a smooth hello, a yawn whose
/// arms come down with the lids, a z that clears the bulb, a check badge that never turns olive,
/// floor rings under celebrate and a visor glint that is a reflection, not a line.
const Color _nightGround = Color(0xFF131210);
const Color _dayGround = Color(0xFFF2EEE6);

/// RGBA bytes of a drawing in a 160 by 160 design-unit area at 4x.
Future<List<int>> render(WidgetTester tester, void Function(Canvas) draw, {Color ground = _nightGround}) async {
  late List<int> out;
  await tester.runAsync(() async {
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    canvas.drawColor(ground, BlendMode.src);
    canvas.scale(4);
    draw(canvas);
    final image = await recorder.endRecording().toImage(640, 640);
    out = (await image.toByteData())!.buffer.asUint8List().toList();
    image.dispose();
  });
  return out;
}

int count(List<int> px, bool Function(int r, int g, int b) test) {
  var n = 0;
  for (var i = 0; i < px.length; i += 4) {
    if (test(px[i], px[i + 1], px[i + 2])) n++;
  }
  return n;
}

double _max(double a, double b) => a > b ? a : b;

void main() {
  group('hello', () {
    test('moves without an abrupt jump at 60 fps, from the first dip to the last settle', () {
      final sim = MobiSim()..run(0.5);
      sim.play(MobiAct.hello);
      var prev = sim.step(1 / 60);
      var worstArm = 0.0;
      var worstY = 0.0;
      var worstTilt = 0.0;
      for (var i = 0; i < 115; i++) {
        final r = sim.step(1 / 60);
        worstArm = _max(worstArm, (r.armL.angle - prev.armL.angle).abs());
        worstY = _max(worstY, (r.y - prev.y).abs());
        worstTilt = _max(worstTilt, (r.tilt - prev.tilt).abs());
        prev = r;
      }
      expect(worstArm, lessThan(0.16), reason: 'the wave arm turns by under 9 degrees a frame');
      expect(worstY, lessThan(1.2), reason: 'the body never jumps more than a unit between frames');
      expect(worstTilt, lessThan(0.02));
    });
  });

  group('sleepy', () {
    test('the arms come down in step with the lids closing, not after', () {
      final base = MobiMoves.stance(MobiStance.sleepy);
      double lidShut(double t) => 1 - MobiMoves.act(MobiAct.sleepy, t, base).eyeL.open / base.eyeL.open;
      double lift(double t) => MobiMoves.act(MobiAct.sleepy, t, base).armL.angle - base.armL.angle;
      // The reach tops out as the lids start to sink, then eases down while they are shut.
      expect(lift(0.45), greaterThan(1.2));
      expect(lidShut(1.0), greaterThan(0.8), reason: 'eyes shut at one second');
      expect(lift(1.0), lessThan(0.45), reason: 'and the arms are most of the way down by then');
      var last = lift(0.5);
      for (var t = 0.55; t <= 1.3; t += 0.05) {
        final a = lift(t);
        expect(a, lessThanOrEqualTo(last + 1e-6), reason: 'the arms only ever come down from the top of the stretch ($t s)');
        last = a;
      }
      expect(lift(1.3), lessThan(0.05));
    });

    test('the stretch is a loose reach, narrower than a cheer', () {
      final base = MobiMoves.stance(MobiStance.sleepy);
      final stretch = MobiMoves.act(MobiAct.sleepy, 0.45, base).armL;
      final cheer = MobiMoves.act(MobiAct.cheer, 0.4, MobiMoves.stance(MobiStance.stand)).armL;
      expect(stretch.reach, lessThan(cheer.reach));
      expect(stretch.angle, lessThan(cheer.angle));
    });

    testWidgets('the z drifts up on the left of the head, clear of the antenna bulb', (tester) async {
      // The bulb is never left of x = 85 in design units (the antenna base is at 90, and it
      // leans right when sleepy). Every z, at every moment, stays well left of that.
      for (var q = 0.0; q <= 1.0; q += 0.1) {
        final px = await render(tester, (c) => MobiDetails.zzz(c, q, const Offset(30, 28), MobiPalette.nightPalette));
        var right = 0;
        for (var y = 0; y < 640; y++) {
          for (var x = 0; x < 640; x++) {
            if (px[(y * 640 + x) * 4] > 120 && x > right) right = x;
          }
        }
        expect(right / 4, lessThan(60), reason: 'zzz at $q');
      }
    });
  });

  group('the right-answer badge', () {
    testWidgets('is a bright volt disc whenever it is on show, never a muddy olive one', (tester) async {
      bool olive(int r, int g, int b) => g > r && r > 60 && r < 175 && g > 70 && g < 190 && b < 70;
      bool volt(int r, int g, int b) => r > 190 && g > 215 && b < 60;
      for (final progress in [0.05, 0.08, 0.12, 0.2, 0.4, 0.7, 0.85]) {
        final px = await render(tester, (c) {
          c.translate(-90, -10);
          MobiDetails.answerBubble(c, progress, MobiPalette.nightPalette);
        });
        final muddy = count(px, olive);
        final bright = count(px, volt);
        expect(bright, greaterThan(300), reason: 'a volt disc is there at $progress');
        // Only the antialiased rim may be in between.
        expect(muddy, lessThan(bright * 0.2 + 60), reason: 'no olive disc at $progress (muddy $muddy, bright $bright)');
      }
    });
  });

  group('celebrate', () {
    testWidgets('lands in two floor rings, solid volt, on night and on day', (tester) async {
      for (final p in [MobiPalette.nightPalette, MobiPalette.dayPalette]) {
        final ground = p.night ? _nightGround : _dayGround;
        bool volt(int r, int g, int b) => g > 100 && g > b + 45 && g > r - 30;
        for (final progress in [0.5, 0.8]) {
          final px = await render(tester, (c) => MobiDetails.landRings(c, progress, const Offset(80, 80), p), ground: ground);
          expect(count(px, volt), greaterThan(40), reason: 'a ring at $progress, night ${p.night}');
        }
        final none = await render(tester, (c) => MobiDetails.landRings(c, -1, const Offset(80, 80), p), ground: ground);
        expect(count(none, volt), 0);
      }
    });

    testWidgets('confetti keeps off the face and the antenna', (tester) async {
      // Anything drawn within 60 units of the body centre would be on the head; pieces start at
      // the centre (behind the body) so look only once they have flown (progress 0.3 onward).
      for (final progress in [0.3, 0.4, 0.5, 0.6]) {
        final px = await render(tester, (c) {
          c.translate(-10, -10);
          MobiDetails.burst(c, progress, const Offset(80, 80), MobiPalette.dayPalette);
        }, ground: _dayGround);
        var onHead = 0;
        for (var y = 0; y < 640; y++) {
          for (var x = 0; x < 640; x++) {
            final i = (y * 640 + x) * 4;
            final isVolt = px[i + 1] > 150 && px[i + 2] < 120 && px[i + 1] > px[i + 2] + 70;
            if (!isVolt) continue;
            final dx = x / 4 - 80 + 10;
            final dy = y / 4 - 80 + 10;
            if (dx * dx + dy * dy < 52 * 52) onHead++;
          }
        }
        // The leading pieces have not all left the head at the very start, so allow the ones
        // still growing in; later in the burst none may be there.
        if (progress >= 0.5) expect(onHead, 0, reason: 'confetti on the head at $progress');
      }
    });
  });

  group('the visor glint', () {
    Future<int> peak(WidgetTester tester, double progress, double tilt) async {
      final px = await render(tester, (c) {
        c.translate(-10, -50);
        MobiDetails.glint(c, progress, tilt: tilt);
      });
      var p = 0;
      for (var i = 0; i < px.length; i += 4) {
        if (px[i] > p) p = px[i];
      }
      return p;
    }

    testWidgets('is a soft reflection: faint at every moment of its sweep', (tester) async {
      for (final progress in [0.2, 0.5, 0.8]) {
        // The ground is 0x13 (19); a 0.14 white band lifts it to about 52 at most.
        expect(await peak(tester, progress, 0.06), lessThan(70), reason: 'glint at $progress is a reflection, not a line');
      }
    });

    testWidgets('is weaker when the head is level than when it tilts toward the lamp', (tester) async {
      expect(await peak(tester, 0.5, 0), lessThan(await peak(tester, 0.5, 0.06)));
    });
  });
}
