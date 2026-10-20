// The live room's channel (MOB-BUILD-SPEC-V3 4.1 to 4.5), behind one thin interface so the lobby and the
// run never know whether Supabase Realtime or a fake answers.
//
// - One PRIVATE channel per room, topic `mob-room:<game id>`, joined only while the lobby, the countdown
//   or the live run is on screen (never from the den). Realtime admits the socket by the ticket the API
//   wrote (RLS `mob_room_ok`), using the app's normal Supabase session.
// - L-55: presence is the server's. The app never tracks Realtime presence; it posts `here`, `ready` or `left`
//   to `/api/mob/game/<id>/room/presence` on joining, on I'm ready and on leaving, and again every 20 s while
//   the room is on screen. Each reply carries the roster the server saw in the last 45 s, and the server
//   broadcasts `presence {m, st}` to the room on every change.
// - Every event comes from the server (`realtime.send` in SQL): `room.start {startsAt}`, `progress {m, q,
//   done}`, `presence {m, st}`, `room.done {}`, `room.cancel {}`, `sticker {m, k}`. None carries a name, a
//   pick, a mark or right or wrong (spec 4.4), and the app reads nothing else from them.
// - CHANNEL_ERROR, TIMED_OUT and a closed socket become [RoomLink.busy]: the run goes on without the
//   ruler's live updates (spec 4.5 fallback).

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../../core/models/json_helpers.dart';
import '../mob_v3_flags.dart';
import 'mob_room_script.dart';
import 'mob_v3_api.dart';
import 'mob_v3_models.dart';

/// What a member shows in the room: "Here" on joining, "Ready" after "I'm ready".
enum RoomPresenceStatus {
  here,
  ready;

  String get wire => name;

  static RoomPresenceStatus? parse(Object? v) => switch (asString(v)) { 'here' => here, 'ready' => ready, _ => null };
}

/// The channel's link to the room.
enum RoomLink {
  /// Subscribing.
  connecting,

  /// Subscribed: presence and broadcasts flow.
  joined,

  /// CHANNEL_ERROR, TIMED_OUT, too many connections, or the socket closed under us.
  busy,

  /// We left on purpose.
  closed,
}

/// One thing that happened in the room.
sealed class RoomEvent {
  const RoomEvent();
}

class RoomLinkChanged extends RoomEvent {
  const RoomLinkChanged(this.link);
  final RoomLink link;
}

/// The whole presence state after a sync: member id to status. Entries that are not a valid payload are
/// dropped here; entries whose member is not in the Mob are dropped by the room (spec 4.3).
class RoomPresenceSync extends RoomEvent {
  const RoomPresenceSync(this.members);
  final Map<String, RoomPresenceStatus> members;
}

class RoomStarted extends RoomEvent {
  const RoomStarted(this.startsAt);
  final DateTime startsAt;
}

/// A member in the live run answered their [q]-th question ([done]: they finished).
class RoomProgress extends RoomEvent {
  const RoomProgress({required this.memberId, required this.q, this.done = false});
  final String memberId;
  final int q;
  final bool done;
}

class RoomDone extends RoomEvent {
  const RoomDone();
}

class RoomCancelled extends RoomEvent {
  const RoomCancelled();
}

/// One member's presence changed (`presence {m, st}`): [status] null means they left.
class RoomPresenceChanged extends RoomEvent {
  const RoomPresenceChanged(this.memberId, this.status);
  final String memberId;
  final RoomPresenceStatus? status;
}

class RoomSticker extends RoomEvent {
  const RoomSticker({required this.memberId, required this.kind});
  final String memberId;
  final StickerKind kind;
}

/// Parsing of the wire shapes, shared by the real channel and the tests.
abstract final class RoomWire {
  /// A presence payload `{ m, st, v }`; null when it is not one.
  static (String, RoomPresenceStatus)? presence(Object? raw) {
    if (raw is! Map) return null;
    final m = asString(raw['m']);
    final st = RoomPresenceStatus.parse(raw['st']);
    if (m == null || m.isEmpty || st == null) return null;
    return (m, st);
  }

  /// The presence payload this app tracks.
  static Map<String, Object?> track(String memberId, RoomPresenceStatus st) => {'m': memberId, 'st': st.wire, 'v': 1};

