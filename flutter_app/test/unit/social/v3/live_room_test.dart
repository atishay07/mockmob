// Live rooms, the logic (spec 4.2 to 4.5): the ticket and the private topic, presence from Mob members
// only, arrivals, the host stepping away, the shared start on the server clock, progress that never walks
// back, the end of the live phase, the quota fallback, and the wire shapes (no pick, mark or correctness
// is ever read). Plus the fixture server's room rules and the go-live wash's 40% cap (F6).

import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api.dart';
import 'package:mockmob/core/models/json_helpers.dart';
import 'package:mockmob/features/social/data/mob_models.dart';
import 'package:mockmob/features/social/v3/data/mob_room_channel.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/logic/den_copy_state.dart';
import 'package:mockmob/features/social/v3/logic/live_room.dart';
import 'package:mockmob/features/social/v3/screens/live_lobby_screen.dart';

import 'live_test_kit.dart';
import 'mob_v3_test_kit.dart';

List<MobV3Member> _members(MobV3FakeServer s) => MobRead.fromJson(s.denNow()).v3!.members;

Future<(LiveRoom, FakeMobRoomChannel, MobV3FakeServer)> _open({String gameId = riyaRoom, MobV3FakeServer? server}) async {
  final s = server ?? liveServer();
  final ch = FakeMobRoomChannel();
  final room = LiveRoom(gameId: gameId, api: s, channel: ch, members: _members(s), clock: () => s.now);
  await room.open();
  return (room, ch, s);
}

