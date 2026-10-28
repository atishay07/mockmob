// `/today/week`: the week sheet. A sheet body only (no Scaffold): `MmSheetPage` supplies the frame.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/repositories/rhythm_repository.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/rhythm_prefs.dart';
import '../data/rhythm_providers.dart';
import '../logic/week_view.dart';
import '../widgets/rhythm_page.dart';
import '../widgets/week_marks.dart';

class WeekSheet extends ConsumerStatefulWidget {
  const WeekSheet({super.key});

  @override
  ConsumerState<WeekSheet> createState() => _WeekSheetState();
}

class _WeekSheetState extends ConsumerState<WeekSheet> {
  @override
  void initState() {
    super.initState();
    // Sheet opened: one `open` haptic (spec 3.3).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) ref.read(hapticsProvider).open();
    });
  }

  @override
  Widget build(BuildContext context) {
    final prefs = ref.watch(rhythmPrefsProvider);
    final snapshot = ref.watch(rhythmSnapshotProvider);
    return WeekSheetBody(
      snapshot: snapshot,
      rhythmOff: prefs.loaded && prefs.hidden,
      onRetry: () => ref.read(rhythmRepositoryProvider.notifier).refresh(force: true),
      onTurnOn: () => ref.read(rhythmActionsProvider).setRhythmHidden(false),
      onSeeRhythm: () {
        final router = GoRouter.of(context);
        Navigator.of(context).maybePop();
        router.push(AppRoutes.youRhythm);
      },
    );
  }
}

/// The sheet content for a given state; goldens render it directly.
class WeekSheetBody extends StatelessWidget {
  const WeekSheetBody({
    super.key,
    required this.snapshot,
    required this.rhythmOff,
    required this.onRetry,
    required this.onTurnOn,
    required this.onSeeRhythm,
  });

  final RhythmSnapshot snapshot;
  final bool rhythmOff;
  final VoidCallback onRetry;
  final VoidCallback onTurnOn;
  final VoidCallback onSeeRhythm;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;

    final Widget content;
    if (rhythmOff) {
      content = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(RhythmCopy.rhythmOffTitle, style: type.subhead),
          const SizedBox(height: MmSpace.s4),
          Text(RhythmCopy.rhythmOffBody, style: type.body.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s16),
          KeyButton.secondary(label: RhythmCopy.turnOnRhythm, onPressed: onTurnOn),
        ],
      );
    } else if (snapshot.isInitialLoading) {
      content = const SkeletonGroup(
        label: 'Loading this week',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Skeleton(height: 56),
            SizedBox(height: MmSpace.s12),
            Skeleton.line(width: 160),
            SizedBox(height: MmSpace.s8),
            Skeleton.line(width: 220),
          ],
        ),
      );
    } else if (!snapshot.hasData) {
      content = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(RhythmCopy.weekLoadFailed, style: type.body.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s16),
          KeyButton.secondary(label: RhythmCopy.tryAgain, onPressed: onRetry),
        ],
      );
    } else {
      content = _Loaded(snapshot: snapshot, onSeeRhythm: onSeeRhythm);
    }

    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Semantics(header: true, child: Text(RhythmCopy.weekTitle, style: type.title)),
          const SizedBox(height: MmSpace.s16),
          content,
        ],
      ),
    );
  }
}

class _Loaded extends StatelessWidget {
  const _Loaded({required this.snapshot, required this.onSeeRhythm});

  final RhythmSnapshot snapshot;
  final VoidCallback onSeeRhythm;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final rhythm = snapshot.rhythm!;
    final week = snapshot.week!;
    final counts = RhythmCopy.weekCounts(mocks: rhythm.mocksThisWeek, repairs: rhythm.repairsThisWeek);
    final note = runNote(rhythm);

    final secondary = switch (week.status) {
      WeekStatus.paused => RhythmCopy.pausedKeepsRun,
      WeekStatus.open => RhythmCopy.goalSentence(week.goal),
      WeekStatus.met || WeekStatus.extra => null,
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (snapshot.stale && snapshot.fetchedAt != null) ...[
          Text(RhythmCopy.asOf(snapshot.fetchedAt!), style: type.small.copyWith(color: colors.ink3)),
          const SizedBox(height: MmSpace.s8),
        ],
        WeekMarks(week: week),
        const SizedBox(height: MmSpace.s16),
        Text(week.label, style: type.subhead),
        if (secondary != null) ...[
          const SizedBox(height: MmSpace.s4),
          Text(secondary, style: type.body.copyWith(color: colors.ink2)),
        ],
        if (counts != null) ...[
          const SizedBox(height: MmSpace.s12),
          Text(counts, style: type.body),
        ],
        const SizedBox(height: MmSpace.s12),
        Text(note ?? weeksInRhythmText(rhythm), style: type.body.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s16),
        FlushQuietKey(label: RhythmCopy.seeRhythm, onPressed: onSeeRhythm),
      ],
    );
  }
}
