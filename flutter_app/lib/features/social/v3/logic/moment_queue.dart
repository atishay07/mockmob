// The den's moment queue (spec 5.6, after the table): after Enter the den finishes, the den plays the
// moments the server says are due, one at a time and in order (quest done, week stitched, reveal, then
// the personal chain's milestones), each awaited until it closes. A moment is marked seen only after it
// has closed (shown fully or skipped), so a moment the student never saw plays again next time. It
// never plays while the den is covered (a run, a sheet, another tab): the queue stops and picks up
// on the next open.
//
// K5, the pass notice ("Friday was covered by a rest pass. Your chain is still 12."), is an inline
// toast, not a moment: at most one a day, marked seen once shown.

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../copy_v3.dart';
import '../data/mob_v3_models.dart';
import '../mob_v3_nav.dart';

/// Plays one moment key and completes when it closes. Overridable in tests (a recording player).
typedef MomentPlayer = Future<void> Function(BuildContext context, String key);

final momentPlayerProvider = Provider<MomentPlayer>((ref) => MobV3Nav.moment);

int _rank(String key) {
  final kind = key.split(':').first;
  return switch (kind) { 'quest_done' => 0, 'stitch' => 1, 'reveal' => 2, 'chain' => 3, _ => 9 };
}

/// The moments to play, in the spec's order, without duplicates. Keys the den does not play as a
/// full-screen moment (`rest:<day>` is K5's toast) are left out. Within a kind the server's order holds.
List<String> momentOrder(List<String> mobMoments, List<String> chainDue) {
  final seen = <String>{};
  final all = <(int, int, String)>[];
  var i = 0;
  for (final k in [...mobMoments, ...chainDue]) {
    final r = _rank(k);
    if (r > 3 || !seen.add(k)) continue;
    all.add((r, i++, k));
  }
  all.sort((a, b) => a.$1 != b.$1 ? a.$1.compareTo(b.$1) : a.$2.compareTo(b.$2));
  return [for (final e in all) e.$3];
}

/// Plays [keys] one by one. [canPlay] is asked before each (false while the den is covered); [play]
/// completes when the moment closes; [seen] runs after each close with that key only. Returns the keys
/// that were played. Keys already played in this app run are skipped ([played] remembers them).
Future<List<String>> runMomentQueue({
  required List<String> keys,
  required bool Function() canPlay,
  required Future<void> Function(String key) play,
  required Future<void> Function(List<String> keys) seen,
  Set<String>? played,
}) async {
  final done = <String>[];
  for (final k in keys) {
    if (played != null && played.contains(k)) continue;
    if (!canPlay()) break;
    played?.add(k);
    try {
      await play(k);
    } on Object {
      // A moment that failed to open is not marked seen: it comes back on the next open.
      played?.remove(k);
      break;
    }
    done.add(k);
    await seen([k]);
  }
  return done;
}

/// K5: the pass notice to show now, if any. One a day (by IST day key [today]); [shownOn] is the day
/// one was last shown in this app run. Only `rested` notices are pass notices.
ChainNotice? passNoticeFor(ChainState chain, {required String today, String? shownOn}) {
  if (shownOn == today || chain.hidden) return null;
  for (final n in chain.notices) {
    if (n.kind == 'rested' && n.key.isNotEmpty) return n;
  }
  return null;
}

/// The words of a pass notice (K5).
String passNoticeText(ChainNotice n, ChainState chain) {
  final day = n.day == null ? 'A day' : MobTime.weekdayOfKey(n.day!);
  return MobV3Copy.passNotice(day, n.days ?? chain.days);
}

/// The IST day key (`YYYY-MM-DD`) of [at].
String istDayKey(DateTime at) {
  final t = at.toUtc().add(const Duration(hours: 5, minutes: 30));
  String two(int v) => v.toString().padLeft(2, '0');
  return '${t.year}-${two(t.month)}-${two(t.day)}';
}

/// What the den remembers across rebuilds in one app run: moments already played and the day the
/// last pass notice showed.
class DenSessionMemory {
  final Set<String> playedMoments = {};
  String? noticeShownOn;
  final Set<String> flownReactions = {};

  /// Set while the den fades through to another Mob (M13), so the den that comes back fades in
  /// instead of replaying Enter the den.
  DateTime? switchedAt;
}

final denSessionMemoryProvider = Provider<DenSessionMemory>((ref) => DenSessionMemory());
