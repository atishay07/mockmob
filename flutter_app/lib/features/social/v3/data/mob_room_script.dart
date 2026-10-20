// The fixture room (MOB_V3_FIXTURES walks and tests): a channel that plays the friends of Chai Circle
// against the fixture server, so the lobby, the countdown, the live ruler race, a friend finishing and
// the podium run end to end before the real server's rooms land.
//
// The script, from the moment you join:
// - Riya's room (you are a guest): Riya is here as the host; Kabir arrives at 1.5 s ("Kabir is here
//   now."), sends "Good luck" at 2.4 s and is ready at 3.6 s. Riya starts 1.8 s after you tap
//   "I'm ready" (or 1.8 s after Kabir is ready if you already are).
// - Your own room: Riya arrives at 1.4 s, is ready at 2.6 s and sends "Let's go"; Kabir arrives at
//   4.2 s and is ready at 5.4 s. You start it.
// - At the start, every friend in the room answers on a fixed pace (their right or wrong is stored on
//   the fixture server for the podium; the channel carries only where they are). When they and you have
//   finished, the live phase ends (`room.done`).
// Debug and test only: it never runs unless fixtures are on.

import 'dart:async';

import 'mob_room_channel.dart';
import 'mob_v3_fake_server.dart';
import 'mob_v3_models.dart';

class ScriptedRoomChannel extends FakeMobRoomChannel {
  ScriptedRoomChannel(this.server, this.gameId);

  final MobV3FakeServer server;
  final String gameId;

  final List<Timer> _timers = [];
  StreamSubscription<(String, String)>? _sub;
  final Map<String, RoomPresenceStatus> _present = {};
  String _you = '';
  bool _started = false;
  final Set<String> _done = {};
  final Set<String> _racers = {};

  /// Seconds into the run at which each friend answers questions 1 to 5 (and on, for longer games),
  /// with their right (true), wrong (false) or skip (null).
  static const Map<int, (List<int>, List<bool?>)> _pace = {
    0: ([17, 38, 60, 79, 101, 124, 146, 167, 190, 211], [true, true, false, true, true, true, null, true, true, false]),
    1: ([21, 46, 69, 94, 122, 140, 166, 189, 214, 238], [true, null, true, true, false, true, true, false, true, true]),
    2: ([26, 52, 81, 103, 131, 155, 178, 204, 229, 251], [false, true, true, true, true, false, true, true, null, true]),
  };

  void _after(int ms, void Function() f) {
    _timers.add(Timer(Duration(milliseconds: ms), () {
      if (!left) f();
    }));
  }

  void _sync() => emit(RoomPresenceSync(Map.of(_present)));

  @override
  void onJoined() {
    final info = server.roomInfo(gameId);
    _you = info.youId;
    final friends = server.friendIds(gameId);
    _sub = server.roomChanges.listen((c) {
      if (c.$1 != gameId) return;
      switch (c.$2) {
        case 'start':
          _onStart();
        case 'cancel':
          emit(const RoomCancelled());
        case 'done':
          emit(const RoomDone());
      }
    });
    if (info.state == RoomState.running) {
      // Joined late: the room is already racing.
      _onStart();
      return;
    }
    final host = info.hostId;
    if (host != _you) {
      final kabir = friends.firstWhere((f) => f != host, orElse: () => host);
      _present[host] = RoomPresenceStatus.here;
      _sync();
      _after(1500, () {
        _present[kabir] = RoomPresenceStatus.here;
        _sync();
      });
      _after(2400, () => emit(RoomSticker(memberId: kabir, kind: StickerKind.goodLuck)));
      _after(3600, () {
        _present[kabir] = RoomPresenceStatus.ready;
        _sync();
        if (_present[_you] == RoomPresenceStatus.ready) _hostStartsSoon();
      });
    } else {
      final riya = friends.isEmpty ? '' : friends.first;
      final kabir = friends.length > 1 ? friends[1] : '';
      _sync();
      if (riya.isNotEmpty) {
        _after(1400, () {
          _present[riya] = RoomPresenceStatus.here;
          _sync();
        });
        _after(2600, () {
          _present[riya] = RoomPresenceStatus.ready;
          _sync();
        });
        _after(3200, () => emit(RoomSticker(memberId: riya, kind: StickerKind.letsGo)));
      }
      if (kabir.isNotEmpty) {
        _after(4200, () {
          _present[kabir] = RoomPresenceStatus.here;
          _sync();
        });
        _after(5400, () {
          _present[kabir] = RoomPresenceStatus.ready;
          _sync();
        });
      }
    }
  }

  bool _startQueued = false;

  void _hostStartsSoon() {
    if (_startQueued || _started) return;
    _startQueued = true;
    _after(1800, () {
      try {
        server.startRoomAsHost(gameId);
      } on Object {
        // Already started.
      }
    });
  }

  @override
  void onTracked(String memberId, RoomPresenceStatus status) {
    _present[memberId] = status;
    _sync();
    final info = server.roomInfo(gameId);
    if (status == RoomPresenceStatus.ready && info.hostId != _you) {
      final others = _present.entries.where((e) => e.key != _you && e.key != info.hostId);
      if (others.every((e) => e.value == RoomPresenceStatus.ready)) _hostStartsSoon();
    }
  }

  void _onStart() {
    if (_started) return;
    _started = true;
    final info = server.roomInfo(gameId);
    final at = info.startsAt ?? server.now;
    emit(RoomStarted(at));
    final lead = at.difference(server.now).inMilliseconds;
    var i = 0;
    // A race ends on its clock: friends answer only inside its minutes, and their time running out is their end.
    final raceMs = info.minutes == null ? null : info.minutes! * 60000;
    for (final id in _present.keys.where((k) => k != _you).toList()) {
      final (secs, rights) = _pace[i % _pace.length]!;
      i++;
      _racers.add(id);
      if (raceMs != null) {
        _after(lead + raceMs, () {
          _done.add(id);
          emit(RoomProgress(memberId: id, q: server.liveAnswered(gameId, id), done: true));
          _maybeEnd();
        });
      }
      for (var q = 0; q < info.count; q++) {
        // A race keeps a quicker pace: everyone answers as many as they can.
        final atMs = raceMs != null ? (secs[q % secs.length] * 1000 * 0.55).round() + (q ~/ secs.length) * 132000 : secs[q % secs.length] * 1000 + (q ~/ secs.length) * 240000;
        if (raceMs != null && atMs >= raceMs) break;
        final last = raceMs == null && q == info.count - 1;
        _after(lead + atMs, () {
          server.liveAnswer(gameId, id, q, correct: rights[q % rights.length], elapsedMs: atMs);
          if (last) _done.add(id);
          emit(RoomProgress(memberId: id, q: q + 1, done: last));
          _maybeEnd();
        });
      }
    }
    // You finishing ends the live phase once every friend has too.
    _timers.add(Timer.periodic(const Duration(seconds: 1), (_) {
      if (!left) _maybeEnd();
    }));
  }

  void _maybeEnd() {
    if (_racers.any((r) => !_done.contains(r))) return;
    if (!server.youFinished(gameId)) return;
    server.endRoom(gameId);
  }

  @override
  void onLeft() {
    for (final t in _timers) {
      t.cancel();
    }
    _timers.clear();
    _sub?.cancel();
  }
}
