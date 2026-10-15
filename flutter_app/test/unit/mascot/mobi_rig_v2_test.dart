import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/mascot/mascot.dart';
import 'package:mockmob/core/mascot/mobi_details.dart';
import 'package:mockmob/core/mascot/mobi_geometry.dart';
import 'package:mockmob/core/mascot/mobi_painter.dart';
import 'package:mockmob/core/mascot/mobi_palette.dart';

/// Rig v2 (15 Oct 2026, the quality pass): the new acts and mood, follow-through and jiggle,
/// micro-saccades, the trailing blink, lids that follow the gaze and the small-size face.
const List<MobiAct> _v2Acts = [MobiAct.hop, MobiAct.curious, MobiAct.focus, MobiAct.sympathy, MobiAct.idea];

void main() {
  setUp(MobiRation.reset);
  tearDown(MobiRation.reset);

  group('new acts', () {
    test('appended after walk, so every older act keeps its index', () {
      expect(MobiAct.values.indexOf(MobiAct.walk), 26);
      expect(MobiAct.values.sublist(27), _v2Acts);
    });

    test('each moves visibly and ends where it started', () {
      for (final act in _v2Acts) {
        final base = MobiMoves.stance(MobiMoves.stanceAfter(act) ?? MobiStance.stand);
        final len = MobiMoves.duration(act);
        var moved = 0.0;
        for (var t = 0.0; t <= len; t += 1 / 60) {
          final r = MobiMoves.act(act, t, base);
          moved = [moved, (r.y - base.y).abs(), (r.tilt - base.tilt).abs() * 40, (r.armR.angle - base.armR.angle).abs() * 10, (r.eyeL.open - base.eyeL.open).abs() * 10]
              .reduce((a, b) => a > b ? a : b);
        }
        expect(moved, greaterThan(0.8), reason: '$act should visibly move');
        final end = MobiMoves.act(act, len, base);
        expect(end.y, closeTo(base.y, 0.05), reason: '$act ends on its spot');
        expect(end.tilt, closeTo(base.tilt, 0.01), reason: '$act ends upright');
        expect(end.armR.angle, closeTo(base.armR.angle, 0.02), reason: '$act ends with the arm where it was');
        expect(end.armL.angle, closeTo(base.armL.angle, 0.02), reason: '$act ends with the arm where it was');
        expect(end.eyeL.open, closeTo(base.eyeL.open, 0.02), reason: '$act ends with the eyes as they were');
      }
    });

    test('each is a reaction with a still pose for reduced motion, off its spot never', () {
      for (final act in _v2Acts) {
        expect(MobiMoves.reactions, contains(act));
        expect(MobiMoves.showsStillPose(act), isTrue);
        final still = MobiMoves.settledPose(act);
        expect(still.y, MobiMoves.stance(MobiStance.stand).y, reason: '$act still pose has no travel');
        expect(still.burst, -1);
      }
    });

    test('reactions played from a held stance return to it; idea ends standing', () {
      for (final act in _v2Acts) {
        final sim = MobiSim(seed: 5)..play(MobiAct.read);
        sim.run(1);
        sim.play(act);
        sim.run(MobiMoves.duration(act) + 0.3);
        expect(sim.stance, act == MobiAct.idea ? MobiStance.stand : MobiStance.read, reason: act.name);
      }
    });

    test('sympathy is soft, never sad: sloped lids with a warm lower lid, eyes open', () {
      final k = MobiMoves.keyPose(MobiAct.sympathy);
      expect(k.eyeL.slant, inInclusiveRange(0.3, 0.65), reason: 'a gentle slope (the painter cuts at most a fifth of the eye)');
      expect(k.eyeL.smile, greaterThan(0.1));
      expect(k.eyeL.open, greaterThan(0.85));
      expect(k.armL.front, greaterThan(0.5), reason: 'a mitten to the chest');
    });

    test('idea flashes the bulb and puts one finger up', () {
      final k = MobiMoves.keyPose(MobiAct.idea);
      expect(k.glow, greaterThan(0.8));
      expect(k.armR.point, greaterThan(0.9));
      expect(k.armR.angle, greaterThan(2.2), reason: 'the finger points up');
    });

    test('the hop is gated as a celebration: a nod under Quiet, nothing under Off', () {
      expect(MobiRation.underLevel(MobiAct.hop, MobiCelebrationLevel.quiet), MobiAct.nod);
      expect(MobiRation.underLevel(MobiAct.hop, MobiCelebrationLevel.off), isNull);
      for (final act in [MobiAct.curious, MobiAct.focus, MobiAct.sympathy, MobiAct.idea]) {
        expect(MobiRation.underLevel(act, MobiCelebrationLevel.off), act, reason: '${act.name} is not a celebration');
      }
    });

    test('the standard tap cycle hops instead of claiming a right answer', () {
      expect(MobiTapCycle.standard.acts, isNot(contains(MobiAct.correct)));
      expect(MobiTapCycle.standard.acts, contains(MobiAct.hop));
    });
  });

  group('focused mood', () {
    test('level lowered lids (a flat cut, not a drowsy sag), the bulb faintly on', () {
      final f = MobiMoods.apply(MobiMood.focused, const MobiRig());
      expect(f.eyeL.lid, inInclusiveRange(0.2, 0.3));
      expect(f.eyeL.slant, lessThan(-0.01), reason: 'a hair of slope picks the level lid, not the sag');
      expect(f.eyeL.slant, greaterThan(-0.1), reason: 'never a frown');
      expect(f.glow, greaterThan(0.1));
    });
  });

  group('secondary motion', () {
    test('an arm that swings and stops overshoots, then settles', () {
      final sim = MobiSim(seed: 9)..run(0.5);
      sim.play(MobiAct.wave);
      final target = <double>[];
      final drawn = <double>[];
      var t = 0.0;
      while (t < 2.2) {
        final r = sim.step(1 / 60);
        t += 1 / 60;
        drawn.add(r.armR.angle);
        target.add(MobiMoves.act(MobiAct.wave, t.clamp(0, MobiMoves.duration(MobiAct.wave)), const MobiRig()).armR.angle);
      }
      var gap = 0.0;
      // From 0.3 s, past the 0.16 s hand-off from the stance into the act.
      for (var i = 18; i < drawn.length; i++) {
        gap = (drawn[i] - target[i]).abs() > gap ? (drawn[i] - target[i]).abs() : gap;
      }
      debugPrint('FOLLOW-THROUGH max gap $gap');
      expect(gap, greaterThan(0.02), reason: 'the drawn arm lags and overshoots the choreography');
      expect(gap, lessThan(0.25), reason: 'but only a little');
      expect((drawn.last - const MobiRig().armR.angle).abs(), lessThan(0.04), reason: 'and settles back (a breath still lifts the arms a little)');
    });

    test('a landing jiggles the paper body, then it is still again', () {
      final sim = MobiSim(seed: 3)..run(0.5);
      sim.play(MobiAct.hop);
      var squashMin = 0.0;
      for (var i = 0; i < 60; i++) {
        final r = sim.step(1 / 60);
        if (r.squash < squashMin) squashMin = r.squash;
      }
      expect(squashMin, lessThan(-0.05), reason: 'the landing squash shows');
      sim.run(2.5);
      expect(sim.rig.squash.abs(), lessThan(0.02));
    });

    test('standing at ease the eyes dart a hair now and then, and the ticker still rests', () {
      final sim = MobiSim(seed: 4);
      final looks = <double>{};
      var restful = 0;
      for (var i = 0; i < 60 * 12; i++) {
        final r = sim.step(1 / 60);
        looks.add((r.lookX * 1000).roundToDouble());
        if (!sim.busy) restful++;
      }
      expect(looks.length, greaterThan(8), reason: 'the gaze is never frozen');
      expect(restful, greaterThan(60), reason: 'between beats nothing moves, so the ticker can stop');
    });

    test('the right eye trails the left in a blink', () {
      final sim = MobiSim(seed: 2);
      var differed = false;
      for (var i = 0; i < 120 * 8 && !differed; i++) {
        final r = sim.step(1 / 120);
        if ((r.eyeL.open - r.eyeR.open).abs() > 0.05) differed = true;
      }
      expect(differed, isTrue);
    });

    test('the sim stays deterministic for a seed', () {
      MobiRig run() {
        final s = MobiSim(seed: 13);
        s.play(MobiAct.idea);
        return s.run(6);
      }

      final a = run(), b = run();
      expect(a.lookX, b.lookX);
      expect(a.armR.angle, b.armR.angle);
      expect(a.squash, b.squash);
    });
  });

  group('paint', () {
    test('the face grows only at small sizes', () {
      expect(MobiDetails.legibility(1.0), 0);
      expect(MobiDetails.legibility(0.42), 0);
      expect(MobiDetails.legibility(32 / 149), greaterThan(0.9), reason: 'a 32 dp face');
      expect(MobiDetails.legibility(0.1), 1);
    });

    Future<int> litPixels(WidgetTester tester, MobiRig rig, double px) async {
      late int n;
      await tester.runAsync(() async {
        final rec = ui.PictureRecorder();
        final c = Canvas(rec);
        c.drawRect(const Rect.fromLTWH(0, 0, 140, 168), Paint()..color = const Color(0xFF000000));
        c.save();
        c.clipRRect(MobiGeo.visorRect.shift(const Offset(0, MobiGeo.bodyDrop)));
        paintRig(c, rig, MobiPalette.nightPalette, shadow: false, px: px);
        c.restore();
        final img = await rec.endRecording().toImage(140, 168);
        final data = (await img.toByteData())!;
        n = 0;
        for (var i = 0; i < 140 * 168; i++) {
          if (data.getUint8(i * 4) > 200 && data.getUint8(i * 4 + 1) > 200 && data.getUint8(i * 4 + 2) > 180) n++;
        }
        img.dispose();
      });
      return n;
    }

    testWidgets('at 32 dp the eyes cover more of the visor than at a hero size', (tester) async {
      final big = await litPixels(tester, const MobiRig(), 1);
      final small = await litPixels(tester, const MobiRig(), 0.2);
      expect(small, greaterThan(big * 1.4));
    });

    testWidgets('a painted frame of every act and mood, Night and Day, at hero and avatar sizes, never throws', (tester) async {
      await tester.runAsync(() async {
        for (final p in [MobiPalette.nightPalette, MobiPalette.dayPalette]) {
          for (final px in const [1.0, 0.2]) {
            final rec = ui.PictureRecorder();
            final c = Canvas(rec);
            for (final a in MobiAct.values) {
              paintRig(c, MobiMoves.keyPose(a), p, px: px, lite: px < 0.5);
            }
            for (final m in MobiMood.values) {
              paintRig(c, MobiMoods.apply(m, const MobiRig()), p, px: px, head: true);
            }
            rec.endRecording().dispose();
          }
        }
      });
    });
  });
}
