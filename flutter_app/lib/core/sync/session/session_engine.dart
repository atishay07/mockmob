import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../../api/api_error.dart';
import '../../domain/session_rules.dart';
import '../../models/json_helpers.dart';
import '../../models/question.dart';
import '../../models/session.dart';
import '../../models/session_draft.dart';
import '../../repositories/session_draft_repository.dart';
import '../../storage/app_database.dart';
import 'save_state.dart';
import 'session_api.dart';
import 'session_clock.dart';
import 'session_heartbeat.dart';
import 'session_journal.dart';
import 'session_submitter.dart';
import 'session_syncer.dart';
import 'session_work_scheduler.dart';

/// The silent ongoing status shown while a mock is open and the app is in the background.
/// Its states are only "in progress" and "sending" (design spec 5.5).
abstract class SessionStatusNotifier {
  Future<void> showInProgress(SessionDraft draft);
  Future<void> showSending(SessionDraft draft);
  Future<void> clear();
}

class NoopSessionStatusNotifier implements SessionStatusNotifier {
  const NoopSessionStatusNotifier();

  @override
  Future<void> showInProgress(SessionDraft draft) async {}

  @override
  Future<void> showSending(SessionDraft draft) async {}

  @override
  Future<void> clear() async {}
}

/// Everything the engine depends on, so the runner builds it once and tests build fakes.
class SessionEngineServices {
  const SessionEngineServices({
    required this.db,
    required this.userId,
    required this.api,
    required this.drafts,
    required this.submitter,
    this.scheduler = const NoopSessionWorkScheduler(),
    this.status = const NoopSessionStatusNotifier(),
    this.clockFactory,
    this.timerFactory,
    this.syncDebounce = const Duration(milliseconds: 400),
    this.onPendingWork,
    this.earlierDraftWait = const Duration(seconds: 3),
    this._now,
  });

  final AppDatabase db;
  final String userId;
  final SessionApi api;
  final SessionDraftRepository drafts;
  final SessionSubmitter submitter;
  final SessionWorkScheduler scheduler;
  final SessionStatusNotifier status;

  /// Tests inject a clock with fake sources.
  final SessionClock Function()? clockFactory;
  final TimerFactory? timerFactory;
  final Duration syncDebounce;

  /// Told whether this session has work the network must carry (unacknowledged answers or an
  /// unsent submit), so connectivity only pings while something is waiting.
  final void Function(String key, bool pending)? onPendingWork;

  /// How long a start waits for an earlier unsent paper of the same selection to be sent before
  /// opening the new one anyway (the earlier submit then finishes in the background).
  final Duration earlierDraftWait;
  final DateTime Function()? _now;

  DateTime now() => (_now ?? DateTime.now)();
}

/// One-time notices while answering.
enum SessionWarning { fiveMinutes, oneMinute, timeUp }

/// "You were away for 2 minutes 10 seconds. The timer kept running." with the save facts the
/// banner needs.
class AwayInfo {
  const AwayInfo({required this.duration, required this.allSaved, required this.unsyncedAnswers});

  final Duration duration;

  /// Every answer was acknowledged by the server when the student came back.
  final bool allSaved;
  final int unsyncedAnswers;
}

enum SubmitStage { idle, sending, received, pending, windowClosed, rejected }

class SubmitUiState {
  const SubmitUiState(this.stage, {this.outcome});

  static const idle = SubmitUiState(SubmitStage.idle);

  final SubmitStage stage;
  final SubmitOutcome? outcome;

  /// The scored attempt once received.
  SubmitReceived? get received => outcome is SubmitReceived ? outcome! as SubmitReceived : null;
}

