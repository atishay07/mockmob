import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/models.dart';
import '../../../core/repositories/attempts_repository.dart' show attemptDetailProvider;
import '../../../core/router/action_router.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../result/full/swot_section.dart' show swotPracticeHref;
import '../copy.dart';
import 'review_bits.dart';

/// What to do after the latest mock, on the History side of Review: the SWOT's first weakness
/// (the server's own finished sentence, with its denominator) and the first row of its plan, with
/// "Set up" opening the practice setup with the subject, chapter and count filled in. Nothing
/// starts and nothing is charged before the second tap there. Shown only when the mock's own
/// detail carries a ready read with a plan: a practice set, a short paper, answer checks still
/// pending and a missing read draw nothing.
class NextFromMockBlock extends ConsumerWidget {
  const NextFromMockBlock({super.key, required this.attemptId, required this.label});

  final String attemptId;

  /// "Mock 2".
  final String label;

  /// The weakness this block leads with: the first Weakness, else the first Threat, else null.
  static SwotItem? leadItem(Swot swot) {
    for (final id in const [SwotQuadrant.weakness, SwotQuadrant.threat]) {
      for (final q in swot.quadrants) {
        if (q.id == id && q.items.isNotEmpty) return q.items.first;
      }
    }
    return null;
  }

  /// Whether [swot] gives this block something to show.
  static bool shows(Swot? swot) => swot != null && swot.isReady && swot.plan.isNotEmpty;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final swot = ref.watch(attemptDetailProvider(attemptId)).value?.swot;
    if (!shows(swot)) return const SizedBox.shrink();
    final colors = context.mmColors;
    final type = context.mmType;
    final lead = leadItem(swot!);
    final plan = swot.plan.first;
    void setUp() {
      final target = ActionRouter.resolve(swotPracticeHref(plan.practice));
      if (target is NativeTarget) unawaited(context.push(target.location));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionHeading(ReviewCopy.nextFromMock(label)),
        if (lead != null) ...[
          Text(lead.title, style: type.labelLarge.copyWith(color: colors.ink)),
          if (lead.detail.isNotEmpty) ...[
            const SizedBox(height: MmSpace.s4),
            Text(lead.detail, style: type.body.copyWith(color: colors.ink2)),
          ],
          const SizedBox(height: MmSpace.s16),
        ],
        Semantics(
          container: true,
          label: plan.reason.isEmpty ? plan.label : '${plan.label}. ${plan.reason}',
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(plan.label, style: type.labelLarge.copyWith(color: colors.ink)),
                    if (plan.reason.isNotEmpty) ...[
                      const SizedBox(height: MmSpace.s2),
                      Text(plan.reason, style: type.small.copyWith(color: colors.ink2)),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: MmSpace.s12),
              KeyButton.secondary(label: ReviewCopy.setUp, onPressed: setUp, expanded: false, semanticsLabel: ReviewCopy.setUpSpoken(plan.label)),
            ],
          ),
        ),
      ],
    );
  }
}
