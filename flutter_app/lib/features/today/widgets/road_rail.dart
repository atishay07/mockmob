// The road to May as a strip of weeks you scroll sideways (L05, app-today-1016 section 8.5): one
// 48 dp column a week from today to the exam, each showing what that week holds. Boards and
// registration run as bands across the top, a planned mock is a small paper mark, the study days
// planned are pips (this week's counted days filled in volt), and the exam carries the CUET flag.
// A tap selects a week and the readout above says it in words. The flag drags along the rail to
// set the exam day (8.6): it follows the finger, the readout and the figure above follow it, and
// letting go saves the day. Vertical drags pass to the page; the rail and the flag claim only
// horizontal ones.
import 'dart:async';
import 'dart:ui' show lerpDouble;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/art/art.dart' show SubjectEmblem;
import '../../../core/copy/formatters.dart' show formatDayMonth;
import '../../../core/mascot/mascot.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../copy.dart';
import '../logic/mobi_presence.dart';
import '../logic/road_weeks.dart';

class RoadRail extends StatefulWidget {
  const RoadRail({
    super.key,
    required this.weeks,
    required this.selected,
    required this.onSelect,
    this.ownDate = false,
    this.examDay,
    this.firstDay,
    this.lastDay,
    this.magnetDay,
    this.onFlag,
    this.onFlagDrag,
    this.onFlagEnd,
    this.onFlagStep,
    this.controller,
    this.peek = true,
    this.mobi,
    this.onMobi,
  });

  /// Mobi standing on this week's pips ("you are here"); null leaves him off the rail. He shows
  /// only while the header's Mobi is out of view (one Mobi per screen), at text up to 1.3x, and
  /// where the app's ambient motion is on.
  final MobiController? mobi;

  /// A tap on the rail's Mobi (the section glides to the next stop).
  final VoidCallback? onMobi;

  /// Mobi's height on the rail.
  static const double mobiSize = 30;

  final List<RoadWeek> weeks;
  final int selected;
  final ValueChanged<int> onSelect;

  /// The exam column is the student's own date ("Your date" on the flag).
  final bool ownDate;

  /// The day the flag stands on; null draws no flag.
  final DateTime? examDay;

  /// The flag's range: tomorrow to the last day an exam can be set.
  final DateTime? firstDay, lastDay;

  /// The expected window's first day: the flag snaps to it within two days.
  final DateTime? magnetDay;

  /// A tap on the exam flag (opens the date sheet, the accessible alternative).
  final VoidCallback? onFlag;

  /// The flag's day while it is dragged (live) and where it was let go (saved).
  final ValueChanged<DateTime>? onFlagDrag;
  final ValueChanged<DateTime>? onFlagEnd;

  /// A screen reader's increase or decrease: the flag moves by a whole week and saves.
  final ValueChanged<DateTime>? onFlagStep;
  final ScrollController? controller;

  /// The once-per-run nudge that says the rail scrolls.
  final bool peek;

  static const double column = 48;
  static const double height = 152;

  /// One day on the rail: a week is one column.
  static const double day = column / 7;

  /// The flag's touch area: 48 wide, the rail's height.
  static const double grip = 48;

  /// The rail nudges once per app run (8.5, first-visit peek).
  static bool _peeked = false;

  @visibleForTesting
  static void debugResetPeek() => _peeked = false;

  /// Lets a test see Mobi's once-per-run entrance on the rail again.
  @visibleForTesting
  static void debugResetMobi() => _WeekColumn._appeared = false;

  @override
  State<RoadRail> createState() => _RoadRailState();
}

class _RoadRailState extends State<RoadRail> with SingleTickerProviderStateMixin {
  ScrollController? _own;
  ScrollController get _scroll => widget.controller ?? (_own ??= ScrollController());
  bool _moreRight = true;
  bool _moreLeft = false;

  /// While dragging: the flag's centre in rail content coordinates, and where on the flag the
  /// finger took hold.
  double? _dragX;
  double _grab = 0;
  double _lastLocalX = 0;
  double _viewport = 0;
  int? _dragDay;
  int? _dragWeek;
  Timer? _edge;