  /// Merges a presence state (key to payload lists) into member to status. A member with two sockets
  /// (two phones) is Ready if either says so.
  static Map<String, RoomPresenceStatus> sync(Iterable<Iterable<Object?>> payloadLists) {
    final out = <String, RoomPresenceStatus>{};
    for (final list in payloadLists) {
      for (final raw in list) {
        final p = presence(raw);
        if (p == null) continue;
        final (m, st) = p;
        if (out[m] != RoomPresenceStatus.ready) out[m] = st;
      }
    }
    return out;
  }

  /// A broadcast event and its payload as Realtime delivers it (`{event, payload: {...}}`, or the bare
  /// payload). Null for an event the app does not read.
  static RoomEvent? broadcast(String event, Map<String, Object?> message) {
    final inner = message['payload'] is Map ? asJson(message['payload']) : message;
    switch (event) {
      case 'room.start':
        final at = asDate(inner['startsAt']);
        return at == null ? null : RoomStarted(at);
      case 'progress':
        final m = asString(inner['m']);
        final q = asInt(inner['q']);
        if (m == null || m.isEmpty || q == null) return null;
        return RoomProgress(memberId: m, q: q, done: asBool(inner['done']) ?? false);
      case 'presence':
        final m = asString(inner['m']);
        final st = asString(inner['st']);
        if (m == null || m.isEmpty) return null;
        if (st == 'left') return RoomPresenceChanged(m, null);
        final s = RoomPresenceStatus.parse(st);
        return s == null ? null : RoomPresenceChanged(m, s);
      case 'room.done':
        return const RoomDone();
      case 'room.cancel':
        return const RoomCancelled();
      case 'sticker':
        final m = asString(inner['m']);
        final k = StickerKind.parse(inner['k']);
        if (m == null || m.isEmpty || k == null) return null;
        return RoomSticker(memberId: m, kind: k);
    }
    return null;
  }

  static const List<String> events = ['room.start', 'progress', 'presence', 'room.done', 'room.cancel', 'sticker'];

  /// A server roster (member id to `here` or `ready`) as presence.
  static Map<String, RoomPresenceStatus> roster(Map<String, String> raw) => {
        for (final e in raw.entries) e.key: ?RoomPresenceStatus.parse(e.value),
      };
}

/// The room's channel.
abstract class MobRoomChannel {
  /// Every event, in order. Broadcast: the lobby and then the run listen in turn.
  Stream<RoomEvent> get events;

  /// Subscribes to the private [topic] (`mob-room:<id>`).
  Future<void> join(String topic);

  /// Sends (or updates) your presence.
  Future<void> track(String memberId, RoomPresenceStatus status);

  Future<void> untrack();

  /// Untracks and unsubscribes. Safe to call twice.
  Future<void> leave();
}

/// Supabase Realtime for the server's broadcasts, through the app's own `supabase_flutter` session (spec 4.1,
/// 4.2), and the presence route for who is here (L-55).
class SupabaseMobRoomChannel implements MobRoomChannel {
  SupabaseMobRoomChannel(this._client, {required this.api, required this.gameId});

  final SupabaseClient _client;
  final MobV3Api api;
  final String gameId;

  /// How often presence is sent again while the room is on screen (the server keeps 45 s).
  static const Duration heartbeat = Duration(seconds: 20);

  final StreamController<RoomEvent> _events = StreamController<RoomEvent>.broadcast();
  RealtimeChannel? _channel;
  bool _left = false;
  Timer? _beat;
  RoomPresenceStatus? _mine;

  /// Who is here, as the server last said (its roster) and broadcast since.
  final Map<String, RoomPresenceStatus> _present = {};

  void _emitPresence() => _emit(RoomPresenceSync(Map.of(_present)));

  @override
  Stream<RoomEvent> get events => _events.stream;

  void _emit(RoomEvent e) {
    if (!_events.isClosed) _events.add(e);
  }

  @override
  Future<void> join(String topic) async {
    _emit(const RoomLinkChanged(RoomLink.connecting));
    final ch = _client.channel(topic, opts: const RealtimeChannelConfig(private: true));
    _channel = ch;
    for (final event in RoomWire.events) {
      ch.onBroadcast(
        event: event,
        callback: (message) {
          final e = RoomWire.broadcast(event, message);
          if (e == null) return;
          if (e is RoomPresenceChanged) {
            // Presence is kept here and handed on whole, as the server's roster is.
            final s = e.status;
            if (s == null) {
              _present.remove(e.memberId);
            } else {
              _present[e.memberId] = s;
            }
            _emitPresence();
            return;
          }
          _emit(e);
        },
      );
    }
    ch.subscribe((status, error) {
      if (_left) return;
      switch (status) {
        case RealtimeSubscribeStatus.subscribed:
          _emit(const RoomLinkChanged(RoomLink.joined));
        case RealtimeSubscribeStatus.channelError:
        case RealtimeSubscribeStatus.timedOut:
        case RealtimeSubscribeStatus.closed:
          _emit(const RoomLinkChanged(RoomLink.busy));
      }
    });
  }

