import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../models/learn_catalog.dart';
import 'card_stack.dart';

/// A surface of the cards at the top of Learn. [hero] makes it the screen's one focal card (the
/// lamp light, the lit edge); every other card is a plain one. With [onTap] it presses, ticks and
/// shows the press veil.
class LearnPanel extends StatelessWidget {
  const LearnPanel({
    super.key,
    required this.child,
    this.hero = false,
    this.onTap,
    this.semanticsLabel,
  });

  final Widget child;
  final bool hero;
  final VoidCallback? onTap;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) => hero
      ? MmSurface.hero(
          lit: true,
          onTap: onTap,
          semanticsLabel: semanticsLabel,
          child: child,
        )
      : MmSurface.plain(
          onTap: onTap,
          semanticsLabel: semanticsLabel,
          child: child,
        );
}

/// "12 cards due." with the start key. No streak, no minutes and no due dates: the catalog
/// gives a count only, so the count is all this claims.
///
/// With nothing due, Mobi takes the place of the empty card stack: pointing at the key when new
/// cards from a read lesson are ready, reading quietly when there is nothing to start.
class DueCard extends StatefulWidget {
  const DueCard({
    super.key,
    required this.queue,
    required this.recallEnabled,
    required this.onStart,
    required this.primary,
    this.starting = false,
    this.message,
    this.showMobi = true,
  });

  /// False when Mobi is already on the screen (the first-visit explainer): one Mobi at a time.
  final bool showMobi;

  final StudyQueueView queue;
  final bool recallEnabled;
  final VoidCallback onStart;

  /// False when another card on the screen holds the one primary key.
  final bool primary;
  final bool starting;

  /// A plain line under the key (daily limit, offline, could not start).
  final String? message;

  @override
  State<DueCard> createState() => _DueCardState();
}

class _DueCardState extends State<DueCard> {
  final _mobi = MobiController();
  final _key = GlobalKey();
  bool _pointed = false;

