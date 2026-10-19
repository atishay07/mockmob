// Mob v3 switches (MOB-BUILD-SPEC-V3 section 1.1). The den, games, chains and shelf show only when the
// app is built with MOB_V3_ENABLED=true AND the server sends the `v3` object on `GET /api/mob`. With the
// flag off the app draws today's Mob exactly as it was (nothing in the old screens reads v3).
//
// MOB_V3_FIXTURES=true (debug and walk builds only) answers every Mob call from the in-app fixture
// server (`data/mob_v3_fake_server.dart`), so the whole loop runs before the real server lands.
// MOB_V3_SCENARIO picks the fixture account: fresh, one, quiet, open, played, live, heavy (default).

import 'package:flutter_riverpod/flutter_riverpod.dart';

abstract final class MobV3Flags {
  static const bool enabledByDefine = bool.fromEnvironment('MOB_V3_ENABLED');
  static const bool fixturesByDefine = bool.fromEnvironment('MOB_V3_FIXTURES');
  static const String scenarioByDefine = String.fromEnvironment('MOB_V3_SCENARIO', defaultValue: 'heavy');

  /// Billing simulation for the fixture server only: off (default), free, used, mic, pro.
  static const String billingByDefine = String.fromEnvironment('MOB_V3_BILLING', defaultValue: 'off');
}

/// Overridable in tests. True draws the v3 den whenever the read carries `v3` (or fixtures are on).
final mobV3EnabledProvider = Provider<bool>((ref) => MobV3Flags.enabledByDefine || MobV3Flags.fixturesByDefine);

/// Overridable in tests. True answers Mob calls from the fixture server.
final mobV3FixturesProvider = Provider<bool>((ref) => MobV3Flags.fixturesByDefine);
