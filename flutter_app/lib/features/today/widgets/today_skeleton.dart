// The first load (spec 5.3, TODAY-1017 4.2): the move card's shape at its resting height, so
// nothing jumps when the record arrives (the glance under it holds its own heights). It appears only after 400 ms; a fast load never
// flashes it. The group's warm light band (on app-wide from main) sweeps across the hero bars
// and the rows as one field (ui-blitz/motion.md 3.8), at most four times, then holds still;
// reduced motion is static.
// The hero keeps its own bars (the shared MmSkeletonCard has no sentence or length chooser and
// puts the key straight under the number); the papers below use the shared MmSkeletonRows.
import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import 'hero_stage.dart';

/// Height the loaded move hero usually takes, so the swap does not shift the page.
const double heroSkeletonHeight = 392;

class TodaySkeleton extends StatefulWidget {
  const TodaySkeleton({super.key, this.delay = const Duration(milliseconds: 400), this.onRetry, this.slowAfter = const Duration(seconds: 8)});

  final Duration delay;

  /// After [slowAfter] with nothing in hand, the skeleton says the connection looks slow and
  /// offers Try again (L01, state S2), which starts the read again.
  final VoidCallback? onRetry;
  final Duration slowAfter;

  @override
  State<TodaySkeleton> createState() => _TodaySkeletonState();
}

class _TodaySkeletonState extends State<TodaySkeleton> {
  Timer? _timer;
  Timer? _slowTimer;
  late bool _visible = widget.delay == Duration.zero;
  bool _slow = false;

  @override
  void initState() {
    super.initState();
    if (!_visible) _timer = Timer(widget.delay, () => mounted ? setState(() => _visible = true) : null);
    _slowTimer = Timer(widget.slowAfter, () => mounted ? setState(() => _slow = true) : null);
  }

  @override
  void dispose() {
    _timer?.cancel();
    _slowTimer?.cancel();
    super.dispose();
  }

  void _retry() {
    // The line goes while the read runs again, and comes back if it is still slow.
    setState(() => _slow = false);
    _slowTimer?.cancel();
    _slowTimer = Timer(widget.slowAfter, () => mounted ? setState(() => _slow = true) : null);
    widget.onRetry?.call();
  }

  @override
  Widget build(BuildContext context) {
    if (!_visible) return const SizedBox(height: heroSkeletonHeight);
    // Two groups, so the slow line and its key between them stay readable and reachable (a group
    // speaks only its label).
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SkeletonGroup(
          label: TodayCopy.loading,
          child: HeroStage(
            lit: false,
            child: SizedBox(
              height: heroSkeletonHeight,
              child: Padding(
                padding: const EdgeInsets.all(MmSpace.cardPadding),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  // The loaded hero's shape: overline and subject, the number with its meaning,
                  // the sentence, the length chooser and the key, at their real heights.
                  children: [
                    const Skeleton.line(width: 96, height: 12),
                    const SizedBox(height: MmSpace.s8),
                    const Skeleton.line(width: 150, height: 24),
                    const SizedBox(height: MmSpace.s16),
                    const Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Skeleton(width: 68, height: 100, radius: 14),
                        SizedBox(width: MmSpace.s12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [Skeleton.line(width: 96, height: 18), SizedBox(height: 6), Skeleton.line(width: 72, height: 18)],
                        ),
                      ],
                    ),
                    const SizedBox(height: MmSpace.s16),
                    const Skeleton.line(),
                    const SizedBox(height: MmSpace.s8),
                    const Skeleton.line(width: 180),
                    const Spacer(),
                    // The key, then the two pills under it.
                    const Skeleton(height: 56, radius: 28),
                    const SizedBox(height: MmSpace.s12),
                    const Row(
                      children: [
                        Expanded(child: Skeleton(height: 48, radius: 24)),
                        SizedBox(width: 10),
                        Expanded(child: Skeleton(height: 48, radius: 24)),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
          // Eight seconds and still nothing: say so, and offer the read again (S2).
          AnimatedSize(
            duration: Motion.of(context, Motion.card),
            curve: Motion.out,
            alignment: Alignment.topCenter,
            child: !_slow || widget.onRetry == null
                ? const SizedBox(width: double.infinity)
                : Padding(
                    padding: const EdgeInsets.only(top: MmSpace.s8),
                    child: Row(
                      children: [
                        Expanded(child: Text(TodayCopy.stillLoading, style: context.mmType.caption.copyWith(color: context.mmColors.ink2))),
                        KeyButton.quiet(label: TodayCopy.tryAgain, onPressed: _retry),
                      ],
                    ),
                  ),
          ),
      ],
    );
  }
}

/// The record card's place while its finding is read (L03): the card's one-finding height at 1x,
/// so the page under it does not move when the card arrives.
class InsightsSlot extends StatelessWidget {
  const InsightsSlot({super.key});

  static const double height = 168;

  @override
  Widget build(BuildContext context) => const SkeletonGroup(
        label: TodayCopy.loading,
        child: Skeleton(height: height, radius: MmRadius.panel),
      );
}
