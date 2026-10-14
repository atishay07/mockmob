// Providers that compose the core `rhythmRepositoryProvider` (GET /api/me/rhythm) and
// `goalRepositoryProvider` (GET/PUT /api/me/goal) into what the screens read.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/models/rhythm.dart';
import '../../../core/repositories/goal_repository.dart';
import '../../../core/repositories/local_scope.dart' show userIdProvider;
import '../../../core/repositories/notification_prefs_repository.dart';
import '../../../core/repositories/remote_state.dart';
import '../../../core/repositories/rhythm_repository.dart';
import '../../../core/repositories/rhythm_seen_repository.dart';
import '../copy.dart';
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

/// Makes the week sample the student's date again. The snapshot reads "now" once, when the
/// rhythm or the goal last changed, so a phone left open overnight would keep marking
/// yesterday as today. Today's clock calls [resample] on each tick and on resume.
///
/// When the cached week no longer holds the student's date (a new week began, or the date
/// moved past what was fetched) the week is read from the server again, since the server owns
/// where a week starts. A read that fails leaves the cache showing, and the next tick asks again.
class RhythmClock extends Notifier<int> {
  @override
  int build() => 0;

  void resample() {
    state++;
    final rhythm = ref.read(rhythmRepositoryProvider).value;
    final start = parseIsoDate(rhythm?.weekStart);
    if (start == null) return;
    final today = studentDate(ref.read(nowProvider)(), ref.read(studentTimezoneProvider));
    final inWeek = !today.isBefore(start) && today.isBefore(start.add(const Duration(days: 7)));
    if (!inWeek) unawaited(ref.read(rhythmRepositoryProvider.notifier).refresh(force: true));
  }
}

final rhythmClockProvider = NotifierProvider<RhythmClock, int>(RhythmClock.new);

final rhythmSnapshotProvider = Provider<RhythmSnapshot>((ref) {
  ref.watch(rhythmClockProvider);
  return composeSnapshot(
    rhythmState: ref.watch(rhythmRepositoryProvider),
    goalState: ref.watch(goalRepositoryProvider),
    now: ref.watch(nowProvider)(),
    timezone: ref.watch(studentTimezoneProvider),
  );
});

/// The local celebration ids and the last seen week. Invalidate it after a write.
final rhythmSeenProvider = FutureProvider<RhythmSeenState>((ref) => ref.watch(rhythmSeenRepositoryProvider).read());

/// Weekly ending cards the student closed on this run of the app. Closing works even when the
/// local record of it cannot be written, so a card never stays stuck on Today.
class ClosedWeeklyEndings extends Notifier<Set<String>> {
  @override
  Set<String> build() {
    // Per account: a new sign-in starts empty.
    ref.watch(userIdProvider);
    return const {};
  }

  void close(String dismissId) => state = {...state, dismissId};
}

final closedWeeklyEndingsProvider = NotifierProvider<ClosedWeeklyEndings, Set<String>>(ClosedWeeklyEndings.new);

/// The weekly ending card to show on Today now, or null. Hidden while rhythm is off or the
/// local records are still loading, so a dismissed card never flashes.
final weeklyEndingProvider = Provider<WeeklyEndingData?>((ref) {
  if (!ref.watch(rhythmVisibleProvider)) return null;
  final rhythm = ref.watch(rhythmRepositoryProvider).value;
  final seen = ref.watch(rhythmSeenProvider).value;
  if (rhythm == null || seen == null) return null;
  final data = weeklyEndingFor(rhythm, dismissed: seen.celebratedIds);
  if (data != null && ref.watch(closedWeeklyEndingsProvider).contains(data.dismissId)) return null;
  return data;
});

/// The writes of this feature. Each one returns only after the server acknowledged it, and
/// throws `ApiError` otherwise so the caller can show a recovery line.
class RhythmActions {
  RhythmActions(this._ref);

  final Ref _ref;

  String get _zone => _ref.read(studentTimezoneProvider);
  DateTime get _today => studentDate(_ref.read(nowProvider)(), _zone);

