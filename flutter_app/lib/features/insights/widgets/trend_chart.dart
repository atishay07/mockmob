import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/trend.dart';

/// Marks per session in one format, with a chip per format the student has played. A single
/// session is a point and a sentence, never a line.
class TrendSection extends StatefulWidget {
  const TrendSection({super.key, required this.series});

  final List<TrendSeries> series;

  @override
  State<TrendSection> createState() => _TrendSectionState();
}

class _TrendSectionState extends State<TrendSection> {
  String? _key;

  TrendSeries get _selected {
    for (final s in widget.series) {
      if (s.key == _key) return s;
    }
    return defaultSeries(widget.series)!;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final s = _selected;
    final last = s.points.last;
    final formats = widget.series.take(6).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (formats.length > 1) ...[
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            clipBehavior: Clip.none,
            child: Row(
              children: [
                for (final f in formats) ...[
                  MmChip(label: f.label, selected: f.key == s.key, onTap: () => setState(() => _key = f.key)),
                  const SizedBox(width: MmSpace.s8),
                ],
              ],
            ),
          ),
          const SizedBox(height: MmSpace.s16),
        ],
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(child: Text(s.label, style: type.label.copyWith(color: colors.ink2))),
            Text(
              InsightsCopy.trendLatest(last.marks, last.maxMarks),
              style: type.cardTitle.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
            ),
          ],
        ),
        const SizedBox(height: MmSpace.s8),
        Semantics(
          label: '${s.label}: ${[for (final p in s.points) '${p.marks} of ${p.maxMarks}'].join(', ')}',
          child: ExcludeSemantics(
            child: SizedBox(
              height: 148,
              width: double.infinity,
              child: CustomPaint(painter: _TrendPainter(points: s.points, max: s.maxMarks, colors: colors, labelStyle: type.caption.copyWith(color: colors.ink3))),
            ),
          ),
        ),
        const SizedBox(height: MmSpace.s8),
        Text(
          s.points.length < 2 ? InsightsCopy.trendOnePoint : '${InsightsCopy.trendSessions(s.points.length)}. ${InsightsCopy.trendCaption}',
          style: type.caption.copyWith(color: colors.ink3),
        ),
      ],
    );
  }
}

class _TrendPainter extends CustomPainter {
  _TrendPainter({required this.points, required this.max, required this.colors, required this.labelStyle});

  final List<TrendPoint> points;
  final int max;
  final MmColors colors;
  final TextStyle labelStyle;

  static const _maxShown = 20;

  @override
  void paint(Canvas canvas, Size size) {
    final shown = points.length > _maxShown ? points.sublist(points.length - _maxShown) : points;
    const left = 30.0;
    const top = 8.0;
    const bottom = 8.0;
    final plot = Rect.fromLTRB(left, top, size.width - 10, size.height - bottom);
    // Marks can go below zero (more wrong than a fifth of the right).
    final minV = shown.map((p) => p.marks).fold<int>(0, (a, b) => b < a ? b : a).toDouble();
    final maxV = max.toDouble();
    double y(num v) => plot.bottom - (v - minV) / (maxV - minV == 0 ? 1 : maxV - minV) * plot.height;
    double x(int i) => shown.length == 1 ? plot.center.dx : plot.left + plot.width * i / (shown.length - 1);

    final grid = Paint()
      ..color = colors.line
      ..strokeWidth = 1;
    for (final v in [maxV, maxV / 2, 0.0]) {
      canvas.drawLine(Offset(plot.left, y(v)), Offset(plot.right, y(v)), grid);
      final tp = TextPainter(text: TextSpan(text: v.round().toString(), style: labelStyle), textDirection: TextDirection.ltr)..layout();
      tp.paint(canvas, Offset(0, y(v) - tp.height / 2));
    }

    if (shown.length > 1) {
      final path = Path()..moveTo(x(0), y(shown.first.marks));
      for (var i = 1; i < shown.length; i++) {
        path.lineTo(x(i), y(shown[i].marks));
      }
      canvas.drawPath(
        path,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..strokeJoin = StrokeJoin.round
          ..color = colors.ink2,
      );
    }
    final bubbles = BubblePaint(colors);
    for (var i = 0; i < shown.length; i++) {
      final lastPoint = i == shown.length - 1;
      final c = Offset(x(i), y(shown[i].marks));
      canvas.drawCircle(c, lastPoint ? 8 : 5, Paint()..color = colors.ground);
      bubbles.paint(canvas, c, lastPoint ? 7 : 4, lastPoint ? BubbleState.filled : BubbleState.hollow);
    }
  }

  @override
  bool shouldRepaint(_TrendPainter old) => old.points != points || old.max != max || old.colors != colors;
}
