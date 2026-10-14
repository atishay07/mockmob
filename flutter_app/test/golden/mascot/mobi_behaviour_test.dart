import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../../helpers/golden_harness.dart';

void main() {
  group('MobiSim', () {
    test('is deterministic for a seed', () {
      final a = MobiSim(seed: 3)..play(MobiAct.cheer);
      final b = MobiSim(seed: 3)..play(MobiAct.cheer);
      for (var i = 0; i < 90; i++) {
        expect(a.step(1 / 60).y, b.step(1 / 60).y);
      }
    });

    test('comes to rest between idle beats, then wakes', () {
      final sim = MobiSim()..play(MobiAct.hello);
      sim.run(12);
      var guard = 0;
      while (sim.busy && guard++ < 2000) {
        sim.step(1 / 60);
      }
      expect(sim.busy, isFalse);
      expect(sim.idleWait, greaterThan(0));
      sim.elapse(sim.idleWait);
      sim.step(1 / 60);
      expect(sim.busy, isTrue);
    });

    test('held acts change the stance; one-shot acts return to standing', () {
      final sim = MobiSim()..play(MobiAct.think);
      sim.run(1);
      expect(sim.stance, MobiStance.think);
      sim.play(MobiAct.cheer);
      sim.run(2);
      expect(sim.stance, MobiStance.stand);
      expect(sim.act, isNull);
    });

    test('celebrate pops bubbles, then clears them', () {
      final sim = MobiSim()..play(MobiAct.celebrate);
      expect(sim.run(0.8).burst, greaterThan(0));
      expect(sim.run(1.5).burst, lessThan(0));
    });
  });

  group('MobiCharacter', () {
    testWidgets('settles so pumpAndSettle finishes, and leaves no timers behind', (tester) async {
      await pumpMockmob(tester, const Center(child: Mobi(pose: MobiPose.greet, size: 120)));
      await tester.pumpAndSettle();
      expect(tester.binding.hasScheduledFrame, isFalse);
      await tester.pump(const Duration(seconds: 6));
      await tester.pumpAndSettle();
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('holds still under reduced motion', (tester) async {
      await pumpMockmob(tester, const Center(child: Mobi(pose: MobiPose.cheer, size: 120)), disableAnimations: true);
      expect(tester.binding.hasScheduledFrame, isFalse);
      await tester.pump(const Duration(seconds: 8));
      expect(tester.binding.hasScheduledFrame, isFalse);
    });

    testWidgets('is decorative unless labelled', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpMockmob(tester, const Column(children: [
        Mobi(pose: MobiPose.greet, size: 80),
        Mobi(pose: MobiPose.cheer, size: 80, semanticLabel: 'Mobi cheering'),
      ]), disableAnimations: true);
      expect(find.bySemanticsLabel('Mobi cheering'), findsOneWidget);
      handle.dispose();
    });

    testWidgets('takes commands sent before it appears and reacts to taps', (tester) async {
      final controller = MobiController()..play(MobiAct.think);
      addTearDown(controller.dispose);
      await pumpMockmob(tester, Center(child: MobiCharacter(controller: controller, interactive: true)));
      await tester.pumpAndSettle();
      expect(tester.binding.hasScheduledFrame, isFalse);
      await tester.tap(find.byType(MobiCharacter));
      await tester.pump();
      expect(tester.binding.hasScheduledFrame, isTrue);
      await tester.pumpAndSettle();
      controller.pointAt(const Offset(10, 10));
      controller.lookAt(null);
      await tester.pumpAndSettle();
    });
  });

  group('MobiStage', () {
    testWidgets('types the line in and reads it whole', (tester) async {
      final handle = tester.ensureSemantics();
      const line = 'Hi, I am Mobi. Ten minutes tonight?';
      await pumpMockmob(tester, const Center(child: MobiStage(say: line)));
      expect(find.bySemanticsLabel(line), findsOneWidget);
      await tester.pumpAndSettle();
      final rich = tester.widget<RichText>(find.descendant(of: find.byType(MobiBubble), matching: find.byType(RichText)));
      final shown = (rich.text as TextSpan).children!.first.toPlainText();
      expect(shown, line);
      handle.dispose();
    });

    testWidgets('say() replaces the line and Mobi talks', (tester) async {
      final controller = MobiController();
      addTearDown(controller.dispose);
      await pumpMockmob(tester, Center(child: MobiStage(controller: controller, entrance: MobiAct.idle)));
      await tester.pumpAndSettle();
      expect(find.byType(MobiBubble), findsNothing);
      controller.say('Mock 7 done.');
      await tester.pump();
      expect(find.byType(MobiBubble), findsOneWidget);
      expect(tester.binding.hasScheduledFrame, isTrue);
      await tester.pumpAndSettle();
      controller.hush();
      await tester.pump();
      expect(find.byType(MobiBubble), findsNothing);
    });
  });
}
