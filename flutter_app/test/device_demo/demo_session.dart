// A demo exam or practice session: the fixture runner session with a clock that really runs
// (it counts down from the moment the paper opens, from `endsAt`, as the real engine does; the
// 5 and 1 minute warnings, time up), and a submit that marks the answers given, adds the
// paper to the record at that moment and acknowledges it, as the server would.
// ignore_for_file: depend_on_referenced_packages
import 'dart:async';

import 'package:clock/clock.dart';
import 'package:mockmob/core/models/session.dart';
import 'package:mockmob/core/models/session_draft.dart';
import 'package:mockmob/core/repositories/local_scope.dart' show LocalScope;
import 'package:mockmob/core/repositories/session_draft_repository.dart';
import 'package:mockmob/core/sync/session/session_engine.dart';
import 'package:mockmob/core/sync/session/session_submitter.dart';

import '../unit/runner/support/fake_session.dart' as runner;
import 'demo_book.dart';
import 'demo_questions.dart';

final Map<String, DemoSession> demoSessions = {};

/// The one open paper's draft, as the real engine keeps it in `session_draft`: written when a
/// paper starts, written again when the student leaves it, and gone once it is submitted. It
/// feeds `latestSessionDraftProvider`, so the bar's Resume capsule, Today's resume hero and the
/// Start sheet's Resume row all show in the demo. Demo only: the real app writes real drafts.
final DemoDrafts demoDrafts = DemoDrafts();

class DemoDrafts {
  SessionDraft? _latest;
  final StreamController<SessionDraft?> _changes = StreamController<SessionDraft?>.broadcast();

  SessionDraft? get latest => _latest;

  /// The current draft, then every change.
  Stream<SessionDraft?> watch() => Stream<SessionDraft?>.multi((out) {
    out.add(_latest);
    final sub = _changes.stream.listen(out.add);
    out.onCancel = sub.cancel;
  });

  /// Records [session] as the open paper, with the position and answers it has now.
  void open(DemoSession session) => _set(session.toDraft());

  /// Drops the draft of [sessionId] (it was submitted), unless a newer paper has replaced it.
  void clear(String sessionId) {
    if (_latest?.sessionId == sessionId) _set(null);
  }

  void _set(SessionDraft? draft) {
    _latest = draft;
    _changes.add(draft);
  }
}

/// The answer count Start, Today and the bar read for a draft: the demo session's own answers
/// (the real repository reads them from the journal, which the demo's sessions do not write).
class DemoDraftRepository extends SessionDraftRepository {
  DemoDraftRepository(super.scope);

  @override
  Future<DraftSummary> summaryOf(SessionDraft draft) async {
    final answered = demoSessions[draft.sessionId]?.answers.length ?? 0;
    return DraftSummary(answered: answered, acknowledgedAnswered: answered, total: draft.view.questions.length);
  }
}

class DemoSession extends runner.FakeRunnerSession {
  DemoSession(this._id, {super.questions, super.mode, super.subject, super.chapter, super.remaining, super.endsAt}) {
    nextOutcome = null;
    // As the real engine does: a paper that starts with 5 minutes or less never warns about it.
    final left = endsAt.difference(clock.now());
    _warnedFive = left <= const Duration(minutes: 5, seconds: 2);
    _warnedOne = left <= const Duration(minutes: 1, seconds: 2);
    _syncRemaining(left);
    _tick = Timer.periodic(const Duration(milliseconds: 250), (_) => _onTick());
    demoDrafts.open(this);
  }

  final String _id;
  Timer? _tick;
  bool _warnedFive = false;
  bool _warnedOne = false;

  @override
  String get sessionId => _id;

  String get resultId => '$_id-result';

  /// The clock shows whole seconds, rounded up, so a paper opens on its full length and the
  /// digits change once a second. The deadline is `endsAt` and nothing else.
  void _syncRemaining(Duration left) {
    final seconds = left.isNegative ? 0 : (left.inMilliseconds / 1000).ceil();
    final next = Duration(seconds: seconds);
    if (remaining.value != next) remaining.value = next;
  }

  void _onTick() {
    final left = endsAt.difference(clock.now());
    _syncRemaining(left);
    if (!_warnedFive && left <= const Duration(minutes: 5) && left > const Duration(minutes: 1)) {
      _warnedFive = true;
      warningController.add(SessionWarning.fiveMinutes);
    }
    if (!_warnedOne && left <= const Duration(minutes: 1) && left > Duration.zero) {
      _warnedOne = true;
      warningController.add(SessionWarning.oneMinute);
    }
    if (left <= Duration.zero) {
      _tick?.cancel();
      warningController.add(SessionWarning.timeUp);
      unawaited(submit(timedOut: true));
    }
  }

  /// The draft the real engine would have stored for this paper right now.
  SessionDraft toDraft() {
    final now = clock.now().millisecondsSinceEpoch;
    return SessionDraft(
      draftKey: SessionDraft.keyFor(userId: 'u1', subject: subject, chapter: chapter, count: questions.length, mode: mode),
      userId: 'u1',
      view: SessionView(
        id: _id,
        startedAt: clock.now().toUtc(),
        expiresAt: endsAt.toUtc(),
        serverNowMs: now,
        questions: questions,
        meta: SessionMeta(sessionId: _id, mode: mode, requestedCount: questions.length),
      ),
      generationKey: 'demo-$_id',
      subject: subject,
      mode: mode,
      count: questions.length,
      chapter: chapter,
      mockNumber: mockNumber,
      startedRefWallMs: now,
      endsAtWallMs: endsAt.millisecondsSinceEpoch,
      visited: visited,
      marked: marked,
      currentIndex: currentIndex,
      updatedAtMs: now,
    );
  }

  @override
  Future<SubmitOutcome> submit({bool timedOut = false}) async {
    if (submitState.value.stage == SubmitStage.received) return submitState.value.outcome!;
    _tick?.cancel();
    demoDrafts.clear(_id);
    submitState.value = const SubmitUiState(SubmitStage.sending);
    await Future<void>.delayed(const Duration(milliseconds: 800));
    final at = clock.now();
    if (demoBook.detail(resultId) == null) {
      demoBook.record(
        demoPracticeDetail(id: resultId, subject: subject, questions: questions, answers: Map.of(answers), completedAt: at.toUtc(), mode: mode),
        at,
      );
    }
    nextOutcome = SubmitReceived(attempt: {'id': resultId}, receivedAt: at);
    return super.submit(timedOut: timedOut);
  }

  /// The runner opened this paper again (Resume): the clock runs on from where the deadline is.
  void resumeClock() {
    final submitted = submitState.value.stage == SubmitStage.sending || submitState.value.stage == SubmitStage.received;
    if (submitted || (_tick?.isActive ?? false)) return;
    _tick = Timer.periodic(const Duration(milliseconds: 250), (_) => _onTick());
  }

  @override
  Future<void> close() async {
    _tick?.cancel();
    // Left without submitting: the paper stays open, and its draft is written again with the
    // position and answers it has now, so the Resume capsule can offer it (the deadline is
    // `endsAt`, so the clock needs nothing while the paper is away).
    final submitted = submitState.value.stage == SubmitStage.sending || submitState.value.stage == SubmitStage.received;
    if (!submitted && demoDrafts.latest?.sessionId == _id) demoDrafts.open(this);
    await super.close();
  }
}