  /// Sends your presence to the server and takes its roster back. Throws when the server refuses it.
  Future<void> _send(RoomPresenceStatus status) async {
    final roster = await api.roomPresence(gameId, status.wire);
    if (_left) return;
    _present
      ..clear()
      ..addAll(RoomWire.roster(roster));
    _emitPresence();
  }

  @override
  Future<void> track(String memberId, RoomPresenceStatus status) async {
    _mine = status;
    _present[memberId] = status;
    await _send(status);
    _beat?.cancel();
    _beat = Timer.periodic(heartbeat, (_) {
      final mine = _mine;
      if (_left || mine == null) return;
      // A missed heartbeat is not news: the next one, or the server's 45 s, settles it.
      _send(mine).catchError((Object _) {});
    });
  }

  @override
  Future<void> untrack() async {
    _beat?.cancel();
    _mine = null;
    await api.roomPresence(gameId, 'left');
  }

  @override
  Future<void> leave() async {
    if (_left) return;
    _beat?.cancel();
    final wasHere = _mine != null;
    _mine = null;
    _left = true;
    if (wasHere) {
      try {
        await api.roomPresence(gameId, 'left');
      } on Object {
        // The server forgets you after 45 s anyway.
      }
    }
    final ch = _channel;
    _channel = null;
    if (ch != null) {
      try {
        await _client.removeChannel(ch);
      } on Object {
        // The socket may already be gone.
      }
    }
    _emit(const RoomLinkChanged(RoomLink.closed));
    await _events.close();
  }
}

/// A channel the tests (and the fixture walk) drive by hand: [emit] plays a server event, [tracked]
/// records what the app sent.
class FakeMobRoomChannel implements MobRoomChannel {
  FakeMobRoomChannel({this.failJoin = false});

  /// Joining ends in [RoomLink.busy] (the quota fallback).
  bool failJoin;

  final StreamController<RoomEvent> _events = StreamController<RoomEvent>.broadcast(sync: true);
  final List<String> log = [];
  final List<(String, RoomPresenceStatus)> tracked = [];
  String? topic;
  bool left = false;

  @override
  Stream<RoomEvent> get events => _events.stream;

  void emit(RoomEvent e) {
    if (!_events.isClosed) _events.add(e);
  }

  @override
  Future<void> join(String topic) async {
    this.topic = topic;
    log.add('join $topic');
    emit(const RoomLinkChanged(RoomLink.connecting));
    await Future<void>.value();
    emit(RoomLinkChanged(failJoin ? RoomLink.busy : RoomLink.joined));
    onJoined();
  }

  /// Hook for a scripted room.
  void onJoined() {}

  @override
  Future<void> track(String memberId, RoomPresenceStatus status) async {
    log.add('track $memberId ${status.wire}');
    tracked.add((memberId, status));
    onTracked(memberId, status);
  }

  /// Hook for a scripted room.
  void onTracked(String memberId, RoomPresenceStatus status) {}

  @override
  Future<void> untrack() async {
    log.add('untrack');
  }

  @override
  Future<void> leave() async {
    if (left) return;
    left = true;
    log.add('leave');
    onLeft();
    emit(const RoomLinkChanged(RoomLink.closed));
    await _events.close();
  }

  /// Hook for a scripted room.
  void onLeft() {}
}

/// Makes the channel for one room. Fixtures and tests override it.
typedef MobRoomChannelFactory = MobRoomChannel Function(String gameId);

final mobRoomChannelFactoryProvider = Provider<MobRoomChannelFactory>((ref) {
  // Fixture walks play the room against the fixture server (data/mob_room_script.dart).
  if (ref.watch(mobV3FixturesProvider)) {
    final server = ref.watch(mobV3FakeServerProvider);
    return (gameId) => ScriptedRoomChannel(server, gameId);
  }
  final api = ref.watch(mobV3ApiProvider);
  return (gameId) => SupabaseMobRoomChannel(Supabase.instance.client, api: api, gameId: gameId);
});

/// The phone's clock, for the room's server-time offset. Tests give the fake clock.
final mobLiveClockProvider = Provider<DateTime Function()>((ref) => () => DateTime.now().toUtc());
