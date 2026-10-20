// L1, L2, R1, R5, R6 live (spec 5.3, 7.2): the whole live loop against the fixture room, as a guest and
// as the host, and the states a room can end in. The fixture room (data/mob_room_script.dart) plays
// Riya and Kabir; the fixture server keeps the clock.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/v3/copy_v3.dart';
import 'package:mockmob/features/social/v3/data/mob_room_channel.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/screens/game_run_screen.dart';
import 'package:mockmob/features/social/v3/widgets/lobby_stage.dart';

import '../../../unit/social/v3/live_test_kit.dart';
import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../../unit/social/v3/run_test_kit.dart' show correctOf, wrongOf, tapOption;

Finder _key(String k) => find.byKey(ValueKey(k));

/// A tag on the stage (the sticker row has a "Ready" sticker too).
Finder _onStage(String text) => find.descendant(of: find.byType(LobbyStage), matching: find.text(text));

/// Answers the current question at server time [atSeconds] and moves on.
Future<void> _answer(WidgetTester tester, MobV3FakeServer s, {required int pick, required int atSeconds}) async {
  s.skew = Duration(seconds: atSeconds);
  if (pick < 0) {
    await tester.tap(_key('run-key-skip'));
  } else {
    await tapOption(tester, pick);
    await tester.pump(const Duration(milliseconds: 120));
    await tester.tap(_key('run-key-lock'));
  }
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
  await tester.pump(GameRunScreen.feedback);
  await tester.tap(_key('run-key-next'));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 160));
  await tester.pump(const Duration(milliseconds: 220));
}

