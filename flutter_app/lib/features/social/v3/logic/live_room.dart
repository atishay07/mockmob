// One live room as the phone sees it (MOB-BUILD-SPEC-V3 4.2 to 4.5, 5.3 L1, L2, R1, R5, R6): the ticket,
// the private channel, who is here (presence only), the shared start on the server clock, where each
// friend is in the run, and the fallback when the channel is lost. The lobby opens it; the run screen
// takes it over at Go and closes it when the student leaves.
//
// Truth rules it keeps:
// - "Here", "Ready" and "Host" come only from presence entries of members of this Mob (an unknown `m`
//   is ignored, 4.3). Nobody is ever counted as "N online".
// - Positions come only from the server's `progress` broadcasts (or the run's own answers for you).
//   No event carries a pick, a mark or right or wrong, and nothing here stores one.
// - The clock is the server's: every time on screen is `serverNow()`, the ticket's `serverNow` moved on
//   by the phone's clock since.

import 'dart:async';

import 'package:flutter/foundation.dart';

import '../data/mob_room_channel.dart';
import '../data/mob_v3_api.dart';
import '../data/mob_v3_models.dart';

enum LivePhase {
  /// Getting the ticket and joining the channel.
  opening,

  /// L1: waiting for the host's start.
  lobby,

  /// The host started: the countdown runs so Go lands on [LiveRoom.startsAt].
  started,

  /// `room.done`: the live phase is over; the podium opens.
  done,

  /// The host closed the room before the start; the game stays a 24-hour game.
  cancelled,

  /// The ticket was refused (LIVE_OFF, GAME_CLOSED, NOT_LIVE...): [LiveRoom.error] says why.
  failed,
}

/// A sticker that arrived in the room (or that you sent), to fly over that member's Fold.
class RoomStickerSeen {
  const RoomStickerSeen({required this.memberId, required this.kind, required this.id});
  final String memberId;
  final StickerKind kind;
  final int id;
}

class LiveRoom extends ChangeNotifier {
  LiveRoom({
    required this.gameId,
    required this.api,
    required this.channel,
    required this.members,
    required this.clock,
    this.game,
  });

  final String gameId;
  final MobV3Api api;
  final MobRoomChannel channel;

  /// The Mob's members (from the den's read): presence maps `m` to a name, a Fold and a colour.
  final List<MobV3Member> members;
  /// The phone's clock (UTC); the server's is this plus the offset from the ticket.
  final DateTime Function() clock;

  MobGame? game;
  RoomTicket? ticket;
  LivePhase phase = LivePhase.opening;
  Object? error;

  /// The channel is lost or was refused: the run goes on without live updates (spec 4.5).
  bool busy = false;

  /// Member id to status, members of this Mob only. You are in it from your own track.
  Map<String, RoomPresenceStatus> present = const {};

  /// When Go lands, on the server clock.
  DateTime? startsAt;

  /// Who was in the room at the start, plus anyone the server reports progress for: the live racers.
  final Set<String> racers = {};

  /// Member id to the number of questions they have answered in the live run.
  final Map<String, int> progress = {};
  final Set<String> finished = {};

  /// "Kabir is here now.": the latest arrival after you joined, with an id per arrival.
  String? arrivalId;
  int arrivals = 0;

  final List<RoomStickerSeen> stickers = [];
  int _stickerIds = 0;

  bool _hostSeen = false;
  bool _baseline = false;
  bool _disposed = false;
  bool _left = false;
  StreamSubscription<RoomEvent>? _sub;
  DateTime? _anchorServer;
  DateTime? _anchorLocal;

  String get youId => ticket?.memberId ?? _youMember?.memberId ?? '';
  MobV3Member? get _youMember => members.where((m) => m.you).firstOrNull;
  String? get hostId => ticket?.room?.hostMemberId ?? game?.host?.memberId;
  bool get youHost => hostId != null && hostId == youId;
  RoomPresenceStatus? get youStatus => present[youId];
  bool get youReady => youStatus == RoomPresenceStatus.ready;

  MobV3Member? member(String id) => members.where((m) => m.memberId == id).firstOrNull;
  String nameOf(String id) => member(id)?.name ?? '';
  String get hostName => game?.host?.name ?? (hostId == null ? '' : nameOf(hostId!));

  /// Only you are here (L1: "You're the first one here.").
  bool get onlyYou => phase == LivePhase.lobby && present.keys.every((k) => k == youId);

  /// The host was here and stepped away before the start.
  bool get hostAway => phase == LivePhase.lobby && !youHost && _hostSeen && hostId != null && !present.containsKey(hostId);

  /// The room's live phase is still on (the podium waits for it).
  bool get liveOn => phase == LivePhase.started && !busy;

  /// Friends in the live run who have not reached the flag: R6 names only them.
  List<String> get stillPlaying => [for (final id in racers) if (id != youId && !finished.contains(id)) nameOf(id)]..removeWhere((n) => n.isEmpty);

  /// The server's clock now.
  DateTime serverNow() {
    final s = _anchorServer;
    final l = _anchorLocal;
    final local = clock();
    if (s == null || l == null) return local;
    return s.add(local.difference(l));
  }

  /// Ms until Go on the server clock (negative once it has passed); null before the start.
  int? msUntilGo() {
    final at = startsAt;
    return at?.difference(serverNow()).inMilliseconds;
  }

  void _anchor(DateTime? server) {
    if (server == null) return;
    _anchorServer = server;
    _anchorLocal = clock();
  }

