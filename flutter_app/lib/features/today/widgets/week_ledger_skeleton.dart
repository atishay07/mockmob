// What Today's week strip shows while the rhythm loads for the first time: the count line and the
// seven weekday columns and the key line at the loaded strip's heights (48 dp count row, 62 dp
// rail, and the rail's growth with large text), so nothing on Today jumps when the week arrives.
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import 'week_ledger.dart';

class WeekLedgerSkeleton extends StatelessWidget {
  const WeekLedgerSkeleton({super.key, this.bleed = 0});

  final double bleed;

  @override
  Widget build(BuildContext context) {
    final scaler = MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.3);
    return SkeletonGroup(
      label: 'Loading this week',
      shimmer: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: MmSpace.s4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: EdgeInsets.symmetric(horizontal: bleed + MmSpace.s4),
              child: const SizedBox(
                height: 48,
                child: Row(
                  children: [
                    Skeleton.line(width: 120, height: 16),
                    Spacer(),
                    Skeleton.line(width: 88, height: 12),
                  ],
                ),
              ),
            ),
            const SizedBox(height: MmSpace.s4),
            SizedBox(
              height: WeekLedger.railHeight + (scaler.scale(16) - 16),
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: bleed),
                child: Row(
                  children: [
                    for (var i = 0; i < 7; i++)
                      const Expanded(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Skeleton.line(width: 8, height: 10),
                            SizedBox(height: MmSpace.s12),
                            Skeleton.circle(size: 22),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ),
            // Most weeks carry a rest or a not-counted day, which earns the one-line key.
            const SizedBox(height: MmSpace.s8),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: MmSpace.s4 + bleed),
              child: SizedBox(height: 16, child: const Align(alignment: Alignment.centerLeft, child: Skeleton.line(width: 160, height: 10))),
            ),
          ],
        ),
      ),
    );
  }
}
