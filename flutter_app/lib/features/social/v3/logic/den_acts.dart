// When the den's event acts play (MOB-MINIMAL 4.2, "A friend joins", "A reaction"). The acts themselves (how a Fold
// moves) live in widgets/fold_acts.dart; this file decides WHEN, from the data the den already has. Every beat answers a
// real event (4, rule 2), and each event plays once.
//
// The server sends no join time and no addressee (GET /api/mob v3: members are {memberId, name, colour, fold, finish,
// you, owner} in join order; reactions are {memberId, kind, at, game?}, the Mob's last 20 stickers of the last 7 days).
// So, remembered on this phone per Mob ([DenActBook], the app's own prefs store):
//   - A JOIN is a member standing in the den who was not there when this student last saw it. The first time a phone
//     opens a Mob, everyone already there is simply there: no act (no flood). Members who leave are forgotten, so a
//     friend who leaves and comes back hops in again (a real join).
//   - A REACTION is a friend's sticker to the Mob (stickers have no addressee) newer than the newest one this student
//     has seen, and under 12 hours old (the den's sticker flights use the same window). Several new stickers make one
//     cheer, led by the newest sender: a calm den, never a cheer per sticker. Your own stickers never cheer.
// An event is remembered as played when its act starts. At most [DenActs.maxQueue] acts wait at once; the earliest
// joins past that stand in their seats without an act.

import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/storage/prefs_store.dart';
import '../../data/mob_repository.dart' show mobPrefsStoreProvider;
import '../data/mob_v3_models.dart';

enum DenEventKind { join, reaction }

/// One real event the den plays one act for.
@immutable
class DenEvent {
  const DenEvent.join(this.memberId) : kind = DenEventKind.join, sticker = null, at = null;
  const DenEvent.reaction(this.memberId, {required StickerKind this.sticker, required DateTime this.at}) : kind = DenEventKind.reaction;

  final DenEventKind kind;

  /// The newcomer (join) or the newest sender, who leads the cheer (reaction).
  final String memberId;
  final StickerKind? sticker;
  final DateTime? at;

  /// The once-only key.
  String get key => kind == DenEventKind.join ? 'join:$memberId' : 'reaction:$memberId:${sticker?.wire}:${at?.toUtc().toIso8601String()}';

  @override
  bool operator ==(Object other) => other is DenEvent && other.key == key;

  @override
  int get hashCode => key.hashCode;

  @override
  String toString() => 'DenEvent($key)';
}

/// What this phone has seen of one Mob's den: the members standing in it and the newest sticker.
@immutable
class DenActMemory {
  const DenActMemory({this.members = const {}, this.reactionsUpTo});

  /// Member ids this student has seen standing in the den (or watched hop in).
  final Set<String> members;

  /// The newest friend's sticker already seen (null: none yet).
  final DateTime? reactionsUpTo;

  DenActMemory copyWith({Set<String>? members, DateTime? reactionsUpTo}) => DenActMemory(members: members ?? this.members, reactionsUpTo: reactionsUpTo ?? this.reactionsUpTo);

  String encode() => jsonEncode({
        'v': 1,
        'm': [...members]..sort(),
        if (reactionsUpTo != null) 'r': reactionsUpTo!.toUtc().toIso8601String(),
      });

  /// Null for anything unreadable (the den then treats the open as a first open: no act, never a flood).
  static DenActMemory? decode(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    try {
      final j = jsonDecode(raw);
      if (j is! Map || j['v'] != 1 || j['m'] is! List) return null;
      final r = j['r'];
      return DenActMemory(
        members: {for (final m in j['m'] as List) if (m is String && m.isNotEmpty) m},
        reactionsUpTo: r is String ? DateTime.tryParse(r) : null,
      );
    } on Object {
      return null;
    }
  }
}

/// The rules, pure, for the den and its tests.
abstract final class DenActs {
  /// At most this many acts wait at once (about 7 s of acts with the gaps).
  static const int maxQueue = 3;

  /// A friend's sticker cheers only while it is this recent (the sticker flights' window).
  static const Duration reactionWindow = Duration(hours: 12);

  /// The quiet beat before each act, so acts never run into each other or into Enter the den.
  static const Duration gap = Duration(milliseconds: 400);

  /// The first time this phone sees a Mob: everyone there is already there, and every sticker is already seen.
  static DenActMemory baseline(MobV3 v3) => DenActMemory(
        members: {for (final m in v3.members) if (m.memberId.isNotEmpty) m.memberId},
        reactionsUpTo: _newest(v3.reactions),
      );

  /// Members standing in the den this student has not seen yet: they wait in their seat for their act.
  static Set<String> newcomers(MobV3 v3, DenActMemory memory) => {
        for (final m in v3.members)
          if (!m.you && m.memberId.isNotEmpty && !memory.members.contains(m.memberId)) m.memberId,
      };