void main() {
  group('opening', () {
    test('the ticket names the private topic; you join it and show as Here', () async {
      final (room, ch, _) = await _open();
      expect(ch.topic, 'mob-room:$riyaRoom');
      expect(ch.tracked, [(aarav, RoomPresenceStatus.here)]);
      expect(room.phase, LivePhase.lobby);
      expect(room.hostId, riya);
      expect(room.youHost, isFalse);
      expect(room.present, {aarav: RoomPresenceStatus.here});
      expect(room.onlyYou, isTrue);
      room.dispose();
      expect(ch.left, isTrue);
    });

    test('live off on the server: the ticket is refused with LIVE_OFF and nothing joins', () async {
      final s = liveServer(live: false);
      final (room, ch, _) = await _open(server: s);
      expect(room.phase, LivePhase.failed);
      expect((room.error as ApiError).code, 'LIVE_OFF');
      expect(ch.topic, isNull);
      room.dispose();
    });

    test('an anytime game has no room: NOT_LIVE', () async {
      final s = MobV3FakeServer(scenario: 'heavy', clock: () => v3Now, live: true);
      final (room, _, _) = await _open(server: s, gameId: 'game-kabir-round');
      expect(room.phase, LivePhase.failed);
      expect((room.error as ApiError).code, 'NOT_LIVE');
      room.dispose();
    });
  });

  group('presence (4.3)', () {
    test('only members of this Mob are shown; the first sync is the baseline, later joiners are arrivals', () async {
      final (room, ch, _) = await _open();
      ch.emit(const RoomPresenceSync({riya: RoomPresenceStatus.here, 'STRANGER0001': RoomPresenceStatus.ready}));
      expect(room.present.keys, unorderedEquals([riya, aarav]));
      expect(room.arrivals, 0);
      ch.emit(const RoomPresenceSync({riya: RoomPresenceStatus.here, kabir: RoomPresenceStatus.here, aarav: RoomPresenceStatus.here}));
      expect(room.arrivals, 1);
      expect(room.arrivalId, kabir);
      expect(room.onlyYou, isFalse);
      room.dispose();
    });

    test('two sockets of one member: Ready wins', () {
      final m = RoomWire.sync([
        [RoomWire.track(kabir, RoomPresenceStatus.here)],
        [RoomWire.track(kabir, RoomPresenceStatus.ready)],
        [
          {'m': riya, 'st': 'nonsense', 'v': 1},
          {'st': 'here'},
          'junk',
        ],
      ]);
      expect(m, {kabir: RoomPresenceStatus.ready});
    });

    test('the host stepping away before the start is noticed (and only once they were seen)', () async {
      final (room, ch, _) = await _open();
      expect(room.hostAway, isFalse);
      ch.emit(const RoomPresenceSync({riya: RoomPresenceStatus.here, aarav: RoomPresenceStatus.here}));
      expect(room.hostAway, isFalse);
      ch.emit(const RoomPresenceSync({aarav: RoomPresenceStatus.here}));
      expect(room.hostAway, isTrue);
      room.dispose();
    });

    test("I'm ready tracks Ready", () async {
      final (room, ch, _) = await _open();
      await room.ready();
      expect(ch.tracked.last, (aarav, RoomPresenceStatus.ready));
      expect(room.youReady, isTrue);
      room.dispose();
    });
  });

  group('the start and the race (4.4)', () {
    test('room.start: Go lands on startsAt on the server clock; the friends here become the racers', () async {
      final (room, ch, s) = await _open();
      ch.emit(const RoomPresenceSync({riya: RoomPresenceStatus.here, kabir: RoomPresenceStatus.ready, aarav: RoomPresenceStatus.here}));
      ch.emit(RoomStarted(s.now.add(const Duration(milliseconds: 4000))));
      expect(room.phase, LivePhase.started);
      expect(room.msUntilGo(), 4000);
      s.skew = const Duration(milliseconds: 1500);
      expect(room.msUntilGo(), 2500);
      expect(room.racers, {riya, kabir});
      room.dispose();
    });

    test('progress moves friends forward only, ignores you and strangers, and done reaches the flag', () async {
      final (room, ch, s) = await _open();
      ch.emit(const RoomPresenceSync({riya: RoomPresenceStatus.here, kabir: RoomPresenceStatus.ready, aarav: RoomPresenceStatus.here}));
      ch.emit(RoomStarted(s.now));
      ch.emit(const RoomProgress(memberId: riya, q: 2));
      ch.emit(const RoomProgress(memberId: riya, q: 1)); // late delivery
      ch.emit(const RoomProgress(memberId: aarav, q: 4));
      ch.emit(const RoomProgress(memberId: 'STRANGER0001', q: 3));
      expect(room.progress, {riya: 2});
      expect(room.stillPlaying, ['Riya', 'Kabir']);
      ch.emit(const RoomProgress(memberId: riya, q: 5, done: true));
      expect(room.finished, {riya});
      expect(room.stillPlaying, ['Kabir']);
      expect(room.liveOn, isTrue);
      ch.emit(const RoomDone());
      expect(room.phase, LivePhase.done);
      expect(room.liveOn, isFalse);
      room.dispose();
    });

    test('a lost channel is the fallback: busy, and the live phase no longer holds the podium', () async {
      final (room, ch, s) = await _open();
      ch.emit(RoomStarted(s.now));
      ch.emit(const RoomLinkChanged(RoomLink.busy));
      expect(room.busy, isTrue);
      expect(room.liveOn, isFalse);
      room.dispose();
    });

    test('a refused join (quota) is busy from the start', () async {
      final s = liveServer();
      final ch = FakeMobRoomChannel(failJoin: true);
      final room = LiveRoom(gameId: riyaRoom, api: s, channel: ch, members: _members(s), clock: () => s.now);
      await room.open();
      expect(room.busy, isTrue);
      room.dispose();
    });

    test('room.cancel in the lobby closes the room; stickers from members only', () async {
      final (room, ch, _) = await _open();
      ch.emit(const RoomSticker(memberId: kabir, kind: StickerKind.goodLuck));
      ch.emit(const RoomSticker(memberId: 'STRANGER0001', kind: StickerKind.ready));
      expect([for (final s in room.stickers) s.memberId], [kabir]);
      ch.emit(const RoomCancelled());
      expect(room.phase, LivePhase.cancelled);
      room.dispose();
    });
  });

  group('the host (fixture server rules)', () {
    test('opening a live game makes you the host of a lobby; your start lands Go 4 s later', () async {
      final s = MobV3FakeServer(scenario: 'quiet', clock: () => v3Now, live: true);
      final g = await s.openGame(mob: MobV3FakeServer.chaiId, format: GameFormat.sprint, mode: GameMode.live, count: 5);
      expect(g.mode, GameMode.live);
      expect(g.room?.state, RoomState.lobby);
      final (room, _, _) = await _open(server: s, gameId: g.id);
      expect(room.youHost, isTrue);
      await room.start();
      expect(room.phase, LivePhase.started);
      expect(room.msUntilGo(), 4000);
      await expectLater(s.roomStart(g.id), throwsA(isA<ApiError>().having((e) => e.code, 'code', 'ROOM_STARTED')));
      // A second live room in the same Mob is refused.
      await expectLater(
        s.openGame(mob: MobV3FakeServer.chaiId, format: GameFormat.sprint, mode: GameMode.live, count: 5),
        throwsA(isA<ApiError>().having((e) => e.code, 'code', 'ROOM_OPEN_ALREADY')),
      );
      room.dispose();
    });

    test("a guest can't start or close Riya's room", () async {
      final s = liveServer();
      await expectLater(s.roomStart(riyaRoom), throwsA(isA<ApiError>().having((e) => e.code, 'code', 'ROOM_NOT_HOST')));
      await expectLater(s.roomCancel(riyaRoom), throwsA(isA<ApiError>().having((e) => e.code, 'code', 'ROOM_NOT_HOST')));
    });

    test('a run started at the room start is live from the shared start', () async {
      final s = liveServer();
      s.startRoomAsHost(riyaRoom);
      s.skew = const Duration(seconds: 5);
      final rs = await s.run(riyaRoom);
      expect(rs.run.live, isTrue);
      expect(rs.run.startedAt, v3Now.add(const Duration(seconds: 4)));
    });

    test('live off: opening a live game is LIVE_OFF', () async {
      final s = MobV3FakeServer(scenario: 'quiet', clock: () => v3Now);
      await expectLater(
        s.openGame(mob: MobV3FakeServer.chaiId, format: GameFormat.sprint, mode: GameMode.live, count: 5),
        throwsA(isA<ApiError>().having((e) => e.code, 'code', 'LIVE_OFF')),
      );
    });
  });

  group('the wire (4.4: no pick, option, mark or correctness)', () {
    test('broadcasts parse nested or bare, and nothing but the spec keys is read', () {
      final start = RoomWire.broadcast('room.start', {
        'event': 'room.start',
        'payload': {'startsAt': '2026-10-22T15:14:04.000Z'},
      });
      expect((start! as RoomStarted).startsAt, DateTime.utc(2026, 10, 22, 15, 14, 4));
      final p = RoomWire.broadcast('progress', {'m': riya, 'q': 3, 'done': false, 'correct': true, 'pick': 2}) as RoomProgress;
      expect((p.memberId, p.q, p.done), (riya, 3, false));
      expect(RoomWire.broadcast('sticker', {'m': kabir, 'k': 'good_luck'}), isA<RoomSticker>());
      expect(RoomWire.broadcast('sticker', {'m': kabir, 'k': 'free_text'}), isNull);
      expect(RoomWire.broadcast('progress', {'q': 3}), isNull);
      expect(RoomWire.broadcast('answer', {'m': riya, 'pick': 1}), isNull);
      expect(RoomWire.broadcast('room.done', const {}), isA<RoomDone>());
      expect(RoomWire.broadcast('room.cancel', const {}), isA<RoomCancelled>());
    });

    test('the presence the app sends is exactly {m, st, v}', () {
      expect(RoomWire.track(aarav, RoomPresenceStatus.ready), {'m': aarav, 'st': 'ready', 'v': 1});
    });
  });

  group('the den (D4) shows the room only when live is on', () {
    test('live on: D4; live off: the same game is an anytime one', () {
      final on = MobRead.fromJson(liveServer().denNow()).v3!;
      expect(on.live.enabled, isTrue);
      expect(denCardFor(on).kind, DenCardKind.live);
      final offJson = liveServer().denNow();
      (offJson['v3'] as Map)['live'] = {'enabled': false, 'hoursOk': true};
      final off = MobRead.fromJson(offJson).v3!;
      expect(denCardFor(off).kind, DenCardKind.open);
    });
  });

  group('M2 the go-live wash (F6)', () {
    test('it never covers more than 40% of the screen and is gone by 900 ms', () {
      for (final size in const [Size(360, 780), Size(412, 915), Size(320, 568)]) {
        final r = GoLiveWash.maxRadius(size);
        // The whole circle is 40% of the screen; centred on the key near the bottom, less of it shows.
        expect(math.pi * r * r / (size.width * size.height), closeTo(0.40, 1e-9));
      }
      expect(GoLiveWash.frame(0).o, 0);
      expect(GoLiveWash.frame(540).r, 1);
      expect(GoLiveWash.frame(900).o, 0);
      expect(GoLiveWash.alpha(true), 0.22);
      expect(GoLiveWash.alpha(false), 0.30);
    });
  });

  test('json helpers keep the ticket shape', () {
    final t = RoomTicket.fromJson(asJson({
      'topic': 'mob-room:x',
      'memberId': aarav,
      'room': {'state': 'lobby', 'hostMemberId': riya},
      'serverNow': '2026-10-22T15:10:00.000Z',
    }));
    expect(t.room?.state, RoomState.lobby);
    expect(t.room?.hostMemberId, riya);
  });
}
