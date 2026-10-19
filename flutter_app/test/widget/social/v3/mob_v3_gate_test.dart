// The gate (spec 1.1): with MOB_V3_ENABLED off the Mob tab stays exactly as it was, even when the
// server sends v3; with it on, the den draws only when the server can serve it: `v3` with a Mob,
// the top-level `v3Available` with none. Old servers that send neither keep today's Mob.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/social/data/mob_models.dart';
import 'package:mockmob/features/social/screens/mob_screen.dart';
import 'package:mockmob/features/social/v3/mob_v3_flags.dart';
import 'package:mockmob/features/social/v3/screens/den_screen.dart';

import '../../../helpers/golden_harness.dart';
import '../../../unit/social/mob_test_kit.dart';
import '../../../unit/social/v3/mob_v3_test_kit.dart';

void main() {
  setUpAll(loadFoldManifestForTest);

  testWidgets('flag off: v3 in the read is ignored, today\'s Mob shows', (tester) async {
    final s = v3Server();
    await pumpMockmob(
      tester,
      const MobScreen(asTab: true),
      wrapInScaffold: false,
      disableAnimations: true,
      overrides: [
        ...mobOverrides(RemoteState(value: MobRead.fromJson(s.denNow()), fetchedAt: v3Now), now: v3Now),
        mobV3EnabledProvider.overrideWithValue(false),
      ],
    );
    expect(find.byType(DenScreen), findsNothing);
  });

  testWidgets('flag on: a read with v3 draws the den', (tester) async {
    final s = v3Server();
    await pumpMockmob(tester, const MobScreen(asTab: true), wrapInScaffold: false, disableAnimations: true, overrides: v3Overrides(s));
    expect(find.byType(DenScreen), findsOneWidget);
  });

  Future<void> pumpRead(WidgetTester tester, Map<String, Object?> json) => pumpMockmob(
        tester,
        const MobScreen(asTab: true),
        wrapInScaffold: false,
        disableAnimations: true,
        overrides: [
          ...mobOverrides(RemoteState(value: MobRead.fromJson(json), fetchedAt: v3Now), now: v3Now),
          mobV3EnabledProvider.overrideWithValue(true),
        ],
      );

  testWidgets('server on: no Mob with v3Available draws the den start', (tester) async {
    await pumpRead(tester, {'mob': null, 'v3Available': true});
    expect(find.byType(DenScreen), findsOneWidget);
  });

  testWidgets("server off: no Mob and no v3Available keeps today's Mob (old servers too)", (tester) async {
    await pumpRead(tester, {'mob': null});
    expect(find.byType(DenScreen), findsNothing);
    await pumpRead(tester, {'mob': null, 'v3Available': false});
    expect(find.byType(DenScreen), findsNothing);
  });

  testWidgets("server off: a student in a Mob with no v3 keeps today's Mob, even with v3Available", (tester) async {
    final json = Map<String, Object?>.from(v3Server().denNow())..remove('v3');
    final mob = Map<String, Object?>.from(json['mob']! as Map)..remove('v3');
    await pumpRead(tester, {...json, 'mob': mob, 'v3Available': false});
    expect(find.byType(DenScreen), findsNothing);
    await pumpRead(tester, {'mob': mob});
    expect(find.byType(DenScreen), findsNothing);
    await pumpRead(tester, {'mob': mob, 'v3Available': true});
    expect(find.byType(DenScreen), findsNothing, reason: 'with a Mob the den needs the v3 object itself');
  });

  test('MobRead reads v3Available; absent or not true is false', () {
    expect(MobRead.fromJson({'mob': null, 'v3Available': true}).v3Available, isTrue);
    expect(MobRead.fromJson({'mob': null}).v3Available, isFalse);
    expect(MobRead.fromJson({'mob': null, 'v3Available': 'yes'}).v3Available, isFalse);
    expect(MobRead.fromJson({'mob': null}).serverV3, isFalse);
    expect(MobRead.fromJson({'mob': null, 'v3Available': true}).serverV3, isTrue);
  });

  test('the app flag is on unless the build says MOB_V3_ENABLED=false', () {
    expect(MobV3Flags.enabledByDefine, isTrue);
  });

  testWidgets('flag on, nothing read yet: the den does not draw', (tester) async {
    await pumpMockmob(
      tester,
      const MobScreen(asTab: true),
      wrapInScaffold: false,
      disableAnimations: true,
      overrides: [
        ...mobOverrides(const RemoteState<MobRead>(), now: v3Now),
        mobV3EnabledProvider.overrideWithValue(true),
      ],
    );
    expect(find.byType(DenScreen), findsNothing);
    expect(find.byType(Scaffold), findsWidgets);
  });
}
