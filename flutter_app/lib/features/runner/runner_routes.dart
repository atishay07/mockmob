// Route builders for the runner feature. lib/core/router/screens.dart re-exports them and
// router.dart binds them to `/run/:sessionId` and `/run/:sessionId/submit` (spec 4.2).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/routes.dart';
import 'copy.dart';
import 'data/runner_loader.dart';
import 'screens/runner_screen.dart';
import 'screens/submit_screen.dart';
import 'widgets/runner_message.dart';

Widget runScreen(BuildContext context, GoRouterState state) => RunnerRoute(sessionId: state.pathParameters['sessionId'] ?? '');

Widget runSubmitScreen(BuildContext context, GoRouterState state) =>
    RunnerRoute(sessionId: state.pathParameters['sessionId'] ?? '', submit: true);

/// Opens the session for `/run/:sessionId` (and its submit page) from the draft on this phone.
class RunnerRoute extends ConsumerWidget {
  const RunnerRoute({super.key, required this.sessionId, this.submit = false});

  final String sessionId;
  final bool submit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final load = ref.watch(runnerLoadProvider(sessionId));
    final Widget body = switch (load) {
      AsyncData(value: RunnerReady(:final session)) => submit ? SubmitPage(session: session) : RunnerView(session: session),
      AsyncData(value: RunnerEnded(:final isMock)) => RunnerMessage(
        title: RunnerCopy.endedTitle(isMock),
        body: RunnerCopy.endedBody,
        actionLabel: RunnerCopy.goToToday,
        onAction: () => context.go(AppRoutes.today),
      ),
      AsyncData(value: RunnerMissing()) => RunnerMessage(
        title: RunnerCopy.missingTitle,
        body: RunnerCopy.missingBody,
        actionLabel: RunnerCopy.goToPractice,
        onAction: () => context.go(AppRoutes.practice),
      ),
      AsyncData(value: RunnerFailed()) || AsyncError() => RunnerMessage(
        title: RunnerCopy.failedTitle,
        body: RunnerCopy.failedBody,
        actionLabel: RunnerCopy.tryAgain,
        onAction: () => ref.invalidate(runnerLoadProvider(sessionId)),
        secondaryLabel: RunnerCopy.goToPractice,
        onSecondary: () => context.go(AppRoutes.practice),
      ),
      _ => const RunnerLoading(),
    };
    final ready = load.value is RunnerReady;
    return Material(
      type: MaterialType.transparency,
      // The runner and the submit page guard back themselves; every other state goes back to
      // Practice instead of closing the app (practice setup replaced the stack).
      child: ready
          ? body
          : PopScope(
              canPop: false,
              onPopInvokedWithResult: (didPop, _) {
                if (!didPop) context.go(AppRoutes.practice);
              },
              child: body,
            ),
    );
  }
}
