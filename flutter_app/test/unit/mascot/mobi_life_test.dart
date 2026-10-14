import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/mascot/mascot.dart';
import 'package:mockmob/core/mascot/mobi_painter.dart';

import '../../helpers/golden_harness.dart';

/// Runs [sim] until it rests between beats (or [limit] seconds pass) and returns the time taken.
double settle(MobiSim sim, {double limit = 30}) {
  var t = 0.0;
  while (sim.busy && t < limit) {
    sim.step(1 / 60);
    t += 1 / 60;
  }
  return t;
}

void main() {
  group('new acts', () {
    test('are appended, so existing acts keep their order', () {
      const original = ['idle', 'appear', 'hello', 'talk', 'cheer', 'celebrate', 'think', 'point', 'sleepy', 'oops', 'rest', 'read'];
      expect(MobiAct.values.take(original.length).map((a) => a.name), original);
      expect(
        MobiAct.values.skip(original.length).take(8).map((a) => a.name),
        ['correct', 'encourage', 'loading', 'sleep', 'nudge', 'proud', 'listen', 'wake'],
      );
    });

    test('wake: eyes open at once, a startled hop, then standing', () {
      final sim = MobiSim()..play(MobiAct.sleep);
      sim.run(3);
      expect(sim.rig.eyeL.open, lessThan(0.1));
      sim.play(MobiAct.wake);
      final early = sim.run(0.12);
      expect(early.eyeL.open, greaterThan(0.9), reason: 'the eyes snap open before the body has stood');
      var top = 0.0;
      for (var i = 0; i < 20; i++) {
        final y = sim.step(1 / 60).y;
        if (y < top) top = y;
      }
      expect(top, lessThan(-2), reason: 'a startled hop');
      sim.run(MobiMoves.duration(MobiAct.wake));
      expect(sim.stance, MobiStance.stand);
      expect(sim.act, isNull);
    });

    test('one-shot moments return to standing; held ones change the stance', () {
      for (final act in [MobiAct.correct, MobiAct.encourage, MobiAct.proud]) {
        final sim = MobiSim()..play(act);
        sim.run(MobiMoves.duration(act) + 0.5);
        expect(sim.act, isNull, reason: act.name);
        expect(sim.stance, MobiStance.stand, reason: act.name);
      }
      expect((MobiSim()..play(MobiAct.loading)).stance, MobiStance.loading);
      expect((MobiSim()..play(MobiAct.sleep)).stance, MobiStance.sleep);
      expect((MobiSim()..play(MobiAct.listen)).stance, MobiStance.listen);
      expect((MobiSim()..play(MobiAct.nudge)).stance, MobiStance.point);
    });

    test('correct inks one answer bubble, then clears it', () {
      final sim = MobiSim()..play(MobiAct.correct);
      expect(sim.run(0.5).bubble, inInclusiveRange(0.2, 0.6));
      expect(sim.run(1.0).bubble, lessThan(0));
    });

    test('correct is smaller than cheer, which is smaller than celebrate', () {
      double peak(MobiAct act) {
        final sim = MobiSim()..play(act);
        var top = 0.0;
        for (var i = 0; i < 150; i++) {
          final y = sim.step(1 / 60).y;
          if (y < top) top = y;
        }
        return -top;
      }

      expect(peak(MobiAct.correct), lessThan(peak(MobiAct.cheer)));
      expect(peak(MobiAct.cheer), lessThan(peak(MobiAct.celebrate)));
    });

    test('encourage never droops: eyes stay at least as open as at rest, and warm', () {
      final sim = MobiSim()..play(MobiAct.encourage);
      var warm = 0.0;
      for (var i = 0; i < 80; i++) {
        final r = sim.step(1 / 60);
        warm = r.eyeL.smile > warm ? r.eyeL.smile : warm;
        expect(r.lookY, lessThan(0.6));
      }
      expect(warm, greaterThan(0.5));
    });

    test('proud sparkles and stands tall', () {
      final sim = MobiSim()..play(MobiAct.proud);
      final r = sim.run(1.0);
      expect(r.sparkle, greaterThan(0));
      expect(r.squash, greaterThan(0));
      expect(r.lookY, lessThan(0));
    });

    test('every act has a still key pose for reduced motion', () {
      for (final act in MobiAct.values) {
        expect(MobiMoves.keyPose(act), isA<MobiRig>(), reason: act.name);
      }
      expect(MobiMoves.keyPose(MobiAct.sleep).zzz, greaterThan(0));
      expect(MobiMoves.keyPose(MobiAct.loading).glow, greaterThan(0.4));
      expect(MobiMoves.keyPose(MobiAct.correct).bubble, greaterThan(0));
    });
  });

  group('idle life', () {
    test('loading scans, then settles so the ticker can rest', () {
      final sim = MobiSim()..play(MobiAct.loading);
      final xs = <double>[];
      for (var i = 0; i < 120; i++) {
        xs.add(sim.step(1 / 60).lookX);
      }
      final spread = xs.reduce((a, b) => a > b ? a : b) - xs.reduce((a, b) => a < b ? a : b);
      expect(spread, greaterThan(0.6), reason: 'the eyes sweep while loading');
      sim.run(MobiSim.loadingScanFor);
      expect(settle(sim), lessThan(10));
      expect(sim.busy, isFalse);
    });

    test('asleep: no blinks, deep breaths with z\'s, eyes shut', () {
      final sim = MobiSim()..play(MobiAct.sleep);
      sim.run(2);
      var zzz = false;
      for (var i = 0; i < 600; i++) {
        final r = sim.step(1 / 60);
        if (r.zzz >= 0) zzz = true;
        expect(r.eyeL.open, lessThan(0.1));
      }
      expect(zzz, isTrue);
    });

    test('glances happen between beats and come back', () {
      final sim = MobiSim(seed: 3);
      var maxLook = 0.0;
      for (var i = 0; i < 60 * 14; i++) {
        final r = sim.step(1 / 60);
        if (r.lookX.abs() > maxLook) maxLook = r.lookX.abs();
      }
      expect(maxLook, greaterThan(0.3), reason: 'Mobi glances about when idle');
      settle(sim);
      expect(sim.rig.lookX.abs(), lessThan(0.05));
    });

    test('a glance looks at a point, then returns by itself', () {
      final sim = MobiSim()..run(1);
      sim.glance(const Offset(-1, 0.4), seconds: 0.8);
      expect(sim.run(0.4).lookX, lessThan(-0.6));
      sim.run(1.2);
      expect(sim.rig.lookX.abs(), lessThan(0.1));
    });

    test('a big look brings a blink with it', () {
      final sim = MobiSim()..run(0.2);
      sim.lookAt(const Offset(1, -1));
      var minOpen = 1.0;
      for (var i = 0; i < 20; i++) {
        final o = sim.step(1 / 60).eyeL.open;
        if (o < minOpen) minOpen = o;
      }
      expect(minOpen, lessThan(0.3));
    });

    test('a boop squashes and springs back', () {
      final sim = MobiSim()..run(1);
      sim.boop(side: 1);
      expect(sim.run(0.09).squash, lessThan(-0.04));
      sim.run(1);
      expect(sim.rig.squash.abs(), lessThan(0.03));
    });

    test('standing at ease, Mobi fidgets now and then, and still rests between beats', () {
      final sim = MobiSim(seed: 4);
      var smiled = false, flashed = false, tapped = false;
      var rested = false;
      for (var i = 0; i < 60 * 90; i++) {
        final r = sim.step(1 / 60);
        if (r.eyeL.smile > 0.3) smiled = true;
        if (r.glow > 0.3) flashed = true;
        if (r.bootL.rot > 0.1) tapped = true;
        if (!sim.busy) rested = true;
      }
      expect(smiled || flashed || tapped, isTrue, reason: 'at least one fidget in 90 s');
      expect(rested, isTrue, reason: 'the ticker can still sleep between beats');
    });

    test('no fidgets while holding a stance', () {
      final sim = MobiSim(seed: 4)..play(MobiAct.read);
      for (var i = 0; i < 60 * 60; i++) {
        final r = sim.step(1 / 60);
        expect(r.eyeL.smile, lessThan(0.3));
        expect(r.bootL.rot, lessThan(0.1));
      }
    });

    test('still deterministic for a seed', () {
      final a = MobiSim(seed: 5);
      final b = MobiSim(seed: 5);
      for (var i = 0; i < 60 * 12; i++) {
        expect(a.step(1 / 60).lookX, b.step(1 / 60).lookX);
      }
    });
  });

  group('MobiMoments', () {
    test('maps moments onto acts', () {
      expect(MobiMoments.act(MobiEvent.rightAnswer), MobiAct.correct);
      expect(MobiMoments.act(MobiEvent.wrongAnswer), MobiAct.encourage);
      expect(MobiMoments.act(MobiEvent.waiting), MobiAct.loading);
      expect(MobiMoments.act(MobiEvent.milestone), MobiAct.proud);
      expect(MobiMoments.act(MobiEvent.typing), MobiAct.listen);
      expect(MobiMoments.act(MobiEvent.showAction), MobiAct.nudge);
      for (final m in MobiEvent.values) {
        expect(MobiMoments.act(m), isA<MobiAct>());
      }
    });

    test('late at night Mobi is sleepy, then asleep', () {
      expect(MobiMoments.entranceAt(DateTime(2026, 10, 14, 20)), MobiAct.hello);
      expect(MobiMoments.entranceAt(DateTime(2026, 10, 14, 23, 30)), MobiAct.sleepy);
      expect(MobiMoments.entranceAt(DateTime(2026, 10, 15, 0, 40)), MobiAct.sleepy);
      expect(MobiMoments.entranceAt(DateTime(2026, 10, 15, 2)), MobiAct.sleep);
      expect(MobiMoments.entranceAt(DateTime(2026, 10, 15, 5)), MobiAct.hello);
      expect(MobiMoments.isLate(DateTime(2026, 10, 15, 4, 59)), isTrue);
      expect(MobiMoments.isLate(DateTime(2026, 10, 15, 5)), isFalse);
    });
  });

  group('widgets', () {
    testWidgets('watches taps elsewhere on screen, then settles', (tester) async {
      await pumpMockmob(
        tester,
        const Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          MobiCharacter(size: 100, entrance: MobiAct.idle),
          SizedBox(height: 200),
          SizedBox(key: ValueKey('target'), width: 60, height: 60),
        ]),
      );
      await tester.pumpAndSettle();
      expect(tester.binding.hasScheduledFrame, isFalse);
      await tester.tapAt(tester.getCenter(find.byKey(const ValueKey('target'))));
      await tester.pump();
      expect(tester.binding.hasScheduledFrame, isTrue, reason: 'Mobi glances at the tap');
      await tester.pumpAndSettle();
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('a sleeping Mobi wakes on a tap', (tester) async {
      final controller = MobiController();
      addTearDown(controller.dispose);
      await pumpMockmob(tester, Center(child: MobiCharacter(controller: controller, entrance: MobiAct.sleep, interactive: true)));
      await tester.pumpAndSettle();
      await tester.tap(find.byType(MobiCharacter));
      await tester.pump();
      expect(tester.binding.hasScheduledFrame, isTrue);
      await tester.pumpAndSettle();
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('under reduced motion a quick reaction shows still, then gives way, with no ticking', (tester) async {
      final controller = MobiController();
      addTearDown(controller.dispose);
      await pumpMockmob(tester, Center(child: MobiCharacter(controller: controller, entrance: MobiAct.idle)), disableAnimations: true);
      MobiRig rig() => (tester.widget<CustomPaint>(find.descendant(of: find.byType(MobiCharacter), matching: find.byType(CustomPaint))).painter! as MobiPainter).rig.value;
      expect(rig().eyeL.happy, 0);
      controller.play(MobiAct.correct);
      await tester.pump();
      expect(rig().eyeL.happy, greaterThan(0.5), reason: 'the key pose shows');
      expect(tester.binding.hasScheduledFrame, isFalse, reason: 'nothing animates');
      await tester.pump(const Duration(milliseconds: 1200));
      expect(rig().eyeL.happy, 0, reason: 'back to standing');
      expect(rig().bubble, lessThan(0));
    });

    testWidgets('controller glance waits for Mobi to appear', (tester) async {
      final controller = MobiController()..glance(const Offset(0, 0));
      addTearDown(controller.dispose);
      await pumpMockmob(tester, Center(child: MobiCharacter(controller: controller, entrance: MobiAct.idle)));
      await tester.pumpAndSettle();
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('MobiFace is a square head, decorative, and holds still under reduced motion', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpMockmob(tester, const Center(child: MobiFace(size: 40, entrance: MobiAct.correct)), disableAnimations: true);
      expect(tester.getSize(find.byType(MobiCharacter)), const Size(40, 40));
      expect(tester.binding.hasScheduledFrame, isFalse);
      handle.dispose();
    });

    testWidgets('a labelled MobiFace is announced', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpMockmob(tester, const Center(child: MobiFace(size: 40, semanticLabel: 'Mobi')), disableAnimations: true);
      expect(find.bySemanticsLabel('Mobi'), findsOneWidget);
      handle.dispose();
    });
  });
}