/// The runner's data and timing service (design spec 5.5). The UI consumes it; it owns:
///
/// - the monotonic clock anchored from the server's numbers,
/// - the event journal, written right after the UI shows an answer selected (the screen never
///   waits for the disk; a failed write is rolled back and shown as "On this phone"),
/// - the debounced cumulative `PUT /api/sessions` sync and `acknowledgedSequence`,
/// - the three save states,
/// - the submit with `pendingSubmission` retry until `endsAt + 120 s`,
/// - the draft that lets a killed process come back to the same question and selections,
/// - the WorkManager backup job and the silent ongoing status.
///
/// Listen to the engine for answer, mark and question changes; use the [ValueListenable]s for
/// the timer, the save pill, the submit stage and the away banner so each rebuilds only itself.
class SessionEngine extends ChangeNotifier {
  SessionEngine._({
    required SessionEngineServices services,
    required SessionDraft draft,
    required SessionClock clock,
    required SessionJournal journal,
  }) : _s = services,
       _draft = draft,
       _clock = clock,
       _journal = journal {
    _syncer = SessionSyncer(
      api: services.api,
      journal: journal,
      sessionId: draft.sessionId,
      enabled: !draft.isTicketMode,
      acknowledgedSequence: draft.acknowledgedSequence,
      debounce: services.syncDebounce,
      timerFactory: services.timerFactory,
      now: services.now,
      onAcknowledged: _onAcknowledged,
      onConflict: () => unawaited(_recoverFromConflict()),
      onStopped: (_) => _updateSaveState(),
    );
    _syncer.status.addListener(_updateSaveState);
    _lastAckAt = draft.lastAckAtMs == null ? null : DateTime.fromMillisecondsSinceEpoch(draft.lastAckAtMs!);
    final lastIndex = draft.view.questions.length - 1;
    _index = _indexFromJournal() ?? (lastIndex < 0 ? 0 : draft.currentIndex.clamp(0, lastIndex));
    _visited = {...draft.visited};
    _marked = {...draft.marked};
    final remainingMs = clock.remainingMs;
    _warned5 = remainingMs <= 5 * 60 * 1000;
    _warned1 = remainingMs <= 60 * 1000;
    remaining = ValueNotifier(_displayRemaining());
    _updateSaveState();
  }

  /// Starts a new session from a session view the server just returned.
  static Future<SessionEngine> start({
    required SessionEngineServices services,
    required SessionView view,
    required String subject,
    required String mode,
    required int count,
    required String generationKey,
    String? chapter,
    String? difficulty,
    int? mockNumber,
  }) async {
    final clock = services.clockFactory?.call() ?? SessionClock();
    clock.anchor(
      serverNowMs: view.serverNowMs,
      startedAtMs: view.startedAt.millisecondsSinceEpoch,
      expiresAtMs: view.expiresAt.millisecondsSinceEpoch,
    );
    final draftKey = SessionDraft.keyFor(
      userId: services.userId,
      subject: subject,
      chapter: chapter,
      count: count,
      difficulty: difficulty,
      mode: mode,
    );
    await _settleEarlierDraft(services, draftKey, newSessionId: view.meta.sessionId.isNotEmpty ? view.meta.sessionId : view.id);
    final draft = SessionDraft(
      draftKey: draftKey,
      userId: services.userId,
      view: view,
      generationKey: generationKey,
      subject: subject,
      mode: mode,
      count: count,
      chapter: chapter,
      difficulty: difficulty,
      mockNumber: mockNumber,
      startedRefWallMs: clock.startedRefWallMs,
      endsAtWallMs: clock.endsAtWallMs,
    );
    await services.drafts.save(draft);
    final journal = await SessionJournal.open(services.db, userId: services.userId, sessionId: draft.sessionId, now: services.now);
    final engine = SessionEngine._(services: services, draft: draft, clock: clock, journal: journal);
    if (view.questions.isNotEmpty) {
      // The first event is a visit on question 1.
      await journal.recordVisit(view.questions.first.id, clock);
      engine._visited.add(view.questions.first.id);
    }
    engine._begin();
    return engine;
  }

