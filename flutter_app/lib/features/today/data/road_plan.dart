// The student's own road (the board under "The road to May"): the exam day they aim for and how
// many full mocks they want behind them. Their choice, kept on this phone under keys of their own
// per account, in the same store as the rhythm choices. No server endpoint holds them, and the
// sheets say so ("Saved on this phone").
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/repositories/local_scope.dart';
import '../../rhythm/data/rhythm_prefs.dart' show rhythmPrefsStoreProvider;
import '../logic/road_board.dart';

class RoadPlanStore extends Notifier<RoadPlan> {
  /// Bumped on every rebuild (an account switch): a read that began for the previous account
  /// never fills the new one.
  int _generation = 0;

  /// A choice made while the stored plan was still being read wins over the read.
  bool _touched = false;

  static String _key(String? user, String name) => 'road_${name}_${user ?? 'none'}';

  @override
  RoadPlan build() {
    ref.watch(userIdProvider);
    _generation++;
    _touched = false;
    final generation = _generation;
    scheduleMicrotask(() => _load(generation));
    return const RoadPlan();
  }

  Future<void> _load(int generation) async {
    try {
      final store = ref.read(rhythmPrefsStoreProvider);
      final user = ref.read(userIdProvider);
      final date = await store.getString(_key(user, 'exam_date'));
      final target = await store.getInt(_key(user, 'mock_target'));
      if (!ref.mounted || generation != _generation || _touched) return;
      final parsed = date == null ? null : DateTime.tryParse(date);
      state = RoadPlan(
        examDate: parsed == null ? null : DateTime.utc(parsed.year, parsed.month, parsed.day),
        mockTarget: target,
      );
    } on Object {
      // Nothing stored, or unreadable: the expected window and no target.
    }
  }

  /// The day the student aims for, or null to count to the expected window again.
  Future<void> setExamDate(DateTime? date) async {
    _touched = true;
    final day = date == null ? null : DateTime.utc(date.year, date.month, date.day);
    state = day == null ? state.copyWith(clearDate: true) : state.copyWith(examDate: day);
    final store = ref.read(rhythmPrefsStoreProvider);
    final key = _key(ref.read(userIdProvider), 'exam_date');
    if (day == null) {
      await store.remove(key);
    } else {
      final m = day.month.toString().padLeft(2, '0'), d = day.day.toString().padLeft(2, '0');
      await store.setString(key, '${day.year}-$m-$d');
    }
  }

  /// How many full mocks the student wants before the exam, or null to clear it.
  Future<void> setMockTarget(int? target) async {
    _touched = true;
    state = target == null ? state.copyWith(clearTarget: true) : state.copyWith(mockTarget: target.clamp(mockTargetMin, mockTargetMax));
    final store = ref.read(rhythmPrefsStoreProvider);
    final key = _key(ref.read(userIdProvider), 'mock_target');
    if (target == null) {
      await store.remove(key);
    } else {
      await store.setInt(key, state.mockTarget!);
    }
  }
}

final roadPlanProvider = NotifierProvider<RoadPlanStore, RoadPlan>(RoadPlanStore.new);
