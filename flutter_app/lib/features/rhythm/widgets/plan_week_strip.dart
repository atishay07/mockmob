// The week as seven columns, Monday first: the weekday letter, then one answer bubble that says
// what the day is (counted, planned, rest, or not yet), and the date under it when [showDates].
// Today is the bubble with a 2 dp ink ring and the letter in a heavier weight (no tile). Every
// bubble is a state, never decoration. Shared by Today's week row, the week sheet, the You sheet
// and the rhythm screen.
//
// With [animateIn] the counted days ink one after another from the left when the strip first
// appears (the pencil stroke: 120 ms of lead, 260 ms each, 70 ms apart, so even seven counted days
// are inked inside 800 ms), and with [onDay] each column is a 48 dp target that answers on the next
// frame (it sinks on the press spring, a veil washes it, and a selection tick fires on release)
// and reports the tap (the rhythm screen answers with the day in words). Under reduced motion
// everything is drawn settled.
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart' show BubblePaint, BubbleState, MmPressHaptic, MmPressable;
import '../copy.dart';
import '../logic/plan_week.dart';

class PlanWeekStrip extends StatefulWidget {
  const PlanWeekStrip({
    super.key,
    required this.days,
    this.bubble = 22,
    this.showDates = false,
    this.daySemantics = false,
    this.animateIn = false,
    this.onDay,
    this.selected,
  });

  final List<PlanDay> days;
  final double bubble;
  final bool showDates;

  /// Each day is its own screen-reader stop ("Wednesday, today, planned study day"). Off where
  /// the strip sits inside a control that reads [describe] as one label (Today's week row).
  final bool daySemantics;

  /// Ink the counted days one after another when the strip first appears.
  final bool animateIn;

  /// Makes every day a button. The strip never decides what a tap means.
  final ValueChanged<PlanDay>? onDay;

  /// The day (0 = Monday) the caller is describing; its column is lifted onto a soft tile.
  final int? selected;

  String describe() => days.map((d) => d.describe()).join('; ');

  @override
  State<PlanWeekStrip> createState() => _PlanWeekStripState();
}

class _PlanWeekStripState extends State<PlanWeekStrip> with SingleTickerProviderStateMixin {
  AnimationController? _ink;
  List<Animation<double>> _fills = const [];
  bool _started = false;

  /// Each counted day starts inking 70 ms after the one before it and takes 260 ms.
  static const int _perDayMs = 70;
  static const int _inkMs = 260;
  static const int _leadMs = 120;

  int get _counted => widget.days.where((d) => d.mark == PlanDayMark.done).length;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (!widget.animateIn || Motion.reduced(context) || _counted == 0) return;
    final total = _leadMs + _inkMs + _perDayMs * (_counted - 1);
    final ink = _ink = AnimationController(vsync: this, duration: Duration(milliseconds: total))..forward();
    // 120 ms of lead so the numbers and the first ink do not start on the same frame. One curve
    // per counted day, made once: a curve attaches a listener to the controller.
    _fills = [
      for (var i = 0; i < _counted; i++)
        CurvedAnimation(
          parent: ink,
          curve: Interval(
            ((_leadMs + i * _perDayMs) / total).clamp(0.0, 1.0),
            ((_leadMs + i * _perDayMs + _inkMs) / total).clamp(0.0, 1.0),
            curve: Motion.glide,
          ),
        ),
    ];
  }

  @override
  void dispose() {
    for (final fill in _fills) {
      (fill as CurvedAnimation).dispose();
    }
    _ink?.dispose();
    super.dispose();
  }

  /// The fill of the counted day number [order] (0 first), or null when it is drawn settled.
  Animation<double>? _fillFor(int order) => order < _fills.length ? _fills[order] : null;

  @override
  Widget build(BuildContext context) {
    var order = 0;
    final columns = <Widget>[];
    for (final d in widget.days) {
      final fill = d.mark == PlanDayMark.done ? _fillFor(order++) : null;
      Widget column = _DayColumn(
        day: d,
        bubble: widget.bubble,
        showDate: widget.showDates,
        fill: fill,
        selected: widget.selected == d.index,
      );
      final onDay = widget.onDay;
      if (onDay != null) {
        // The press answers on the next frame: the column sinks, a veil washes it, and the
        // selection tick fires when the tap lands.
        final inner = column;
        column = MmPressable(
          onTap: () => onDay(d),
          button: false,
          highlight: true,
          focusRadius: MmRadius.smallAll,
          haptic: MmPressHaptic.selection,
          builder: (context, pressed, focused) => inner,
        );
      }
      if (widget.daySemantics) {
        column = Semantics(
          container: true,
          button: onDay != null,
          onTap: onDay == null ? null : () => onDay(d),
          label: d.describe(),
          excludeSemantics: true,
          child: column,
        );
      }
      columns.add(Expanded(child: column));
    }
    final row = Row(children: columns);
    return widget.daySemantics ? row : ExcludeSemantics(child: row);
  }
}

/// Draws one day's mark. The same painter draws the strip and the key beneath it, so the key
/// is always a true sample of what the strip shows.
class PlanDotPainter extends CustomPainter {
  PlanDotPainter({required this.colors, required this.mark, this.today = false, this.fill, this.pad = 0}) : super(repaint: fill);

  final MmColors colors;
  final PlanDayMark mark;
  final bool today;

  /// Room kept clear around the bubble for today's ring (the strip uses 12, the key 0).
  final double pad;

