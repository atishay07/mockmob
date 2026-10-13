// Providers that compose the core `rhythmRepositoryProvider` (GET /api/me/rhythm) and
// `goalRepositoryProvider` (GET/PUT /api/me/goal) into what the screens read.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/models/rhythm.dart';
import '../../../core/repositories/goal_repository.dart';
import '../../../core/repositories/notification_prefs_repository.dart';
import '../../../core/repositories/remote_state.dart';
import '../../../core/repositories/rhythm_repository.dart';
import '../../../core/repositories/rhythm_seen_repository.dart';
import '../logic/dates.dart';
import '../logic/week_view.dart';
import '../logic/weekly_ending.dart';
import 'rhythm_prefs.dart';
import 'study_days.dart';

/// Everything the week sheet, the You rhythm screen and the Today strip need in one value.
class RhythmSnapshot {
  const RhythmSnapshot({
    this.rhythm,
    this.goal,
    this.week,
    this.fetchedAt,
    this.loading = false,
    this.error,
    this.stale = false,
    this.timezone = 'Asia/Kolkata',
  });

  final Rhythm? rhythm;
  final Goal? goal;
  final WeekView? week;
  final DateTime? fetchedAt;
  final bool loading;
  final ApiError? error;

  /// A cached week is showing because the read failed: label it with [fetchedAt].
  final bool stale;
  final String timezone;

  bool get hasData => rhythm != null && week != null;
  bool get isInitialLoading => loading && !hasData;
  bool get isFailedEmpty => !hasData && !loading && error != null;
}

RhythmSnapshot composeSnapshot({
  required RemoteState<Rhythm> rhythmState,
  required RemoteState<Goal> goalState,
  required DateTime now,
  required String timezone,
}) {
  final rhythm = rhythmState.value;
  final goal = goalState.value;
  WeekView? week;
  if (rhythm != null) {
    week = buildWeekView(rhythm, today: studentDate(now, timezone), pausedUntil: goal?.pausedUntil);
  }
  return RhythmSnapshot(
    rhythm: rhythm,
    goal: goal,
    week: week,
    fetchedAt: rhythmState.fetchedAt,
    loading: rhythmState.loading,
    error: rhythmState.error,
    stale: rhythmState.isStale,
    timezone: timezone,
  );
}

final rhythmSnapshotProvider = Provider<RhythmSnapshot>((ref) {
  return composeSnapshot(
    rhythmState: ref.watch(rhythmRepositoryProvider),
    goalState: ref.watch(goalRepositoryProvider),
    now: ref.watch(nowProvider)(),
    timezone: ref.watch(studentTimezoneProvider),
  );
});

/// The local celebration ids and the last seen week. Invalidate it after a write.
final rhythmSeenProvider = FutureProvider<RhythmSeenState>((ref) => ref.watch(rhythmSeenRepositoryProvider).read());

/// The weekly ending card to show on Today now, or null. Hidden while rhythm is off or the
/// local records are still loading, so a dismissed card never flashes.
final weeklyEndingProvider = Provider<WeeklyEndingData?>((ref) {
  if (!ref.watch(rhythmVisibleProvider)) return null;
  final rhythm = ref.watch(rhythmRepositoryProvider).value;
  final seen = ref.watch(rhythmSeenProvider).value;
  if (rhythm == null || seen == null) return null;
  return weeklyEndingFor(rhythm, dismissed: seen.celebratedIds);
});

/// The writes of this feature. Each one returns only after the server acknowledged it, and
/// throws `ApiError` otherwise so the caller can show a recovery line.
class RhythmActions {
  RhythmActions(this._ref);

  final Ref _ref;

  String get _zone => _ref.read(studentTimezoneProvider);
  DateTime get _today => studentDate(_ref.read(nowProvider)(), _zone);

  Future<void> _refreshRhythm() => _ref.read(rhythmRepositoryProvider.notifier).refresh(force: true);

  Future<int> _goalDays() async {
    final goal = _ref.read(goalRepositoryProvider).value;
    if (goal != null) return goal.daysPerWeek;
    return _ref.read(rhythmRepositoryProvider).value?.daysGoal ?? 4;
  }

  String? get _pausedUntil => _ref.read(goalRepositoryProvider).value?.pausedUntil;

  /// Saves the weekly goal and keeps an existing pause (the PUT would clear it otherwise).
  Future<void> saveGoal(int days) async {
    await _ref.read(goalRepositoryProvider.notifier).save(daysPerWeek: days.clamp(1, 7), pausedUntil: _pausedUntil);
    await _refreshRhythm();
  }

  /// Saves the chosen study days: the goal (their number) on the server first, then which days
  /// they are on this phone, so the plan never runs ahead of an unsaved goal.
  Future<void> saveStudyDays(Set<int> days) async {
    await saveGoal(days.length);
    await _ref.read(plannedDaysProvider.notifier).save(days);
  }

  Future<void> _pause(String? until) async {
    await _ref.read(goalRepositoryProvider.notifier).save(daysPerWeek: await _goalDays(), pausedUntil: until);
    await _refreshRhythm();
  }

  /// This week's Sunday: the week is paused and the run is kept.
  Future<void> pauseThisWeek() => _pause(_sundayOfThisWeek());

  /// The Sunday of next week.
  Future<void> pauseTwoWeeks() {
    final sunday = parseIsoDate(_sundayOfThisWeek());
    return _pause(formatIsoDate((sunday ?? _today).add(const Duration(days: 7))));
  }

  /// "Until I turn it on": the longest pause the server accepts, 100 days ahead.
  Future<void> pauseUntilTurnedOn() => _pause(formatIsoDate(_today.add(const Duration(days: 100))));

  Future<void> resume() => _pause(null);

  /// "Take a rest week" on the weekly ending card: pause until [isoDate].
  Future<void> pauseUntil(String isoDate) => _pause(isoDate);

  String _sundayOfThisWeek() {
    final start = parseIsoDate(_ref.read(rhythmRepositoryProvider).value?.weekStart);
    final monday = start ?? _today.subtract(Duration(days: _today.weekday - 1));
    return formatIsoDate(monday.add(const Duration(days: 6)));
  }

  Future<void> setRhythmHidden(bool hidden) => _ref.read(rhythmPrefsProvider.notifier).setHidden(hidden);

  /// Remembers that the weekly ending card was seen, so it shows once.
  Future<void> dismissWeeklyEnding(WeeklyEndingData data) async {
    await _ref.read(rhythmSeenRepositoryProvider).markCelebrated(data.dismissId);
    _ref.invalidate(rhythmSeenProvider);
  }
}

final rhythmActionsProvider = Provider<RhythmActions>(RhythmActions.new);
