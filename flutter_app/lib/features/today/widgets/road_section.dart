// "The road to May" (L05, L07, app-today-1016 section 8; owner 13 to 16 Oct: "interactive,
// editable, adjustable directly in the scrolling"). The weeks to the exam as one figure with the
// study days it gives, then the road itself as a strip of weeks you scroll sideways: each week
// shows its planned study days, a planned mock, boards and registration. A tap selects a week and
// the readout says it in words; jump chips glide to each stop; the exam flag drags along the rail
// to set the date. Under it the student tunes the plan in place: study days a week (a drag strip
// saved to the account) and full mocks before the date (a ruler saved on the phone). Every change
// redraws the rail and the figure while the finger moves; "Saved" shows only once the save has
// returned. Calendar arithmetic and the student's own choices only: nothing here predicts marks.
//
// The section reads no providers: the screen hands it [RoadActions] (tests and goldens pump it
// without a database).
import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/auth/load_problem.dart';
import '../../../core/copy/formatters.dart' show formatDayMonth;
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
import 'road_tuners.dart';
import 'section_heading.dart';
import 'today_type.dart';

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

class _RoadSectionState extends State<RoadSection> {
  final ScrollController _rail = ScrollController();
  int _selected = 0;

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
    final rail = board != null && weeks.length > 1;
    final selected = _selected.clamp(0, weeks.isEmpty ? 0 : weeks.length - 1);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const TodaySectionHeading(title: TodayCopy.roadTitle),
        const SizedBox(height: MmSpace.s16),
        _figure(road, board),
        if (rail) ...[
          const SizedBox(height: MmSpace.s8),
          AnimatedSwitcher(
            duration: Motion.of(context, Motion.crossFade),
            layoutBuilder: (current, previous) => Stack(alignment: Alignment.topLeft, children: [...previous, ?current]),
            child: Text(
              board.studyDaysLeft == null || goal == null
                  ? TodayCopy.studyLineNoGoal
                  : TodayCopy.studyLine(board.studyDaysLeft!, goal, boards: weeks.any((w) => w.boards)),
              key: ValueKey('${board.studyDaysLeft}|$goal'),
              style: type.body.copyWith(color: colors.ink2),
            ),
          ),
          const SizedBox(height: MmSpace.s20),
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
          _dateReceipt(board),
          const SizedBox(height: MmSpace.s24),
          _paceTuner(board, goal),
          const SizedBox(height: MmSpace.s24),
          _mockTuner(board),
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
      child: AnimatedSwitcher(
        duration: Motion.of(context, drag != null ? Duration.zero : Motion.crossFade),
        layoutBuilder: (current, previous) => Stack(alignment: Alignment.centerLeft, children: [...previous, ?current]),
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
                    child: AnimatedSwitcher(
                      duration: Motion.of(context, Motion.crossFade),
                      layoutBuilder: (current, previous) => Stack(alignment: Alignment.centerLeft, children: [...previous, ?current]),
                      child: Text(
                        failed
                            ? TodayCopy.dateFailed
                            : TodayCopy.dateReceipt(flagDay(board.examDate), saved: _date == _Save.saved),
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
              child: AnimatedSwitcher(
                duration: Motion.of(context, Motion.crossFade),
                layoutBuilder: (current, previous) => Stack(alignment: Alignment.centerLeft, children: [...previous, ?current]),
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
      caption = TodayCopy.mocksSaved;
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
              child: AnimatedSwitcher(
                duration: Motion.of(context, Motion.crossFade),
                layoutBuilder: (current, previous) => Stack(alignment: Alignment.centerLeft, children: [...previous, ?current]),
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

/// The figure with its two-line meaning beside it. The number rolls when the flag or the pace
/// changes it, never on the first build.
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
              MonumentalNumber(value: value, style: type.countdownFigure, fromZeroOnFirstBuild: false),
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
