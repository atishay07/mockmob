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
import '../../../core/models/models.dart' show Attempt;
import '../../../core/repositories/repositories.dart';
import '../../practice/data/open_paper.dart' show openPaperProvider;
import '../../review/data/review_chapters_provider.dart' show reviewChapterFiguresProvider;
import '../../review/data/review_providers.dart' show openRepairsProvider;
import '../../review/revise/revise_data.dart' show reviseCapProvider, reviseEntryProvider;
import '../../rhythm/data/rhythm_providers.dart' show rhythmClockProvider;
import '../../rhythm/logic/dates.dart' show formatIsoDate, studentDate;
import '../../rhythm/rhythm.dart';
import '../../social/data/mob_repository.dart' show currentMobProvider, mobAvailableProvider;
import '../../paper_reel/paper_reel.dart' show reelSeenProvider;
import '../logic/move_builder.dart';
import '../logic/study_log.dart' show StudySource;
import '../logic/reel_pending.dart';
import '../logic/today_builder.dart';
import '../logic/today_clock.dart';
import '../logic/today_inputs.dart';
import '../logic/today_model.dart';
import 'lead_pick.dart' show todayPicks;
import 'road_plan.dart';
import 'study_log_store.dart';
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

  /// The length the card offered before the student's first pick today (what Today suggested),
  /// so the study log can tell a longer pick from the suggestion.
  int? suggested;
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
    // An ended mock the server had not recorded (or could not be asked about) is asked again:
    // its answers may have reached it in the background since (ROBUSTNESS today-04).
    ref.read(endedRecheckProvider.notifier).bump();
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

/// Counts the moments an unrecorded ended mock should be asked about again: the app came back to
/// the front, or Today's clock ticked. [TodayClock.refresh] bumps it.
class EndedRecheck extends Notifier<int> {
  @override
  int build() => 0;

  void bump() => state++;
}

final endedRecheckProvider = NotifierProvider<EndedRecheck, int>(EndedRecheck.new);

