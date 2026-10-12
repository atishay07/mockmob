import 'package:flutter/material.dart';

import '../copy/formatters.dart';
import '../theme/theme.dart';

/// One day of the weekly strip. Days are Monday first.
class WeekStripDay {
  const WeekStripDay({this.studyDay = false, this.isToday = false});

  final bool studyDay;
  final bool isToday;
}

/// The weekly rhythm row (spec 6.1): seven 28 dp circles with weekday initials, the caller's
/// text on the left. A study day is an ink-filled circle with a check, today has a 2 dp
/// outline, other days are hairline circles. No volt, no flame, no numeric badge.
///
/// At large text scale the text moves above the circles. [onTap] opens the week sheet.
class WeekStrip extends StatelessWidget {
  const WeekStrip({super.key, required this.days, required this.label, this.onTap, this.semanticsLabel})
      : assert(days.length == 7, 'A week has seven days.');

  final List<WeekStripDay> days;

  /// The left text, for example "2 of 4 study days".
  final String label;
  final VoidCallback? onTap;

  /// Overrides the generated description.
  final String? semanticsLabel;

  static const double circle = 28;
  static const double gap = 3;
  static const double width = circle * 7 + gap * 6;

  String _describe() {
    final study = <String>[
      for (var i = 0; i < 7; i++)
        if (days[i].studyDay) weekdayNames[i],
    ];
    final today = days.indexWhere((d) => d.isToday);
    final parts = <String>[
      label,
      study.isEmpty ? 'No study days yet this week' : 'Study days: ${joinWithAnd(study)}',
      if (today >= 0) 'Today is ${weekdayNames[today]}',
    ];
    return parts.join('. ');
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final stacked = MediaQuery.textScalerOf(context).scale(1) > 1.3;

    final circles = ExcludeSemantics(
      child: RepaintBoundary(
        child: CustomPaint(
          size: const Size(width, circle),
          painter: WeekStripPainter(days: days, colors: colors, initialStyle: type.label),
        ),
      ),
    );
    final text = Text(label, style: type.label.copyWith(color: colors.ink));

    final content = stacked
        ? Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [text, const SizedBox(height: MmSpace.s8), circles],
          )
        : Row(
            children: [
              Expanded(child: text),
              const SizedBox(width: MmSpace.s12),
              circles,
            ],
          );

    final padded = ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 44),
      child: Align(alignment: Alignment.centerLeft, child: content),
    );

    return Semantics(
      container: true,
      button: onTap != null,
      label: semanticsLabel ?? _describe(),
      excludeSemantics: true,
      onTap: onTap,
      child: onTap == null
          ? padded
          : GestureDetector(behavior: HitTestBehavior.opaque, onTap: onTap, child: padded),
    );
  }
}

class WeekStripPainter extends CustomPainter {
  WeekStripPainter({required this.days, required this.colors, required this.initialStyle});

  final List<WeekStripDay> days;
  final MmColors colors;
  final TextStyle initialStyle;

  @override
  void paint(Canvas canvas, Size size) {
    const r = WeekStrip.circle / 2;
    final cy = size.height / 2;
    final fill = Paint()..color = colors.ink;
    final hairline = Paint()
      ..color = colors.lineStrong
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    final ring = Paint()
      ..color = colors.ink
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    final check = Paint()
      ..color = colors.ground
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    for (var i = 0; i < days.length; i++) {
      final day = days[i];
      final center = Offset(r + i * (WeekStrip.circle + WeekStrip.gap), cy);

      if (day.studyDay) {
        // Today keeps its outline with a gap, so "today and a study day" still reads.
        canvas.drawCircle(center, day.isToday ? r - 4.5 : r, fill);
        if (day.isToday) canvas.drawCircle(center, r - 1, ring);
        final k = day.isToday ? 0.8 : 1.0;
        final path = Path()
          ..moveTo(center.dx - 4.5 * k, center.dy + 0.5 * k)
          ..lineTo(center.dx - 1.5 * k, center.dy + 3.5 * k)
          ..lineTo(center.dx + 4.5 * k, center.dy - 3 * k);
        canvas.drawPath(path, check);
      } else {
        if (day.isToday) {
          canvas.drawCircle(center, r - 1, ring);
        } else {
          canvas.drawCircle(center, r - 0.5, hairline);
        }
        _paintInitial(canvas, center, weekdayInitials[i], day.isToday ? colors.ink : colors.ink3);
      }
    }
  }

  void _paintInitial(Canvas canvas, Offset center, String initial, Color color) {
    final painter = TextPainter(
      text: TextSpan(text: initial, style: initialStyle.copyWith(fontSize: 12, height: 1, color: color)),
      textDirection: TextDirection.ltr,
      textScaler: TextScaler.noScaling,
    )..layout();
    painter.paint(canvas, center - Offset(painter.width / 2, painter.height / 2));
    painter.dispose();
  }

  @override
  bool shouldRepaint(WeekStripPainter old) =>
      old.colors != colors || old.initialStyle != initialStyle || !_sameDays(old.days);

  bool _sameDays(List<WeekStripDay> other) {
    if (other.length != days.length) return false;
    for (var i = 0; i < days.length; i++) {
      if (other[i].studyDay != days[i].studyDay || other[i].isToday != days[i].isToday) return false;
    }
    return true;
  }
}
