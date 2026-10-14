// Shared bits for the painted-scene tests and goldens (welcome, plan seal, milestone, empty
// states): decoding the scenes before a frame is compared, and the moments under test.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/art/scene_art.dart';
import 'package:mockmob/features/rhythm/celebration/celebration_controller.dart';
import 'package:mockmob/features/rhythm/celebration/celebration_event.dart';

import '../../helpers/golden_harness.dart';

/// Decodes every [SceneImage] in the tree through the provider it draws with (so the cache keys
/// match), then lets the frame and Mobi settle.
Future<void> precacheScenes(WidgetTester tester) async {
  final scenes = find.byType(SceneImage, skipOffstage: false).evaluate().toList();
  await tester.runAsync(() async {
    for (final element in scenes) {
      final scene = element.widget as SceneImage;
      final dpr = MediaQuery.devicePixelRatioOf(element);
      await precacheImage(scene.art.provider(scene.width, dpr), element);
    }
  });
  await tester.pump();
  await settleImages(tester);
}

/// The [Celebration] the controller would hand the slot for [e] (Full, or Quiet with [quiet]).
Celebration momentOf(CelebrationEvent e, {bool quiet = false}) => Celebration(
      id: e.id,
      scope: e.scope,
      level: e.level,
      kind: e.kind,
      sentence: e.sentence,
      receipt: e.receipt,
      ring: e.ring && !quiet,
      studyDays: e.studyDays,
      goal: e.goal,
      mobiHop: e.level == CelebrationLevel.l2 && !quiet,
      textOnly: quiet,
      linkLabel: e.linkLabel,
      link: e.link,
    );

/// A first repair, as the repair ending fires it.
final CelebrationEvent firstRepair = CelebrationEvent.repairFinished(
  attemptId: 'a1',
  firstRequestId: 'r1',
  at: DateTime(2026, 10, 14, 20, 15),
  firstEver: true,
);

/// A first met week, with its counts.
final CelebrationEvent firstWeek = CelebrationEvent.weekMet(weekStart: '2026-10-05', studyDays: 4, goal: 4, firstEver: true);