void main() {
  testWidgets("guest: Riya's room, Kabir arrives, I'm ready, Riya starts, the shared countdown, the live race, the podium after the room", (tester) async {
    final s = liveServer();
    await pumpLobby(tester, s);

    // L1 as it opens: Riya hosts, you are here, two open seats with no names.
    expect(find.text("Riya's room"), findsOneWidget);
    expect(find.text('Live sprint, 5 questions'), findsOneWidget);
    expect(_key('lobby-live'), findsOneWidget);
    expect(_onStage(MobV3Copy.tagHost), findsOneWidget);
    expect(_onStage(MobV3Copy.tagHere), findsOneWidget);
    expect(find.text(MobV3Copy.openSeat), findsNWidgets(2));
    expect(find.text('Kabir'), findsNothing);
    expect(find.text('Zoya'), findsNothing);
    expect(find.text(MobV3Copy.lobbyLine(5)), findsOneWidget);
    expect(find.text(MobV3Copy.sendASticker), findsOneWidget);
    expect(_key('lobby-ready'), findsOneWidget);
    expect(find.text(MobV3Copy.playLaterInstead), findsOneWidget);

    // Kabir arrives: his Fold hops in and the line says so (the S7 moment).
    await pumpFor(tester, const Duration(milliseconds: 1600));
    expect(find.text(MobV3Copy.isHereNow('Kabir')), findsOneWidget);
    expect(find.text('Kabir'), findsOneWidget);
    expect(find.text(MobV3Copy.openSeat), findsOneWidget);
    await pumpFor(tester, const Duration(milliseconds: 1000));
    expect(_key('lobby-sticker-1'), findsOneWidget); // Kabir's "Good luck" flies over him
    expect(find.text('Good luck'), findsWidgets);

    // I'm ready: the key waits for the host, quietly.
    await tester.tap(_key('lobby-ready'));
    await tester.pump();
    expect(find.text(MobV3Copy.waitingFor('Riya')), findsOneWidget);
    expect(_onStage(MobV3Copy.tagReady), findsOneWidget);
    await pumpFor(tester, const Duration(milliseconds: 1200)); // Kabir ready at 3.6 s
    expect(_onStage(MobV3Copy.tagReady), findsNWidgets(2));

    // Riya starts 1.8 s later: the run takes the room over and counts in on the server clock.
    await pumpFor(tester, const Duration(milliseconds: 1900));
    expect(find.byType(GameRunScreen), findsOneWidget);
    expect(_key('run-countdown'), findsOneWidget);
    expect(find.text(MobV3Copy.skipShow), findsNothing);
    // Go lands 4 s after the start: at 3.0 s the "2" shows (beat 2 of 3), at 4.0 s "Go".
    await pumpFor(tester, const Duration(milliseconds: 2900));
    expect(find.text('2'), findsWidgets);
    await pumpFor(tester, const Duration(milliseconds: 1000));
    expect(find.text(MobV3Copy.go), findsOneWidget);
    await pumpFor(tester, const Duration(milliseconds: 1200));
    expect(_key('run-countdown'), findsNothing);
    expect(find.text(MobV3Copy.liveInRoom(3)), findsOneWidget);
    expect(find.text(MobV3Copy.questionOf(1, 5)), findsOneWidget);

    // Riya answers question 1 at 17 s into the run (21 s after the start): her Fold walks to number 2.
    // Never her pick.
    await pumpFor(tester, const Duration(seconds: 16));
    expect(find.bySemanticsLabel(MobV3Copy.rulerAt('Riya', 2, 5)), findsOneWidget);
    expect(find.bySemanticsLabel(MobV3Copy.rulerAt('Kabir', 1, 5)), findsOneWidget);

    // You play all five.
    await _answer(tester, s, pick: correctOf(0), atSeconds: 30);
    await _answer(tester, s, pick: correctOf(1), atSeconds: 40);
    await _answer(tester, s, pick: wrongOf(2), atSeconds: 50);
    await _answer(tester, s, pick: correctOf(3), atSeconds: 60);
    await _answer(tester, s, pick: -1, atSeconds: 70);
    await tester.pump(const Duration(milliseconds: 600));
    expect(_key('run-done-title'), findsOneWidget);
    // R6: friends still racing hold the podium; only those in the room are named.
    expect(find.text(MobV3Copy.stillPlaying(['Riya', 'Kabir'])), findsOneWidget);
    expect(_key('run-key-podium'), findsNothing);

    // Riya reaches the flag at 101 s into the run: her pennant and the toast. You have finished, so it
    // says "Riya finished too." ("Take your time" is only for while you are still playing).
    for (var i = 0; i < 1200 && find.text(MobV3Copy.friendFinishedAfterYou('Riya')).evaluate().isEmpty; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    expect(find.text(MobV3Copy.friendFinishedAfterYou('Riya')), findsOneWidget);
    expect(find.bySemanticsLabel(MobV3Copy.rulerDone('Riya')), findsOneWidget);
    expect(find.text(MobV3Copy.stillPlaying(['Kabir'])), findsOneWidget);
    expect(_key('run-key-podium'), findsNothing);

    // Kabir at 122 s: the live phase ends and the podium opens.
    for (var i = 0; i < 400 && _key('run-key-podium').evaluate().isEmpty; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    expect(_key('run-key-podium'), findsOneWidget);
    expect(find.textContaining('still playing'), findsNothing);

    await closeRoom(tester);
  });

  testWidgets('host: your room, Riya arrives and is ready, Start for everyone, no skip in the shared countdown', (tester) async {
    final s = MobV3FakeServer(scenario: 'quiet', clock: () => v3Now, live: true)..answerDelay = Duration.zero;
    final g = await s.openGame(mob: MobV3FakeServer.chaiId, format: GameFormat.sprint, mode: GameMode.live, count: 5);
    await pumpLobby(tester, s, gameId: g.id, opened: true);
    expect(find.text('Your room'), findsOneWidget);
    expect(_key('lobby-start'), findsOneWidget);
    expect(find.text(MobV3Copy.startWhenReady), findsOneWidget);
    expect(find.text(MobV3Copy.onlyYouHere), findsOneWidget);
    await pumpFor(tester, const Duration(milliseconds: 1500));
    expect(find.text(MobV3Copy.isHereNow('Riya')), findsOneWidget);
    await pumpFor(tester, const Duration(milliseconds: 1300));
    expect(_onStage(MobV3Copy.tagReady), findsOneWidget);
    await tester.tap(_key('lobby-start'));
    await tester.pump();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));
    expect(find.byType(GameRunScreen), findsOneWidget);
    expect(_key('run-countdown'), findsOneWidget);
    await pumpFor(tester, const Duration(milliseconds: 5400));
    expect(find.text(MobV3Copy.questionOf(1, 5)), findsOneWidget);
    expect(find.text(MobV3Copy.liveInRoom(2)), findsOneWidget);
    await closeRoom(tester);
  });

  testWidgets('host: closing the lobby asks first, then the game stays a 24-hour game', (tester) async {
    final s = MobV3FakeServer(scenario: 'quiet', clock: () => v3Now, live: true)..answerDelay = Duration.zero;
    final g = await s.openGame(mob: MobV3FakeServer.chaiId, format: GameFormat.sprint, mode: GameMode.live, count: 5);
    await pumpLobby(tester, s, gameId: g.id, channel: FakeMobRoomChannel());
    await tester.tap(_key('lobby-close'));
    await pumpFor(tester, const Duration(milliseconds: 600));
    expect(find.text(MobV3Copy.closeRoomTitle), findsOneWidget);
    await tester.tap(find.text(MobV3Copy.closeRoom));
    await pumpFor(tester, const Duration(milliseconds: 600));
    expect(s.roomInfo(g.id).state, RoomState.cancelled);
    await closeRoom(tester);
  });

  testWidgets('the quota fallback: a refused channel says Live is busy and offers to play now', (tester) async {
    await pumpLobby(tester, liveServer(), channel: FakeMobRoomChannel(failJoin: true));
    expect(find.text(MobV3Copy.liveBusyRun), findsOneWidget);
    expect(_key('lobby-play-now'), findsOneWidget);
    await closeRoom(tester);
  });

  testWidgets('Riya closes the room: one sentence with the game still open', (tester) async {
    final ch = FakeMobRoomChannel();
    await pumpLobby(tester, liveServer(), channel: ch);
    ch.emit(const RoomCancelled());
    await tester.pump();
    expect(find.textContaining('Riya closed the room. The game stays open until'), findsOneWidget);
    expect(_key('lobby-play-now'), findsOneWidget);
    await closeRoom(tester);
  });

  testWidgets('the host stepping away is said plainly; nobody is counted', (tester) async {
    final ch = FakeMobRoomChannel();
    await pumpLobby(tester, liveServer(), channel: ch);
    ch.emit(const RoomPresenceSync({riya: RoomPresenceStatus.here, aarav: RoomPresenceStatus.here}));
    await tester.pump();
    ch.emit(const RoomPresenceSync({aarav: RoomPresenceStatus.here}));
    await tester.pump();
    expect(find.textContaining('Riya stepped away.'), findsOneWidget);
    expect(find.textContaining('online'), findsNothing);
    await closeRoom(tester);
  });

  testWidgets('live off on the server: the lobby says so and offers the anytime game', (tester) async {
    await pumpLobby(tester, liveServer(live: false), channel: FakeMobRoomChannel());
    expect(find.text(MobV3Copy.errors['LIVE_OFF']!), findsOneWidget);
    await closeRoom(tester);
  });

  testWidgets('during the race a lost channel keeps the run going and says so under the ruler', (tester) async {
    final ch = FakeMobRoomChannel();
    final s = liveServer();
    await pumpLobby(tester, s, channel: ch);
    ch.emit(const RoomPresenceSync({riya: RoomPresenceStatus.here, kabir: RoomPresenceStatus.ready, aarav: RoomPresenceStatus.here}));
    s.startRoomAsHost(riyaRoom);
    ch.emit(RoomStarted(s.roomInfo(riyaRoom).startsAt!));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));
    await pumpFor(tester, const Duration(milliseconds: 5000));
    expect(find.text(MobV3Copy.questionOf(1, 5)), findsOneWidget);
    expect(find.text(MobV3Copy.rulerCaption), findsOneWidget);
    ch.emit(const RoomLinkChanged(RoomLink.busy));
    await tester.pump();
    expect(find.text(MobV3Copy.liveBusyRun), findsOneWidget);
    // Answers still go to the API.
    await _answer(tester, s, pick: correctOf(0), atSeconds: 20);
    expect(find.text(MobV3Copy.questionOf(2, 5)), findsOneWidget);
    await closeRoom(tester);
  });

  testWidgets('a live race (D167): the ready phase, Go on the server clock, then the minutes count down, one question at a time, friends walk the open ruler', (tester) async {
    final s = liveServer(scenario: 'liverace');
    await pumpLobby(tester, s, gameId: 'game-kabir-race');
    // The ready phase is the game screen itself: no lobby screen.
    expect(find.byType(GameRunScreen), findsOneWidget);
    expect(find.text("Kabir's room"), findsOneWidget);
    expect(find.text('Live race, 5 minutes'), findsOneWidget);
    expect(find.text(MobV3Copy.lobbyLineRace(5)), findsOneWidget);
    expect(_onStage(MobV3Copy.tagHost), findsOneWidget);

    // Riya arrives and is ready; you are ready; Kabir starts.
    await pumpFor(tester, const Duration(milliseconds: 1600));
    expect(find.text(MobV3Copy.isHereNow('Riya')), findsOneWidget);
    await tester.tap(_key('lobby-ready'));
    await tester.pump();
    await pumpFor(tester, const Duration(milliseconds: 2000)); // Riya ready at 3.6 s
    await pumpFor(tester, const Duration(milliseconds: 1900)); // Kabir starts 1.8 s later
    expect(_key('run-countdown'), findsOneWidget);
    expect(find.text('5 minutes start on Go. Answer as many as you can. +5 if right, -1 if wrong, 0 if you skip.'), findsOneWidget);
    await pumpFor(tester, const Duration(milliseconds: 5200));
    expect(_key('run-countdown'), findsNothing);
    expect(find.text('Question 1'), findsOneWidget);
    final clock = (tester.widget(_key('run-clock')) as Text).data;
    expect(clock, anyOf('5:00', '4:59'));

    // One answer brings the next question with no key between.
    s.skew = const Duration(seconds: 12);
    await tapOption(tester, 0);
    await tester.pump(const Duration(milliseconds: 120));
    await tester.tap(_key('run-key-lock'));
    await tester.pump();
    await pumpFor(tester, const Duration(milliseconds: 1300));
    expect(find.text('Question 2'), findsOneWidget);
    expect(_key('run-key-next'), findsNothing);

    // Friends in the room walk the open ruler (no flag in a race).
    await pumpFor(tester, const Duration(seconds: 30));
    expect(find.bySemanticsLabel(RegExp(r'^(Riya|Kabir) is on question \d+$')), findsWidgets);
    await closeRoom(tester);
  });
}
