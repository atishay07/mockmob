// Goldens for live rooms (spec 7.3, Phase B), 360 dp Night and Day: L1 the lobby as a guest (Kabir has
// just arrived, "Kabir is here now.", his "Good luck" in the air), L1 after "I'm ready", L1 as the host,
// R1 the live race (friends on the ruler from the server's progress), R5 a friend reaching the flag;
// and the frame strips of the live countdown (Go on the server clock) and of a friend finishing.
// The room is driven by hand (FakeMobRoomChannel), so every frame lands on an exact time.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/v3/data/mob_room_channel.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/screens/game_run_screen.dart';

import '../../../unit/social/v3/live_test_kit.dart';
import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../../unit/social/v3/run_test_kit.dart' show correctOf, precacheRunArt, tapOption;
import '../../you/you_golden_kit.dart';

String _tag(Brightness b) => b == Brightness.dark ? 'night' : 'day';

Finder get _lobby => find.byType(GameRunScreen);
Finder get _run => find.byType(GameRunScreen);

/// Riya's room as a guest: Riya hosts and is here; Kabir arrives 1.5 s later and sends "Good luck".
Future<FakeMobRoomChannel> _guestLobby(WidgetTester tester, {Brightness b = Brightness.dark, MobV3FakeServer? server}) async {
  final ch = FakeMobRoomChannel();
  await pumpLobby(tester, server ?? liveServer(), channel: ch, brightness: b);
  ch.emit(const RoomPresenceSync({riya: RoomPresenceStatus.here, aarav: RoomPresenceStatus.here}));
  await tester.pump();
  await precacheRunArt(tester);
  await pumpFor(tester, const Duration(milliseconds: 1500));
  ch.emit(const RoomPresenceSync({riya: RoomPresenceStatus.here, kabir: RoomPresenceStatus.here, aarav: RoomPresenceStatus.here}));
  await pumpFor(tester, const Duration(milliseconds: 900));
  ch.emit(const RoomSticker(memberId: kabir, kind: StickerKind.goodLuck));
  return ch;
}

/// The guest lobby through to the run: Kabir ready, you ready, Riya starts; [afterStartMs] after her tap.
Future<(FakeMobRoomChannel, MobV3FakeServer)> _toRun(WidgetTester tester, {Brightness b = Brightness.dark, int afterStartMs = 5000}) async {
  final s = liveServer();
  final ch = await _guestLobby(tester, b: b, server: s);
  // The cheer stills (a friend at the flag) decode up front: a golden pump never waits for a new still.
  final ctx = tester.element(_lobby);
  await tester.runAsync(() async {
    for (final f in const ['patang', 'naav', 'dart']) {
      await precacheImage(AssetImage('assets/folds/fold-$f-cheer@256.webp', bundle: DefaultAssetBundle.of(ctx)), ctx);
    }
  });
  await pumpFor(tester, const Duration(milliseconds: 600));
  ch.emit(const RoomPresenceSync({riya: RoomPresenceStatus.here, kabir: RoomPresenceStatus.ready, aarav: RoomPresenceStatus.ready}));
  await tester.pump();
  s.startRoomAsHost(riyaRoom);
  ch.emit(RoomStarted(s.roomInfo(riyaRoom).startsAt!));
  await tester.pump();
  await precacheRunArt(tester);
  await pumpFor(tester, Duration(milliseconds: afterStartMs), stepMs: 20);
  return (ch, s);
}

