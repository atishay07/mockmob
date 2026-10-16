// The server's mob-v1 fixtures (SOCIAL-APP-CONTRACT.json fixtureBodies, copied to test/fixtures/mob).

import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/data/mob_models.dart';

Map<String, dynamic> _f(String n) => jsonDecode(File('test/fixtures/mob/$n').readAsStringSync()) as Map<String, dynamic>;

void main() {
  test('get_v1: members in order, { value, of } scores, the trap and the null cost', () {
    final mob = MobRead.fromJson(_f('get_v1.json')).mob!;
    expect(mob.members, isNotEmpty);
    expect(mob.week.sat, 3);
    expect(mob.week.size, 4);
    expect(mob.week.paper.costType, MobCostType.unknown);
    expect(mob.visibleTrap!.option, 'B');
    expect(mob.visibleTrap!.youPickedIt, isTrue);
    expect(mob.members.any((m) => m.scoreLine != null), isTrue);
  });

  test('every GET fixture parses, none is a Mob', () {
    for (final n in ['get_not_sat_v1.json', 'get_alone_v1.json']) {
      final mob = MobRead.fromJson(_f(n)).mob!;
      expect(mob.members, isNotEmpty, reason: n);
    }
    expect(MobRead.fromJson(_f('get_none_v1.json')).mob, isNull);
    final alone = MobRead.fromJson(_f('get_alone_v1.json')).mob!;
    expect(alone.alone, isTrue);
  });

  test('the lookup never carries a name', () {
    final raw = jsonEncode(_f('lookup_v1.json'));
    expect(raw.contains('"name"'), isFalse);
  });
}
