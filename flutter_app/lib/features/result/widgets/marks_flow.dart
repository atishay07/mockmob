import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/domain/domain.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../copy.dart';
import 'marks_bar.dart';

/// "Where the marks went" as a flow: every mark on the paper in one column on the left, and a
/// ribbon from it to each place the marks went (scored, taken off by wrong answers, not earned on
/// wrong answers, not earned on blanks). Ribbon and block heights are exact shares of the paper's
/// marks; each row is at least as tall as its words at the student's text size, so nothing
/// overlaps. Parts that are zero keep their row as a hairline, so the rows always add up.
///
/// [grow] (0 to 1) draws it: the column fills downward, the ribbons run left to right one after
/// another, and each row's words arrive with their ribbon. Null draws it at rest.
class MarksFlow extends StatelessWidget {
  const MarksFlow({super.key, required this.breakdown, required this.rows, this.grow});

  final MarkBreakdown breakdown;

  /// Part, label, value ("115 marks") and detail ("5 for each of 15"), from the feature's copy.
  final List<(MarkPart, String, String, String?)> rows;
  final Animation<double>? grow;

  /// The height the whole paper's marks take in the column.
  static const double columnHeight = 168;
  static const double columnWidth = 12;
  static const double blockWidth = 10;
  static const double rowGap = 14;
  static const double numberSize = 28;

  /// The full animation, for whoever drives [grow].
  static const Duration duration = Duration(milliseconds: 1200);

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final scaler = MediaQuery.textScalerOf(context);
    final numberStyle = type.figureCompact.copyWith(fontSize: numberSize, height: 1, fontFeatures: const [FontFeature.tabularFigures()]);
    final unitStyle = type.labelLarge.copyWith(color: colors.ink2);
    final labelStyle = type.body.copyWith(height: 1.3);
    final detailStyle = type.caption.copyWith(color: colors.ink3);

    return LayoutBuilder(
      builder: (context, box) {
        final width = box.maxWidth;
        final ribbonEnd = (width * 0.27).clamp(76.0, 118.0);
        final textLeft = ribbonEnd + blockWidth + 14;
        final textWidth = math.max(40.0, width - textLeft);
        final max = math.max(1, breakdown.max);

        double measure(String text, TextStyle style) {
          final tp = TextPainter(text: TextSpan(text: text, style: style), textDirection: TextDirection.ltr, textScaler: scaler)
            ..layout(maxWidth: textWidth);
          final h = tp.height;
          tp.dispose();
          return h;
        }

        final layout = <_FlowRow>[];
        var y = 0.0;
        for (var i = 0; i < rows.length; i++) {
          final (part, label, value, detail) = rows[i];
          final amount = math.max(0, breakdown.parts[i]);
          final h = columnHeight * amount / max;
          final words = measure(value, numberStyle) + 2 + measure(label, labelStyle) + (detail == null ? 0 : measure(detail, detailStyle));
          final slot = math.max(h, words + 4);
          layout.add(_FlowRow(part: part, amount: amount, top: y, height: h, slot: slot));
          y += slot + (i < rows.length - 1 ? rowGap : 0);
        }
        final total = math.max(y, columnHeight);
        final columnTop = (total - columnHeight) / 2;

        final g = grow;
        Widget words(int i) {
          final (_, label, value, detail) = rows[i];
          final split = value.indexOf(' ');
          final number = split < 0 ? value : value.substring(0, split);
          final unit = split < 0 ? '' : value.substring(split);
          final zero = layout[i].amount == 0;
          Widget w = MergeSemantics(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(text: number, style: numberStyle.copyWith(color: zero ? colors.ink3 : colors.ink)),
                      TextSpan(text: unit, style: unitStyle),
                    ],
                  ),
                ),
                const SizedBox(height: 2),
                Text(label, style: labelStyle),
                if (detail != null) Text(detail, style: detailStyle),
              ],
            ),
          );
          if (g != null) {
            final child = w;
            w = AnimatedBuilder(
              animation: g,
              child: child,
              builder: (context, child) {
                final t = _wordsAt(g.value, i);
                if (t >= 1) return child!;
                return Opacity(
                  opacity: Motion.glide.transform(t),
                  child: Transform.translate(offset: Offset(0, 12 * (1 - Motion.emphasized.transform(t))), child: child),
                );
              },
            );
          }
          return Positioned(left: textLeft, top: layout[i].top, width: textWidth, child: w);
        }

        return SizedBox(
          height: total,
          width: width,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned.fill(
                child: ExcludeSemantics(
                  child: RepaintBoundary(
                    child: CustomPaint(
                      painter: _FlowPainter(
                        rows: layout,
                        colors: colors,
                        columnTop: columnTop,
                        ribbonEnd: ribbonEnd,
                        max: max,
                        grow: g,
                      ),
                    ),
                  ),
                ),
              ),
              for (var i = 0; i < rows.length; i++) words(i),
            ],
          ),
        );
      },
    );
  }

  /// The column fills over the first 28%.
  static double columnAt(double t) => Curves.easeOutCubic.transform((t / 0.28).clamp(0.0, 1.0));

  /// Ribbon [i] runs from 18%, each 9% after the one before, over 42% of the time.
  static double ribbonAt(double t, int i) => Motion.emphasized.transform(((t - 0.18 - i * 0.09) / 0.42).clamp(0.0, 1.0));

  /// Row [i]'s words arrive as its ribbon reaches them.
  static double _wordsAt(double t, int i) => ((t - 0.34 - i * 0.09) / 0.32).clamp(0.0, 1.0);
}

