// The weeks whose goal-met cheer already played (TODAY-1017 4.6: Mobi cheers once per week). Kept
// on this phone per account, so an app restart never replays it (pre-check F14, item 6).
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/repositories/local_scope.dart' show userIdProvider;
import '../../rhythm/data/rhythm_prefs.dart' show rhythmPrefsStoreProvider;

/// The most weeks remembered: older ones can never be this week again.
const int _keepWeeks = 8;

class WeekCheers extends Notifier<Set<String>?> {
  int _generation = 0;

  static String _key(String? user) => 'today_week_cheers_${user ?? 'none'}';

  /// Null until the store is read: no cheer plays before it is known whether it already did.
  @override
  Set<String>? build() {
    final user = ref.watch(userIdProvider);
    final generation = ++_generation;
    scheduleMicrotask(() => _load(user, generation));
    return null;
  }

  Future<void> _load(String? user, int generation) async {
    List<String>? stored;
    try {
      stored = await ref.read(rhythmPrefsStoreProvider).getStringList(_key(user));
    } on Object {
      stored = null;
    }
    if (!ref.mounted || generation != _generation) return;
    state = {...?state, ...?stored};
  }

  /// Records that [weekId]'s cheer played.
  Future<void> mark(String weekId) async {
    final next = [...?state, if (!(state?.contains(weekId) ?? false)) weekId];
    final kept = next.length > _keepWeeks ? next.sublist(next.length - _keepWeeks) : next;
    state = kept.toSet();
    try {
      await ref.read(rhythmPrefsStoreProvider).setStringList(_key(ref.read(userIdProvider)), kept);
    } on Object {
      // Not saved: the cheer may play once more after a restart, nothing worse.
    }
  }
}

final weekCheersProvider = NotifierProvider<WeekCheers, Set<String>?>(WeekCheers.new);