void main() {
  setUpGoldenFonts();

  for (final b in [Brightness.dark, Brightness.light]) {
    testWidgets('L1 lobby, guest, Kabir is here now ${_tag(b)}', (tester) async {
      await _guestLobby(tester, b: b);
      await pumpFor(tester, const Duration(milliseconds: 600));
      await precacheRunArt(tester, rounds: 8);
      await expectLater(_lobby, matchesGoldenFile('goldens/live_l1_guest_360_${_tag(b)}.png'));
      await closeRoom(tester);
    });

    testWidgets('R1 live race, friends on the ruler ${_tag(b)}', (tester) async {
      final (ch, s) = await _toRun(tester, b: b);
      ch.emit(const RoomProgress(memberId: riya, q: 1));
      await tester.pump(const Duration(milliseconds: 400));
      s.skew = const Duration(seconds: 30);
      await tapOption(tester, correctOf(0));
      await tester.pump(const Duration(milliseconds: 120));
      await tester.tap(find.byKey(const ValueKey('run-key-lock')));
      await tester.pump();
      await tester.pump(GameRunScreen.feedback);
      await tester.tap(find.byKey(const ValueKey('run-key-next')));
      await pumpFor(tester, const Duration(milliseconds: 600), stepMs: 20);
      ch.emit(const RoomProgress(memberId: riya, q: 2));
      ch.emit(const RoomProgress(memberId: kabir, q: 1));
      await pumpFor(tester, const Duration(milliseconds: 700), stepMs: 20);
      await precacheRunArt(tester, rounds: 8);
      await expectLater(_run, matchesGoldenFile('goldens/live_r1_race_360_${_tag(b)}.png'));
      await closeRoom(tester);
    });
  }

  testWidgets("L1 lobby, after I'm ready night", (tester) async {
    final ch = await _guestLobby(tester);
    await pumpFor(tester, const Duration(milliseconds: 2600));
    ch.emit(const RoomPresenceSync({riya: RoomPresenceStatus.here, kabir: RoomPresenceStatus.ready, aarav: RoomPresenceStatus.here}));
    await pumpFor(tester, const Duration(milliseconds: 600));
    await tester.tap(find.byKey(const ValueKey('lobby-ready')));
    await pumpFor(tester, const Duration(milliseconds: 700));
    await precacheRunArt(tester, rounds: 8);
    await expectLater(_lobby, matchesGoldenFile('goldens/live_l1_ready_360_night.png'));
    await closeRoom(tester);
  });

  testWidgets('L1 lobby, host night', (tester) async {
    final s = MobV3FakeServer(scenario: 'quiet', clock: () => v3Now, live: true)..answerDelay = Duration.zero;
    final g = await s.openGame(mob: MobV3FakeServer.chaiId, format: GameFormat.sprint, mode: GameMode.live, count: 5);
    final ch = FakeMobRoomChannel();
    await pumpLobby(tester, s, gameId: g.id, channel: ch);
    ch.emit(const RoomPresenceSync({aarav: RoomPresenceStatus.here}));
    await precacheRunArt(tester);
    ch.emit(const RoomPresenceSync({aarav: RoomPresenceStatus.here, riya: RoomPresenceStatus.ready}));
    await pumpFor(tester, const Duration(milliseconds: 1300));
    await precacheRunArt(tester, rounds: 8);
    await expectLater(_lobby, matchesGoldenFile('goldens/live_l1_host_360_night.png'));
    await closeRoom(tester);
  });

  testWidgets('R5 a friend reaches the flag, live, night', (tester) async {
    final (ch, _) = await _toRun(tester);
    ch.emit(const RoomProgress(memberId: riya, q: 4));
    ch.emit(const RoomProgress(memberId: kabir, q: 3));
    await pumpFor(tester, const Duration(milliseconds: 600), stepMs: 20);
    ch.emit(const RoomProgress(memberId: riya, q: 5, done: true));
    await pumpFor(tester, const Duration(milliseconds: 1200), stepMs: 20);
    await precacheRunArt(tester, rounds: 8);
    await expectLater(_run, matchesGoldenFile('goldens/live_r5_friend_done_360_night.png'));
    await closeRoom(tester);
  });

  // Frame strip: the live countdown. The host's start is at 0; Go lands at 4000 on the server clock.
  // Frames sit inside the beats (the countdown's own clock t = ms - 2200): the wait, 3 stamping, 3 held,
  // 2 stamping, 2 held, 1 held, Go landing, the stage leaving, the question risen.
  for (final ms in [1200, 2290, 2500, 2890, 3100, 3490, 4100, 4600, 4800]) {
    testWidgets('live countdown frame at $ms ms after the start', (tester) async {
      await _toRun(tester, afterStartMs: ms);
      await precacheRunArt(tester, rounds: 8);
      await expectLater(_run, matchesGoldenFile('goldens/live_frames/countdown_${ms.toString().padLeft(4, '0')}.png'));
      await closeRoom(tester);
    });
  }

  // Frame strip: Riya finishes while you play question 1 (M6: glide, fill, hop, hit-stop, pennant, toast).
  for (final ms in [0, 160, 320, 420, 490, 600, 800, 1120]) {
    testWidgets('live friend finishing frame at $ms ms', (tester) async {
      final (ch, _) = await _toRun(tester);
      ch.emit(const RoomProgress(memberId: riya, q: 4));
      ch.emit(const RoomProgress(memberId: kabir, q: 2));
      await pumpFor(tester, const Duration(milliseconds: 600), stepMs: 20);
      ch.emit(const RoomProgress(memberId: riya, q: 5, done: true));
      await tester.pump();
      if (ms > 0) await pumpFor(tester, Duration(milliseconds: ms), stepMs: 20);
      await precacheRunArt(tester, rounds: 8);
      await expectLater(_run, matchesGoldenFile('goldens/live_frames/friend_done_${ms.toString().padLeft(4, '0')}.png'));
      await closeRoom(tester);
    });
  }
}
