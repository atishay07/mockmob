// The Road to May as one strip (TODAY-1017 4.4; L05 "editable in the timeline"): every week from
// this one to the exam fits the width, so May is always in view without a sideways scroll. Four
// lanes, top to bottom: the exam flag (a draggable ink pill with a grip, its stem down to the
// pips), the bands (the registration tick and the boards bar, each labelled), the pips (one per
// planned study day, two in a boards week; this week's counted ones in volt), and the months.
//
// Touch: drag the flag to move the date by days (the strip re-flows live; a haptic each week; a
// magnet at the expected start); tap the flag for the date sheet; tap anywhere else to open the
// week-by-week rail at the nearest week. Calendar arithmetic and the student's own plan only.
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../copy.dart';
import '../logic/road_weeks.dart';

class RoadStrip extends StatefulWidget {
  const RoadStrip({
    super.key,
    required this.weeks,
    required this.examDay,
    required this.ownDate,
    required this.firstDay,
    required this.lastDay,
    required this.magnetDay,
    this.onWeek,
    this.onFlag,
    this.onFlagDrag,
    this.onFlagEnd,
    this.onFlagStep,
    this.dayColumns,
  });

  /// From this week (index 0) to the exam's own column (last).
  final List<RoadWeek> weeks;
  final DateTime examDay;
  final bool ownDate;

  /// The flag's range, and the day it snaps to when it passes near.
  final DateTime firstDay;
  final DateTime lastDay;
  final DateTime magnetDay;

  /// Under 22 days to the date the strip counts days: one column per day, a pip for each planned
  /// one (4.4, phases). Null draws weeks.
  final List<bool>? dayColumns;

  final ValueChanged<int>? onWeek;
  final VoidCallback? onFlag;
  final ValueChanged<DateTime>? onFlagDrag;
  final ValueChanged<DateTime>? onFlagEnd;

  /// A screen reader's increase or decrease: a week either way, saved at once.
  final ValueChanged<DateTime>? onFlagStep;

  static const double height = 118;

  @override
  State<RoadStrip> createState() => _RoadStripState();
}

class _RoadStripState extends State<RoadStrip> with SingleTickerProviderStateMixin {
  /// The columns grow from the baseline the first time the strip is in view (4.8).
  late final AnimationController _grow = AnimationController(vsync: this, duration: const Duration(milliseconds: 420));
  bool _grown = false;