/// After a mock's deadline: does the attempt exist on the server? True on 200, false on 404,
/// null when the read failed (offline): Today then says it is still checking.
///
/// A read that failed is asked again when the network comes back, so "Checking what reached the
/// server" does not outlive the outage that caused it. Only a true answer is final: a 404 or a
/// failure is asked again on the next resume or clock tick ([endedRecheckProvider]), because a
/// submit still in flight may land after it (ROBUSTNESS today-04).
final endedAttemptExistsProvider = FutureProvider.family<bool?, String>((ref, attemptId) async {
  var failed = false;
  bool? answer;
  ref.listen(networkStatusProvider, (previous, next) {
    if (failed && next == NetworkStatus.online && previous != NetworkStatus.online) ref.invalidateSelf();
  });
  ref.listen(endedRecheckProvider, (previous, next) {
    if (answer != true) ref.invalidateSelf();
  });
  try {
    await ref.read(apiClientProvider).get('/api/attempts/${Uri.encodeComponent(attemptId)}');
    return answer = true;
  } on ApiError catch (e) {
    failed = e.kind != ApiErrorKind.notFound;
    return answer = failed ? null : false;
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

/// When the last Try again ended with the record still not loaded (L01), or null. The screen sets
/// it after a retry that changed nothing and clears it once the record is in hand.
class TodayLastTried extends Notifier<DateTime?> {
  @override
  DateTime? build() => null;

  void set(DateTime? at) => state = at;
}

final todayLastTriedProvider = NotifierProvider<TodayLastTried, DateTime?>(TodayLastTried.new);

/// The papers the reel card is due for: every fresh submission whose reel was not played or turned down, opened
/// result or not (D29, v15 walk M3). Keyed on the reel's own flag, so a Quick set, whose result opens itself the
/// moment it lands, still gets its card once.
final todayReelPendingProvider = Provider<List<ReelDue>>((ref) {
  final all = ref.watch(allPendingResultsProvider).value ?? const <PendingResult>[];
  final seen = ref.watch(reelSeenProvider).value;
  final attempts = ref.watch(attemptsRepositoryProvider.select((s) => s.value)) ?? const <Attempt>[];
  return reelPendingFrom(pending: all, seen: seen, knownAttempts: {for (final a in attempts) a.id}, now: ref.watch(nowProvider)());
});

final todayInputsProvider = Provider<TodayInputs>((ref) {
  // Re-sampled on every clock tick (see [TodayClock]).
  ref.watch(todayClockProvider);
  final auth = ref.watch(authSnapshotProvider);
  final attempts = ref.watch(attemptsRepositoryProvider);
  final plan = ref.watch(planRepositoryProvider(todayPlanMinutes));
  final rhythm = ref.watch(rhythmSnapshotProvider);
  final week = ref.watch(rhythmVisibleProvider) ? rhythm.week : null;
  // The strip's slot is held from the first frame (L03): while the rhythm choices are still being
  // read (rhythm is on unless the student turned it off) and while the week has not landed. A
  // first read that failed keeps the slot and says so; a later read fills it in place.
  final rhythmOn = ref.watch(rhythmVisibleProvider) || !ref.watch(rhythmPrefsProvider.select((p) => p.loaded));
  final weekFailed = week == null && rhythmOn && rhythm.isFailedEmpty;
  final records = ref.watch(repairLocalRecordsProvider).value ?? const [];
  final repaired = <String, Set<String>>{};
  final now = ref.watch(nowProvider)();
  final zone = ref.watch(studentTimezoneProvider);
  final todayKey = TodayInputs(now: now, timezone: zone).date();
  var repairedToday = 0;
  for (final r in records) {
    if (!r.isRepaired) continue;
    (repaired[r.attemptId] ??= {}).add(r.questionId);
    final at = r.ackedAt;
    if (at != null && TodayInputs(now: now, timezone: zone).date(at) == todayKey) repairedToday++;
  }
  // Revise is read only in the first week, from day 2, where it can be the move (FEATURE-ADOPTION 7):
  // an unknown count never makes Revise the move.
  final list = attempts.value;
  final firstDay = list == null || list.isEmpty ? null : TodayInputs(now: now, timezone: zone, attempts: list).firstWeekDay;
  final revise = firstDay != null && firstDay >= 2 ? ref.watch(reviseEntryProvider).value : null;
  final reviseRead = revise != null && !revise.isUnavailable ? revise : null;
  final reviseDue = reviseRead?.due;
  return TodayInputs(
    now: now,
    timezone: zone,
    firstName: firstNameOf(auth.name),
    email: auth.email,
    isPro: auth.isPro,
    repairedToday: repairedToday,
    // One source for "open repairs": Review's index, the count its own header prints.
    openRepairs: ref.watch(openRepairsProvider),
    // One record for chapter figures: Review's own rows, so Weak chapters and Review agree.
    reviewChapters: ref.watch(reviewChapterFiguresProvider),
    reviseDue: reviseDue,
    reviseShown: reviseRead?.shown,
    reviseCards: [for (final c in reviseRead?.items ?? const []) (questionId: c.questionId, subject: c.subject, chapter: c.chapter)],
    reviseCap: reviseRead == null ? 10 : ref.watch(reviseCapProvider).value ?? 10,
    // The account's subjects; until they sync, the ones the setup sheet holds (a fresh account's
    // deck read none and offered a single card, 19 Oct G12).
    subjects: auth.subjects.isNotEmpty ? auth.subjects : (ref.watch(todayProfileProvider)?.subjects ?? const []),
    mobInvite: ref.watch(mobAvailableProvider) && ref.watch(currentMobProvider) == null,
    attempts: attempts.value,
    // A Try again or a pull on the failure card keeps the card up while the new read runs (it is
    // not a first load, so no skeleton): the failure stands until the read answers.
    attemptsFailed: attempts.isFailedEmpty || attempts.isRetryingAfterFailure,
    // Only the attempts read can fail the card (L01). A plan read that failed while the papers
    // are in hand is logged, never shown: the move is built from the papers instead.
    readProblem: attempts.isFailedEmpty || attempts.isRetryingAfterFailure ? LoadProblem.of(attempts.error ?? attempts.priorError) : null,
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
    weekLoading: week == null && rhythmOn && !weekFailed,
    weekFailed: weekFailed,
    returning: rhythm.rhythm?.returning ?? false,
    draft: ref.watch(todayDraftProvider).value,
    openPaper: ref.watch(openPaperProvider).value,
    unopened: [
      for (final u in ref.watch(unopenedResultsProvider).value ?? const <PendingResult>[])
        (attemptId: u.attemptId, receivedAt: u.receivedAt),
    ]..sort((a, b) => b.receivedAt.compareTo(a.receivedAt)),
    reelPending: ref.watch(todayReelPendingProvider),
    dismissed: ref.watch(todayDismissalsProvider).value ?? const {},
    repaired: repaired,
    profile: ref.watch(todayProfileProvider),
    offline: ref.watch(networkStatusProvider) == NetworkStatus.offline,
    readOffline: attempts.isStale && (attempts.error?.isOffline ?? false),
    selectedMinutes: ref.watch(todayMinutesProvider),
    roadPlan: ref.watch(roadPlanProvider),
    lastTriedAt: ref.watch(todayLastTriedProvider),
    pattern: ref.watch(studyPatternProvider),
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

  /// After a read that changed nothing, the header (or the failure card) says when it tried: "Tried 7:32 AM, still
  /// not loading". Once the record is in hand the line is cleared. The same bookkeeping the screen does after a
  /// Try again, so a refresh the app ran by itself (the network came back) leaves the same trace.
  void noteTry() {
    final view = _ref.read(todayViewProvider);
    final hero = view.hero;
    final failing = (hero is MoveHero && hero.primary.target is RetryLoad) || (hero is EndedHero && hero.action.target is RetryLoad);
    final still = failing || view.header.refreshable;
    _ref.read(todayLastTriedProvider.notifier).set(still ? _ref.read(nowProvider)() : null);
  }

  /// The network is back: read everything Today shows again, once, and note whether it worked.
  Future<void> refreshAfterReconnect() async {
    try {
      await refresh();
    } finally {
      noteTry();
    }
  }

  /// The reads Today shows are still a saved copy although the connection is back (the read after the reconnect failed, or
  /// ended behind one that was hung while the radio was down): the line over the greeting would keep saying so.
  bool stillSaved() {
    try {
      final i = _ref.read(todayInputsProvider);
      return !i.offline && (i.attemptsStale || i.planStale);
    } on Object {
      return false;
    }
  }

  /// The least gap between two reads made because Today came back to the front (a student flicking between tabs reads once).
  static const Duration shownReadGap = Duration(seconds: 10);
  DateTime? _lastShownRead;

  /// Today is in front again (the student was on another tab). The connection monitor's own listener is paused while Today is
  /// hidden (Riverpod pauses a provider nobody in view listens to), so a network that dropped and came back on the Review tab
  /// was never seen by [todayReconnectRefreshProvider], and "Offline. Last loaded" stayed over Today for minutes (v15 final walk).
  /// This is the same read, taken at the moment it matters: only when the copy on screen is still a saved one although the
  /// connection is up, and not more than once in [shownReadGap]. It sets no timer.
  Future<void> refreshWhenShown() async {
    if (!stillSaved()) return;
    final now = _ref.read(nowProvider)();
    final last = _lastShownRead;
    if (last != null && now.difference(last) < shownReadGap) return;
    _lastShownRead = now;
    try {
      await refreshAfterReconnect();
    } on Object {
      // The record keeps its error and the line says "Still not loading"; the student's pull or tap reads again.
    }
  }

  /// A length picked on the card on screen, whose kind is [shown]. Revise's length is the Revise
  /// screen's own setting (5 or 10 questions a day), so only a Revise card on screen writes it and
  /// the round its key opens is the size the card showed. Every other card takes the visit's
  /// length, which the lead and the Suggested stack's moves are built with, so a card swapped in
  /// from the stack follows the pick too (C / D51 walk).
  void chooseLength(int minutes, MoveKind shown) {
    if (shown == MoveKind.revise) {
      unawaited(_ref.read(reviseCapProvider.notifier).set(minutes));
    } else {
      final picker = _ref.read(todayMinutesProvider.notifier);
      if (_ref.read(todayMinutesProvider) == null) {
        final hero = _ref.read(todayViewProvider).hero;
        picker.suggested = hero is MoveHero ? hero.selectedMinutes : null;
      }
      picker.choose(minutes);
    }
  }

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
    // The study log learns where the session came from and the length picked against the one offered.
    if (action.startsSession) {
      try {
        final picked = _ref.read(todayMinutesProvider);
        final fromDeck = todayPicks.of(_ref.read(todayViewProvider).header.dateLine) != null;
        _ref.read(studyLogProvider.notifier).noteTodayStart(
              source: fromDeck ? StudySource.todayDeck : StudySource.todayLead,
              suggested: picked == null ? minutes : _ref.read(todayMinutesProvider.notifier).suggested,
              chosen: minutes,
            );
      } on Object {
        // The log is a comfort; the start goes ahead.
      }
    }
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

/// The network signals for one reconnect arrive together (the radio, the first answered request, the monitor's
/// ping); Today waits this long after the last one and then reads once.
const Duration todayReconnectDebounce = Duration(seconds: 1);

/// Today refreshes itself when the network returns (v15 walk, M1): one read of the record, the plan and the week
/// about a second after the connection settles, so the header never keeps saying "Not refreshed" over a problem
/// that is gone and the student never has to find the line to tap. Debounced: a flapping connection reads once.
/// Watched by the Today screen; it does nothing while nobody is listening.
final todayReconnectRefreshProvider = Provider<void>((ref) {
  Timer? pending;
  var retries = 0;

  Future<void> read() async {
    try {
      await ref.read(todayActionsProvider).refreshAfterReconnect();
    } on Object {
      // The record keeps its error; the retry below (or the student's pull) reads again.
    }
    if (!ref.mounted || retries >= todayReconnectRetries.length) return;
    if (!ref.read(todayActionsProvider).stillSaved()) return;
    pending?.cancel();
    pending = Timer(todayReconnectRetries[retries++], () {
      pending = null;
      if (ref.mounted) unawaited(read());
    });
  }

  void soon() {
    pending?.cancel();
    retries = 0;
    pending = Timer(todayReconnectDebounce, () {
      pending = null;
      if (!ref.mounted) return;
      unawaited(read());
    });
  }

  ref.listen(networkRestoredProvider, (_, next) {
    if (next.hasValue) soon();
  });
  ref.listen(networkStatusProvider, (previous, next) {
    if (previous == NetworkStatus.offline && next == NetworkStatus.online) soon();
  });
  ref.onDispose(() => pending?.cancel());
});

/// After the read that follows a reconnect, Today looks again if the copy on screen is still a saved one, twice and then stops
/// (v15 final walk: "Offline. Last loaded" stayed over Today for a minute with the network back, until the line was tapped).
const List<Duration> todayReconnectRetries = [Duration(seconds: 8), Duration(seconds: 25)];

/// How long Today waits before it reads the plan again by itself, after the plan alone failed (the papers are fresh).
/// Two quiet tries, then it stops: a pull or the line's tap is still there. Never a timer that runs for ever.
const List<Duration> todayQuietPlanRetries = [Duration(seconds: 20), Duration(seconds: 75)];

/// Only the plan read failed: the record is fresh and the card is built from it, so the one thing wrong is a plan
/// copy the header calls "Updated 10:18 AM" and keeps over the greeting until someone pulls (v15 walk, ten minutes of
/// it). The plan is read again twice, quietly, a little after it failed, so the line goes by itself when the server
/// answers. Watched by the Today screen; nothing runs while nobody is listening.
final todayQuietPlanRetryProvider = Provider<void>((ref) {
  Timer? timer;
  var tries = 0;

  bool onlyPlanStale() {
    final i = ref.read(todayInputsProvider);
    return i.planStale && !i.attemptsStale && !i.offline;
  }

  void schedule() {
    timer?.cancel();
    if (tries >= todayQuietPlanRetries.length) return;
    timer = Timer(todayQuietPlanRetries[tries], () async {
      timer = null;
      if (!ref.mounted || !onlyPlanStale()) return;
      tries++;
      try {
        await ref.read(planRepositoryProvider(todayPlanMinutes).notifier).refresh(force: true);
      } on Object {
        // The next quiet try, or the student's own, reads it again.
      }
      if (ref.mounted && onlyPlanStale()) schedule();
    });
  }

  ref.listen<bool>(
    todayInputsProvider.select((i) => i.planStale && !i.attemptsStale && !i.offline),
    (previous, stale) {
      if (stale) {
        if (timer == null) schedule();
      } else {
        timer?.cancel();
        timer = null;
        tries = 0;
      }
    },
    fireImmediately: true,
  );
  ref.onDispose(() => timer?.cancel());
});
