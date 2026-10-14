// Gathers Today's inputs from the shared repositories (spec 5.3 data list). Server reads load on
// open and after a session, never on a timer; Today renders the cache at once and labels it
// with its time when it cannot refresh.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/analytics/analytics.dart';
import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/connectivity/connectivity.dart';
import '../../../core/domain/session_rules.dart';
import '../../../core/repositories/repositories.dart';
import '../../rhythm/data/rhythm_providers.dart' show rhythmClockProvider;
import '../../rhythm/logic/dates.dart' show formatIsoDate, studentDate;
import '../../rhythm/rhythm.dart';
import '../logic/move_builder.dart';
import '../logic/today_builder.dart';
import '../logic/today_clock.dart';
import '../logic/today_inputs.dart';
import '../logic/today_model.dart';
import 'today_profile.dart';

/// The plan Today reads. The client builds the card from the record, so the plan is used for
/// `recordState` and the server's own repair action; one minutes key keeps it to one request.
const int todayPlanMinutes = 10;

/// The student's calendar date (`YYYY-MM-DD`) as of Today's last clock tick. A provider only
/// tells its listeners when its value changes, so this moves once a day, not once an hour.
final todayStudentDayProvider = Provider<String>((ref) {
  ref.watch(todayClockProvider);
  return formatIsoDate(studentDate(ref.read(nowProvider)(), ref.read(studentTimezoneProvider)));
});

/// The duration chip the student chose on this visit (null: the default for the mood). It
/// belongs to one student on one day: signing in as someone else, or the date moving on, starts
/// it empty again.
class TodayMinutes extends Notifier<int?> {
  @override
  int? build() {
    ref.watch(userIdProvider);
    ref.watch(todayStudentDayProvider);
    return null;
  }

  void choose(int minutes) => state = minutes;
}

final todayMinutesProvider = NotifierProvider<TodayMinutes, int?>(TodayMinutes.new);

/// Today's clock. The inputs sample "now" once per build, so this ticks to make them sample it
/// again: every hour on the student's wall clock, at the open session's deadline, and whenever
/// the screen comes back to the front ([refresh]). Without it a phone left open overnight keeps
/// yesterday's greeting, mood and date.
///
/// The timer only runs while something is listening (Today on screen, or the home-screen
/// widget). With nobody listening (Today closed or behind another tab) it stops, so no timer
/// outlives the screen; back in view, a boundary that passed meanwhile re-samples at once.
class TodayClock extends Notifier<int> {
  Timer? _timer;
  int? _sessionEndsAtMs;
  int _ticks = 0;

  /// When the armed tick is due, kept while paused so a resume knows whether one was missed.
  DateTime? _due;

  /// Nobody is listening: no timer runs.
  bool _paused = false;

  @override
  int build() {
    ref.onDispose(_stop);
    // Life-cycle callbacks may not use `ref`, so they only stop the timer or schedule [_wake].
    ref.onCancel(() {
      _paused = true;
      _stop();
    });
    ref.onResume(() {
      _paused = false;
      _stop();
      _timer = Timer(Duration.zero, _wake);
    });
    _paused = false;
    _sessionEndsAtMs = ref.watch(latestSessionDraftProvider).value?.endsAtWallMs;
    // Rebuilt after the armed tick was due (it was paused): that tick counts now.
    final due = _due;
    if (due != null && !ref.read(nowProvider)().isBefore(due)) _ticks++;
    _arm();
    return _ticks;
  }

  void _stop() {
    _timer?.cancel();
    _timer = null;
  }

  void _arm() {
    _stop();
    final now = ref.read(nowProvider)();
    final wait = untilNextTodayTick(now: now, timezone: ref.read(studentTimezoneProvider), sessionEndsAtMs: _sessionEndsAtMs);
    _due = now.add(wait);
    if (!_paused) _timer = Timer(wait, refresh);
  }

  /// Listened to again: re-sample if the armed tick fell due meanwhile, else arm what is left.
  void _wake() {
    _timer = null;
    if (!ref.mounted || _paused) return;
    final due = _due;
    if (due != null && !ref.read(nowProvider)().isBefore(due)) {
      refresh();
    } else {
      _arm();
    }
  }

