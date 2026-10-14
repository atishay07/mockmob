// The large week row of the week sheet and the You rhythm screen: seven answer bubbles, Monday
// first, each with its weekday letter printed inside like the rings of an OMR sheet and the
// date beneath. A study day is inked over its letter (volt on Night); today carries the ring.
// When the screen opens the study days ink one after another, from the upper left like a pencil
// stroke (the one motion here); reduced motion shows them inked.
import 'package:flutter/material.dart';

import '../../../core/copy/formatters.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart' show BubblePaint, BubbleState;
import '../logic/week_view.dart';

class WeekMarks extends StatefulWidget {
  const WeekMarks({super.key, required this.week, this.animate = true, this.mark = 36, this.restDays = const {}});

  final WeekView week;
  final bool animate;

  /// The student's rest days (0 = Monday): drawn with the rest mark unless studied anyway.
  final Set<int> restDays;

  /// Bubble diameter.
  final double mark;

  @override
  State<WeekMarks> createState() => _WeekMarksState();
}

class _WeekMarksState extends State<WeekMarks> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 640));
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (!widget.animate || Motion.reduced(context)) {
      _controller.value = 1;
    } else {
      _controller.forward();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  String _describe() {
    final study = <String>[
      for (var i = 0; i < 7; i++)
        if (widget.week.days[i].studyDay) weekdayNames[i],
    ];
    final rest = [for (var i = 0; i < 7; i++) if (widget.restDays.contains(i) && !widget.week.days[i].studyDay) weekdayNames[i]];
    final today = widget.week.days.indexWhere((d) => d.isToday);
    return [
      widget.week.label,
      study.isEmpty ? 'No study days yet this week' : 'Study days: ${joinWithAnd(study)}',
      if (rest.isNotEmpty) 'Rest days: ${joinWithAnd(rest)}',
      if (today >= 0) 'Today is ${weekdayNames[today]}',
    ].join('. ');
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      label: _describe(),
      excludeSemantics: true,
      child: RepaintBoundary(
        child: SizedBox(
          height: widget.mark + 14 + 16,
          width: double.infinity,
          child: CustomPaint(
            painter: _MarksPainter(
              days: widget.week.days,
              rest: widget.restDays,
              mark: widget.mark,
              progress: _controller,
              colors: colors,
              labelStyle: type.label,
            ),
          ),
        ),
      ),
    );
  }
}

class _MarksPainter extends CustomPainter {
  _MarksPainter({required this.days, required this.rest, required this.mark, required this.progress, required this.colors, required this.labelStyle})
      : super(repaint: progress);

  final List<WeekDayMark> days;
  final Set<int> rest;
  final double mark;
  final Animation<double> progress;
  final MmColors colors;
  final TextStyle labelStyle;

  @override
  void paint(Canvas canvas, Size size) {
    final r = mark / 2;
    const pad = 5.0;
    final gap = ((size.width - pad * 2 - mark * 7) / 6).clamp(2.0, 28.0);
    final total = mark * 7 + gap * 6;
    final left = (size.width - total) / 2;
    final bubbles = BubblePaint(colors);

    var studyIndex = 0;
    for (var i = 0; i < 7; i++) {
      final day = days[i];
      final c = Offset(left + r + i * (mark + gap), pad + r);
      if (day.studyDay) {
        // Each study day starts inking a little after the one before it.
        final start = studyIndex * 0.12;
        studyIndex++;
        final t = Curves.easeOut.transform(((progress.value - start) / 0.45).clamp(0.0, 1.0));
        bubbles.paint(canvas, c, r, BubbleState.filled, fill: t, origin: const Offset(-0.6, -0.6), emphasis: day.isToday);
        if (t < 1) _letter(canvas, weekdayInitials[i], c, (1 - t) * (day.isToday ? 1 : 0.9));
      } else if (rest.contains(i)) {
        bubbles.paint(canvas, c, r, BubbleState.rest, emphasis: day.isToday);
      } else {
        bubbles.paint(canvas, c, r, BubbleState.hollow, emphasis: day.isToday);
        _letter(canvas, weekdayInitials[i], c, day.isToday ? 1 : 0.9, today: day.isToday);
      }
      final date = day.date;
      if (date != null) {
        _text(canvas, '${date.day}', Offset(c.dx, pad + mark + 10), 12, day.isToday ? colors.ink : colors.ink3);
      }
    }
  }

  void _letter(Canvas canvas, String letter, Offset c, double opacity, {bool today = false}) {
    final color = (today ? colors.ink : colors.ink3);
    final painter = TextPainter(
      text: TextSpan(
        text: letter,
        style: labelStyle.copyWith(fontSize: mark * 0.36, height: 1, color: color.withValues(alpha: color.a * opacity)),
      ),
      textDirection: TextDirection.ltr,
      textScaler: TextScaler.noScaling,
    )..layout();
    painter.paint(canvas, c - Offset(painter.width / 2, painter.height / 2));
    painter.dispose();
  }

  void _text(Canvas canvas, String text, Offset at, double size, Color color) {
    final painter = TextPainter(
      text: TextSpan(text: text, style: labelStyle.copyWith(fontSize: size, height: 1, color: color)),
      textDirection: TextDirection.ltr,
      textScaler: TextScaler.noScaling,
    )..layout();
    painter.paint(canvas, at - Offset(painter.width / 2, 0));
    painter.dispose();
  }

  @override
  bool shouldRepaint(_MarksPainter old) =>
      old.colors != colors || old.labelStyle != labelStyle || old.days != days || old.mark != mark || old.rest != rest;
}
