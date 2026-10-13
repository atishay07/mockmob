import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/analytics/analytics.dart';
import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/copy/copy.dart';
import '../../../core/repositories/repositories.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/goal_pause.dart';
import '../widgets/you_page.dart';
import 'goal_picker.dart';

/// The weekly goal editor (spec 5.11 and 6.1): days per week, 1 to 7. The goal is what the
/// server holds; the screen shows "saved" only after the server answers.
class GoalScreen extends ConsumerStatefulWidget {
  const GoalScreen({super.key});

  @override
  ConsumerState<GoalScreen> createState() => _GoalScreenState();
}

class _GoalScreenState extends ConsumerState<GoalScreen> {
  int? _picked;
  bool _saving = false;
  bool _changedElsewhere = false;
  String? _error;
  DateTime? _savedAt;
  final MobiController _mobi = MobiController();

  @override
  void dispose() {
    _mobi.dispose();
    super.dispose();
  }

  Future<void> _save(int days, String? pausedUntil) async {
    setState(() {
      _saving = true;
      _error = null;
      _savedAt = null;
    });
    try {
      // The pause stays as it is: saving without it would end the pause.
      await ref.read(goalRepositoryProvider.notifier).save(daysPerWeek: days, pausedUntil: pausedUntil);
      _track(days);
      if (!mounted) return;
      setState(() {
        _saving = false;
        // What the student picked is now what the server holds: from here the picker follows
        // the server again, so a later change from another phone is never overwritten by it.
        _picked = null;
        _changedElsewhere = false;
        _savedAt = ref.read(nowProvider)();
      });
      // Only after the server answered.
      _mobi.play(MobiAct.cheer);
    } on ApiError catch (e) {
      if (!mounted) return;
      _mobi.play(MobiAct.oops);
      setState(() {
        _saving = false;
        _error = e.isOffline
            ? YouCopy.goalOffline
            : e.kind == ApiErrorKind.validation
                ? YouCopy.goalRejected
                : YouCopy.goalFailed;
      });
    }
  }

  /// Usage data is best effort and gated by consent inside the client; it never affects a save.
  void _track(int days) {
    try {
      ref.read(analyticsClientProvider).track(AnalyticsEvents.goalSet, props: {'count': days});
    } on Object {
      // Not collected.
    }
  }

  @override
  Widget build(BuildContext context) {
    // The goal changed on the server (another phone, a refresh) while a pick was waiting: the
    // pick is dropped, so Save cannot write a stale number over the newer one.
    ref.listen<int?>(goalRepositoryProvider.select((s) => s.value?.daysPerWeek), (before, now) {
      if (_saving || now == null || now == before || _picked == null) return;
      setState(() {
        _picked = null;
        _changedElsewhere = true;
      });
    });
    final state = ref.watch(goalRepositoryProvider);
    final goal = state.value;

    if (goal == null) {
      return YouPage(
        title: YouCopy.goalTitle,
        children: [
          if (state.isFailedEmpty)
            SizedBox(
              height: 480,
              child: StateView(
                kind: StateViewKind.error,
                title: YouCopy.goalLoadFailedTitle,
                message: YouCopy.goalLoadFailedBody,
                primary: StateAction(YouCopy.tryAgain, () => ref.read(goalRepositoryProvider.notifier).refresh()),
              ),
            )
          else
            const _GoalSkeleton(),
        ],
      );
    }

    final colors = context.mmColors;
    final type = context.mmType;
    final days = _picked ?? goal.daysPerWeek;
    final changed = days != goal.daysPerWeek;
    // A pause that has ended is not shown and is not sent back with a save.
    final now = ref.watch(nowProvider)();
    final pause = activePauseEnd(goal.pausedUntil, now);

    return YouPage(
      title: YouCopy.goalTitle,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (state.isStale) ...[
                const InlineBanner(message: YouCopy.goalStale),
                const SizedBox(height: MmSpace.s16),
              ],
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: Text(YouCopy.goalQuestion, style: type.lead)),
                  const SizedBox(width: MmSpace.s12),
                  Mobi(pose: MobiPose.idle, size: 56, controller: _mobi),
                ],
              ),
              if (_changedElsewhere) ...[
                const SizedBox(height: MmSpace.s12),
                Semantics(
                  liveRegion: true,
                  child: Text(YouCopy.goalChangedElsewhere, style: type.small.copyWith(color: colors.ink2)),
                ),
              ],
              const SizedBox(height: MmSpace.s24),
            ],
          ),
        ),
        // Seven 48 dp targets need 336 dp, more than the 328 dp inside the gutters of a 360 dp
        // phone, so the picker takes the full width less 4 dp a side.
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4),
          child: GoalPicker(
            value: days,
            onChanged: _saving
                ? null
                : (value) => setState(() {
                      _picked = value;
                      _changedElsewhere = false;
                      _error = null;
                      _savedAt = null;
                    }),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s32, MmSpace.gutter, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Semantics(
                container: true,
                liveRegion: true,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: MonumentalNumber(
                      value: '$days',
                      unit: YouCopy.goalUnit(days),
                      style: type.figure,
                      semanticsLabel: YouCopy.goalNote(days),
                    ),
                    ),
                    const SizedBox(height: MmSpace.s8),
                    Text(
                      days == 7 ? YouCopy.goalEveryDay : YouCopy.goalRestDays,
                      style: type.body.copyWith(color: colors.ink2),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: MmSpace.s12),
              Text(YouCopy.goalCounts, style: type.small.copyWith(color: colors.ink3)),
              if (pause != null) ...[
                const SizedBox(height: MmSpace.s12),
                Text(YouCopy.goalPaused(formatDayMonth(pause)), style: type.small.copyWith(color: colors.ink2)),
              ],
              const SizedBox(height: MmSpace.s32),
              if (_error != null) ...[
                InlineBanner(message: _error!, tone: BannerTone.error),
                const SizedBox(height: MmSpace.s16),
              ],
              KeyButton(
                label: YouCopy.goalSave,
                loading: _saving,
                onPressed: changed && !_saving ? () => _save(days, pauseToKeep(goal.pausedUntil, now)) : null,
              ),
              if (_savedAt != null) ...[
                const SizedBox(height: MmSpace.s16),
                ReceiptLine(text: YouCopy.goalSaved(_savedAt!)),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _GoalSkeleton extends StatelessWidget {
  const _GoalSkeleton();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, 0),
      child: SkeletonGroup(
        label: 'Loading your goal',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Skeleton.line(width: 260, height: 18),
            SizedBox(height: MmSpace.s24),
            Skeleton(height: 44, radius: 22),
            SizedBox(height: MmSpace.s32),
            Skeleton.line(width: 160, height: 32),
            SizedBox(height: MmSpace.s12),
            Skeleton.line(width: 220),
          ],
        ),
      ),
    );
  }
}
