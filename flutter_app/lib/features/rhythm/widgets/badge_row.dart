// The badges on You (app-you-1016 A.2 item 6): how many of the badges are earned, five coins (the
// up to three newest earned, newest first, then the next ones in path order), and one sentence
// for the next badge to go for, with an exact count and a thin bar only where the phone holds a
// complete count. A not-yet coin is a faint coin with its engraving, never a padlock (Y3). Every
// coin is a 48 dp-plus target that opens the badge's sheet.
import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../logic/milestone_progress.dart';
import '../logic/milestone_tracks.dart';
import 'medal.dart';
import 'milestone_track_card.dart' show engravingOf;
import 'step_sheet.dart';

/// The five coins on You and the badge they lead to next.
class BadgeRowModel {
  BadgeRowModel._(this.coins, this.next, this.earned, this.total, this.previous);

  factory BadgeRowModel.of(List<TrackView> tracks) {
    final all = [for (final t in tracks) ...t.steps];
    final previous = <String, StepView>{};
    for (final t in tracks) {
      if (t.track == MilestoneTrack.best) continue;
      for (var i = 1; i < t.steps.length; i++) {
        previous[t.steps[i].step.id] = t.steps[i - 1];
      }
    }
    final earned = [for (final s in all) if (s.status == StepStatus.earned) s]..sort((a, b) => b.earnedAt!.compareTo(a.earnedAt!));
    final coins = <StepView>[...earned.take(3)];
    for (final s in all) {
      if (coins.length >= 5) break;
      if (s.status == StepStatus.next) coins.add(s);
    }
    for (final s in all) {
      if (coins.length >= 5) break;
      if (!coins.contains(s)) coins.add(s);
    }
    // The next badge leads with the student's own momentum: the path with the most earned.
    StepView? next;
    var most = -1;
    for (final t in tracks) {
      final n = t.next;
      if (n != null && t.earned.length > most) {
        most = t.earned.length;
        next = n;
      }
    }
    return BadgeRowModel._(coins, next, earned.length, all.length, previous);
  }

  final List<StepView> coins;
  final StepView? next;
  final int earned;
  final int total;
  final Map<String, StepView> previous;
}

class BadgeRow extends StatelessWidget {
  const BadgeRow({
    super.key,
    required this.tracks,
    required this.dateOf,
    this.progress = const {},
    this.freshIds = const {},
    this.loading = false,
  });

  final List<TrackView> tracks;
  final String Function(DateTime) dateOf;

  /// Exact counts toward the next badges (`milestoneProgress`).
  final Map<String, int> progress;

  /// Badge ids that landed since the last visit: their coin plays its landing once.
  final Set<String> freshIds;

  /// Ghost coins with the final height, so nothing jumps when data lands.
  final bool loading;

  static const double coin = 52;
  static const double slotHeight = 96;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    if (loading) {
      return SkeletonGroup(
        label: RhythmCopy.badgesTitle,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Skeleton.line(width: 120, height: 14),
            const SizedBox(height: MmSpace.s12),
            SizedBox(
              height: slotHeight,
              child: Row(
                children: [
                  for (var i = 0; i < 5; i++)
                    const Expanded(child: Align(alignment: Alignment.topCenter, child: Skeleton.circle(size: coin))),
                ],
              ),
            ),
            const Skeleton.line(width: 240, height: 14),
          ],
        ),
      );
    }
    final model = BadgeRowModel.of(tracks);
    final next = model.next;
    final nextCount = next == null ? null : progress[next.step.id];
    final nextTarget = next == null ? null : milestoneTargets[next.step.id];
    final counted = nextCount != null && nextTarget != null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(RhythmCopy.badgesEarned(model.earned, model.total), style: type.small.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s12),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final view in model.coins)
              Expanded(
                child: _CoinSlot(
                  view: view,
                  dateOf: dateOf,
                  fresh: freshIds.contains(view.step.id),
                  count: view.status == StepStatus.next ? progress[view.step.id] : null,
                  onTap: () => showStepSheet(
                    context,
                    view: view,
                    dateOf: dateOf,
                    previous: model.previous[view.step.id],
                    count: view.status == StepStatus.next ? progress[view.step.id] : null,
                  ),
                ),
              ),
          ],
        ),
        if (next != null) ...[
          const SizedBox(height: MmSpace.s8),
          Text(
            counted
                ? RhythmCopy.badgeNextCounted(next.step.name, nextCount, nextTarget)
                : RhythmCopy.badgeNext(next.step.name, next.step.condition),
            style: type.body,
          ),
          if (counted) ...[
            const SizedBox(height: MmSpace.s8),
            _NextBar(fraction: (nextCount / nextTarget).clamp(0.0, 1.0)),
          ],
        ],
      ],
    );
  }
}

class _CoinSlot extends StatelessWidget {
  const _CoinSlot({required this.view, required this.dateOf, required this.fresh, required this.count, required this.onTap});

  final StepView view;
  final String Function(DateTime) dateOf;
  final bool fresh;
  final int? count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final face = engravingOf(view.step.id);
    final earned = view.status == StepStatus.earned;
    final label = earned
        ? RhythmCopy.badgeCoinEarned(view.step.name, dateOf(view.earnedAt!))
        : RhythmCopy.badgeCoinNotYet(view.step.name, view.step.condition);
    return MmPressable(
      onTap: onTap,
      haptic: MmPressHaptic.selection,
      pressedScale: 0.96,
      focusRadius: MmRadius.smallAll,
      semanticsLabel: label,
      builder: (context, pressed, focused) => SizedBox(
        height: BadgeRow.slotHeight,
        child: Column(
          children: [
            const SizedBox(height: MmSpace.s4),
            Medal(
              status: switch (view.status) {
                StepStatus.earned => MedalStatus.landed,
                StepStatus.next => MedalStatus.next,
                StepStatus.later => MedalStatus.later,
              },
              icon: face.icon,
              text: face.text,
              size: BadgeRow.coin,
              animateLanding: fresh,
              arc: count == null ? null : milestoneFraction(view.step.id, {view.step.id: count!}),
            ),
            const SizedBox(height: MmSpace.s4),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s2),
              child: Text(
                view.step.name,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                textScaler: MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.15),
                style: type.caption.copyWith(fontSize: 12, height: 15 / 12, color: earned ? colors.ink : colors.ink2),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A 4 dp bar that fills to [fraction] once, on first view (`countUp` 720 ms on `out`).
class _NextBar extends StatelessWidget {
  const _NextBar({required this.fraction});

  final double fraction;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: fraction),
        duration: Motion.of(context, const Duration(milliseconds: 720)),
        curve: Motion.out,
        builder: (context, value, _) => ClipRRect(
          borderRadius: BorderRadius.circular(2),
          child: SizedBox(
            height: 4,
            child: Stack(
              fit: StackFit.expand,
              children: [
                ColoredBox(color: colors.line),
                FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  widthFactor: value,
                  child: ColoredBox(color: colors.volt),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
