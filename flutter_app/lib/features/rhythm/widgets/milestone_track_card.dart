// One milestone path (papers, repairs, weeks at your goal) as a card: its brass token, standing
// once any step has landed and a faint ghost until then; the steps on one rail, inked when the
// server dated them, ringed when next, quiet after that; then the next step with exactly what
// lands it and, where the app can count it, how far along it is; and the record behind the path.
// No locks, no streak pressure, nothing expires. When a step just landed (a fresh row), the card
// plays its earned moment once: the token settles while a ring sweeps round it, and Mobi
// celebrates beside the title with one line naming the step.
import 'package:flutter/material.dart';


import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../logic/milestone_progress.dart';
import '../logic/milestone_tracks.dart';
import '../logic/tokens.dart';
import 'earned_token.dart';
import 'rhythm_page.dart' show FlushQuietKey;
import 'locked_coin.dart';

class MilestoneTrackCard extends StatelessWidget {
  const MilestoneTrackCard({
    super.key,
    required this.track,
    required this.dateOf,
    this.progress = const {},
    this.freshIds = const {},
    this.onOpen,
  });

  final TrackView track;

  /// "9 October" for an earned step.
  final String Function(DateTime) dateOf;
  final Map<String, int> progress;
  final Set<String> freshIds;
  final VoidCallback? onOpen;

  MilestoneToken get _token => MilestoneToken.values.firstWhere((t) => t.track == track.track);

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final earned = track.earned.length;
    final total = track.steps.length;
    final next = track.next;
    final count = next == null ? null : progress[next.step.id];
    final target = next == null ? null : milestoneTargets[next.step.id];
    // The newest step of this path that landed since the last visit, if any.
    StepView? landed;
    for (final s in track.earned) {
      if (freshIds.contains(s.step.id) && (landed == null || s.earnedAt!.isAfter(landed.earnedAt!))) landed = s;
    }
    return FakeGlass(
      borderRadius: MmRadius.panelAll,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.cardPadding, MmSpace.s16, MmSpace.cardPadding, MmSpace.s12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                _TokenArt(token: _token, earned: earned > 0, justLanded: landed != null),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Semantics(header: true, child: Text(track.track.title, style: type.title.copyWith(fontSize: 20, height: 24 / 20))),
                      const SizedBox(height: 2),
                      Text(RhythmCopy.trackCount(earned, total), style: type.caption.copyWith(color: colors.ink2)),
                      if (landed != null) ...[
                        const SizedBox(height: 2),
                        Semantics(
                          liveRegion: true,
                          child: Text(
                            RhythmCopy.stepJustLanded(landed.step.name),
                            style: type.caption.copyWith(color: colors.accentText, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                if (landed != null) ...[
                  const SizedBox(width: MmSpace.s8),
                  const Mobi(pose: MobiPose.celebrating, size: 52, motion: MobiMotion.hop),
                ],
              ],
            ),
            const SizedBox(height: MmSpace.s16),
            _StepRail(steps: track.steps, dateOf: dateOf, freshIds: freshIds),
            const SizedBox(height: MmSpace.s12),
            if (next != null)
              _NextPanel(view: next, count: count, target: target)
            else
              Text(RhythmCopy.trackComplete, style: type.caption.copyWith(color: colors.ink2)),
            if (earned > 0 && onOpen != null)
              Align(alignment: Alignment.centerLeft, child: FlushQuietKey(label: track.track.linkLabel, onPressed: onOpen!)),
          ],
        ),
      ),
    );
  }
}

class _TokenArt extends StatelessWidget {
  const _TokenArt({required this.token, required this.earned, this.justLanded = false});

  final MilestoneToken token;
  final bool earned;

  /// A step of this path landed since the last visit: the token plays its earned moment.
  final bool justLanded;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    if (!earned) return LockedCoin(token, size: 64);
    if (justLanded) return EarnedToken(child: ArtImage(token.art, width: 54, height: 54));
    return SizedBox.square(
      dimension: 64,
      child: DecoratedBox(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(colors: [colors.lamp.withValues(alpha: earned ? (colors.isNight ? 0.16 : 0.18) : 0.05), colors.lamp.withValues(alpha: 0)]),
        ),
        child: Padding(
          padding: const EdgeInsets.all(4),
          child: ArtImage(token.art, width: 56, height: 56, opacity: earned ? 1 : 0.22, ghost: !earned),
        ),
      ),
    );
  }
}

/// The steps of a path on one rail.
class _StepRail extends StatelessWidget {
  const _StepRail({required this.steps, required this.dateOf, required this.freshIds});

  final List<StepView> steps;
  final String Function(DateTime) dateOf;
  final Set<String> freshIds;

