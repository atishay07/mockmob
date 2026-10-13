import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api.dart';
import '../../../core/models/models.dart';
import '../../../core/repositories/remote_state.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../rhythm/rhythm.dart' show LateNightLine;
import '../copy.dart';
import 'practice_app_bar.dart';

class ResultLoadFailed extends StatelessWidget {
  const ResultLoadFailed({super.key, required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) =>
      InlineBanner(message: PracticeCopy.resultLoadFailed, tone: BannerTone.error, actionLabel: PracticeCopy.retry, onAction: onRetry);
}

/// The ending after "Finish for now": one plain line and nothing else.
class ResultClosing extends StatelessWidget {
  const ResultClosing({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Scaffold(
      backgroundColor: colors.ground,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(MmSpace.s24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Semantics(liveRegion: true, child: ReceiptLine(text: text)),
                const LateNightLine(),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// No attempt to show yet: loading, another account's result, offline, or a failed read.
class ResultNoAttempt extends StatelessWidget {
  const ResultNoAttempt({super.key, required this.state, required this.onRetry});

  final RemoteState<AttemptDetail> state;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final error = state.error;
    final Widget body;
    if (error == null) {
      body = const Padding(
        padding: EdgeInsets.all(MmSpace.gutter),
        child: SkeletonGroup(
          label: PracticeCopy.loadingAnswers,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Skeleton(width: 200, height: 44),
              SizedBox(height: MmSpace.s12),
              Skeleton.line(width: 160),
              SizedBox(height: MmSpace.s24),
              Skeleton(height: 24),
              SizedBox(height: MmSpace.s24),
              Skeleton(height: 56),
              SizedBox(height: MmSpace.s8),
              Skeleton(height: 56),
            ],
          ),
        ),
      );
    } else if (error.kind == ApiErrorKind.notFound) {
      body = StateView(
        kind: StateViewKind.error,
        title: PracticeCopy.otherAccount,
        primary: StateAction(PracticeCopy.retry, onRetry),
        secondary: StateAction(PracticeCopy.backToPractice, () => context.go(AppRoutes.practice)),
      );
    } else if (error.isOffline) {
      body = StateView(
        kind: StateViewKind.offline,
        title: PracticeCopy.resultLoadFailedUnknown,
        primary: StateAction(PracticeCopy.retry, onRetry),
        secondary: StateAction(PracticeCopy.backToPractice, () => context.go(AppRoutes.practice)),
      );
    } else {
      body = StateView(
        kind: StateViewKind.error,
        title: PracticeCopy.resultLoadFailedUnknown,
        primary: StateAction(PracticeCopy.retry, onRetry),
        secondary: StateAction(PracticeCopy.backToPractice, () => context.go(AppRoutes.practice)),
      );
    }
    return Scaffold(
      backgroundColor: colors.ground,
      body: SafeArea(
        child: Column(
          children: [
            const PracticeAppBar(),
            Expanded(child: body),
          ],
        ),
      ),
    );
  }
}
