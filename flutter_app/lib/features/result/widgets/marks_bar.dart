import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/domain/domain.dart';
import '../../../core/theme/theme.dart';

/// The four parts of a mock's marks, each with its own fill so they never rely on colour alone:
/// scored is solid (the sheet's ink), taken off is hatched, not earned on wrong answers is an
/// outline, not earned on blanks is dotted. Colours echo the bubbles: ink for right, coral for
/// wrong, grey for blank.
enum MarkPart { scored, takenOff, notEarnedWrong, notEarnedBlank }

class MarkSwatch extends StatelessWidget {
  const MarkSwatch({super.key, required this.part, this.size = 14});

  final MarkPart part;
  final double size;

  @override
  Widget build(BuildContext context) => CustomPaint(
    size: Size(size, size),
    painter: _PartPainter(colors: context.mmColors, parts: [(part, 1.0)], radius: 4),
  );
}

/// The 20 dp stacked bar of spec 5.6 card 2. [grow] (0 to 1) grows the segments left to right
/// with a 60 ms stagger; null draws the bar at rest.
class MarksBar extends StatelessWidget {
  const MarksBar({super.key, required this.breakdown, this.grow, this.height = 20});

  final MarkBreakdown breakdown;
  final Animation<double>? grow;
  final double height;

  List<(MarkPart, double)> _parts(double t) {
    final b = breakdown;
    final values = [math.max(0, b.scored), b.takenOff, b.notEarnedOnWrong, b.notEarnedOnBlank];
    final sum = values.fold<int>(0, (a, v) => a + v);
    if (sum == 0) return const [];
    const order = MarkPart.values;
    return [
      for (var i = 0; i < 4; i++)
        if (values[i] > 0) (order[i], values[i] / sum * _segment(t, i)),
    ];
  }

  /// Segment [i] grows over 320 ms, starting 60 ms after the previous (total 500 ms).
  static double _segment(double t, int i) {
    const total = 500.0;
    final start = i * 60 / total;
    final end = start + 320 / total;
    return Curves.easeOutCubic.transform(((t - start) / (end - start)).clamp(0.0, 1.0));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    Widget paint(double t) => CustomPaint(
      size: Size(double.infinity, height),
      painter: _PartPainter(colors: colors, parts: _parts(t), radius: height / 2, track: true),
    );
    final g = grow;
    return ExcludeSemantics(
      child: RepaintBoundary(
        child: SizedBox(
          height: height,
          width: double.infinity,
          child: g == null ? paint(1) : AnimatedBuilder(animation: g, builder: (context, _) => paint(g.value)),
        ),
      ),
    );
  }
}

class _PartPainter extends CustomPainter {
  _PartPainter({required this.colors, required this.parts, required this.radius, this.track = false});

  final MmColors colors;

  /// Each part and its share of the width (0 to 1).
  final List<(MarkPart, double)> parts;
  final double radius;
  final bool track;


  @override
  void paint(Canvas canvas, Size size) {
    final whole = RRect.fromRectAndRadius(Offset.zero & size, Radius.circular(radius));
    if (track) canvas.drawRRect(whole, Paint()..color = colors.sunken);
    canvas.save();
    canvas.clipRRect(whole);
    var x = 0.0;
    for (final (part, share) in parts) {
      final w = size.width * share;
      if (w <= 0) continue;
      final rect = Rect.fromLTWH(x, 0, w, size.height);
      _segment(canvas, rect, part);
      x += w;
      // A hairline of the ground between parts.
      if (x < size.width - 0.5) {
        canvas.drawRect(Rect.fromLTWH(x - 0.75, 0, 1.5, size.height), Paint()..color = colors.ground);
      }
    }
    canvas.restore();
  }

  void _segment(Canvas canvas, Rect r, MarkPart part) => paintMarkPart(canvas, r, part, colors);

  @override
  bool shouldRepaint(_PartPainter old) => old.colors != colors || old.radius != radius || !_same(old.parts);

  bool _same(List<(MarkPart, double)> o) {
    if (o.length != parts.length) return false;
    for (var i = 0; i < o.length; i++) {
      if (o[i] != parts[i]) return false;
    }
    return true;
  }
}

/// Fills [r] with [part]'s own pattern: solid volt for scored, coral hatching for taken off, a
/// coral outline for not earned on wrong answers, grey dots for not earned on blanks. Shared by the
/// bar and the flow, so a part looks the same everywhere.
void paintMarkPart(Canvas canvas, Rect r, MarkPart part, MmColors colors) {
  final wrongColor = colors.wrongMark;
    switch (part) {
      case MarkPart.scored:
        canvas.drawRect(
          r,
          Paint()
            ..shader = LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color.lerp(colors.volt, Colors.white, 0.18)!, colors.volt],
            ).createShader(r),
        );
      case MarkPart.takenOff:
        canvas.drawRect(r, Paint()..color = wrongColor.withValues(alpha: 0.28));
        canvas.save();
        canvas.clipRect(r);
        final hatch = Paint()
          ..color = wrongColor
          ..strokeWidth = 1.6;
        for (var x = r.left - r.height; x < r.right; x += 5) {
          canvas.drawLine(Offset(x, r.bottom), Offset(x + r.height, r.top), hatch);
        }
        canvas.restore();
      case MarkPart.notEarnedWrong:
        canvas.drawRect(
          r.deflate(0.8),
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.6
            ..color = wrongColor,
        );
      case MarkPart.notEarnedBlank:
        final dot = Paint()..color = colors.ink3;
        final step = 5.0;
        for (var y = r.top + step / 2; y < r.bottom; y += step) {
          final offset = ((y - r.top) / step).floor().isOdd ? step / 2 : 0.0;
          for (var x = r.left + step / 2 + offset; x < r.right; x += step) {
            canvas.drawCircle(Offset(x, y), 0.95, dot);
          }
        }
    }
}

/// One aligned row of the breakdown: swatch, label (with its "5 for each of 15" detail) and the
/// value, right-aligned with tabular figures.
class MarksRow extends StatelessWidget {
  const MarksRow({super.key, required this.part, required this.label, required this.value, this.detail});

  final MarkPart part;
  final String label;
  final String value;
  final String? detail;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MergeSemantics(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 3),
              child: MarkSwatch(part: part),
            ),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: type.body),
                  if (detail != null) Text(detail!, style: type.caption.copyWith(color: colors.ink3)),
                ],
              ),
            ),
            const SizedBox(width: MmSpace.s12),
            Text(value, style: type.labelLarge.copyWith(fontSize: 16)),
          ],
        ),
      ),
    );
  }
}

/// The four rows for a breakdown, separated by hairlines. Parts that are zero still show, so
/// the rows always add up to the whole.
class MarksRows extends StatelessWidget {
  const MarksRows({super.key, required this.breakdown, required this.labels});

  final MarkBreakdown breakdown;

  /// Label, value and detail per part, from the feature's copy.
  final List<(MarkPart, String, String, String?)> labels;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Column(
      children: [
        for (var i = 0; i < labels.length; i++) ...[
          if (i > 0) Divider(height: 1, thickness: 1, color: colors.line),
          MarksRow(part: labels[i].$1, label: labels[i].$2, value: labels[i].$3, detail: labels[i].$4),
        ],
      ],
    );
  }
}
