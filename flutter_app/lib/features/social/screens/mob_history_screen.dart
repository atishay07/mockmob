import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../you/widgets/you_page.dart';
import '../copy.dart';
import '../data/mob_models.dart';
import '../data/mob_navigator.dart';
import '../data/mob_repository.dart';
import '../mob_routes.dart';
import '../widgets/mob_parts.dart';

/// Past weeks of the Mob (Pro): the weekly papers that closed, newest first. Each week says how many
/// sat and your own result; a week with two or more sitters opens as a side-by-side. Read when the
/// page opens, never on a timer.
class MobHistoryScreen extends ConsumerStatefulWidget {
  const MobHistoryScreen({super.key});

  @override
  ConsumerState<MobHistoryScreen> createState() => _MobHistoryScreenState();
}

class _MobHistoryScreenState extends ConsumerState<MobHistoryScreen> {
  bool _loading = true;
  MobHistory? _history;
  MobFailure? _failure;
  String? _opening;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _failure = null;
    });
    final (history, failure) = await ref.read(mobActionsProvider).history();
    if (!mounted) return;
    setState(() {
      _loading = false;
      _history = history;
      _failure = failure;
    });
  }

  Future<void> _compare(MobHistoryWeek w) async {
    setState(() => _opening = w.week);
    final (compare, failure) = await ref.read(mobActionsProvider).compare(week: w.week);
    if (!mounted) return;
    setState(() => _opening = null);
    if (failure != null) {
      showMobToast(context, MobCopy.failure(failure));
    } else if (compare != null) {
      await openMobCompare(context, compare, week: w.week);
    }
  }

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    final mob = ref.watch(currentMobProvider);
    return YouPage(
      title: MobCopy.historyTitle,
      children: [
        if (mob != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s4, MmSpace.gutter, MmSpace.s12),
            child: Text(mob.subjectName, style: type.body.copyWith(color: colors.ink2)),
          ),
        if (_loading)
          const Padding(
            padding: youGutter,
            child: SkeletonGroup(
              label: MobCopy.historyTitle,
              child: Column(children: [Skeleton(height: 72), SizedBox(height: MmSpace.s8), Skeleton(height: 72), SizedBox(height: MmSpace.s8), Skeleton(height: 72)]),
            ),
          )
        else if (_failure != null)
          Padding(
            padding: youGutter,
            child: MobCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(MobCopy.failure(_failure!), style: type.body.copyWith(color: colors.ink)),
                  const SizedBox(height: MmSpace.s16),
                  PillKey(label: MobCopy.tryAgain, onPressed: _load),
                ],
              ),
            ),
          )
        else if ((_history?.weeks ?? const []).isEmpty)
          Padding(padding: youGutter, child: MobNote(MobCopy.historyEmpty))
        else
          for (var i = 0; i < _history!.weeks.length; i++)
            _WeekRow(
              week: _history!.weeks[i],
              first: i == 0,
              opening: _opening == _history!.weeks[i].week,
              onCompare: () => _compare(_history!.weeks[i]),
              onAnswers: _history!.weeks[i].resultId == null ? null : () => ref.read(mobNavigatorProvider).openAnswers(context, _history!.weeks[i].resultId!),
            ),
      ],
    );
  }
}

class _WeekRow extends StatelessWidget {
  const _WeekRow({required this.week, required this.first, required this.opening, required this.onCompare, this.onAnswers});

  final MobHistoryWeek week;
  final bool first;
  final bool opening;
  final VoidCallback onCompare;
  final VoidCallback? onAnswers;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    return Padding(
      padding: youGutter,
      child: DecoratedBox(
        decoration: BoxDecoration(border: Border(top: BorderSide(color: colors.line))),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: MmSpace.s16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Semantics(header: true, child: Text(weekLabel(week.week), style: type.labelLarge.copyWith(color: colors.ink))),
              const SizedBox(height: MmSpace.s2),
              Text(MobCopy.historyLine(week), style: type.small.copyWith(color: colors.ink2)),
              if (week.youSat && (onAnswers != null || week.sat >= 2)) ...[
                const SizedBox(height: MmSpace.s8),
                Wrap(
                  spacing: MmSpace.s8,
                  runSpacing: MmSpace.s4,
                  children: [
                    if (onAnswers != null) PillKey(label: MobCopy.seeAnswers, onPressed: onAnswers),
                    if (week.sat >= 2) PillKey(label: opening ? MobCopy.opening : MobCopy.sideBySide, onPressed: opening ? null : onCompare),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
