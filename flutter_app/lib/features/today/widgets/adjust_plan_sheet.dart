// "Adjust plan" (V15-SPEC 2.3): the one place Today's plan is changed, and it has no slider. Study
// days a week as 3 / 4 / 5 / 6 on one sliding indicator, three named mock plans as pressable rows
// that say their total, the exam date as two rows, and "See all weeks": the whole road as a
// vertical list grouped by month, the only place it appears. Each choice saves at once through
// [RoadActions] and the line under the choices says where it went; a save that did not return puts
// the choice back and says so. The line's height is held from the first frame, so nothing moves
// when it changes.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../logic/plan_adjust.dart';
import '../logic/road_board.dart';
import '../logic/road_builder.dart' show expectedWindowStart;
import '../logic/road_card.dart';
import '../logic/today_model.dart';
import 'road_actions.dart';
import 'road_timeline.dart' show RoadStops;
import 'today_type.dart';

/// Opens the sheet over Today. [toDate] scrolls to the exam date (the card's "Change").
Future<void> showAdjustPlanSheet(BuildContext context, {required RoadModel road, RoadActions? actions, bool toDate = false}) =>
    showMmSheet<void>(
      context: context,
      title: TodayCopy.adjustTitle,
      builder: (context) => AdjustPlanBody(road: road, actions: actions, toDate: toDate),
    );

enum _Save { idle, saving, saved, failed }

class AdjustPlanBody extends ConsumerStatefulWidget {
  const AdjustPlanBody({super.key, required this.road, this.actions, this.toDate = false, this.weeksOpen = false, this.pickDate});

  final RoadModel road;
  final RoadActions? actions;
  final bool toDate;

  /// Opens with "See all weeks" already open (tests and goldens).
  final bool weeksOpen;

  /// Picks the exam date; the platform date picker by default.
  final Future<DateTime?> Function(BuildContext context, RoadBoard board)? pickDate;

  @override
  ConsumerState<AdjustPlanBody> createState() => _AdjustPlanBodyState();
}

class _AdjustPlanBodyState extends ConsumerState<AdjustPlanBody> {
  late int? _goal = widget.road.board?.goal;
  late int? _target = widget.road.board?.mockTarget;
  late DateTime? _own = _ownOf(widget.road.board);
  late bool _weeks = widget.weeksOpen;
  _Save _save = _Save.idle;
  Timer? _rest;
  final GlobalKey _dateKey = GlobalKey(debugLabel: 'adjust-date');