  /// After a release the flag settles from where the finger left it onto its day.
  late final AnimationController _settle = AnimationController(vsync: this, duration: const Duration(milliseconds: 240));
  double? _settleFrom;
  Timer? _peekTimer;

  /// The date and month rows' height: taller with large text (clamped at 1.3x).
  double _rows = 26;

  @override
  void initState() {
    super.initState();
    if (widget.peek && !RoadRail._peeked) {
      _peekTimer = Timer(const Duration(milliseconds: 600), () => unawaited(_peekOnce()));
    }
  }

  @override
  void dispose() {
    _edge?.cancel();
    _peekTimer?.cancel();
    _settle.dispose();
    _own?.dispose();
    super.dispose();
  }

  /// 600 ms after the rail first draws, once per run: it slides 56 dp and back, so the student
  /// sees it scrolls. Not under reduced motion, and not when every week fits.
  Future<void> _peekOnce() async {
    if (!mounted || RoadRail._peeked || Motion.reduced(context) || !_scroll.hasClients) return;
    final p = _scroll.position;
    if (p.maxScrollExtent < 56 || p.pixels > 0) return;
    RoadRail._peeked = true;
    await _scroll.animateTo(56, duration: const Duration(milliseconds: 320), curve: Motion.out);
    if (!mounted || !_scroll.hasClients) return;
    await _scroll.animateTo(0, duration: const Duration(milliseconds: 380), curve: Motion.out);
  }

  bool _onScroll(ScrollMetrics m) {
    if (m.axis != Axis.horizontal) return false;
    final right = m.pixels < m.maxScrollExtent - 1;
    final left = m.pixels > 1;
    if (right != _moreRight || left != _moreLeft) {
      setState(() {
        _moreRight = right;
        _moreLeft = left;
      });
    }
    return false;
  }

  DateTime get _start => widget.weeks.first.start;
  int _daysTo(DateTime d) => DateTime(d.year, d.month, d.day).difference(DateTime(_start.year, _start.month, _start.day)).inDays;
  DateTime _dayAt(int n) => DateTime(_start.year, _start.month, _start.day + n);

  /// The centre of day [n] (0 = today) on the rail.
  static double _xOf(int n) => (n + 0.5) * RoadRail.day;

  double get _offset => _scroll.hasClients ? _scroll.offset : 0;

  int get _minDay => widget.firstDay == null ? 1 : _daysTo(widget.firstDay!).clamp(1, 1 << 20);
  int get _maxDay => widget.lastDay == null ? 400 : _daysTo(widget.lastDay!);

  double _localX(Offset global) {
    final box = context.findRenderObject();
    if (box is! RenderBox) return 0;
    return box.globalToLocal(global).dx;
  }

  void _dragStart(DragStartDetails d) {
    final exam = widget.examDay;
    if (exam == null) return;
    _settle.stop();
    _settleFrom = null;
    _lastLocalX = _localX(d.globalPosition);
    final flag = _xOf(_daysTo(exam));
    _grab = _lastLocalX + _offset - flag;
    _dragDay = _daysTo(exam);
    _dragWeek = _dragDay! ~/ 7;
    setState(() => _dragX = flag);
    _edge?.cancel();
    _edge = Timer.periodic(const Duration(milliseconds: 16), (_) => _edgeTick());
  }

  void _dragUpdate(DragUpdateDetails d) {
    if (_dragX == null) return;
    _lastLocalX = _localX(d.globalPosition);
    _follow();
  }

  /// Near either edge the rail scrolls toward the finger, faster the closer it is.
  void _edgeTick() {
    if (_dragX == null || !_scroll.hasClients) return;
    const zone = 32.0;
    final p = _scroll.position;
    double speed = 0;
    if (_lastLocalX < zone) speed = -(zone - _lastLocalX) * 18;
    if (_lastLocalX > _viewport - zone) speed = (zone - (_viewport - _lastLocalX)) * 18;
    if (speed == 0) return;
    final to = (p.pixels + speed * 0.016).clamp(p.minScrollExtent, p.maxScrollExtent);
    if (to == p.pixels) return;
    _scroll.jumpTo(to);
    _follow();
  }