  @override
  void dispose() {
    _mobi.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final queue = widget.queue;
    final primary = widget.primary;
    final starting = widget.starting;
    final onStart = widget.onStart;
    final message = widget.message;
    final due = queue.due;
    final newReady = queue.newReady;
    final canStart = widget.recallEnabled && (due > 0 || newReady > 0);
    final pointAtKey = widget.showMobi && due == 0 && canStart;
    if (pointAtKey && !_pointed) {
      _pointed = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _mobi.pointAtWidget(_key);
      });
    }
    // Good news leads: with new cards ready the headline says so, and "Nothing is due" is kept
    // for when there is genuinely nothing to start.
    final headline = due > 0
        ? LearnCopy.dueSummary(due)
        : newReady > 0
        ? LearnCopy.newReadyHeadline(newReady)
        : LearnCopy.nothingDue;
    final label = due > 0 ? LearnCopy.startReview : LearnCopy.startNewCards;

    // The roll lands after the card has arrived, with one tick (resolved here, not at landing).
    final haptics = mmHapticsOf(context);
    return LearnPanel(
      hero: primary && canStart,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (due > 0)
            Semantics(
              header: true,
              label: headline,
              excludeSemantics: true,
              // The number may take up to half the row and shrinks beyond that (three digits, large
              // text); the words wrap; the card stack goes first when text is large.
              child: LayoutBuilder(
                builder: (context, box) {
                  final showStack =
                      MediaQuery.textScalerOf(context).scale(10) <= 11.5;
                  return Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      ConstrainedBox(
                        constraints: BoxConstraints(
                          maxWidth: box.maxWidth * 0.5,
                        ),
                        child: MonumentalNumber(
                          value: '$due',
                          style: type.figureHero,
                          delay: const Duration(milliseconds: 260),
                          onLanded: () => haptics?.selection(),
                        ),
                      ),
                      const SizedBox(width: MmSpace.s12),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.only(bottom: MmSpace.s12),
                          child: Text(
                            due == 1 ? 'card due' : 'cards due',
                            style: type.title.copyWith(color: colors.ink2),
                          ),
                        ),
                      ),
                      if (showStack) ...[
                        const SizedBox(width: MmSpace.s8),
                        CardStackMark(count: due),
                      ],
                    ],
                  );
                },
              ),
            )
          else
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                if (widget.showMobi) ...[
                  Mobi(
                    pose: pointAtKey ? MobiPose.point : MobiPose.read,
                    size: 64,
                    controller: _mobi,
                  ),
                  const SizedBox(width: MmSpace.s16),
                ],
                Expanded(
                  child: Semantics(
                    header: true,
                    child: Text(headline, style: type.title),
                  ),
                ),
              ],
            ),
          if (due == 0 && newReady > 0)
            Padding(
              padding: const EdgeInsets.only(top: MmSpace.s12),
              child: Text(
                LearnCopy.newReadyFrom,
                style: type.body.copyWith(color: colors.ink2),
              ),
            ),
          if (queue.pausedNew)
            Padding(
              padding: const EdgeInsets.only(top: MmSpace.s12),
              child: Text(
                LearnCopy.newCardsPaused,
                style: type.body.copyWith(color: colors.ink2),
              ),
            ),
          if (canStart) ...[
            const SizedBox(height: MmSpace.s20),
            KeyedSubtree(
              key: _key,
              child: primary
                  ? KeyButton(
                      label: label,
                      onPressed: starting ? null : onStart,
                      loading: starting,
                    )
                  : KeyButton.secondary(
                      label: label,
                      onPressed: starting ? null : onStart,
                      loading: starting,
                    ),
            ),
          ],
          if (message != null)
            Padding(
              padding: const EdgeInsets.only(top: MmSpace.s12),
              child: Semantics(
                liveRegion: true,
                child: Text(
                  message,
                  style: type.body.copyWith(color: colors.ink),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// What the due card needs from the queue.
class StudyQueueView {
  const StudyQueueView({
    required this.due,
    required this.newReady,
    required this.pausedNew,
  });

  factory StudyQueueView.of(LearnCatalog catalog) {
    final q = catalog.queue;
    final newReady = q.pausedNew
        ? 0
        : (q.newCount < q.newAllowance ? q.newCount : q.newAllowance);
    return StudyQueueView(
      due: q.dueCount,
      newReady: newReady,
      pausedNew: q.pausedNew,
    );
  }

  final int due;
  final int newReady;
  final bool pausedNew;
}

/// "Pick up where you left off": the run the server says is active.
class ResumeCard extends StatelessWidget {
  const ResumeCard({
    super.key,
    required this.run,
    required this.onContinue,
    this.pendingCount = 0,
  });

  final LearnActiveRun run;
  final VoidCallback onContinue;

  /// Events on this phone that the server has not acknowledged.
  final int pendingCount;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    // The run to pick up is the screen's one focal card while it exists.
    return LearnPanel(
      hero: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: Text(LearnCopy.resumeHeading, style: type.subhead),
          ),
          const SizedBox(height: MmSpace.s8),
          if (run.title != null) Text(run.title!, style: type.body),
          if (run.position != null)
            Text(run.position!, style: type.small.copyWith(color: colors.ink2)),
          if (pendingCount > 0) ...[
            const SizedBox(height: MmSpace.s12),
            Row(
              children: [
                Icon(LucideIcons.smartphone, size: 16, color: colors.ink2),
                const SizedBox(width: MmSpace.s8),
                Expanded(
                  child: Text(
                    LearnCopy.pendingOnPhone(pendingCount),
                    style: type.small.copyWith(color: colors.ink2),
                  ),
                ),
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
    return LearnPanel(
      onTap: onOpen,
      semanticsLabel: '${LearnCopy.nextLessonHeading}. ${lesson.title}',
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  LearnCopy.nextLessonHeading,
                  style: type.label.copyWith(color: colors.ink2),
                ),
                const SizedBox(height: MmSpace.s4),
                Text(lesson.title, style: type.subhead),
                if (lesson.reason != null) ...[
                  const SizedBox(height: MmSpace.s4),
                  Text(
                    lesson.reason!,
                    style: type.small.copyWith(color: colors.ink2),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: MmSpace.s12),
          Icon(LucideIcons.chevronRight, size: 20, color: colors.ink3),
        ],
      ),
    );
  }
}

/// Position text for a run, "Step 3 of 9" or "Card 3 of 8".
String? runPosition(String? mode, int? step, int? total) =>
    step == null || total == null
    ? null
    : LearnCopy.position(mode, step, total);
