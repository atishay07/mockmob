// The calm return moment (spec 6.7): after 3 or more days away, one warm card with a small next
// step and what was kept. No guilt countdown, no "we miss you", no lost run. Today hosts it and
// may add one line of its own (the last mock and its waiting mistakes).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/rhythm.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/rhythm_prefs.dart';
import '../data/rhythm_providers.dart';
import '../logic/week_view.dart';

/// A student is "returning" after 3 or more days away (the server's `returning`).
bool showReturning(Rhythm rhythm) => rhythm.returning;

/// Mobi greets on every return the server flags (3 or more days away), the same rule as the
/// Today hero, so the two never disagree on one screen. BUILD-BRIEF section 12 and spec 6.7
/// ("after 3 or more days: Mobi greets once") replace the older 10-day row of the spec 6.3
/// matrix.
bool returningGreetsWithMobi(Rhythm rhythm) => showReturning(rhythm);

/// At most this many closed weeks show on the card, newest first, with real counts.
const int returningWeeksShown = 3;

class ReturningCard extends StatelessWidget {
  const ReturningCard({super.key, required this.rhythm, this.extraLine});

  final Rhythm rhythm;

  /// One line from Today, such as "Your last mock was Mock 7 on 2 October. Your 3 mistakes from
  /// it are still here."
  final String? extraLine;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final weeks = [for (final w in closedWeeks(rhythm)) if (w.studyDays > 0) w].take(returningWeeksShown).toList();
    final greet = returningGreetsWithMobi(rhythm);

    return FakeGlass(
      child: Padding(
      padding: const EdgeInsets.all(MmSpace.cardPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              if (greet) ...[const Mobi(pose: MobiPose.greet, size: 72, motion: MobiMotion.settle), const SizedBox(width: MmSpace.s16)],
              Expanded(child: Semantics(header: true, child: Text(RhythmCopy.welcomeBack, style: type.title))),
            ],
          ),
          if (extraLine != null) ...[
            const SizedBox(height: MmSpace.s12),
            Text(extraLine!, style: type.body),
          ],
          const SizedBox(height: MmSpace.s12),
          if (weeks.isEmpty)
            Text(RhythmCopy.nothingLost, style: type.body.copyWith(color: colors.ink2))
          else ...[
            for (var i = 0; i < weeks.length; i++)
              Padding(
                padding: const EdgeInsets.only(top: MmSpace.s4),
                child: Text(closedWeekText(weeks[i]), style: type.small.copyWith(color: colors.ink2)),
              ),
            const SizedBox(height: MmSpace.s8),
            Text(RhythmCopy.nothingLost, style: type.small.copyWith(color: colors.ink2)),
          ],
        ],
      ),
      ),
    );
  }
}

/// The Today host: shows the card only while the student is returning and rhythm is on.
class ReturningSection extends ConsumerWidget {
  const ReturningSection({super.key, this.extraLine});

  final String? extraLine;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(rhythmVisibleProvider)) return const SizedBox.shrink();
    final rhythm = ref.watch(rhythmSnapshotProvider.select((s) => s.rhythm));
    if (rhythm == null || !showReturning(rhythm)) return const SizedBox.shrink();
    return ReturningCard(rhythm: rhythm, extraLine: extraLine);
  }
}
