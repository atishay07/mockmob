// Your marks (D52 item 3, TODAY-SWIPE-1018, mock today.html #marks): v10's trend line back on
// Today, merged with Last paper so no block is added. The last six full mocks in the move's subject
// (each point its real marks, the newest lit and named in the figure face), a dashed round-number
// reference, one line in words ("204 on Mock 7, your best of these 6. +33 on Mock 6."), then the
// Last paper block under a hairline, its sub-line the date alone when it is that same mock (the
// change is said once). With fewer than two full mocks there is no line and
// the block is Last paper alone, as before. The line draws once, 600 ms, the first time it comes
// into view, and the newest point pops from 0.95; under reduced motion it is all there at once.
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../copy_ahead.dart';
import '../logic/marks_trend.dart';
import '../logic/today_model.dart';
import 'glance_rows.dart' show GlanceHead, LastPaperBlock;
import 'reveal_once.dart';
import 'today_tones.dart';
import 'today_type.dart';

class YourMarksBlock extends StatelessWidget {
  const YourMarksBlock({super.key, this.trend, this.paper, this.onOpen});

  final MarksTrend? trend;
  final PaperDetail? paper;
  final void Function(TodayTarget target)? onOpen;

  /// The chart's height (mock: 132).
  static const double chartHeight = 132;

  /// The line's one draw (D52 motion).
  static const Duration drawLength = Duration(milliseconds: 600);

  @override
  Widget build(BuildContext context) {
    final t = trend;
    final p = paper;
    // Fewer than two full mocks: Last paper alone, exactly as v15 shows it.
    if (t == null) return p == null ? const SizedBox.shrink() : LastPaperBlock(detail: p, onOpen: onOpen);
    final colors = context.mmColors;
    final type = context.mmType;
    final newest = t.newest;
    final best = t.best;
    final prev = t.previous;
    final n = t.points.length;
    final head = identical(best, newest) || best.marks == newest.marks
        ? AheadCopy.marksBest(newest.marks, newest.label, n)
        : AheadCopy.marksNotBest(newest.marks, newest.label, n, best.marks, best.label);
    final delta = prev == null ? null : newest.marks - prev.marks;
    final lead = '${newest.marks}';
    final lineStyle = type.small.copyWith(fontSize: 14, height: 20 / 14, color: colors.ink2);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        GlanceHead(title: AheadCopy.marksTitle, sub: AheadCopy.marksSub(n, t.ofSubject, t.subject)),
        const SizedBox(height: MmSpace.s8),
        Semantics(
          label: AheadCopy.chartSemantics([for (final q in t.points) (q.label, q.marks)], t.outOf),
          excludeSemantics: true,
          child: SizedBox(
            height: chartHeight,
            child: RevealOnce(
              id: 'today-your-marks',
              length: drawLength,
              builder: (context, progress) => RepaintBoundary(
                child: CustomPaint(
                  size: Size.infinite,
                  painter: MarksPainter(
                    marks: [for (final q in t.points) q.marks],
                    labels: [for (final q in t.points) q.label],
                    outOf: t.outOf,
                    colors: colors,
                    draw: progress,
                    label: type.micro.copyWith(fontWeight: FontWeight.w600, color: colors.ink3),
                    newestFigure: type.figureCompact.copyWith(fontSize: 18, height: 1, color: colors.ink, letterSpacing: 0),
                    textScaler: MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.15),
                  ),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: MmSpace.s6),
        Text.rich(
          TextSpan(children: [
            TextSpan(text: lead, style: TextStyle(color: colors.ink, fontWeight: FontWeight.w700)),
            TextSpan(text: head.substring(lead.length)),
            // The change on the mock before, in its true sign; equal marks say "Level with Mock 6."
            if (delta != null && prev != null) ...[
              const TextSpan(text: ' '),
              TextSpan(
                text: AheadCopy.marksChange(delta, prev.label),
                style: delta > 0 ? TextStyle(color: colors.goodText, fontWeight: FontWeight.w600) : null,
              ),
            ],
          ]),
          style: lineStyle,
        ),
        if (p != null) ...[
          const SizedBox(height: 18),
          Divider(height: 1, thickness: 1, color: colors.line),
          const SizedBox(height: MmSpace.s16),
          // The marks line already says the newest mock's change: Last paper keeps only its date.
          LastPaperBlock(detail: p, onOpen: onOpen, headed: false, change: !(delta != null && p.paper.target == newest.target)),
        ],
      ],
    );
  }
}

/// The marks line: points at their real marks between a padded floor and ceiling (never spanning
/// less than 12% of the paper, so papers a few marks apart read as nearly level), a dashed
/// round-number reference, values over the points and the papers' names under them.
class MarksPainter extends CustomPainter {
  MarksPainter({
    required this.marks,
    required this.labels,
    required this.outOf,
    required this.colors,
    required this.draw,
    required this.label,
    required this.newestFigure,
    this.textScaler = TextScaler.noScaling,
  }) : super(repaint: draw);

