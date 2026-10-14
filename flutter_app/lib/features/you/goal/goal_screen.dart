import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/analytics/analytics.dart';
import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/copy/copy.dart';
import '../../../core/repositories/repositories.dart';
import '../../../core/settings/changed_row.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/goal_pause.dart';
import '../widgets/you_motion.dart';
import '../widgets/you_page.dart';
import 'goal_picker.dart';

/// How Mobi leans for a goal of [days]: one to three he rests (a gentle week), four and five he
/// nods, six he thinks it over, seven he encourages (the plain line says there is no rest).
MobiAct goalMobiAct(int days) => switch (days) {
      <= 3 => MobiAct.rest,
      4 || 5 => MobiAct.correct,
      6 => MobiAct.think,
      _ => MobiAct.encourage,
    };

/// The weekly goal editor (spec 5.11 and 6.1): days per week, 1 to 7. The goal is what the
/// server holds; the screen shows "saved" only after the server answers.
class GoalScreen extends ConsumerStatefulWidget {
  const GoalScreen({super.key});

  @override
  ConsumerState<GoalScreen> createState() => _GoalScreenState();
}

class _GoalScreenState extends ConsumerState<GoalScreen> {
  /// A small Mobi beside the question who leans with each pick.
  final MobiController _mobi = MobiController();
  MobiAct? _lastMobi;
  int? _picked;
  bool _saving = false;
  bool _changedElsewhere = false;
  String? _error;
  DateTime? _savedAt;

  @override
  void dispose() {
    _mobi.dispose();
    super.dispose();
  }

  void _lean(int days) {
    final act = goalMobiAct(days);
    // A held pose (rest, think) is not replayed by the next pick that lands on the same pose;
    // a nod or an encouragement answers every pick.
    final held = act == MobiAct.rest || act == MobiAct.think;
    if (held && act == _lastMobi) return;
    _lastMobi = act;
    _mobi.react(act);
  }

  /// Proud only after the server has accepted the save. The Celebrations setting is carried by
  /// the Mobi himself: a nod under Quiet, nothing under Off (the receipt line still says it).
  void _proud() {
    _lastMobi = MobiAct.proud;
    _mobi.react(MobiAct.proud);
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
      ref.read(changedSettingsRowProvider.notifier).mark(ChangedRowKeys.rhythm);
      _proud();
      setState(() {
        _saving = false;
        // What the student picked is now what the server holds: from here the picker follows
        // the server again, so a later change from another phone is never overwritten by it.
        _picked = null;
        _changedElsewhere = false;
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

    // The numeral is the hero, and Save is pinned at the foot, so the screen has one dominant
    // object and one dominant action however tall the phone is.
    return YouPage(
      title: YouCopy.goalTitle,
      footer: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_error != null) ...[
            InlineBanner(message: _error!, tone: BannerTone.error),
            const SizedBox(height: MmSpace.s12),
          ],
          if (_savedAt != null) ...[
            ReceiptLine(text: YouCopy.goalSaved(_savedAt!)),
            const SizedBox(height: MmSpace.s12),
          ],
          KeyButton(
            label: YouCopy.goalSave,
            loading: _saving,
            onPressed: changed && !_saving ? () => _save(days, pauseToKeep(goal.pausedUntil, now)) : null,
          ),
        ],
      ),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(youText, MmSpace.s8, youText, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (state.isStale) ...[
                const InlineBanner(message: YouCopy.goalStale),
                const SizedBox(height: MmSpace.s16),
              ],
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(child: Text(YouCopy.goalQuestion, style: type.lead)),
                  const SizedBox(width: MmSpace.s12),
                  YouMobi(
                    size: 64,
                    controller: _mobi,
                    entrance: days <= 3 ? MobiAct.rest : (days == 6 ? MobiAct.think : MobiAct.idle),
                  ),
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
        // phone, so the picker takes the full width less 12 dp a side (exactly 336 dp at 360).
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12),
          child: GoalPicker(
            value: days,
            onChanged: _saving
                ? null
                : (value) => setState(() {
                      _lean(value);
                      _picked = value;
                      _changedElsewhere = false;
                      _error = null;
                      _savedAt = null;
                    }),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(youText, MmSpace.s40, youText, 0),
          child: Semantics(
            container: true,
            liveRegion: true,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                GoalFigure(days: days),
                const SizedBox(height: MmSpace.s12),
                // One line says what a study day is; at seven days it says there is no rest.
                Text(
                  days == 7 ? YouCopy.goalEveryDay : YouCopy.goalCounts,
                  style: type.body.copyWith(color: colors.ink2),
                ),
                if (pause != null) ...[
                  const SizedBox(height: MmSpace.s12),
                  Text(YouCopy.goalPaused(formatDayMonth(pause)), style: type.body.copyWith(color: colors.ink2)),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// "4 days a week": the numeral and its unit sharing one baseline. The numeral is the condensed
/// display figure; the unit is the same face at 40% of its size, sitting on the numeral's baseline
/// (not hung from its cap height).
class GoalFigure extends StatelessWidget {
  const GoalFigure({super.key, required this.days});

  final int days;

  /// Bricolage metrics (units per em 1000): ascender 930, descender 270.
  static const double _ascent = 0.93;
  static const double _descent = 0.27;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    final base = type.figureHero;
    final size = MediaQuery.textScalerOf(context).scale(base.fontSize ?? 96);
    final ratio = base.height ?? 1;
    final unitSize = size * 0.4;
    // Distance from the bottom of a line box to its baseline: half the leading, plus the descent.
    double belowBaseline(double fontSize) => fontSize * (ratio / 2 - (_ascent + _descent) / 2 + _descent);
    final lift = belowBaseline(size) - belowBaseline(unitSize);
    return Semantics(
      label: YouCopy.goalNote(days),
      excludeSemantics: true,
      child: FittedBox(
        fit: BoxFit.scaleDown,
        alignment: Alignment.centerLeft,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            MonumentalNumber(value: '$days', style: base),
            SizedBox(width: size * 0.08),
            Padding(
              padding: EdgeInsets.only(bottom: lift),
              child: Text(
                YouCopy.goalUnit(days),
                textScaler: TextScaler.noScaling,
                style: base.copyWith(fontSize: unitSize, color: colors.ink2, letterSpacing: unitSize * -0.005),
              ),
            ),
          ],
        ),
      ),
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
