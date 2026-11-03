// The large week strip of the week sheet and the You rhythm screen: seven 36 dp marks, the date
// under each. A study day is an ink circle with a check, today has a 2 dp outline, the other days
// are hairline circles. When the screen opens, the checks draw in one after another over 600 ms
// (the one motion on this strip); reduced motion shows them finished.
import 'package:flutter/material.dart';

import '../../../core/copy/formatters.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../logic/week_view.dart';

class WeekMarks extends StatefulWidget {
  const WeekMarks({super.key, required this.week, this.animate = true});

  final WeekView week;
  final bool animate;

  static const double mark = 36;

  @override
  State<WeekMarks> createState() => _WeekMarksState();
}

class _WeekMarksState extends State<WeekMarks> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 600));
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
    final today = widget.week.days.indexWhere((d) => d.isToday);
    return [
      widget.week.label,
      study.isEmpty ? 'No study days yet this week' : 'Study days: ${joinWithAnd(study)}',
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
          height: WeekMarks.mark + 8 + 16,
          width: double.infinity,
          child: CustomPaint(
            painter: _MarksPainter(
              days: widget.week.days,
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
  _MarksPainter({required this.days, required this.progress, required this.colors, required this.labelStyle}) : super(repaint: progress);

  final List<WeekDayMark> days;
  final Animation<double> progress;
  final MmColors colors;
  final TextStyle labelStyle;

  @override
  void paint(Canvas canvas, Size size) {
    const d = WeekMarks.mark;
    const r = d / 2;
    final gap = ((size.width - d * 7) / 6).clamp(2.0, 24.0);
    final total = d * 7 + gap * 6;
    final left = (size.width - total) / 2;

    final hairline = Paint()
      ..color = colors.lineStrong
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    final ring = Paint()
      ..color = colors.ink
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;

    var studyIndex = 0;
    for (var i = 0; i < 7; i++) {
      final day = days[i];
      final c = Offset(left + r + i * (d + gap), r);
      if (day.studyDay) {
        // Each study day starts a little after the one before it.
        final start = studyIndex * 0.09;
        studyIndex++;
        final t = ((progress.value - start) / 0.4).clamp(0.0, 1.0);
        final fillT = Curves.easeOut.transform((t / 0.5).clamp(0.0, 1.0));
        final checkT = ((t - 0.4) / 0.6).clamp(0.0, 1.0);
        final radius = day.isToday ? r - 4.5 : r;
        // Fill grows from 90% to full: opacity-free, so it stays one flat layer.
        canvas.drawCircle(c, radius * (0.9 + 0.1 * fillT), Paint()..color = Color.lerp(colors.ground, colors.ink, fillT)!);
        if (day.isToday) canvas.drawCircle(c, r - 1, ring);
        _check(canvas, c, checkT, day.isToday ? 0.85 : 1);
      } else {
        canvas.drawCircle(c, day.isToday ? r - 1 : r - 0.5, day.isToday ? ring : hairline);
        _text(canvas, weekdayInitials[i], c, 14, day.isToday ? colors.ink : colors.ink3, center: true);
      }
      final date = day.date;
      if (date != null) {
        _text(canvas, '${date.day}', Offset(c.dx, d + 8), 12, day.isToday ? colors.ink : colors.ink3, center: false);
      }
    }
  }

  void _check(Canvas canvas, Offset c, double t, double k) {
    if (t <= 0) return;
    final a = c + Offset(-5.5 * k, 0.5 * k);
    final b = c + Offset(-1.8 * k, 4.2 * k);
    final e = c + Offset(5.5 * k, -3.6 * k);
    final first = (b - a).distance;
    final second = (e - b).distance;
    final drawn = (first + second) * t;
    final path = Path()..moveTo(a.dx, a.dy);
    if (drawn <= first) {
      final p = a + (b - a) * (drawn / first);
      path.lineTo(p.dx, p.dy);
    } else {
      path.lineTo(b.dx, b.dy);
      final p = b + (e - b) * ((drawn - first) / second);
      path.lineTo(p.dx, p.dy);
    }
    canvas.drawPath(
      path,
      Paint()
        ..color = colors.ground
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.4
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
  }

  void _text(Canvas canvas, String text, Offset at, double size, Color color, {required bool center}) {
    final painter = TextPainter(
      text: TextSpan(text: text, style: labelStyle.copyWith(fontSize: size, height: 1, color: color)),
      textDirection: TextDirection.ltr,
      textScaler: TextScaler.noScaling,
    )..layout();
    final origin = center ? at - Offset(painter.width / 2, painter.height / 2) : at - Offset(painter.width / 2, 0);
    painter.paint(canvas, origin);
    painter.dispose();
  }

  @override
  bool shouldRepaint(_MarksPainter old) => old.colors != colors || old.labelStyle != labelStyle || old.days != days;
}