  /// Reads the week again after a write. A read that was already running started before the
  /// write and can bring back the old week (overlapping refreshes share one request, so a forced
  /// refresh alone would just join it): wait for it, then read again.
  Future<void> _refreshRhythm() async {
    final repo = _ref.read(rhythmRepositoryProvider.notifier);
    if (_ref.read(rhythmRepositoryProvider).loading) await repo.refresh();
    await repo.refresh(force: true);
  }

  Future<int> _goalDays() async {
    final goal = _ref.read(goalRepositoryProvider).value;
    if (goal != null) return goal.daysPerWeek;
    return _ref.read(rhythmRepositoryProvider).value?.daysGoal ?? 4;
  }

  /// The pause the server holds now. The goal PUT replaces `pausedUntil`, so a goal change must
  /// send the current one back. While the goal has not loaded the pause is unknown: it is read
  /// once more, and if it still cannot be read the write is refused rather than sending null,
  /// which would quietly end a pause.
  Future<String?> _currentPause() async {
    var goal = _ref.read(goalRepositoryProvider).value;
    if (goal == null) {
      await _ref.read(goalRepositoryProvider.notifier).refresh(force: true);
      goal = _ref.read(goalRepositoryProvider).value;
    }
    if (goal == null) throw const ApiError(kind: ApiErrorKind.unavailable, code: 'goal_not_loaded');
    return goal.pausedUntil;
  }

  /// Saves the weekly goal and keeps an existing pause (the PUT would clear it otherwise).
  Future<void> saveGoal(int days) async {
    final pausedUntil = await _currentPause();
    await _ref.read(goalRepositoryProvider.notifier).save(daysPerWeek: days.clamp(1, 7), pausedUntil: pausedUntil);
    await _refreshRhythm();
  }

  /// Saves the chosen study days: the goal (their number) on the server first, then the days on
  /// the account where an endpoint holds them (see `StudyDaysRemote`), then on this phone, so the
  /// plan never runs ahead of an unsaved goal.
  Future<void> saveStudyDays(Set<int> days) async {
    await saveGoal(days.length);
    await _ref.read(studyDaysRemoteProvider).save(days);
    await _ref.read(plannedDaysProvider.notifier).save(days);
  }

  /// The receipt for a study days save that returned: what the server holds, and what stays on
  /// this phone.
  String studyDaysReceipt(int days) =>
      _ref.read(studyDaysRemoteProvider).storesOnAccount ? RhythmCopy.daysSaved(days) : RhythmCopy.studyDaysSaved(days);

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

  /// "Pause for about 3 months": the longest pause the server accepts is 100 days, so there is
  /// no open-ended pause; the paused panel shows the date it ends.
  Future<void> pauseUntilTurnedOn() => _pause(formatIsoDate(_today.add(const Duration(days: 100))));

  Future<void> resume() => _pause(null);

  /// "Take a rest week" on the weekly ending card: pause until [isoDate].
  Future<void> pauseUntil(String isoDate) => _pause(isoDate);

  /// From the student's own today, not the cached week: a week cached before a Sunday midnight
  /// would give a Sunday that has already passed.
  String _sundayOfThisWeek() {
    final today = _today;
    final monday = today.subtract(Duration(days: today.weekday - 1));
    return formatIsoDate(monday.add(const Duration(days: 6)));
  }

  Future<void> setRhythmHidden(bool hidden) => _ref.read(rhythmPrefsProvider.notifier).setHidden(hidden);

  /// Remembers that the weekly ending card was seen, so it shows once. The card closes for this
  /// run first; a failed local write is still thrown, so the caller knows it may come back.
  Future<void> dismissWeeklyEnding(WeeklyEndingData data) async {
    _ref.read(closedWeeklyEndingsProvider.notifier).close(data.dismissId);
    await _ref.read(rhythmSeenRepositoryProvider).markCelebrated(data.dismissId);
    _ref.invalidate(rhythmSeenProvider);
  }
}

final rhythmActionsProvider = Provider<RhythmActions>(RhythmActions.new);
