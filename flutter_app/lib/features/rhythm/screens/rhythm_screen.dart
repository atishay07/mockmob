// `/you/rhythm`: the You rhythm screen (spec 5.11).
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/art/hybrid/hybrid.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/repositories/rhythm_repository.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/rhythm_prefs.dart';
import '../data/rhythm_providers.dart';
import '../data/study_days.dart';
import '../logic/week_view.dart';
import '../widgets/goal_editor.dart';
import '../widgets/rhythm_body.dart';
import '../widgets/rhythm_page.dart';

class YouRhythmScreen extends ConsumerStatefulWidget {
  const YouRhythmScreen({super.key});

  @override
  ConsumerState<YouRhythmScreen> createState() => _YouRhythmScreenState();
}

class _YouRhythmScreenState extends ConsumerState<YouRhythmScreen> {
  bool _busy = false;
  String? _error;

  /// The receipt of the last save the server acknowledged (study days).
  String? _saved;

  /// Runs a write, keeps the keys still while it is in flight, and names a recovery on failure.
  Future<void> _run(Future<void> Function() write, String failure) async {
    setState(() {
      _busy = true;
      _error = null;
      _saved = null;
    });
    try {
      await write();
    } on Object {
      if (mounted) _error = failure;
    }
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _editGoal(int current) async {
    final saved = await showGoalEditor(context, initialDays: current, done: ref.read(rhythmSnapshotProvider).rhythm?.studyDays ?? 0);
    if (saved == null || !mounted) return;
    ref.read(hapticsProvider).settle();
    setState(() {
      _error = null;
      _saved = ref.read(rhythmActionsProvider).studyDaysReceipt(saved);
    });
  }

  Future<void> _confirmTurnOff() async {
    final confirmed = await showMmSheet<bool>(
      context: context,
      title: RhythmCopy.turnOffConfirmTitle,
      builder: (sheet) => _TurnOffConfirm(),
    );
    if (confirmed == true) await ref.read(rhythmActionsProvider).setRhythmHidden(true);
  }

  @override
  Widget build(BuildContext context) {
    final snapshot = ref.watch(rhythmSnapshotProvider);
    final prefs = ref.watch(rhythmPrefsProvider);
    final actions = ref.read(rhythmActionsProvider);

    final Widget body;
    if (snapshot.isInitialLoading) {
      body = const _LoadingBody();
    } else if (!snapshot.hasData) {
      body = StateView(
        kind: StateViewKind.error,
        title: RhythmCopy.rhythmLoadFailedTitle,
        message: RhythmCopy.rhythmLoadFailedBody,
        primary: StateAction(RhythmCopy.tryAgain, () => ref.read(rhythmRepositoryProvider.notifier).refresh(force: true)),
      );
    } else {
      body = RhythmBody(
        snapshot: snapshot,
        rhythmOff: prefs.loaded && prefs.hidden,
        mode: prefs.mode,
        busy: _busy,
        errorText: _error,
        savedText: _saved,
        plan: ref.watch(studyDayPlanProvider),
        onEditGoal: () => _editGoal(snapshot.goal?.daysPerWeek ?? snapshot.rhythm!.daysGoal),
        onPauseThisWeek: () => _run(actions.pauseThisWeek, RhythmCopy.pauseFailed),
        onPauseTwoWeeks: () => _run(actions.pauseTwoWeeks, RhythmCopy.pauseFailed),
        onPauseUntilOn: () => _run(actions.pauseUntilTurnedOn, RhythmCopy.pauseFailed),
        onResume: () => _run(actions.resume, RhythmCopy.pauseFailed),
        onTurnOff: _confirmTurnOff,
        onTurnOn: () => actions.setRhythmHidden(false),
        onMode: (m) => ref.read(rhythmPrefsProvider.notifier).setMode(m),
      );
    }
    final scrolls = snapshot.hasData || snapshot.isInitialLoading;
    final week = snapshot.hasData && !(prefs.loaded && prefs.hidden) ? snapshot.week : null;
    return RhythmPage(
      title: RhythmCopy.rhythmTitle,
      scrollable: scrolls,
      trailing: week == null ? null : _WeekMetronome(week: week),
      child: body,
    );
  }
}

/// The metronome at the end of the header: when the week first shows it ticks once for each day
/// counted so far this week (at most 7, from the real week), then stands upright; a day counted
/// while the screen is open ticks once more. While the week is paused the arm leans on the side
/// of the slot. A week and count it has already ticked for in this run stand still, so coming
/// back to the screen does not replay it. Decorative: the ring and its words carry the week.
class _WeekMetronome extends StatefulWidget {
  const _WeekMetronome({required this.week});

  final WeekView week;

  /// The art's height; it stands a little past the 56 dp row, above and below.
  static const double height = 72;

  /// The weeks and counts already ticked in this run.
  static final Set<String> _ticked = {};

  @override
  State<_WeekMetronome> createState() => _WeekMetronomeState();
}

class _WeekMetronomeState extends State<_WeekMetronome> {
  late final int _firstTicks = _ticksFor(widget.week);
  late final int _firstDays = widget.week.studyDays;

  int _ticksFor(WeekView week) {
    final key = '${week.days.first.date}|${week.studyDays}';
    if (week.status == WeekStatus.paused || !_WeekMetronome._ticked.add(key)) return 0;
    return week.studyDays.clamp(0, 7);
  }

  @override
  Widget build(BuildContext context) {
    final week = widget.week;
    final paused = week.status == WeekStatus.paused;
    // Days counted while the screen is open add to the first ticks (one tick each), and are
    // marked as seen so a return to the screen stands still.
    final live = _firstTicks + math.max(0, week.studyDays - _firstDays).toInt();
    if (week.studyDays > _firstDays) _WeekMetronome._ticked.add('${week.days.first.date}|${week.studyDays}');
    return SizedBox(
      width: _WeekMetronome.height * HybridMetronome.spec.aspect,
      height: 56,
      child: OverflowBox(
        maxHeight: _WeekMetronome.height,
        child: HybridMetronome(height: _WeekMetronome.height, ticks: live, paused: paused),
      ),
    );
  }
}

class _TurnOffConfirm extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(RhythmCopy.turnOffConfirmBody, style: context.mmType.body.copyWith(color: context.mmColors.ink2)),
        const SizedBox(height: MmSpace.s24),
        KeyButton.secondary(label: RhythmCopy.turnOffConfirm, onPressed: () => Navigator.of(context).pop(true)),
        const SizedBox(height: MmSpace.s4),
        Align(child: KeyButton.quiet(label: RhythmCopy.cancel, onPressed: () => Navigator.of(context).pop(false))),
      ],
    );
  }
}

class _LoadingBody extends StatelessWidget {
  const _LoadingBody();

  @override
  Widget build(BuildContext context) {
    // The shape of the screen: the ring, a line under it, the run block, then the two plan rows.
    return const SkeletonGroup(
      label: RhythmCopy.loadingRhythm,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // The week hero's own box (232 dp: the 188 dp ring with air), a line under it, then the
          // run block and the plan rows, so nothing jumps when the data lands.
          SizedBox(height: 232, child: Center(child: Skeleton.circle(size: 188))),
          SizedBox(height: MmSpace.s16),
          Center(child: Skeleton.line(width: 220)),
          SizedBox(height: MmSpace.s32),
          MmSkeletonCard(),
          SizedBox(height: MmSpace.s32),
          MmSkeletonRows(rows: 2),
        ],
      ),
    );
  }
}
