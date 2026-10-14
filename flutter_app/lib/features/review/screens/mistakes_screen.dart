import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/repositories/attempts_repository.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../../core/motion/motion.dart';
import '../copy.dart';
import '../data/mistake_index.dart';
import '../data/review_providers.dart';
import '../widgets/mistake_map.dart';
import '../widgets/page_header.dart';
import '../widgets/review_bits.dart';
import '../widgets/review_rows.dart';
import '../widgets/review_state_view.dart';
import '../widgets/review_status.dart';

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
          ? ReviewStateView(
              kind: (inputs.attempts.error?.isOffline ?? false) ? StateViewKind.offline : StateViewKind.error,
              title: ReviewCopy.loadErrorTitle,
              message: ReviewCopy.loadErrorMessage,
              primary: StateAction(ReviewCopy.tryAgainKey, () => ref.read(attemptsRepositoryProvider.notifier).refresh(force: true)),
            )
          : Center(
              child: Semantics(label: ReviewCopy.loadingMistakes, liveRegion: true, child: MmSpinner(color: context.mmColors.ink2)),
            );
    } else if (!index.hasAnyMistake && index.blanks == null) {
      body = ReviewStateView(
        kind: StateViewKind.empty,
        pose: MobiPose.read,
        title: index.attempts.isEmpty ? ReviewCopy.emptyTitle : ReviewCopy.allClearTitle,
        message: index.attempts.isEmpty ? ReviewCopy.emptyMessage : ReviewCopy.allClearMessage,
        primary: index.attempts.isEmpty ? StateAction(ReviewCopy.emptyAction, () => context.go(AppRoutes.practice)) : null,
      );
    } else {
      final open = index.openGroups;
      // Closed chapters split by outcome, item by item: a repaired mistake is never listed under
      // "Set aside" and a set-aside one is never listed under "Repaired".
      final repaired = <ChapterGroup>[];
      final setAside = <ChapterGroup>[];
      for (final g in index.groups) {
        if (g.openCount > 0) continue;
        if (g.onlyStage(MistakeStage.repaired) case final r?) repaired.add(r);
        if (g.onlyStage(MistakeStage.setAside) case final a?) setAside.add(a);
      }
      // The page arrives with its route: the map first, then what is closed, in reading order.
      body = MmStagger(
        driver: MmStaggerDriver.route,
        child: ListView(
          padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmRhythm.screenTop, MmSpace.gutter, pad.bottom + MmSpace.s32),
          children: [
            if (open.isNotEmpty)
              MmStaggerItem(
                index: 0,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SectionHeading(ReviewCopy.mistakesHeading, caption: mapCaptionOf(index)),
                    RepairsProgress(repaired: index.repairedCount, found: index.foundCount, setAside: index.setAsideCount),
                    const SizedBox(height: MmRhythm.item),
                    MistakeMap(groups: open, clock: clock, onOpen: openRepair, initialOpen: 0, showSubject: spansSubjects(index.groups), leadKeyPrimary: true),
                  ],
                ),
              ),
            if (repaired.isNotEmpty)
              MmStaggerItem(
                index: 1,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: MmRhythm.section),
                    const SectionHeading(ReviewCopy.repaired),
                    MistakeMap(
                      groups: repaired,
                      clock: clock,
                      onOpen: openRepair,
                      scaleTo: mapScaleOf(index.groups),
                      showSubject: spansSubjects(index.groups) || open.isEmpty,
                    ),
                  ],
                ),
              ),
            if (setAside.isNotEmpty)
              MmStaggerItem(
                index: 2,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: MmRhythm.section),
                    const SectionHeading(ReviewCopy.setAsideHeading),
                    MistakeMap(
                      groups: setAside,
                      clock: clock,
                      onOpen: openRepair,
                      scaleTo: mapScaleOf(index.groups),
                      showSubject: spansSubjects(index.groups) || open.isEmpty,
                    ),
                  ],
                ),
              ),
            if (index.blanks case final blanks?)
              MmStaggerItem(
                index: 3,
                child: Padding(
                  padding: const EdgeInsets.only(top: MmRhythm.group),
                  child: NotAttemptedGroup(group: blanks),
                ),
              ),
          ],
        ),
      );
    }

    return Scaffold(
      backgroundColor: colors.ground,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            PageHeader(title: ReviewCopy.mistakesTitle, notice: index != null && inputs.attempts.isStale ? HeaderNotice.offline : null),
            Expanded(child: body),
          ],
        ),
      ),
    );
  }
}