  @override
  void initState() {
    super.initState();
    if (widget.toDate) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final ctx = _dateKey.currentContext;
        if (mounted && ctx != null) unawaited(Scrollable.ensureVisible(ctx, duration: Motion.of(ctx, Motion.ui), curve: Motion.out));
      });
    }
  }

  @override
  void dispose() {
    _rest?.cancel();
    super.dispose();
  }

  static DateTime? _ownOf(RoadBoard? b) => b != null && b.ownDate ? b.examDate : null;

  bool get _account => widget.road.onAccount;

  /// The board as the choices stand now.
  RoadBoard? _live() {
    var b = widget.road.board;
    if (b == null) return null;
    b = b.withGoal(_goal).withTarget(_target);
    final own = _own;
    return own != null ? b.withExam(own, own: true) : b.withExam(expectedWindowStart, own: false);
  }

  Future<void> _run(Future<void> Function() write, VoidCallback revert) async {
    _rest?.cancel();
    setState(() => _save = _Save.saving);
    try {
      await write();
      if (!mounted) return;
      ref.read(hapticsProvider).settle();
      setState(() => _save = _Save.saved);
      _rest = Timer(const Duration(milliseconds: 3200), () {
        if (mounted) setState(() => _save = _Save.idle);
      });
    } on Object {
      if (!mounted) return;
      setState(() {
        revert();
        _save = _Save.failed;
      });
    }
  }

  void _setDays(int n) {
    final actions = widget.actions;
    final old = _goal;
    if (n == old) return;
    setState(() => _goal = n);
    unawaited(_run(() async {
      if (actions == null) throw StateError('no save');
      await actions.savePace(adjustPlan(widget.road.plannedDays, n));
    }, () => _goal = old));
  }

  void _setPlan(MockPlanChoice choice) {
    final actions = widget.actions;
    final old = _target;
    if (old != null && selectedMockPace(_live()!) == choice.pace) return;
    setState(() => _target = choice.total);
    unawaited(_run(() async {
      if (actions == null) throw StateError('no save');
      await actions.setMockTarget(choice.total);
    }, () => _target = old));
  }

  void _useExpected() {
    final actions = widget.actions;
    final old = _own;
    if (old == null) return;
    setState(() => _own = null);
    unawaited(_run(() async {
      if (actions == null) throw StateError('no save');
      await actions.setExamDate(null);
    }, () => _own = old));
  }

  Future<void> _pickOwn() async {
    final board = _live();
    if (board == null) return;
    final chosen = await (widget.pickDate ?? _platformPick)(context, board);
    if (chosen == null || !mounted) return;
    final day = DateTime.utc(chosen.year, chosen.month, chosen.day);
    final actions = widget.actions;
    final old = _own;
    final expected = day == expectedWindowStart;
    setState(() => _own = expected ? null : day);
    unawaited(_run(() async {
      if (actions == null) throw StateError('no save');
      await actions.setExamDate(expected ? null : day);
    }, () => _own = old));
  }

  static Future<DateTime?> _platformPick(BuildContext context, RoadBoard board) {
    final first = board.today.add(const Duration(days: 1));
    final last = latestExamDate(expectedWindowStart);
    return showDatePicker(
      context: context,
      initialDate: board.examDate.isBefore(first) ? first : (board.examDate.isAfter(last) ? last : board.examDate),
      firstDate: first,
      lastDate: last,
      helpText: TodayCopy.adjustDateTitle,
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final board = _live();
    if (board == null) return const SizedBox.shrink();
    final choices = mockPlanChoices(board);
    final selected = selectedMockPace(board);
    final goal = _goal;
    final dayChoices = {3, 4, 5, 6, ?goal}.toList()..sort();
    final days = goal == null ? null : adjustPlan(widget.road.plannedDays, goal);
    final taken = board.mocksTaken;
    final own = _own;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        _Heading(TodayCopy.adjustDaysTitle),
        const SizedBox(height: MmSpace.s8),
        PlanDaysSegmented(values: dayChoices, value: goal, onChanged: widget.actions == null ? null : _setDays),
        const SizedBox(height: MmSpace.s8),
        // Reserved: the line is one line high whether it names the days or not.
        SizedBox(
          height: 20,
          child: Text(
            days == null ? TodayCopy.studyDaysPickHint : TodayCopy.paceRest(days),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: type.caption.copyWith(color: colors.ink2),
          ),
        ),
        const SizedBox(height: MmSpace.s20),
        _Heading(TodayCopy.adjustMocksTitle),
        const SizedBox(height: MmSpace.s8),
        for (final c in choices) ...[
          MmSelectRow(
            key: ValueKey('plan-${c.pace.name}'),
            title: c.name,
            note: TodayCopy.planNote(c.line, recommended: c.recommended),
            selected: selected == c.pace,
            onTap: widget.actions == null ? null : () => _setPlan(c),
            trailing: _PlanTotal(total: c.total, by: TodayCopy.planBy(board.examDate, own: board.ownDate)),
          ),
          const SizedBox(height: MmSpace.s8),
        ],
        const SizedBox(height: MmSpace.s4),
        SizedBox(
          height: 20,
          child: Text(
            taken == null ? TodayCopy.takenUnknown : (selected == null ? TodayCopy.takenTargetMet(taken) : TodayCopy.youHaveTaken(taken)),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: type.caption.copyWith(color: colors.ink2),
          ),
        ),
        const SizedBox(height: MmSpace.s20),
        KeyedSubtree(key: _dateKey, child: _Heading(TodayCopy.adjustDateTitle)),
        const SizedBox(height: MmSpace.s8),
        MmSelectRow(
          key: const ValueKey('date-expected'),
          title: TodayCopy.dateExpected,
          selected: own == null,
          onTap: widget.actions == null ? null : _useExpected,
        ),
        const SizedBox(height: MmSpace.s8),
        MmSelectRow(
          key: const ValueKey('date-pick'),
          title: own == null ? TodayCopy.datePick : TodayCopy.dateOwn(own),
          note: own == null ? null : TodayCopy.dateChangeOwn,
          selected: own != null,
          onTap: widget.actions == null ? null : () => unawaited(_pickOwn()),
        ),
        const SizedBox(height: MmSpace.s12),
        _Status(save: _save, account: _account),
        const SizedBox(height: MmSpace.s8),
        Divider(height: 1, thickness: 1, color: colors.line),
        _WeeksDisclosure(
          open: _weeks,
          onTap: () => setState(() => _weeks = !_weeks),
        ),
        MmSizeEase(
          duration: Motion.card,
          curve: Motion.out,
          alignment: Alignment.topCenter,
          clipBehavior: Clip.none,
          child: _weeks ? AllWeeks(board: board, stops: widget.road.stops) : const SizedBox(width: double.infinity),
        ),
      ],
    );
  }
}

