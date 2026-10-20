// The live room's channel (MOB-BUILD-SPEC-V3 4.1 to 4.5), behind one thin interface so the lobby and the
// run never know whether Supabase Realtime or a fake answers.
//
// - One PRIVATE channel per room, topic `mob-room:<game id>`, joined only while the lobby, the countdown
//   or the live run is on screen (never from the den). Realtime admits the socket by the ticket the API
//   wrote (RLS `mob_room_ok`), using the app's normal Supabase session.
// - Presence is the only thing the app sends: `{ "m": memberId, "st": "here|ready", "v": 1 }`.
// - Every other event comes from the server (`realtime.send` in SQL): `room.start {startsAt}`,
//   `progress {m, q, done}`, `room.done {}`, `room.cancel {}`, `sticker {m, k}`. None carries a name, a
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

  static const List<String> events = ['room.start', 'progress', 'room.done', 'room.cancel', 'sticker'];
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

/// Supabase Realtime, through the app's own `supabase_flutter` session (spec 4.1, 4.2).
class SupabaseMobRoomChannel implements MobRoomChannel {
  SupabaseMobRoomChannel(this._client);

  final SupabaseClient _client;
  final StreamController<RoomEvent> _events = StreamController<RoomEvent>.broadcast();
  RealtimeChannel? _channel;
  bool _left = false;

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
    ch.onPresenceSync((_) {
      final state = ch.presenceState();
      _emit(RoomPresenceSync(RoomWire.sync([for (final s in state) [for (final p in s.presences) p.payload]])));
    });
    for (final event in RoomWire.events) {
      ch.onBroadcast(
        event: event,
        callback: (message) {
          final e = RoomWire.broadcast(event, message);
          if (e != null) _emit(e);
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

  @override
  Future<void> track(String memberId, RoomPresenceStatus status) async {
    await _channel?.track(RoomWire.track(memberId, status));
  }

  @override
  Future<void> untrack() async {
    await _channel?.untrack();
  }

  @override
  Future<void> leave() async {
    if (_left) return;
    _left = true;
    final ch = _channel;
    _channel = null;
    if (ch != null) {
      try {
        await ch.untrack();
      } on Object {
        // Leaving anyway.
      }
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
  return (_) => SupabaseMobRoomChannel(Supabase.instance.client);
});

/// The phone's clock, for the room's server-time offset. Tests give the fake clock.
final mobLiveClockProvider = Provider<DateTime Function()>((ref) => () => DateTime.now().toUtc());