  final List<int> marks;
  final List<String> labels;
  final int outOf;
  final MmColors colors;
  final Animation<double> draw;
  final TextStyle label;
  final TextStyle newestFigure;
  final TextScaler textScaler;

  /// Room on the left for the reference's number, clear of the first point's value (mock: 38).
  static const double left = 38;
  static const double right = 34;
  static const double top = 26;
  static const double bottomRoom = 36;

  /// The dashed reference: the round fifty at or under the best mark, when there is one.
  static int? referenceFor(List<int> marks) {
    final hi = marks.reduce(math.max);
    final ref = (hi ~/ 50) * 50;
    return ref > 0 ? ref : null;
  }

  /// The marks the chart's floor and ceiling stand for: the points and the reference, never
  /// spanning less than 12% of the paper, with a little room above and below.
  static (double, double) scaleFor(List<int> marks, int outOf) {
    final ref = referenceFor(marks);
    var lo = marks.reduce(math.min).toDouble();
    var hi = marks.reduce(math.max).toDouble();
    if (ref != null) lo = math.min(lo, ref.toDouble());
    final minSpan = outOf * 0.12;
    if (hi - lo < minSpan) {
      final mid = (hi + lo) / 2;
      lo = mid - minSpan / 2;
      hi = mid + minSpan / 2;
    }
    final pad = (hi - lo) * 0.12;
    return (lo - pad, hi + pad);
  }

  /// The height of [value] marks on the chart.
  static double yFor(Size size, List<int> marks, int outOf, double value) {
    final (lo, hi) = scaleFor(marks, outOf);
    final yBot = size.height - bottomRoom;
    return yBot - (value - lo) / (hi - lo) * (yBot - top);
  }

  /// Where point [i] sits. Exposed for the tests.
  static Offset point(Size size, List<int> marks, int outOf, int i) {
    final n = marks.length;
    final x = n == 1 ? size.width / 2 : left + i * (size.width - left - right) / (n - 1);
    return Offset(x, yFor(size, marks, outOf, marks[i].toDouble()));
  }

  @override
  void paint(Canvas canvas, Size size) {
    final n = marks.length;
    if (n < 2 || size.width <= left + right) return;
    final t = Motion.out.transform(draw.value.clamp(0.0, 1.0));
    final pts = [for (var i = 0; i < n; i++) point(size, marks, outOf, i)];

    final ref = referenceFor(marks);
    final refY = ref == null ? null : yFor(size, marks, outOf, ref.toDouble());
    final showRef = refY != null && refY > 8 && refY < size.height - bottomRoom + 4;
    final valueRects = valueRectsFor(size);

    // The reference, dashed, with its number at the left edge, over the line (under it when a value
    // sits there), the dashes broken wherever a value still crosses the line.
    if (showRef) {
      final y = refY;
      final refRect = referenceLabelRect(size, valueRects)!;
      final breaks = [for (final r in valueRects) if (y >= r.top - 2 && y <= r.bottom + 2) r.inflate(4)];
      final dash = Paint()
        ..color = colors.lineStrong
        ..strokeWidth = 1;
      for (var x = 0.0; x < size.width; x += 7) {
        final x2 = math.min(x + 3, size.width);
        if (breaks.any((b) => x2 >= b.left && x <= b.right)) continue;
        canvas.drawLine(Offset(x, y), Offset(x2, y), dash);
      }
      _text(canvas, '$ref', label, refRect.bottomLeft, anchor: _Anchor.bottomLeft);
    }

    // The line, drawn from the oldest toward the newest as far as the draw has gone.
    final reach = t * (n - 1);
    final path = Path()..moveTo(pts[0].dx, pts[0].dy);
    for (var i = 1; i < n; i++) {
      if (reach >= i) {
        path.lineTo(pts[i].dx, pts[i].dy);
      } else if (reach > i - 1) {
        final f = reach - (i - 1);
        path.lineTo(pts[i - 1].dx + (pts[i].dx - pts[i - 1].dx) * f, pts[i - 1].dy + (pts[i].dy - pts[i - 1].dy) * f);
        break;
      } else {
        break;
      }
    }
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..strokeJoin = StrokeJoin.round
        ..strokeCap = StrokeCap.round
        ..color = colors.ink2,
    );