  /// Re-samples the clock now (app resumed, or a boundary passed) and arms the next tick.
  void refresh() {
    state = ++_ticks;
    _arm();
    // The week strip reads the student's date too: it samples it again, and reads the week from
    // the server when a new one has begun.
    ref.read(rhythmClockProvider.notifier).resample();
  }
}

final todayClockProvider = NotifierProvider<TodayClock, int>(TodayClock.new);

/// Active "Not today" dismissals, kept live. The repository filters expired rows against the
/// time the stream was opened, so each clock tick opens it again: a dismissal made at 11 PM
/// stops hiding the repair once 4:00 AM has passed.
final todayDismissalsProvider = StreamProvider<Set<DismissalKey>>((ref) {
  ref.watch(userIdProvider);
  ref.watch(todayClockProvider);
  return ref.watch(dismissalRepositoryProvider).watchActive();
});

/// After a mock's deadline: does the attempt exist on the server? True on 200, false on 404,
/// null when the read failed (offline): Today then says it is still checking.
///
/// A read that failed is asked again when the network comes back, so "Checking what reached the
/// server" does not outlive the outage that caused it.
final endedAttemptExistsProvider = FutureProvider.family<bool?, String>((ref, attemptId) async {
  var failed = false;
  ref.listen(networkStatusProvider, (previous, next) {
    if (failed && next == NetworkStatus.online && previous != NetworkStatus.online) ref.invalidateSelf();
  });
  try {
    await ref.read(apiClientProvider).get('/api/attempts/${Uri.encodeComponent(attemptId)}');
    return true;
  } on ApiError catch (e) {
    failed = e.kind != ApiErrorKind.notFound;
    return failed ? null : false;
  }
});

/// The latest local session, with its answer counts from the journal.
final todayDraftProvider = FutureProvider<TodayDraft?>((ref) async {
  final draft = ref.watch(latestSessionDraftProvider).value;
  // The clock ticks on the hour, at the deadline and on resume, so "ended" and "resumable" are
  // judged against the time now, not the time Today was first opened.
  ref.watch(todayClockProvider);
  if (draft == null || draft.rejected) return null;
  final now = ref.read(nowProvider)();
  final summary = await ref.read(sessionDraftRepositoryProvider).summaryOf(draft);
  final ended = draft.endsAtWallMs <= now.millisecondsSinceEpoch;
  bool? exists;
  // Past its notice window an ended mock is not shown, so the server is not asked about it.
  final noticeOver = now.millisecondsSinceEpoch - draft.endsAtWallMs >= endedNoticeWindow.inMilliseconds;
  if (ended && draft.isMock && !noticeOver) {
    exists = await ref.watch(endedAttemptExistsProvider(draft.sessionId).future);
  }
  return TodayDraft(
    sessionId: draft.sessionId,
    subject: draft.subject,
    isMock: draft.isMock,
    mockNumber: draft.mockNumber,
    total: summary.total,
    answered: summary.answered,
    acknowledgedAnswered: summary.acknowledgedAnswered,
    endsAt: DateTime.fromMillisecondsSinceEpoch(draft.endsAtWallMs),
    lastAckAt: draft.lastAckAtMs == null ? null : DateTime.fromMillisecondsSinceEpoch(draft.lastAckAtMs!),
    resumable: resumableDraft(draft, sessionId: draft.sessionId, nowMs: now.millisecondsSinceEpoch),
    attemptExists: exists,
  );
});

String? firstNameOf(String? name) {
  final trimmed = name?.trim() ?? '';
  if (trimmed.isEmpty) return null;
  return trimmed.split(RegExp(r'\s+')).first;
}

