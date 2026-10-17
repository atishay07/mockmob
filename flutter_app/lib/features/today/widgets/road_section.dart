// "Road to May" (TODAY-1017 4.4; L05, owner 13 to 16 Oct: "interactive, editable, adjustable
// directly in the timeline"). The heading carries the weeks to the date; under it the whole road
// as one strip (road_strip.dart), the flag dragged to set the date; then two values as tokens,
// "98 study days at [4 a week]" and "[14 full mocks] before your date", each opening its tuner in
// place (the pace strip saved to the account, the mock ruler). A tap on the strip opens the
// week-by-week rail in place at that week, with the readout and the jump chips. One thing is open
// at a time. Every change redraws the strip and the figures while the finger moves; "Saved" shows
// only once the save has returned. Calendar arithmetic and the student's own choices only.
//
// The section reads no providers: the screen hands it [RoadActions] (tests and goldens pump it
// without a database).
import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/auth/load_problem.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../rhythm/widgets/goal_editor.dart' show showGoalEditor;
import '../copy.dart';
import '../logic/plan_adjust.dart';
import '../logic/road_board.dart';
import '../logic/road_builder.dart' show expectedWindowStart;
import '../logic/road_weeks.dart';
import '../logic/today_model.dart';
import 'road_board.dart';
import 'road_rail.dart';
import 'road_timeline.dart';
import 'road_strip.dart';
import 'road_tuners.dart';
import 'today_pill.dart';

/// What the road saves through: the study-days goal and its weekdays (the account), the exam day
/// and the mock target (this phone). Each future completes when the save has returned and throws
/// when it did not.
class RoadActions {
  const RoadActions({required this.savePace, required this.setExamDate, required this.setMockTarget});

  final Future<void> Function(Set<int> days) savePace;
  final Future<void> Function(DateTime? day) setExamDate;
  final Future<void> Function(int? target) setMockTarget;
}

class RoadSection extends StatefulWidget {
  const RoadSection({super.key, required this.road, this.actions, this.onChooseColleges, this.onWeek, this.onOpen});

  final RoadModel road;

  /// Where the tuners and the flag save; without it the road shows the plan but saves nothing.
  final RoadActions? actions;

  /// Kept for callers; the colleges card now stands on its own after Recent papers.
  final VoidCallback? onChooseColleges;

  /// The readout's Week link opens the week.
  final VoidCallback? onWeek;

  /// The mocks sheet opens screens through this (Start a full mock).
  final void Function(TodayTarget target)? onOpen;

  @override
  State<RoadSection> createState() => _RoadSectionState();
}

enum _Save { idle, saving, saved, failed }

/// What is open under the tokens: the pace tuner, the mock ruler, or the week-by-week rail.
enum _Tuner { pace, mocks, rail }

class _RoadSectionState extends State<RoadSection> {
  final ScrollController _rail = ScrollController();
  int _selected = 0;

  /// The one thing open under the tokens, or null (TODAY-1017 4.4: one tuner at a time).
  _Tuner? _open;

  /// Mobi on this week's pips: he says a pace save's truth (waiting, then a nod or a shrug) and,
  /// tapped, points the rail at the next stop.
  final MobiController _mobi = MobiController();
  Timer? _mobiRest;

  // Pace (study days a week).
  int? _pending;
  _Save _pace = _Save.idle;
  String? _paceFail;
  Set<int>? _savedDays;
  Timer? _paceRest;

  // The exam day.
  DateTime? _dragDate;
  _Save _date = _Save.idle;
  Timer? _dateRest;

  // The mock target.
  int? _targetLive;
  _Save _mocks = _Save.idle;
  Timer? _mocksRest;

  @override
  void dispose() {
    _paceRest?.cancel();
    _dateRest?.cancel();
    _mocksRest?.cancel();
    _mobiRest?.cancel();
    _mobi.dispose();
    _rail.dispose();
    super.dispose();
  }

