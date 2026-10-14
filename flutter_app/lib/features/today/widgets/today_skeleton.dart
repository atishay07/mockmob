// The first load (spec 5.3): shapes at the real heights of the hero and the paper rows, so
// nothing jumps when the record arrives. It appears only after 400 ms; a fast load never
// flashes it. The group's warm light band (on app-wide from main) sweeps across the hero bars
// and the rows as one field (ui-blitz/motion.md 3.8), at most four times, then holds still;
// reduced motion is static.
// The hero keeps its own bars (the shared MmSkeletonCard has no sentence or length chooser and
// puts the key straight under the number); the papers below use the shared MmSkeletonRows.
import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import 'hero_stage.dart';

/// Height the loaded move hero usually takes, so the swap does not shift the page.
const double heroSkeletonHeight = 496;

class TodaySkeleton extends StatefulWidget {
  const TodaySkeleton({super.key, this.delay = const Duration(milliseconds: 400)});

  final Duration delay;

  @override
  State<TodaySkeleton> createState() => _TodaySkeletonState();
}

class _TodaySkeletonState extends State<TodaySkeleton> {
  Timer? _timer;
  late bool _visible = widget.delay == Duration.zero;

  @override
  void initState() {
    super.initState();
    if (!_visible) _timer = Timer(widget.delay, () => mounted ? setState(() => _visible = true) : null);
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_visible) return const SizedBox(height: heroSkeletonHeight);
    return SkeletonGroup(
      label: TodayCopy.loading,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          HeroStage(
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
                    const SizedBox(height: MmSpace.s20),
                    const Skeleton.line(),
                    const SizedBox(height: MmSpace.s8),
                    const Skeleton.line(width: 180),
                    const Spacer(),
                    const Skeleton(height: 48, radius: 24),
                    const SizedBox(height: MmSpace.s20),
                    const Skeleton(height: 56, radius: 28),
                    const SizedBox(height: MmSpace.s20),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: MmRhythm.section),
          // "Recent papers" and its rows, on the ground as the loaded section is.
          const Skeleton.line(width: 132, height: 22),
          const SizedBox(height: MmRhythm.tight),
          const MmSkeletonRows(rows: 3),
        ],
      ),
    );
  }
}