class _FlowRow {
  const _FlowRow({required this.part, required this.amount, required this.top, required this.height, required this.slot});

  final MarkPart part;
  final int amount;

  /// The row's slot in the flow (its words start here) and the block's share-true height.
  final double top;
  final double height;
  final double slot;
}

class _FlowPainter extends CustomPainter {
  _FlowPainter({required this.rows, required this.colors, required this.columnTop, required this.ribbonEnd, required this.max, this.grow})
    : super(repaint: grow);

  final List<_FlowRow> rows;
  final MmColors colors;
  final double columnTop;
  final double ribbonEnd;
  final int max;
  final Animation<double>? grow;

  Color _tint(MarkPart p) => switch (p) {
    MarkPart.scored => colors.volt,
    MarkPart.takenOff || MarkPart.notEarnedWrong => colors.wrongMark,
    MarkPart.notEarnedBlank => colors.ink3,
  };

  @override
  void paint(Canvas canvas, Size size) {
    final t = grow?.value ?? 1;
    const cw = MarksFlow.columnWidth;
    const bw = MarksFlow.blockWidth;
    final colHeight = MarksFlow.columnHeight;

    // The column: the paper's marks, split in the same order as the rows.
    final columnShown = MarksFlow.columnAt(t);
    final column = RRect.fromRectAndRadius(Rect.fromLTWH(0, columnTop, cw, colHeight), const Radius.circular(3));
    canvas.drawRRect(column, Paint()..color = colors.sunken);
    canvas.save();
    canvas.clipRRect(column);
    canvas.clipRect(Rect.fromLTWH(0, columnTop, cw, colHeight * columnShown));
    var sy = columnTop;
    final sources = <double>[];
    for (final r in rows) {
      sources.add(sy);
      final h = colHeight * r.amount / max;
      if (h > 0) {
        paintMarkPart(canvas, Rect.fromLTWH(0, sy, cw, h), r.part, colors);
        sy += h;
        if (sy < columnTop + colHeight - 0.5) canvas.drawRect(Rect.fromLTWH(0, sy - 0.75, cw, 1.5), Paint()..color = colors.ground);
      }
    }
    canvas.restore();

    // The ribbons, then each destination block as its ribbon arrives.
    for (var i = 0; i < rows.length; i++) {
      final r = rows[i];
      final p = MarksFlow.ribbonAt(t, i);
      final blockTop = r.top + 2;
      if (r.amount == 0 || r.height <= 0) {
        // A zero part keeps its place: a short hairline where its block would be.
        if (p > 0) {
          canvas.drawRect(
            Rect.fromLTWH(ribbonEnd, blockTop + 12, bw * p, 1.5),
            Paint()..color = colors.ink4,
          );
        }
        continue;
      }
      if (p <= 0) continue;
      final s0 = sources[i];
      final s1 = s0 + colHeight * r.amount / max;
      final d0 = blockTop;
      final d1 = blockTop + r.height;
      const x0 = cw;
      final x1 = ribbonEnd;
      final xm = (x0 + x1) / 2;
      final ribbon = Path()
        ..moveTo(x0, s0)
        ..cubicTo(xm, s0, xm, d0, x1, d0)
        ..lineTo(x1, d1)
        ..cubicTo(xm, d1, xm, s1, x0, s1)
        ..close();
      final tint = _tint(r.part);
      final reach = x0 + (x1 - x0) * p;
      canvas.save();
      canvas.clipRect(Rect.fromLTRB(x0, 0, reach + 0.5, size.height));
      final band = Rect.fromLTRB(x0, math.min(s0, d0), x1, math.max(s1, d1));
      canvas.drawPath(
        ribbon,
        Paint()
          ..shader = LinearGradient(
            colors: [tint.withValues(alpha: r.part == MarkPart.scored ? 0.30 : 0.20), tint.withValues(alpha: r.part == MarkPart.scored ? 0.16 : 0.10)],
          ).createShader(band),
      );
      // Lit edges, so each ribbon reads as its own band where they cross.
      final edge = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = tint.withValues(alpha: 0.38);
      canvas.drawPath(
        Path()
          ..moveTo(x0, s0)
          ..cubicTo(xm, s0, xm, d0, x1, d0),
        edge,
      );
      canvas.drawPath(
        Path()
          ..moveTo(x0, s1)
          ..cubicTo(xm, s1, xm, d1, x1, d1),
        edge,
      );
      canvas.restore();
      if (p > 0.82) {
        final grown = ((p - 0.82) / 0.18).clamp(0.0, 1.0);
        final block = Rect.fromLTWH(x1, d0, bw, math.max(2, r.height) * grown);
        canvas.save();
        canvas.clipRRect(RRect.fromRectAndRadius(block, const Radius.circular(2)));
        paintMarkPart(canvas, block, r.part, colors);
        canvas.restore();
      }
    }
  }

  @override
  bool shouldRepaint(_FlowPainter old) =>
      old.grow != grow || old.colors != colors || old.columnTop != columnTop || old.ribbonEnd != ribbonEnd || old.max != max || !_sameRows(old.rows);

  bool _sameRows(List<_FlowRow> o) {
    if (o.length != rows.length) return false;
    for (var i = 0; i < o.length; i++) {
      if (o[i].top != rows[i].top || o[i].height != rows[i].height || o[i].amount != rows[i].amount) return false;
    }
    return true;
  }
}

/// The flow's one line above the column: "All 250 marks on the paper".
class FlowSourceLine extends StatelessWidget {
  const FlowSourceLine({super.key, required this.max});

  final int max;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return Text(ResultCopy.flowSource(max), style: type.label.copyWith(color: context.mmColors.ink2));
  }
}
