// The ruler at 5 players (spec 0.3: 48 dp Folds, initials and a colour tab), with two Folds on one
// number standing in depth and one Fold at the flag, 360 dp Night and Day. The fixture Mob has 4
// members, so this golden draws the ruler on its own.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/widgets/ruler_race.dart';

import '../../../helpers/golden_harness.dart';
import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../you/you_golden_kit.dart';

const _five = [
  RulerRacer(id: 'riya', name: 'Riya', fold: FoldKey.patang, colour: 3, ghost: true, finished: true, arrivedMs: 190000),
  RulerRacer(id: 'kabir', name: 'Kabir', fold: FoldKey.naav, colour: 0, ghost: true, at: 4, arrivedMs: 160000),
  RulerRacer(id: 'zoya', name: 'Zoya', fold: FoldKey.cutting, colour: 6, ghost: true, at: 3, arrivedMs: 150000),
  RulerRacer(id: 'meher', name: 'Meher', fold: FoldKey.hexa, colour: 1, ghost: true, at: 3, arrivedMs: 131000),
  RulerRacer(id: 'you', name: 'Aarav', fold: FoldKey.dart, colour: 5, you: true, at: 3, arrivedMs: 122000),
];

void main() {
  setUpGoldenFonts();
  setUp(loadFoldManifestForTest);

  for (final b in [Brightness.dark, Brightness.light]) {
    final tag = b == Brightness.dark ? 'night' : 'day';
    testWidgets('R1 ruler, 5 players compact $tag', (tester) async {
      await pumpMockmob(
        tester,
        const Padding(
          padding: EdgeInsets.all(16),
          child: Column(children: [RulerRace(count: 5, racers: _five, answered: 2, instant: true)]),
        ),
        brightness: b,
        size: const Size(360, 200),
        disableAnimations: true,
      );
      await expectLater(find.byType(RulerRace), matchesGoldenFile('goldens/run_r1_ruler5_360_$tag.png'));
    });
  }
}
