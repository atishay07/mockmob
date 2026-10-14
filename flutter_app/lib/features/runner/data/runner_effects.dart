import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../../core/analytics/analytics.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/repositories/plan_repository.dart';
import '../../../core/repositories/rhythm_repository.dart';
import '../../../core/router/routes.dart';
import 'runner_session.dart';

/// Focus mode while the runner is open: sticky immersive and the screen kept awake. Behind an
/// interface so tests run without the platform plugins.
abstract interface class RunnerSystemUi {
  Future<void> enter();
  Future<void> exit();
}

class PlatformRunnerSystemUi implements RunnerSystemUi {
  const PlatformRunnerSystemUi();

  @override
  Future<void> enter() async {
    try {
      await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
      await WakelockPlus.enable();
    } on Object {
      // Focus mode is a comfort, never a reason to stop answering.
    }
  }

  @override
  Future<void> exit() async {
    try {
      await WakelockPlus.disable();
      await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    } on Object {
      // As above.
    }
  }
}

final runnerSystemUiProvider = Provider<RunnerSystemUi>((ref) => const PlatformRunnerSystemUi());

/// Where a received submit opens: the sealed sheet for full and NTA-style mocks, the practice
/// result for quick and chapter practice.
String resultRouteFor({required bool isMock, required String attemptId}) =>
    isMock ? AppRoutes.resultSealed(attemptId) : AppRoutes.practiceResult(attemptId);

/// What follows a submit the server acknowledged: the analytics event, then fresh reads of the
/// plan, the rhythm and the credit balance. The engine already cached the attempt, recorded the
/// pending result and cleared dismissals.
typedef AfterSubmit = void Function(RunnerSession session);

final runnerAfterSubmitProvider = Provider<AfterSubmit>((ref) {
  return (session) {
    unawaited(
      ref
          .read(analyticsClientProvider)
          .track(
            AnalyticsEvents.sessionSubmitted,
            props: {
              'mode': session.mode,
              'subject': session.subject,
              'count': session.questions.length,
              'outcome': session.endedByTimeUp ? 'timed_out' : 'submitted',
            },
          ),
    );
    ref.invalidate(planRepositoryProvider);
    ref.invalidate(rhythmRepositoryProvider);
    unawaited(ref.read(authSnapshotProvider.notifier).reload());
  };
});
