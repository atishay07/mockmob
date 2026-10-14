import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/repair.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/retry.dart';
import '../data/review_providers.dart';

/// A labelled block of the worked explanation. The body never moves once shown.
class ExplanationBlock extends StatelessWidget {
  const ExplanationBlock({super.key, required this.label, required this.paragraphs});

  final String label;
  final List<String> paragraphs;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final shown = [
      for (final p in paragraphs)
        if (p.trim().isNotEmpty) p.trim(),
    ];
    if (shown.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(
            header: true,
            child: Text(label, style: type.label.copyWith(color: colors.ink2)),
          ),
          const SizedBox(height: MmSpace.s8),
          for (var i = 0; i < shown.length; i++) ...[if (i > 0) const SizedBox(height: MmSpace.s8), Text(shown[i], style: type.body)],
        ],
      ),
    );
  }
}

/// The worked explanation of an `explained` or `stored` repair: what happened, the idea, next
/// time. Observed patterns, never a statement about the student.
class WorkedExplanation extends StatelessWidget {
  const WorkedExplanation({super.key, required this.explanation});

  final RepairExplanation explanation;

  @override
  Widget build(BuildContext context) {
    final e = explanation;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ExplanationBlock(label: ReviewCopy.whatHappened, paragraphs: [e.whyTempting ?? '', e.whyWrong ?? '']),
        ExplanationBlock(label: ReviewCopy.theIdea, paragraphs: [e.keyIdea]),
        ExplanationBlock(label: ReviewCopy.nextTime, paragraphs: [e.nextStep ?? '']),
      ],
    );
  }
}

/// A calm notice inside the work layer: a glyph, the plain sentence and up to two actions.
class NoticePanel extends StatelessWidget {
  const NoticePanel({super.key, required this.message, this.detail, this.primary, this.secondary, this.icon = LucideIcons.info});

  final String message;
  final String? detail;
  final StateAction? primary;
  final StateAction? secondary;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s24),
      child: DecoratedBox(
        decoration: ShapeDecoration(
          color: colors.sunken,
          shape: mmShapeBorder(MmRadius.panelAll, side: BorderSide(color: colors.line)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(MmSpace.s16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Semantics(
                liveRegion: true,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Icon(icon, size: 18, color: colors.ink2),
                    ),
                    const SizedBox(width: MmSpace.s12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(message, style: type.body),
                          if (detail != null) ...[
                            const SizedBox(height: MmSpace.s4),
                            Text(detail!, style: type.small.copyWith(color: colors.ink2)),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              if (primary != null || secondary != null) ...[
                const SizedBox(height: MmSpace.s12),
                Wrap(
                  spacing: MmSpace.s8,
                  runSpacing: MmSpace.s4,
                  children: [
                    if (primary != null) KeyButton.secondary(label: primary!.label, onPressed: primary!.onPressed, expanded: false),
                    if (secondary != null) KeyButton.quiet(label: secondary!.label, onPressed: secondary!.onPressed),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// The concept that explains this chapter, through the Learn routes. Hidden while study
/// content is off or no lesson matches.
class ConceptRow extends ConsumerWidget {
  const ConceptRow({super.key, required this.chapter});

  final String chapter;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final link = ref.watch(conceptLinkProvider(chapter));
    if (link == null) return const SizedBox.shrink();
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Divider(height: 1, color: colors.line),
          MmPressable(
            onTap: () => context.push(AppRoutes.learnUnit(link.unitId)),
            pressedScale: 0.985,
            focusRadius: MmRadius.keyAll,
            semanticsLabel: '${ReviewCopy.concept}: ${link.title}',
            builder: (context, pressed, _) => ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 64),
              child: Row(
                children: [
                  Icon(LucideIcons.bookOpen, size: 20, color: colors.ink2),
                  const SizedBox(width: MmSpace.s12),
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(ReviewCopy.concept, style: type.caption.copyWith(color: colors.ink2)),
                        Text(link.title, style: type.labelLarge),
                      ],
                    ),
                  ),
                  Icon(LucideIcons.chevronRight, size: 20, color: colors.ink3),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The optional retry: a separate 5-question practice in the chapter, with its own cost.
class RetryCard extends ConsumerWidget {
  const RetryCard({super.key, required this.subjectId, required this.chapter});

  /// Internal subject id.
  final String subjectId;
  final String chapter;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final offer = ref.watch(retryOfferProvider(subjectId)).value;
    final colors = context.mmColors;
    final type = context.mmType;
    return switch (offer) {
      RetryAvailable(:final subjectId, :final cost, :final free) => Padding(
        padding: const EdgeInsets.only(top: MmSpace.s8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Divider(height: 1, color: colors.line),
            const SizedBox(height: MmSpace.s16),
            Text(ReviewCopy.retryTitle(chapter), style: type.cardTitle),
            const SizedBox(height: MmSpace.s4),
            Text(ReviewCopy.retryLine(cost, free), style: type.small.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s12),
            KeyButton.secondary(label: ReviewCopy.retryKey, onPressed: () => context.push(retryRoute(subjectId, chapter))),
          ],
        ),
      ),
      RetryShortOfCredits() => Padding(
        padding: const EdgeInsets.only(top: MmSpace.s24),
        child: Text(ReviewCopy.retryShort, style: type.small.copyWith(color: colors.ink2)),
      ),
      _ => const SizedBox.shrink(),
    };
  }
}
