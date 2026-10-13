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
import '../data/study_days.dart';
import '../logic/week_outlook.dart';
import '../widgets/goal_editor.dart';
import '../logic/week_view.dart';
import '../widgets/rhythm_page.dart';
import '../logic/plan_week.dart';
import '../widgets/plan_week_strip.dart';

class WeekSheet extends ConsumerStatefulWidget {
  const WeekSheet({super.key});

  @override
  ConsumerState<WeekSheet> createState() => _WeekSheetState();
}

class _WeekSheetState extends ConsumerState<WeekSheet> {
  /// The receipt after the study days editor saved, shown only once the server acknowledged.
  String? _saved;

  Future<void> _changeDays(RhythmSnapshot snapshot) async {
    final goal = snapshot.goal?.daysPerWeek ?? snapshot.rhythm?.daysGoal ?? 4;
    final saved = await showGoalEditor(context, initialDays: goal);
    if (saved == null || !mounted) return;
    ref.read(hapticsProvider).settle();
    setState(() => _saved = ref.read(rhythmActionsProvider).studyDaysReceipt(saved));
  }

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
      plan: ref.watch(studyDayPlanProvider),
      onChangeDays: () => _changeDays(snapshot),
      onPauseWeek: () => ref.read(rhythmActionsProvider).pauseThisWeek(),
      savedLine: _saved,
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
    this.plan,
    this.onChangeDays,
    this.onPauseWeek,
    this.savedLine,
  });

  final RhythmSnapshot snapshot;
  final bool rhythmOff;
  final VoidCallback onRetry;
  final VoidCallback onTurnOn;
  final VoidCallback onSeeRhythm;

  /// The student's study days (0 = Monday); the others are drawn as rest days.
  final Set<int>? plan;
  final VoidCallback? onChangeDays;
  final Future<void> Function()? onPauseWeek;

  /// The receipt of a study days save the server acknowledged.
  final String? savedLine;

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
        label: RhythmCopy.loadingWeek,
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
      content = _Loaded(snapshot: snapshot, onSeeRhythm: onSeeRhythm, plan: plan, onChangeDays: onChangeDays, onPauseWeek: onPauseWeek);
    }

    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Semantics(header: true, child: Text(RhythmCopy.weekTitle, style: type.title)),
          const SizedBox(height: MmSpace.s16),
          if (savedLine != null && !rhythmOff) ...[
            ReceiptLine(text: savedLine!),
            const SizedBox(height: MmSpace.s12),
          ],
          content,
        ],
      ),
    );
  }
}

class _Loaded extends StatelessWidget {
  const _Loaded({required this.snapshot, required this.onSeeRhythm, this.plan, this.onChangeDays, this.onPauseWeek});

  final RhythmSnapshot snapshot;
  final VoidCallback onSeeRhythm;
  final Set<int>? plan;
  final VoidCallback? onChangeDays;
  final Future<void> Function()? onPauseWeek;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final rhythm = snapshot.rhythm!;
    final week = snapshot.week!;
    final counts = RhythmCopy.weekCounts(mocks: rhythm.mocksThisWeek, repairs: rhythm.repairsThisWeek);
    final todayIndex = week.days.indexWhere((d) => d.isToday);
    final outlook = weekOutlook(
      studied: [for (final d in week.days) d.studyDay],
      todayIndex: todayIndex < 0 ? null : todayIndex,
      goal: week.goal,
      paused: week.status == WeekStatus.paused,
      planned: plan,
    );
    final monday = week.days.first.date;
    final days = planWeek(
      studied: [for (final d in week.days) d.studyDay],
      todayIndex: todayIndex < 0 ? null : todayIndex,
      planned: plan,
      dates: [for (final d in week.days) d.date?.day],
    );
    final strip = PlanWeekStrip(days: days, bubble: 28, showDates: true, daySemantics: true);