  // The drag, at a scale fixed when it began: the strip re-flows under the finger while it moves.
  DateTime? _dragStart;
  double _daysPerPx = 0;
  double _dx = 0;
  DateTime? _dragDay;
  int? _lastWeek;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_grown) return;
    _grown = true;
    if (Motion.reduced(context)) {
      _grow.value = 1;
    } else {
      _grow.forward();
    }
  }

  @override
  void dispose() {
    _grow.dispose();
    super.dispose();
  }

  static DateTime _day(DateTime d) => DateTime(d.year, d.month, d.day);

  DateTime _clamp(DateTime d) {
    final first = _day(widget.firstDay), last = _day(widget.lastDay);
    if (d.isBefore(first)) return first;
    if (d.isAfter(last)) return last;
    return d;
  }

  void _dragBegin(double width) {
    final today = _day(widget.weeks.first.start);
    final days = _day(widget.examDay).difference(today).inDays;
    _dragStart = _day(widget.examDay);
    _daysPerPx = days <= 0 ? 0 : days / width;
    _dx = 0;
    _lastWeek = days ~/ 7;
  }

  void _dragUpdate(double delta) {
    final start = _dragStart;
    if (start == null) return;
    _dx += delta;
    var day = _clamp(start.add(Duration(days: (_dx * _daysPerPx).round())));
    // A magnet at the expected start: within two days it settles on it.
    final magnet = _day(widget.magnetDay);
    if (day.difference(magnet).inDays.abs() <= 2) day = magnet;
    if (day == _dragDay) return;
    final week = day.difference(_day(widget.weeks.first.start)).inDays ~/ 7;
    if (_lastWeek != null && week != _lastWeek) _haptic();
    _lastWeek = week;
    _dragDay = day;
    widget.onFlagDrag?.call(day);
  }

  void _haptic() => HapticFeedback.selectionClick();

  void _dragEnd() {
    final day = _dragDay;
    _dragStart = null;
    _dragDay = null;
    if (day != null) widget.onFlagEnd?.call(day);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final weeks = widget.weeks;
    return LayoutBuilder(
      builder: (context, box) {
        final width = box.maxWidth;
        final columns = widget.dayColumns?.length ?? weeks.length;
        final col = columns == 0 ? width : width / columns;
        final examX = (columns - 0.5) * col;
        final label = TodayCopy.flagLabel(widget.examDay, own: widget.ownDate);
        final labelStyle = type.small.copyWith(fontSize: 11.5, height: 1.1, fontWeight: FontWeight.w700, color: colors.ground);
        final tp = TextPainter(text: TextSpan(text: label, style: labelStyle), textDirection: TextDirection.ltr, maxLines: 1)..layout();
        final pillW = tp.width + 12 + 10 + 10;
        final pillRight = math.min(width, examX + pillW / 2);
        final pillLeft = math.max(0.0, pillRight - pillW);
        tp.dispose();
        final step = widget.onFlagStep;
        return SizedBox(
          height: RoadStrip.height,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              // The strip itself: a tap opens the rail at the nearest week.
              Positioned.fill(
                child: Semantics(
                  button: true,
                  label: TodayCopy.stripSemantics(weeks.length - 1, label),
                  excludeSemantics: true,
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTapUp: widget.onWeek == null
                        ? null
                        : (d) {
                            final i = widget.dayColumns != null ? 0 : (d.localPosition.dx / col).floor().clamp(0, math.max(0, weeks.length - 2)).toInt();
                            widget.onWeek!(i);
                          },
                    child: AnimatedBuilder(
                      animation: _grow,
                      builder: (context, _) => CustomPaint(
                        size: Size(width, RoadStrip.height),
                        painter: _StripPainter(
                          weeks: weeks,
                          days: widget.dayColumns,
                          colors: colors,
                          monthStyle: type.small.copyWith(fontSize: 11, fontWeight: FontWeight.w600, color: colors.ink3),
                          bandStyle: type.small.copyWith(fontSize: 11, fontWeight: FontWeight.w600, color: colors.ink2),
                          grow: _grow.value,
                          examX: examX,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              // The flag: an ink pill with a grip, dragged by days.
              Positioned(
                key: const ValueKey('road-strip-flag'),
                left: pillLeft,
                top: 0,
                width: pillW,
                height: 26,
                child: Semantics(
                  slider: true,
                  label: TodayCopy.flagLabel(widget.examDay, own: widget.ownDate),
                  value: TodayCopy.roadWeeksTo(own: widget.ownDate, n: weeks.length - 1),
                  onIncrease: step == null ? null : () => step(_clamp(_day(widget.examDay).add(const Duration(days: 7)))),
                  onDecrease: step == null ? null : () => step(_clamp(_day(widget.examDay).subtract(const Duration(days: 7)))),
                  onTap: widget.onFlag,
                  excludeSemantics: true,
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: widget.onFlag,
                    onHorizontalDragStart: widget.onFlagDrag == null ? null : (_) => _dragBegin(width),
                    onHorizontalDragUpdate: widget.onFlagDrag == null ? null : (d) => _dragUpdate(d.delta.dx),
                    onHorizontalDragEnd: widget.onFlagDrag == null ? null : (_) => _dragEnd(),
                    onHorizontalDragCancel: widget.onFlagDrag == null ? null : _dragEnd,
                    child: DecoratedBox(
                      decoration: BoxDecoration(color: colors.ink, borderRadius: BorderRadius.circular(13)),
                      child: Row(
                        children: [
                          const SizedBox(width: 8),
                          _Grip(color: colors.ground.withValues(alpha: 0.7)),
                          const SizedBox(width: 6),
                          Expanded(child: Text(label, maxLines: 1, overflow: TextOverflow.clip, style: labelStyle)),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// Six dots, two by three: the flag can be dragged.
class _Grip extends StatelessWidget {
  const _Grip({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 6,
    height: 10,
    child: CustomPaint(painter: _GripPainter(color)),
  );
}

class _GripPainter extends CustomPainter {
  _GripPainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()..color = color;
    for (var r = 0; r < 3; r++) {
      for (var c = 0; c < 2; c++) {
        canvas.drawCircle(Offset(1 + c * 4.0, 1 + r * 4.0), 1, p);
      }
    }
  }

  @override
  bool shouldRepaint(_GripPainter old) => old.color != color;
}

class _StripPainter extends CustomPainter {
  _StripPainter({
    required this.weeks,
    required this.days,
    required this.colors,
    required this.monthStyle,
    required this.bandStyle,
    required this.grow,
    required this.examX,
  });

  final List<RoadWeek> weeks;
  final List<bool>? days;
  final MmColors colors;
  final TextStyle monthStyle;
  final TextStyle bandStyle;
  final double grow;
  final double examX;

  static const double pipsTop = 56;
  static const double pipsBase = 98;
  static const List<String> _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  void _text(Canvas canvas, String s, TextStyle style, Offset at, {double align = 0}) {
    final tp = TextPainter(text: TextSpan(text: s, style: style), textDirection: TextDirection.ltr, maxLines: 1)..layout();
    tp.paint(canvas, Offset(at.dx - tp.width * align, at.dy));
    tp.dispose();
  }

  @override
  void paint(Canvas canvas, Size size) {
    final dayCols = days;
    final columns = dayCols?.length ?? weeks.length;
    if (columns == 0) return;
    final col = size.width / columns;
    final line2 = colors.lineStrong;
    final accent = colors.isNight ? colors.volt : colors.accentText;

    // The flag's stem, down to the pips' baseline.
    canvas.drawRect(Rect.fromLTWH(examX - 1, 26, 2, pipsBase - 26), Paint()..color = accent);

    if (dayCols == null) {
      // Bands: the registration tick and the boards bar.
      final reg = weeks.indexWhere((w) => w.registration);
      final boardsFirst = weeks.indexWhere((w) => w.boards);
      final boardsLast = weeks.lastIndexWhere((w) => w.boards);
      if (reg > 0) {
        final x = (reg + 0.5) * col;
        canvas.drawRect(Rect.fromLTWH(x - 0.75, 32, 1.5, pipsBase - 32), Paint()..color = line2);
        _text(canvas, TodayCopy.bandRegistration, bandStyle, Offset(x - 4, 30), align: 1);
      }
      if (boardsFirst >= 0) {
        final left = boardsFirst * col + 1, right = (boardsLast + 1) * col - 1;
        canvas.drawRRect(RRect.fromLTRBR(left, 45, right, 49, const Radius.circular(2)), Paint()..color = line2);
        _text(canvas, TodayCopy.bandBoards, bandStyle, Offset(left, 30));
      }
    }

    // Pips.
    final pip = math.min(6.0, col - 3);
    for (var c = 0; c < columns - (dayCols == null ? 1 : 0); c++) {
      final count = dayCols != null ? (dayCols[c] ? 1 : 0) : weeks[c].planned;
      if (count <= 0) continue;
      final done = dayCols != null ? 0 : (weeks[c].done ?? 0);
      final pitch = math.min(pip + 2, (pipsBase - pipsTop) / count);
      final size0 = math.min(pip, pitch - 1);
      // The columns grow from the baseline, left to right, a few milliseconds apart.
      final t = ((grow * (1 + columns * 0.02)) - c * 0.02).clamp(0.0, 1.0);
      final shown = (count * Curves.easeOut.transform(t)).ceil();
      final cx = (c + 0.5) * col;
      for (var k = 0; k < shown; k++) {
        final y = pipsBase - size0 - k * pitch;
        final r = RRect.fromRectAndRadius(Rect.fromLTWH(cx - size0 / 2, y, size0, size0), const Radius.circular(2));
        if (k < done) {
          canvas.drawRRect(r, Paint()..color = colors.volt);
          canvas.drawRRect(r, Paint()
            ..color = colors.voltEdge
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1);
        } else {
          canvas.drawRRect(r, Paint()..color = weeks.isEmpty || dayCols != null || !weeks[c].boards ? line2 : colors.line);
        }
      }
    }

    // This week's column: an ink outline.
    if (dayCols == null) {
      final r = RRect.fromRectAndRadius(Rect.fromLTWH(1, pipsTop - 4, col - 2, pipsBase - pipsTop + 8), const Radius.circular(8));
      canvas.drawRRect(r, Paint()
        ..color = colors.ink
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5);
    }

    // Months: the name under the first week (or day) starting in that month.
    var lastMonth = -1;
    var lastRight = -100.0;
    for (var c = 0; c < columns; c++) {
      final DateTime start = dayCols != null ? weeks.first.start.add(Duration(days: c)) : weeks[c].start;
      if (start.month == lastMonth) continue;
      lastMonth = start.month;
      if (c == 0 && start.day > 20 && columns > 6) continue;
      final x = (c + 0.5) * col;
      if (x - 10 < lastRight) continue;
      _text(canvas, _months[start.month - 1], monthStyle, Offset(math.max(0, x), 102), align: c == 0 ? 0 : 0.5);
      lastRight = x + 12;
    }
  }

  @override
  bool shouldRepaint(_StripPainter old) =>
      old.weeks != weeks || old.days != days || old.colors != colors || old.grow != grow || old.examX != examX;
}