  static bool _sameDay(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;

  Future<void> _commitPace(int n, int? old) async {
    final actions = widget.actions;
    final days = adjustPlan(widget.road.plannedDays, n);
    _paceRest?.cancel();
    setState(() {
      _pending = n;
      _pace = _Save.saving;
      _paceFail = null;
    });
    _mobiRest?.cancel();
    _mobi.play(MobiMoments.act(MobiEvent.waiting));
    try {
      if (actions == null) throw StateError('no save');
      await actions.savePace(days);
      if (!mounted) return;
      setState(() {
        _pace = _Save.saved;
        _savedDays = days;
        _pending = null;
      });
      _mobi.play(MobiMoments.act(MobiEvent.saveConfirmed));
      _mobiBackToIdle();
      _paceRest = Timer(const Duration(milliseconds: 2400), () {
        if (mounted) setState(() => _pace = _Save.idle);
      });
    } on Object catch (e) {
      if (!mounted) return;
      // Nothing claims success before the server answers: the pill springs back.
      setState(() {
        _pending = null;
        _pace = _Save.failed;
        _paceFail = TodayCopy.paceFailed(LoadProblem.of(e).sentence, old ?? 0);
      });
      _mobi.play(MobiMoments.act(MobiEvent.saveFailed));
      _mobiBackToIdle();
    }
  }

  Future<void> _commitDate(DateTime day) async {
    final actions = widget.actions;
    final window = expectedWindowStart;
    final expected = _sameDay(day, window);
    _dateRest?.cancel();
    setState(() => _dragDate = day);
    try {
      if (actions == null) throw StateError('no save');
      await actions.setExamDate(expected ? null : DateTime.utc(day.year, day.month, day.day));
      if (!mounted) return;
      setState(() {
        _dragDate = null;
        _date = _Save.saved;
      });
      _dateRest = Timer(const Duration(milliseconds: 2400), () {
        if (mounted) setState(() => _date = _Save.idle);
      });
    } on Object {
      if (!mounted) return;
      setState(() {
        _dragDate = null;
        _date = _Save.failed;
      });
    }
  }

  Future<void> _useExpected() async {
    final actions = widget.actions;
    if (actions == null) return;
    _dateRest?.cancel();
    try {
      await actions.setExamDate(null);
      if (mounted) setState(() => _date = _Save.idle);
    } on Object {
      if (mounted) setState(() => _date = _Save.failed);
    }
  }

  Future<void> _commitTarget(int n) async {
    final actions = widget.actions;
    _mocksRest?.cancel();
    setState(() => _targetLive = n);
    try {
      if (actions == null) throw StateError('no save');
      await actions.setMockTarget(n);
      if (!mounted) return;
      setState(() {
        _targetLive = null;
        _mocks = _Save.saved;
      });
      _mocksRest = Timer(const Duration(milliseconds: 2400), () {
        if (mounted) setState(() => _mocks = _Save.idle);
      });
    } on Object {
      if (!mounted) return;
      setState(() {
        _targetLive = null;
        _mocks = _Save.failed;
      });
    }
  }

  void _mobiBackToIdle() {
    _mobiRest?.cancel();
    _mobiRest = Timer(const Duration(milliseconds: 2800), () {
      if (mounted) _mobi.play(MobiAct.idle);
    });
  }

  /// A tap on the rail's Mobi: he points ahead and the rail glides to the next stop, which the
  /// readout then says in words.
  void _mobiToNext(List<RoadWeek> weeks, DateTime today) {
    final stops = widget.road.stops;
    final next = stops.indexWhere((s) => s.start.isAfter(today));
    final stop = next < 0 ? null : stops[next];
    final i = stop == null || stop.kind == RoadStopKind.exam ? weeks.length - 1 : _weekOf(weeks, stop.start);
    _mobi.play(MobiAct.point);
    _mobiBackToIdle();
    _jumpTo(i);
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
      unawaited(_rail.animateTo(to, duration: glide, curve: Motion.glide));
    }
  }