  /// The draft table holds one row per selection, so saving a new session would overwrite an
  /// earlier one whose answers were never acknowledged. Try to send those first.
  ///
  /// Nothing here blocks the new session: the new paper's clock is already running on the
  /// server, so the earlier submit gets at most [SessionEngineServices.earlierDraftWait] and then
  /// carries on in the background. An offline phone, a retryable failure, a local write or an
  /// unexpected response say nothing about the new session. The earlier draft is moved to its
  /// own archive row before anything is sent, so nothing the submit writes later can touch the
  /// new session's row: a rejected or still-owed draft keeps its answers, and a still-owed one
  /// keeps `pendingSubmission` so the backup job (which finds drafts by session id) still sends
  /// it while the server's window is open.
  static Future<void> _settleEarlierDraft(SessionEngineServices services, String draftKey, {required String newSessionId}) async {
    final SessionDraft? earlier;
    try {
      earlier = await services.drafts.byKey(draftKey);
    } on Object {
      return;
    }
    if (earlier == null || earlier.sessionId == newSessionId) return;
    var owed = earlier.pendingSubmission && !earlier.windowClosed && !earlier.rejected;
    // A paper that was never submitted (the app was killed, or the student left it) still owes
    // its answers when some exist only on this phone, flag or not: the backup job may not have
    // run yet. Past its deadline it is sent now; before it, it is kept and the job sends it.
    var keepForJob = false;
    if (!owed && !earlier.rejected && !earlier.windowClosed && await _hasUnsentAnswers(services, earlier)) {
      if (services.now().millisecondsSinceEpoch >= earlier.endsAtWallMs) {
        owed = true;
      } else {
        keepForJob = true;
      }
    }
    if (!owed && !keepForJob && !earlier.rejected) return;
    final archiveKey = SessionDraftRepository.archiveKeyOf(earlier.sessionId);
    try {
      await services.drafts.archive(earlier);
    } on Object {
      // Best effort; the journal rows are kept either way, and the submit below writes the
      // draft under its archive key.
    }
    if (keepForJob) {
      // The job finds the draft by session id and submits it near its deadline, as it does for
      // a paper left in the background.
      try {
        await services.scheduler.scheduleSubmit(
          userId: services.userId,
          sessionId: earlier.sessionId,
          draftKey: archiveKey,
          runAt: DateTime.fromMillisecondsSinceEpoch(earlier.endsAtWallMs - 90 * 1000),
        );
      } on Object {
        // The answers stay archived on the phone, journal intact.
      }
      return;
    }
    if (!owed) return;
    final archived = SessionDraft.fromJson(asJson(jsonDecode(jsonEncode({...earlier.toJson(), 'draftKey': archiveKey}))));
    final sending = _submitEarlier(services, archived);
    SubmitOutcome? outcome;
    try {
      outcome = await sending.timeout(services.earlierDraftWait);
    } on TimeoutException {
      outcome = null; // Still in flight: it finishes in the background.
    }
    if (outcome is SubmitReceived || outcome is SubmitRejected || outcome is SubmitWindowClosed) return;
    // Still owed (offline, slow, or not finished yet). The earlier engine queued the backup job
    // when its submit ended pending; queue it again under the archive key so a lost or finished
    // job cannot leave the answers unsent. It waits for a network and replaces any job already
    // queued for that session.
    try {
      await services.scheduler.scheduleSubmit(userId: services.userId, sessionId: archived.sessionId, draftKey: archiveKey, runAt: services.now());
    } on Object {
      // The answers stay archived on the phone, flag and journal intact.
    }
  }

  /// True when [draft] has answers the server does not hold: every answer in ticket mode, the
  /// unacknowledged ones otherwise (a cleared answer counts). A journal that cannot be read
  /// counts as unsent, so the draft is kept rather than overwritten.
  static Future<bool> _hasUnsentAnswers(SessionEngineServices services, SessionDraft draft) async {
    try {
      final journal = await SessionJournal.open(services.db, userId: draft.userId, sessionId: draft.sessionId, now: services.now);
      if (draft.isTicketMode) return journal.answers.isNotEmpty;
      return journal.unsyncedQuestionIds(draft.acknowledgedSequence).isNotEmpty;
    } on Object {
      return true;
    }
  }

  /// Sends an archived earlier draft. Never throws: a failure leaves it archived and owed.
  static Future<SubmitOutcome?> _submitEarlier(SessionEngineServices services, SessionDraft archived) async {
    try {
      final journal = await SessionJournal.open(services.db, userId: services.userId, sessionId: archived.sessionId, now: services.now);
      final clock = services.clockFactory?.call() ?? SessionClock();
      clock.restore(startedRefWallMs: archived.startedRefWallMs, endsAtWallMs: archived.endsAtWallMs);
      return await services.submitter.submit(draft: archived, journal: journal, durationMs: clock.durationMs);
    } on Object {
      return null;
    }
  }

