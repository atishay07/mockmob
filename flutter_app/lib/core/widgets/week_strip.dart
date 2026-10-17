import 'package:flutter/material.dart';

import '../copy/formatters.dart';
import '../theme/theme.dart';
import 'bubbles/bubble_painter.dart';

/// One day of the weekly strip. Days are Monday first.
class WeekStripDay {
  const WeekStripDay({this.studyDay = false, this.isToday = false, this.rest = false});

  final bool studyDay;
  final bool isToday;

  /// A chosen rest day: drawn as its own dashed shape, never as a miss.
  final bool rest;
}

/// The weekly rhythm row: the week as seven answer bubbles with weekday initials, the caller's
/// text on the left. A study day is inked, today is ringed, a rest day has its own dashed shape,
/// other days are hollow rings. No flame, no numeric badge, nothing punitive.
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

/// Paints the week as answer bubbles with the weekday initial inside each.
class WeekStripPainter extends CustomPainter {
  WeekStripPainter({required this.days, required this.colors, required this.initialStyle});

  final List<WeekStripDay> days;
  final MmColors colors;
  final TextStyle initialStyle;

  @override
  void paint(Canvas canvas, Size size) {
    const cell = WeekStrip.circle;
    final bubbles = BubblePaint(colors);
    final cy = size.height / 2;
    for (var i = 0; i < days.length; i++) {
      final day = days[i];
      final center = Offset(cell / 2 + i * (cell + WeekStrip.gap), cy);
      // Today is ringed in ink; the bubble shrinks a little inside the ring.
      final r = day.isToday ? cell / 2 - 4 : cell / 2 - 1;
      if (day.isToday) {
        canvas.drawCircle(
          center,
          cell / 2 - 0.8,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.6
            ..color = colors.ink,
        );
      }
      final state = day.studyDay ? BubbleState.filled : (day.rest ? BubbleState.rest : BubbleState.hollow);
      if (day.studyDay) {
        // A studied day is a neutral disc with an ink initial: the volt stays on the screen's key.
        canvas.drawCircle(center, r, Paint()..color = Color.alphaBlend(colors.ink.withValues(alpha: 0.16), colors.raised2));
        canvas.drawCircle(
          center,
          r - 0.5,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1
            ..color = colors.ink3,
        );
      } else {
        bubbles.paint(canvas, center, r, state);
      }
      if (state == BubbleState.rest) continue;
      _paintInitial(
        canvas,
        center,
        weekdayInitials[i],
        day.studyDay || day.isToday ? colors.ink : colors.ink3,
      );
    }
  }

  void _paintInitial(Canvas canvas, Offset center, String initial, Color color) {
    final painter = TextPainter(
      text: TextSpan(text: initial, style: initialStyle.copyWith(fontSize: 11, height: 1, color: color, fontWeight: FontWeight.w700)),
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
      if (other[i].studyDay != days[i].studyDay || other[i].isToday != days[i].isToday || other[i].rest != days[i].rest) {
        return false;
      }
    }
    return true;
  }
}
