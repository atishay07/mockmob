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
  String? _error;
  DateTime? _savedAt;

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
        _savedAt = ref.read(nowProvider)();
      });
    } on ApiError catch (e) {
      if (!mounted) return;
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
    final pause = goal.pausedUntil == null ? null : DateTime.tryParse(goal.pausedUntil!);

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
              Text(YouCopy.goalQuestion, style: type.lead),
              const SizedBox(height: MmSpace.s24),
              GoalPicker(
                value: days,
                onChanged: _saving
                    ? null
                    : (value) => setState(() {
                          _picked = value;
                          _error = null;
                          _savedAt = null;
                        }),
              ),
              const SizedBox(height: MmSpace.s32),
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
                onPressed: changed && !_saving ? () => _save(days, goal.pausedUntil) : null,
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