  /// Brings a session back after a process kill or from Today's Continue key. Returns null when
  /// the draft can no longer resume (see [resumableDraft]).
  static Future<SessionEngine?> restore({required SessionEngineServices services, required SessionDraft draft}) async {
    if (!resumableDraft(draft, sessionId: draft.sessionId, nowMs: services.now().millisecondsSinceEpoch)) return null;
    final clock = services.clockFactory?.call() ?? SessionClock();
    clock.restore(startedRefWallMs: draft.startedRefWallMs, endsAtWallMs: draft.endsAtWallMs);
    final journal = await SessionJournal.open(services.db, userId: services.userId, sessionId: draft.sessionId, now: services.now);
    final engine = SessionEngine._(services: services, draft: draft, clock: clock, journal: journal);
    // Time passed while the app was away: one visit for the question the student returns to.
    final qs = draft.view.questions;
    if (qs.isNotEmpty && engine._index < qs.length && !clock.isOver) {
      final qid = qs[engine._index].id;
      await journal.recordVisit(qid, clock);
      engine._visited.add(qid);
    }
    engine._begin();
    // Answers written before the kill (or while away from the runner) have no PUT queued: no
    // tap, resume or reconnect event comes on a fresh open, so send them now.
    if (engine._syncer.hasUnacknowledged) engine._syncer.retryNow();
    unawaited(engine._reanchorFromServer());
    return engine;
  }

  final SessionEngineServices _s;
  final SessionClock _clock;
  final SessionJournal _journal;
  late final SessionSyncer _syncer;
  late final SessionHeartbeat _heartbeat = SessionHeartbeat(_s.db, userId: _s.userId, now: _s.now);
  SessionDraft _draft;

  /// Answers the student has tapped whose journal write has not finished: the screen shows them
  /// at once, and each is removed when its write lands or is rolled back when it fails.
  final Map<String, _OptimisticAnswer> _optimistic = {};
  int _optimisticToken = 0;

  /// The last answer write failed: the pill reads "On this phone" until a write lands again.
  bool _writeFailed = false;

  late int _index;
  late Set<String> _visited;
  late Set<String> _marked;
  DateTime? _lastAckAt;
  Timer? _ticker;
  Timer? _draftTimer;
  int _tickCount = 0;
  bool _warned5 = false;
  bool _warned1 = false;
  bool _timeUpFired = false;
  bool _submitStarted = false;
  bool _timedOut = false;
  bool _disposed = false;
  DateTime? _pausedAt;

  final StreamController<SessionWarning> _warnings = StreamController<SessionWarning>.broadcast();

  /// Time left, rounded up to whole seconds. Changes once a second: put it in its own
  /// `RepaintBoundary` so only one Text repaints.
  late final ValueNotifier<Duration> remaining;

  /// The save pill. Rebuilds only when the state or the unsynced count changes.
  final ValueNotifier<SaveSnapshot> saveState = ValueNotifier(SaveSnapshot.initial);

  final ValueNotifier<SubmitUiState> submitState = ValueNotifier(SubmitUiState.idle);

  /// Set on resume after a time away; clear it with [dismissAway] once the banner was shown.
  final ValueNotifier<AwayInfo?> away = ValueNotifier(null);

  /// One-time warnings: 5 minutes, 1 minute and time up.
  Stream<SessionWarning> get warnings => _warnings.stream;

  // Read-only view of the session.
  SessionDraft get draft => _draft;
  List<SessionQuestion> get questions => _draft.view.questions;
  int get currentIndex => _index;
  SessionQuestion get currentQuestion => questions[_index];
  bool get isTicketMode => _draft.isTicketMode;

  /// The latest answer per question (option index), including taps still being written. A
  /// cleared answer is absent.
  Map<String, int> get answers {
    final out = Map<String, int>.of(_journal.answers);
    for (final e in _optimistic.entries) {
      final option = e.value.option;
      option == null ? out.remove(e.key) : out[e.key] = option;
    }
    return out;
  }