    final secondary = switch (week.status) {
      WeekStatus.paused => RhythmCopy.pausedKeepsRun,
      WeekStatus.open => outlook?.sentence ?? RhythmCopy.goalSentence(week.goal, hasPlan: plan != null && plan!.isNotEmpty),
      WeekStatus.met || WeekStatus.extra => null,
    };
    String sentence(String t) => t.endsWith('.') ? t : '$t.';
    final run = [
      sentence(runNote(rhythm) ?? weeksInRhythmText(rhythm)),
      if (rhythm.weeksMetStreak > 0 && rhythm.bestRun > rhythm.weeksMetStreak) '${RhythmCopy.bestRun(rhythm.bestRun)}.',
    ].join(' ');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (snapshot.stale && snapshot.fetchedAt != null) ...[
          Text(RhythmCopy.asOf(snapshot.fetchedAt!), style: type.small.copyWith(color: colors.ink3)),
          const SizedBox(height: MmSpace.s8),
        ],
        strip,
        const SizedBox(height: MmSpace.s4),
        PlanWeekKey(days: days),
        if (plan == null && onChangeDays != null) ...[
          const SizedBox(height: MmSpace.s8),
          Text(RhythmCopy.noPlanYet, style: type.small.copyWith(color: colors.ink2)),
          FlushQuietKey(label: RhythmCopy.setStudyDays, onPressed: onChangeDays!),
        ],
        const SizedBox(height: MmSpace.s16),
        Text(week.label, style: type.subhead),
        if (secondary != null) ...[
          const SizedBox(height: MmSpace.s4),
          Text(secondary, style: type.body.copyWith(color: colors.ink2)),
        ],
        if (outlook?.kind == OutlookKind.outOfReach && onPauseWeek != null) ...[
          const SizedBox(height: MmSpace.s12),
          _PauseKey(onPause: onPauseWeek!),
        ],
        const SizedBox(height: MmSpace.s16),
        Divider(height: 1, thickness: 1, color: colors.line),
        const SizedBox(height: MmSpace.s16),
        if (counts != null) ...[
          Text(counts, style: type.body),
          const SizedBox(height: MmSpace.s4),
        ],
        Text(run, style: type.body.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s12),
        Text(RhythmCopy.studyDayRule, style: type.caption.copyWith(color: colors.ink3)),
        if (monday != null) ...[
          const SizedBox(height: MmSpace.s2),
          Text(RhythmCopy.weekRange(monday), style: type.caption.copyWith(color: colors.ink3)),
        ],
        const SizedBox(height: MmSpace.s12),
        Wrap(
          spacing: MmSpace.s24,
          children: [
            if (onChangeDays != null && plan != null) FlushQuietKey(label: RhythmCopy.changeStudyDays, onPressed: onChangeDays!),
            FlushQuietKey(label: RhythmCopy.seeRhythm, onPressed: onSeeRhythm),
          ],
        ),
      ],
    );
  }
}

/// "Pause this week": a secondary key with its own recovery line when the server refuses.
class _PauseKey extends StatefulWidget {
  const _PauseKey({required this.onPause});

  final Future<void> Function() onPause;

  @override
  State<_PauseKey> createState() => _PauseKeyState();
}

class _PauseKeyState extends State<_PauseKey> {
  bool _busy = false;
  bool _failed = false;

  Future<void> _run() async {
    setState(() {
      _busy = true;
      _failed = false;
    });
    try {
      await widget.onPause();
      if (mounted) setState(() => _busy = false);
    } on Object {
      if (mounted) {
        setState(() {
          _busy = false;
          _failed = true;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        KeyButton.secondary(label: RhythmCopy.pauseThisWeekKey, onPressed: _busy ? null : _run, loading: _busy),
        if (_failed) ...[
          const SizedBox(height: MmSpace.s8),
          InlineBanner(message: RhythmCopy.pauseFailed, tone: BannerTone.error),
        ],
      ],
    );
  }
}
