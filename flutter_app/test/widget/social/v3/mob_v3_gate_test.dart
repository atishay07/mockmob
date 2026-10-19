// The gate (spec 1.1): with MOB_V3_ENABLED off the Mob tab stays exactly as it was, even when the
// server sends v3; with it on, a read with v3 (or no Mob) draws the den.

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

  testWidgets('flag on: no Mob draws the den start even without v3 (the server sends v3 inside the Mob)', (tester) async {
    await pumpMockmob(
      tester,
      const MobScreen(asTab: true),
      wrapInScaffold: false,
      disableAnimations: true,
      overrides: [
        ...mobOverrides(noMobState(), now: v3Now),
        mobV3EnabledProvider.overrideWithValue(true),
      ],
    );
    expect(find.byType(DenScreen), findsOneWidget);
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