  /// The board as the student sees it right now: the dragged date, the slid pace or the scrolled
  /// target in place of the saved ones while the finger is on them or the save is in flight.
  RoadBoard? _live(RoadBoard? saved) {
    if (saved == null) return null;
    var b = saved;
    final drag = _dragDate;
    if (drag != null) b = b.withExam(drag, own: !_sameDay(drag, expectedWindowStart));
    if (_pending != null) b = b.withGoal(_pending);
    if (_targetLive != null) b = b.withTarget(_targetLive);
    return b;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final road = widget.road;
    final saved = road.board;
    final board = _live(saved);
    final countdown = road.phase == RoadPhase.countdown;
    final goal = board?.goal;
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
    final strip = board != null && weeks.length > 1;
    final selected = _selected.clamp(0, weeks.isEmpty ? 0 : weeks.length - 1);
    if (!strip) {
      // The window is open, or the board is not known: the road as it was.
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _heading(road, board),
          if (road.phase == RoadPhase.window) ...[
            const SizedBox(height: MmSpace.s4),
            Text(TodayCopy.windowOpen, style: type.labelLarge.copyWith(color: colors.ink)),
          ],
          const SizedBox(height: MmSpace.s16),
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
      );
    }
    // Under 22 days to the date the strip counts days (4.4, phases).
    final dayMode = board.daysToExam < 22;
    final planned = road.plannedDays;
    final dayColumns = !dayMode
        ? null
        : [
            for (var d = 0; d <= board.daysToExam; d++)
              d < board.daysToExam &&
                  goal != null &&
                  (planned == null || planned.contains(board.today.add(Duration(days: d)).weekday - 1)),
          ];
    final taken = board.mocksTaken ?? 0;
    final target = board.mockTarget;
    final suggested = target == null ? suggestedMockTarget(weeks: board.weeksToExam, taken: taken) : null;
    final mocks = target ?? suggested!;
    final valueStyle = type.body.copyWith(color: colors.ink2);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _heading(road, board),
        const SizedBox(height: MmSpace.s12),
        RoadStrip(
          weeks: weeks,
          examDay: board.examDate,
          ownDate: board.ownDate,
          firstDay: board.today.add(const Duration(days: 1)),
          lastDay: latestExamDate(expectedWindowStart),
          magnetDay: expectedWindowStart,
          dayColumns: dayColumns,
          onWeek: (i) => _openRail(i),
          onFlag: saved == null ? null : () => unawaited(showExamDateSheet(context, board: saved)),
          onFlagDrag: widget.actions == null
              ? null
              : (d) => setState(() {
                    _dragDate = d;
                    _date = _Save.idle;
                  }),
          onFlagEnd: widget.actions == null ? null : (d) => unawaited(_commitDate(d)),
          onFlagStep: widget.actions == null ? null : (d) => unawaited(_commitDate(d)),
        ),
        _dateReceipt(board),
        const SizedBox(height: MmSpace.s12),
        // The two values, each a token that opens its tuner in place (only one open at a time).
        Wrap(
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: MmSpace.s8,
          runSpacing: MmSpace.s4,
          children: [
            MmOverlapSwitcher.fade(
              alignment: Alignment.centerLeft,
              child: Text(
                board.studyDaysLeft == null || goal == null ? TodayCopy.studyDaysPick : TodayCopy.studyDaysAt(board.studyDaysLeft!),
                key: ValueKey('${board.studyDaysLeft}|$goal'),
                style: valueStyle,
              ),
            ),
            TodayToken(
              tokenKey: const ValueKey('road-token-pace'),
              label: goal == null ? TodayCopy.setDays : TodayCopy.tokenPace(goal),
              open: _open == _Tuner.pace,
              semanticsLabel: goal == null ? TodayCopy.setDays : TodayCopy.paceTokenSemantics(goal),
              onTap: () => _toggle(_Tuner.pace),
            ),
          ],
        ),
        const SizedBox(height: MmSpace.s8),
        // The token and its words stay one line (walk 1, T-day-bottom-open-mock): the words sit
        // beside the token and, at large text, wrap in their own column, never under the token.
        Row(
          children: [
            TodayToken(
              tokenKey: const ValueKey('road-token-mocks'),
              label: TodayCopy.tokenMocks(mocks),
              open: _open == _Tuner.mocks,
              semanticsLabel: TodayCopy.mocksTokenSemantics(mocks, board.mocksTaken),
              onTap: () => _toggle(_Tuner.mocks),
            ),
            const SizedBox(width: MmSpace.s8),
            Flexible(child: Text(TodayCopy.mocksBefore(taken, suggested: target == null), style: valueStyle)),
          ],
        ),
        // The open tuner, or the rail, eases open under the tokens (240 ms) and closes the same way.
        MmSizeEase(
          duration: const Duration(milliseconds: 240),
          curve: Motion.out,
          alignment: Alignment.topCenter,
          clipBehavior: Clip.none,
          child: switch (_open) {
            null => const SizedBox(width: double.infinity),
            _Tuner.pace => Padding(padding: const EdgeInsets.only(top: MmSpace.s16), child: _paceTuner(board, goal)),
            _Tuner.mocks => Padding(padding: const EdgeInsets.only(top: MmSpace.s16), child: _mockTuner(board)),
            _Tuner.rail => Padding(padding: const EdgeInsets.only(top: MmSpace.s16), child: _railBlock(road, board, weeks, selected, goal)),
          },
        ),
      ],
    );
  }

  /// Opens one tuner and closes the other (or folds the one that is open).
  void _toggle(_Tuner t) => setState(() => _open = _open == t ? null : t);

  /// The week-by-week rail, opened in place at week [i].
  void _openRail(int i) {
    setState(() {
      _open = _Tuner.rail;
      _selected = i;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _jumpTo(i);
    });
  }

  /// "Road to May" with the weeks (or days) to the date on the right.
  Widget _heading(RoadModel road, RoadBoard? board) {
    final colors = context.mmColors;
    final type = context.mmType;
    final int n;
    final String unit;
    if (road.phase == RoadPhase.window) {
      n = road.daysLeft ?? 0;
      unit = TodayCopy.windowDaysLeft(n);
    } else if (board != null && board.weeksToExam < 1) {
      n = board.daysToExam;
      unit = TodayCopy.roadDaysTo(own: board.ownDate, n: n);
    } else if (board != null) {
      n = board.weeksToExam;
      unit = TodayCopy.roadWeeksTo(own: board.ownDate, n: n);
    } else {
      n = road.weeks;
      unit = TodayCopy.roadWeeksTo(own: false, n: n);
    }
    return Row(
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Expanded(child: Semantics(header: true, child: Text(TodayCopy.roadTitleFor(board != null && board.ownDate ? board.examDate : null), style: type.title.copyWith(fontSize: 19)))),
        MmCountUp(
          value: n,
          fromZeroOnFirstBuild: false,
          style: type.figureCompact.copyWith(fontSize: 30, height: 1, color: colors.ink, fontFeatures: const [FontFeature.tabularFigures()]),
        ),
        const SizedBox(width: MmSpace.s6),
        Text(unit, style: type.caption.copyWith(fontSize: 14, color: colors.ink2)),
      ],
    );
  }

  /// The detailed rail, in place: the readout, the 48 dp week columns, the jump chips, and Done.
  Widget _railBlock(RoadModel road, RoadBoard board, List<RoadWeek> weeks, int selected, int? goal) {
    final saved = road.board;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _readout(weeks, selected, board, goal),
        const SizedBox(height: MmSpace.s12),
        RoadRail(
          weeks: weeks,
          selected: selected,
          controller: _rail,
          ownDate: board.ownDate,
          examDay: board.examDate,
          firstDay: board.today.add(const Duration(days: 1)),
          lastDay: latestExamDate(expectedWindowStart),
          magnetDay: expectedWindowStart,
          onSelect: (i) => setState(() => _selected = i),
          mobi: _mobi,
          onMobi: () => _mobiToNext(weeks, board.today),
          onFlag: saved == null ? null : () => unawaited(showExamDateSheet(context, board: saved)),
          onFlagDrag: widget.actions == null
              ? null
              : (d) => setState(() {
                    _dragDate = d;
                    _date = _Save.idle;
                    _selected = 0;
                  }),
          onFlagEnd: widget.actions == null ? null : (d) => unawaited(_commitDate(d)),
          onFlagStep: widget.actions == null ? null : (d) => unawaited(_commitDate(d)),
        ),
        if (road.stops.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s12),
          _chips(road, weeks),
        ],
        Align(
          alignment: Alignment.centerRight,
          child: KeyButton.quiet(label: TodayCopy.doneRail, onPressed: () => setState(() => _open = null)),
        ),
      ],
    );
  }

  Widget _readout(List<RoadWeek> weeks, int i, RoadBoard board, int? goal) {
    final colors = context.mmColors;
    final type = context.mmType;
    final w = weeks[i];
    final String line1;
    final String line2;
    final drag = _dragDate;
    if (drag != null) {
      // While the flag moves: the day it stands on, and what it gives.
      line1 = TodayCopy.readYourDate(flagDay(drag));
      line2 = TodayCopy.readDragLine(board.weeksToExam, board.studyDaysLeft, goal);
    } else if (w.exam) {
      line1 = TodayCopy.readExamWeek(board.examDate, own: board.ownDate);
      final exam = _stopIn(weeks, i, exam: true);
      line2 = exam != null && !board.ownDate ? TodayCopy.readStop(exam.when, exam.expected, i) : TodayCopy.weeksFromNow(i);
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
      // A week a stop begins in says the stop's full dates (the old stops list, kept).
      final stop = _stopIn(weeks, i);
      line2 = stop != null ? TodayCopy.readStop(stop.when, stop.expected, i) : TodayCopy.weeksFromNow(i, boards: w.boards);
    }
    // Two lines whatever the week, so the rail under it never moves (taller at large text).
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 48),
      // While the flag is dragged the readout follows the finger with no fade.
      child: MmOverlapSwitcher.fade(
        duration: drag != null ? Duration.zero : Motion.fadeThroughIn,
        outDuration: drag != null ? Duration.zero : Motion.fadeThroughOut,
        alignment: Alignment.centerLeft,
        child: Row(
          key: ValueKey('$i|$line1|$line2'),
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(line1, maxLines: 1, overflow: TextOverflow.ellipsis, style: type.labelLarge.copyWith(color: colors.ink)),
                  const SizedBox(height: 2),
                  Text(line2, maxLines: 1, overflow: TextOverflow.ellipsis, style: type.caption.copyWith(color: colors.ink2)),
                ],
              ),
            ),
            if (i == 0 && drag == null && widget.onWeek != null) KeyButton.quiet(label: TodayCopy.readWeekLink, onPressed: widget.onWeek),
          ],
        ),
      ),
    );
  }

  /// The stop that begins in week [i] (or the exam's own, for the exam column), if any.
  RoadStop? _stopIn(List<RoadWeek> weeks, int i, {bool exam = false}) {
    for (final s in widget.road.stops) {
      if ((s.kind == RoadStopKind.exam) != exam) continue;
      if (exam) return s;
      if (_weekOf(weeks, s.start) == i) return s;
    }
    return null;
  }

  static int _weekOf(List<RoadWeek> weeks, DateTime d) {
    for (var k = weeks.length - 1; k >= 0; k--) {
      if (!weeks[k].start.isAfter(d)) return k;
    }
    return 0;
  }

  Widget _chips(RoadModel road, List<RoadWeek> weeks) {
    int indexOf(DateTime d) => _weekOf(weeks, d);

    final next = road.stops.first;
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      clipBehavior: Clip.none,
      child: Row(
        children: [
          for (final s in road.stops) ...[
            Builder(builder: (context) {
              final k = s.kind == RoadStopKind.exam ? weeks.length - 1 : indexOf(s.start);
              return Semantics(
                label: TodayCopy.chipSemantics(s.title, s.when, s.expected, k),
                excludeSemantics: true,
                button: true,
                child: MmChip(label: TodayCopy.chipIn(s.title, k), selected: identical(s, next), onTap: () => _jumpTo(k)),
              );
            }),
            const SizedBox(width: MmSpace.s8),
          ],
        ],
      ),
    );
  }

  /// Under the chips once the student has a date of their own: the day, and the way back to the
  /// expected one. "Saved on this phone." shows for a moment after a save that returned.
  Widget _dateReceipt(RoadBoard board) {
    final colors = context.mmColors;
    final type = context.mmType;
    final own = board.ownDate && _dragDate == null;
    final failed = _date == _Save.failed;
    final show = own || failed;
    return MmSizeEase(
      duration: Motion.of(context, Motion.ui),
      curve: Motion.out,
      alignment: Alignment.topLeft,
      child: !show
          ? const SizedBox(width: double.infinity)
          : Padding(
              padding: const EdgeInsets.only(top: MmSpace.s8),
              child: Row(
                children: [
                  Expanded(
                    child: MmOverlapSwitcher.fade(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        failed
                            ? TodayCopy.dateFailed
                            : TodayCopy.dateReceipt(flagDay(board.examDate), saved: _date == _Save.saved, account: widget.road.onAccount),
                        key: ValueKey('$failed|${_date.name}|${board.examDate}'),
                        style: type.caption.copyWith(color: failed ? colors.ink : colors.ink2),
                      ),
                    ),
                  ),
                  if (own && widget.actions != null) KeyButton.quiet(label: TodayCopy.useExpectedDate, onPressed: () => unawaited(_useExpected())),
                ],
              ),
            ),
    );
  }

  Widget _paceTuner(RoadBoard board, int? goal) {
    final colors = context.mmColors;
    final type = context.mmType;
    final planned = widget.road.plannedDays;
    final days = goal == null ? null : (_pace == _Save.saved && _savedDays != null ? _savedDays! : adjustPlan(planned, goal));
    final caption = switch (_pace) {
      _Save.saving => TodayCopy.paceSaving,
      _Save.saved => TodayCopy.paceSaved(days ?? const <int>{}),
      _Save.failed => _paceFail ?? '',
      _Save.idle => days == null ? TodayCopy.paceNone : TodayCopy.paceRest(days),
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(TodayCopy.paceTitle, style: type.labelLarge.copyWith(color: colors.ink)),
        const SizedBox(height: MmSpace.s8),
        PaceStrip(
          value: goal,
          enabled: widget.actions != null,
          semanticsValue: goal == null || days == null ? null : TodayCopy.paceSemantics(goal, days),
          onPreview: (n) => setState(() {
            _pending = n;
            _pace = _Save.idle;
          }),
          onCommit: (n) => unawaited(_commitPace(n, widget.road.board?.goal)),
        ),
        const SizedBox(height: MmSpace.s4),
        Row(
          children: [
            Expanded(
              child: MmOverlapSwitcher.fade(
                alignment: Alignment.centerLeft,
                child: Text(
                  caption,
                  key: ValueKey(caption),
                  style: type.caption.copyWith(color: _pace == _Save.failed ? colors.ink : colors.ink2),
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

  Widget _mockTuner(RoadBoard board) {
    final colors = context.mmColors;
    final type = context.mmType;
    final taken = board.mocksTaken;
    final target = board.mockTarget;
    final suggested = target == null ? suggestedMockTarget(weeks: board.weeksToExam, taken: taken ?? 0) : null;
    final String caption;
    if (taken == null) {
      caption = TodayCopy.mocksUnread;
    } else if (_mocks == _Save.saved) {
      caption = TodayCopy.savedWhere(account: widget.road.onAccount);
    } else if (_mocks == _Save.failed) {
      caption = TodayCopy.mocksFailed;
    } else if (target == null) {
      caption = TodayCopy.mocksSuggested(taken, suggested!);
    } else {
      caption = TodayCopy.mocksLine(taken, target, board.daysPerMock);
    }
    final saved = widget.road.board;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Expanded(child: Text(TodayCopy.mocksTitle, style: type.labelLarge.copyWith(color: colors.ink))),
            Text(
              taken == null ? '-' : '${target ?? suggested}',
              style: type.figureCompact.copyWith(
                color: target == null ? colors.ink3 : colors.ink,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ],
        ),
        if (taken != null) ...[
          const SizedBox(height: MmSpace.s8),
          MockRuler(
            value: target ?? suggested!,
            taken: taken,
            suggested: target == null,
            onPreview: widget.actions == null
                ? (_) {}
                : (n) => setState(() {
                      _targetLive = n;
                      _mocks = _Save.idle;
                    }),
            onCommit: widget.actions == null ? (_) {} : (n) => unawaited(_commitTarget(n)),
          ),
        ],
        const SizedBox(height: MmSpace.s4),
        // The caption is the way into the mocks sheet (the last mock, Start a full mock): the whole
        // line is the target, "N taken" underlined as its link.
        MmPressable(
          semanticsLabel: '$caption ${TodayCopy.mocksOpenSemantics}',
          focusRadius: MmRadius.smallAll,
          pressedScale: 0.99,
          haptic: MmPressHaptic.selection,
          onTap: saved == null ? null : () => unawaited(showMocksSheet(context, board: saved, onOpen: widget.onOpen)),
          builder: (context, pressed, _) => ConstrainedBox(
            constraints: const BoxConstraints(minHeight: MmTarget.min, minWidth: double.infinity),
            child: Align(
              alignment: Alignment.centerLeft,
              child: MmOverlapSwitcher.fade(
                alignment: Alignment.centerLeft,
                child: Text.rich(
                  key: ValueKey(caption),
                  _linked(caption, taken, colors, type, pressed),
                  style: type.caption.copyWith(color: _mocks == _Save.failed ? colors.ink : colors.ink2),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  /// The caption with its "N taken" words drawn as the link.
  TextSpan _linked(String caption, int? taken, MmColors colors, MmType type, bool pressed) {
    final link = taken == null ? null : TodayCopy.takenWords(taken);
    final at = link == null ? -1 : caption.indexOf(link);
    if (at < 0) return TextSpan(text: caption);
    return TextSpan(children: [
      TextSpan(text: caption.substring(0, at)),
      TextSpan(
        text: link,
        style: TextStyle(
          color: pressed ? colors.ink2 : colors.ink,
          fontWeight: FontWeight.w600,
          decoration: TextDecoration.underline,
          decorationColor: colors.isNight ? colors.volt : colors.accentText,
          decorationThickness: 2,
        ),
      ),
      TextSpan(text: caption.substring(at + link!.length)),
    ]);
  }
}