  /// The events in [v3] since [memory], joins first (in join order), then at most one reaction. Capped at [maxQueue]:
  /// the earliest joins past the cap are returned in [DenEvents.skipped] (they stand in their seats, no act).
  static DenEvents eventsSince(MobV3 v3, DenActMemory memory, {required DateTime now}) {
    final joins = [for (final id in _inJoinOrder(v3, newcomers(v3, memory))) DenEvent.join(id)];
    final reaction = reactionSince(v3, memory, now: now);
    final room = maxQueue - (reaction == null ? 0 : 1);
    final skipped = joins.length > room ? joins.sublist(0, joins.length - room) : const <DenEvent>[];
    final kept = joins.length > room ? joins.sublist(joins.length - room) : joins;
    return DenEvents(events: [...kept, ?reaction], skipped: skipped, reactionsUpTo: _newestFromOthers(v3));
  }

  /// The newest friend's sticker newer than [DenActMemory.reactionsUpTo], from a member still in the Mob, of a known
  /// kind, under [reactionWindow] old. Null when there is none.
  static DenEvent? reactionSince(MobV3 v3, DenActMemory memory, {required DateTime now}) {
    final you = v3.you?.memberId;
    final ids = {for (final m in v3.members) m.memberId};
    Reaction? best;
    for (final r in v3.reactions) {
      final at = r.at;
      if (at == null || r.memberId == you || !ids.contains(r.memberId)) continue;
      if (memory.reactionsUpTo != null && !at.isAfter(memory.reactionsUpTo!)) continue;
      if (now.difference(at) > reactionWindow || at.difference(now) > const Duration(minutes: 1)) continue;
      if (best == null || at.isAfter(best.at!)) best = r;
    }
    return best == null ? null : DenEvent.reaction(best.memberId, sticker: best.kind, at: best.at!);
  }

  /// The memory once [event] has played (or was skipped): a join is now seen; a reaction moves the sticker mark.
  static DenActMemory played(DenActMemory memory, DenEvent event, {DateTime? reactionsUpTo}) {
    switch (event.kind) {
      case DenEventKind.join:
        return memory.copyWith(members: {...memory.members, event.memberId});
      case DenEventKind.reaction:
        final mark = _later(_later(memory.reactionsUpTo, event.at), reactionsUpTo);
        return DenActMemory(members: memory.members, reactionsUpTo: mark);
    }
  }

  /// Forgets members who left (a friend who comes back hops in again) and moves the sticker mark past stickers too old
  /// to cheer, so they never wait in the memory.
  static DenActMemory tidy(DenActMemory memory, MobV3 v3, {required DateTime now}) {
    final ids = {for (final m in v3.members) m.memberId};
    final kept = {for (final id in memory.members) if (ids.contains(id)) id};
    var mark = memory.reactionsUpTo;
    for (final r in v3.reactions) {
      final at = r.at;
      if (at == null || r.memberId == v3.you?.memberId) continue;
      if (now.difference(at) > reactionWindow) mark = _later(mark, at);
    }
    return DenActMemory(members: kept, reactionsUpTo: mark);
  }

  static List<String> _inJoinOrder(MobV3 v3, Set<String> ids) => [for (final m in v3.members) if (ids.contains(m.memberId)) m.memberId];

  static DateTime? _newest(List<Reaction> reactions) {
    DateTime? out;
    for (final r in reactions) {
      out = _later(out, r.at);
    }
    return out;
  }

  static DateTime? _newestFromOthers(MobV3 v3) => _newest([for (final r in v3.reactions) if (r.memberId != v3.you?.memberId) r]);

  static DateTime? _later(DateTime? a, DateTime? b) {
    if (a == null) return b;
    if (b == null) return a;
    return b.isAfter(a) ? b : a;
  }
}

/// [DenActs.eventsSince]'s answer.
@immutable
class DenEvents {
  const DenEvents({this.events = const [], this.skipped = const [], this.reactionsUpTo});

  /// To play, in order.
  final List<DenEvent> events;

  /// Joins past the cap: seen at once, no act.
  final List<DenEvent> skipped;

  /// The newest friend's sticker in the read (the mark once a reaction has played).
  final DateTime? reactionsUpTo;
}

/// The den's act memory on this phone, one entry per Mob, in the app's prefs store. Reads once per Mob per app run and
/// writes through. A store that fails keeps the memory in this run only (an act may then play again next run).
class DenActBook {
  DenActBook(this._store);

  final PrefsStore _store;
  final Map<String, DenActMemory?> _cache = {};

  static String keyFor(String mobId) => 'mob.den.acts.$mobId';

  /// True once [mobId]'s memory has been read in this run.
  bool loaded(String mobId) => _cache.containsKey(mobId);

  /// The memory for [mobId] (null: this phone has never opened the Mob), once [load] has finished.
  DenActMemory? peek(String mobId) => _cache[mobId];

  Future<DenActMemory?> load(String mobId) async {
    if (_cache.containsKey(mobId)) return _cache[mobId];
    DenActMemory? m;
    try {
      m = DenActMemory.decode(await _store.getString(keyFor(mobId)));
    } on Object {
      m = null;
    }
    // A save that landed while the read was out wins.
    return _cache.putIfAbsent(mobId, () => m);
  }

  Future<void> save(String mobId, DenActMemory memory) async {
    _cache[mobId] = memory;
    try {
      await _store.setString(keyFor(mobId), memory.encode());
    } on Object {
      // Kept for this run.
    }
  }
}

final denActBookProvider = Provider<DenActBook>((ref) => DenActBook(ref.watch(mobPrefsStoreProvider)));
