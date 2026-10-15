import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../../core/models/question.dart';
import '../../../core/repositories/session_draft_repository.dart';
import '../../../core/sync/session/save_state.dart';
import '../../../core/sync/session/session_engine.dart';
import '../../../core/sync/session/session_submitter.dart';

/// What the runner screens read and call. [EngineRunnerSession] forwards every member to the
/// core [SessionEngine], which owns the clock, the journal, sync and submit; the screens never
/// reimplement any of that. Widget tests and goldens supply a scripted fake.
///
/// Listen to the session itself for answers, marks and the current question; the
/// [ValueListenable]s rebuild only the timer, the save glyph, the submit stage and the banner.
abstract class RunnerSession implements Listenable {
  String get sessionId;

  /// `full`, `nta` or `quick` (chapter practice runs as `quick`).
  String get mode;
  String get subject;

  /// The chapter a chapter practice was started for; null for a mixed paper (the question's own
  /// chapter then shows in the runner's header, never in the paper's name).
  String? get chapter;
  int? get mockNumber;
  bool get isTicketMode;

  /// Full and NTA-style mocks: the timer shows, the result opens as the sealed sheet.
  bool get isMock => mode == 'full' || mode == 'nta';

  List<SessionQuestion> get questions;
  int get currentIndex;
  int? answerFor(String qid);
  int get answeredCount;
  Set<String> get marked;
  Set<String> get visited;
  Set<String> get unsyncedQuestionIds;
  bool get canAnswer;
  DateTime get endsAt;
  bool get endedByTimeUp;

  /// The draft already owed a submit when the runner opened (killed mid-submit).
  bool get submitOwedOnOpen;

  ValueListenable<Duration> get remaining;
  ValueListenable<SaveSnapshot> get saveState;
  ValueListenable<SubmitUiState> get submitState;
  ValueListenable<AwayInfo?> get away;
  Stream<SessionWarning> get warnings;

  /// Options the student has crossed out. Shown for this sitting only and never part of the
  /// answer; each cross-out is recorded with the session for the result's analysis after submit.
  StrikeBook get strikes;

  Future<bool> selectAnswer(String qid, int? option);

  /// Moves to question [index], reached by [via] (a `SessionVia`: next, previous, palette, swipe).
  Future<void> goTo(int index, {String? via});
  void setMarked(String qid, bool value);

  /// [endReason] names how the paper ended when it is not the student's submit or time up (the
  /// NTA third warning: `SessionEndReason.ntaStrikes`).
  Future<SubmitOutcome> submit({bool timedOut = false, String? endReason});
  void dismissAway();

  Future<void> onPaused();
  Future<void> onResumed();
  void onConnectivityRestored();

  /// The student leaves the runner: send what is waiting and write the draft, then stop the
  /// timers. Never discards anything.
  Future<void> close();
}

/// The production [RunnerSession]: a thin forwarder over the core engine.
class EngineRunnerSession implements RunnerSession {
  EngineRunnerSession(this.engine, {this.drafts}) : submitOwedOnOpen = engine.draft.pendingSubmission;

  final SessionEngine engine;

  /// Where drafts live. Closing reads the row before it writes, so a leaving engine never writes
  /// over a newer session that took the same selection's row (practice-02).
  final SessionDraftRepository? drafts;

  @override
  final bool submitOwedOnOpen;

  bool _closed = false;

  @override
  void addListener(VoidCallback listener) => engine.addListener(listener);

  @override
  void removeListener(VoidCallback listener) {
    if (!_closed) engine.removeListener(listener);
  }

  @override
  String get sessionId => engine.draft.sessionId;
  @override
  String get mode => engine.draft.mode;
  @override
  String get subject => engine.draft.subject;
  @override
  String? get chapter => engine.draft.chapter;
  @override
  int? get mockNumber => engine.draft.mockNumber;
  @override
  bool get isTicketMode => engine.isTicketMode;
  @override
  bool get isMock => mode == 'full' || mode == 'nta';
  @override
  List<SessionQuestion> get questions => engine.questions;
  @override
  int get currentIndex => engine.currentIndex;
  @override
  int? answerFor(String qid) => engine.answerFor(qid);
  @override
  int get answeredCount => engine.answeredCount;
  @override
  Set<String> get marked => engine.marked;
  @override
  Set<String> get visited => engine.visited;
  @override
  Set<String> get unsyncedQuestionIds => engine.unsyncedQuestionIds;
  @override
  bool get canAnswer => engine.canAnswer;
  @override
  DateTime get endsAt => engine.endsAt;
  @override
  bool get endedByTimeUp => engine.endedByTimeUp;
  @override
  ValueListenable<Duration> get remaining => engine.remaining;
  @override
  ValueListenable<SaveSnapshot> get saveState => engine.saveState;
  @override
  ValueListenable<SubmitUiState> get submitState => engine.submitState;
  @override
  ValueListenable<AwayInfo?> get away => engine.away;
  @override
  Stream<SessionWarning> get warnings => engine.warnings;
  @override
  late final StrikeBook strikes = StrikeBook(onChange: engine.recordStrike);

  @override
  Future<bool> selectAnswer(String qid, int? option) => engine.selectAnswer(qid, option);
  @override
  Future<void> goTo(int index, {String? via}) => engine.goTo(index, via: via);
  @override
  void setMarked(String qid, bool value) => engine.setMarked(qid, value);
  @override
  Future<SubmitOutcome> submit({bool timedOut = false, String? endReason}) => engine.submit(timedOut: timedOut, endReason: endReason);
  @override
  void dismissAway() => engine.dismissAway();
  @override
  Future<void> onPaused() async {
    try {
      await engine.onPaused();
    } on Object {
      // A failure sending answers (anything past an ApiError) must not skip the draft: going to the
      // background is when a kill is most likely, and the place in the paper is what comes back.
      await _writeDraft();
    }
  }

