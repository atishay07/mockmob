// A demo exam or practice session: the fixture runner session with a clock that really runs
// (the 5 and 1 minute warnings, time up), and a submit that marks the answers given, adds the
// paper to the record at that moment and acknowledges it, as the server would.
// ignore_for_file: depend_on_referenced_packages
import 'dart:async';

import 'package:mockmob/core/sync/session/session_engine.dart';
import 'package:mockmob/core/sync/session/session_submitter.dart';

import '../unit/runner/support/fake_session.dart' as runner;
import 'demo_book.dart';
import 'demo_questions.dart';

final Map<String, DemoSession> demoSessions = {};

class DemoSession extends runner.FakeRunnerSession {
  DemoSession(this._id, {super.questions, super.mode, super.subject, super.chapter, super.remaining, super.endsAt}) {
    nextOutcome = null;
    // As the real engine does: a paper that starts with 5 minutes or less never warns about it.
    final left = endsAt.difference(DateTime.now());
    _warnedFive = left <= const Duration(minutes: 5, seconds: 2);
    _warnedOne = left <= const Duration(minutes: 1, seconds: 2);
    _tick = Timer.periodic(const Duration(seconds: 1), (_) => _onTick());
  }

  final String _id;
  Timer? _tick;
  bool _warnedFive = false;
  bool _warnedOne = false;

  @override
  String get sessionId => _id;

  String get resultId => '$_id-result';

  void _onTick() {
    final left = endsAt.difference(DateTime.now());
    remaining.value = left.isNegative ? Duration.zero : left;
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

  @override
  Future<SubmitOutcome> submit({bool timedOut = false}) async {
    if (submitState.value.stage == SubmitStage.received) return submitState.value.outcome!;
    _tick?.cancel();
    submitState.value = const SubmitUiState(SubmitStage.sending);
    await Future<void>.delayed(const Duration(milliseconds: 800));
    final at = DateTime.now();
    if (demoBook.detail(resultId) == null) {
      demoBook.record(
        demoPracticeDetail(id: resultId, subject: subject, questions: questions, answers: Map.of(answers), completedAt: at.toUtc(), mode: mode),
        at,
      );
    }
    nextOutcome = SubmitReceived(attempt: {'id': resultId}, receivedAt: at);
    return super.submit(timedOut: timedOut);
  }

  @override
  Future<void> close() async {
    _tick?.cancel();
    await super.close();
  }
}