  static const double _node = 18;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Stack(
      children: [
        // The rail, from the first node's centre to the last's.
        Positioned(
          left: 0,
          right: 0,
          top: _node / 2 + 2 - 0.75,
          child: LayoutBuilder(
            builder: (context, c) {
              final slot = c.maxWidth / steps.length;
              return Padding(
                padding: EdgeInsets.symmetric(horizontal: slot / 2),
                child: SizedBox(height: 1.5, child: ColoredBox(color: colors.lineStrong)),
              );
            },
          ),
        ),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [for (final s in steps) Expanded(child: _Step(view: s, dateOf: dateOf, fresh: freshIds.contains(s.step.id)))],
        ),
      ],
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({required this.view, required this.dateOf, required this.fresh});

  final StepView view;
  final String Function(DateTime) dateOf;
  final bool fresh;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final name = view.step.name;
    final date = view.earnedAt == null ? null : dateOf(view.earnedAt!);
    final (Widget node, String label) = switch (view.status) {
      StepStatus.earned => (const Bubble(state: BubbleState.filled, size: 18, animate: false), RhythmCopy.stepEarned(name, date!)),
      StepStatus.next => (const Bubble(state: BubbleState.hollow, size: 14, emphasis: true, animate: false), RhythmCopy.stepNext(name, view.step.condition)),
      StepStatus.later => (const Bubble(state: BubbleState.hollow, size: 12, animate: false), RhythmCopy.stepLater(name)),
    };
    final step = Semantics(
      container: true,
      label: label,
      excludeSemantics: true,
      child: Column(
        children: [
          SizedBox(
            height: 22,
            child: Center(
              // A disc of the card's colour keeps the rail from running through the ring.
              child: DecoratedBox(decoration: BoxDecoration(shape: BoxShape.circle, color: colors.isNight ? colors.raised : colors.raised), child: node),
            ),
          ),
          const SizedBox(height: MmSpace.s6),
          Text(
            name,
            textAlign: TextAlign.center,
            style: type.caption.copyWith(
              fontSize: 12,
              height: 15 / 12,
              fontWeight: view.status == StepStatus.later ? FontWeight.w500 : FontWeight.w600,
              color: view.status == StepStatus.later ? colors.ink3 : colors.ink,
            ),
          ),
          if (date != null)
            Text(date, textAlign: TextAlign.center, style: type.caption.copyWith(fontSize: 11, height: 15 / 11, color: colors.ink3)),
        ],
      ),
    );
    if (!fresh || Motion.reduced(context)) return step;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Motion.milestone,
      curve: Motion.out,
      builder: (context, t, child) => Opacity(opacity: t, child: Transform.scale(scale: 0.9 + 0.1 * t, child: child)),
      child: step,
    );
  }
}

/// The next step: what it is, exactly what lands it, and a bar when the count is exact.
class _NextPanel extends StatelessWidget {
  const _NextPanel({required this.view, this.count, this.target});

  final StepView view;
  final int? count;
  final int? target;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final counted = count != null && target != null;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.ink.withValues(alpha: colors.isNight ? 0.05 : 0.04),
        borderRadius: MmRadius.smallAll,
        border: Border.all(color: colors.line),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s12, MmSpace.s12, MmSpace.s12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              RhythmCopy.nextLabel,
              style: type.caption.copyWith(fontSize: 12, height: 16 / 12, fontWeight: FontWeight.w700, color: colors.accentText),
            ),
            const SizedBox(height: 2),
            Text(view.step.name, style: type.labelLarge.copyWith(fontSize: 16)),
            const SizedBox(height: 2),
            Text(view.step.condition, style: type.caption.copyWith(color: colors.ink2)),
            if (counted) ...[
              const SizedBox(height: MmSpace.s12),
              Semantics(
                label: RhythmCopy.soFar(count!, target!),
                excludeSemantics: true,
                child: Row(
                  children: [
                    Expanded(
                      child: ClipRRect(
                        borderRadius: MmRadius.pillAll,
                        child: SizedBox(
                          height: 6,
                          child: Stack(
                            children: [
                              Positioned.fill(child: ColoredBox(color: colors.ink.withValues(alpha: 0.08))),
                              Positioned.fill(
                                child: FractionallySizedBox(
                                  alignment: Alignment.centerLeft,
                                  widthFactor: (count! / target!).clamp(0.0, 1.0),
                                  child: ColoredBox(color: colors.isNight ? colors.volt : colors.accentText),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: MmSpace.s12),
                    Text(RhythmCopy.soFar(count!, target!), style: type.caption.copyWith(color: colors.ink2, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
