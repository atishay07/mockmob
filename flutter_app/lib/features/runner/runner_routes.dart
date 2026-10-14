// Route builders for the runner feature. lib/core/router/screens.dart re-exports them and
// router.dart binds them to `/run/:sessionId` and `/run/:sessionId/submit` (spec 4.2).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/mascot/mascot.dart' show MobiAct;
import '../../core/router/routes.dart';
import 'copy.dart';
import 'data/runner_loader.dart';
import 'nta/nta_copy.dart';
import 'nta/nta_instructions_screen.dart';
import 'nta/nta_paper_theme.dart';
import 'nta/nta_runner_screen.dart';
import 'screens/runner_screen.dart';
import 'screens/submit_screen.dart';
import 'widgets/runner_message.dart';

Widget runScreen(BuildContext context, GoRouterState state) => RunnerRoute(sessionId: state.pathParameters['sessionId'] ?? '');

Widget runSubmitScreen(BuildContext context, GoRouterState state) => RunnerRoute(sessionId: state.pathParameters['sessionId'] ?? '', submit: true);

/// NTA mode's instructions page, before any session exists. Registered in router.dart outside
/// the shell (no dock, like `/run`); the Practice NTA row and the Start sheet's NTA row open
/// [NtaRoutes.location].
abstract final class NtaRoutes {
  static const String path = AppRoutes.examNta;
  static String location(String subject) => Uri(path: path, queryParameters: {'subject': subject}).toString();
}

Widget ntaInstructionsScreen(BuildContext context, GoRouterState state) {
  final subject = state.uri.queryParameters['subject']?.trim() ?? '';
  if (subject.isEmpty) {
    return RunnerMessage(
      title: NtaCopy.noSubjectTitle,
      body: NtaCopy.noSubjectBody,
      actionLabel: RunnerCopy.goToPractice,
      onAction: () => context.go(AppRoutes.practice),
    );
  }
  return NtaInstructionsScreen(key: ValueKey(subject), subject: subject);
}

/// Opens the session for `/run/:sessionId` (and its submit page) from the draft on this phone.
class RunnerRoute extends ConsumerWidget {
  const RunnerRoute({super.key, required this.sessionId, this.submit = false});

  final String sessionId;
  final bool submit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final load = ref.watch(runnerLoadProvider(sessionId));
    final Widget body = switch (load) {
      AsyncData(value: RunnerReady(:final session)) when session.mode == 'nta' => NtaPaperTheme(
        secure: true,
        child: submit ? SubmitPage(session: session) : NtaRunnerView(session: session),
      ),
      AsyncData(value: RunnerReady(:final session)) => submit ? SubmitPage(session: session) : RunnerView(session: session),
      AsyncData(value: RunnerEnded(:final isMock)) => RunnerMessage(
        title: RunnerCopy.endedTitle(isMock),
        body: RunnerCopy.endedBody,
        actionLabel: RunnerCopy.goToToday,
        onAction: () => context.go(AppRoutes.today),
        // Time is simply over: Mobi sits down beside it. Calm, never a shrug at the student.
        mobi: MobiAct.rest,
      ),
      AsyncData(value: RunnerMissing()) => RunnerMessage(
        title: RunnerCopy.missingTitle,
        body: RunnerCopy.missingBody,
        actionLabel: RunnerCopy.goToPractice,
        onAction: () => context.go(AppRoutes.practice),
      ),
      AsyncData(value: RunnerBadPaper(:final count)) => RunnerMessage(
        title: RunnerCopy.badPaperTitle,
        body: RunnerCopy.badPaperBody(count),
        actionLabel: RunnerCopy.goToPractice,
        onAction: () => context.go(AppRoutes.practice),
        mobi: MobiAct.oops,
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
