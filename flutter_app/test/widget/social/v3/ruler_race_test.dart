// The ghost race reads (walk H4): name tags never overlap, every Fold stays inside the card, ghosts
// are drawn as ghosts, and later arrivals on a shared number stand back (10 dp up, 0.86, 70%).

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/widgets/fold_puppet.dart';
import 'package:mockmob/features/social/v3/widgets/ruler_race.dart';

import '../../../helpers/golden_harness.dart';
import '../../../unit/social/v3/mob_v3_test_kit.dart';

const _start = [
  RulerRacer(id: 'riya', name: 'Riya', fold: FoldKey.patang, colour: 3, ghost: true),
  RulerRacer(id: 'kabir', name: 'Kabir', fold: FoldKey.naav, colour: 0, ghost: true),
  RulerRacer(id: 'zoya', name: 'Zoya', fold: FoldKey.cutting, colour: 6, ghost: true),
  RulerRacer(id: 'you', name: 'Aarav', fold: FoldKey.dart, colour: 5, you: true),
];

const _five = [
  ..._start,
  RulerRacer(id: 'meher', name: 'Meher', fold: FoldKey.hexa, colour: 1, ghost: true, at: 2, arrivedMs: 9000),
];

void main() {
  setUp(loadFoldManifestForTest);

  group('RulerLabels', () {
    test('tags on one spot spread out and never touch', () {
      final lefts = RulerLabels.layout([for (var i = 0; i < 4; i++) (x: 30.0, w: 44.0)], minLeft: 10, maxRight: 300);
      final sorted = [...lefts]..sort();
      for (var i = 1; i < sorted.length; i++) {
        expect(sorted[i] - sorted[i - 1], greaterThanOrEqualTo(44 + RulerLabels.gap - 0.01));
      }
      expect(sorted.first, greaterThanOrEqualTo(10));
    });

    test('tags near the pole pull back left of it', () {
      final lefts = RulerLabels.layout([(x: 290.0, w: 40.0), (x: 295.0, w: 40.0)], minLeft: 10, maxRight: 300);
      expect(lefts.reduce(math.max) + 40, lessThanOrEqualTo(300.01));
    });
  });

  group('RulerDepth', () {
    test('the second arrival stands 10 dp up at 0.86 and 70%', () {
      expect(RulerDepth.row(0), 0);
      expect(RulerDepth.row(1), 1);
      expect(RulerDepth.up(1), 10);
      expect(RulerDepth.scale(1), 0.86);
      expect(RulerDepth.brightness(1), 0.7);
    });
  });

  for (final (name, racers) in [('4 at question 1', _start), ('5 racers compact', _five)]) {
    testWidgets('H4 $name: tags apart, Folds inside the card, ghosts as ghosts, later arrivals back', (tester) async {
      await pumpMockmob(
        tester,
        Padding(padding: const EdgeInsets.all(16), child: Column(children: [RulerRace(count: 5, racers: racers, instant: true)])),
        brightness: Brightness.dark,
        size: const Size(360, 200),
        disableAnimations: true,
      );
      final card = tester.getRect(find.byType(RulerRace));
      final tags = [for (final r in racers) tester.getRect(find.byKey(ValueKey('ruler-name-${r.id}')))];
      for (var i = 0; i < tags.length; i++) {
        for (var j = i + 1; j < tags.length; j++) {
          expect(tags[i].overlaps(tags[j]), isFalse, reason: '${racers[i].id} and ${racers[j].id} tags overlap');
        }
      }
      for (final r in racers) {
        final f = tester.getRect(find.byKey(ValueKey('ruler-fold-${r.id}')));
        expect(f.left, greaterThanOrEqualTo(card.left), reason: '${r.id} left');
        expect(f.right, lessThanOrEqualTo(card.right), reason: '${r.id} right');
        final p = tester.widget<FoldPuppet>(find.byKey(ValueKey('ruler-puppet-${r.id}')));
        expect(p.ghost, r.ghost);
      }
      // On number 1 one Fold stands in front at full brightness; the others stand back.
      final onOne = [for (final r in racers) if (r.at == 1) tester.widget<FoldPuppet>(find.byKey(ValueKey('ruler-puppet-${r.id}')))];
      expect(onOne.where((p) => p.brightness == 1).length, 1);
      expect(onOne.where((p) => p.brightness < 1).length, onOne.length - 1);
    });
  }
}
