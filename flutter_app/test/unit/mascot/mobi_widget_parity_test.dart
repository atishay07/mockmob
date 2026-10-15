import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../../helpers/golden_harness.dart';

void main() {
  testWidgets('the pose-based Mobi hands the tap cycle and the pointer follow to the rig', (tester) async {
    await pumpMockmob(
      tester,
      const Center(child: Mobi(pose: MobiPose.idle, size: 80, interactive: true, tapCycle: MobiTapCycle.standard, followPointer: true)),
    );
    final rig = tester.widget<MobiCharacter>(find.byType(MobiCharacter));
    expect(rig.interactive, isTrue);
    expect(rig.tapCycle, same(MobiTapCycle.standard));
    expect(rig.followPointer, isTrue);
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 3));
  });

  testWidgets('without them nothing changes: no cycle, no follow', (tester) async {
    await pumpMockmob(tester, const Center(child: Mobi(pose: MobiPose.idle, size: 80)));
    final rig = tester.widget<MobiCharacter>(find.byType(MobiCharacter));
    expect(rig.tapCycle, isNull);
    expect(rig.followPointer, isFalse);
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 3));
  });

  testWidgets('Quiet turns a celebration into a nod that returns to the stance, and a held hero into rest', (tester) async {
    final c = MobiController();
    addTearDown(c.dispose);
    await pumpMockmob(
      tester,
      MobiCelebrations(level: MobiCelebrationLevel.quiet, child: Center(child: MobiCharacter(controller: c, entrance: MobiAct.idle, watchTaps: false))),
    );
    await tester.pump(const Duration(milliseconds: 600));
    expect(c.react(MobiAct.proud), isTrue);
    await tester.pump(const Duration(seconds: 2));
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 3));
  });
}