  void _follow() {
    final min = _minDay, max = _maxDay;
    final x = (_lastLocalX + _offset - _grab).clamp(_xOf(min), _xOf(max));
    var day = (x / RoadRail.day - 0.5).round().clamp(min, max);
    final magnet = widget.magnetDay == null ? null : _daysTo(widget.magnetDay!);
    if (magnet != null && (day - magnet).abs() <= 2) day = magnet;
    final week = day ~/ 7;
    if (day != _dragDay) {
      // One tick at a week boundary, and one when the flag lands on the expected date.
      if (week != _dragWeek || (magnet != null && day == magnet)) HapticFeedback.selectionClick();
      _dragDay = day;
      _dragWeek = week;
      widget.onFlagDrag?.call(_dayAt(day));
    }
    setState(() => _dragX = x);
  }

  void _dragEnd([DragEndDetails? _]) {
    _edge?.cancel();
    final x = _dragX;
    final day = _dragDay;
    if (x == null || day == null) return;
    setState(() {
      _dragX = null;
      _settleFrom = x;
    });
    if (Motion.reduced(context)) {
      _settleFrom = null;
    } else {
      unawaited(_settle.forward(from: 0).whenComplete(() {
        if (mounted) setState(() => _settleFrom = null);
      }));
    }
    widget.onFlagEnd?.call(_dayAt(day));
  }

  void _step(int days) {
    final exam = widget.examDay;
    if (exam == null) return;
    final next = (_daysTo(exam) + days).clamp(_minDay, _maxDay);
    widget.onFlagStep?.call(_dayAt(next));
  }

