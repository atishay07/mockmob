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

/// The wait before the finish moment: Mobi holds the student's sheet and reads it, with one
/// plain line. It keeps the moment's height, so nothing jumps when the sheet takes its place.
/// Under reduced motion Mobi holds the reading pose. No skeleton and no blank band.
class ResultReading extends StatelessWidget {
  const ResultReading({super.key});

  /// About the height of the finish moment's figure, sheet and Mobi.
  static const double height = 320;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      liveRegion: true,
      container: true,
      label: PracticeCopy.readingSheet,
      excludeSemantics: true,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: height),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: MmSpace.s24),
            const MobiCharacter(size: 112, entrance: MobiAct.read, seed: 41),
            const SizedBox(height: MmSpace.s16),
            Text(PracticeCopy.readingSheet, style: type.title),
            const SizedBox(height: MmSpace.s4),
            Text(PracticeCopy.readingSheetNote, style: type.small.copyWith(color: colors.ink2)),
          ],
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
        padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.gutter),
        child: ResultReading(),
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
