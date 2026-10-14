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
import 'run_ribbon.dart';

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
  const ReturningCard({super.key, required this.rhythm, this.extraLine, this.actionLabel, this.onAction});

  final Rhythm rhythm;

  /// The one next step ("Review your 3 mistakes") and what it does. The key shows only when both
  /// are given; Today owns the data behind it.
  final String? actionLabel;
  final VoidCallback? onAction;

  /// One line from Today, such as "Your last mock was Mock 7 on 2 October. Your 3 mistakes from
  /// it are still here."
  final String? extraLine;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final weeks = [for (final w in closedWeeks(rhythm)) if (w.studyDays > 0) w].take(returningWeeksShown).toList();
    final greet = returningGreetsWithMobi(rhythm);
    final ribbon = closedRibbonWeeks(weeks);

    return FakeGlass(
      child: Padding(
      padding: const EdgeInsets.all(MmSpace.cardPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              if (greet) ...[const Mobi(pose: MobiPose.greet, size: 88, motion: MobiMotion.settle), const SizedBox(width: MmSpace.s16)],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Semantics(header: true, child: Text(RhythmCopy.welcomeBack, style: type.headline)),
                    const SizedBox(height: MmSpace.s4),
                    // Said plainly and in full ink: this is the reassurance, not a footnote.
                    Text(RhythmCopy.nothingLost, style: type.body.copyWith(color: colors.ink, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            ],
          ),
          if (extraLine != null) ...[
            const SizedBox(height: MmSpace.s12),
            Text(extraLine!, style: type.body),
          ],
          const SizedBox(height: MmSpace.s12),
          if (weeks.isNotEmpty) ...[
            // The weeks that had study in them, as the same capsules the rhythm screen draws.
            RunRibbon(weeks: ribbon, showCounts: true),
          ],
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: MmSpace.s16),
            KeyButton(label: actionLabel!, onPressed: onAction),
          ],
        ],
      ),
      ),
    );
  }
}

/// The Today host: shows the card only while the student is returning and rhythm is on.
class ReturningSection extends ConsumerWidget {
  const ReturningSection({super.key, this.extraLine, this.actionLabel, this.onAction});

  final String? extraLine;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(rhythmVisibleProvider)) return const SizedBox.shrink();
    final rhythm = ref.watch(rhythmSnapshotProvider.select((s) => s.rhythm));
    if (rhythm == null || !showReturning(rhythm)) return const SizedBox.shrink();
    return ReturningCard(rhythm: rhythm, extraLine: extraLine, actionLabel: actionLabel, onAction: onAction);
  }
}
