import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/repositories/session_draft_repository.dart';
import '../../../core/sync/sync_providers.dart';
import '../nta/nta_copy.dart' show NtaRules;
import 'runner_session.dart';

/// What opening `/run/:sessionId` found.
sealed class RunnerLoad {
  const RunnerLoad();
}

/// The engine is restored from the draft and journal on this phone: same question, same
/// selections, the real time left.
class RunnerReady extends RunnerLoad {
  const RunnerReady(this.session);

  final RunnerSession session;
}

/// The draft exists but can no longer be answered or sent (time ran out while away). Today
/// owns the ended-mock copy.
class RunnerEnded extends RunnerLoad {
  const RunnerEnded({required this.isMock});

  final bool isMock;
}

/// No draft for this session on this phone.
class RunnerMissing extends RunnerLoad {
  const RunnerMissing();
}

/// An NTA mode paper came back without exactly [NtaRules.questions] questions. It is never
/// opened: no engine, so no clock, and nothing for the student to answer.
class RunnerBadPaper extends RunnerLoad {
  const RunnerBadPaper({required this.count});

  /// How many questions the paper had.
  final int count;
}

/// Opening failed (the database or the sign-in was not ready).
class RunnerFailed extends RunnerLoad {
  const RunnerFailed();
}

typedef RunnerOpener = Future<RunnerLoad> Function(String sessionId);

/// Opens a session from its draft. Practice setup and Today's Continue both arrive here, and so
/// does a restart after the process was killed: the engine is always rebuilt from the phone.
final runnerOpenerProvider = Provider<RunnerOpener>((ref) {
  return (sessionId) async {
    try {
      final draft = await ref.read(sessionDraftRepositoryProvider).bySessionId(sessionId);
      if (draft == null) return const RunnerMissing();
      // NTA mode is exactly 50 questions. A short or long paper is refused before anything
      // starts: the engine (and with it the timer) is never built.
      if (draft.mode == 'nta' && draft.view.questions.length != NtaRules.questions) {
        return RunnerBadPaper(count: draft.view.questions.length);
      }
      final engine = await ref.read(sessionEngineRestorerProvider)(draft);
      if (engine == null) return RunnerEnded(isMock: draft.isMock);
      return RunnerReady(EngineRunnerSession(engine));
    } on Object {
      return const RunnerFailed();
    }
  };
});

/// The open session for a route. Shared by the runner and its submit page, and closed (answers
/// flushed, draft written, timers stopped) when neither is on screen any more.
final runnerLoadProvider = FutureProvider.autoDispose.family<RunnerLoad, String>((ref, sessionId) async {
  final load = await ref.read(runnerOpenerProvider)(sessionId);
  if (load is RunnerReady) {
    if (!ref.mounted) {
      unawaited(load.session.close());
    } else {
      ref.onDispose(() => unawaited(load.session.close()));
    }
  }
  return load;
}, retry: (_, _) => null);
