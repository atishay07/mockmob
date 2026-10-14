// `/you/rhythm`: the You rhythm screen (spec 5.11).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/repositories/rhythm_repository.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/rhythm_prefs.dart';
import '../data/rhythm_providers.dart';
import '../data/study_days.dart';
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
    final saved = await showGoalEditor(context, initialDays: current);
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
    return RhythmPage(title: RhythmCopy.rhythmTitle, scrollable: scrolls, child: body);
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
        const SizedBox(height: 24),
        KeyButton.secondary(label: RhythmCopy.turnOffConfirm, onPressed: () => Navigator.of(context).pop(true)),
        const SizedBox(height: 8),
        Align(child: KeyButton.quiet(label: RhythmCopy.cancel, onPressed: () => Navigator.of(context).pop(false))),
      ],
    );
  }
}

class _LoadingBody extends StatelessWidget {
  const _LoadingBody();

  @override
  Widget build(BuildContext context) {
    return const SkeletonGroup(
      label: RhythmCopy.loadingRhythm,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Skeleton(height: 56),
          SizedBox(height: 12),
          Skeleton.line(width: 180),
          SizedBox(height: 32),
          Skeleton.line(width: 220),
          SizedBox(height: 20),
          Skeleton.line(width: 140),
          SizedBox(height: 20),
          Skeleton.line(width: 200),
        ],
      ),
    );
  }
}