  int? answerFor(String qid) => _optimistic.containsKey(qid) ? _optimistic[qid]!.option : _journal.answers[qid];
  int get answeredCount => answers.length;
  int get notAnsweredCount => questions.length - answeredCount;
  Set<String> get marked => Set.unmodifiable(_marked);
  Set<String> get visited => Set.unmodifiable(_visited);
  int get markedCount => _marked.length;

  /// Questions with an answer the server has not acknowledged (hollow dot on the palette).
  Set<String> get unsyncedQuestionIds => {..._journal.unsyncedQuestionIds(_syncer.acknowledgedSequence), ..._optimistic.keys};

  /// Highest event the server confirmed.
  int get acknowledgedSequence => _syncer.acknowledgedSequence;

  /// The journal's answered count as of the acknowledgement (the "31 answers sent" figure).
  int get answersAcknowledged => _journal.answeredCountThrough(_syncer.acknowledgedSequence);

  /// Wall-clock deadline of the session.
  DateTime get endsAt => DateTime.fromMillisecondsSinceEpoch(_clock.endsAtWallMs);

  /// Answering is allowed until the clock hits zero or a submit starts.
  bool get canAnswer => !_disposed && !_submitStarted && !_clock.isOver && !_draft.pendingSubmission;

  /// The submit was started because time ran out (analytics `outcome: timed_out`).
  bool get endedByTimeUp => _timedOut;

  /// Time left in milliseconds, for callers that need more than the ticking [remaining].
  int get remainingMs => _clock.remainingMs;

  // Actions.

  /// Selects [option] for [qid], or clears the answer when null. The screen is told in the same
  /// frame: the answer is held in memory, listeners are notified, and only then is the event
  /// written to the journal. If the write fails the answer is rolled back and the pill reads
  /// "On this phone". Returns false when answering is not allowed or the write failed.
  Future<bool> selectAnswer(String qid, int? option) async {
    if (!canAnswer) return false;
    final token = ++_optimisticToken;
    _optimistic[qid] = _OptimisticAnswer(option, token);
    _notify();
    _updateSaveState();
    SessionEvent? event;
    try {
      event = await _journal.recordAnswer(qid, option, _clock);
    } on Object {
      event = null;
    }
    // A later tap on the same question owns the entry now; only the newest clears it.
    if (_optimistic[qid]?.token == token) _optimistic.remove(qid);
    if (event == null) {
      _writeFailed = true;
      _updateSaveState();
      _notify();
      return false;
    }
    _writeFailed = false;
    _notify();
    _syncer.notifyChanged();
    _updateSaveState();
    _scheduleDraftSave();
    return true;
  }

  /// Moves to question [index] and records a visit for it only. The question changes first;
  /// the visit is written after, and a failed write loses only the visit event.
  Future<void> goTo(int index) async {
    if (index < 0 || index >= questions.length || _disposed) return;
    _index = index;
    final qid = questions[index].id;
    _visited.add(qid);
    _notify();
    _scheduleDraftSave();
    if (!canAnswer) return;
    try {
      await _journal.recordVisit(qid, _clock);
      _syncer.notifyChanged();
    } on Object {
      // The visit event is only a trace of where the student looked.
    }
  }

  void setMarked(String qid, bool value) {
    final changed = value ? _marked.add(qid) : _marked.remove(qid);
    if (!changed) return;
    _notify();
    _scheduleDraftSave();
  }

  void dismissAway() {
    if (!_disposed) away.value = null;
  }

  /// Sends unacknowledged answers now and waits for the call (the student is leaving the
  /// runner). Does nothing in ticket mode or after dispose.
  Future<void> flushAnswers() async {
    if (_disposed) return;
    await _journal.idle();
    await _syncer.flushNow();
  }

  // Lifecycle.

  /// The app went to the background: flush answers now, save the draft, show the silent status
  /// and make sure the backup job is registered.
  Future<void> onPaused() async {
    _pausedAt = _s.now();
    _clock.markPaused();
    // Answers first: the draft then records the acknowledgement that came back.
    await _journal.idle();
    await _syncer.flushNow();
    await flushDraft();
    if (_submitStarted && submitState.value.stage != SubmitStage.received) {
      await _s.status.showSending(_draft);
    } else if (!_submitStarted) {
      await _s.status.showInProgress(_draft);
    }
    await _scheduleBackgroundSubmit();
  }