class _Heading extends StatelessWidget {
  const _Heading(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Semantics(
        header: true,
        child: Text(text, style: context.mmType.labelLarge.copyWith(color: context.mmColors.ink, fontWeight: FontWeight.w600)),
      );
}

/// A plan's total at the end of its row: the number and what it is counted to.
class _PlanTotal extends StatelessWidget {
  const _PlanTotal({required this.total, required this.by});

  final int total;
  final String by;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text('$total', style: type.figureCompact.copyWith(fontSize: 22, height: 1.1, color: colors.ink, fontFeatures: const [FontFeature.tabularFigures()])),
        Text(by, style: type.micro.copyWith(color: colors.ink3)),
      ],
    );
  }
}

/// The save line. Always 20 dp tall; "Saved to your account" shows after a write returned.
class _Status extends StatelessWidget {
  const _Status({required this.save, required this.account});

  final _Save save;
  final bool account;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final text = switch (save) {
      _Save.idle => '',
      _Save.saving => TodayCopy.savingPlan,
      _Save.saved => TodayCopy.savedPlan(account: account),
      _Save.failed => TodayCopy.savePlanFailed,
    };
    return SizedBox(
      height: 20,
      child: Semantics(
        liveRegion: true,
        child: MmOverlapSwitcher.fade(
          alignment: Alignment.centerLeft,
          child: Text(
            text,
            key: ValueKey(text),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: type.caption.copyWith(color: save == _Save.failed ? colors.ink : colors.ink2, fontWeight: save == _Save.failed ? FontWeight.w600 : null),
          ),
        ),
      ),
    );
  }
}

class _WeeksDisclosure extends StatelessWidget {
  const _WeeksDisclosure({required this.open, required this.onTap});

  final bool open;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      key: const ValueKey('adjust-weeks'),
      onTap: onTap,
      semanticsLabel: open ? TodayCopy.hideAllWeeks : TodayCopy.seeAllWeeks,
      selected: open,
      focusRadius: MmRadius.smallAll,
      pressedScale: 0.99,
      haptic: MmPressHaptic.selection,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        child: Row(
          children: [
            Expanded(child: Text(open ? TodayCopy.hideAllWeeks : TodayCopy.seeAllWeeks, style: type.labelLarge.copyWith(color: colors.ink, fontWeight: FontWeight.w600))),
            AnimatedRotation(
              turns: open ? 0.5 : 0,
              duration: Motion.of(context, Motion.ui),
              curve: Motion.out,
              child: Icon(LucideIcons.chevronDown, size: 18, color: colors.ink2),
            ),
          ],
        ),
      ),
    );
  }
}

/// The whole road, week by week, grouped by month. The current week is lifted, past weeks dimmed.
class AllWeeks extends StatelessWidget {
  const AllWeeks({super.key, required this.board, this.stops = const []});

  final RoadBoard board;
  final List<RoadStop> stops;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final groups = groupByMonth(buildPlanWeeks(board, stops: stops));
    return Column(
      key: const ValueKey('all-weeks'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (stops.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s16),
          Semantics(header: true, child: Text(TodayCopy.datesOnTheWay, style: type.labelLarge.copyWith(color: colors.ink, fontWeight: FontWeight.w600))),
          const SizedBox(height: MmSpace.s8),
          RoadStops(stops: stops, today: board.today),
          const SizedBox(height: MmSpace.s24),
          Semantics(header: true, child: Text(TodayCopy.weekByWeek, style: type.labelLarge.copyWith(color: colors.ink, fontWeight: FontWeight.w600))),
        ],
        for (final (month, weeks) in groups) ...[
          Padding(
            padding: const EdgeInsets.only(top: MmSpace.s16, bottom: MmSpace.s4),
            child: Semantics(header: true, child: Text(month, style: type.labelLarge.copyWith(color: colors.ink2, fontWeight: FontWeight.w600))),
          ),
          for (final w in weeks) _WeekRow(week: w),
        ],
      ],
    );
  }
}

class _WeekRow extends StatelessWidget {
  const _WeekRow({required this.week});

