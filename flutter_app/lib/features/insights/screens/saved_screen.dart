import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/insights_repository.dart';
import '../data/practice_question.dart';
import '../data/saved_repository.dart';
import '../insights_paths.dart';
import '../widgets/insights_bits.dart';
import '../widgets/practice_card.dart';

/// `/review/saved` (website Saved): the questions the student kept for another go. Practise
/// them one at a time, or remove one; a removal shows only after the server confirms it.
class SavedScreen extends ConsumerWidget {
  const SavedScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final state = ref.watch(savedRepositoryProvider);
    final marks = ref.watch(saveControllerProvider);
    final pro = ref.watch(insightsProProvider);
    final list = state.value;
    final pad = MediaQuery.paddingOf(context);
    Future<void> refresh() => ref.read(savedRepositoryProvider.notifier).refresh(force: true);

    Widget body;
    if (list == null) {
      if (state.isFailedEmpty) {
        final offline = state.error?.isOffline ?? false;
        body = StateView(
          kind: offline ? StateViewKind.offline : StateViewKind.error,
          title: InsightsCopy.savedErrorTitle,
          message: InsightsCopy.savedErrorMessage,
          primary: StateAction(InsightsCopy.retry, refresh),
        );
      } else {
        body = const _SavedSkeleton();
      }
    } else {
      // A removal the server confirmed leaves the list at once, before the re-read lands.
      final questions = [for (final q in list.questions) if (marks.acked[q.id] != false) q];
      if (questions.isEmpty && list.held == 0) {
        body = StateView(
          kind: StateViewKind.empty,
          pose: MobiPose.read,
          title: InsightsCopy.savedEmptyTitle,
          message: InsightsCopy.savedEmptyMessage,
          primary: StateAction(InsightsCopy.savedEmptyAction, () => context.push(InsightsPaths.stream)),
        );
      } else {
        final count = marks.count ?? list.count;
        body = RefreshIndicator(
          onRefresh: refresh,
          color: colors.ink,
          backgroundColor: colors.raised,
          child: ListView(
            padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, pad.bottom + MmSpace.s48),
            children: [
              if (state.isStale) ...[
                const InlineBanner(message: InsightsCopy.staleNote, tone: BannerTone.offline),
                const SizedBox(height: MmSpace.s16),
              ],
              Text(InsightsCopy.savedCount(count, pro ? null : (marks.limit ?? freeSaveLimit)), style: context.mmType.small.copyWith(color: colors.ink2)),
              if (list.held > 0) Text(InsightsCopy.savedHeld(list.held), style: context.mmType.caption.copyWith(color: colors.ink3)),
              const SizedBox(height: MmSpace.s16),
              if (questions.isNotEmpty) KeyButton(label: InsightsCopy.savedPractise, onPressed: () => context.push(InsightsPaths.savedStreamFrom(null))),
              const SizedBox(height: MmSpace.s24),
              for (var i = 0; i < questions.length; i++) ...[
                if (i > 0) Divider(height: 1, color: colors.line),
                _SavedRow(question: questions[i], removing: marks.pending.contains(questions[i].id)),
              ],
            ],
          ),
        );
      }
    }

    return Scaffold(
      backgroundColor: colors.ground,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const InsightsHeader(title: InsightsCopy.savedTitle, fallback: AppRoutes.review),
            Expanded(child: body),
          ],
        ),
      ),
    );
  }
}

/// One saved question. The whole row practises it (the screen's one dominant action stays
/// "Practise these"); removing is a quiet 48 dp icon at the end, and the removal says so with an
/// Undo, so a slip costs nothing.
class _SavedRow extends ConsumerWidget {
  const _SavedRow({required this.question, required this.removing});

  final PracticeQuestion question;
  final bool removing;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final q = question;
    // Captured now: the row leaves the list once the server confirms, before the answer is used.
    final controller = ref.read(saveControllerProvider.notifier);
    final messenger = ScaffoldMessenger.maybeOf(context);
    void say(String text, {SnackBarAction? action}) => messenger
      ?..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(text), behavior: SnackBarBehavior.floating, action: action));

    Future<void> undo() async {
      final outcome = await controller.set(q.id, saved: true, source: 'saved');
      if (outcome is SaveLimitReached) {
        say(InsightsCopy.limitReached);
      } else if (outcome is SaveFailed) {
        say(InsightsCopy.saveFailed);
      }
    }

    Future<void> remove() async {
      final outcome = await controller.set(q.id, saved: false, source: 'saved');
      if (outcome is SaveFailed) {
        say(InsightsCopy.saveFailed);
      } else if (outcome is SaveDone) {
        say(InsightsCopy.removedFromSaved, action: SnackBarAction(label: InsightsCopy.undo, onPressed: undo));
      }
    }

    return AnimatedOpacity(
      duration: Motion.crossFade,
      opacity: removing ? 0.5 : 1,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: MmPressable(
              onTap: () => context.push(InsightsPaths.savedStreamFrom(q.id)),
              semanticsLabel: 'Practise this question: ${q.body}',
              focusRadius: MmRadius.smallAll,
              pressedScale: 0.99,
              highlight: true,
              haptic: MmPressHaptic.selection,
              builder: (context, pressed, _) => Padding(
                padding: const EdgeInsets.symmetric(vertical: MmSpace.s16),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SubjectThumb(subject: q.subject),
                    const SizedBox(width: MmSpace.s12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(questionMeta(q), style: type.caption.copyWith(color: colors.ink3)),
                          const SizedBox(height: MmSpace.s4),
                          Text(q.body, style: type.body, maxLines: 3, overflow: TextOverflow.ellipsis),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: MmSpace.s8),
            child: MmPressable(
              onTap: removing ? null : remove,
              semanticsLabel: removing ? InsightsCopy.removing : 'Remove this question from saved',
              focusRadius: MmRadius.pillAll,
              haptic: MmPressHaptic.selection,
              builder: (context, pressed, _) => SizedBox.square(
                dimension: MmTarget.min,
                child: Center(
                  child: removing
                      ? SizedBox.square(dimension: 18, child: MmSpinner(color: colors.ink2))
                      : Icon(LucideIcons.bookmarkMinus, size: 20, color: pressed ? colors.ink : colors.ink2),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SavedSkeleton extends StatelessWidget {
  const _SavedSkeleton();

  @override
  Widget build(BuildContext context) {
    return const SkeletonGroup(
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: MmSpace.gutter, vertical: MmSpace.s8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Skeleton.line(width: 160),
            SizedBox(height: MmSpace.s16),
            Skeleton(height: 56, radius: 28),
            SizedBox(height: MmSpace.s24),
            MmSkeletonRows(rows: 4),
          ],
        ),
      ),
    );
  }
}
