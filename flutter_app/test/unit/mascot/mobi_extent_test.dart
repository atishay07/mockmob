import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/mascot/mascot.dart';
import 'package:mockmob/core/mascot/mobi_painter.dart';
import 'package:mockmob/core/mascot/mobi_palette.dart';

/// How far a pose reaches, in design units (the character lives in a 140 by 168 box), found by
/// painting it at 2x on a canvas padded by [pad] on every side and taking the bounding box of
/// every pixel that is clearly drawn. Decorations that float free by design (confetti, z's, the
/// answer bubble, the bulb's halo) are left out.
Future<Rect> extentOf(WidgetTester tester, MobiRig rig, {MobiPalette? palette, double pad = 40}) async {
  late Rect box;
  await tester.runAsync(() async {
    const k = 2.0;
    final w = ((140 + pad * 2) * k).round();
    final h = ((168 + pad * 2) * k).round();
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    canvas.scale(k);
    canvas.translate(pad, pad);
    paintRig(canvas, rig.copyWith(burst: -1, zzz: -1, bubble: -1, glow: 0, sparkle: -1), palette ?? MobiPalette.nightPalette, shadow: false);
    final image = await recorder.endRecording().toImage(w, h);
    final data = (await image.toByteData())!;
    var l = w, t = h, r = -1, b = -1;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        if (data.getUint8((y * w + x) * 4 + 3) > 60) {
          if (x < l) l = x;
          if (x > r) r = x;
          if (y < t) t = y;
          if (y > b) b = y;
        }
      }
    }
    image.dispose();
    box = Rect.fromLTRB(l / k - pad, t / k - pad, (r + 1) / k - pad, (b + 1) / k - pad);
  });
  return box;
}

/// The paint box is 140 design units wide. Anything that stays on the ground must stay inside
/// it, with a margin: the box is what layouts reserve (a Mobi beside a speech bubble, a Mobi near
/// the screen edge at 360 dp), and an arm outside it overlaps its neighbour or clips.
const double _margin = 1.5;

void main() {
  /// The widest extent of [act] sampled every 1/30 s over its length, from a standing start.
  Future<Rect> widest(WidgetTester tester, MobiAct act, {MobiSim Function()? start}) async {
    final sim = start?.call() ?? (MobiSim()..run(0.5));
    sim.play(act);
    var box = Rect.zero;
    final n = (MobiMoves.duration(act) * 30).ceil() + 12;
    for (var i = 0; i < n; i++) {
      final e = await extentOf(tester, sim.run(1 / 30, fps: 30));
      box = i == 0 ? e : box.expandToInclude(e);
    }
    return box;
  }

  void inside(Rect e, String what) {
    debugPrint('EXTENT $what: ${e.left.toStringAsFixed(1)} to ${e.right.toStringAsFixed(1)}');
    expect(e.left, greaterThanOrEqualTo(_margin), reason: '$what reaches past the left edge of the paint box');
    expect(e.right, lessThanOrEqualTo(140 - _margin), reason: '$what reaches past the right edge of the paint box');
  }

  testWidgets('the ground-bound poses stay inside the paint box', (tester) async {
    for (final act in [
      MobiAct.hello,
      MobiAct.talk,
      MobiAct.think,
      MobiAct.point,
      MobiAct.sleepy,
      MobiAct.oops,
      MobiAct.rest,
      MobiAct.read,
      MobiAct.correct,
      MobiAct.encourage,
      MobiAct.loading,
      MobiAct.sleep,
      MobiAct.nudge,
      MobiAct.proud,
      MobiAct.listen,
    ]) {
      inside(await extentOf(tester, MobiMoves.keyPose(act)), 'key pose of ${act.name}');
    }
  });

  testWidgets('the pointing arm and the nudge jab stay inside the paint box, on both sides', (tester) async {
    for (final side in [1.0, -1.0]) {
      MobiSim aimed() => MobiSim()
        ..aim(1.5, side)
        ..play(MobiAct.point)
        ..run(1);
      inside(await extentOf(tester, MobiMoves.keyPose(MobiAct.point, pointSide: side)), 'point, side $side');
      inside(await widest(tester, MobiAct.nudge, start: aimed), 'nudge, side $side');
    }
    inside(await widest(tester, MobiAct.nudge), 'nudge from standing');
  });

  testWidgets('the hello wave and the listening lean stay inside the paint box', (tester) async {
    inside(await widest(tester, MobiAct.hello), 'hello wave');
    inside(await widest(tester, MobiAct.listen), 'listen');
    inside(await widest(tester, MobiAct.correct), 'correct');
  });
}