  /// 0 to 1 ink for a counted day; null draws it inked.
  final Animation<double>? fill;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    // The ring of today sits 3.5 dp clear of the bubble and is part of the box.
    final r = (size.shortestSide - pad) / 2;
    final stroke = (r * 0.12).clamp(1.2, 2.2);
    if (today) {
      canvas.drawCircle(
        c,
        r + 4.5,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..color = colors.ink,
      );
    }
    switch (mark) {
      case PlanDayMark.done:
        BubblePaint(colors).paint(canvas, c, r, BubbleState.filled, fill: fill?.value ?? 1, origin: const Offset(-0.6, -0.6));
      case PlanDayMark.planned:
        _ring(canvas, c, r, stroke * 1.2, colors.ink2);
      case PlanDayMark.open:
        _ring(canvas, c, r, stroke, colors.ink4);
      case PlanDayMark.rest:
        _dashed(canvas, c, r - stroke / 2, stroke * 1.15, colors.ink3);
        final bar = Paint()
          ..color = colors.ink2
          ..strokeWidth = stroke * 1.3
          ..strokeCap = StrokeCap.round;
        canvas.drawLine(c - Offset(r * 0.34, 0), c + Offset(r * 0.34, 0), bar);
    }
  }

  void _ring(Canvas canvas, Offset c, double r, double stroke, Color color) {
    canvas.drawCircle(
      c,
      r - stroke / 2,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..color = color,
    );
  }

  void _dashed(Canvas canvas, Offset c, double r, double stroke, Color color) {
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round
      ..color = color;
    final rect = Rect.fromCircle(center: c, radius: r);
    const dashes = 10;
    const step = 2 * math.pi / dashes;
    for (var i = 0; i < dashes; i++) {
      canvas.drawArc(rect, i * step - math.pi / 2, step * 0.55, false, paint);
    }
  }

  @override
  bool shouldRepaint(PlanDotPainter old) => old.colors != colors || old.mark != mark || old.today != today || old.fill != fill || old.pad != pad;
}

/// The one-line key under the strip: a small mark and its word, for each kind of mark the strip
/// shows now (owner 13 Oct: every dot must mean something, so the marks are named). It scales
/// down rather than wrapping, so it stays one line. Decorative for screen readers, which read
/// each day in words.
class PlanWeekKey extends StatelessWidget {
  const PlanWeekKey({super.key, required this.days});

  final List<PlanDay> days;

  static BubbleState stateOf(PlanDayMark mark) => switch (mark) {
        PlanDayMark.done => BubbleState.filled,
        PlanDayMark.rest => BubbleState.rest,
        PlanDayMark.planned || PlanDayMark.open => BubbleState.hollow,
      };

  static String wordOf(PlanDayMark mark) => switch (mark) {
        PlanDayMark.done => RhythmCopy.keyCounted,
        PlanDayMark.planned => RhythmCopy.keyPlanned,
        PlanDayMark.rest => RhythmCopy.keyRest,
        PlanDayMark.open => RhythmCopy.keyOpen,
      };

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final shown = {for (final d in days) d.mark};
    final marks = [for (final m in PlanDayMark.values) if (shown.contains(m)) m];
    return ExcludeSemantics(
      child: FittedBox(
        fit: BoxFit.scaleDown,
        alignment: Alignment.centerLeft,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var i = 0; i < marks.length; i++) ...[
              if (i > 0) const SizedBox(width: MmSpace.s16),
              SizedBox.square(
                dimension: 12,
                child: CustomPaint(painter: PlanDotPainter(colors: colors, mark: marks[i])),
              ),
              const SizedBox(width: MmSpace.s6),
              Text(wordOf(marks[i]), style: type.caption.copyWith(fontSize: 12, height: 16 / 12, color: colors.ink2), textScaler: TextScaler.noScaling),
            ],
          ],
        ),
      ),
    );
  }
}

class _DayColumn extends StatelessWidget {
  const _DayColumn({required this.day, required this.bubble, required this.showDate, required this.fill, required this.selected});

  final PlanDay day;
  final double bubble;
  final bool showDate;
  final Animation<double>? fill;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final today = day.isToday;
    final letterStyle = type.caption.copyWith(
      fontSize: 12,
      height: 16 / 12,
      fontWeight: today || selected ? FontWeight.w700 : FontWeight.w500,
      color: today || selected ? colors.ink : (day.mark == PlanDayMark.rest ? colors.ink3 : colors.ink2),
      letterSpacing: 0.4,
    );
    // The box is a little larger than the bubble so today's ring is inside it.
    final box = bubble + 12;
    final column = Padding(
      padding: const EdgeInsets.symmetric(vertical: MmSpace.s8),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(day.initial, style: letterStyle, textScaler: MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.3)),
          const SizedBox(height: MmSpace.s6),
          RepaintBoundary(
            child: SizedBox.square(
              dimension: box,
              child: CustomPaint(painter: PlanDotPainter(colors: colors, mark: day.mark, today: today, fill: fill, pad: 12)),
            ),
          ),
          if (showDate && day.date != null) ...[
            const SizedBox(height: MmSpace.s2),
            Text(
              '${day.date}',
              style: type.caption.copyWith(fontSize: 12, height: 16 / 12, color: today || selected ? colors.ink : colors.ink3),
              textScaler: MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.3),
            ),
          ],
        ],
      ),
    );
    if (!selected) return column;
    return DecoratedBox(
      // The chosen column is a well in both themes (Night: a lifted dark well; Daylight: the
      // sunken cream), on the 12 dp control radius.
      decoration: BoxDecoration(color: colors.isNight ? colors.raised2.withValues(alpha: 0.7) : colors.sunken, borderRadius: MmRadius.smallAll),
      child: column,
    );
  }
}