  /// The app came back: correct the clock for time asleep, hide the status, retry anything
  /// pending and tell the student how long they were away.
  Future<void> onResumed() async {
    // Only time asleep while paused moves the timer; a wall-clock step while answering does not.
    // The server re-anchor below then corrects anything the phone's clocks got wrong.
    _clock.resumeFromPause();
    await _s.status.clear();
    if (_disposed) return;
    final paused = _pausedAt;
    _pausedAt = null;
    if (paused != null) {
      final awayFor = _s.now().difference(paused);
      if (awayFor.inSeconds >= 5) {
        away.value = AwayInfo(duration: awayFor, allSaved: unsyncedQuestionIds.isEmpty && !isTicketMode, unsyncedAnswers: unsyncedQuestionIds.length);
      }
    }
    _tick();
    unawaited(_heartbeat.beat(_draft.sessionId));
    if (_syncer.hasUnacknowledged) _syncer.retryNow();
    unawaited(_resumeAfterBackgroundSubmit());
    unawaited(_reanchorFromServer());
  }

  /// The backup job may have sent this session while the app slept and deleted the draft. The
  /// phone still holds the journal, so run the (idempotent) submit to pick up the attempt
  /// instead of leaving the student answering a session the server already closed.
  Future<void> _resumeAfterBackgroundSubmit() async {
    if (_disposed || _submitStarted) return;
    final stored = await _s.drafts.bySessionId(_draft.sessionId);
    if (stored == null && !_disposed && !_submitStarted) unawaited(submit(timedOut: _clock.isOver));
  }

  /// The network is reachable again.
  void onConnectivityRestored() {
    _syncer.retryNow();
    final stage = submitState.value.stage;
    final retryable = stage == SubmitStage.pending || (stage == SubmitStage.idle && !_submitStarted);
    final open = submissionWindowOpen(endsAtMs: _clock.endsAtWallMs, nowMs: _s.now().millisecondsSinceEpoch);
    if (_draft.pendingSubmission && retryable && open) unawaited(submit());
  }

  // Submit.

  /// Submits once. `Sending` runs from the call until `POST /api/attempts` answers; only a 200
  /// is `received`. On a network failure the answers stay on the phone with `pendingSubmission`
  /// set, and calling again (or the background job) retries until `endsAt + 120 s`.
  Future<SubmitOutcome> submit({bool timedOut = false}) async {
    if (_submitStarted && submitState.value.stage == SubmitStage.sending) {
      return submitState.value.outcome ?? const SubmitPending(ApiError(kind: ApiErrorKind.unknown, code: 'in_flight'));
    }
    _submitStarted = true;
    _timedOut = _timedOut || timedOut;
    _ticker?.cancel();
    unawaited(_heartbeat.clear(_draft.sessionId)); // The backup job may take over from here.
    _setSubmit(const SubmitUiState(SubmitStage.sending));
    _notify();
    // Whatever happens below, the stage leaves `sending`: an unexpected failure is a pending
    // submit (the answers are on the phone and the submit is owed), never a screen with no exit.
    SubmitOutcome outcome;
    try {
      // A tap still being written is part of the paper.
      await _journal.idle();
      try {
        await _syncer.flushNow();
      } on Object {
        // The submit carries the whole log; the events PUT is only a head start.
      }
      _draft = _draft.copyWith(pendingSubmission: true);
      outcome = await _s.submitter.submit(draft: _draft, journal: _journal, durationMs: _clock.durationMs);
    } on Object {
      outcome = const SubmitPending(ApiError(kind: ApiErrorKind.unknown, code: 'unknown'));
    }
    switch (outcome) {
      case SubmitReceived():
        _setSubmit(SubmitUiState(SubmitStage.received, outcome: outcome));
        await _afterOutcome(() async {
          await _s.scheduler.cancelSubmit(_draft.sessionId);
          await _s.status.clear();
        });
      case SubmitPending():
        _setSubmit(SubmitUiState(SubmitStage.pending, outcome: outcome));
        _draft = _draft.copyWith(pendingSubmission: true);
        await _afterOutcome(() => _scheduleBackgroundSubmit(runAt: _s.now()));
      case SubmitWindowClosed():
        _draft = _draft.copyWith(pendingSubmission: false, windowClosed: true);
        _setSubmit(SubmitUiState(SubmitStage.windowClosed, outcome: outcome));
        await _afterOutcome(() async {
          await _s.scheduler.cancelSubmit(_draft.sessionId);
          await _s.status.clear();
        });
      case SubmitRejected():
        _draft = _draft.copyWith(pendingSubmission: false, rejected: true);
        _updateSaveState();
        _setSubmit(SubmitUiState(SubmitStage.rejected, outcome: outcome));
    }
    _notify();
    return outcome;
  }

