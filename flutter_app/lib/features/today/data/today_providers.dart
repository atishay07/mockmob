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
import '../../rhythm/rhythm.dart';
import '../logic/move_builder.dart';
import '../logic/today_builder.dart';
import '../logic/today_inputs.dart';
import '../logic/today_model.dart';
import 'today_profile.dart';

/// The plan Today reads. The client builds the card from the record, so the plan is used for
/// `recordState` and the server's own repair action; one minutes key keeps it to one request.
const int todayPlanMinutes = 10;

/// The duration chip the student chose on this visit (null: the default for the mood).
class TodayMinutes extends Notifier<int?> {
  @override
  int? build() => null;

  void choose(int minutes) => state = minutes;
}

final todayMinutesProvider = NotifierProvider<TodayMinutes, int?>(TodayMinutes.new);

/// Active "Not today" dismissals, kept live.
final todayDismissalsProvider = StreamProvider<Set<DismissalKey>>((ref) {
  ref.watch(userIdProvider);
  return ref.watch(dismissalRepositoryProvider).watchActive();
});

/// After a mock's deadline: does the attempt exist on the server? True on 200, false on 404,
/// null when the read failed (offline): Today then says it is still checking.
final endedAttemptExistsProvider = FutureProvider.family<bool?, String>((ref, attemptId) async {
  try {
    await ref.read(apiClientProvider).get('/api/attempts/${Uri.encodeComponent(attemptId)}');
    return true;
  } on ApiError catch (e) {
    return e.kind == ApiErrorKind.notFound ? false : null;
  }
});

/// The latest local session, with its answer counts from the journal.
final todayDraftProvider = FutureProvider<TodayDraft?>((ref) async {
  final draft = ref.watch(latestSessionDraftProvider).value;
  if (draft == null || draft.rejected) return null;
  final now = ref.read(nowProvider)();
  final summary = await ref.read(sessionDraftRepositoryProvider).summaryOf(draft);
  final ended = draft.endsAtWallMs <= now.millisecondsSinceEpoch;
  bool? exists;
  if (ended && draft.isMock) {
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

/// Today's writes and reads on demand.
class TodayActions {
  TodayActions(this._ref);

  final Ref _ref;

  /// Pull to refresh and Try again: the record, the plan and the week, read again.
  Future<void> refresh() async {
    await Future.wait([
      _ref.read(attemptsRepositoryProvider.notifier).refresh(force: true),
      _ref.read(planRepositoryProvider(todayPlanMinutes).notifier).refresh(force: true),
      _ref.read(rhythmRepositoryProvider.notifier).refresh(force: true),
    ]);
    _ref.invalidate(endedAttemptExistsProvider);
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
