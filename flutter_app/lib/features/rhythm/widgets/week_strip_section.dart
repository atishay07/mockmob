// The Today week row (spec 6.1, 5.3): the core `WeekStrip` composed with its loading, stale and
// failed states. Hidden when the student turned rhythm off. One row, 44 dp and up, tap opens
// the week sheet.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/repositories/rhythm_repository.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../celebration/rhythm_watcher.dart';
import '../copy.dart';
import '../data/rhythm_prefs.dart';
import '../data/rhythm_providers.dart';

class WeekStripSection extends ConsumerWidget {
  const WeekStripSection({super.key, this.onOpen});

  /// Defaults to pushing the week sheet route.
  final VoidCallback? onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Today shows this row, so it also keeps the milestone watcher alive.
    ref.watch(rhythmWatcherProvider);
    if (!ref.watch(rhythmVisibleProvider)) return const SizedBox.shrink();
    final snapshot = ref.watch(rhythmSnapshotProvider);
    return WeekStripBody(
      snapshot: snapshot,
      onOpen: onOpen ?? () => context.push(AppRoutes.todayWeek),
      onRetry: () => ref.read(rhythmRepositoryProvider.notifier).refresh(force: true),
    );
  }
}

/// The states of the row, separated so goldens can render each one.
class WeekStripBody extends StatelessWidget {
  const WeekStripBody({super.key, required this.snapshot, required this.onOpen, required this.onRetry});

  final RhythmSnapshot snapshot;
  final VoidCallback onOpen;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    if (snapshot.isInitialLoading) {
      return const SkeletonGroup(
        label: 'Loading this week',
        child: SizedBox(
          height: 44,
          child: Row(
            children: [
              Expanded(child: Align(alignment: Alignment.centerLeft, child: Skeleton.line(width: 120))),
              SizedBox(width: MmSpace.s12),
              Skeleton(width: WeekStrip.width, height: WeekStrip.circle, radius: 14),
            ],
          ),
        ),
      );
    }
    if (snapshot.isFailedEmpty || !snapshot.hasData) {
      return Row(
        children: [
          Expanded(child: Text(RhythmCopy.weekLoadFailed, style: type.label.copyWith(color: colors.ink))),
          KeyButton.quiet(label: RhythmCopy.tryAgain, onPressed: onRetry),
        ],
      );
    }
    final week = snapshot.week!;
    final strip = WeekStrip(days: week.stripDays, label: week.label, onTap: onOpen);
    final asOf = snapshot.stale && snapshot.fetchedAt != null ? RhythmCopy.asOf(snapshot.fetchedAt!) : null;
    if (asOf == null) return strip;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [strip, Text(asOf, style: type.small.copyWith(color: colors.ink3))],
    );
  }
}
