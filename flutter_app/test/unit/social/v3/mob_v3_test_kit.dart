// Shared harness for every Mob v3 widget test and golden: the fixture server at a fixed clock
// (Thursday 22 Oct 2026, 8:40 PM IST, the spec's fixture day), the flags on, the Fold manifest read
// from disk, and the repository seeded with the server's den.

import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/social/data/mob_models.dart';
import 'package:mockmob/features/social/data/mob_repository.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_api.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
import 'package:mockmob/features/social/v3/mob_v3_flags.dart';
import 'package:mockmob/features/social/v3/widgets/fold_manifest.dart';

import '../mob_test_kit.dart';

/// Thursday 22 Oct 2026, 8:40 PM IST.
final DateTime v3Now = DateTime.utc(2026, 10, 22, 15, 10);

/// A fixture server on the fixed clock. Scenarios: fresh, one, quiet, open, played, live, heavy,
/// questdone, makeup. Billing: off, free, used, mic, pro.
MobV3FakeServer v3Server({String scenario = 'heavy', String billing = 'off', DateTime? now}) =>
    MobV3FakeServer(scenario: scenario, billing: billing, clock: () => now ?? v3Now)..answerDelay = Duration.zero;

/// Loads folds.json from disk into the manifest cache (call in setUp or at the top of main).
void loadFoldManifestForTest() => FoldManifest.setForTest(FoldManifest.parse(File(foldManifestAsset).readAsStringSync()));

/// Every override a v3 screen needs. The repository starts with the server's den.
List<Override> v3Overrides(MobV3FakeServer server, {DateTime? now}) {
  final at = now ?? v3Now;
  return [
    ...mobOverrides(RemoteState(value: MobRead.fromJson(server.denNow()), fetchedAt: at), now: at),
    mobV3EnabledProvider.overrideWithValue(true),
    mobV3FixturesProvider.overrideWithValue(true),
    mobV3FakeServerProvider.overrideWithValue(server),
  ];
}
