import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../models/learn_catalog.dart';
import 'card_stack.dart';

/// A raised panel used by the cards at the top of Learn.
class LearnPanel extends StatelessWidget {
  const LearnPanel({super.key, required this.child, this.padding = const EdgeInsets.all(MmSpace.cardPadding)});

  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: colors.raised,
        shape: RoundedSuperellipseBorder(borderRadius: MmRadius.panelAll, side: BorderSide(color: colors.line)),
        shadows: colors.cardShadow,
      ),
      child: CustomPaint(
        foregroundPainter: EdgeLightPainter(
          borderRadius: MmRadius.panelAll,
          top: colors.edgeTop,
          bottom: colors.edgeBottom.withValues(alpha: 0),
          sheen: false,
        ),
        child: Padding(padding: padding, child: child),
      ),
    );
  }
}

/// "12 cards due." with the start key. No streak, no minutes and no due dates: the catalog
/// gives a count only, so the count is all this claims.
class DueCard extends StatelessWidget {
  const DueCard({
    super.key,
    required this.queue,
    required this.recallEnabled,
    required this.onStart,
    required this.primary,
    this.starting = false,
    this.message,
  });

  final StudyQueueView queue;
  final bool recallEnabled;
  final VoidCallback onStart;

  /// False when another card on the screen holds the one primary key.
  final bool primary;
  final bool starting;

  /// A plain line under the key (daily limit, offline, could not start).
  final String? message;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final due = queue.due;
    final newReady = queue.newReady;
    final canStart = recallEnabled && (due > 0 || newReady > 0);
    final headline = due > 0 ? LearnCopy.dueSummary(due) : LearnCopy.nothingDue;
    final label = due > 0 ? LearnCopy.startReview : LearnCopy.startNewCards;

    final panel = LearnPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (due > 0)
            Semantics(
              header: true,
              label: headline,
              excludeSemantics: true,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  MonumentalNumber(value: '$due', style: type.figureHero),
                  const SizedBox(width: MmSpace.s12),
                  Padding(
                    padding: const EdgeInsets.only(bottom: MmSpace.s12),
                    child: Text(due == 1 ? 'card due' : 'cards due', style: type.title.copyWith(color: colors.ink2)),
                  ),
                  const Spacer(),
                  CardStackMark(count: due),
                ],
              ),
            )
          else
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                CardStackMark(count: due),
                const SizedBox(width: MmSpace.s20),
                Expanded(
                  child: Semantics(header: true, child: Text(headline, style: type.title)),
                ),
              ],
            ),
          if (due == 0 && newReady > 0)
            Padding(
              padding: const EdgeInsets.only(top: MmSpace.s12),
              child: Text(LearnCopy.newReady(newReady), style: type.body.copyWith(color: colors.ink2)),
            ),
          if (queue.pausedNew)
            Padding(
              padding: const EdgeInsets.only(top: MmSpace.s12),
              child: Text(LearnCopy.newCardsPaused, style: type.body.copyWith(color: colors.ink2)),
            ),
          if (canStart) ...[
            const SizedBox(height: MmSpace.s20),
            if (primary)
              KeyButton(label: label, onPressed: starting ? null : onStart, loading: starting)
            else
              KeyButton.secondary(label: label, onPressed: starting ? null : onStart, loading: starting),
          ],
          if (message != null)
            Padding(
              padding: const EdgeInsets.only(top: MmSpace.s12),
              child: Semantics(
                liveRegion: true,
                child: Text(message!, style: type.body.copyWith(color: colors.ink)),
              ),
            ),
        ],
      ),
    );
    return primary && canStart ? LitEdge(glow: true, child: panel) : panel;
  }
}

/// What the due card needs from the queue.
class StudyQueueView {
  const StudyQueueView({required this.due, required this.newReady, required this.pausedNew});

  factory StudyQueueView.of(LearnCatalog catalog) {
    final q = catalog.queue;
    final newReady = q.pausedNew ? 0 : (q.newCount < q.newAllowance ? q.newCount : q.newAllowance);
    return StudyQueueView(due: q.dueCount, newReady: newReady, pausedNew: q.pausedNew);
  }

  final int due;
  final int newReady;
  final bool pausedNew;
}

/// "Pick up where you left off": the run the server says is active.
class ResumeCard extends StatelessWidget {
  const ResumeCard({super.key, required this.run, required this.onContinue, this.pendingCount = 0});

  final LearnActiveRun run;
  final VoidCallback onContinue;

  /// Events on this phone that the server has not acknowledged.
  final int pendingCount;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return LearnPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(header: true, child: Text(LearnCopy.resumeHeading, style: type.subhead)),
          const SizedBox(height: MmSpace.s8),
          if (run.title != null) Text(run.title!, style: type.body),
          if (run.position != null) Text(run.position!, style: type.small.copyWith(color: colors.ink2)),
          if (pendingCount > 0) ...[
            const SizedBox(height: MmSpace.s12),
            Row(
              children: [
                Icon(LucideIcons.smartphone, size: 16, color: colors.ink2),
                const SizedBox(width: MmSpace.s8),
                Expanded(child: Text(LearnCopy.pendingOnPhone(pendingCount), style: type.small.copyWith(color: colors.ink2))),
              ],
            ),
          ],
          const SizedBox(height: MmSpace.s20),
          KeyButton(label: LearnCopy.resumeKey, onPressed: onContinue),
        ],
      ),
    );
  }
}

/// The run summary the resume card shows.
class LearnActiveRun {
  const LearnActiveRun({required this.id, this.title, this.position});

  final String id;
  final String? title;
  final String? position;
}

/// The lesson the server suggests next, with its own reason sentence when it gave one.
class NextLessonCard extends StatelessWidget {
  const NextLessonCard({super.key, required this.lesson, required this.onOpen});

  final NextLesson lesson;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      button: true,
      container: true,
      label: '${LearnCopy.nextLessonHeading}. ${lesson.title}',
      excludeSemantics: true,
      onTap: onOpen,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onOpen,
        child: LearnPanel(
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(LearnCopy.nextLessonHeading, style: type.label.copyWith(color: colors.ink2)),
                    const SizedBox(height: MmSpace.s4),
                    Text(lesson.title, style: type.subhead),
                    if (lesson.reason != null) ...[
                      const SizedBox(height: MmSpace.s4),
                      Text(lesson.reason!, style: type.small.copyWith(color: colors.ink2)),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: MmSpace.s12),
              Icon(LucideIcons.chevronRight, size: 20, color: colors.ink3),
            ],
          ),
        ),
      ),
    );
  }
}

/// Position text for a run, "Step 3 of 9" or "Card 3 of 8".
String? runPosition(String? mode, int? step, int? total) =>
    step == null || total == null ? null : LearnCopy.position(mode, step, total);
