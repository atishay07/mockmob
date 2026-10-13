import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/repositories/attempts_repository.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/mistake_index.dart';
import '../data/review_providers.dart';
import '../widgets/chapter_group_card.dart';
import '../widgets/page_header.dart';
import '../widgets/review_bits.dart';
import '../widgets/review_rows.dart';

/// `/review/mistakes`: every chapter with mistakes, open ones first, then the skipped questions.
/// Opened from "See all" and from the quick-start sheet's "Repair the next mistake".
class MistakesScreen extends ConsumerWidget {
  const MistakesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final inputs = ref.watch(reviewInputsProvider);
    final index = ref.watch(reviewIndexProvider);
    final clock = ref.watch(reviewClockProvider);
    final pad = MediaQuery.paddingOf(context);
    void openRepair(MistakeItem item) => context.push(AppRoutes.reviewRepair(item.attemptId, item.questionId));

    Widget body;
    if (index == null) {
      body = inputs.attempts.isFailedEmpty
          ? StateView(
              kind: (inputs.attempts.error?.isOffline ?? false) ? StateViewKind.offline : StateViewKind.error,
              title: ReviewCopy.loadErrorTitle,
              message: ReviewCopy.loadErrorMessage,
              primary: StateAction(ReviewCopy.tryAgainKey, () => ref.read(attemptsRepositoryProvider.notifier).refresh(force: true)),
            )
          : Center(child: MmSpinner(color: context.mmColors.ink2));
    } else if (!index.hasAnyMistake && index.blanks == null) {
      body = StateView(
        kind: StateViewKind.empty,
        pose: MobiPose.read,
        title: index.attempts.isEmpty ? ReviewCopy.emptyTitle : ReviewCopy.allClearTitle,
        message: index.attempts.isEmpty ? ReviewCopy.emptyMessage : ReviewCopy.allClearMessage,
        primary: index.attempts.isEmpty ? StateAction(ReviewCopy.emptyAction, () => context.go(AppRoutes.practice)) : null,
      );
    } else {
      final open = index.openGroups;
      final closed = [
        for (final g in index.groups)
          if (g.openCount == 0) g,
      ];
      body = ListView(
        padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, pad.bottom + MmSpace.s32),
        children: [
          if (inputs.attempts.isStale) ...[const InlineBanner.offlineStrip(), const SizedBox(height: MmSpace.s12)],
          if (open.isNotEmpty) ...[
            SectionHeading(ReviewCopy.mistakesHeading, caption: mistakesSummaryOf(index)),
            for (var i = 0; i < open.length; i++) ...[
              ChapterGroupCard(group: open[i], clock: clock, onOpen: openRepair, initiallyExpanded: i == 0),
              const SizedBox(height: MmSpace.s12),
            ],
          ],
          if (closed.isNotEmpty) ...[
            const SizedBox(height: MmSpace.s20),
            const SectionHeading(ReviewCopy.repaired),
            for (final g in closed) ...[ChapterGroupCard(group: g, clock: clock, onOpen: openRepair), const SizedBox(height: MmSpace.s12)],
          ],
          if (index.blanks case final blanks?) ...[const SizedBox(height: MmSpace.s20), NotAttemptedGroup(group: blanks)],
        ],
      );
    }

    return Scaffold(
      backgroundColor: colors.ground,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const PageHeader(title: ReviewCopy.mistakesTitle),
            Expanded(child: body),
          ],
        ),
      ),
    );
  }
}