final todayInputsProvider = Provider<TodayInputs>((ref) {
  // Re-sampled on every clock tick (see [TodayClock]).
  ref.watch(todayClockProvider);
  final auth = ref.watch(authSnapshotProvider);
  final attempts = ref.watch(attemptsRepositoryProvider);
  final plan = ref.watch(planRepositoryProvider(todayPlanMinutes));
  final rhythm = ref.watch(rhythmSnapshotProvider);
  final week = ref.watch(rhythmVisibleProvider) ? rhythm.week : null;
  final records = ref.watch(repairLocalRecordsProvider).value ?? const [];
  final repaired = <String, Set<String>>{};
  for (final r in records) {
    if (r.isRepaired) (repaired[r.attemptId] ??= {}).add(r.questionId);
  }
  return TodayInputs(
    now: ref.watch(nowProvider)(),
    timezone: ref.watch(studentTimezoneProvider),
    firstName: firstNameOf(auth.name),
    subjects: auth.subjects,
    attempts: attempts.value,
    attemptsFailed: attempts.isFailedEmpty,
    attemptsFetchedAt: attempts.fetchedAt,
    attemptsStale: attempts.isStale,
    plan: plan.value,
    planFetchedAt: plan.fetchedAt,
    planStale: plan.isStale,
    week: week == null
        ? null
        : TodayWeek(
            studied: [for (final d in week.days) d.studyDay],
            todayIndex: () {
              final i = week.days.indexWhere((d) => d.isToday);
              return i < 0 ? null : i;
            }(),
            label: week.label,
            goal: week.goal,
            planned: ref.watch(studyDayPlanProvider),
            paused: week.status == WeekStatus.paused,
            met: week.met,
            dates: [for (final d in week.days) d.date?.day],
          ),
    returning: rhythm.rhythm?.returning ?? false,
    draft: ref.watch(todayDraftProvider).value,
    unopened: [
      for (final u in ref.watch(unopenedResultsProvider).value ?? const <PendingResult>[])
        (attemptId: u.attemptId, receivedAt: u.receivedAt),
    ]..sort((a, b) => b.receivedAt.compareTo(a.receivedAt)),
    dismissed: ref.watch(todayDismissalsProvider).value ?? const {},
    repaired: repaired,
    profile: ref.watch(todayProfileProvider),
    offline: ref.watch(networkStatusProvider) == NetworkStatus.offline,
    selectedMinutes: ref.watch(todayMinutesProvider),
  );
});

final todayViewProvider = Provider<TodayView>((ref) => buildToday(ref.watch(todayInputsProvider)));

/// Today's next move as one action a screen outside Today can offer by name (the recap's last
/// card, when the paper left nothing to repair). It is the same move Today's card builds, so the
/// two never name different things. Null when Today has no move that opens a screen (it would
/// only offer to retry a load or open the alternatives), or when the move needs the network and
/// the phone is offline: the caller then offers no named move.
final todayNextActionProvider = Provider<TodayAction?>((ref) {
  final inputs = ref.watch(todayInputsProvider);
  final action = buildMove(inputs).primary;
  if (action.target is! GoTo) return null;
  if (inputs.offline && action.startsSession) return null;
  return action;
});

/// Today's writes and reads on demand.
class TodayActions {
  TodayActions(this._ref);

  final Ref _ref;

  /// Pull to refresh and Try again: the record, the plan and the week, read again.
  Future<void> refresh() async {
    // Ask the server about an ended mock first, in parallel with the record reads, so a slow
    // attempts read does not hold back "Checking what reached the server".
    _ref.invalidate(endedAttemptExistsProvider);
    await Future.wait([
      _ref.read(attemptsRepositoryProvider.notifier).refresh(force: true),
      _ref.read(planRepositoryProvider(todayPlanMinutes).notifier).refresh(force: true),
      _ref.read(rhythmRepositoryProvider.notifier).refresh(force: true),
    ]);
  }

  /// "Not today": hides the client-built repair until 4:00 AM or the next submitted attempt.
  /// Review, the repair record and the attempt are untouched.
  Future<void> notToday() async {
    final facts = MoveFacts(_ref.read(todayInputsProvider));
    final basis = facts.basis;
    if (basis == null) return;
    await _ref.read(dismissalRepositoryProvider).dismiss(dismissalKeyFor(basis));
    unawaited(_ref.read(analyticsClientProvider).track(AnalyticsEvents.nextMoveDismissed, props: {'action_type': 'repair', 'screen': 'today'}));
  }

  void started(TodayAction action, {int? minutes}) {
    unawaited(_ref.read(analyticsClientProvider).track(
      AnalyticsEvents.nextMoveStarted,
      props: {'action_type': ?action.actionType, 'minutes': ?minutes, 'screen': 'today'},
    ));
  }

  void reasonOpened() {
    unawaited(_ref.read(analyticsClientProvider).track(AnalyticsEvents.nextMoveReasonOpened, props: {'screen': 'today'}));
  }
}

final todayActionsProvider = Provider<TodayActions>(TodayActions.new);