  @override
  Future<void> onResumed() => engine.onResumed();
  @override
  void onConnectivityRestored() => engine.onConnectivityRestored();

  /// Closes still under way, by session id. Opening the same session again waits for its close
  /// ([closed]), so an old engine never writes its stale draft over a new one's, nor clears the
  /// heartbeat the new one owns.
  static final Map<String, _Closing> _closing = {};

  /// Waits until any close of [sessionId] has finished, cutting its wait for the server short:
  /// what is not acknowledged stays in the journal, and the reopened engine sends it.
  static Future<void> closed(String sessionId) async {
    final closing = _closing[sessionId];
    if (closing == null) return;
    if (!closing.hurry.isCompleted) closing.hurry.complete();
    await closing.done.future;
  }

  /// Waits until every close of a session saved under [draftKey] has finished (cutting its wait for
  /// the server short), so a new session with the same selection never starts while an older one is
  /// still about to write its draft (ROBUSTNESS practice-02). Returns at once when none is closing.
  static Future<void> closedUnderKey(String draftKey) async {
    final waiting = [
      for (final c in _closing.values)
        if (c.draftKey == draftKey) c,
    ];
    for (final closing in waiting) {
      if (!closing.hurry.isCompleted) closing.hurry.complete();
    }
    for (final closing in waiting) {
      await closing.done.future;
    }
  }

  /// Writes the draft, unless the row now belongs to a different session (a new practice with the
  /// same selection started while this one was still closing). A row that cannot be read is
  /// written as before: the draft is never left unsaved for want of a check.
  Future<void> _writeDraft() async {
    try {
      final repo = drafts;
      if (repo != null) {
        final stored = await repo.byKey(engine.draft.draftKey);
        if (stored != null && stored.sessionId != sessionId) return;
      }
      await engine.flushDraft();
    } on Object {
      // The draft was written on every change already.
    }
  }

  /// An acknowledgement that came back after the engine was disposed: written onto the stored row
  /// by itself, never the whole draft (a newer engine of the same session may have moved the place
  /// on), so reopening does not show answers the server already holds as unsent (practice-05).
  Future<void> _persistLateAck() async {
    try {
      final repo = drafts;
      if (repo == null) return;
      final ack = engine.draft.acknowledgedSequence;
      final stored = await repo.byKey(engine.draft.draftKey);
      if (stored == null || stored.sessionId != sessionId || ack <= stored.acknowledgedSequence) return;
      await repo.save(stored.copyWith(acknowledgedSequence: ack, lastAckAtMs: engine.draft.lastAckAtMs));
    } on Object {
      // The next sync acknowledges again.
    }
  }

  @override
  Future<void> close() async {
    if (_closed) return;
    _closed = true;
    final id = sessionId;
    final closing = _Closing(engine.draft.draftKey);
    _closing[id] = closing;
    try {
      // Never throws, so a late failure cannot become an unhandled error after this returns.
      final flushing = engine.flushAnswers().then<void>((_) {}, onError: (Object _) {});
      var flushed = false;
      unawaited(flushing.whenComplete(() => flushed = true));
      try {
        // Bounded: leaving must never hang on a slow network. Whatever is not acknowledged stays
        // in the journal and goes with the next sync or the backup submit job.
        await Future.any<void>([flushing.timeout(const Duration(seconds: 6)), closing.hurry.future]);
      } on Object {
        // Offline or slow; the answers are on this phone.
      }
      await _writeDraft();
      // The PUT is still out: when it comes back its acknowledgement is written (only that).
      if (!flushed) unawaited(flushing.then((_) => _persistLateAck()));
      engine.dispose();
    } finally {
      if (identical(_closing[id], closing)) _closing.remove(id);
      closing.done.complete();
    }
  }
}

class _Closing {
  _Closing(this.draftKey);

  final String draftKey;
  final Completer<void> hurry = Completer<void>();
  final Completer<void> done = Completer<void>();
}

/// The options crossed out on each question (a scratch mark on the paper, not an answer). The set
/// lives in memory for this sitting; [onChange] hears each cross-out and each option brought back,
/// so the session records it for the result's analysis after submit (Mistake Lab v4 spec 6, item
/// 4). It never touches the answer or the score.
class StrikeBook extends ChangeNotifier {
  StrikeBook({this.onChange});

  /// Told of every change: the question, the served option and whether it is now crossed out.
  final void Function(String qid, int option, bool on)? onChange;

  final Map<String, Set<int>> _struck = {};
  bool _used = false;

  /// True once the student has crossed anything out in this sitting (the hint then goes).
  bool get used => _used;

  bool isStruck(String qid, int option) => _struck[qid]?.contains(option) ?? false;

  /// The options crossed out on [qid], in order.
  List<int> struckOn(String qid) => (_struck[qid]?.toList() ?? [])..sort();

  /// Crosses [option] out, or brings it back when it is already crossed out.
  void toggle(String qid, int option) {
    final set = _struck.putIfAbsent(qid, () => <int>{});
    final on = !set.remove(option);
    if (on) set.add(option);
    _used = true;
    notifyListeners();
    onChange?.call(qid, option, on);
  }

  /// Brings [option] back (picking a crossed-out option un-crosses it).
  void restore(String qid, int option) {
    if (_struck[qid]?.remove(option) ?? false) {
      notifyListeners();
      onChange?.call(qid, option, false);
    }
  }
}