    for (var i = 0; i < n; i++) {
      final seen = ((reach - i) * 3 + 1).clamp(0.0, 1.0);
      final last = i == n - 1;
      final c = pts[i];
      if (seen > 0) {
        if (last) {
          // The newest point pops from 0.95 as the line arrives; a flat 22% disc behind it, no blur.
          final s = 0.95 + 0.05 * seen;
          canvas.drawCircle(c, 10 * s, Paint()..color = colors.litMark.withValues(alpha: 0.22 * seen));
          canvas.drawCircle(c, 6 * s, Paint()..color = colors.litMark.withValues(alpha: seen));
        } else {
          canvas.drawCircle(c, 4.5, Paint()..color = colors.ground.withValues(alpha: seen));
          canvas.drawCircle(
            c,
            4.5,
            Paint()
              ..style = PaintingStyle.stroke
              ..strokeWidth = 2
              ..color = colors.ink2.withValues(alpha: seen),
          );
        }
        final valueStyle = last ? newestFigure : label;
        _text(canvas, '${marks[i]}', valueStyle.copyWith(color: valueStyle.color?.withValues(alpha: seen)), valueRects[i].bottomLeft, anchor: _Anchor.bottomLeft);
      }
      // The paper's name under the chart is always there: the axis never animates.
      _text(canvas, labels[i], last ? label.copyWith(color: colors.ink, fontWeight: FontWeight.w700) : label, Offset(c.dx, size.height - 4),
          anchor: _Anchor.bottomCenter, clampWidth: size.width);
    }
  }

  /// The reference number's box: at the left edge over the dashed line, or under it when a value
  /// would touch it there. Null without a reference on the chart.
  Rect? referenceLabelRect(Size size, List<Rect> values) {
    final ref = referenceFor(marks);
    if (ref == null) return null;
    final y = yFor(size, marks, outOf, ref.toDouble());
    final m = _measure('$ref', label);
    final over = Rect.fromLTWH(0, y - 4 - m.height, m.width, m.height);
    return values.any((r) => r.inflate(3).overlaps(over)) ? over.translate(0, m.height + 8) : over;
  }

  /// The laid-out size of [text] in [style] at the chart's text scale.
  Size _measure(String text, TextStyle style) {
    final tp = TextPainter(text: TextSpan(text: text, style: style), textDirection: TextDirection.ltr, textScaler: textScaler)..layout();
    final s = tp.size;
    tp.dispose();
    return s;
  }

  /// Each value's box on a chart of [size]: over its point, or under it when the reference line would
  /// run through it (and there is room above the papers' names); where neither is clear the dashes
  /// break behind it.
  List<Rect> valueRectsFor(Size size) {
    final n = marks.length;
    final pts = [for (var i = 0; i < n; i++) point(size, marks, outOf, i)];
    final ref = referenceFor(marks);
    final refY = ref == null ? null : yFor(size, marks, outOf, ref.toDouble());
    final showRef = refY != null && refY > 8 && refY < size.height - bottomRoom + 4;
    final axisTop = size.height - 4 - _measure(labels.last, label).height;
    final valueRects = <Rect>[];
    for (var i = 0; i < n; i++) {
      final last = i == n - 1;
      final m = _measure('${marks[i]}', last ? newestFigure : label);
      final c = pts[i];
      final gap = last ? 13.0 : 9.0;
      final dx = (c.dx - m.width / 2).clamp(0.0, math.max(0.0, size.width - m.width)).toDouble();
      var r = Rect.fromLTWH(dx, c.dy - gap - m.height, m.width, m.height);
      if (showRef && refY >= r.top - 2 && refY <= r.bottom + 2) {
        final under = Rect.fromLTWH(dx, c.dy + (last ? 11 : 8), m.width, m.height);
        if (under.bottom <= axisTop - 2) r = under;
      }
      valueRects.add(r);
    }
    return valueRects;
  }

  void _text(Canvas canvas, String text, TextStyle style, Offset at, {required _Anchor anchor, double? clampWidth}) {
    final tp = TextPainter(text: TextSpan(text: text, style: style), textDirection: TextDirection.ltr, textScaler: textScaler)..layout();
    var dx = switch (anchor) {
      _Anchor.bottomCenter => at.dx - tp.width / 2,
      _Anchor.bottomLeft => at.dx,
    };
    if (clampWidth != null) dx = dx.clamp(0.0, math.max(0.0, clampWidth - tp.width));
    tp.paint(canvas, Offset(dx, at.dy - tp.height));
    tp.dispose();
  }

  @override
  bool shouldRepaint(MarksPainter old) =>
      old.marks != marks || old.labels != labels || old.outOf != outOf || old.colors != colors || old.draw != draw || old.label != label || old.newestFigure != newestFigure || old.textScaler != textScaler;
}

enum _Anchor { bottomCenter, bottomLeft }
