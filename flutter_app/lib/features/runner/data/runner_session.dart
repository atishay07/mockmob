import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../../core/models/question.dart';
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

  Future<bool> selectAnswer(String qid, int? option);
  Future<void> goTo(int index);
  void setMarked(String qid, bool value);
  Future<SubmitOutcome> submit({bool timedOut = false});
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
  EngineRunnerSession(this.engine) : submitOwedOnOpen = engine.draft.pendingSubmission;

  final SessionEngine engine;

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
  String? get chapter => engine.draft.chapter ?? (engine.questions.isEmpty ? null : engine.currentQuestion.chapter);
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
  Future<bool> selectAnswer(String qid, int? option) => engine.selectAnswer(qid, option);
  @override
  Future<void> goTo(int index) => engine.goTo(index);
  @override
  void setMarked(String qid, bool value) => engine.setMarked(qid, value);
  @override
  Future<SubmitOutcome> submit({bool timedOut = false}) => engine.submit(timedOut: timedOut);
  @override
  void dismissAway() => engine.dismissAway();
  @override
  Future<void> onPaused() => engine.onPaused();
  @override
  Future<void> onResumed() => engine.onResumed();
  @override
  void onConnectivityRestored() => engine.onConnectivityRestored();

  @override
  Future<void> close() async {
    if (_closed) return;
    _closed = true;
    try {
      // Bounded: leaving must never hang on a slow network. Whatever is not acknowledged stays
      // in the journal and goes with the next sync or the backup submit job.
      await engine.flushAnswers().timeout(const Duration(seconds: 6));
    } on Object {
      // Offline or slow; the answers are on this phone.
    }
    try {
      await engine.flushDraft();
    } on Object {
      // The draft was written on every change already.
    }
    engine.dispose();
  }
}
