import 'package:flutter/material.dart';

import '../../copy/formatters.dart';
import '../../theme/theme.dart';
import 'bubble_painter.dart';

/// What one day of the week shows.
enum WeekDayMark {
  /// A study day that happened: inked.
  done,

  /// A planned study day still to come, or one that passed without study (never shamed).
  open,

  /// A chosen rest day: drawn distinct, never as a miss.
  rest,
}

class WeekBubbleDay {
  const WeekBubbleDay({this.mark = WeekDayMark.open, this.isToday = false});

  final WeekDayMark mark;
  final bool isToday;
}

/// The week as seven bubbles, Monday first, with weekday initials beneath (brief section 12).
/// Today is ringed; done days are inked; rest days have their own dashed shape with a bar.
class WeekBubbles extends StatelessWidget {
  const WeekBubbles({
    super.key,
    required this.days,
    this.bubbleSize = 22,
    this.gap = 8,
    this.initials = true,
    this.semanticsLabel,
  }) : assert(days.length == 7, 'A week has seven days.');

  final List<WeekBubbleDay> days;
  final double bubbleSize;
  final double gap;
  final bool initials;
  final String? semanticsLabel;

  double get width => bubbleSize * 7 + gap * 6 + 10;

  String describe() {
    final done = [for (var i = 0; i < 7; i++) if (days[i].mark == WeekDayMark.done) weekdayNames[i]];
    final rest = [for (var i = 0; i < 7; i++) if (days[i].mark == WeekDayMark.rest) weekdayNames[i]];
    final today = days.indexWhere((d) => d.isToday);
    return [
      done.isEmpty ? 'No study days yet this week' : 'Studied ${joinWithAnd(done)}',
      if (rest.isNotEmpty) 'Rest ${joinWithAnd(rest)}',
      if (today >= 0) 'Today is ${weekdayNames[today]}',
    ].join('. ');
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final style = context.mmType.caption.copyWith(fontSize: 11, height: 1, fontWeight: FontWeight.w600);
    final height = bubbleSize + 10 + (initials ? 16 : 0);
    return Semantics(
      container: true,
      label: semanticsLabel ?? describe(),
      excludeSemantics: true,
      child: RepaintBoundary(
        child: CustomPaint(
          size: Size(width, height),
          painter: _WeekPainter(days: days, size: bubbleSize, gap: gap, colors: colors, style: initials ? style : null),
        ),
      ),
    );
  }
}

class _WeekPainter extends CustomPainter {
  _WeekPainter({required this.days, required this.size, required this.gap, required this.colors, this.style});

  final List<WeekBubbleDay> days;
  final double size;
  final double gap;
  final MmColors colors;
  final TextStyle? style;

  @override
  void paint(Canvas canvas, Size canvasSize) {
    final bubbles = BubblePaint(colors);
    final r = size / 2;
    const pad = 5.0;
    for (var i = 0; i < 7; i++) {
      final day = days[i];
      final c = Offset(pad + r + i * (size + gap), pad + r);
      final state = switch (day.mark) {
        WeekDayMark.done => BubbleState.filled,
        WeekDayMark.open => BubbleState.hollow,
        WeekDayMark.rest => BubbleState.rest,
      };
      bubbles.paint(canvas, c, r, state, emphasis: day.isToday);
      if (style != null) {
        final tp = TextPainter(
          text: TextSpan(
            text: weekdayInitials[i],
            style: style!.copyWith(color: day.isToday ? colors.ink : colors.ink3),
          ),
          textDirection: TextDirection.ltr,
          textScaler: TextScaler.noScaling,
        )..layout();
        tp.paint(canvas, Offset(c.dx - tp.width / 2, pad + size + 8));
        tp.dispose();
      }
    }
  }

  @override
  bool shouldRepaint(_WeekPainter old) {
    if (old.colors != colors || old.size != size || old.gap != gap || old.style != style) return true;
    for (var i = 0; i < 7; i++) {
      if (old.days[i].mark != days[i].mark || old.days[i].isToday != days[i].isToday) return true;
    }
    return false;
  }
}
