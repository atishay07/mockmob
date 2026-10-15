// The marks across the last papers of one kind, as one quiet line above "Recent papers": up to
// six opened papers of the same subject, kind and length, oldest to newest, each a dot at its
// real marks. The line draws in the first time the strip comes into view; the newest dot is lit.
// Tapping a dot opens that paper's result (the strip grows into it like a row does). No axis, no
// prediction: the line is the student's own marks and nothing else. It is built only from three
// or more papers and never from a sealed one (see buildTrend).
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/key_button_motion.dart';
import '../copy.dart';
import '../logic/today_model.dart';
import 'today_entrance.dart';
import 'today_reveal.dart';
import 'today_tones.dart';
import 'today_type.dart';

class PaperTrendStrip extends ConsumerWidget {
  const PaperTrendStrip({super.key, required this.trend, required this.onOpen});

  final PaperTrend trend;
  final void Function(TodayTarget target) onOpen;

  /// The chart's height: room for the newest mark above its dot and a margin under the lowest.
  static const double chartHeight = 72;

  /// The chart's height never stands for less than this share of the paper's marks.
  static const double minSpanShare = 0.12;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final points = trend.points;
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s12, bottom: MmSpace.s4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(TodayCopy.trendCaption(points.length, trend.ofKind, trend.kind), style: type.micro.copyWith(color: colors.ink3)),
          const SizedBox(height: MmSpace.s4),
          TodayReveal(
            child: Builder(
              builder: (context) {
                final draw = todayEnterValue(context, delay: const Duration(milliseconds: 60), length: Motion.drawIn);
                return SizedBox(
                  height: chartHeight,
                  child: Stack(
                    children: [
                      Positioned.fill(
                        child: ExcludeSemantics(
                          child: RepaintBoundary(
                            child: CustomPaint(
                              painter: TrendPainter(
                                marks: [for (final p in points) p.marks],
                                minSpan: points.last.outOf * minSpanShare,
                                colors: colors,
                                draw: draw,
                                newest: type.microStrong.copyWith(height: 1, color: colors.ink),
                              ),
                            ),
                          ),
                        ),
                      ),
                      Positioned.fill(
                        child: Row(
                          children: [
                            for (final p in points)
                              Expanded(
                                child: Builder(
                                  builder: (cell) => Semantics(
                                    button: true,
                                    excludeSemantics: true,
                                    label: TodayCopy.trendDot(p.label, p.date, p.marks, p.outOf),
                                    onTap: () => _open(cell, ref, p),
                                    child: GestureDetector(
                                      behavior: HitTestBehavior.opaque,
                                      onTap: () => _open(cell, ref, p),
                                      // A finger on a mark is answered at once: a soft veil behind it.
                                      child: const PressHalo(radius: 14, inset: EdgeInsets.symmetric(horizontal: 2, vertical: 2), child: SizedBox.expand()),
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  void _open(BuildContext cell, WidgetRef ref, TrendPoint p) {
    ref.read(hapticsProvider).selection();
    // The strip grows into the result it opens, like a row (MOTION.md C4).
    MmLaunchRect.capture(cell);
    onOpen(p.target);
  }
}

/// Where a mark sits in the chart: the line and the dots share this, so the touch columns and
/// the picture always agree. Exposed for the tests.
///
/// The marks fill the height only as far as they truly differ: the height never spans less than
/// [minSpan] marks (a share of the paper), so papers a few marks apart read as nearly level, not
/// as a climb. The span is centred on the marks.
Offset trendDot(Size size, List<int> marks, int i, {double top = 24, double bottom = 12, double minSpan = 0}) {
  final n = marks.length;
  final x = size.width / n * (i + 0.5);
  final lo = marks.reduce(math.min), hi = marks.reduce(math.max);
  final room = size.height - top - bottom;
  final span = math.max((hi - lo).toDouble(), minSpan);
  final t = span <= 0 ? 0.5 : (marks[i] - (hi + lo) / 2) / span + 0.5;
  return Offset(x, top + room * (1 - t));
}

class TrendPainter extends CustomPainter {
  TrendPainter({required this.marks, required this.colors, required this.draw, required this.newest, this.minSpan = 0}) : super(repaint: draw);

  final List<int> marks;

  /// The least number of marks the chart's height stands for (see [trendDot]).
  final double minSpan;
  final MmColors colors;
  final Animation<double> draw;
  final TextStyle newest;

  @override
  void paint(Canvas canvas, Size size) {
    final n = marks.length;
    if (n < 2) return;
    final dots = [for (var i = 0; i < n; i++) trendDot(size, marks, i, minSpan: minSpan)];
    final t = Motion.emphasized.transform(draw.value.clamp(0.0, 1.0));
    // The line runs from the first dot toward the last as far as the draw has gone.
    final reach = t * (n - 1);
    final line = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..color = colors.ink.withValues(alpha: colors.isNight ? 0.6 : 0.5);
    final path = Path()..moveTo(dots[0].dx, dots[0].dy);
    for (var i = 1; i < n; i++) {
      if (reach >= i) {
        path.lineTo(dots[i].dx, dots[i].dy);
      } else if (reach > i - 1) {
        final f = reach - (i - 1);
        path.lineTo(dots[i - 1].dx + (dots[i].dx - dots[i - 1].dx) * f, dots[i - 1].dy + (dots[i].dy - dots[i - 1].dy) * f);
        break;
      } else {
        break;
      }
    }
    canvas.drawPath(path, line);

    for (var i = 0; i < n; i++) {
      // A dot appears as the line reaches it: it pops from nothing over the next third of a step.
      final seen = ((reach - i) * 3 + 1).clamp(0.0, 1.0);
      if (seen <= 0) continue;
      final last = i == n - 1;
      final r = (last ? 5.5 : 4.0) * Curves.easeOutBack.transform(seen);
      final c = dots[i];
      if (last) {
        canvas.drawCircle(c, r + 5, Paint()..color = colors.litMark.withValues(alpha: 0.18 * seen));
        canvas.drawCircle(c, r, Paint()..color = colors.litMark);
      } else {
        canvas.drawCircle(c, r, Paint()..color = colors.ground);
        canvas.drawCircle(
          c,
          r,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.5
            ..color = colors.ink.withValues(alpha: 0.75),
        );
      }
    }

    // The newest mark, above its dot once the line has arrived.
    final o = ((t - 0.7) / 0.3).clamp(0.0, 1.0);
    if (o > 0) {
      final tp = TextPainter(
        text: TextSpan(text: '${marks.last}', style: newest.copyWith(color: newest.color?.withValues(alpha: o))),
        textDirection: TextDirection.ltr,
      )..layout();
      final c = dots.last;
      final dx = (c.dx - tp.width / 2).clamp(0.0, size.width - tp.width);
      tp.paint(canvas, Offset(dx, c.dy - 8 - tp.height - 2));
      tp.dispose();
    }
  }

  @override
  bool shouldRepaint(TrendPainter old) =>
      old.marks != marks || old.colors != colors || old.draw != draw || old.newest != newest || old.minSpan != minSpan;
}