  /// Housekeeping after the stage is already shown (the scheduler, the status notification): a
  /// failure here never changes what the student sees.
  Future<void> _afterOutcome(Future<void> Function() work) async {
    try {
      await work();
    } on Object {
      // The backup job and the next start tidy up.
    }
  }

  // Internals.

  /// A submit can finish after the screen closed the engine; late results must not touch the
  /// disposed notifiers.
  void _setSubmit(SubmitUiState next) {
    if (!_disposed) submitState.value = next;
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  void _begin() {
    _tick();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
    unawaited(_scheduleBackgroundSubmit());
  }

  Duration _displayRemaining() {
    final ms = _clock.remainingMs;
    return Duration(seconds: (ms + 999) ~/ 1000);
  }

  void _tick() {
    if (_disposed) return;
    _tickCount++;
    if (!_submitStarted && _tickCount % SessionHeartbeat.interval.inSeconds == 1) unawaited(_heartbeat.beat(_draft.sessionId));
    final next = _displayRemaining();
    if (remaining.value != next) remaining.value = next;
    final ms = _clock.remainingMs;
    if (!_warned5 && ms <= 5 * 60 * 1000) {
      _warned5 = true;
      _warnings.add(SessionWarning.fiveMinutes);
    }
    if (!_warned1 && ms <= 60 * 1000) {
      _warned1 = true;
      _warnings.add(SessionWarning.oneMinute);
    }
    if (ms == 0 && !_timeUpFired) {
      _timeUpFired = true;
      _warnings.add(SessionWarning.timeUp);
      // At zero the app stops answering, flushes and submits once.
      if (!_submitStarted) unawaited(submit(timedOut: true));
    }
  }

  int? _indexFromJournal() {
    final events = _journal.events;
    for (var i = events.length - 1; i >= 0; i--) {
      if (events[i].type != SessionEvent.visit) continue;
      final idx = _draft.view.questions.indexWhere((q) => q.id == events[i].qid);
      if (idx >= 0) return idx;
    }
    return null;
  }

  void _onAcknowledged(int ack, DateTime at) {
    _lastAckAt = at;
    _draft = _draft.copyWith(acknowledgedSequence: ack, lastAckAtMs: at.millisecondsSinceEpoch);
    _updateSaveState();
    _scheduleDraftSave();
    _notify();
  }

  void _updateSaveState() {
    if (_disposed) return;
    final unsynced = unsyncedQuestionIds.length;
    final derived = deriveSaveState(ticketMode: isTicketMode, unsyncedAnswers: unsynced, syncStatus: _syncer.status.value, lastAckAt: _lastAckAt);
    // The last write to the journal failed: say so, with the phone glyph.
    final next = _writeFailed && !isTicketMode
        ? SaveSnapshot(state: SaveState.onThisPhone, unsyncedAnswers: unsynced, lastAckAt: _lastAckAt)
        : derived;
    if (saveState.value != next) saveState.value = next;
    _s.onPendingWork?.call('session:${_draft.sessionId}', next.unsyncedAnswers > 0 || _draft.pendingSubmission);
  }

  void _scheduleDraftSave() {
    if (_disposed) return;
    _draftTimer?.cancel();
    _draftTimer = Timer(const Duration(milliseconds: 300), () => unawaited(flushDraft()));
  }

  /// Writes the draft now.
  Future<void> flushDraft() async {
    _draftTimer?.cancel();
    _draftTimer = null;
    // The submitter deleted the draft once the server took the submit; writing it again would
    // bring back a finished session as resumable (a late debounce, a pause, the runner closing).
    if (submitState.value.stage == SubmitStage.received) return;
    _draft = _draft.copyWith(
      visited: _visited,
      marked: _marked,
      currentIndex: _index,
      startedRefWallMs: _clock.startedRefWallMs,
      endsAtWallMs: _clock.endsAtWallMs,
    );
    await _s.drafts.save(_draft);
  }

  Future<void> _scheduleBackgroundSubmit({DateTime? runAt}) {
    // About 90 seconds before the end, so a killed app still sends before the window closes.
    final target = runAt ?? DateTime.fromMillisecondsSinceEpoch(_clock.endsAtWallMs - 90 * 1000);
    return _s.scheduler.scheduleSubmit(userId: _s.userId, sessionId: _draft.sessionId, draftKey: _draft.draftKey, runAt: target);
  }

  /// Durable sessions only: asks the server for its clock and corrects ours. A server that no
  /// longer has the session active means time is up.
  Future<void> _reanchorFromServer() async {
    if (isTicketMode || _disposed || _submitStarted) return;
    try {
      final view = await _s.api.resume(_draft.sessionId);
      if (_disposed) return;
      if (view.state != null && view.state != 'active') {
        _forceTimeUp();
        return;
      }
      _clock.anchor(
        serverNowMs: view.serverNowMs,
        startedAtMs: view.startedAt.millisecondsSinceEpoch,
        expiresAtMs: view.expiresAt.millisecondsSinceEpoch,
      );
      _tick();
      _scheduleDraftSave();
    } on ApiError catch (e) {
      if (e.hasCode(ApiCodes.sessionExpired)) _forceTimeUp();
      // Any other failure (offline) keeps the local clock, which is already correct.
    }
  }

  void _forceTimeUp() {
    if (_timeUpFired) return;
    _timeUpFired = true;
    _warnings.add(SessionWarning.timeUp);
    if (!_submitStarted) unawaited(submit(timedOut: true));
  }

  /// `EVENT_CONFLICT`: the server holds a different log. Resume from it and rebuild.
  Future<void> _recoverFromConflict() async {
    try {
      final view = await _s.api.resume(_draft.sessionId);
      // Answers typed on this phone that the server never acknowledged must survive the
      // rebuild: the server's log wins, then the differing local answers are appended again.
      final local = Map<String, int>.of(_journal.answers);
      final unsynced = _journal.unsyncedQuestionIds(_syncer.acknowledgedSequence);
      await _journal.replaceWith(view.events);
      _syncer.resumeAfterConflict(acknowledgedSequence: _journal.lastSeq);
      final rebuilt = _journal.answers;
      var restored = false;
      for (final qid in unsynced) {
        if (local[qid] == rebuilt[qid]) continue;
        if (await _journal.recordAnswer(qid, local[qid], _clock) != null) restored = true;
      }
      if (restored) _syncer.notifyChanged();
      _updateSaveState();
      _notify();
    } on ApiError {
      // Try again on the next change or retry; the answers are safe in the local journal.
    }
  }

  /// Stops timers and listeners. Does not touch the draft: leaving never discards.
  @override
  void dispose() {
    if (_disposed) return;
    _disposed = true;
    _ticker?.cancel();
    _draftTimer?.cancel();
    _syncer.status.removeListener(_updateSaveState);
    _syncer.dispose();
    unawaited(_heartbeat.clear(_draft.sessionId));
    _s.onPendingWork?.call('session:${_draft.sessionId}', false);
    _warnings.close();
    remaining.dispose();
    saveState.dispose();
    submitState.dispose();
    away.dispose();
    super.dispose();
  }
}

/// A tapped answer waiting for its journal write ([option] null is a cleared answer). The token
/// tells the newest tap on a question from an older one still being written.
class _OptimisticAnswer {
  const _OptimisticAnswer(this.option, this.token);

  final int? option;
  final int token;
}
