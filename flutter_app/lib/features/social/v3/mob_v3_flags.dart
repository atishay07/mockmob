// Mob v3 switches (MOB-BUILD-SPEC-V3 section 1.1). The den, games, chains and shelf show only when the
// app's MOB_V3_ENABLED is on AND the server can serve them on `GET /api/mob` (the `v3` object with a
// Mob, the top-level `v3Available` with none). The app flag is ON by default (version 13), so the server
// switches the new Mob on; `--dart-define=MOB_V3_ENABLED=false` keeps today's Mob whatever it sends.
//
// MOB_V3_FIXTURES=true (debug and walk builds only) answers every Mob call from the in-app fixture
// server (`data/mob_v3_fake_server.dart`), so the whole loop runs before the real server lands.
// MOB_V3_SCENARIO picks the fixture account: fresh, one, quiet, open, played, live, heavy (default).

import 'package:flutter_riverpod/flutter_riverpod.dart';

abstract final class MobV3Flags {
  static const bool enabledByDefine = bool.fromEnvironment('MOB_V3_ENABLED', defaultValue: true);
  static const bool fixturesByDefine = bool.fromEnvironment('MOB_V3_FIXTURES');
  static const String scenarioByDefine = String.fromEnvironment('MOB_V3_SCENARIO', defaultValue: 'heavy');

  /// Billing simulation for the fixture server only: off (default), free, used, mic, pro.
  static const String billingByDefine = String.fromEnvironment('MOB_V3_BILLING', defaultValue: 'off');
}

/// Overridable in tests. True draws the v3 den whenever the read carries `v3` (or fixtures are on).
final mobV3EnabledProvider = Provider<bool>((ref) => MobV3Flags.enabledByDefine || MobV3Flags.fixturesByDefine);

/// Overridable in tests. True answers Mob calls from the fixture server.
final mobV3FixturesProvider = Provider<bool>((ref) => MobV3Flags.fixturesByDefine);
