import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/load_problem.dart';
import '../../../core/models/attempt.dart' show Attempt;
import '../../../core/repositories/remote_state.dart';
import '../../../core/router/routes.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import 'review_state_view.dart';

/// The Review record that did not load: the cause in words, never the empty state. The key says
/// "Try again" and shows its spinner while the read runs, so a retry is visibly doing something
/// and a second failure says so again instead of looking dead.
class ReviewLoadFailure extends StatelessWidget {
  const ReviewLoadFailure({super.key, required this.attempts, required this.onRetry});

  final RemoteState<List<Attempt>> attempts;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final problem = LoadProblem.of(attempts.error);
    final offline = problem == LoadProblem.offline;
    return ReviewStateView(
      kind: offline ? StateViewKind.offline : StateViewKind.error,
      title: offline ? ReviewCopy.offlineTitle : ReviewCopy.loadErrorTitle,
      message: offline ? ReviewCopy.offlineMessage : ReviewCopy.loadErrorMessage(problem),
      primary: StateAction(ReviewCopy.tryAgainKey, onRetry, loading: attempts.loading),
    );
  }
}

/// Whether the attempts read failed with nothing cached to show (a retry may be in flight: the
/// failure stays up with its key spinning rather than flashing back to the skeleton).
bool attemptsReadFailed(RemoteState<List<Attempt>> attempts) => attempts.value == null && attempts.error != null;

/// "Start 10 questions" from an empty Review: opens the Quick setup with 10 chosen, not the tab.
void startQuickTen(BuildContext context) =>
    context.push(Uri(path: AppRoutes.practiceSetup('quick'), queryParameters: {'count': '10'}).toString());
