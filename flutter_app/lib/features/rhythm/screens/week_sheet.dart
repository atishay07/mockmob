// `/today/week`: the week sheet. A sheet body only (no Scaffold): `MmSheetPage` supplies the frame.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
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
import '../widgets/rhythm_layout.dart' show kNumberRollDelay;
import '../widgets/rhythm_page.dart';
import '../logic/plan_week.dart';

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
    final saved = await showGoalEditor(context, initialDays: goal, done: snapshot.rhythm?.studyDays ?? 0);
    if (saved == null || !mounted) return;
    ref.read(hapticsProvider).settle();
    setState(() => _saved = ref.read(rhythmActionsProvider).studyDaysReceipt(saved));
  }

  // Opening the sheet gives no haptic of its own: the tap on the week row that opened it already
  // ticked (MOTION.md 1.6).

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
          KeyButton(label: RhythmCopy.turnOnRhythm, onPressed: onTurnOn),
        ],
      );
    } else if (snapshot.isInitialLoading) {
      content = const SkeletonGroup(
        label: RhythmCopy.loadingWeek,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Skeleton.circle(size: 92),
                SizedBox(width: MmSpace.s16),
                Expanded(child: MmSkeletonCard()),
              ],
            ),
            SizedBox(height: MmRhythm.group),
            MmSkeletonCard(),
          ],
        ),
      );
    } else if (!snapshot.hasData) {
      content = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(RhythmCopy.weekLoadFailed, style: type.body.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s16),
          KeyButton(label: RhythmCopy.tryAgain, onPressed: onRetry),
        ],
      );
    } else {
      content = _Loaded(snapshot: snapshot, onSeeRhythm: onSeeRhythm, plan: plan, onChangeDays: onChangeDays, onPauseWeek: onPauseWeek);
    }

    // The week's dates sit under the title, where they say which week this is.
    final monday = !rhythmOff && snapshot.hasData ? snapshot.week?.days.first.date : null;
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Semantics(header: true, child: Text(RhythmCopy.weekTitle, style: type.title)),
          if (monday != null) ...[
            const SizedBox(height: MmSpace.s2),
            Text(RhythmCopy.weekRange(monday), style: type.small.copyWith(color: colors.ink2)),
          ],
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
    final days = planWeek(
      studied: [for (final d in week.days) d.studyDay],
      todayIndex: todayIndex < 0 ? null : todayIndex,
      planned: plan,
      dates: [for (final d in week.days) d.date?.day],
    );
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

    final mocks = rhythm.mocksThisWeek ?? 0;
    final repairs = rhythm.repairsThisWeek ?? 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (snapshot.stale && snapshot.fetchedAt != null) ...[
          Text(RhythmCopy.asOf(snapshot.fetchedAt!), style: type.small.copyWith(color: colors.ink3)),
          const SizedBox(height: MmSpace.s8),
        ],
        // The shared study week: the ring and the count in words, then the seven days. Its key
        // shows on the first view and on a long press, never as a line of its own.
        StudyWeek(
          days: bubbleWeek(days),
          variant: StudyWeekVariant.ring,
          done: week.studyDays,
          goal: week.goal.clamp(1, 7),
          paused: week.status == WeekStatus.paused,
          headline: week.label,
          caption: secondary,
          ringSize: 96,
          animateIn: true,
        ),
        if (plan == null && onChangeDays != null) ...[
          const SizedBox(height: MmSpace.s8),
          Text(RhythmCopy.noPlanYet, style: type.small.copyWith(color: colors.ink2)),
          FlushQuietKey(label: RhythmCopy.setStudyDays, chevron: true, onPressed: onChangeDays!),
        ],
        if (outlook?.kind == OutlookKind.outOfReach && onPauseWeek != null) ...[
          const SizedBox(height: MmSpace.s12),
          _PauseKey(onPause: onPauseWeek!),
        ],
        const SizedBox(height: MmSpace.s16),
        Divider(height: 1, thickness: 1, color: colors.line),
        const SizedBox(height: MmSpace.s16),
        if (counts != null) ...[
          // The week's work as two small figures; the sentence is what a screen reader hears.
          Semantics(
            container: true,
            label: counts,
            excludeSemantics: true,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (mocks > 0) Expanded(child: _WorkFigure(value: mocks, label: mocks == 1 ? 'mock' : 'mocks')),
                if (repairs > 0) Expanded(child: _WorkFigure(value: repairs, label: repairs == 1 ? 'mistake repaired' : 'mistakes repaired')),
              ],
            ),
          ),
          const SizedBox(height: MmSpace.s16),
        ],
        Text(run, style: type.small.copyWith(color: colors.ink2)),
        // The rule is one tap away, not repeated on every sheet.
        const _RuleInfo(),
        if (onChangeDays != null && plan != null) FlushQuietKey(label: RhythmCopy.changeStudyDays, chevron: true, onPressed: onChangeDays!),
        const SizedBox(height: MmSpace.s8),
        QuietPill(label: RhythmCopy.seeRhythm, onPressed: onSeeRhythm),
      ],
    );
  }
}

/// "How a day counts": a quiet 48 dp row that opens the one-line rule under it and closes again.
class _RuleInfo extends StatefulWidget {
  const _RuleInfo();

  @override
  State<_RuleInfo> createState() => _RuleInfoState();
}

class _RuleInfoState extends State<_RuleInfo> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: MmPressable(
            onTap: () => setState(() => _open = !_open),
            semanticsLabel: RhythmCopy.howDayCounts,
            selected: _open,
            haptic: MmPressHaptic.selection,
            focusRadius: MmRadius.smallAll,
            builder: (context, pressed, _) => ConstrainedBox(
              constraints: const BoxConstraints(minHeight: MmTarget.min),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(LucideIcons.info, size: 16, color: colors.ink2),
                  const SizedBox(width: MmSpace.s8),
                  Text(RhythmCopy.howDayCounts, style: type.small.copyWith(color: colors.ink2, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ),
        ),
        MmSizeEase(
          duration: Motion.of(context, const Duration(milliseconds: 160)),
          curve: Motion.glide,
          alignment: Alignment.topCenter,
          child: _open
              ? Padding(
                  padding: const EdgeInsets.only(bottom: MmSpace.s8),
                  child: Semantics(liveRegion: true, child: Text(RhythmCopy.studyDayRule, style: type.caption.copyWith(color: colors.ink2))),
                )
              : const SizedBox(width: double.infinity),
        ),
      ],
    );
  }
}

/// A count of the week's work: the number in condensed Bricolage with its plain label beneath.
class _WorkFigure extends StatelessWidget {
  const _WorkFigure({required this.value, required this.label});

  final int value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // The figure's box is its ink, so the label sits 4 dp under it and the pair reads as one.
        MonumentalNumber(value: '$value', style: type.figureCompact, delay: kNumberRollDelay),
        const SizedBox(height: MmSpace.s4),
        Text(label, style: type.caption.copyWith(color: colors.ink2)),
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
        KeyButton(label: RhythmCopy.pauseThisWeekKey, onPressed: _busy ? null : _run, loading: _busy),
        if (_failed) ...[
          const SizedBox(height: MmSpace.s8),
          InlineBanner(message: RhythmCopy.pauseFailed, tone: BannerTone.error),
        ],
      ],
    );
  }
}
