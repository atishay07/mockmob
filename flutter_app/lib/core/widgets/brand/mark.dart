import 'package:flutter/material.dart';

import '../../theme/theme.dart';
import '../bubbles/bubble_painter.dart';

/// Geometry of the MockMob mark, shared with `tool/make_icons.py` (keep them in step): a dark
/// rounded tile with a 2 by 2 grid of answer bubbles, the top-left one inked volt and the other
/// three hollow hairline rings, and a 1 dp volt edge light along the top.
abstract final class MarkGeometry {
  static const Color tile = Color(0xFF101210);
  static const double tileRadius = 0.25;
  static const double bubbleRadius = 0.112;
  static const double ringStroke = 0.026;

  /// Bubble centres as fractions of the tile.
  static const List<Offset> centres = [Offset(0.355, 0.355), Offset(0.645, 0.355), Offset(0.355, 0.645), Offset(0.645, 0.645)];

  /// Index of the inked bubble.
  static const int inked = 0;
}

/// The mark in code. [ink] (0 to 1) inks the volt bubble from its centre and [edge] (0 to 1)
/// draws the top edge light left to right, for the cold open. Both default to done.
class MmMark extends StatelessWidget {
  const MmMark({super.key, this.size = 64, this.ink = 1, this.edge = 1, this.tile = true, this.semanticLabel});

  final double size;
  final double ink;
  final double edge;

  /// False draws only the bubbles (on a surface that is already the tile colour).
  final bool tile;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final painted = CustomPaint(
      size: Size.square(size),
      painter: MarkPainter(colors: MmColors.dark, ink: ink, edge: edge, tile: tile),
    );
    if (semanticLabel == null) return ExcludeSemantics(child: painted);
    return Semantics(image: true, label: semanticLabel, child: painted);
  }
}

class MarkPainter extends CustomPainter {
  const MarkPainter({required this.colors, this.ink = 1, this.edge = 1, this.tile = true});

  /// Always the Night colours: the mark is a dark tile in both themes.
  final MmColors colors;
  final double ink;
  final double edge;
  final bool tile;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.shortestSide;
    final rect = Offset.zero & Size.square(s);
    final radius = BorderRadius.circular(s * MarkGeometry.tileRadius);
    if (tile) {
      canvas.drawRSuperellipse(radius.toRSuperellipse(rect), Paint()..color = MarkGeometry.tile);
      // A warm lamp catch in the upper-left corner, faint.
      canvas.save();
      canvas.clipRSuperellipse(radius.toRSuperellipse(rect));
      canvas.drawRect(
        rect,
        Paint()
          ..shader = RadialGradient(
            center: Alignment.topLeft,
            radius: 1.1,
            colors: [colors.lamp.withValues(alpha: 0.10), colors.lamp.withValues(alpha: 0)],
          ).createShader(rect),
      );
      canvas.restore();
      // A hairline edge so the dark tile holds its shape on the dark ground.
      canvas.drawRSuperellipse(
        radius.toRSuperellipse(rect.deflate(0.5)),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [const Color(0x2EFFF6E4), const Color(0x0AFFF6E4)],
          ).createShader(rect),
      );
    }

    final bubbles = BubblePaint(colors);
    final r = s * MarkGeometry.bubbleRadius;
    for (var i = 0; i < 4; i++) {
      final c = Offset(MarkGeometry.centres[i].dx * s, MarkGeometry.centres[i].dy * s);
      if (i == MarkGeometry.inked) {
        bubbles.paint(canvas, c, r, BubbleState.filled, fill: ink);
      } else {
        canvas.drawCircle(
          c,
          r - s * MarkGeometry.ringStroke / 2,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = s * MarkGeometry.ringStroke
            ..color = const Color(0xFF6A645A),
        );
      }
    }

    if (tile && edge > 0) {
      final y = s * 0.012 + 0.5;
      final start = s * MarkGeometry.tileRadius * 0.8;
      final end = start + (s - start * 2) * edge.clamp(0.0, 1.0);
      canvas.drawLine(
        Offset(start, y),
        Offset(end, y),
        Paint()
          ..strokeWidth = (s * 0.016).clamp(1.0, 3.0)
          ..strokeCap = StrokeCap.round
          ..shader = LinearGradient(
            colors: [colors.volt.withValues(alpha: 0.1), colors.volt, colors.volt.withValues(alpha: 0.1)],
          ).createShader(Rect.fromLTWH(start, 0, s - start * 2, 2)),
      );
    }
  }

  @override
  bool shouldRepaint(MarkPainter old) => old.ink != ink || old.edge != edge || old.tile != tile || old.colors != colors;
}
