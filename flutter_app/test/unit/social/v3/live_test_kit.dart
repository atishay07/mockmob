// Harness for live rooms (Phase B): the fixture server with live on, the lobby pumped in a real
// navigator (so the run can take the room over), the room's clock tied to the fixture server's clock
// (so `serverNow()` is exactly the server's), and either the scripted fixture room or a hand-driven
// fake channel.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/social/v3/data/mob_room_channel.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
import 'package:mockmob/features/social/v3/screens/live_lobby_screen.dart';

import '../../../helpers/golden_harness.dart' show FileAssetBundle;
import 'mob_v3_test_kit.dart';

const String riyaRoom = 'game-riya-sprint';
const String aarav = 'AARAV0000001';
const String riya = 'RIYA00000002';
const String kabir = 'KABIR0000003';
const String zoya = 'ZOYA00000004';

/// The fixture server in the 'live' scenario (Riya's room in the lobby), answering at once.
MobV3FakeServer liveServer({String scenario = 'live', bool live = true}) =>
    MobV3FakeServer(scenario: scenario, clock: () => v3Now, live: live)..answerDelay = Duration.zero;

/// Pumps the lobby for [gameId]. [channel] replaces the scripted fixture room with a hand-driven one.
Future<void> pumpLobby(
  WidgetTester tester,
  MobV3FakeServer server, {
  String gameId = riyaRoom,
  bool opened = false,
  FakeMobRoomChannel? channel,
  Brightness brightness = Brightness.dark,
  Size size = const Size(360, 780),
  bool reduced = false,
  List<Override> extra = const [],
}) async {
  loadFoldManifestForTest();
  tester.view.physicalSize = size * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        ...v3Overrides(server),
        mobLiveClockProvider.overrideWithValue(() => server.now),
        if (channel != null) mobRoomChannelFactoryProvider.overrideWithValue((_) => channel),
        ...extra,
      ],
      child: DefaultAssetBundle(
        bundle: FileAssetBundle(),
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: buildTheme(Brightness.light),
          darkTheme: buildTheme(Brightness.dark),
          themeMode: brightness == Brightness.dark ? ThemeMode.dark : ThemeMode.light,
          builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: reduced), child: app!),
          home: LiveLobbyScreen(gameId: gameId, opened: opened),
        ),
      ),
    ),
  );
  // The room opens after the first frame; the fixture server answers in microtasks.
  await tester.pump();
  await tester.pump();
  await tester.pump();
}

/// Pumps [d] in 100 ms frames (timers and animations move together).
Future<void> pumpFor(WidgetTester tester, Duration d, {int stepMs = 100}) async {
  var left = d.inMilliseconds;
  while (left > 0) {
    final s = left < stepMs ? left : stepMs;
    await tester.pump(Duration(milliseconds: s));
    left -= s;
  }
}

/// Unmounts the tree so the room drops its channel and every scripted timer stops.
Future<void> closeRoom(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox());
  await tester.pump();
  await tester.pump(const Duration(seconds: 1));
}
