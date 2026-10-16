// "The road to May" (L05, L07, app-today-1016 section 8; owner 13 to 16 Oct: "interactive,
// editable, adjustable directly in the scrolling"). The weeks to the exam as one figure with the
// study days it gives, then the road itself as a strip of weeks you scroll sideways: each week
// shows its planned study days, a planned mock, boards and registration. A tap selects a week and
// the readout says it in words; jump chips glide to each stop; a tap on the exam flag sets the
// date. Under it the student tunes the plan in place: study days a week (a drag strip saved to
// the account, the pips and the figure following the finger live) and full mocks before the date.
// Calendar arithmetic and the student's own choices only: nothing here predicts marks or chances.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/load_problem.dart';
import '../../../core/copy/formatters.dart' show formatDayMonth;
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../rhythm/rhythm.dart' show rhythmActionsProvider, studyDayPlanProvider;
import '../../rhythm/widgets/goal_editor.dart' show showGoalEditor;
import '../copy.dart';
import '../logic/plan_adjust.dart';
import '../logic/road_board.dart';
import '../logic/road_weeks.dart';
import '../logic/today_model.dart';
import 'road_board.dart';
import 'road_rail.dart';
import 'road_timeline.dart';
import 'section_heading.dart';
import 'today_type.dart';

class RoadSection extends ConsumerStatefulWidget {
  const RoadSection({super.key, required this.road, this.onChooseColleges, this.onWeek, this.onOpen});

  final RoadModel road;

  /// Kept for callers; the colleges card now stands on its own after Recent papers.
  final VoidCallback? onChooseColleges;

  /// The readout's Week link opens the week.
  final VoidCallback? onWeek;

  /// The mocks sheet opens screens through this (Start a full mock).
  final void Function(TodayTarget target)? onOpen;

  @override
  ConsumerState<RoadSection> createState() => _RoadSectionState();
}

enum _Save { idle, saving, saved, failed }

class _RoadSectionState extends ConsumerState<RoadSection> {
  final ScrollController _rail = ScrollController();
  int _selected = 0;

  /// The pace being dragged or saved, before the server confirms it.
  int? _pending;
  _Save _save = _Save.idle;
  String? _failLine;
  Set<int>? _savedDays;
  Timer? _rest;

  @override
  void dispose() {
    _rest?.cancel();
    _rail.dispose();
    super.dispose();
  }

  Future<void> _commitPace(int n, int? old) async {
    final days = adjustPlan(ref.read(studyDayPlanProvider), n);
    _rest?.cancel();
    setState(() {
      _pending = n;
      _save = _Save.saving;
      _failLine = null;
    });
    try {
      await ref.read(rhythmActionsProvider).saveStudyDays(days);
      if (!mounted) return;
      setState(() {
        _save = _Save.saved;
        _savedDays = days;
        _pending = null;
      });
      _rest = Timer(const Duration(milliseconds: 2400), () {
        if (mounted) setState(() => _save = _Save.idle);
      });
    } catch (e) {
      if (!mounted) return;
      // Nothing claims success before the server answers: the pill springs back.
      setState(() {
        _pending = null;
        _save = _Save.failed;
        _failLine = TodayCopy.paceFailed(LoadProblem.of(e).sentence, old ?? 0);
      });
    }
  }