  final PlanWeek week;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final String detail;
    if (week.past) {
      detail = TodayCopy.weekPast(week.mocksDone);
    } else if (week.current) {
      detail = week.days == null ? TodayCopy.mocksCount(week.mocksDone, week.mocks) : TodayCopy.weekCurrent(week.daysDone ?? 0, week.days!, week.mocksDone, week.mocks);
    } else {
      detail = week.days == null
          ? (week.mocks == 0 ? TodayCopy.noMockThisWeek : TodayCopy.mocksCount(0, week.mocks))
          : TodayCopy.weekPlanned(week.days!, week.mocks, boards: week.boards, registration: week.registration);
    }
    final tone = week.past ? colors.ink3 : colors.ink;
    final sub = week.past ? colors.ink3 : colors.ink2;
    final row = ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 52),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s8),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    week.current ? '${TodayCopy.weekOf(week.monday)}, ${TodayCopy.thisWeekTag.toLowerCase()}' : TodayCopy.weekOf(week.monday),
                    style: type.labelLarge.copyWith(color: tone, fontWeight: week.current ? FontWeight.w700 : FontWeight.w500),
                  ),
                  const SizedBox(height: MmSpace.s2),
                  Text(detail, style: type.caption.copyWith(color: sub, fontFeatures: const [FontFeature.tabularFigures()])),
                ],
              ),
            ),
          ],
        ),
      ),
    );
    return Semantics(
      container: true,
      label: '${TodayCopy.weekOf(week.monday)}. $detail',
      excludeSemantics: true,
      child: week.current
          ? DecoratedBox(
              decoration: BoxDecoration(color: colors.raised2, borderRadius: MmRadius.smallAll, border: Border.all(color: colors.lineStrong)),
              child: row,
            )
          : row,
    );
  }
}

/// Study days a week as one control: a sunken track and ONE raised indicator that slides from the
/// old option to the new in a single transform (220 ms, ease-out; at once under reduced motion).
/// With no goal set the indicator is not drawn, so nothing claims a choice the student did not make.
class PlanDaysSegmented extends ConsumerWidget {
  const PlanDaysSegmented({super.key, required this.values, required this.value, required this.onChanged});

  final List<int> values;
  final int? value;

  /// Null disables the control.
  final ValueChanged<int>? onChanged;

  static const double height = 44;
  static const Duration slide = Duration(milliseconds: 220);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final n = values.length;
    final at = value == null ? -1 : values.indexOf(value!);
    final reduced = Motion.reduced(context);
    return MmHitSlop.toTarget(
      visual: height,
      child: Semantics(
        container: true,
        label: TodayCopy.adjustDaysTitle,
        child: DecoratedBox(
          decoration: ShapeDecoration(color: colors.sunken, shape: StadiumBorder(side: BorderSide(color: colors.line))),
          child: SizedBox(
            height: height,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Stack(
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: AnimatedAlign(
                      alignment: Alignment(n <= 1 ? 0 : -1 + 2 * (at < 0 ? 0 : at) / (n - 1), 0),
                      duration: reduced ? Duration.zero : slide,
                      curve: Motion.out,
                      child: AnimatedOpacity(
                        opacity: at < 0 ? 0 : 1,
                        duration: reduced ? Duration.zero : slide,
                        curve: Motion.out,
                        child: FractionallySizedBox(
                          widthFactor: 1 / n,
                          heightFactor: 1,
                          child: DecoratedBox(
                            key: const ValueKey('days-indicator'),
                            decoration: ShapeDecoration(color: colors.selectedSurface, shape: const StadiumBorder(), shadows: colors.cardShadow),
                          ),
                        ),
                      ),
                    ),
                  ),
                  Row(
                    children: [
                      for (var i = 0; i < n; i++)
                        Expanded(
                          child: Semantics(
                            button: true,
                            selected: i == at,
                            inMutuallyExclusiveGroup: true,
                            label: TodayCopy.studyDaysOption(values[i]),
                            excludeSemantics: true,
                            child: GestureDetector(
                              key: ValueKey('days-${values[i]}'),
                              behavior: HitTestBehavior.opaque,
                              onTap: onChanged == null || i == at
                                  ? null
                                  : () {
                                      ref.read(hapticsProvider).selection();
                                      onChanged!(values[i]);
                                    },
                              child: Center(
                                child: Text(
                                  '${values[i]}',
                                  style: type.labelLarge.copyWith(
                                    fontSize: 16,
                                    color: i == at ? colors.ink : colors.ink2,
                                    fontWeight: i == at ? FontWeight.w700 : FontWeight.w500,
                                    fontFeatures: const [FontFeature.tabularFigures()],
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