  /// The flag's centre right now, in content coordinates.
  double _flagX() {
    final drag = _dragX;
    if (drag != null) return drag;
    final rest = _xOf(_daysTo(widget.examDay!));
    final from = _settleFrom;
    if (from == null) return rest;
    return lerpDouble(from, rest, Motion.out.transform(_settle.value))!;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final scaler = MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.3);
    final extra = (scaler.scale(12) - 12) * 2;
    final weeks = widget.weeks;
    final height = RoadRail.height + extra;
    _rows = 26 + extra;
    final exam = widget.examDay;
    return SizedBox(
      height: height,
      child: MediaQuery(
        data: MediaQuery.of(context).copyWith(textScaler: scaler),
        child: LayoutBuilder(
          builder: (context, box) {
            _viewport = box.maxWidth;
            return NotificationListener<ScrollMetricsNotification>(
              onNotification: (n) => _onScroll(n.metrics),
              child: NotificationListener<ScrollUpdateNotification>(
                onNotification: (n) => _onScroll(n.metrics),
                child: ShaderMask(
                  blendMode: BlendMode.dstIn,
                  shaderCallback: (rect) => LinearGradient(
                    colors: [
                      _moreLeft ? const Color(0x00000000) : const Color(0xFF000000),
                      const Color(0xFF000000),
                      const Color(0xFF000000),
                      _moreRight ? const Color(0x00000000) : const Color(0xFF000000),
                    ],
                    stops: [0, 32 / rect.width, 1 - 32 / rect.width, 1],
                  ).createShader(rect),
                  child: Stack(
                    children: [
                      ListView.builder(
                        controller: _scroll,
                        scrollDirection: Axis.horizontal,
                        physics: const ClampingScrollPhysics(),
                        itemExtent: RoadRail.column,
                        itemCount: weeks.length,
                        itemBuilder: (context, i) {
                          final w = weeks[i];
                          final firstOfMonth = i == 0 || weeks[i - 1].start.month != w.start.month;
                          return _WeekColumn(
                            key: ValueKey(w.exam ? 'exam' : w.start),
                            week: w,
                            index: i,
                            selected: widget.selected == i,
                            showMonth: firstOfMonth,
                            prevBoards: i > 0 && weeks[i - 1].boards,
                            nextBoards: i + 1 < weeks.length && weeks[i + 1].boards,
                            prevReg: i > 0 && weeks[i - 1].registration,
                            nextReg: i + 1 < weeks.length && weeks[i + 1].registration,
                            ownDate: widget.ownDate,
                            examDay: w.exam ? exam : null,
                            rows: _rows,
                            mobi: i == 0 ? _mobiFor(context) : null,
                            onMobi: widget.onMobi,
                            colors: colors,
                            onTap: () {
                              HapticFeedback.selectionClick();
                              widget.onSelect(i);
                            },
                          );
                        },
                      ),
                      // Each band says what it is at its start, and keeps its name in view while it
                      // runs off the left edge: colour is never the only signal.
                      IgnorePointer(
                        child: ExcludeSemantics(
                          child: AnimatedBuilder(
                            animation: _scroll,
                            builder: (context, _) => Stack(children: _bandLabels(context, weeks)),
                          ),
                        ),
                      ),
                      if (exam != null)
                        AnimatedBuilder(
                          animation: Listenable.merge([_scroll, _settle]),
                          builder: (context, _) {
                            final x = _flagX() - _offset;
                            return Positioned(
                              left: x - RoadRail.grip / 2,
                              top: 0,
                              width: RoadRail.grip,
                              height: height,
                              child: _flag(context, exam),
                            );
                          },
                        ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  /// The rail's Mobi, when he may stand on it at all (the text scale and ambient motion gates;
  /// the header's presence is checked where he is built).
  MobiController? _mobiFor(BuildContext context) {
    final mobi = widget.mobi;
    if (mobi == null || !SubjectEmblem.idleEnabled) return null;
    final scale = MediaQuery.textScalerOf(context).scale(12) / 12;
    return scale <= 1.3 ? mobi : null;
  }

  /// The labels of the registration and boards bands: at the band's start, or pinned just inside
  /// the left edge while the band runs off it, and pushed left by the band's end so a label never
  /// outlives its band.
  List<Widget> _bandLabels(BuildContext context, List<RoadWeek> weeks) {
    final colors = context.mmColors;
    final type = context.mmType;
    final style = type.small.copyWith(fontSize: 11, height: 1.1, fontWeight: FontWeight.w600, color: colors.ink2);
    final scaler = MediaQuery.textScalerOf(context);
    final offset = _offset;
    final pin = offset + (_moreLeft ? 30 : 2);
    final out = <Widget>[];
    void lane(bool Function(RoadWeek w) on, String label, double centre) {
      final painter = TextPainter(text: TextSpan(text: label, style: style), textDirection: TextDirection.ltr, textScaler: scaler, maxLines: 1)..layout();
      final width = painter.width + 6;
      final height = painter.height;
      painter.dispose();
      for (var i = 0; i < weeks.length; i++) {
        if (!on(weeks[i]) || (i > 0 && on(weeks[i - 1]))) continue;
        var end = i;
        while (end + 1 < weeks.length && on(weeks[end + 1])) {
          end++;
        }
        final start = i * RoadRail.column + 4;
        final stop = (end + 1) * RoadRail.column - 6;
        var x = start < pin ? pin : start;
        if (x + width > stop) x = stop - width;
        if (x + width < offset || x > offset + _viewport) continue;
        out.add(Positioned(
          left: x - offset,
          top: centre - height / 2,
          child: ColoredBox(
            // Knocks the bar out behind the word, so the band reads as its name, then the bar.
            color: colors.ground,
            child: Padding(padding: const EdgeInsets.only(left: 2, right: 4), child: Text(label, maxLines: 1, style: style)),
          ),
        ));
      }
    }

    lane((w) => w.registration, TodayCopy.railRegistration, 7);
    lane((w) => w.boards, TodayCopy.railBoards, 21);
    return out;
  }

  Widget _flag(BuildContext context, DateTime exam) {
    final colors = context.mmColors;
    final type = context.mmType;
    final dragging = _dragX != null;
    final weeksAway = _daysTo(exam) ~/ 7;
    return Semantics(
      slider: true,
      label: TodayCopy.flagSemantics,
      value: TodayCopy.flagValue(exam, weeksAway),
      increasedValue: TodayCopy.flagValue(exam.add(const Duration(days: 7)), weeksAway + 1),
      decreasedValue: TodayCopy.flagValue(exam.subtract(const Duration(days: 7)), weeksAway - 1),
      onIncrease: widget.onFlagStep == null ? null : () => _step(7),
      onDecrease: widget.onFlagStep == null ? null : () => _step(-7),
      onTap: widget.onFlag,
      excludeSemantics: true,
      child: GestureDetector(
        key: const ValueKey('road-flag'),
        behavior: HitTestBehavior.opaque,
        onTap: widget.onFlag == null
            ? null
            : () {
                HapticFeedback.selectionClick();
                widget.onFlag!();
              },
        onHorizontalDragStart: widget.onFlagEnd == null ? null : _dragStart,
        onHorizontalDragUpdate: widget.onFlagEnd == null ? null : _dragUpdate,
        onHorizontalDragEnd: widget.onFlagEnd == null ? null : _dragEnd,
        onHorizontalDragCancel: widget.onFlagEnd == null ? null : _dragEnd,
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.topCenter,
          children: [
            // The stem: from the flag down to the pips' baseline.
            Positioned(
              top: 84,
              height: RoadRail.height - 26 - 4 - 84,
              width: 1.5,
              child: ColoredBox(color: colors.isNight ? colors.volt : colors.ink),
            ),
            Positioned(
              top: 44,
              child: AnimatedScale(
                scale: dragging ? 1.06 : 1,
                duration: Motion.of(context, const Duration(milliseconds: 140)),
                curve: Motion.out,
                child: Container(
                  width: 44,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: colors.volt,
                    borderRadius: BorderRadius.circular(10),
                    border: colors.isNight ? null : Border.all(color: colors.ink, width: 1),
                  ),
                  child: Text(
                    widget.ownDate || (widget.magnetDay != null && !_sameDay(exam, widget.magnetDay!)) ? TodayCopy.railOwnDateTwo : TodayCopy.railExamTwo,
                    textAlign: TextAlign.center,
                    style: type.small.copyWith(fontSize: 11, height: 1.1, fontWeight: FontWeight.w700, color: colors.voltInk),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static bool _sameDay(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;
}

class _WeekColumn extends StatelessWidget {
  const _WeekColumn({
    super.key,
    required this.week,
    required this.index,
    required this.selected,
    required this.showMonth,
    required this.prevBoards,
    required this.nextBoards,
    required this.prevReg,
    required this.nextReg,
    required this.ownDate,
    required this.colors,
    required this.onTap,
    this.examDay,
    this.rows = 26,
    this.mobi,
    this.onMobi,
  });

  /// The date and month rows' height.
  final double rows;

  /// Mobi on this week's pips (the first column only).
  final MobiController? mobi;
  final VoidCallback? onMobi;

  /// Mobi plays his entrance once per app run; after that he simply stands.
  static bool _appeared = false;

  final RoadWeek week;
  final int index;
  final bool selected, showMonth, prevBoards, nextBoards, prevReg, nextReg, ownDate;
  final MmColors colors;
  final VoidCallback onTap;

  /// The exam's own day (the exam column only): its date row shows that day.
  final DateTime? examDay;

  static const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final w = week;
    final micro = type.small.copyWith(fontSize: 11, height: 1.1, color: colors.ink3);
    final accent = colors.isNight ? colors.volt : colors.accentText;
    final exam = examDay;
    final String top, bottom;
    if (w.thisWeek) {
      top = TodayCopy.railThisA;
      bottom = TodayCopy.railThisB;
    } else if (exam != null) {
      top = '${exam.day}';
      bottom = _months[exam.month - 1];
    } else {
      top = '${w.start.day}';
      bottom = showMonth ? _months[w.start.month - 1] : '';
    }
    final strong = w.thisWeek || exam != null;
    return Semantics(
      button: true,
      selected: selected,
      label: w.exam
          ? TodayCopy.railExamSemantics(exam ?? w.start, own: ownDate)
          : TodayCopy.railWeekSemantics(w.start, w.planned, w.plannedMocks, index),
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            // The selected week: a ring around its column.
            Positioned(
              left: 2,
              right: 2,
              top: 0,
              // Ends just above the date row, so the ring never crosses "This week" (golden 16 Oct).
              bottom: rows + 1,
              child: AnimatedOpacity(
                opacity: selected ? 1 : 0,
                duration: Motion.of(context, const Duration(milliseconds: 160)),
                curve: Motion.out,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: colors.ink, width: 1.5),
                  ),
                ),
              ),
            ),
            Positioned.fill(
              bottom: rows,
              // A new pace eases each column's pips in or out, left to right (8.7): the stagger is
              // 12 ms a column, capped at ten columns.
              child: TweenAnimationBuilder<double>(
                tween: Tween<double>(end: _pipCount(w).toDouble()),
                duration: Motion.of(context, Duration(milliseconds: 160 + _stagger)),
                curve: Interval(_stagger / (160 + _stagger), 1, curve: Motion.out),
                builder: (context, shown, _) => RepaintBoundary(
                  child: CustomPaint(
                    painter: _WeekPainter(
                      week: w,
                      shown: shown,
                      colors: colors,
                      prevBoards: prevBoards,
                      nextBoards: nextBoards,
                      prevReg: prevReg,
                      nextReg: nextReg,
                    ),
                  ),
                ),
              ),
            ),
            if (mobi != null) _mobi(context, w),
            // Date and month rows.
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              height: rows,
              child: Column(
                children: [
                  Text(top, style: strong ? micro.copyWith(color: accent, fontWeight: FontWeight.w700) : micro),
                  Text(
                    bottom,
                    style: strong
                        ? micro.copyWith(color: accent, fontWeight: FontWeight.w700)
                        : micro.copyWith(color: colors.ink2, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// How many pips a week stacks: the planned days, or this week's counted days when more.
int _pipCount(RoadWeek w) {
  final done = w.done ?? 0;
  return (w.thisWeek ? (w.planned > done ? w.planned : done) : w.planned).clamp(0, 7);
}

extension on _WeekColumn {
  /// The column's delay when a new pace eases the pips: 12 ms a column, ten columns at most.
  int get _stagger => 12 * (index < 10 ? index : 10);

  /// Mobi standing on top of this week's pips: he rises and settles as the pace changes, never
  /// covers a pip, and stays off a band. Only while the header's Mobi is out of view.
  Widget _mobi(BuildContext context, RoadWeek w) {
    const size = RoadRail.mobiSize;
    final width = MobiFigure.widthFor(size);
    final count = _pipCount(w);
    const baseline = RoadRail.height - 26 - 4;
    final topPip = baseline - (count == 0 ? 8 : 8 + (count - 1) * 10);
    final top = topPip - 2 - size;
    final clear = w.boards ? 26.0 : (w.registration ? 12.0 : 0.0);
    if (top < clear) return const SizedBox.shrink();
    return AnimatedPositioned(
      duration: Motion.of(context, const Duration(milliseconds: 200)),
      curve: Motion.out,
      left: (RoadRail.column - width) / 2,
      top: top,
      width: width,
      height: size,
      child: ValueListenableBuilder<bool>(
        valueListenable: TodayMobiPresence.headerVisible,
        builder: (context, headerOn, child) => Visibility(visible: !headerOn, maintainState: true, child: child!),
        child: Semantics(
          button: onMobi != null,
          label: TodayCopy.railMobiSemantics,
          excludeSemantics: true,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onMobi == null
                ? null
                : () {
                    HapticFeedback.selectionClick();
                    onMobi!();
                  },
            child: MobiCharacter(
              key: const ValueKey('road-mobi'),
              controller: mobi,
              size: size,
              entrance: _entrance(),
              watchTaps: false,
              shadow: false,
              seed: 31,
            ),
          ),
        ),
      ),
    );
  }

  MobiAct _entrance() {
    if (_WeekColumn._appeared) return MobiAct.idle;
    _WeekColumn._appeared = true;
    return MobiAct.appear;
  }
}

/// Bands (registration lane, boards lane), the planned mock mark and the pips of one week.
class _WeekPainter extends CustomPainter {
  _WeekPainter({
    required this.week,
    required this.shown,
    required this.colors,
    required this.prevBoards,
    required this.nextBoards,
    required this.prevReg,
    required this.nextReg,
  });

  final RoadWeek week;

  /// The pips shown right now (fractional while a pace change eases them in or out).
  final double shown;
  final MmColors colors;
  final bool prevBoards, nextBoards, prevReg, nextReg;

  @override
  void paint(Canvas canvas, Size size) {
    final w = week;
    final cx = size.width / 2;
    void band(double y, bool on, bool joinLeft, bool joinRight, Color color) {
      if (!on) return;
      final left = joinLeft ? 0.0 : 6.0, right = joinRight ? size.width : size.width - 6;
      canvas.drawRRect(
        RRect.fromLTRBR(left, y, right, y + 6, const Radius.circular(3)),
        Paint()..color = color,
      );
    }

    band(4, w.registration, prevReg, nextReg, colors.ink3.withValues(alpha: colors.isNight ? 0.7 : 0.5));
    band(18, w.boards, prevBoards, nextBoards, colors.ink2.withValues(alpha: colors.isNight ? 0.55 : 0.45));

    // Planned mocks: a small paper mark (two stacked when two).
    for (var k = 0; k < w.plannedMocks; k++) {
      final r = RRect.fromRectAndRadius(Rect.fromCenter(center: Offset(cx + k * 3 - (w.plannedMocks - 1) * 1.5, 38 - k * 2), width: 10, height: 12), const Radius.circular(2));
      canvas.drawRRect(r, Paint()..color = colors.raised2);
      canvas.drawRRect(r, Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2
        ..color = colors.ink2);
    }

    if (w.exam) return;
    // Pips: bottom-aligned stack, 8 x 8, 2 dp apart.
    const pip = 8.0, gap = 2.0;
    final bottom = size.height - 4;
    final done = w.done ?? 0;
    final whole = shown.floor();
    final part = shown - whole;
    final count = part > 0.01 ? whole + 1 : whole;
    final planned = colors.ink3.withValues(alpha: colors.isNight ? 0.55 : 0.35);
    if (count == 0) {
      // No goal: one dashed pip says the week is open.
      final r = RRect.fromRectAndRadius(Rect.fromLTWH(cx - pip / 2, bottom - pip, pip, pip), const Radius.circular(2.5));
      canvas.drawRRect(r, Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = colors.ink3);
      return;
    }
    for (var k = 0; k < count; k++) {
      final top = bottom - pip - k * (pip + gap);
      // The pip easing in or out grows from 60% with its opacity; never from nothing.
      final t = k == whole ? part : 1.0;
      final side = pip * (0.6 + 0.4 * t);
      final r = RRect.fromRectAndRadius(Rect.fromCenter(center: Offset(cx, top + pip / 2), width: side, height: side), Radius.circular(2.5 * side / pip));
      final counted = w.thisWeek && k < done;
      if (w.paused) {
        canvas.drawRRect(r, Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1
          ..color = colors.ink3.withValues(alpha: t));
      } else if (counted) {
        canvas.drawRRect(r, Paint()..color = colors.volt.withValues(alpha: t));
        if (!colors.isNight) {
          canvas.drawRRect(r, Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1
            ..color = colors.ink.withValues(alpha: t));
        }
      } else {
        canvas.drawRRect(r, Paint()..color = planned.withValues(alpha: planned.a * t));
      }
    }
  }

  @override
  bool shouldRepaint(_WeekPainter old) =>
      old.week.planned != week.planned ||
      old.shown != shown ||
      old.week.done != week.done ||
      old.week.plannedMocks != week.plannedMocks ||
      old.week.paused != week.paused ||
      old.week.exam != week.exam ||
      old.colors != colors ||
      old.prevBoards != prevBoards ||
      old.nextBoards != nextBoards ||
      old.prevReg != prevReg ||
      old.nextReg != nextReg;
}

/// "Sat 8 May": the day the flag stands on, for the readout and the receipt.
String flagDay(DateTime d) => '${TodayCopy.weekdayShort[d.weekday - 1]} ${formatDayMonth(d)}';