  void _jumpTo(int index) {
    setState(() => _selected = index);
    if (!_rail.hasClients) return;
    final p = _rail.position;
    final to = (index * RoadRail.column - RoadRail.column).clamp(p.minScrollExtent, p.maxScrollExtent);
    final glide = Motion.of(context, const Duration(milliseconds: 300));
    if (glide <= Duration.zero) {
      _rail.jumpTo(to);
    } else {
      unawaited(_rail.animateTo(to, duration: glide, curve: Motion.out));
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final road = widget.road;
    final board = road.board;
    final countdown = road.phase == RoadPhase.countdown;
    final goal = _pending ?? board?.goal;
    final weeks = board == null || !countdown
        ? const <RoadWeek>[]
        : buildRoadWeeks(
            today: board.today,
            examDate: board.examDate,
            goal: goal,
            weekDone: board.weekDone ?? 0,
            mocksLeft: board.mocksLeft,
            stops: road.stops,
          );
    final rail = board != null && weeks.length > 1;
    final studyDays = goal == null || board == null ? null : sessionsUntil(board.today, board.examDate, daysPerWeek: goal);
    final selected = _selected.clamp(0, weeks.isEmpty ? 0 : weeks.length - 1);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const TodaySectionHeading(title: TodayCopy.roadTitle),
        const SizedBox(height: MmSpace.s16),
        _figure(road, board),
        if (rail) ...[
          const SizedBox(height: MmSpace.s8),
          Text(
            studyDays == null || goal == null
                ? TodayCopy.studyLineNoGoal
                : TodayCopy.studyLine(studyDays, goal, boards: weeks.any((w) => w.boards)),
            style: type.body.copyWith(color: colors.ink2),
          ),
          const SizedBox(height: MmSpace.s20),
          _readout(weeks, selected, board, goal),
          const SizedBox(height: MmSpace.s12),
          RoadRail(
            weeks: weeks,
            selected: selected,
            controller: _rail,
            ownDate: board.ownDate,
            onSelect: (i) => setState(() => _selected = i),
            onFlag: () => unawaited(showExamDateSheet(context, board: board)),
          ),
          if (road.stops.isNotEmpty) ...[
            const SizedBox(height: MmSpace.s12),
            _chips(road, weeks),
          ],
          const SizedBox(height: MmSpace.s24),
          _pace(board, goal),
          const SizedBox(height: MmSpace.s24),
          _mocks(board),
        ] else ...[
          // The window is open, or the board is not known: the road as it was.
          const SizedBox(height: MmSpace.s20),
          RoadTimeline(today: road.today, stops: road.stops, end: road.end),
          if (road.stops.isNotEmpty) ...[
            const SizedBox(height: MmSpace.s16),
            RoadStops(stops: road.stops, today: road.today),
          ],
          if (countdown && road.studyDays != null && road.goal != null) ...[
            const SizedBox(height: MmSpace.s20),
            Text(TodayCopy.sessionsLine(road.studyDays!, road.goal!), style: type.body.copyWith(color: colors.ink2)),
          ] else if (countdown && road.weeksToBoards == 0) ...[
            const SizedBox(height: MmSpace.s20),
            Text(TodayCopy.boardsOn, style: type.body.copyWith(color: colors.ink2)),
          ],
        ],
      ],
    );
  }

  Widget _figure(RoadModel road, RoadBoard? board) => switch (road.phase) {
        // A day the student chose counts instead of the expected window.
        RoadPhase.countdown when board != null && board.ownDate && board.weeksToExam < 1 =>
          _Stat(value: '${board.daysToExam}', unit: TodayCopy.daysToOwnDate(board.daysToExam, formatDayMonth(board.examDate))),
        RoadPhase.countdown when board != null && board.ownDate =>
          _Stat(value: '${board.weeksToExam}', unit: TodayCopy.weeksToOwnDate(board.weeksToExam, formatDayMonth(board.examDate))),
        // Under a week out the card counts days; "0 weeks" would read as the window being here.
        RoadPhase.countdown when road.weeks < 1 && (road.daysToWindow ?? 0) > 0 =>
          _Stat(value: '${road.daysToWindow}', unit: TodayCopy.daysToWindowLabel(road.daysToWindow!)),
        RoadPhase.countdown => _Stat(value: '${road.weeks}', unit: TodayCopy.weeksLabel(road.weeks)),
        RoadPhase.window => _Stat(
            value: '${road.daysLeft ?? 0}',
            unit: TodayCopy.windowDaysLeft(road.daysLeft ?? 0),
            headline: TodayCopy.windowOpen,
          ),
      };

  Widget _readout(List<RoadWeek> weeks, int i, RoadBoard board, int? goal) {
    final colors = context.mmColors;
    final type = context.mmType;
    final w = weeks[i];
    final String line1;
    final String line2;
    if (w.exam) {
      line1 = TodayCopy.readExamWeek(board.examDate, own: board.ownDate);
      line2 = TodayCopy.weeksFromNow(i);
    } else if (i == 0) {
      final done = board.weekDone ?? 0;
      line1 = goal == null ? TodayCopy.readThisWeekNoGoal(done) : TodayCopy.readThisWeek(done, goal);
      line2 = TodayCopy.weeksToGo(weeks.length - 1);
    } else {
      var mockNo = 0;
      for (var k = 0; k <= i; k++) {
        mockNo += weeks[k].plannedMocks;
      }
      final taken = board.mocksTaken ?? 0;
      line1 = TodayCopy.readWeekOf(
        w.start,
        planned: goal == null ? null : w.planned,
        mockNo: w.plannedMocks > 0 && board.mockTarget != null ? taken + mockNo : null,
        mockOf: board.mockTarget,
        boards: w.boards,
        registration: w.registration,
      );
      line2 = TodayCopy.weeksFromNow(i, boards: w.boards);
    }
    // Two lines whatever the week, so the rail under it never moves.
    return SizedBox(
      height: 48,
      child: AnimatedSwitcher(
        duration: Motion.of(context, Motion.crossFade),
        layoutBuilder: (current, previous) => Stack(alignment: Alignment.centerLeft, children: [...previous, ?current]),
        child: Row(
          key: ValueKey('$i|$line1|$line2'),
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(line1, maxLines: 1, overflow: TextOverflow.ellipsis, style: type.labelLarge.copyWith(color: colors.ink)),
                  const SizedBox(height: 2),
                  Text(line2, maxLines: 1, overflow: TextOverflow.ellipsis, style: type.caption.copyWith(color: colors.ink2)),
                ],
              ),
            ),
            if (i == 0 && widget.onWeek != null) KeyButton.quiet(label: TodayCopy.readWeekLink, onPressed: widget.onWeek),
          ],
        ),
      ),
    );
  }

  Widget _chips(RoadModel road, List<RoadWeek> weeks) {
    int indexOf(DateTime d) {
      for (var k = weeks.length - 1; k >= 0; k--) {
        if (!weeks[k].start.isAfter(d)) return k;
      }
      return 0;
    }

    final next = road.stops.first;
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      clipBehavior: Clip.none,
      child: Row(
        children: [
          for (final s in road.stops) ...[
            Builder(builder: (context) {
              final k = s.kind == RoadStopKind.exam ? weeks.length - 1 : indexOf(s.start);
              return MmChip(label: TodayCopy.chipIn(s.title, k), selected: identical(s, next), onTap: () => _jumpTo(k));
            }),
            const SizedBox(width: MmSpace.s8),
          ],
        ],
      ),
    );
  }

  Widget _pace(RoadBoard board, int? goal) {
    final colors = context.mmColors;
    final type = context.mmType;
    final planned = ref.watch(studyDayPlanProvider);
    final days = goal == null ? null : (_save == _Save.saved && _savedDays != null ? _savedDays! : adjustPlan(planned, goal));
    final caption = switch (_save) {
      _Save.saving => TodayCopy.paceSaving,
      _Save.saved => TodayCopy.paceSaved(days ?? const <int>{}),
      _Save.failed => _failLine ?? '',
      _Save.idle => days == null ? TodayCopy.paceNone : TodayCopy.paceRest(days),
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(TodayCopy.paceTitle, style: type.labelLarge.copyWith(color: colors.ink)),
        const SizedBox(height: MmSpace.s8),
        PaceStrip(
          value: goal,
          semanticsValue: goal == null || days == null ? null : TodayCopy.paceSemantics(goal, days),
          onPreview: (n) => setState(() {
            _pending = n;
            _save = _Save.idle;
          }),
          onCommit: (n) => unawaited(_commitPace(n, board.goal)),
        ),
        const SizedBox(height: MmSpace.s4),
        Row(
          children: [
            Expanded(
              child: AnimatedSwitcher(
                duration: Motion.of(context, Motion.crossFade),
                child: Text(
                  caption,
                  key: ValueKey(caption),
                  style: type.caption.copyWith(color: _save == _Save.failed ? colors.ink : colors.ink2),
                ),
              ),
            ),
            // One sheet, straight away (L06): never a sheet over a sheet.
            KeyButton.quiet(
              label: TodayCopy.changeDays,
              onPressed: () => unawaited(showGoalEditor(context, initialDays: goal ?? 4, done: board.weekDone ?? 0)),
            ),
          ],
        ),
      ],
    );
  }

  Widget _mocks(RoadBoard board) {
    final colors = context.mmColors;
    final type = context.mmType;
    final taken = board.mocksTaken;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Expanded(child: Text(TodayCopy.mocksTitle, style: type.labelLarge.copyWith(color: colors.ink))),
            Text(
              board.mockTarget == null ? '-' : '${board.mockTarget}',
              style: type.figureCompact.copyWith(color: colors.ink, fontFeatures: const [FontFeature.tabularFigures()]),
            ),
          ],
        ),
        const SizedBox(height: MmSpace.s4),
        Row(
          children: [
            Expanded(
              child: Text(
                taken == null ? '' : TodayCopy.mocksLine(taken, board.mockTarget, board.daysPerMock),
                style: type.caption.copyWith(color: colors.ink2),
              ),
            ),
            KeyButton.quiet(
              label: TodayCopy.mocksChange,
              onPressed: () => unawaited(showMocksSheet(context, board: board, onOpen: widget.onOpen)),
            ),
          ],
        ),
      ],
    );
  }
}

/// The figure with its two-line meaning beside it.
class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.unit, this.headline});

  final String value;
  final String unit;

  /// A line above the figure ("Exam window open").
  final String? headline;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      label: '${headline == null ? '' : '$headline. '}$value ${unit.replaceAll('\n', ' ')}',
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (headline != null) ...[
            Text(headline!, style: type.labelLarge.copyWith(color: colors.isNight ? colors.volt : colors.accentText)),
            const SizedBox(height: MmSpace.s4),
          ],
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              MonumentalNumber(value: value, style: type.countdownFigure, roll: false),
              const SizedBox(width: MmSpace.s12),
              Flexible(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(unit, style: type.stageLead.copyWith(color: colors.ink)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
