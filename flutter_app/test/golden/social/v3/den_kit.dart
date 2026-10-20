// Shared pump for the den's widget tests and goldens: the fixture server on the spec's fixed clock,
// the Fold manifest from disk, a pinned den clock and a recording moment player.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/pro_nudge/pro_nudge.dart' show proNudgesOnProvider;
import 'package:mockmob/features/social/data/mob_navigator.dart';
import 'package:mockmob/features/social/data/mob_repository.dart';
import 'package:mockmob/features/social/data/mob_models.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_api.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
import 'package:mockmob/features/social/v3/mob_v3_flags.dart';
import 'package:mockmob/features/social/v3/logic/moment_queue.dart';
import 'package:mockmob/features/social/v3/screens/den_screen.dart';

import '../../../helpers/golden_harness.dart';
import '../../../unit/social/mob_test_kit.dart';
import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../../unit/you/you_test_support.dart' show youOverrides;

/// Records the moments the den plays, closing each when [close] completes (at once by default).
class RecordingMoments {
  final List<String> played = [];
  Future<void> Function(String key)? hold;

  MomentPlayer get player => (context, key) async {
    played.add(key);
    await hold?.call(key);
    return [key];
  };
}

/// [state] replaces the repository's first read (D6: loading or failed).
/// [auth] signs in a student of the test's own (for example with a credit balance); [nudges] turns the Pro ways on.
/// [prefs] is the phone's store (the den's act memory lives there): pass one to open the den again on the same phone.
List<Override> denOverrides(MobV3FakeServer server, {RecordingMoments? moments, RemoteState<MobRead>? state, AuthSnapshot? auth, bool? nudges, PrefsStore? prefs}) => [
  if (auth != null) ...[
    ...youOverrides(auth: auth, now: v3Now),
    mobRepositoryProvider.overrideWithBuild((ref, n) => RemoteState(value: MobRead.fromJson(server.denNow()), fetchedAt: v3Now)),
    mobPrefsStoreProvider.overrideWithValue(prefs ?? MemoryPrefsStore()),
    mobNavigatorProvider.overrideWithValue(RecordingNavigator()),
    mobActionsProvider.overrideWith((ref) => FakeMobActions(ref)),
    mobV3EnabledProvider.overrideWithValue(true),
    mobV3FixturesProvider.overrideWithValue(true),
    mobV3FakeServerProvider.overrideWithValue(server),
  ] else if (state == null)
    ...v3Overrides(server, prefs: prefs)
  else ...[
    ...mobOverrides(state, now: v3Now, prefs: prefs),
    mobV3EnabledProvider.overrideWithValue(true),
    mobV3FixturesProvider.overrideWithValue(true),
    mobV3FakeServerProvider.overrideWithValue(server),
  ],
  denClockProvider.overrideWithValue(() => v3Now),
  momentPlayerProvider.overrideWithValue((moments ?? RecordingMoments()).player),
  if (nudges != null) proNudgesOnProvider.overrideWithValue(nudges),
];

/// Pumps the den as the Mob tab.
Future<void> pumpDen(
  WidgetTester tester,
  MobV3FakeServer server, {
  Brightness brightness = Brightness.dark,
  double width = 360,
  double height = 1100,
  double textScale = 1,
  bool reduced = true,
  RecordingMoments? moments,
  RemoteState<MobRead>? state,
  AuthSnapshot? auth,
  bool? nudges,
  PrefsStore? prefs,
}) async {
  loadFoldManifestForTest();
  await pumpMockmob(
    tester,
    const DenScreen(asTab: true),
    brightness: brightness,
    size: Size(width, height),
    textScale: textScale,
    wrapInScaffold: false,
    disableAnimations: reduced,
    overrides: denOverrides(server, moments: moments, state: state, auth: auth, nudges: nudges, prefs: prefs),
  );
}