  void _changed() {
    if (!_disposed) notifyListeners();
  }

  // ---- Opening -------------------------------------------------------------------------------------

  Future<void> open() async {
    phase = LivePhase.opening;
    error = null;
    _changed();
    try {
      final gameF = game == null ? api.game(gameId) : Future<MobGame>.value(game);
      final t = await api.roomTicket(gameId);
      ticket = t;
      _anchor(t.serverNow);
      game = await gameF;
      if (t.serverNow == null) _anchor(game?.serverNow);
    } on Object catch (e) {
      error = e;
      phase = LivePhase.failed;
      _changed();
      return;
    }
    if (_disposed) return;
    final room = ticket?.room ?? game?.room;
    if (room?.state == RoomState.cancelled) {
      phase = LivePhase.cancelled;
    } else if (room?.state == RoomState.done) {
      phase = LivePhase.done;
    } else if (room?.state == RoomState.running && room?.startsAt != null) {
      startsAt = room!.startsAt;
      phase = LivePhase.started;
    } else {
      phase = LivePhase.lobby;
    }
    _changed();
    _sub = channel.events.listen(_on);
    try {
      await channel.join(ticket!.topic);
      if (_disposed || _left) return;
      await channel.track(youId, RoomPresenceStatus.here);
      _setPresent(youId, RoomPresenceStatus.here);
    } on Object {
      busy = true;
      _changed();
    }
  }

  void _setPresent(String id, RoomPresenceStatus st) {
    if (id.isEmpty) return;
    present = {...present, id: st};
    _changed();
  }

  // ---- Events --------------------------------------------------------------------------------------

  void _on(RoomEvent e) {
    if (_disposed) return;
    switch (e) {
      case RoomLinkChanged(:final link):
        if (link == RoomLink.busy && !_left) busy = true;
        if (link == RoomLink.joined) busy = false;
      case RoomPresenceSync(:final members):
        _sync(members);
      case RoomStarted(startsAt: final at):
        _started(at);
      case RoomProgress(:final memberId, :final q, :final done):
        if (member(memberId) == null || memberId == youId) return;
        racers.add(memberId);
        final before = progress[memberId] ?? 0;
        // Out-of-order deliveries never walk a Fold backwards.
        if (q > before) progress[memberId] = q;
        if (done) finished.add(memberId);
      case RoomDone():
        if (phase == LivePhase.started || phase == LivePhase.lobby) phase = LivePhase.done;
      case RoomCancelled():
        if (phase == LivePhase.lobby || phase == LivePhase.opening) phase = LivePhase.cancelled;
      case RoomSticker(:final memberId, :final kind):
        if (member(memberId) == null) return;
        stickers.add(RoomStickerSeen(memberId: memberId, kind: kind, id: ++_stickerIds));
        if (stickers.length > 6) stickers.removeAt(0);
    }
    _changed();
  }

  void _sync(Map<String, RoomPresenceStatus> raw) {
    final next = <String, RoomPresenceStatus>{
      for (final e in raw.entries)
        if (member(e.key) != null) e.key: e.value,
    };
    // You are here while tracking, even before the sync echoes you back.
    final mine = present[youId];
    if (mine != null && !_left) next.putIfAbsent(youId, () => mine);
    if (_baseline) {
      for (final id in next.keys) {
        if (id != youId && !present.containsKey(id)) {
          arrivalId = id;
          arrivals++;
        }
      }
    }
    _baseline = true;
    if (hostId != null && next.containsKey(hostId)) _hostSeen = true;
    present = next;
  }

  void _started(DateTime at) {
    if (phase == LivePhase.done || phase == LivePhase.cancelled) return;
    startsAt ??= at;
    if (phase != LivePhase.started) {
      phase = LivePhase.started;
      racers.addAll(present.keys.where((k) => k != youId));
    }
  }

  // ---- Your actions --------------------------------------------------------------------------------

  Future<void> ready() async {
    if (youReady || _left) return;
    _setPresent(youId, RoomPresenceStatus.ready);
    try {
      await channel.track(youId, RoomPresenceStatus.ready);
    } on Object {
      busy = true;
      _changed();
    }
  }

  /// The host's start: Go lands 4 s later on the server clock. Throws the server's error.
  Future<void> start() async {
    final ack = await api.roomStart(gameId);
    _anchor(ack.serverNow);
    _started(ack.startsAt);
    _changed();
  }

  /// The host closes the room before the start (the game stays a 24-hour game).
  Future<void> cancel() async {
    await api.roomCancel(gameId);
    phase = LivePhase.cancelled;
    _changed();
    await leave();
  }

  /// A sticker you sent, shown over your own Fold.
  void showOwnSticker(StickerKind kind) {
    stickers.add(RoomStickerSeen(memberId: youId, kind: kind, id: ++_stickerIds));
    if (stickers.length > 6) stickers.removeAt(0);
    _changed();
  }

  /// Untracks and drops the channel. Positions stop; everything already shown stays.
  Future<void> leave() async {
    if (_left) return;
    _left = true;
    final sub = _sub;
    _sub = null;
    // The channel is dropped first, synchronously as far as it can go (its timers stop at once).
    final gone = channel.leave();
    await sub?.cancel();
    try {
      await gone;
    } on Object {
      // Gone already.
    }
  }

  @override
  void dispose() {
    _disposed = true;
    unawaited(leave());
    super.dispose();
  }
}
