// The first load (spec 5.3): static shapes at the real heights of the hero and the sheet rows, so
// nothing jumps when the record arrives. It appears only after 400 ms; a fast load never
// flashes it. No shimmer.
import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import 'hero_stage.dart';

/// Height the loaded move hero usually takes, so the swap does not shift the page.
const double heroSkeletonHeight = 468;

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
                  children: [
                    const Skeleton.line(width: 96, height: 12),
                    const SizedBox(height: MmSpace.s8),
                    const Skeleton.line(width: 120),
                    const Spacer(),
                    const Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Skeleton(width: 64, height: 92, radius: 14),
                        SizedBox(width: MmSpace.s12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [Skeleton.line(width: 110, height: 18), SizedBox(height: 6), Skeleton.line(width: 84, height: 18)],
                        ),
                      ],
                    ),
                    const SizedBox(height: MmSpace.s16),
                    const Skeleton.line(),
                    const SizedBox(height: MmSpace.s8),
                    const Skeleton.line(width: 180),
                    const SizedBox(height: MmSpace.s24),
                    const Skeleton(height: 56, radius: 28),
                    const SizedBox(height: MmSpace.s20),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: MmSpace.group),
          const Skeleton.line(width: 120, height: 20),
          for (var i = 0; i < 3; i++) ...[
            const SizedBox(height: MmSpace.s20),
            const Skeleton.line(width: 200),
            const SizedBox(height: MmSpace.s8),
            const Skeleton(height: 8, radius: 4),
          ],
        ],
      ),
    );
  }
}
